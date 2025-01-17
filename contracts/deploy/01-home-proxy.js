const { run } = require("hardhat");
const { homeChains, HOME_CHAIN_IDS } = require("./consts/index");
const { unichain, optimism, redstone, unichainSepolia, optimismSepolia } = homeChains;

// Redstone Messenger - https://redstone.xyz/docs/contract-addresses
// Optimism Sepolia Messenger - https://docs.optimism.io/chain/addresses
// Unichain Sepolia Messenger - https://docs.unichain.org/docs/technical-information/contract-addresses
// Same for all the L2 OP chains
const opMessenger = "0x4200000000000000000000000000000000000007";

// Same for all chains
const metadata =
  '{"tos":"ipfs://QmNV5NWwCudYKfiHuhdWxccrPyxs4DnbLGQace2oMKHkZv/Question_Resolution_Policy.pdf", "foreignProxy":true}';

const params = {
  [unichainSepolia.chainId]: {
    // https://github.com/RealityETH/reality-eth-monorepo/blob/main/packages/contracts/chains/deployments/1301/ETH/RealityETH-3.0.json
    realitio: "0x288799697AE9EbceDC1b30BBAE6a38e03e41CdDb",
    homeBridge: opMessenger,
    metadata,
    variant: "Unichain",
  },
  [optimismSepolia.chainId]: {
    // https://github.com/RealityETH/reality-eth-monorepo/blob/main/packages/contracts/chains/deployments/11155420/ETH/RealityETH-3.0.json
    realitio: "0xeAD0ca922390a5E383A9D5Ba4366F7cfdc6f0dbA",
    homeBridge: opMessenger,
    metadata,
    variant: "Optimism",
  },
  [unichain.chainId]: {
    // https://github.com/RealityETH/reality-eth-monorepo/blob/main/packages/contracts/chains/deployments/130/ETH/RealityETH-3.0.json
    realitio: "0x0000000000000000000000000000000000000000", // FIXME!
    homeBridge: opMessenger,
    metadata,
    variant: "Unichain",
  },
  [optimism.chainId]: {
    // https://github.com/RealityETH/reality-eth-monorepo/blob/main/packages/contracts/chains/deployments/10/OETH/RealityETH-3.0.json
    realitio: "0x0eF940F7f053a2eF5D6578841072488aF0c7d89A",
    homeBridge: opMessenger,
    metadata,
    variant: "Optimism",
  },
  [redstone.chainId]: {
    // https://github.com/RealityETH/reality-eth-monorepo/blob/main/packages/contracts/chains/deployments/690/ETH/RealityETH-3.0.json
    realitio: "0xc716c23D75f523eF0C511456528F2A1980256a87",
    homeBridge: opMessenger,
    metadata,
    variant: "Redstone",
  },
};

/**
 * Constructors args
 * Inputs: realitio, foreignChainId, foreignProxy, metadata, homeBridge, deployOptions, preDeploy(compute alias), postDeploy(link fxChild)
 *
 * RealitioHomeProxyOptimism: realitio, foreignChainId, foreignProxy, metadata, messenger (IT SHOULD BE HARDCODED for HOME)
 * RealitioHomeProxyArbitrumitrumitrum: realitio, foreignChainId, foreignProxy, metadata
 * RealitioHomeZkSync: realitio, foreignChainId, foreignProxy, alias (= L2 address for foreignProxy), metadata
 * RealitioHomeProxyGnosis: amb, foreignProxy, foreignChainId (bytes32), realitio, metadata
 *   -> TODO: change to realitio, foreignChainId (convert in constructor), foreignProxy, metadata, amb
 * RealitioHomeProxyPolygon: fxChild, realitio, foreignChainId, metadata (+ fxRootTunnel separately)...
 *   -> TODO: try to modify FxBaseChildTunnel.sol constructor
 */

async function deployOptimism(deploy, from, chainParams, foreignChainId, foreignProxy) {
  const { realitio, metadata, homeBridge, variant } = chainParams;
  return await deploy(`RealitioHomeProxy${variant}`, {
    contract: "RealitioHomeProxyOptimism",
    from,
    args: [realitio, foreignChainId, foreignProxy, metadata, homeBridge],
    log: true,
  });
}

async function deployHomeProxy({ deployments, getChainId, ethers, config, network }) {
  console.log(`Running deployment script for home proxy contract on ${network.name}`);

  const { deploy } = deployments;
  const chainId = await getChainId();
  if (!network.companionNetworks.foreign) {
    throw new Error("Foreign network not configured in companion networks");
  }
  const foreignNetwork = config.networks[network.companionNetworks.foreign];
  const provider = new ethers.JsonRpcProvider(foreignNetwork.url);
  const [account] = await ethers.getSigners();
  const nonce = await provider.getTransactionCount(account.address);
  console.log(`Nonce: ${nonce}`);
  const transaction = {
    from: account.address,
    nonce: nonce,
  };
  const foreignProxy = ethers.getCreateAddress(transaction);
  console.log(`Foreign proxy: ${foreignProxy}`);

  const homeProxy = await deployOptimism(
    deploy,
    account.address,
    params[chainId],
    foreignNetwork.chainId,
    foreignProxy
  );

  console.log(`RealitioHomeProxyOptimism was deployed to ${homeProxy.address}`);
}

deployHomeProxy.tags = ["HomeChain"];
deployHomeProxy.skip = async ({ getChainId }) => !HOME_CHAIN_IDS.includes(Number(await getChainId()));

module.exports = deployHomeProxy;
