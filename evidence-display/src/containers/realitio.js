import React, { Component } from "react";
import Web3 from "web3";
import RealitioForeignArbitrationProxy from "@kleros/cross-chain-realitio-contracts/artifacts/src/RealitioForeignArbitrationProxyWithAppeals.sol/RealitioForeignArbitrationProxyWithAppeals.json";
import RealitioHomeArbitrationProxy from "@kleros/cross-chain-realitio-contracts/artifacts/src/RealitioHomeArbitrationProxy.sol/RealitioHomeArbitrationProxy.json";
import RealitioInterface from "@kleros/cross-chain-realitio-contracts/artifacts/src/dependencies/RealitioInterface.sol/RealitioInterface.json";

import RealityLogo from "../assets/images/realitio_logo.png";
import { populatedJSONForTemplate } from "@reality.eth/reality-eth-lib/formatters/question";
class RealitioDisplayInterface extends Component {
  state = { question: null };

  async componentDidMount() {
    if (window.location.search[0] !== "?") return;

    const message = Object.fromEntries(new URLSearchParams(decodeURIComponent(window.location.search.substring(1))));
    console.debug(message);

    const {
      arbitrableContractAddress,
      disputeID,
      arbitratorChainID,
      arbitrableChainID,
      chainID,
      arbitratorJsonRpcUrl,
      arbitrableJsonRpcUrl,
      jsonRpcUrl,
    } = message;

    console.log(arbitrableContractAddress);
    const rpcURL = arbitrableJsonRpcUrl || arbitratorJsonRpcUrl || jsonRpcUrl;
    const cid = arbitrableChainID || arbitratorChainID || chainID;
    const fromBlock = 0;

    if (!rpcURL || !disputeID || !cid) {
      console.error("Evidence display is missing critical information.");
      return;
    }

    const foreignWeb3 = new Web3(arbitratorJsonRpcUrl || jsonRpcUrl);
    const foreignProxy = new foreignWeb3.eth.Contract(RealitioForeignArbitrationProxy.abi, arbitrableContractAddress);

    const homeWeb3 = new Web3(arbitrableJsonRpcUrl || jsonRpcUrl);
    const homeProxy = new homeWeb3.eth.Contract(
      RealitioHomeArbitrationProxy.abi,
      await foreignProxy.methods.homeProxy().call()
    );

    const realitioContractAddress = await homeProxy.methods.realitio().call();
    const realitio = new homeWeb3.eth.Contract(RealitioInterface.abi, realitioContractAddress);
    const arbitrationCreatedLogs = await foreignProxy.getPastEvents("ArbitrationCreated", {
      filter: {
        _disputeID: disputeID,
      },
      fromBlock: fromBlock,
      toBlock: "latest",
    });

    if (arbitrationCreatedLogs.length != 1) {
      return;
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

    console.log(questionEventLog[0].returnValues.question);
    console.log(templateEventLog[0].returnValues.question_text);
    console.log(
      populatedJSONForTemplate(
        questionEventLog[0].returnValues.question,
        templateEventLog[0].returnValues.question_text
      )
    );
    this.setState({
      questionID,
      chainID: cid,
      realitioContractAddress,
      rawQuestion: questionEventLog[0].returnValues.question,
      rawTemplate: templateEventLog[0].returnValues.question_text,
    });
  }

  render() {
    const { questionID, chainID, realitioContractAddress, rawQuestion, rawTemplate } = this.state;
    if (!questionID) return <div />;

    return (
      <div
        style={{
          backgroundColor: "#f0f4f8",
          padding: "16px",
          fontFamily: "Roboto, sans-serif",
        }}
      >
        <div>
          <img src={RealityLogo} alt="Logo of reality.eth" style={{ maxWidth: "100%" }} />
        </div>
        <hr
          style={{
            height: "3px",
            border: "none",
            backgroundSize: "contain",
            color: "#27b4ee",
            background: "linear-gradient(45deg, #24b3ec 0%, #24b3ec 93%, #b9f9fb  93%, #b9f9fb  95%, #dcfb6c 95%)",
          }}
        />
        <div
          style={{
            marginTop: "16px",
            marginBottom: "32px",
            fontSize: "18x",
            lineHeight: "1.4",
            wordBreak: "break-word",
          }}
        >
          {populatedJSONForTemplate(rawTemplate, rawQuestion).title}
        </div>
        <a
          style={{ color: "#2093ff" }}
          href={`https://reality.eth.link/app/index.html#!/network/${chainID}/question/${realitioContractAddress}-${questionID}`}
          target="_blank"
          rel="noopener noreferrer"
        >
          See on reality.eth
        </a>
      </div>
    );
  }
}

export default RealitioDisplayInterface;
