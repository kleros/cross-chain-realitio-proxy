const { realityETHConfig } = require("@reality.eth/contracts");
const { homeChains, generateMetadata } = require("../shared");
const { unichain, optimism, redstone, unichainSepolia, optimismSepolia, base } = homeChains;

// CrossDomainMessenger precompile is identical for all OP L2s
// Redstone Messenger - https://redstone.xyz/docs/contract-addresses
// Optimism Sepolia Messenger - https://docs.optimism.io/chain/addresses
// Unichain Sepolia Messenger - https://docs.unichain.org/docs/technical-information/contract-addresses
// Same for all the L2 OP chains

const homeParameters = {
  [unichainSepolia.chainId]: {
    realitio: realityETHConfig(unichainSepolia.chainId, "ETH", "3.0").address,
    variant: "Unichain",
  },
  [optimismSepolia.chainId]: {
    realitio: realityETHConfig(optimismSepolia.chainId, "ETH", "3.0").address,
    variant: "Optimism",
  },
  [unichain.chainId]: {
    realitio: realityETHConfig(unichain.chainId, "ETH", "3.0").address,
    variant: "Unichain",
  },
  [optimism.chainId]: {
    realitio: realityETHConfig(optimism.chainId, "OETH", "3.0").address,
    variant: "Optimism",
  },
  [redstone.chainId]: {
    realitio: realityETHConfig(redstone.chainId, "ETH", "3.0").address,
    variant: "Redstone",
  },
  [base.chainId]: {
    realitio: realityETHConfig(base.chainId, "ETH", "3.0").address,
    variant: "Base",
  },
};

async function deployHomeProxy({ deploy, from, parameters, foreignChainId, foreignProxy }) {
  const { realitio, variant } = parameters;
  const metadata = generateMetadata(process.env.TOS);
  console.log(`Metadata: ${metadata}`);
  return await deploy(`RealitioHomeProxy${variant}`, {
    contract: "RealitioHomeProxyOptimism",
    from,
    args: [realitio, metadata, foreignProxy, foreignChainId],
    log: true,
  });
}

const supportedChainIds = Object.keys(homeParameters).map(Number);

module.exports = { deployHomeProxy, homeParameters, supportedChainIds };
