import { andThen, cond, map, pick, pipeWith, reduceBy } from "ramda";
import deepMerge from "deepmerge";
import { fetchRequestsByChainId, updateRequest, removeRequest } from "~/off-chain-storage/requests";
import { Status } from "~/on-chain-api/home-chain/entities";
import * as P from "~/shared/promise";

const asyncPipe = pipeWith((f, res) => andThen(f, P.resolve(res)));

const mergeOnChainOntoOffChain = ([offChainRequest, onChainRequest]) => deepMerge(offChainRequest, onChainRequest);

export default async function checkArbitrationAnswers({ homeChainApi }) {
  const chainId = await homeChainApi.getChainId();

  async function fetchOnChainCounterpart(offChainRequest) {
    const { questionId, contestedAnswer } = offChainRequest;

    const onChainRequest = await homeChainApi.getRequest({ questionId, contestedAnswer });

    return [offChainRequest, onChainRequest];
  }

  const requestFinishedOrCanceled = ([_, onChainRequest]) =>
    [Status.None, Status.Finished].includes(onChainRequest.status);
  const removeOffChainRequest = asyncPipe([
    mergeOnChainOntoOffChain,
    removeRequest,
    (request) => ({
      action: "OFF_CHAIN_REQUEST_REMOVED",
      payload: request,
    }),
  ]);

  const requestRuled = ([_, onChainArbitration]) => onChainArbitration.status === Status.Ruled;
  const reportArbitrationAnswer = asyncPipe([
    mergeOnChainOntoOffChain,
    homeChainApi.reportArbitrationAnswer,
    (request) => ({
      action: "ARBITRATION_ANSWER_REPORTED",
      payload: request,
    }),
  ]);

  const requestStatusChanged = ([offChainArbitration, onChainArbitration]) =>
    offChainArbitration.status != onChainArbitration.status;
  const updateOffChainRequest = asyncPipe([
    mergeOnChainOntoOffChain,
    updateRequest,
    (arbitration) => ({
      action: "STATUS_CHANGED",
      payload: arbitration,
    }),
  ]);

  const noop = asyncPipe([
    mergeOnChainOntoOffChain,
    (arbtration) => ({
      action: "NO_OP",
      payload: arbtration,
    }),
  ]);

  const requestsWithRuling = await fetchRequestsByChainId({ status: Status.Ruled, chainId });

  console.info(
    { data: map(pick(["questionId", "contestedAnswer"]), requestsWithRuling) },
    "Fetched requests which received the arbitration ruling"
  );

  const pipeline = asyncPipe([
    fetchOnChainCounterpart,
    cond([
      [requestFinishedOrCanceled, removeOffChainRequest],
      [requestRuled, reportArbitrationAnswer],
      [requestStatusChanged, updateOffChainRequest],
      [() => true, noop],
    ]),
  ]);

  const results = await P.allSettled(map(pipeline, requestsWithRuling));

  const groupQuestionsOrErrorMessage = (acc, r) => {
    if (r.status === "rejected") {
      return [...acc, r.reason?.message];
    }

    const questionId = r.value?.payload?.questionId ?? "<not set>";
    const contestedAnswer = r.value?.payload?.contestedAnswer ?? "<not set>";
    return [...acc, { questionId, contestedAnswer }];
  };
  const toTag = (r) => (r.status === "rejected" ? "FAILURE" : r.value?.action);
  const stats = reduceBy(groupQuestionsOrErrorMessage, [], toTag, results);

  console.info(stats, "Processed requests with ruling");
}
