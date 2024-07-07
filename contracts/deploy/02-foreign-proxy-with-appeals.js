const getContractAddress = require("../deploy-helpers/getContractAddress");
const FOREIGN_CHAIN_IDS = [11155111, 1];
const paramsByChainId = {
  11155111: {
    amb: "0xf2546D6648BD2af6a008A7e7C1542BB240329E11",
    arbitrator: "0x90992fb4E15ce0C59aEFfb376460Fda4Ee19C879",
    arbitratorExtraData:
      "0x00000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000",
    homeChainId: 10200,
    metaEvidence: "/ipfs/QmTrejLM1ythucs5TsRNFUot5bqoPwiMXF66Y5VaJBUHTi",
    termsOfService: "/ipfs/QmNV5NWwCudYKfiHuhdWxccrPyxs4DnbLGQace2oMKHkZv/Question_Resolution_Policy.pdf",
  },
  1: {
    amb: "0x4C36d2919e407f0Cc2Ee3c993ccF8ac26d9CE64e",
    arbitrator: "0x988b3a538b618c7a603e1c11ab82cd16dbe28069", // KlerosLiquid address
    arbitratorExtraData:
      "0x0000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000001f", // General Court - 31 jurors
    homeChainId: 100,
    metaEvidence: "/ipfs/QmV4VhBEgAf93WquKvedkFQmNJHhcWPPT6FdYYSdN6v6Mc",
    termsOfService: "/ipfs/QmNV5NWwCudYKfiHuhdWxccrPyxs4DnbLGQace2oMKHkZv/Question_Resolution_Policy.pdf",
  },
};

async function deployForeignProxy({ deployments, getNamedAccounts, getChainId, ethers, config }) {
  const { deploy } = deployments;
  const { providers } = ethers;
  const { hexZeroPad } = ethers.utils;

  const accounts = await getNamedAccounts();
  const { deployer } = accounts;
  const chainId = await getChainId();

  const homeNetworks = {
    11155111: config.networks.chiado,
    1: config.networks.xdai,
  };
  const { url } = homeNetworks[chainId];
  const homeChainProvider = new providers.JsonRpcProvider(url);
  const nonce = await homeChainProvider.getTransactionCount(deployer);

  const { amb, arbitrator, arbitratorExtraData, homeChainId, metaEvidence, termsOfService } = paramsByChainId[chainId];
  const winnerMultiplier = 3000;
  const loserMultiplier = 7000;
  const loserAppealPeriodMultiplier = 5000;

  // Foreign Proxy deploy will happen AFTER the Home Proxy deploy, so we need to subtract 1 from the nonce
  const homeProxyAddress = getContractAddress(deployer, nonce - 1);
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
