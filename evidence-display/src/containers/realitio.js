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

const OMEN_URL_TEMPLATE = process.env.REACT_APP_OMEN_URL_TEMPLATE;
const REALITY_APP_URL_TEMPLATE = process.env.REACT_APP_REALITY_ETH_URL_TEMPLATE;

class RealitioDisplayInterface extends Component {
  constructor() {
    super();
    this.state = {
      question: null,
      markets: [],
      error: null,
      chainId: 0,
    };
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

    const [questionEventLog, markets] = await Promise.all([
      realitio.getPastEvents("LogNewQuestion", {
        filter: {
          question_id: questionID,
        },
        fromBlock: 0,
        toBlock: "latest",
      }),
      fetchRelatedMarkets({ questionID }),
    ]);

    const questionText = questionEventLog[0].returnValues.question.split("\u241f");
    question.text = questionText[0];

    const homeChainID = await homeWeb3.eth.getChainId();

    this.setState({ question, markets, homeChainID });
  }

  render() {
    const { question, markets, homeChainID, error } = this.state;
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
              href={parseTemplate(REALITY_APP_URL_TEMPLATE, {
                questionID: question.quesitonId,
              })}
              target="_blank"
              rel="noopener noreferrer"
            >
              Question Details
            </QuestionLink>
            {markets && markets.length > 0 ? (
              <React.Fragment>
                <Spacer />
                <QuestionDisclaimer>
                  This Realitio dispute has been created by Omen, we advise you to read the Omen Rules and consult the
                  evidence provided in the Omen Markets below:
                </QuestionDisclaimer>
                <MarketList>
                  {markets.map(({ id, title }) => (
                    <MarketList.Item key={id}>
                      <a
                        href={parseTemplate(OMEN_URL_TEMPLATE, {
                          address: id,
                          chainID: homeChainID,
                        })}
                        target="_blank"
                        rel="noreferrer noopener"
                      >
                        {title}
                      </a>
                    </MarketList.Item>
                  ))}
                </MarketList>
              </React.Fragment>
            ) : null}
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

function parseTemplate(template, data) {
  return Object.entries(data).reduce(
    (result, [key, value]) => result.replace(new RegExp(`{{${key}}}`, "g"), value),
    template
  );
}

async function fetchRelatedMarkets({ questionID }) {
  const url = process.env.REACT_APP_OMEN_SUBGRAPH_ENDPOINT;
  const payload = {
    query: `
    {
      question(id: "${questionID}") {
        indexedFixedProductMarketMakers {
          id
          title
        }
      }
    }
    `,
  };

  const response = await fetch(url, {
    method: "POST",
    mode: "cors",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(payload),
  });

  const body = await response.json();

  const productMarketMakers = body.data && body.data.question && body.data.question.indexedFixedProductMarketMakers;
  return productMarketMakers || [];
}

const QuestionText = styled.div`
  margin-bottom: 15px;
  font-family: "Roboto", sans-serif;
  font-size: 20px;
  font-variant: tabular-nums;
  line-height: 1.5;
  color: rgba(0, 0, 0, 0.65);
  background-color: #fff;
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

const QuestionDisclaimer = styled(QuestionText)`
  font-size: 18px;
`;

const ErrorText = styled(QuestionText)`
  color: red;
`;

const Header = styled.div`
  height: 80px;
  margin-bottom: 25px;

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

const Spacer = styled.div`
  clear: both;
  margin-bottom: 24px;
`;

const MarketList = styled.ul`
  list-style: none;
  padding: 0;
  margin: 0;
`;

MarketList.Item = styled.li`
  & + & {
    margin-top: 8px;
  }

  > a {
    font-family: "Roboto", sans-serif;
    font-size: 14px;
    font-variant: tabular-nums;
    line-height: 1.5;
    color: rgba(0, 0, 0, 0.65);
    background-color: #fff;
    color: #2093ff;
  }
`;
