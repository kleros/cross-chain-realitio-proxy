const { realityETHConfig } = require("@reality.eth/contracts");
const { ethers } = require("hardhat");
const { homeChains, metadata } = require("../shared");
const { amoy, polygon } = homeChains;

const homeParameters = {
  [amoy.chainId]: {
    // https://github.com/RealityETH/reality-eth-monorepo/blob/main/packages/contracts/chains/deployments/80002/
    // realitio: realityETHConfig(amoy.chainId, "MATIC", "3.0").address,
    realitio: "0x0000000000000000000000000000000000000000", // NOT DEPLOYED YET
    // https://docs.polygon.technology/pos/how-to/bridging/l1-l2-communication/state-transfer/#prerequisites
    fxChild: "0xE5930336866d0388f0f745A2d9207C7781047C0f",
  },
  [polygon.chainId]: {
    // https://github.com/RealityETH/reality-eth-monorepo/blob/main/packages/contracts/chains/deployments/137/MATIC/RealityETH-3.0.json
    realitio: realityETHConfig(polygon.chainId, "MATIC", "3.0").address,
    // https://docs.polygon.technology/pos/how-to/bridging/l1-l2-communication/state-transfer/#prerequisites
    fxChild: "0x8397259c983751DAf40400790063935a11afa28a",
  },
};

async function deployHomeProxy({ deploy, from, parameters, foreignChainId, foreignProxy }) {
  const { realitio, fxChild } = parameters;
  const deployed = await deploy("RealitioHomeProxyPolygon", {
    from,
    args: [realitio, metadata, foreignChainId, fxChild],
    gas: 8000000,
    log: true,
  });

  console.log(`Linking to foreign proxy ${foreignProxy}`);
  const homeProxy = await ethers.getContract("RealitioHomeProxyPolygon");
  await homeProxy.setFxRootTunnel(foreignProxy);
  return deployed;
}

const supportedChainIds = Object.keys(homeParameters).map(Number);

module.exports = { deployHomeProxy, homeParameters, supportedChainIds };
