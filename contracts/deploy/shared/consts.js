const chains = require("./chains");

const { mainnet, sepolia } = chains.foreignChains;

const arbitrators = {
  [mainnet.chainId]: "0x988b3a538b618c7a603e1c11ab82cd16dbe28069", // KlerosLiquid
  [sepolia.chainId]: "0x90992fb4E15ce0C59aEFfb376460Fda4Ee19C879", // KlerosLiquid
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

const termsOfService = "QmNV5NWwCudYKfiHuhdWxccrPyxs4DnbLGQace2oMKHkZv/Question_Resolution_Policy.pdf";
const termsOfServiceUri = `ipfs://${termsOfService}`; // for Reality: https://en.wikipedia.org/wiki/Uniform_Resource_Identifier#Example_URIs
const termsOfServiceMultiformat = `/ipfs/${termsOfService}`; // for Kleros: https://multiformats.io/multiaddr/
const metadata = `{"tos":"${termsOfServiceUri}", "foreignProxy":true}`;

module.exports = {
  arbitrators,
  courts,
  termsOfServiceUri,
  termsOfServiceMultiformat,
  metadata,
};
