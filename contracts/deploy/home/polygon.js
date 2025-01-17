const { homeChains, gwei } = require("../consts");
const { mumbai, polygon } = homeChains;

const metadata =
  '{"tos":"ipfs://QmNV5NWwCudYKfiHuhdWxccrPyxs4DnbLGQace2oMKHkZv/Question_Resolution_Policy.pdf", "foreignProxy":true}';

const homeParameters = {
  [mumbai.chainId]: {
    // https://github.com/RealityETH/reality-eth-monorepo/blob/main/packages/contracts/chains/deployments/80001/MATIC/RealityETH-3.0.json
    realitio: "0x92115220c28e78312cce86f3d1de652cfbd0357a",
    // https://docs.gnosischain.com/developers/Usefulcontracts#chiado-bridge-contract-addresses
    homeBridge: "0xCf73231F28B7331BBe3124B907840A94851f9f11",
    metadata,
  },
  [polygon.chainId]: {
    // https://github.com/RealityETH/reality-eth-monorepo/blob/main/packages/contracts/chains/deployments/137/MATIC/RealityETH-3.0.json
    realitio: "0x60573B8DcE539aE5bF9aD7932310668997ef0428",
    // https://docs.gnosischain.com/developers/Usefulcontracts#gnosis-chain-bridge-contract-addresses
    homeBridge: "0x8397259c983751DAf40400790063935a11afa28a",
    metadata,
  },
};

async function deployHomeProxy(deploy, get, from, chainParams, foreignChainId, foreignProxy) {
  const { realitio, metadata, homeBridge } = chainParams;
  const deployed = await deploy(`RealitioHomeProxyPolygon`, {
    from,
    args: [homeBridge, realitio, foreignChainId, metadata],
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
