const { homeChains } = require("../consts");
const { arbitrumSepolia, arbitrum } = homeChains;

const metadata =
  '{"tos":"ipfs://QmNV5NWwCudYKfiHuhdWxccrPyxs4DnbLGQace2oMKHkZv/Question_Resolution_Policy.pdf", "foreignProxy":true}';

// The home chain bridge address is hardcoded to the precompile address for ArbSys
// https://docs.arbitrum.io/build-decentralized-apps/reference/contract-addresses#precompiles

const homeParameters = {
  [arbitrumSepolia.chainId]: {
    // https://github.com/RealityETH/reality-eth-monorepo/blob/main/packages/contracts/chains/deployments/421614/ETH/RealityETH-3.0.json
    realitio: "0xB78396EFaF0a177d125e9d45B2C6398Ac5f803B9",
    metadata,
  },
  [arbitrum.chainId]: {
    // https://github.com/RealityETH/reality-eth-monorepo/blob/main/packages/contracts/chains/deployments/42161/ETH/RealityETH-3.0.json
    realitio: "0x5D18bD4dC5f1AC8e9bD9B666Bd71cB35A327C4A9",
    metadata,
  },
};

async function deployHomeProxy(deploy, get, from, chainParams, foreignChainId, foreignProxy) {
  const { realitio, metadata } = chainParams;
  return await deploy(`RealitioHomeProxyArbitrum`, {
    from,
    args: [realitio, foreignChainId, foreignProxy, metadata],
    log: true,
  });
}

const supportedChainIds = Object.keys(homeParameters).map(Number);

module.exports = { deployHomeProxy, homeParameters, supportedChainIds };
