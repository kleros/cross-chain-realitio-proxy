const { run } = require("hardhat");
const { homeChains, HOME_CHAIN_IDS } = require("./consts/index");
const { unichain, optimism, redstone, unichainSepolia, optimismSepolia } = homeChains;

// Redstone Messenger - https://redstone.xyz/docs/contract-addresses
// Optimism Sepolia Messenger - https://docs.optimism.io/chain/addresses
// Unichain Sepolia Messenger - https://docs.unichain.org/docs/technical-information/contract-addresses
// Same for all the L2 OP chains
const messenger = "0x4200000000000000000000000000000000000007";

// Same for all chains
const metadata =
  '{"tos":"ipfs://QmNV5NWwCudYKfiHuhdWxccrPyxs4DnbLGQace2oMKHkZv/Question_Resolution_Policy.pdf", "foreignProxy":true}';

const params = {
  [unichainSepolia.chainId]: {
    // https://github.com/RealityETH/reality-eth-monorepo/blob/main/packages/contracts/chains/deployments/1301/ETH/RealityETH-3.0.json
    realitio: "0x288799697AE9EbceDC1b30BBAE6a38e03e41CdDb",
    messenger,
    metadata,
    family: "Unichain",
  },
  [optimismSepolia.chainId]: {
    // https://github.com/RealityETH/reality-eth-monorepo/blob/main/packages/contracts/chains/deployments/11155420/ETH/RealityETH-3.0.json
    realitio: "0xeAD0ca922390a5E383A9D5Ba4366F7cfdc6f0dbA",
    messenger,
    metadata,
    family: "Optimism",
  },
  [unichain.chainId]: {
    // https://github.com/RealityETH/reality-eth-monorepo/blob/main/packages/contracts/chains/deployments/130/ETH/RealityETH-3.0.json
    realitio: "0x0000000000000000000000000000000000000000", // FIXME!
    messenger,
    metadata,
    family: "Unichain",
  },
  [optimism.chainId]: {
    // https://github.com/RealityETH/reality-eth-monorepo/blob/main/packages/contracts/chains/deployments/10/OETH/RealityETH-3.0.json
    realitio: "0x0eF940F7f053a2eF5D6578841072488aF0c7d89A",
    messenger,
    metadata,
    family: "Optimism",
  },
  [redstone.chainId]: {
    // https://github.com/RealityETH/reality-eth-monorepo/blob/main/packages/contracts/chains/deployments/690/ETH/RealityETH-3.0.json
    realitio: "0xc716c23D75f523eF0C511456528F2A1980256a87",
    messenger,
    metadata,
    family: "Redstone",
  },
};

async function deployHomeProxy({ deployments, getChainId, ethers, config, network }) {
  console.log(`Running deployment script for home proxy contract on ${network.name}`);

  const { deploy } = deployments;
  const chainId = await getChainId();
  const { realitio, metadata, messenger, family } = params[chainId];
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

  console.log(
    `Args: realitio=${realitio}, foreignChainId=${foreignNetwork.chainId}, foreignProxy=${foreignProxy}, metadata=${metadata}, messenger=${messenger}`
  );

  const homeProxy = await deploy(`RealitioHomeProxy${family}`, {
    contract: "RealitioHomeProxyOptimism",
    from: account.address,
    args: [realitio, foreignNetwork.chainId, foreignProxy, metadata, messenger],
  });

  console.log(`RealitioHomeProxyOptimism was deployed to ${homeProxy.address}, waiting 5 seconds before verifying...`);
  await new Promise((resolve) => setTimeout(resolve, 5000));

  await run("verify:verify", {
    address: homeProxy.address,
    constructorArguments: [realitio, foreignNetwork.chainId, foreignProxy, metadata, messenger],
  });
}

deployHomeProxy.tags = ["HomeChain"];
deployHomeProxy.skip = async ({ getChainId }) => !HOME_CHAIN_IDS.includes(Number(await getChainId()));

module.exports = deployHomeProxy;
