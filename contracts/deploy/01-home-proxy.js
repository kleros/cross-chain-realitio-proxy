const getContractAddress = require("../deploy-helpers/getContractAddress");

const HOME_CHAIN_IDS = [77, 100];
const paramsByChainId = {
  77: {
    amb: "0xFe446bEF1DbF7AFE24E81e05BC8B271C1BA9a560",
    realitio: "0x90a617ed516ab7fAaBA56CcEDA0C5D952f294d03",
    foreignChainId: 42,
  },
  100: {
    amb: "0x75Df5AF045d91108662D8080fD1FEFAd6aA0bb59",
    realitio: "0x79e32aE03fb27B07C89c0c568F80287C01ca2E57",
    foreignChainId: 1,
  },
};

async function deployHomeProxy({ deployments, getNamedAccounts, getChainId, ethers, config }) {
  const { deploy } = deployments;
  const { providers } = ethers;
  const { hexZeroPad } = ethers.utils;

  const accounts = await getNamedAccounts();
  const { deployer, counterPartyDeployer } = accounts;
  const chainId = await getChainId();

  const foreignNetworks = {
    77: config.networks.kovan,
    100: config.networks.mainnet,
  };
  const { url } = foreignNetworks[chainId];
  const foreignChainProvider = new providers.JsonRpcProvider(url);
  const nonce = await foreignChainProvider.getTransactionCount(counterPartyDeployer);

  const { amb, foreignChainId, realitio } = paramsByChainId[chainId];

  // Foreign proxy deploy will happen AFTER this, so the nonce on that account should be the current transaction count
  const foreignProxyAddress = getContractAddress(counterPartyDeployer, nonce);
  const foreignChainIdAsBytes32 = hexZeroPad(foreignChainId, 32);

  const homeProxy = await deploy("RealitioHomeArbitrationProxy", {
    from: deployer,
    gas: 8000000,
    args: [amb, foreignProxyAddress, foreignChainIdAsBytes32, realitio],
  });

  console.log("Home Proxy:", homeProxy.address);
  console.log("Foreign Proxy:", foreignProxyAddress);
}

deployHomeProxy.tags = ["HomeChain"];
deployHomeProxy.skip = async ({ getChainId }) => !HOME_CHAIN_IDS.includes(Number(await getChainId()));

module.exports = deployHomeProxy;
