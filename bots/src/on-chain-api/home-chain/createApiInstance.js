import RealitioInterface from "@kleros/cross-chain-realitio-contracts/artifacts/src/0.7/interfaces/RealitioInterface.sol/RealitioInterface.json";
import HomeProxy from "@kleros/cross-chain-realitio-contracts/artifacts/src/0.7/RealitioHomeProxyGnosis.sol/RealitioHomeProxyGnosis.json";
import { compose, descend, filter, into, map, prop, propEq, sort } from "ramda";
import { createBatchSend } from "~/shared/batchSend";
import { getContract } from "~/shared/contract";
import { getPastEvents } from "~/shared/events";
import * as P from "~/shared/promise";
import { homeWeb3 as web3 } from "~/shared/web3";

const HOME_TX_BATCHER_CONTRACT_ADDRESS = process.env.HOME_TX_BATCHER_CONTRACT_ADDRESS;

const ZERO_HASH = "0x0000000000000000000000000000000000000000000000000000000000000000";

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

  async function getRequest({ questionId, requester }) {
    const [request, chainId] = await Promise.all([
      homeProxy.methods.requests(questionId, requester).call(),
      getChainId(),
    ]);

    return {
      ...request,
      chainId,
      questionId,
      requester,
      status: Number(request.status),
    };
  }

  async function getNotifiedRequests({ fromBlock = 0, toBlock = "latest" } = {}) {
    const events = await getPastEvents(homeProxy, "RequestNotified", { fromBlock, toBlock });

    const allNotifiedRequests = await P.allSettled(
      map(
        ({ returnValues }) =>
          getRequest({
            questionId: returnValues._questionID,
            requester: returnValues._requester,
          }),
        events
      )
    );

    const onlyFulfilled = compose(filter(propEq("status", "fulfilled")), map(prop("value")));

    return into([], onlyFulfilled, allNotifiedRequests);
  }

  async function getRejectedRequests({ fromBlock = 0, toBlock = "latest" } = {}) {
    const events = await getPastEvents(homeProxy, "RequestRejected", { fromBlock, toBlock });

    const allRejectedRequests = await P.allSettled(
      map(
        ({ returnValues }) =>
          getRequest({
            questionId: returnValues._questionID,
            requester: returnValues._requester,
          }),
        events
      )
    );
    const onlyFulfilled = compose(filter(propEq("status", "fulfilled")), map(prop("value")));

    return into([], onlyFulfilled, allRejectedRequests);
  }

  async function handleNotifiedRequest(request) {
    await batchSend({
      args: [request.questionId, request.requester],
      method: homeProxy.methods.handleNotifiedRequest,
      to: homeProxy.options.address,
    });
    return request;
  }

  async function handleChangedAnswer(request) {
    await batchSend({
      args: [request.questionId, request.requester],
      method: homeProxy.methods.handleChangedAnswer,
      to: homeProxy.options.address,
    });
    return request;
  }

  async function handleFinalizedQuestion(request) {
    await batchSend({
      args: [request.questionId, request.requester],
      method: homeProxy.methods.handleFinalizedQuestion,
      to: homeProxy.options.address,
    });
    return request;
  }

  async function handleRejectedRequest(request) {
    await batchSend({
      args: [request.questionId, request.requester],
      method: homeProxy.methods.handleRejectedRequest,
      to: homeProxy.options.address,
    });
    return request;
  }

  async function reportArbitrationAnswer(request) {
    const { questionId } = request;
    const { historyHash, answerOrCommitmentID, answerer } = await _getLatestAnswerParams(questionId);

    await batchSend({
      args: [questionId, historyHash, answerOrCommitmentID, answerer],
      method: homeProxy.methods.reportArbitrationAnswer,
      to: homeProxy.options.address,
    });
    return request;
  }

  async function _getLatestAnswerParams(questionId) {
    const answers = await getPastEvents(realitio, "LogNewAnswer", {
      filter: {
        question_id: questionId,
      },
    });

    if (answers.length == 0) {
      throw new Error(`Question ${questionId} was never answered`);
    }

    const byMostRecentBlock = descend(prop("blockNumber"));
    const sortedAnswers = sort(byMostRecentBlock, answers);

    const latestAnswer = sortedAnswers[0].returnValues;
    const previousAnswer = sortedAnswers[1]?.returnValues;

    return {
      historyHash: previousAnswer?.history_hash ?? ZERO_HASH,
      answerOrCommitmentID: latestAnswer.answer,
      answerer: latestAnswer.user,
    };
  }

  return {
    getBlockNumber,
    getChainId,
    getNotifiedRequests,
    getRejectedRequests,
    getRequest,
    handleChangedAnswer,
    handleFinalizedQuestion,
    handleNotifiedRequest,
    handleRejectedRequest,
    reportArbitrationAnswer,
  };
}
