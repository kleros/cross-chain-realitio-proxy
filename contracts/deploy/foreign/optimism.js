const { encodeExtraData } = require("../shared");

// The parameters are keyed by home network name rather than by chainId because several home proxies point to the same foreign proxy.
const foreignParameters = {
  unichainSepolia: {
    numberOfJurors: 1,
    // https://docs.unichain.org/docs/technical-information/contract-addresses
    foreignBridge: "0x448A37330A60494E666F6DD60aD48d930AEbA381",
    metaEvidence: "/ipfs/QmPzCS4Tw4m4gCqBPrNMvgcnwDyU2c8RPZabj9Rrfhjt7Q",
    variant: `Unichain`,
  },
  optimismSepolia: {
    numberOfJurors: 1,
    // https://docs.optimism.io/chain/addresses
    foreignBridge: "0x58Cc85b8D04EA49cC6DBd3CbFFd00B4B8D6cb3ef",
    metaEvidence: "/ipfs/QmSoWtpA9rLoDU37vpP4fVu49Gf9fZdk2M4RxZFodC6MSN",
    variant: `Optimism`,
  },
  unichain: {
    numberOfJurors: 15,
    // https://docs.unichain.org/docs/technical-information/contract-addresses
    foreignBridge: "0x9A3D64E386C18Cb1d6d5179a9596A4B5736e98A6",
    metaEvidence: "/ipfs/QmQJUPLrzjS2AQUo2VTw21utgCfAuCyTZzZ7Cv5fgcLZ4K",
    variant: `Unichain`,
  },
  optimism: {
    numberOfJurors: 15,
    // https://docs.optimism.io/chain/addresses
    foreignBridge: "0x25ace71c97B33Cc4729CF772ae268934F7ab5fA1",
    metaEvidence: "/ipfs/QmNjUimDc5RYQytyeA92b7baFdRm6kiw5qdxpFVBZnYDkV",
    variant: `Optimism`,
  },
  redstone: {
    numberOfJurors: 15,
    // https://redstone.xyz/docs/contract-addresses
    foreignBridge: "0x592C1299e0F8331D81A28C0FC7352Da24eDB444a",
    metaEvidence: "/ipfs/QmWBFu65DJGUPBqfZdwR21isaC5FotFKaXMnFrpRDCehVm",
    variant: `Redstone`,
  },
  base: {
    numberOfJurors: 15,
    // https://docs.base.org/docs/base-contracts#l1-contract-addresses
    foreignBridge: "0x866E82a600A1414e583f7F13623F1aC5d58b0Afa",
    metaEvidence: "/ipfs/QmPy5ZMpEmnnGUC1g4P2EX9AeUwrUf7BorxoofgpeSjiPW",
    variant: `Base`,
  },
};

async function deployForeignProxy({ deploy, from, parameters, homeProxy, arbitrator, courts, multipliers }) {
  const { numberOfJurors, foreignBridge, metaEvidence, variant } = parameters;
  const arbitratorExtraData = encodeExtraData(courts.oracle, numberOfJurors);
  return await deploy(`RealitioForeignProxy${variant}`, {
    contract: "RealitioForeignProxyOptimism",
    from,
    args: [arbitrator, arbitratorExtraData, metaEvidence, ...multipliers, homeProxy, foreignBridge],
    log: true,
  });
}

const getHomeProxyName = (homeNetworkName) => `RealitioHomeProxy${foreignParameters[homeNetworkName].variant}`;

const supportedHomeChains = Object.keys(foreignParameters).map(String);

module.exports = { foreignParameters, supportedHomeChains, deployForeignProxy, getHomeProxyName };
