const hre = require("hardhat");
const { Provider, utils } = require("zksync-web3");
const { getL1MessageSentEvent, getCalldata } = require("../helpers/get_event_properties");
const RealitioForeignArbitrationProxy = require("@kleros/cross-chain-realitio-contracts/artifacts-zk/src/zkRealitioForeignProxy.sol/zkRealitioForeignProxy.json");
const RealitioHomeArbitrationProxy = require("@kleros/cross-chain-realitio-contracts/artifacts-zk/src/zkRealitioHomeProxy.sol/zkRealitioHomeProxy.json");

async function executeProof() {
  // https://era.zksync.io/docs/dev/how-to/send-message-l2-l1.html
  const txHash = "";

  const { providers } = ethers;
  const foreignNetworks = {
    280: hre.config.networks.goerli,
    324: hre.config.networks.mainnet,
    300: hre.config.networks.sepolia,
  };
  const chainId = hre.network.config.chainId;
  const url = foreignNetworks[chainId];

  const l1Provider = new Provider(hre.network.config.url);
  const l2Provider = new providers.JsonRpcProvider(url);

  const l1MessageSentEvent = await getL1MessageSentEvent(txHash, utils.L1_MESSENGER, l1Provider);

  if (!l1MessageSentEvent) {
    throw new Error("No L1MessageSent event found in the transaction.");
  }

  const blockNumber = l1MessageSentEvent.blockNumber;
  const homeProxy = "0x" + BigInt(l1MessageSentEvent.address).toString(16);
  const msgHash = l1MessageSentEvent.msgHash;
  const eventData = await getCalldata(txHash, l1Provider);
  const homeProxyContract = new ethers.Contract(homeProxy, RealitioHomeArbitrationProxy.abi, l1Provider);
  console.log(await homeProxyContract.foreignProxy());
  const foreignProxyContract = new ethers.Contract(
    await homeProxyContract.foreignProxy(),
    RealitioForeignArbitrationProxy.abi,
    l2Provider
  );

  console.log(`Event: ${l1MessageSentEvent.name}`);
  console.log("Block Number:", blockNumber);
  console.log("Smart Contract Address:", homeProxy);
  console.log("Hash:", msgHash);
  console.log("Message:", eventData);

  const proof = await getL1MessageProof(blockNumber, l1Provider, homeProxy, msgHash);
  console.log(`Proof is: `, proof);
  const { l1BatchNumber, l1BatchTxIndex } = await l1Provider.getTransactionReceipt(txHash);

  console.log("L1 Index for Tx in block :>> ", l1BatchTxIndex);
  console.log("L1 Batch for block :>> ", l1BatchNumber);

  const result = await proveL1MessageInclusion(
    l1BatchNumber,
    proof,
    l1BatchTxIndex,
    l1Provider,
    l2Provider,
    homeProxy,
    eventData
  );

  console.log("Result is :>> ", result);

  if (result) {
    const signer = new ethers.Wallet(process.env.PRIVATE_KEY, l2Provider);
    try {
      await foreignProxyContract
        .connect(signer)
        .consumeMessageFromL2(l1BatchNumber, proof.id, l1BatchTxIndex, eventData, proof.proof);
      console.log("Message successfully consumed on L2");
    } catch (error) {
      console.error("Error calling consumeMessageFromL2:", error.message);
    }
  } else {
    console.error("The result is false. Skipping the call");
  }
  process.exit();
}

async function getL1MessageProof(blockNumber, l1Provider, homeProxy, msgHash) {
  console.log(`Getting L1 message proof for block ${blockNumber}`);
  return await l1Provider.getMessageProof(blockNumber, homeProxy, msgHash);
}

async function proveL1MessageInclusion(l1BatchNumber, proof, trxIndex, l1Provider, l2Provider, homeProxy, message) {
  const zkAddress = await l1Provider.getMainContractAddress();

  const mailboxL1Contract = new ethers.Contract(zkAddress, utils.ZKSYNC_MAIN_ABI, l2Provider);
  const messageInfo = {
    txNumberInBlock: trxIndex,
    sender: homeProxy,
    data: message,
  };

  console.log(`Retrieving proof for batch ${l1BatchNumber}, transaction index ${trxIndex} and proof id ${proof.id}`);
  const res = await mailboxL1Contract.proveL2MessageInclusion(l1BatchNumber, proof.id, messageInfo, proof.proof);

  return res;
}

executeProof()
  .then(() => {
    console.log("Executed successfully!");
  })
  .catch((error) => {
    console.error("Error:", error);
  });
