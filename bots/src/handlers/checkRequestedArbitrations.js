import { andThen, cond, filter, map, pick, pipeWith, reduceBy } from "ramda";
import deepMerge from "deepmerge";
import { getBlockHeight, updateBlockHeight } from "~/off-chain-storage/chainMetadata";
import { fetchRequestsByChainId, removeRequest, saveRequests, updateRequest } from "~/off-chain-storage/requests";
import { Status } from "~/on-chain-api/foreign-chain/entities";
import * as P from "~/shared/promise";

const asyncPipe = pipeWith((f, res) => andThen(f, P.resolve(res)));

const mergeOnChainOntoOffChain = ([offChainArbitration, onChainArbitration]) =>
  deepMerge(offChainArbitration, onChainArbitration);

export default async function checkRequestedArbitrations({ foreignChainApi }) {
  const chainId = await foreignChainApi.getChainId();

  await checkUntrackedArbitrationRequests();
  await processArbitrationRequests();

  async function checkUntrackedArbitrationRequests() {
    const [fromBlock, toBlock] = await P.all([
      getBlockHeight("ACCEPTED_ARBITRATION_REQUESTS"),
      foreignChainApi.getBlockNumber(),
    ]);

    const untrackedArbitrationRequests = filter(
      ({ status }) => status !== status.None,
      await foreignChainApi.getRequestedArbitrations({ fromBlock, toBlock })
    );

    await saveRequests(untrackedArbitrationRequests);

    const blockHeight = toBlock + 1;
    await updateBlockHeight({ key: "ACCEPTED_ARBITRATION_REQUESTS", blockHeight });
    console.info({ blockHeight }, "Set ACCEPTED_ARBITRATION_REQUESTS block height");

    const stats = {
      data: map(pick(["questionId", "requester", "chainId", "status"]), untrackedArbitrationRequests),
      fromBlock,
      toBlock,
    };

    console.info(stats, "Found new notified arbitration requests");

    return stats;
  }

  async function processArbitrationRequests() {
    const requestRemovedOrRuled = ([_, onChainArbitration]) =>
      [Status.None, Status.Ruled].includes(onChainArbitration.status);
    const removeOffChainRequest = asyncPipe([
      mergeOnChainOntoOffChain,
      removeRequest,
      (arbitration) => ({
        action: "ARBITRATION_REQUEST_REMOVED",
        payload: arbitration,
      }),
    ]);

    const disputeCreationFailed = ([_, onChainArbitration]) => onChainArbitration.status === Status.Failed;
    const handleFailedDisputeCreation = asyncPipe([
      mergeOnChainOntoOffChain,
      foreignChainApi.handleFailedDisputeCreation,
      (arbitration) => ({
        action: "FAILED_DISPUTE_CREATION_HANDLED",
        payload: arbitration,
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

    const pipeline = asyncPipe([
      fetchOnChainCounterpart,
      cond([
        [requestRemovedOrRuled, removeOffChainRequest],
        [disputeCreationFailed, handleFailedDisputeCreation],
        [requestStatusChanged, updateOffChainRequest],
        [() => true, noop],
      ]),
    ]);

    const requestedArbitrations = await fetchRequestsByChainId({ chainId });

    console.info(
      { data: map(pick(["questionId", "requester"]), requestedArbitrations) },
      "Fetched requested arbitrations"
    );

    const results = await P.allSettled(map(pipeline, requestedArbitrations));

    const groupQuestionsOrErrorMessage = (acc, r) => {
      if (r.status === "rejected") {
        return [...acc, r.reason?.message];
      }

      const questionId = r.value?.payload?.questionId ?? "<not set>";
      const requester = r.value?.payload?.requester ?? "<not set>";
      return [...acc, { questionId, requester }];
    };
    const toTag = (r) => (r.status === "rejected" ? "FAILURE" : r.value?.action);
    const stats = reduceBy(groupQuestionsOrErrorMessage, [], toTag, results);

    console.info(stats, "Processed requested arbitrations");

    return stats;
  }

  async function fetchOnChainCounterpart(offChainArbitration) {
    const { questionId, requester } = offChainArbitration;

    const onChainArbitration = await foreignChainApi.getArbitrationRequest({ questionId, requester });

    return [offChainArbitration, onChainArbitration];
  }
}
