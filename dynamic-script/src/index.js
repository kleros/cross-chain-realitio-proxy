const Web3 = require("web3");
const rcQuestion = require("@realitio/realitio-lib/formatters/question.js");
const RealitioForeignArbitrationProxy = require("@kleros/cross-chain-realitio-contracts/artifacts/RealitioForeignArbitrationProxy.json");
const RealitioHomeArbitrationProxy = require("@kleros/cross-chain-realitio-contracts/artifacts/RealitioHomeArbitrationProxy.json");
const RealitioInterface = require("@kleros/cross-chain-realitio-contracts/artifacts/RealitioInterface.json");

const homeRpcEndpoint = process.env.HOME_CHAIN_RPC_ENDPOINT;
const homeWeb3 = new Web3(homeRpcEndpoint);

const foreignRpcEndpoint = process.env.FOREIGN_CHAIN_RPC_ENDPOINT;
const foreignWeb3 = new Web3(foreignRpcEndpoint);

const fromBlock = 0;

const isNil = (value) => value === undefined || value === null;

module.exports = async function getMetaEvidence() {
  if (isNil(scriptParameters.disputeID) || isNil(scriptParameters.arbitrableContractAddress)) {
    return rejectScript("Both `disputeID` and `arbitrableContractAddress` script parameters are required");
  }

  const foreignProxy = new foreignWeb3.eth.Contract(
    RealitioForeignArbitrationProxy.abi,
    scriptParameters.arbitrableContractAddress
  );
  const homeProxy = new homeWeb3.eth.Contract(
    RealitioHomeArbitrationProxy.abi,
    await foreignProxy.methods.homeProxy().call()
  );
  const realitio = new homeWeb3.eth.Contract(RealitioInterface.abi, await homeProxy.methods.realitio().call());

  const arbitrationCreatedLogs = await foreignProxy.getPastEvents("ArbitrationCreated", {
    filter: {
      _disputeID: scriptParameters.disputeID,
    },
    fromBlock: fromBlock,
    toBlock: "latest",
  });

  if(arbitrationCreatedLogs.length != 1) {
    return rejectScript("Could not find the dispute");
  }

  const questionID = arbitrationCreatedLogs[0].returnValues._questionID;

  const questionEventLog = await realitio.getPastEvents("LogNewQuestion", {
    filter: {
      question_id: questionID,
    },
    fromBlock: fromBlock,
    toBlock: "latest",
  });
  const templateID = questionEventLog[0].returnValues.template_id;

  const templateEventLog = await realitio.getPastEvents("LogNewTemplate", {
    filter: {
      template_id: templateID,
    },
    fromBlock: fromBlock,
    toBlock: "latest",
  });
  const templateText = templateEventLog[0].returnValues.question_text;
  const questionData = rcQuestion.populatedJSONForTemplate(templateText, questionEventLog[0].returnValues.question);

  switch (questionData.type) {
    case "bool":
      return resolveScript({
        rulingOptions: {
          type: "single-select",
          titles: ["No", "Yes"],
        },
      });
    case "uint":
      return resolveScript({
        rulingOptions: {
          type: "uint",
          precision: questionData["decimals"],
        },
      });
    case "single-select":
      return resolveScript({
        rulingOptions: {
          type: "single-select",
          titles: questionData.outcomes,
        },
      });
    case "multiple-select":
      return resolveScript({
        rulingOptions: {
          type: "multiple-select",
          titles: questionData.outcomes,
        },
      });
    case "datetime":
      return resolveScript({
        rulingOptions: {
          type: "datetime",
        },
      });
    default:
      return resolveScript({});
  }
};
