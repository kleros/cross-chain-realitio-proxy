const { encodeExtraData, termsOfServiceMultiformat, toBytes32 } = require("../consts/index");

// Bridge addresses:
// https://docs.gnosischain.com/developers/Usefulcontracts#mainnet-bridge-contract-addresses
// https://docs.gnosischain.com/bridges/About%20Token%20Bridges/amb-bridge#key-contracts

// The parameters are keyed by home network name rather than by chainId because several home proxies point to the same foreign proxy.
const foreignParameters = {
  chiado: {
    numberOfJurors: 1,
    foreignAmb: "0x8448E15d0e7330A60494E666F6DD60aD48d930AEbA381",
    metaEvidence: "/ipfs/QmTrejLM1ythucs5TsRNFUot5bqoPwiMXF66Y5VaJBUHTi",
  },
  gnosis: {
    numberOfJurors: 7,
    foreignAmb: "0x4C36d2919e407f0Cc2Ee3c993ccF8ac26d9CE64e",
    metaEvidence: "/ipfs/QmTYEpuN4iqbYPXc6ba2QCcYGDwRVNvSFfyWGpDkx7kC3B",
  },
};

async function deployForeignProxy({
  deploy,
  from,
  parameters,
  homeChainId,
  homeProxy,
  arbitrator,
  courts,
  multipliers,
}) {
  const { numberOfJurors, foreignAmb, metaEvidence } = parameters;
  const homeChainIdAsBytes32 = toBytes32(homeChainId);
  const arbitratorExtraData = encodeExtraData(courts.oracle, numberOfJurors);
  return await deploy("RealitioForeignProxyGnosis", {
    from,
    args: [
      foreignAmb,
      homeProxy,
      homeChainIdAsBytes32,
      arbitrator,
      arbitratorExtraData,
      metaEvidence,
      termsOfServiceMultiformat,
      ...multipliers,
    ],
    log: true,
    gas: 8000000,
  });
}

const getHomeProxyName = () => "RealitioForeignProxyGnosis";

const supportedHomeChains = Object.keys(foreignParameters).map(String);

module.exports = { foreignParameters, supportedHomeChains, deployForeignProxy, getHomeProxyName };
