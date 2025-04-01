const { encodeExtraData, getMetaEvidenceCID } = require("../shared");

// The parameters are keyed by home network name rather than by chainId because several home proxies point to the same foreign proxy.
const foreignParameters = {
  unichainSepolia: {
    numberOfJurors: 1,
    // https://docs.unichain.org/docs/technical-information/contract-addresses
    foreignBridge: "0x448A37330A60494E666F6DD60aD48d930AEbA381",
    variant: "Unichain",
  },
  optimismSepolia: {
    numberOfJurors: 1,
    // https://docs.optimism.io/chain/addresses
    foreignBridge: "0x58Cc85b8D04EA49cC6DBd3CbFFd00B4B8D6cb3ef",
    variant: "Optimism",
  },
  unichain: {
    numberOfJurors: 15,
    // https://docs.unichain.org/docs/technical-information/contract-addresses
    foreignBridge: "0x9A3D64E386C18Cb1d6d5179a9596A4B5736e98A6",
    variant: "Unichain",
  },
  optimism: {
    numberOfJurors: 15,
    // https://docs.optimism.io/chain/addresses
    foreignBridge: "0x25ace71c97B33Cc4729CF772ae268934F7ab5fA1",
    variant: "Optimism",
  },
  redstone: {
    numberOfJurors: 15,
    // https://redstone.xyz/docs/contract-addresses
    foreignBridge: "0x592C1299e0F8331D81A28C0FC7352Da24eDB444a",
    variant: "Redstone",
  },
  base: {
    numberOfJurors: 15,
    // https://docs.base.org/docs/base-contracts#l1-contract-addresses
    foreignBridge: "0x866E82a600A1414e583f7F13623F1aC5d58b0Afa",
    variant: "Base",
  },
};

async function deployForeignProxy({
  deploy,
  from,
  parameters,
  homeNetworkName,
  homeProxy,
  wNative,
  arbitrator,
  courts,
  multipliers,
}) {
  const { numberOfJurors, foreignBridge, variant } = parameters;
  const metaEvidence = getMetaEvidenceCID(homeNetworkName);
  const arbitratorExtraData = encodeExtraData(courts.oracle, numberOfJurors);
  return await deploy(`RealitioForeignProxy${variant}`, {
    contract: "RealitioForeignProxyOptimism",
    from,
    args: [wNative, arbitrator, arbitratorExtraData, metaEvidence, ...multipliers, homeProxy, foreignBridge],
    log: true,
  });
}

const getHomeProxyName = (homeNetworkName) => `RealitioHomeProxy${foreignParameters[homeNetworkName].variant}`;

const supportedHomeChains = Object.keys(foreignParameters).map(String);

module.exports = { foreignParameters, supportedHomeChains, deployForeignProxy, getHomeProxyName };
