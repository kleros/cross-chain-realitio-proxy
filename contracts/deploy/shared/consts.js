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

const termsOfServices = {
  default: "QmNV5NWwCudYKfiHuhdWxccrPyxs4DnbLGQace2oMKHkZv/Question_Resolution_Policy.pdf",
  butter: "QmSv9ohhChMtyqwqsvfgeJtZQBWkwAboBc1n3UGvprfdd7/Conditional_Funding_Markets_-_Question_Resolution_Policy.pdf",
}

function generateMultiformat(tosKey = 'default') {
  const tosPath = termsOfServices[tosKey]
  if (!tosPath) throw new Error(`Terms of service not found: ${tosKey}. Valid options are: ${Object.keys(termsOfServices).join(', ')}.`)
  return `/ipfs/${tosPath}` // for Kleros: https://multiformats.io/multiaddr/
}

function generateMetadata(tosKey = 'default') {
  const tosPath = termsOfServices[tosKey]
  if (!tosPath) throw new Error(`Terms of service not found: ${tosKey}. Valid options are: ${Object.keys(termsOfServices).join(', ')}.`)
  const tosUri = `ipfs://${tosPath}` // URI format for Reality: https://en.wikipedia.org/wiki/Uniform_Resource_Identifier#Example_URIs
  return `{"tos":"${tosUri}", "foreignProxy":true}`
}

const metadata = generateMetadata('default')
const metadataButter = generateMetadata('butter')

module.exports = {
  arbitrators,
  courts,
  termsOfServices,
  generateMultiformat,
  generateMetadata,
  metadata,
  metadataButter,
};
