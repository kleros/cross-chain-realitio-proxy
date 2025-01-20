const { utils } = require("zksync-ethers");
const { homeChains, metadata } = require("../consts");
const { zkSyncSepolia, zkSyncMainnet } = homeChains;

const homeParameters = {
  [zkSyncSepolia.chainId]: {
    // https://github.com/RealityETH/reality-eth-monorepo/blob/main/packages/contracts/chains/deployments/300/ETH/RealityETH-3.0.json
    realitio: "0x4E346436e99fb7d6567A2bd024d8806Fc10d84D2",
  },
  [zkSyncMainnet.chainId]: {
    // https://github.com/RealityETH/reality-eth-monorepo/blob/main/packages/contracts/chains/deployments/324/ETH/RealityETH-3.0.json
    realitio: "0xA8AC760332770FcF2056040B1f964750e4bEf808",
  },
};

async function deployHomeProxy({ deploy, from, parameters, foreignChainId, foreignProxy }) {
  const { realitio } = parameters;
  const foreignProxyAlias = utils.applyL1ToL2Alias(foreignProxy);
  return await deploy(`RealitioHomeProxyZkSync`, {
    from,
    args: [realitio, metadata, foreignProxy, foreignProxyAlias, foreignChainId],
    log: true,
  });
}

const supportedChainIds = Object.keys(homeParameters).map(Number);

module.exports = { deployHomeProxy, homeParameters, supportedChainIds };
