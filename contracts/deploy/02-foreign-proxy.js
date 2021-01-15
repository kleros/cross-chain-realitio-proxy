const getDeployAddress = require("../deploy-helpers/getDeployAddress");

const FOREIGN_CHAIN_IDS = [42, 1];
const paramsByChainId = {
  42: {
    amb: "0xFe446bEF1DbF7AFE24E81e05BC8B271C1BA9a560",
    // arbitrator: "0xA8243657a1E6ad1AAf2b59c4CCDFE85fC6fD7a8B",
    arbitrator: "0x3b261920Ba47f0C0c6162e592181bbE2244b63AE",
    arbitratorExtraData:
      "0x00000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000",
    homeChainId: 77,
    metaEvidence: "/ipfs/QmbiGmU35RhB8FziGs8M1oVyxY5pX5zDCFNtBjvHvf4NFe/realitio.json",
    termsOfService: "/ipfs/Qmf67KPWvFLSQEczsb8Kh9HtGUevNtSSVELqTS8yTe95GW/omen-rules.pdf",
  },
  1: {
    amb: "0x4C36d2919e407f0Cc2Ee3c993ccF8ac26d9CE64e",
    arbitrator: "0x988b3a538b618c7a603e1c11ab82cd16dbe28069", // KlerosLiquid address
    arbitratorExtraData:
      "0x000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000001f4",
    homeChainId: 100,
    metaEvidence: "",
    termsOfService: "/ipfs/Qmf67KPWvFLSQEczsb8Kh9HtGUevNtSSVELqTS8yTe95GW/omen-rules.pdf",
  },
};

async function deployForeignProxy({ deployments, getNamedAccounts, getChainId, ethers, config }) {
  const { deploy } = deployments;
  const { providers, BigNumber } = ethers;

  const homeNetworks = {
    42: config.networks.sokol,
    1: config.networks.xdai,
  };

  const accounts = await getNamedAccounts();
  const { deployer, counterPartyDeployer } = accounts;
  const chainId = await getChainId();

  const { url } = homeNetworks[chainId];
  const homeChainProvider = new providers.JsonRpcProvider(url);
  const nonce = await homeChainProvider.getTransactionCount(counterPartyDeployer);
  // Foreign Proxy deploy will happen AFTER the Home Proxy deploy, so we need to subtract 1 from the nonce
  const homeProxyAddress = getDeployAddress(counterPartyDeployer, nonce - 1);

  const { amb, arbitrator, arbitratorExtraData, homeChainId, metaEvidence, termsOfService } = paramsByChainId[chainId];

  const foreignProxy = await deploy("RealitioForeignArbitrationProxy", {
    from: deployer,
    gas: 8000000,
    args: [
      amb,
      homeProxyAddress,
      BigNumber.from(homeChainId),
      arbitrator,
      arbitratorExtraData,
      metaEvidence,
      termsOfService,
    ],
  });

  console.log("Home Proxy:", homeProxyAddress);
  console.log("Foregin Proxy:", foreignProxy.address);
}

deployForeignProxy.tags = ["ForeignChain"];
deployForeignProxy.skip = async ({ getChainId }) => !FOREIGN_CHAIN_IDS.includes(Number(await getChainId()));

module.exports = deployForeignProxy;
