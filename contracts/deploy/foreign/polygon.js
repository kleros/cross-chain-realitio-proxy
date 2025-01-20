const { ethers } = require("hardhat");
const { encodeExtraData } = require("../consts/index");

// Bridge addresses:
// https://docs.polygon.technology/pos/how-to/bridging/l1-l2-communication/state-transfer/#prerequisites

// The parameters are keyed by home network name rather than by chainId because several home proxies point to the same foreign proxy.
const foreignParameters = {
  amoy: {
    numberOfJurors: 1,
    checkpointManager: "0x2890bA17EfE978480615e330ecB65333b880928e",
    fxRoot: "0x3d1d3E34f7fB6D26245E6640E1c50710eFFf15bA",
    metaEvidence: "/ipfs/TODO",
  },
  polygon: {
    numberOfJurors: 15,
    checkpointManager: "0x86e4dc95c7fbdbf52e33d563bbdb00823894c287",
    fxRoot: "0xfe5e5D361b2ad62c541bAb87C45a0B9B018389a2",
    metaEvidence: "/ipfs/QmXWr4ZWCpBYtAHNHzTbKW9SkV1MwQicpWfthhDHkNYxKk/realitio.json",
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
