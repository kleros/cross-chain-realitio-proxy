const getContractAddress = require("../deploy-helpers/getContractAddress");

const FOREIGN_CHAIN_IDS = [42, 1];
const paramsByChainId = {
  42: {
    amb: "0xFe446bEF1DbF7AFE24E81e05BC8B271C1BA9a560",
    // arbitrator: "0xA8243657a1E6ad1AAf2b59c4CCDFE85fC6fD7a8B",
    // arbitrator: "0x3b261920Ba47f0C0c6162e592181bbE2244b63AE",
    arbitrator: "0x60B2AbfDfaD9c0873242f59f2A8c32A3Cc682f80", // KlerosLiquid on Kovan
    arbitratorExtraData:
      "0x00000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000",
    homeChainId: 77,
    metaEvidence: "/ipfs/Qmf4V7xUM4AkhobUQ5Gh86HKck6o3EStEmQfvit9L6hBLQ/realitio.json",
    termsOfService: "/ipfs/QmaUr6hnSVxYD899xdcn2GUVtXVjXoSXKZbce3zFtGWw4H/Question_Resolution_Policy.pdf",
  },
  1: {
    amb: "0x4C36d2919e407f0Cc2Ee3c993ccF8ac26d9CE64e",
    arbitrator: "0x988b3a538b618c7a603e1c11ab82cd16dbe28069", // KlerosLiquid address
    arbitratorExtraData:
      "0x0000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000001f", // General Court - 31 jurors
    homeChainId: 100,
    metaEvidence: "/ipfs/QmeWZL2LzVYH6oEDJXcHfeSHYdZmebv3Q9zLuRgsCLSCVg/realitio.json",
    termsOfService: "/ipfs/QmaUr6hnSVxYD899xdcn2GUVtXVjXoSXKZbce3zFtGWw4H/Question_Resolution_Policy.pdf",
  },
};

async function deployForeignProxy({ deployments, getNamedAccounts, getChainId, ethers, config }) {
  const { deploy } = deployments;
  const { providers } = ethers;
  const { hexZeroPad } = ethers.utils;

  const accounts = await getNamedAccounts();
  const { deployer, counterPartyDeployer } = accounts;
  const chainId = await getChainId();

  const homeNetworks = {
    42: config.networks.sokol,
    1: config.networks.xdai,
  };
  const { url } = homeNetworks[chainId];
  const homeChainProvider = new providers.JsonRpcProvider(url);
  const nonce = await homeChainProvider.getTransactionCount(counterPartyDeployer);

  const { amb, arbitrator, arbitratorExtraData, homeChainId, metaEvidence, termsOfService } = paramsByChainId[chainId];
  const winnerMultiplier = 3000;
  const loserMultiplier = 7000;
  const loserAppealPeriodMultiplier = 5000;

  // Foreign Proxy deploy will happen AFTER the Home Proxy deploy, so we need to subtract 1 from the nonce
  const homeProxyAddress = getContractAddress(counterPartyDeployer, nonce - 1);
  const homeChainIdAsBytes32 = hexZeroPad(homeChainId, 32);

  const foreignProxy = await deploy("RealitioForeignArbitrationProxyWithAppeals", {
    from: deployer,
    args: [
      amb,
      homeProxyAddress,
      homeChainIdAsBytes32,
      arbitrator,
      arbitratorExtraData,
      metaEvidence,
      termsOfService,
      winnerMultiplier,
      loserMultiplier,
      loserAppealPeriodMultiplier,
    ],
    gas: 8000000,
  });

  console.log("Home Proxy:", homeProxyAddress);
  console.log("Foregin Proxy:", foreignProxy.address);
}

deployForeignProxy.tags = ["ForeignChain"];
deployForeignProxy.skip = async ({ getChainId }) => !FOREIGN_CHAIN_IDS.includes(Number(await getChainId()));

module.exports = deployForeignProxy;
