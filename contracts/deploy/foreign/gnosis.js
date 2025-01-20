const { encodeExtraData } = require("../consts/index");

// Bridge addresses:
// https://docs.gnosischain.com/developers/Usefulcontracts#mainnet-bridge-contract-addresses
// https://docs.gnosischain.com/bridges/About%20Token%20Bridges/amb-bridge#key-contracts

// The parameters are keyed by home network name rather than by chainId because several home proxies point to the same foreign proxy.
const foreignParameters = {
  chiado: {
    numberOfJurors: 1,
    foreignAmb: "0xf2546D6648BD2af6a008A7e7C1542BB240329E11",
    metaEvidence: "/ipfs/QmTrejLM1ythucs5TsRNFUot5bqoPwiMXF66Y5VaJBUHTi",
  },
  gnosis: {
    numberOfJurors: 15,
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
  const arbitratorExtraData = encodeExtraData(courts.oracle, numberOfJurors);

  // Fully qualified contract name because there's also an 0.7 artifact
  return await deploy("RealitioForeignProxyGnosis", {
    contract: "src/0.8/RealitioForeignProxyGnosis.sol:RealitioForeignProxyGnosis",
    from,
    args: [arbitrator, arbitratorExtraData, metaEvidence, ...multipliers, homeProxy, homeChainId, foreignAmb],
    log: true,
    gas: 8000000,
  });
}

const getHomeProxyName = () => "RealitioHomeProxyGnosis";

const supportedHomeChains = Object.keys(foreignParameters).map(String);

module.exports = { foreignParameters, supportedHomeChains, deployForeignProxy, getHomeProxyName };
