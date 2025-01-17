const { homeChains, gwei, toBytes32 } = require("../consts");
const { chiado, gnosis } = homeChains;

const metadata =
  '{"tos":"ipfs://QmNV5NWwCudYKfiHuhdWxccrPyxs4DnbLGQace2oMKHkZv/Question_Resolution_Policy.pdf", "foreignProxy":true}';

const homeParameters = {
  [chiado.chainId]: {
    // https://github.com/RealityETH/reality-eth-monorepo/blob/main/packages/contracts/chains/deployments/10200/XDAI/RealityETH-3.0.json
    realitio: "0x1E732a1C5e9181622DD5A931Ec6801889ce66185",
    // https://docs.gnosischain.com/developers/Usefulcontracts#chiado-bridge-contract-addresses
    homeBridge: "0x8448E15d0e706C0298dECA99F0b4744030e59d7d",
    metadata,
  },
  [gnosis.chainId]: {
    // https://github.com/RealityETH/reality-eth-monorepo/blob/main/packages/contracts/chains/deployments/100/XDAI/RealityETH-3.0.json
    realitio: "0xE78996A233895bE74a66F451f1019cA9734205cc",
    // https://docs.gnosischain.com/developers/Usefulcontracts#gnosis-chain-bridge-contract-addresses
    homeBridge: "0x75Df5AF045d91108662D8080fD1FEFAd6aA0bb59",
    metadata,
  },
};

async function deployHomeProxy(deploy, get, from, chainParams, foreignChainId, foreignProxy) {
  const { realitio, metadata, homeBridge } = chainParams;
  const foreignChainIdAsBytes32 = toBytes32(foreignChainId);
  return await deploy(`RealitioHomeProxyGnosis`, {
    from,
    args: [homeBridge, foreignProxy, foreignChainIdAsBytes32, realitio, metadata],
    maxPriorityFeePerGas: gwei(2),
    maxFeePerGas: gwei(20),
    log: true,
  });
}

const supportedChainIds = Object.keys(homeParameters).map(Number);

module.exports = { deployHomeProxy, homeParameters, supportedChainIds };
