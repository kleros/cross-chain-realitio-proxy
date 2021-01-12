import React, { Component } from "react";
import t from "prop-types";
import styled from "styled-components/macro";
import { withErrorBoundary } from "react-error-boundary";
import Web3 from "web3";
import RealitioForeignArbitrationProxy from "@kleros/cross-chain-realitio-contracts/artifacts/src/RealitioForeignArbitrationProxy.sol/RealitioForeignArbitrationProxy.json";
import RealitioHomeArbitrationProxy from "@kleros/cross-chain-realitio-contracts/artifacts/src/RealitioHomeArbitrationProxy.sol/RealitioHomeArbitrationProxy.json";
import RealitioInterface from "@kleros/cross-chain-realitio-contracts/artifacts/src/dependencies/RealitioInterface.sol/RealitioInterface.json";
import RealityEthLogo from "../assets/images/reality_eth_logo.png";

const homeRpcEndpoint = process.env.REACT_APP_HOME_CHAIN_RPC_ENDPOINT;
const homeWeb3 = new Web3(homeRpcEndpoint);

const foreignRpcEndpoint = process.env.REACT_APP_FOREIGN_CHAIN_RPC_ENDPOINT;
const foreignWeb3 = new Web3(foreignRpcEndpoint);

class RealitioDisplayInterface extends Component {
  constructor() {
    super();
    this.state = { question: null, error: null };
  }

  async componentDidMount() {
    if (window.location.search[0] !== "?") {
      this.setState({ error: new Error("Missing dispute params") });
      return;
    }

    const message = JSON.parse(decodeURIComponent(window.location.search.substring(1)));

    const { arbitrableContractAddress, disputeID } = message;

    if (!arbitrableContractAddress || !disputeID) {
      this.setState({ error: new Error("Missing dispute params") });
      return;
    }

    const foreignProxy = new foreignWeb3.eth.Contract(RealitioForeignArbitrationProxy.abi, arbitrableContractAddress);
    const homeProxy = new homeWeb3.eth.Contract(
      RealitioHomeArbitrationProxy.abi,
      await foreignProxy.methods.homeProxy().call()
    );
    const realitio = new homeWeb3.eth.Contract(RealitioInterface.abi, await homeProxy.methods.realitio().call());

    const arbitrationCreatedLogs = await foreignProxy.getPastEvents("ArbitrationCreated", {
      filter: {
        _disputeID: disputeID,
      },
      fromBlock: 0,
      toBlock: "latest",
    });

    if (arbitrationCreatedLogs.length !== 1) {
      this.setState({ error: new Error("Could not find the dispute") });
      return;
    }

    const question = {};

    const questionID = arbitrationCreatedLogs[0].returnValues._questionID;
    question.questionID = questionID;

    const questionEventLog = await realitio.getPastEvents("LogNewQuestion", {
      filter: {
        question_id: questionID,
      },
      fromBlock: 0,
      toBlock: "latest",
    });

    const questionText = questionEventLog[0].returnValues.question.split("\u241f");
    question.text = questionText[0];

    const user = questionEventLog[0].returnValues.user;
    question.user = user;

    this.setState({ question });
  }

  render() {
    const { question, error } = this.state;
    if (error) {
      throw error;
    }

    return (
      <div>
        <Header>
          <SquareLeft />
          <SquareRight />
          <img src={RealityEthLogo} />
        </Header>
        {question ? (
          <>
            <QuestionText>{question.text}</QuestionText>
            <QuestionLink
              href={`https://reality.eth.link/app/#!/question/${question.questionID}/network/100`}
              target="_blank"
              rel="noopener noreferrer"
            >
              Question Details
            </QuestionLink>
            <QuestionDisclaimer>
              This realitio dispute has been created by Omen, we advise you to read the Omen Rules and consult the
              evidence provided in the{" "}
              <a href={`https://omen.eth.link/#/${question.user}`} target="_blank" rel="noreferrer noopener">
                Market Comments
              </a>
              .
            </QuestionDisclaimer>
          </>
        ) : (
          <QuestionText>Loading question details...</QuestionText>
        )}
      </div>
    );
  }
}

export default withErrorBoundary(RealitioDisplayInterface, { FallbackComponent: ErrorFallback });

function ErrorFallback({ error }) {
  return (
    <div>
      <Header>
        <SquareLeft />
        <SquareRight />
        <img src={RealityEthLogo} />
      </Header>
      <ErrorText>Error: {error.message}</ErrorText>
    </div>
  );
}

ErrorFallback.propTypes = {
  error: t.instanceOf(Error).isRequired,
};

const QuestionText = styled.div`
  margin-bottom: 15px;
  font-family: "Roboto", sans-serif;
  font-size: 20px;
  font-variant: tabular-nums;
  line-height: 1.5;
  color: rgba(0, 0, 0, 0.65);
  background-color: #fff;
`;

const QuestionDisclaimer = styled(QuestionText)`
  font-size: 18px;
`;

const ErrorText = styled(QuestionText)`
  color: red;
`;

const QuestionLink = styled.a`
  margin-top: 0px;
  font-family: "Roboto", sans-serif;
  font-size: 14px;
  font-variant: tabular-nums;
  line-height: 1.5;
  color: rgba(0, 0, 0, 0.65);
  background-color: #fff;
  color: #2093ff;
`;

const Header = styled.div`
  height: 80px;
  margin-bottom: 25px;
  overflow-x: hidden;

  img {
    height: 100%;
    margin: 0;
  }
`;

const SquareLeft = styled.div`
  position: absolute;
  left: -35px;
  top: -190px;
  width: 100%;
  height: 180px;
  background-color: #56bbe8;
  transform: rotate(-10deg);
  z-index: -1;
`;

const SquareRight = styled.div`
  position: absolute;
  right: -40px;
  top: -160px;
  width: 100%;
  height: 180px;
  background-color: #cae940;
  transform: rotate(4deg);
  z-index: -2;
`;
