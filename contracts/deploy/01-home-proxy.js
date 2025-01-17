const { HOME_CHAIN_IDS } = require("./consts/index");
const optimismProxy = require("./home/optimism.js");
const gnosisProxy = require("./home/gnosis.js");
const arbitrumProxy = require("./home/arbitrum.js");
const polygonProxy = require("./home/polygon.js");

async function deployHomeProxy({ deployments, getChainId, ethers, config, network }) {
  console.log(`Running deployment script for home proxy contract on ${network.name}`);

  const { deploy, get } = deployments;
  const chainId = await getChainId();
  const proxyConfigs = [optimismProxy, gnosisProxy, arbitrumProxy, polygonProxy];
  const proxyConfig = proxyConfigs.find((config) => config.supportedChainIds.includes(Number(chainId)));
  if (!proxyConfig) {
    throw new Error(`No proxy configuration supports chain ID ${chainId}`);
  }
  if (!network.companionNetworks.foreign) {
    throw new Error("Foreign network not configured in companion networks");
  }
  const foreignNetwork = config.networks[network.companionNetworks.foreign];
  const provider = new ethers.JsonRpcProvider(foreignNetwork.url);
  const [account] = await ethers.getSigners();
  const nonce = await provider.getTransactionCount(account.address);
  console.log(`Nonce: ${nonce}`);
  const transaction = {
    from: account.address,
    nonce: nonce,
  };
  const foreignProxy = ethers.getCreateAddress(transaction);
  console.log(`Foreign proxy: ${foreignProxy}`);

  const homeProxy = await proxyConfig.deployHomeProxy(
    deploy,
    get,
    account.address,
    proxyConfig.homeParameters[chainId],
    foreignNetwork.chainId,
    foreignProxy
  );

  console.log(`RealitioHomeProxy was deployed to ${homeProxy.address}`);
}

deployHomeProxy.tags = ["HomeChain"];
deployHomeProxy.skip = async ({ getChainId }) => !HOME_CHAIN_IDS.includes(Number(await getChainId()));

module.exports = deployHomeProxy;
