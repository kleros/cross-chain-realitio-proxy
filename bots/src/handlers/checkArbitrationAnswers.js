import {andThen, cond, map, pipeWith, prop, reduceBy} from "ramda";
import {fetchRequestsByChainId, updateRequest, removeRequest} from "~/off-chain-storage/requests";
import {Status} from "~/on-chain-api/home-chain/entities";
import * as P from "~/shared/promise";

const asyncPipe = pipeWith((f, res) => andThen(f, P.resolve(res)));

export default async function checkArbitrationAnswers({homeChainApi}) {
  const chainId = await homeChainApi.getChainId();

  async function fetchOnChainCounterpart(offChainRequest) {
    const {questionId} = offChainRequest;

    const onChainRequest = await homeChainApi.getRequestByQuestionId(questionId);

    return [offChainRequest, onChainRequest];
  }

  const requestRemoved = ([_, onChainRequest]) => onChainRequest.status === Status.None;
  const removeOffChainRequest = asyncPipe([
    ([_, onChainRequest]) => onChainRequest,
    removeRequest,
    (request) => ({
      action: "REQUEST_REMOVED",
      payload: request,
    }),
  ]);

  const requestStatusChanged = ([_, onChainArbitration]) => onChainArbitration.status === Status.Ruled;
  const reportArbitrationAnswer = asyncPipe([
    ([_, onChainRequest]) => onChainRequest,
    homeChainApi.reportArbitrationAnswer,
    (request) => ({
      action: "ARBITRATION_ANSWER_REPORTED",
      payload: request,
    }),
  ]);

  const requestRuled = ([offChainArbitration, onChainArbitration]) =>
    offChainArbitration.status != onChainArbitration.status;
  const updateOffChainRequest = asyncPipe([
    ([_, onChainArbitration]) => onChainArbitration,
    updateRequest,
    (arbitration) => ({
      action: "STATUS_CHANGED",
      payload: arbitration,
    }),
  ]);

  const noop = asyncPipe([
    ([_, onChainArbitration]) => onChainArbitration,
    (arbtration) => ({
      action: "NO_OP",
      payload: arbtration,
    }),
  ]);

  const requestsWithRuling = await fetchRequestsByChainId({status: Status.Ruled, chainId});

  console.info(
    {data: map(prop("questionId"), requestsWithRuling)},
    "Fetched requests which received the arbitration ruling"
  );

  const pipeline = asyncPipe([
    fetchOnChainCounterpart,
    cond([
      [requestRemoved, removeOffChainRequest],
      [requestRuled, reportArbitrationAnswer],
      [requestStatusChanged, updateOffChainRequest],
      [() => true, noop],
    ]),
  ]);

  const results = await P.allSettled(map(pipeline, requestsWithRuling));

  const groupQuestionIdsOrErrorMessage = (acc, r) => {
    if (r.status === "rejected") {
      return [...acc, r.reason?.message];
    }

    const questionId = r.value?.payload?.questionId ?? "<not set>";
    return [...acc, questionId];
  };
  const toTag = (r) => (r.status === "rejected" ? "FAILURE" : r.value?.action);
  const stats = reduceBy(groupQuestionIdsOrErrorMessage, [], toTag, results);

  console.info(stats, "Processed requests with ruling");
}
