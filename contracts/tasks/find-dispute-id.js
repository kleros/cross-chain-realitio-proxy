const { task } = require("hardhat/config");
const { ethers } = require("ethers");

// Usage: yarn hardhat findDisputeID --foreign-proxy <address> --question-id <questionID>
task("find-dispute-id", "Finds the disputeID for a given questionID on a foreign proxy")
  .addParam("foreignProxy", "The address of the foreign proxy contract")
  .addParam("questionId", "The Reality question ID")
  .setAction(async ({ foreignProxy, questionId }, hre) => {
    const provider = new ethers.JsonRpcProvider(hre.network.config.url);
    const iface = new ethers.Interface([
      "event ArbitrationCreated(bytes32 indexed _questionID, address indexed _requester, uint256 indexed _disputeID)",
    ]);

    const questionIdPadded = ethers.zeroPadValue(questionId.toLowerCase(), 32);
    const filter = {
      address: foreignProxy,
      topics: [ethers.id("ArbitrationCreated(bytes32,address,uint256)"), questionIdPadded],
      fromBlock: 0,
      toBlock: "latest",
    };

    const logs = await provider.getLogs(filter);
    if (logs.length === 0) {
      console.log("No dispute found for the given question ID.");
      return;
    }

    const disputeID = iface.parseLog(logs[0]).args.toObject()._disputeID;
    console.log("Dispute ID:", disputeID.toString());
  });

module.exports = {};
