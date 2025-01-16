const getContractAddress = require("../deploy-helpers/getContractAddress");

const HOME_CHAIN_IDS = [10200, 100];
const paramsByChainId = {
  10200: {
    amb: "0x8448E15d0e706C0298dECA99F0b4744030e59d7d",
    realitio: "0x1E732a1C5e9181622DD5A931Ec6801889ce66185",
    foreignChainId: 11155111,
  },
  100: {
    amb: "0x75Df5AF045d91108662D8080fD1FEFAd6aA0bb59",
    realitio: "0xE78996A233895bE74a66F451f1019cA9734205cc",
    foreignChainId: 1,
  },
};
const metadata =
  '{"tos":"ipfs://QmNV5NWwCudYKfiHuhdWxccrPyxs4DnbLGQace2oMKHkZv/Question_Resolution_Policy.pdf", "foreignProxy":true}';

async function deployHomeProxy({ deployments, getNamedAccounts, getChainId, ethers, config }) {
  const { deploy } = deployments;
  const { providers } = ethers;
  const { hexZeroPad } = ethers.utils;

  const accounts = await getNamedAccounts();
  const { deployer } = accounts;
  const chainId = await getChainId();

  const foreignNetworks = {
    10200: config.networks.sepolia,
    100: config.networks.mainnet,
  };
  const { url } = foreignNetworks[chainId];
  const foreignChainProvider = new providers.JsonRpcProvider(url);
  const nonce = await foreignChainProvider.getTransactionCount(deployer);

  const { amb, foreignChainId, realitio } = paramsByChainId[chainId];

  // Foreign proxy deploy will happen AFTER this, so the nonce on that account should be the current transaction count
  const foreignProxyAddress = getContractAddress(deployer, nonce);
  const foreignChainIdAsBytes32 = hexZeroPad(foreignChainId, 32);

  const homeProxy = await deploy("RealitioHomeProxyGnosis", {
    from: deployer,
    gas: 8000000,
    maxPriorityFeePerGas: ethers.utils.parseUnits("2", "gwei"),
    maxFeePerGas: ethers.utils.parseUnits("20", "gwei"),
    args: [amb, foreignProxyAddress, foreignChainIdAsBytes32, realitio, metadata],
  });

  console.log("Home Proxy:", homeProxy.address);
  console.log("Foreign Proxy:", foreignProxyAddress);
}

deployHomeProxy.tags = ["HomeChain"];
deployHomeProxy.skip = async ({ getChainId }) => !HOME_CHAIN_IDS.includes(Number(await getChainId()));

module.exports = deployHomeProxy;
