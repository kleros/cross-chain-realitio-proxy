const { realityETHConfig } = require("@reality.eth/contracts");
const { utils } = require("zksync-ethers");
const { homeChains, metadata } = require("../shared");
const { zkSyncSepolia, zkSyncMainnet } = homeChains;

const homeParameters = {
  [zkSyncSepolia.chainId]: {
    realitio: realityETHConfig(zkSyncSepolia.chainId, "ETH", "3.0").address,
  },
  [zkSyncMainnet.chainId]: {
    realitio: realityETHConfig(zkSyncMainnet.chainId, "ETH", "3.0").address,
  },
};

async function deployHomeProxy({ deploy, from, parameters, foreignChainId, foreignProxy }) {
  const { realitio } = parameters;
  const foreignProxyAlias = utils.applyL1ToL2Alias(foreignProxy);
  return await deploy("RealitioHomeProxyZkSync", {
    from,
    args: [realitio, metadata, foreignProxy, foreignProxyAlias, foreignChainId],
    log: true,
  });
}

const supportedChainIds = Object.keys(homeParameters).map(Number);

module.exports = { deployHomeProxy, homeParameters, supportedChainIds };
