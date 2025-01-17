const { encodeExtraData, eth } = require("../consts/index");

// Bridge addresses:
// https://docs.arbitrum.io/build-decentralized-apps/reference/contract-addresses#cross-chain-messaging-contracts

// The parameters are keyed by home network name rather than by chainId because several home proxies point to the same foreign proxy.
const foreignParameters = {
  arbitrumSepolia: {
    numberOfJurors: 1,
    inbox: "0xaAe29B0366299461418F5324a79Afc425BE5ae21",
    metaEvidence: "/ipfs/QmX4uAgcXJdLifAmZjt6VYP2Lwj91zZ3H6DLF68Yt1d7pr",
  },
  arbitrum: {
    numberOfJurors: 7,
    inbox: "0x4Dbd4fc535Ac27206064B68FfCf827b0A60BAB3f",
    metaEvidence: "TODO",
  },
};

async function deployForeignProxy({ deploy, from, parameters, homeProxy, arbitrator, courts, multipliers }) {
  const { numberOfJurors, inbox, metaEvidence } = parameters;
  const arbitratorExtraData = encodeExtraData(courts.oracle, numberOfJurors);
  const surplus = eth(0.03); // The surplus will be automatically reimbursed when the dispute is created.
  const l2GasLimit = 1500000; // Gas limit for a tx on L2.
  const gasPriceBid = 1000000000; // x10000 bid of random arb sepolia tx. Gas price * gasLimit will result in additional 0.0015 eth fee for automatic-redeem on L2. The surplus will be reimbursed.
  return await deploy("RealitioForeignProxyArbitrum", {
    from,
    args: [
      homeProxy,
      from, // Governor
      arbitrator,
      arbitratorExtraData,
      inbox,
      surplus,
      l2GasLimit,
      gasPriceBid,
      metaEvidence,
      multipliers,
    ],
    log: true,
  });
}

const getHomeProxyName = () => "RealitioForeignProxyArbitrum";

const supportedHomeChains = Object.keys(foreignParameters).map(String);

module.exports = { foreignParameters, supportedHomeChains, deployForeignProxy, getHomeProxyName };
