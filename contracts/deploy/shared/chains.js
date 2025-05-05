const hardhatConfig = require("../../hardhat.config.ts").default;
const zkSyncConfig = require("../../hardhat.config.zksync.ts").default;

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

function getChainsByTag(tag) {
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

module.exports = {
  homeChains,
  foreignChains,
  HOME_CHAIN_IDS,
  FOREIGN_CHAIN_IDS,
};
