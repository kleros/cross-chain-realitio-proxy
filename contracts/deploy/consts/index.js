function getChainsByTag(tag) {
  const { config } = require("hardhat");
  return Object.entries(config.networks).reduce((acc, [networkName, networkConfig]) => {
    if (networkConfig.tags?.includes(tag)) acc[networkName] = networkConfig;
    return acc;
  }, {});
}

const homeChains = getChainsByTag("home");
const foreignChains = getChainsByTag("foreign");

const HOME_CHAIN_IDS = Object.values(homeChains).map((chain) => chain.chainId);
const FOREIGN_CHAIN_IDS = Object.values(foreignChains).map((chain) => chain.chainId);

const gwei = (units) => ethers.utils.parseUnits(units, "gwei");
const toBytes32 = (number) => ethers.zeroPadValue(number, 32);

module.exports = {
  homeChains,
  foreignChains,
  HOME_CHAIN_IDS,
  FOREIGN_CHAIN_IDS,
  gwei,
  toBytes32,
};
