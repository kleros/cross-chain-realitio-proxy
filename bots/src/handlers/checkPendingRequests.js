import {andThen, cond, map, mergeRight, pick, pipeWith, prop, reduceBy} from "ramda";
import {getBlockHeight, updateBlockHeight} from "~/off-chain-storage/chainMetadata";
import {fetchRequestsByChainIdAndStatus, saveRequests, updateRequest} from "~/off-chain-storage/requests";
import {Status} from "~/on-chain-api/home-chain/entities";
import * as P from "~/shared/promise";

const asyncPipe = pipeWith((f, res) => andThen(f, P.resolve(res)));

export default async function checkPendingRequests({homeChainApi}) {
  const chainId = await homeChainApi.getChainId();

  await checkNewPendingRequests();
  await checkCurrentPendingRequests();

  async function checkNewPendingRequests() {
    const [fromBlock, toBlock] = await Promise.all([getBlockHeight("PENDING_REQUESTS"), homeChainApi.getBlockNumber()]);

    const newRequests = await homeChainApi.getPendingRequests({fromBlock, toBlock});

    await saveRequests(newRequests);

    const blockHeight = toBlock + 1;
    await updateBlockHeight({key: "PENDING_REQUESTS", blockHeight});
    console.info({blockHeight}, "Set PENDING_REQUESTS block height");

    const stats = {
      data: map(pick(["questionId", "chainId", "status"]), newRequests),
      fromBlock,
      toBlock,
    };

    console.info(stats, "Found new pending arbitration requests");

    return stats;
  }

  async function checkCurrentPendingRequests() {
    const requestStatusChanged = ([offChainRequest, onChainRequest]) => offChainRequest.status != onChainRequest.status;
    const updateOffChainRequest = asyncPipe([
      ([_, onChainRequest]) => onChainRequest,
      updateRequest,
      (request) => ({
        action: "STATUS_CHANGED",
        payload: request,
      }),
    ]);

    const questionFinalized = ([_, onChainRequest]) => onChainRequest.question.isFinalized === true;
    const handleFinalizedQuestion = asyncPipe([
      ([_, onChainRequest]) => onChainRequest,
      homeChainApi.handleFinalizedQuestion,
      (request) => ({
        action: "FINALIZED_QUESTION_HANDLED",
        payload: request,
      }),
    ]);

    const answerChanged = ([_, onChainRequest]) =>
      onChainRequest.requesterAnswer !== onChainRequest.question.bestAnswer;
    const handleChangedAnswer = asyncPipe([
      ([_, onChainRequest]) => onChainRequest,
      homeChainApi.handleChangedAnswer,
      (request) => ({
        action: "CHANGED_ANSWER_HANDLED",
        payload: request,
      }),
    ]);

    const noop = asyncPipe([
      ([_, onChainRequest]) => onChainRequest,
      (request) => ({
        action: "NO_OP",
        payload: request,
      }),
    ]);

    const pipeline = asyncPipe([
      fetchOnChainCounterpart,
      cond([
        [requestStatusChanged, updateOffChainRequest],
        [questionFinalized, handleFinalizedQuestion],
        [answerChanged, handleChangedAnswer],
        [() => true, noop],
      ]),
    ]);

    const pendingRequests = await fetchRequestsByChainIdAndStatus({status: Status.Pending, chainId});

    console.info({data: map(prop("questionId"), pendingRequests)}, "Fetched pending requests");

    const results = await P.allSettled(map(pipeline, pendingRequests));

    const groupQuestionIdsOrErrorMessage = (acc, r) => {
      if (r.status === "rejected") {
        return [...acc, r.reason?.message];
      }

      const questionId = r.value?.payload?.questionId ?? "<not set>";
      return [...acc, questionId];
    };
    const toTag = (r) => (r.status === "rejected" ? "FAILURE" : r.value?.action);
    const stats = reduceBy(groupQuestionIdsOrErrorMessage, [], toTag, results);

    console.info(stats, "Processed pending requests");

    return stats;
  }

  async function fetchOnChainCounterpart(offChainRequest) {
    const {questionId} = offChainRequest;

    const [onChainRequest, details] = await P.all([
      homeChainApi.getRequestByQuestionId(questionId),
      homeChainApi.getPendingRequestDetails(questionId),
    ]);

    return [offChainRequest, mergeRight(onChainRequest, details)];
  }
}
