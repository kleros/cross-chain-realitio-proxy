const { ethers } = require("hardhat");
const { encodeExtraData } = require("../shared");

// Bridge addresses:
// https://docs.polygon.technology/pos/how-to/bridging/l1-l2-communication/state-transfer/#prerequisites

// The parameters are keyed by home network name rather than by chainId because several home proxies point to the same foreign proxy.
const foreignParameters = {
  amoy: {
    numberOfJurors: 1,
    checkpointManager: "0xbd07D7E1E93c8d4b2a261327F3C28a8EA7167209",
    fxRoot: "0x0E13EBEdDb8cf9f5987512d5E081FdC2F5b0991e",
    metaEvidence: "/ipfs/TODO",
  },
  polygon: {
    numberOfJurors: 15,
    checkpointManager: "0x86e4dc95c7fbdbf52e33d563bbdb00823894c287",
    fxRoot: "0xfe5e5D361b2ad62c541bAb87C45a0B9B018389a2",
    metaEvidence: "/ipfs/TODO",
  },
};

async function deployForeignProxy({ deploy, from, parameters, homeProxy, arbitrator, courts, multipliers }) {
  const { numberOfJurors, checkpointManager, fxRoot, metaEvidence } = parameters;
  const arbitratorExtraData = encodeExtraData(courts.oracle, numberOfJurors);
  const deployed = await deploy("RealitioForeignProxyPolygon", {
    from,
    args: [arbitrator, arbitratorExtraData, metaEvidence, ...multipliers, checkpointManager, fxRoot],
    log: true,
    gas: 8000000,
  });

  console.log(`Linking to home proxy ${homeProxy}`);
  const foreignProxy = await ethers.getContract("RealitioForeignProxyPolygon");
  await foreignProxy.setFxChildTunnel(homeProxy);
  return deployed;
}

const getHomeProxyName = () => "RealitioHomeProxyPolygon";

const supportedHomeChains = Object.keys(foreignParameters).map(String);

module.exports = { foreignParameters, supportedHomeChains, deployForeignProxy, getHomeProxyName };
