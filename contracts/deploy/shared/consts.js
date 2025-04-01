const chains = require("./chains");

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

const policies = {
  default: "QmNV5NWwCudYKfiHuhdWxccrPyxs4DnbLGQace2oMKHkZv/Question_Resolution_Policy.pdf",
  noAnswerTooSoon: "QmaUr6hnSVxYD899xdcn2GUVtXVjXoSXKZbce3zFtGWw4H/Question_Resolution_Policy.pdf",
  butter: "QmSv9ohhChMtyqwqsvfgeJtZQBWkwAboBc1n3UGvprfdd7/Conditional_Funding_Markets_-_Question_Resolution_Policy.pdf",
  seer: "QmPmRkXFUmzP4rq2YfD3wNwL8bg3WDxkYuvTP9A9UZm9gJ/seer-markets-resolution-policy.pdf",
  omen: "QmZM12kkguXFk2C94ykrKpambt4iUVKsVsxGxDEdLS68ws/omen-rules.pdf",
  zodiac:
    "QmXyo9M4Z2XY6Nw9UfuuUNzKXXNhvt24q6pejuN9RYWPMr/Reality_Module_Governance_Oracle-Question_Resolution_Policy.pdf",
};

function generatePolicyUri(policy = "default") {
  const policyPath = policies[policy];
  if (!policyPath) {
    throw new Error(`Policy not found: ${policy}. Valid options are: ${Object.keys(policies).join(", ")}.`);
  }
  return `/ipfs/${policyPath}`; // for Kleros: https://multiformats.io/multiaddr/
}

function generateMetadata(policy = "default") {
  const policyPath = policies[policy];
  if (!policyPath) {
    throw new Error(`Policy not found: ${policy}. Valid options are: ${Object.keys(policies).join(", ")}.`);
  }
  const tosUri = `ipfs://${policyPath}`; // URI format for Reality: https://en.wikipedia.org/wiki/Uniform_Resource_Identifier#Example_URIs
  return `{"tos":"${tosUri}", "foreignProxy":true}`;
}

const metadata = generateMetadata("default");
const metadataButter = generateMetadata("butter");

module.exports = {
  arbitrators,
  wNatives,
  courts,
  policies,
  generatePolicyUri,
  generateMetadata,
  metadata,
  metadataButter,
};
