const hre = require("hardhat");
const ethers = require("ethers");
const { Provider, utils } = require("zksync-ethers");
const { getL1MessageSentEvent, getCalldata } = require("./get_event_properties");
const RealitioForeignArbitrationProxy = require("@kleros/cross-chain-realitio-contracts/artifacts-zk/src/0.8/RealitioForeignProxyZkSync.sol/RealitioForeignProxyZkSync.json");
const RealitioHomeArbitrationProxy = require("@kleros/cross-chain-realitio-contracts/artifacts-zk/src/0.8/RealitioHomeProxyZkSync.sol/RealitioHomeProxyZkSync.json");

async function executeProof() {
  // https://code.zksync.io/tutorials/how-to-send-l2-l1-message
  const txHash = "";

  const foreignNetworks = {
    324: hre.config.networks.mainnet,
    300: hre.config.networks.sepolia,
  };
  const chainId = hre.network.config.chainId;

  const l1Provider = new ethers.JsonRpcProvider(foreignNetworks[chainId]?.url);  
  const l2Provider = new Provider(hre.network.config.url);

  const l1MessageSentEvent = await getL1MessageSentEvent(txHash, utils.L1_MESSENGER, l2Provider);

  if (!l1MessageSentEvent) {
    throw new Error("No L1MessageSent event found in the transaction.");
  }

  const blockNumber = l1MessageSentEvent.blockNumber;
  const homeProxy = `0x${BigInt(l1MessageSentEvent.address).toString(16)}`;
  const msgHash = l1MessageSentEvent.msgHash;
  const eventData = await getCalldata(txHash, l2Provider);
  const homeProxyContract = new ethers.Contract(homeProxy, RealitioHomeArbitrationProxy.abi, l2Provider);
  console.log(await homeProxyContract.foreignProxy());
  const foreignProxyContract = new ethers.Contract(
    await homeProxyContract.foreignProxy(),
    RealitioForeignArbitrationProxy.abi,
    l1Provider
  );

  console.log(`Event: ${l1MessageSentEvent.name}`);
  console.log("Block Number:", blockNumber);
  console.log("Smart Contract Address:", homeProxy);
  console.log("Hash:", msgHash);
  console.log("Message:", eventData);

  const l2Receipt = await l2Provider.getTransactionReceipt(txHash);
  console.log(l2Receipt);
  const logIndex = l2Receipt.l2ToL1Logs[0].logIndex;
  console.log(`L2 transaction included in block ${l2Receipt.blockNumber} with log index ${logIndex}`);
  const { l1BatchNumber, l1BatchTxIndex } = l2Receipt;
  console.log("L1 Index for Tx in block :>> ", l1BatchTxIndex);
  console.log("L1 Batch for block :>> ", l1BatchNumber);

  const proof = await getLogProof(txHash, logIndex, l2Provider);
  console.log("Proof is: ", proof);

  const result = await proveL2MessageInclusion(
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
    const signer = new ethers.Wallet(process.env.PRIVATE_KEY, l1Provider);
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

async function getLogProof(txHash, l2TxIndex, l2Provider) {
  return await l2Provider.getLogProof(txHash, l2TxIndex);
}

async function proveL2MessageInclusion(l1BatchNumber, proof, trxIndex, l1Provider, l2Provider, homeProxy, message) {
  const zkAddress = await l2Provider.getMainContractAddress();

  const mailboxL1Contract = new ethers.Contract(zkAddress, utils.ZKSYNC_MAIN_ABI, l1Provider);
  const messageInfo = {
    txNumberInBatch: trxIndex,
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
