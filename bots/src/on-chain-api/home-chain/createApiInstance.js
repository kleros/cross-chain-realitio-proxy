import HomeProxy from "@kleros/cross-chain-realitio-contracts/artifacts/RealitioHomeArbitrationProxy.json";
import RealitioInterface from "@kleros/cross-chain-realitio-contracts/artifacts/RealitioInterface.json";
import {compose, descend, filter, head, into, map, path, prop, propEq, sort} from "ramda";
import {createBatchSend} from "~/shared/batchSend";
import {getContract} from "~/shared/contract";
import {getPastEvents} from "~/shared/events";
import * as P from "~/shared/promise";
import {homeWeb3 as web3} from "~/shared/web3";
import {Status} from "./entities";

const HOME_TX_BATCHER_CONTRACT_ADDRESS = process.env.HOME_TX_BATCHER_CONTRACT_ADDRESS;

export default async function createApiInstance() {
  const [batchSend, homeProxy, realitio] = await Promise.all([
    createBatchSend(web3, HOME_TX_BATCHER_CONTRACT_ADDRESS),
    getContract(web3, HomeProxy.abi, process.env.HOME_PROXY_CONTRACT_ADDRESS),
    getContract(web3, RealitioInterface.abi, process.env.HOME_REALITIO_CONTRACT_ADDRESS),
  ]);

  async function getBlockNumber() {
    return Number(await web3.eth.getBlockNumber());
  }

  async function getChainId() {
    return Number(await web3.eth.getChainId());
  }

  async function getRequestByQuestionId(questionId) {
    const [request, chainId] = await Promise.all([
      homeProxy.methods.questionIDToRequest(questionId).call(),
      getChainId(),
    ]);

    return {
      questionId,
      chainId,
      ...request,
      status: Number(request.status),
    };
  }

  async function getPendingRequestDetails(questionId) {
    const [bestAnwser, isFinalized] = await P.all([_getBestAnswer(questionId), _isFinalized(questionId)]);

    return {
      question: {bestAnwser, isFinalized},
    };
  }

  async function getNotifiedRequests({fromBlock = 0, toBlock = "latest"} = {}) {
    const events = await getPastEvents(homeProxy, "RequestNotified", {fromBlock, toBlock});

    const allNotifiedRequests = await P.allSettled(
      map(compose(getRequestByQuestionId, path(["returnValues", "_questionID"])), events)
    );
    const onlyFulfilledAndNotified = compose(
      filter(propEq("status", "fulfilled")),
      map(prop("value")),
      filter(({status}) => Number(status) === Status.Notified)
    );

    return into([], onlyFulfilledAndNotified, allNotifiedRequests);
  }

  async function getPendingRequests({fromBlock = 0, toBlock = "latest"} = {}) {
    const events = await getPastEvents(homeProxy, "RequestPending", {fromBlock, toBlock});

    const allNotifiedRequests = await P.allSettled(
      map(compose(getRequestByQuestionId, path(["returnValues", "_questionID"])), events)
    );
    const onlyFulfilled = compose(filter(propEq("status", "fulfilled")), map(prop("value")));

    return into([], onlyFulfilled, allNotifiedRequests);
  }

  async function handleNotifiedRequest(request) {
    return batchSend({
      args: [request.questionId],
      method: homeProxy.methods.handleNotifiedRequest,
      to: homeProxy.options.address,
    });
  }

  async function handleChangedAnswer(request) {
    return batchSend({
      args: [request.questionId],
      method: homeProxy.methods.handleChangedAnswer,
      to: homeProxy.options.address,
    });
  }

  async function handleFinalizedQuestion(request) {
    return batchSend({
      args: [request.questionId],
      method: homeProxy.methods.handleFinalizedQuestion,
      to: homeProxy.options.address,
    });
  }

  async function reportArbitrationAnswer(request) {
    const {questionId} = request;
    const {historyHash, answerOrCommitmentID, answerer} = await _getLatestAnswerParams(questionId);

    return batchSend({
      args: [questionId, historyHash, answerOrCommitmentID, answerer],
      method: homeProxy.methods.reportArbitrationAnswer,
      to: homeProxy.options.address,
    });
  }

  async function _getBestAnswer(questionId) {
    return realitio.methods.getBestAnswer(questionId).call();
  }

  async function _isFinalized(questionId) {
    return realitio.methods.isFinalized(questionId).call();
  }

  async function _getLatestAnswerParams(questionId) {
    const events = await getPastEvents(realitio, "LogNewAnswer", {
      filter: {
        question_id: questionId,
      },
    });

    if (events.length == 0) {
      throw new Error(`Question ${questionId} was never answered`);
    }

    const byMostRecentBlock = descend(prop("blockNumber"));
    const event = compose(prop("returnValues"), head, sort(byMostRecentBlock))(events);

    return {
      historyHash: event.history_hash,
      answerOrCommitmentID: event.answer,
      answerer: event.user,
    };
  }

  return {
    getBlockNumber,
    getChainId,
    getNotifiedRequests,
    getPendingRequestDetails,
    getPendingRequests,
    getRequestByQuestionId,
    handleChangedAnswer,
    handleFinalizedQuestion,
    handleNotifiedRequest,
    reportArbitrationAnswer,
  };
}
