const { realityETHConfig } = require("@reality.eth/contracts");
const { HOME_CHAIN_IDS } = require("./shared");
const arbitrumProxy = require("./home/arbitrum.js");
const gnosisProxy = require("./home/gnosis.js");
const optimismProxy = require("./home/optimism.js");
const polygonProxy = require("./home/polygon.js");
const zksyncProxy = require("./home/zksync.js");

async function deployHomeProxy({ deployments, getChainId, ethers, config, network }) {
  console.log(`Running deployment script for home proxy contract on ${network.name}`);

  const { deploy } = deployments;
  const chainId = await getChainId();
  const proxyConfigs = [arbitrumProxy, gnosisProxy, optimismProxy, polygonProxy, zksyncProxy];
  const proxyConfig = proxyConfigs.find((config) => config.supportedChainIds.includes(Number(chainId)));
  if (!proxyConfig) {
    throw new Error(`No home proxy configuration supports chain ID ${chainId}`);
  }
  if (!network.companionNetworks.foreign) {
    throw new Error("Foreign network not configured in companion networks");
  }
  const parameters = proxyConfig.homeParameters[chainId];
  const foreignNetwork = config.networks[network.companionNetworks.foreign];
  const foreignChainId = foreignNetwork.chainId;
  const provider = new ethers.JsonRpcProvider(foreignNetwork.url);
  const from = await ethers.getSigners().then((signers) => signers[0].address);
  const nonce = await provider.getTransactionCount(from);
  console.log(`Nonce: ${nonce}`);
  const transaction = {
    from,
    nonce: nonce,
  };
  const foreignProxy = ethers.getCreateAddress(transaction);
  console.log(`Expected foreign proxy address: ${foreignProxy}`);

  const homeProxy = await proxyConfig.deployHomeProxy({
    deploy,
    from,
    parameters,
    foreignChainId,
    foreignProxy,
  });

  console.log(`RealitioHomeProxy was deployed to ${homeProxy.address}`);
}

deployHomeProxy.tags = ["HomeChain"];
deployHomeProxy.skip = async ({ getChainId }) => !HOME_CHAIN_IDS.includes(Number(await getChainId()));

module.exports = deployHomeProxy;
