const { realityETHConfig } = require("@reality.eth/contracts");
const { homeChains, gwei, metadata } = require("../shared");
const { chiado, gnosis } = homeChains;

const homeParameters = {
  [chiado.chainId]: {
    realitio: realityETHConfig(chiado.chainId, "XDAI", "3.2").address,
    // https://docs.gnosischain.com/developers/Usefulcontracts#chiado-bridge-contract-addresses
    homeAmb: "0x8448E15d0e706C0298dECA99F0b4744030e59d7d",
  },
  [gnosis.chainId]: {
    realitio: realityETHConfig(gnosis.chainId, "XDAI", "3.0").address,
    // https://docs.gnosischain.com/developers/Usefulcontracts#gnosis-chain-bridge-contract-addresses
    homeAmb: "0x75Df5AF045d91108662D8080fD1FEFAd6aA0bb59",
  },
};

async function deployHomeProxy({ deploy, from, parameters, foreignChainId, foreignProxy }) {
  const { realitio, homeAmb } = parameters;

  // Fully qualified contract name because there's also an 0.7 artifact
  return await deploy("RealitioHomeProxyGnosis", {
    contract: "src/0.8/RealitioHomeProxyGnosis.sol:RealitioHomeProxyGnosis",
    from,
    args: [realitio, metadata, foreignProxy, foreignChainId, homeAmb],
    maxPriorityFeePerGas: gwei("2"),
    maxFeePerGas: gwei("20"),
    log: true,
  });
}

const supportedChainIds = Object.keys(homeParameters).map(Number);

module.exports = { deployHomeProxy, homeParameters, supportedChainIds };
