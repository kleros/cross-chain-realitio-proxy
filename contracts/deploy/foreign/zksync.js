const { ethers } = require("hardhat");
const { encodeExtraData, eth, getMetaEvidenceCID } = require("../shared");

// Bridge addresses:
// https://docs.zksync.io/zk-stack/zk-chain-addresses

// The parameters are keyed by home network name rather than by chainId because several home proxies point to the same foreign proxy.
const foreignParameters = {
  zkSyncSepolia: {
    numberOfJurors: 1,
    zkAddress: "0x9A6DE0f62Aa270A8bCB1e2610078650D539B1Ef9",
  },
  zkSyncMainnet: {
    numberOfJurors: 15,
    zkAddress: "0x32400084C286CF3E17e7B677ea9583e60a000324",
  },
};

async function deployForeignProxy({ deploy, from, parameters, homeNetworkName, homeProxy, arbitrator, courts, multipliers }) {
  const { numberOfJurors, zkAddress } = parameters;
  const metaEvidence = getMetaEvidenceCID(homeNetworkName);
  const arbitratorExtraData = encodeExtraData(courts.oracle, numberOfJurors);
  const surplus = eth("0.03"); // The surplus will be automatically reimbursed when the dispute is created.
  const l2GasLimit = 1500000; // Gas limit for a tx on L2.
  const l2GasPerPubdataByteLimit = 800;
  const deployed = await deploy("RealitioForeignProxyZkSync", {
    from,
    args: [
      arbitrator,
      arbitratorExtraData,
      metaEvidence,
      ...multipliers,
      zkAddress,
      l2GasLimit,
      l2GasPerPubdataByteLimit,
      surplus,
    ],
    log: true,
  });

  console.log(`Linking to home proxy ${homeProxy}`);
  const foreignProxy = await ethers.getContract("RealitioForeignProxyZkSync");
  await foreignProxy.setHomeProxy(homeProxy);
  return deployed;
}

const getHomeProxyName = () => "RealitioHomeProxyZkSync";

const supportedHomeChains = Object.keys(foreignParameters).map(String);

module.exports = { foreignParameters, supportedHomeChains, deployForeignProxy, getHomeProxyName };
