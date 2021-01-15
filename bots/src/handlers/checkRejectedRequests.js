import { andThen, cond, map, pick, pipeWith, reduceBy } from "ramda";
import { getBlockHeight, removeRequest, updateBlockHeight } from "~/off-chain-storage/chainMetadata";
import { fetchRequestsByChainIdAndStatus, saveRequests, updateRequest } from "~/off-chain-storage/requests";
import { Status } from "~/on-chain-api/home-chain/entities";
import * as P from "~/shared/promise";

const asyncPipe = pipeWith((f, res) => andThen(f, P.resolve(res)));

export default async function checkRejectedRequests({ homeChainApi }) {
  const chainId = await homeChainApi.getChainId();

  await checkNewRejectedRequests();
  await checkCurrentRejectedRequests();

  async function checkNewRejectedRequests() {
    const [fromBlock, toBlock] = await Promise.all([
      getBlockHeight("REJECTED_REQUESTS"),
      homeChainApi.getBlockNumber(),
    ]);

    const newRequests = await homeChainApi.getRejectedRequests({ fromBlock, toBlock });

    await saveRequests(newRequests);

    const blockHeight = toBlock + 1;
    await updateBlockHeight({ key: "REJECTED_REQUESTS", blockHeight });
    console.info({ blockHeight }, "Set REJECTED_REQUESTS block height");

    const stats = {
      data: map(pick(["questionId", "chainId", "status"]), newRequests),
      fromBlock,
      toBlock,
    };

    console.info(stats, "Found new rejected arbitration requests");

    return stats;
  }

  async function checkCurrentRejectedRequests() {
    const requestRemoved = ([_, onChainArbitration]) => onChainArbitration.status === Status.None;
    const removeOffChainRequest = asyncPipe([
      ([_, onChainArbitration]) => onChainArbitration,
      removeRequest,
      (arbitration) => ({
        action: "REQUEST_REMOVED",
        payload: arbitration,
      }),
    ]);

    const requestStatusChanged = ([offChainRequest, onChainRequest]) => offChainRequest.status != onChainRequest.status;
    const updateOffChainRequest = asyncPipe([
      ([_, onChainRequest]) => onChainRequest,
      updateRequest,
      (request) => ({
        action: "STATUS_CHANGED",
        payload: request,
      }),
    ]);

    const handleRejectedRequest = asyncPipe([
      ([_, onChainRequest]) => onChainRequest,
      homeChainApi.handleRejectedRequest,
      (request) => ({
        action: "REJECTED_REQUEST_HANDLED",
        payload: request,
      }),
    ]);

    const pipeline = asyncPipe([
      fetchOnChainCounterpart,
      cond([
        [requestRemoved, removeOffChainRequest],
        [requestStatusChanged, updateOffChainRequest],
        [() => true, handleRejectedRequest],
      ]),
    ]);

    const rejectedRequests = await fetchRequestsByChainIdAndStatus({ status: Status.Rejected, chainId });

    console.info({ data: map(pick(["questionId", "contestedAnswer"]), rejectedRequests) }, "Fetched rejected requests");

    const results = await P.allSettled(map(pipeline, rejectedRequests));

    const groupQuestionIdsOrErrorMessage = (acc, r) => {
      if (r.status === "rejected") {
        return [...acc, r.reason?.message];
      }

      const questionId = r.value?.payload?.questionId ?? "<not set>";
      return [...acc, questionId];
    };
    const toTag = (r) => (r.status === "rejected" ? "FAILURE" : r.value?.action);
    const stats = reduceBy(groupQuestionIdsOrErrorMessage, [], toTag, results);

    console.info(stats, "Processed rejected requests");

    return stats;
  }

  async function fetchOnChainCounterpart(offChainRequest) {
    const { questionId } = offChainRequest;

    const onChainRequest = await homeChainApi.getRequestByQuestionId(questionId);

    return [offChainRequest, onChainRequest];
  }
}
