async function getL1MessageSentEvent(transactionHash, contractInterface, provider) {
  const receipt = await provider.getTransactionReceipt(transactionHash);

  if (!receipt) {
    console.error("Transaction receipt not found.");
    return;
  }

  const topicHash = "0x3a36e47291f4201faf137fab081d92295bce2d53be2c6ca68ba82c7faa9ce241"; // L1MessageSent
  const eventLogs = receipt.logs.filter((log) => log.topics[0] === topicHash);

  if (eventLogs.length === 0) {
    console.log(`No logs found for the specified topic.`);
    return;
  }

  const parsedLog = contractInterface.parseLog(eventLogs[0]);

  return {
    name: parsedLog.name,
    blockNumber: eventLogs[0].blockNumber,
    address: eventLogs[0].topics[1],
    msgHash: eventLogs[0].topics[2],
    data: eventLogs[0].data,
  };
}

function getFunctionSelector(functionSignature) {
  const hash = ethers.utils.id(functionSignature);
  const selector = hash.slice(0, 10); // 0x + first 4 bytes

  return selector;
}

function encodeWithSelector(selector, ...params) {
  const encodedParams = params.map(param => {
    if (param.type === "address") {
      // If the parameter type is address, directly append the value
      return param.value.slice(2);
    } else {
      // Otherwise, encode using defaultAbiCoder
      return ethers.utils.defaultAbiCoder.encode([param.type], [param.value]).slice(2);
    }
  });

  const encodedData = selector + encodedParams.join("");
  return encodedData;
}

async function getCalldata(txHash, provider) {
  try {
    let topicHash;
    let eventLogs;
    let selector;
    let functionSignature;

    const receipt = await provider.getTransactionReceipt(txHash);

    if (!receipt) {
      throw new Error("Transaction receipt not found.");
    }

    functionSignature = "receiveArbitrationAcknowledgement(bytes32,address)";
    selector = getFunctionSelector(functionSignature);
    topicHash = "0xff09615c531ab8799ea1c67a0952ddbef1c864ef91d390995d0dc07656f4210f"; // RequestAcknowledged
    eventLogs = receipt.logs.filter((log) => log.topics[0] === topicHash);
    // Check for Cancel event.
    if (eventLogs.length === 0) {
      functionSignature = "receiveArbitrationCancelation(bytes32,address)";
      selector = getFunctionSelector(functionSignature);
      topicHash = "0x2e6d7df187c23d198e00f4a26b9053d2f32c89fb5c86e960ba3f450634bfb692"; // RequestCanceled
      eventLogs = receipt.logs.filter((log) => log.topics[0] === topicHash);
    }

    if (eventLogs.length === 0) {
      throw new Error("No logs found for the specified topic.");
    }
    const calldata = encodeWithSelector(
      selector,
      { type: "bytes32", value: eventLogs[0].topics[1] }, // questionId
      { type: "address", value: eventLogs[0].topics[2] }  // requester
    );
    console.log(`Calldata: ${calldata}`);
    return calldata;
  } catch (error) {
    console.error("Error in getCalldata:", error);
    throw error; // Re-throw the error to be handled by the caller
  }
}

module.exports = {
  getL1MessageSentEvent, getCalldata
};
