const { encodeExtraData, eth, getMetaEvidenceCID } = require("../shared");

// Bridge addresses:
// https://docs.arbitrum.io/build-decentralized-apps/reference/contract-addresses#cross-chain-messaging-contracts

// The parameters are keyed by home network name rather than by chainId because several home proxies point to the same foreign proxy.
const foreignParameters = {
  arbitrumSepolia: {
    numberOfJurors: 1,
    inbox: "0xaAe29B0366299461418F5324a79Afc425BE5ae21",
  },
  arbitrum: {
    numberOfJurors: 15,
    inbox: "0x4Dbd4fc535Ac27206064B68FfCf827b0A60BAB3f",
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
  const { numberOfJurors, inbox } = parameters;
  const metaEvidence = getMetaEvidenceCID(homeNetworkName);
  const arbitratorExtraData = encodeExtraData(courts.oracle, numberOfJurors);
  const surplus = eth("0.03"); // The surplus will be automatically reimbursed when the dispute is created.
  const l2GasLimit = 1500000; // Gas limit for a tx on L2.
  const gasPriceBid = 1000000000; // x10000 bid of random arb sepolia tx. Gas price * gasLimit will result in additional 0.0015 eth fee for automatic-redeem on L2. The surplus will be reimbursed.

  return await deploy("RealitioForeignProxyArbitrum", {
    from,
    args: [
      wNative,
      arbitrator,
      arbitratorExtraData,
      metaEvidence,
      ...multipliers,
      homeProxy,
      inbox,
      surplus,
      [l2GasLimit, gasPriceBid],
    ],
    log: true,
  });
}

const getHomeProxyName = () => "RealitioHomeProxyArbitrum";

const supportedHomeChains = Object.keys(foreignParameters).map(String);

module.exports = { foreignParameters, supportedHomeChains, deployForeignProxy, getHomeProxyName };
