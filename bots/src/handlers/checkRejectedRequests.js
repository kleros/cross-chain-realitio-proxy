import deepMerge from "deepmerge";
import { andThen, cond, filter, map, pick, pipeWith, reduceBy } from "ramda";
import { getBlockHeight, updateBlockHeight } from "~/off-chain-storage/chainMetadata";
import { fetchRequestsByChainIdAndStatus, removeRequest, saveRequests } from "~/off-chain-storage/requests";
import { Status } from "~/on-chain-api/home-chain/entities";
import * as P from "~/shared/promise";

const asyncPipe = pipeWith((f, res) => andThen(f, P.resolve(res)));

const mergeOnChainOntoOffChain = ([offChainRequest, onChainRequest]) => deepMerge(offChainRequest, onChainRequest);

export default async function checkRejectedRequests({ homeChainApi }) {
  const chainId = await homeChainApi.getChainId();

  await checkUntrackedRejectedRequests();
  await checkCurrentRejectedRequests();

  async function checkUntrackedRejectedRequests() {
    const [fromBlock, toBlock] = await Promise.all([
      getBlockHeight("REJECTED_REQUESTS"),
      homeChainApi.getBlockNumber(),
    ]);

    const untrackedRejectedRequests = filter(
      ({ status }) => status === Status.Rejected,
      await homeChainApi.getRejectedRequests({ fromBlock, toBlock })
    );

    await saveRequests(untrackedRejectedRequests);

    const blockHeight = toBlock + 1;
    await updateBlockHeight({ key: "REJECTED_REQUESTS", blockHeight });
    console.info({ blockHeight }, "Set REJECTED_REQUESTS block height");

    const stats = {
      data: map(pick(["questionId", "contestedAnswer"]), untrackedRejectedRequests),
      fromBlock,
      toBlock,
    };

    console.info(stats, "Found new rejected arbitration requests");

    return stats;
  }

  async function checkCurrentRejectedRequests() {
    const requestRemoved = ([_, onChainArbitration]) => onChainArbitration.status === Status.None;
    const removeOffChainRequest = asyncPipe([
      mergeOnChainOntoOffChain,
      removeRequest,
      (arbitration) => ({
        action: "REQUEST_REMOVED",
        payload: arbitration,
      }),
    ]);

    const requestRejected = ([_, onChainArbitration]) => onChainArbitration.status === Status.Rejected;
    const handleRejectedRequest = asyncPipe([
      mergeOnChainOntoOffChain,
      homeChainApi.handleRejectedRequest,
      (request) => ({
        action: "REJECTED_REQUEST_HANDLED",
        payload: request,
      }),
    ]);

    const noop = asyncPipe([
      mergeOnChainOntoOffChain,
      (request) => ({
        action: "NO_OP",
        payload: request,
      }),
    ]);

    const pipeline = asyncPipe([
      fetchOnChainCounterpart,
      cond([
        [requestRemoved, removeOffChainRequest],
        [requestRejected, handleRejectedRequest],
        [() => true, noop],
      ]),
    ]);

    const rejectedRequests = await fetchRequestsByChainIdAndStatus({ chainId, status: Status.Rejected });

    console.info({ data: map(pick(["questionId", "contestedAnswer"]), rejectedRequests) }, "Fetched rejected requests");

    const results = await P.allSettled(map(pipeline, rejectedRequests));

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

    console.info(stats, "Processed rejected requests");

    return stats;
  }

  async function fetchOnChainCounterpart(offChainRequest) {
    const { questionId, contestedAnswer } = offChainRequest;

    const onChainRequest = await homeChainApi.getRequest({ questionId, contestedAnswer });

    return [offChainRequest, onChainRequest];
  }
}
