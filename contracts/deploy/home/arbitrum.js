const { realityETHConfig } = require("@reality.eth/contracts");
const { homeChains, metadata } = require("../shared");
const { arbitrumSepolia, arbitrum } = homeChains;

// The home chain bridge address is hardcoded to the precompile address for ArbSys
// https://docs.arbitrum.io/build-decentralized-apps/reference/contract-addresses#precompiles

const homeParameters = {
  [arbitrumSepolia.chainId]: {
    realitio: realityETHConfig(arbitrumSepolia.chainId, "ETH", "3.0").address,
  },
  [arbitrum.chainId]: {
    realitio: realityETHConfig(arbitrum.chainId, "ARETH", "3.0").address,
  },
};

async function deployHomeProxy({ deploy, from, parameters, foreignChainId, foreignProxy }) {
  const { realitio } = parameters;
  return await deploy("RealitioHomeProxyArbitrum", {
    from,
    args: [realitio, metadata, foreignProxy, foreignChainId],
    log: true,
  });
}

const supportedChainIds = Object.keys(homeParameters).map(Number);

module.exports = { deployHomeProxy, homeParameters, supportedChainIds };
