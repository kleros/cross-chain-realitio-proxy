const { run, ethers } = require("hardhat");
const { foreignChains, FOREIGN_CHAIN_IDS } = require("./consts/index");
const { mainnet, sepolia } = foreignChains;

const encodeExtraData = (courtId, minJurors) =>
  ethers.AbiCoder.defaultAbiCoder().encode(["uint96", "uint96"], [courtId, minJurors]);

const klerosLiquid = {
  [mainnet.chainId]: "0x988b3a538b618c7a603e1c11ab82cd16dbe28069",
  [sepolia.chainId]: "0x90992fb4E15ce0C59aEFfb376460Fda4Ee19C879",
};

const oracleCourt = {
  [mainnet.chainId]: 24,
  [sepolia.chainId]: 3,
};

// Note that values apply to both testnet and mainnet since fees are observed to be about the same on both chains as of mid 2024.
const winnerMultiplier = 3000;
const loserMultiplier = 7000;
const loserAppealPeriodMultiplier = 5000;

// The parameters are keyed by home network name rather than by chainId because several home proxies point to the same foreign proxy.
const params = {
  unichainSepolia: {
    arbitrator: klerosLiquid[sepolia.chainId],
    arbitratorExtraData: encodeExtraData(oracleCourt[sepolia.chainId], 1), // Oracle Court - 1 juror
    // https://docs.unichain.org/docs/technical-information/contract-addresses
    messenger: "0x448A37330A60494E666F6DD60aD48d930AEbA381",
    metaEvidence: "/ipfs/QmfFVUKfKjZyXPwcefpJqBbFaaA4GcZrzMnt3xH211ySKy",
    multipliers: [winnerMultiplier, loserMultiplier, loserAppealPeriodMultiplier],
    family: `Unichain`,
  },
  optimismSepolia: {
    arbitrator: klerosLiquid[sepolia.chainId],
    arbitratorExtraData: encodeExtraData(oracleCourt[sepolia.chainId], 1), // Oracle Court - 1 juror
    // https://docs.optimism.io/chain/addresses
    messenger: "0x58Cc85b8D04EA49cC6DBd3CbFFd00B4B8D6cb3ef",
    metaEvidence: "/ipfs/QmYj9PRtDV4HpNKXJbJ8AaYv5FBknNuSo4kjH2raHX47eM/",
    multipliers: [winnerMultiplier, loserMultiplier, loserAppealPeriodMultiplier],
    family: `Optimism`,
  },
  unichain: {
    arbitrator: klerosLiquid[mainnet.chainId],
    arbitratorExtraData: encodeExtraData(oracleCourt[mainnet.chainId], 7), // Oracle Court - 7 jurors
    // https://docs.unichain.org/docs/technical-information/contract-addresses
    messenger: "FIXME", // Not launched yet
    metaEvidence: "/ipfs/FIXME",
    multipliers: [winnerMultiplier, loserMultiplier, loserAppealPeriodMultiplier],
    family: `Unichain`,
  },
  optimism: {
    arbitrator: klerosLiquid[mainnet.chainId],
    arbitratorExtraData: encodeExtraData(oracleCourt[mainnet.chainId], 7), // Oracle Court - 7 jurors
    // https://docs.optimism.io/chain/addresses
    messenger: "0x25ace71c97B33Cc4729CF772ae268934F7ab5fA1",
    metaEvidence: "/ipfs/QmaA3mXhvRxXFcmyF2zbF5CirJmK4xH2jVy7XBWBDprvxS",
    multipliers: [winnerMultiplier, loserMultiplier, loserAppealPeriodMultiplier],
    family: `Optimism`,
  },
  redstone: {
    arbitrator: klerosLiquid[mainnet.chainId],
    arbitratorExtraData: encodeExtraData(oracleCourt[mainnet.chainId], 7), // Oracle Court - 7 jurors
    // https://redstone.xyz/docs/contract-addresses
    messenger: "0x592C1299e0F8331D81A28C0FC7352Da24eDB444a",
    metaEvidence: "/ipfs/bafybeibho6gzezi7ludu6zxfzetmicho7ekuh3gu3oouihmbfsabhcg7te/",
    multipliers: [winnerMultiplier, loserMultiplier, loserAppealPeriodMultiplier],
    family: `Redstone`,
  },
};

async function getHomeDeployments({ companionNetworks, homeNetworkName, config }) {
  const homeChainId = config.networks[homeNetworkName].chainId;
  let homeNetwork;
  for await (const [key, network] of Object.entries(companionNetworks))
    if (key.startsWith("home") && String(await network.getChainId()) === String(homeChainId)) homeNetwork = network;
  if (!homeNetwork) throw new Error(`Home network ${homeNetworkName} not configured correctly`);
  return homeNetwork.deployments;
}

async function deployForeignProxy({ deployments, ethers, companionNetworks, config, network }) {
  const homeNetworkName = process.env.HOME_NETWORK;
  if (!homeNetworkName || !(homeNetworkName in params))
    throw new Error(`Error: HOME_NETWORK environment variable must be one of: ${Object.keys(params).join(", ")}`);

  console.log(
    `Running deployment script for foreign proxy contract on ${network.name} for home proxy ${homeNetworkName}`
  );

  const { deploy } = deployments;
  const { arbitrator, arbitratorExtraData, messenger, metaEvidence, multipliers, family } = params[homeNetworkName];
  const [account] = await ethers.getSigners();
  const homeDeployments = await getHomeDeployments({ companionNetworks, homeNetworkName, config });
  const homeProxy = await homeDeployments.get(`RealitioHomeProxy${family}`).then((homeProxy) => homeProxy.address);

  console.log(
    `Args: messenger=${messenger}, homeProxy=${homeProxy}, arbitrator=${arbitrator}, arbitratorExtraData=${arbitratorExtraData}, metaEvidence=${metaEvidence}, multipliers=[${multipliers}]`
  );

  const foreignProxy = await deploy(`RealitioForeignProxy${family}`, {
    contract: "RealitioForeignProxyOptimism",
    from: account.address,
    args: [messenger, homeProxy, arbitrator, arbitratorExtraData, metaEvidence, multipliers],
  });

  console.log(
    `Foreign proxy contract was successfully deployed at ${foreignProxy.address}, waiting 5 seconds before verifying...`
  );
  await new Promise((resolve) => setTimeout(resolve, 5000));

  await run("verify:verify", {
    address: foreignProxy.address,
    constructorArguments: [messenger, homeProxy, arbitrator, arbitratorExtraData, metaEvidence, multipliers],
  });
}

deployForeignProxy.tags = ["ForeignChain"];
deployForeignProxy.skip = async ({ getChainId }) => !FOREIGN_CHAIN_IDS.includes(Number(await getChainId()));

module.exports = deployForeignProxy;
