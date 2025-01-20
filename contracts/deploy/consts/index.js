const { ethers } = require("ethers");

function getChainsByTag(tag) {
  const hardhatConfig = require("../../hardhat.config.js");
  const zkSyncConfig = require("../../hardhat.config.zksync.js");

  // Deep merge rather than spread which is a shallow merge
  function deepMerge(target, source) {
    if (!source) return target;
    if (!target) return source;

    const result = { ...target };
    for (const key in source) {
      if (typeof source[key] === "object" && !Array.isArray(source[key])) {
        result[key] = deepMerge(target[key], source[key]);
      } else {
        result[key] = source[key];
      }
    }
    return result;
  }

  const mergedNetworks = deepMerge(hardhatConfig?.networks || {}, zkSyncConfig?.networks || {});

  return Object.entries(mergedNetworks).reduce((acc, [networkName, networkConfig]) => {
    if (networkConfig.tags?.includes(tag)) acc[networkName] = networkConfig;
    return acc;
  }, {});
}

const homeChains = getChainsByTag("home");
const foreignChains = getChainsByTag("foreign");

const HOME_CHAIN_IDS = Object.values(homeChains).map((chain) => chain.chainId);
const FOREIGN_CHAIN_IDS = Object.values(foreignChains).map((chain) => chain.chainId);

const { mainnet, sepolia } = foreignChains;

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

const gwei = (units) => ethers.parseUnits(units, "gwei");
const eth = (units) => ethers.parseEther(units);
const toBytes32 = (number) => ethers.zeroPadValue(ethers.toBeHex(number), 32);
const encodeExtraData = (courtId, minJurors) =>
  ethers.AbiCoder.defaultAbiCoder().encode(["uint96", "uint96"], [courtId, minJurors]);

module.exports = {
  homeChains,
  foreignChains,
  HOME_CHAIN_IDS,
  FOREIGN_CHAIN_IDS,
  arbitrators,
  courts,
  termsOfServiceUri,
  termsOfServiceMultiformat,
  metadata,
  gwei,
  eth,
  toBytes32,
  encodeExtraData,
};
