const { FOREIGN_CHAIN_IDS, arbitrators, courts } = require("./consts/index");
const arbitrumProxy = require("./foreign/arbitrum.js");
const gnosisProxy = require("./foreign/gnosis.js");
const optimismProxy = require("./foreign/optimism.js");
const polygonProxy = require("./foreign/polygon.js");

// Note that values apply to both testnet and mainnet since fees are observed to be about the same on both chains as of mid 2024.
const winnerMultiplier = 3000;
const loserMultiplier = 7000;
const loserAppealPeriodMultiplier = 5000;

async function getHomeDeployments({ companionNetworks, homeNetworkName, homeChainId }) {
  let homeNetwork;
  for await (const [key, network] of Object.entries(companionNetworks))
    if (key.startsWith("home") && String(await network.getChainId()) === String(homeChainId)) homeNetwork = network;
  if (!homeNetwork) throw new Error(`Home network ${homeNetworkName} not configured correctly`);
  return homeNetwork.deployments;
}

async function deployForeignProxy({ deployments, getChainId, ethers, companionNetworks, config, network }) {
  const homeNetworkName = process.env.HOME_NETWORK;
  if (!homeNetworkName) throw new Error("HOME_NETWORK environment variable must be set");
  const proxyConfigs = [arbitrumProxy, gnosisProxy, optimismProxy, polygonProxy];
  const proxyConfig = proxyConfigs.find((config) => config.supportedHomeChains.includes(homeNetworkName));
  if (!proxyConfig) {
    throw new Error(`No foreign proxy configuration supports home network ${homeNetworkName}`);
  }

  console.log(
    `Running deployment script for foreign proxy contract on ${network.name} for home proxy ${homeNetworkName}`
  );

  const { deploy, get } = deployments;
  const chainId = await getChainId();
  const from = await ethers.getSigners().then((signers) => signers[0].address);
  const parameters = proxyConfig.foreignParameters[homeNetworkName];
  const homeProxyName = proxyConfig.getHomeProxyName(homeNetworkName);
  const homeChainId = config.networks[homeNetworkName].chainId;
  const homeDeployments = await getHomeDeployments({ companionNetworks, homeNetworkName, homeChainId });
  const homeProxy = await homeDeployments.get(homeProxyName).then((homeProxy) => homeProxy.address);

  const foreignProxy = await proxyConfig.deployForeignProxy({
    deploy,
    get,
    from,
    parameters,
    homeChainId,
    homeProxy,
    arbitrator: arbitrators[chainId],
    courts: courts[chainId],
    multipliers: [winnerMultiplier, loserMultiplier, loserAppealPeriodMultiplier],
  });

  console.log(`Foreign proxy contract was successfully deployed at ${foreignProxy.address}`);
}

deployForeignProxy.tags = ["ForeignChain"];
deployForeignProxy.skip = async ({ getChainId }) => !FOREIGN_CHAIN_IDS.includes(Number(await getChainId()));

module.exports = deployForeignProxy;
