const { homeChains, gwei, metadata } = require("../consts");
const { amoy, polygon } = homeChains;

const homeParameters = {
  [amoy.chainId]: {
    // https://github.com/RealityETH/reality-eth-monorepo/blob/main/packages/contracts/chains/deployments/80002/
    realitio: "NOT DEPLOYED YET",
    // https://docs.polygon.technology/pos/how-to/bridging/l1-l2-communication/state-transfer/#prerequisites
    fxChild: "0xE5930336866d0388f0f745A2d9207C7781047C0f",
  },
  [polygon.chainId]: {
    // https://github.com/RealityETH/reality-eth-monorepo/blob/main/packages/contracts/chains/deployments/137/MATIC/RealityETH-3.0.json
    realitio: "0x60573B8DcE539aE5bF9aD7932310668997ef0428",
    // https://docs.polygon.technology/pos/how-to/bridging/l1-l2-communication/state-transfer/#prerequisites
    fxChild: "0x8397259c983751DAf40400790063935a11afa28a",
  },
};

async function deployHomeProxy({ deploy, get, from, parameters, foreignChainId, foreignProxy }) {
  const { realitio, fxChild } = parameters;
  const deployed = await deploy(`RealitioHomeProxyPolygon`, {
    from,
    args: [fxChild, realitio, foreignChainId, metadata],
    maxPriorityFeePerGas: gwei(2),
    maxFeePerGas: gwei(20),
    log: true,
  });

  // Link to foreign proxy
  const homeProxy = await get(`RealitioHomeProxyPolygon`);
  await homeProxy.setFxRootTunnel(foreignProxy);
  return deployed;
}

const supportedChainIds = Object.keys(homeParameters).map(Number);

module.exports = { deployHomeProxy, homeParameters, supportedChainIds };
