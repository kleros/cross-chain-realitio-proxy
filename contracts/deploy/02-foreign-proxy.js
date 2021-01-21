const getContractAddress = require("../deploy-helpers/getContractAddress");

const FOREIGN_CHAIN_IDS = [42, 1];
const paramsByChainId = {
  42: {
    amb: "0xFe446bEF1DbF7AFE24E81e05BC8B271C1BA9a560",
    // arbitrator: "0xA8243657a1E6ad1AAf2b59c4CCDFE85fC6fD7a8B",
    arbitrator: "0x3b261920Ba47f0C0c6162e592181bbE2244b63AE",
    arbitratorExtraData:
      "0x00000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000",
    homeChainId: 77,
    metaEvidence: "/ipfs/Qmc2cpRZgT5PmR4ZikDsVG54xejKF62qSBBnYf4R5bpiNH/realitio.json",
    termsOfService: "/ipfs/Qmf67KPWvFLSQEczsb8Kh9HtGUevNtSSVELqTS8yTe95GW/omen-rules.pdf",
    gasPrice: "5000000000",
  },
  1: {
    amb: "0x4C36d2919e407f0Cc2Ee3c993ccF8ac26d9CE64e",
    arbitrator: "0x988b3a538b618c7a603e1c11ab82cd16dbe28069", // KlerosLiquid address
    arbitratorExtraData:
      "0x000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000001f4",
    homeChainId: 100,
    metaEvidence: "/ipfs/QmekJhnjk7ZBQES33dsggp6nVGxAbxMWgsrhMvV8Ga761n/realitio.json",
    termsOfService: "/ipfs/Qmf67KPWvFLSQEczsb8Kh9HtGUevNtSSVELqTS8yTe95GW/omen-rules.pdf",
    gasPrice: "80000000000",
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

  const { amb, arbitrator, arbitratorExtraData, homeChainId, metaEvidence, termsOfService, gasPrice } = paramsByChainId[
    chainId
  ];

  // Foreign Proxy deploy will happen AFTER the Home Proxy deploy, so we need to subtract 1 from the nonce
  const homeProxyAddress = getContractAddress(counterPartyDeployer, nonce - 1);
  const homeChainIdAsBytes32 = hexZeroPad(homeChainId, 32);

  const foreignProxy = await deploy("RealitioForeignArbitrationProxy", {
    from: deployer,
    args: [amb, homeProxyAddress, homeChainIdAsBytes32, arbitrator, arbitratorExtraData, metaEvidence, termsOfService],
    gas: 8000000,
    gasPrice,
  });

  console.log("Home Proxy:", homeProxyAddress);
  console.log("Foregin Proxy:", foreignProxy.address);
}

deployForeignProxy.tags = ["ForeignChain"];
deployForeignProxy.skip = async ({ getChainId }) => !FOREIGN_CHAIN_IDS.includes(Number(await getChainId()));

module.exports = deployForeignProxy;
