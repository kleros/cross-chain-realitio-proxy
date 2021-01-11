import { andThen, cond, map, pick, pipeWith, prop, reduceBy } from "ramda";
import { getBlockHeight, updateBlockHeight } from "~/off-chain-storage/chainMetadata";
import { fetchRequestsByChainId, removeRequest, saveRequests, updateRequest } from "~/off-chain-storage/requests";
import { Status } from "~/on-chain-api/foreign-chain/entities";
import * as P from "~/shared/promise";

const asyncPipe = pipeWith((f, res) => andThen(f, P.resolve(res)));

export default async function checkAcceptedArbitrationRequests({ foreignChainApi }) {
  const chainId = await foreignChainApi.getChainId();

  await checkNewRequestedArbitrations();
  await processArbitrationRequests();

  async function checkNewRequestedArbitrations() {
    const [fromBlock, toBlock] = await P.all([
      getBlockHeight("ACCEPTED_ARBITRATION_REQUESTS"),
      foreignChainApi.getBlockNumber(),
    ]);

    const newArbitrationRequests = await foreignChainApi.getRequestedArbitrations({ fromBlock, toBlock });

    await saveRequests(newArbitrationRequests);

    const blockHeight = toBlock + 1;
    await updateBlockHeight({ key: "ACCEPTED_ARBITRATION_REQUESTS", blockHeight });
    console.info({ blockHeight }, "Set ACCEPTED_ARBITRATION_REQUESTS block height");

    const stats = {
      data: map(pick(["questionId", "chainId", "status"]), newArbitrationRequests),
      fromBlock,
      toBlock,
    };

    console.info(stats, "Found new notified arbitration requests");

    return stats;
  }

  async function processArbitrationRequests() {
    const requestRemoved = ([_, onChainArbitration]) => onChainArbitration.status === Status.None;
    const removeOffChainRequest = asyncPipe([
      ([_, onChainArbitration]) => onChainArbitration,
      removeRequest,
      (arbitration) => ({
        action: "ARBITRATION_REQUEST_REMOVED",
        payload: arbitration,
      }),
    ]);

    const disputeCreationFailed = ([_, onChainArbitration]) => onChainArbitration.status === Status.Failed;
    const handleFailedDisputeCreation = asyncPipe([
      ([_, onChainArbitration]) => onChainArbitration,
      foreignChainApi.handleFailedDisputeCreation,
      (arbitration) => ({
        action: "FAILED_DISPUTE_CREATION_HANDLED",
        payload: arbitration,
      }),
    ]);

    const requestStatusChanged = ([offChainArbitration, onChainArbitration]) =>
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

    const pipeline = asyncPipe([
      fetchOnChainCounterpart,
      cond([
        [requestRemoved, removeOffChainRequest],
        [disputeCreationFailed, handleFailedDisputeCreation],
        [requestStatusChanged, updateOffChainRequest],
        [() => true, noop],
      ]),
    ]);

    const requestedArbitrations = await fetchRequestsByChainId({ chainId });

    console.info({ data: map(prop("questionId"), requestedArbitrations) }, "Fetched requested arbitrations");

    const results = await P.allSettled(map(pipeline, requestedArbitrations));

    const groupQuestionIdsOrErrorMessage = (acc, r) => {
      if (r.status === "rejected") {
        return [...acc, r.reason?.message];
      }

      const questionId = r.value?.payload?.questionId ?? "<not set>";
      return [...acc, questionId];
    };
    const toTag = (r) => (r.status === "rejected" ? "FAILURE" : r.value?.action);
    const stats = reduceBy(groupQuestionIdsOrErrorMessage, [], toTag, results);

    console.info(stats, "Processed requested arbitrations");

    return stats;
  }

  async function fetchOnChainCounterpart(offChainArbitration) {
    const { questionId } = offChainArbitration;

    const onChainArbitration = await foreignChainApi.getArbitrationByQuestionId(questionId);

    return [offChainArbitration, onChainArbitration];
  }
}
