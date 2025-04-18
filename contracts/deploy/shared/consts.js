const chains = require("./chains");
const { generateMetadata } = require("./utils");

const { mainnet, sepolia } = chains.foreignChains;

const arbitrators = {
  [mainnet.chainId]: "0x988b3a538b618c7a603e1c11ab82cd16dbe28069", // KlerosLiquid
  [sepolia.chainId]: "0x90992fb4E15ce0C59aEFfb376460Fda4Ee19C879", // KlerosLiquid
};

const wNatives = {
  [mainnet.chainId]: "0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2", // WETH address
  [sepolia.chainId]: "0x7b79995e5f793a07bc00c21412e50ecae098e7f9", // WETH address
};

const courts = {
  [mainnet.chainId]: {
    general: 1,
    oracle: 24,
  },
  [sepolia.chainId]: {
    general: 1,
    oracle: 3,
  },
};

const metadata = generateMetadata("default");

module.exports = {
  arbitrators,
  wNatives,
  courts,
  metadata,
};
