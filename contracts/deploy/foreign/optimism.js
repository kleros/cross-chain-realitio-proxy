const { encodeExtraData } = require("../consts/index");

// The parameters are keyed by home network name rather than by chainId because several home proxies point to the same foreign proxy.
const foreignParameters = {
  unichainSepolia: {
    numberOfJurors: 1,
    // https://docs.unichain.org/docs/technical-information/contract-addresses
    foreignBridge: "0x448A37330A60494E666F6DD60aD48d930AEbA381",
    metaEvidence: "/ipfs/QmfFVUKfKjZyXPwcefpJqBbFaaA4GcZrzMnt3xH211ySKy",
    variant: `Unichain`,
  },
  optimismSepolia: {
    numberOfJurors: 1,
    // https://docs.optimism.io/chain/addresses
    foreignBridge: "0x58Cc85b8D04EA49cC6DBd3CbFFd00B4B8D6cb3ef",
    metaEvidence: "/ipfs/QmYj9PRtDV4HpNKXJbJ8AaYv5FBknNuSo4kjH2raHX47eM/",
    variant: `Optimism`,
  },
  unichain: {
    numberOfJurors: 1,
    // https://docs.unichain.org/docs/technical-information/contract-addresses
    foreignBridge: "FIXME", // Not launched yet
    metaEvidence: "/ipfs/FIXME",
    variant: `Unichain`,
  },
  optimism: {
    numberOfJurors: 7,
    // https://docs.optimism.io/chain/addresses
    foreignBridge: "0x25ace71c97B33Cc4729CF772ae268934F7ab5fA1",
    metaEvidence: "/ipfs/QmaA3mXhvRxXFcmyF2zbF5CirJmK4xH2jVy7XBWBDprvxS",
    variant: `Optimism`,
  },
  redstone: {
    numberOfJurors: 7,
    // https://redstone.xyz/docs/contract-addresses
    foreignBridge: "0x592C1299e0F8331D81A28C0FC7352Da24eDB444a",
    metaEvidence: "/ipfs/bafybeibho6gzezi7ludu6zxfzetmicho7ekuh3gu3oouihmbfsabhcg7te/",
    variant: `Redstone`,
  },
};

async function deployForeignProxy({ deploy, from, parameters, homeProxy, arbitrator, courts, multipliers }) {
  const { numberOfJurors, foreignBridge, metaEvidence, variant } = parameters;
  const arbitratorExtraData = encodeExtraData(courts.oracle, numberOfJurors);
  return await deploy(`RealitioForeignProxy${variant}`, {
    contract: "RealitioForeignProxyOptimism",
    from,
    args: [foreignBridge, homeProxy, arbitrator, arbitratorExtraData, metaEvidence, ...multipliers],
    log: true,
  });
}

const getHomeProxyName = (homeNetworkName) => `RealitioHomeProxy${foreignParameters[homeNetworkName].variant}`;

const supportedHomeChains = Object.keys(foreignParameters).map(String);

module.exports = { foreignParameters, supportedHomeChains, deployForeignProxy, getHomeProxyName };
