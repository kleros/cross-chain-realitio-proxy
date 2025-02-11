const { homeChains, metadata } = require("../shared");
const { arbitrumSepolia, arbitrum } = homeChains;

// The home chain bridge address is hardcoded to the precompile address for ArbSys
// https://docs.arbitrum.io/build-decentralized-apps/reference/contract-addresses#precompiles

const homeParameters = {
  [arbitrumSepolia.chainId]: {
    // https://github.com/RealityETH/reality-eth-monorepo/blob/main/packages/contracts/chains/deployments/421614/ETH/RealityETH-3.0.json
    realitio: "0xB78396EFaF0a177d125e9d45B2C6398Ac5f803B9",
  },
  [arbitrum.chainId]: {
    // https://github.com/RealityETH/reality-eth-monorepo/blob/main/packages/contracts/chains/deployments/42161/ARETH/RealityETH-3.0.json
    realitio: "0x5D18bD4dC5f1AC8e9bD9B666Bd71cB35A327C4A9",
  },
};

async function deployHomeProxy({ deploy, from, parameters, foreignChainId, foreignProxy }) {
  const { realitio } = parameters;
  return await deploy(`RealitioHomeProxyArbitrum`, {
    from,
    args: [realitio, metadata, foreignProxy, foreignChainId],
    log: true,
  });
}

const supportedChainIds = Object.keys(homeParameters).map(Number);

module.exports = { deployHomeProxy, homeParameters, supportedChainIds };
