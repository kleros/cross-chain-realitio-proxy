const { homeChains, metadata } = require("../shared");
const { unichain, optimism, redstone, unichainSepolia, optimismSepolia } = homeChains;

// CrossDomainMessenger precompile is identical for all OP L2s
// Redstone Messenger - https://redstone.xyz/docs/contract-addresses
// Optimism Sepolia Messenger - https://docs.optimism.io/chain/addresses
// Unichain Sepolia Messenger - https://docs.unichain.org/docs/technical-information/contract-addresses
// Same for all the L2 OP chains

const homeParameters = {
  [unichainSepolia.chainId]: {
    // https://github.com/RealityETH/reality-eth-monorepo/blob/main/packages/contracts/chains/deployments/1301/ETH/RealityETH-3.0.json
    realitio: "0x288799697AE9EbceDC1b30BBAE6a38e03e41CdDb",
    variant: "Unichain",
  },
  [optimismSepolia.chainId]: {
    // https://github.com/RealityETH/reality-eth-monorepo/blob/main/packages/contracts/chains/deployments/11155420/ETH/RealityETH-3.0.json
    realitio: "0xeAD0ca922390a5E383A9D5Ba4366F7cfdc6f0dbA",
    variant: "Optimism",
  },
  [unichain.chainId]: {
    // https://github.com/RealityETH/reality-eth-monorepo/blob/main/packages/contracts/chains/deployments/130/ETH/RealityETH-3.0.json
    realitio: "0x0000000000000000000000000000000000000000", // FIXME!
    variant: "Unichain",
  },
  [optimism.chainId]: {
    // https://github.com/RealityETH/reality-eth-monorepo/blob/main/packages/contracts/chains/deployments/10/OETH/RealityETH-3.0.json
    realitio: "0x0eF940F7f053a2eF5D6578841072488aF0c7d89A",
    variant: "Optimism",
  },
  [redstone.chainId]: {
    // https://github.com/RealityETH/reality-eth-monorepo/blob/main/packages/contracts/chains/deployments/690/ETH/RealityETH-3.0.json
    realitio: "0xc716c23D75f523eF0C511456528F2A1980256a87",
    variant: "Redstone",
  },
};

async function deployHomeProxy({ deploy, from, parameters, foreignChainId, foreignProxy }) {
  const { realitio, variant } = parameters;
  return await deploy(`RealitioHomeProxy${variant}`, {
    contract: "RealitioHomeProxyOptimism",
    from,
    args: [realitio, metadata, foreignProxy, foreignChainId],
    log: true,
  });
}

const supportedChainIds = Object.keys(homeParameters).map(Number);

module.exports = { deployHomeProxy, homeParameters, supportedChainIds };
