import { andThen, cond, map, pick, pipeWith, reduceBy } from "ramda";
import deepMerge from "deepmerge";
import { getBlockHeight, updateBlockHeight } from "~/off-chain-storage/chainMetadata";
import { fetchRequestsByChainIdAndStatus, saveRequests, updateRequest } from "~/off-chain-storage/requests";
import { Status } from "~/on-chain-api/home-chain/entities";
import * as P from "~/shared/promise";

const asyncPipe = pipeWith((f, res) => andThen(f, P.resolve(res)));

const mergeOnChainOntoOffChain = ([offChainRequest, onChainRequest]) => deepMerge(offChainRequest, onChainRequest);

export default async function checkNotifiedRequests({ homeChainApi }) {
  const chainId = await homeChainApi.getChainId();

  await checkNewNotifiedRequests();
  await checkCurrentNotifiedRequests();

  async function checkNewNotifiedRequests() {
    const [fromBlock, toBlock] = await P.all([getBlockHeight("NOTIFIED_REQUESTS"), homeChainApi.getBlockNumber()]);

    const newRequests = await homeChainApi.getNotifiedRequests({ fromBlock, toBlock });

    await saveRequests(newRequests);

    const blockHeight = toBlock + 1;
    await updateBlockHeight({ key: "NOTIFIED_REQUESTS", blockHeight });
    console.info({ blockHeight }, "Set NOTIFIED_REQUESTS block height");

    const stats = {
      data: map(pick(["questionId", "chainId", "status"]), newRequests),
      fromBlock,
      toBlock,
    };

    console.info(stats, "Found new notified arbitration requests");

    return stats;
  }

  async function checkCurrentNotifiedRequests() {
    const requestStatusChanged = ([offChainRequest, onChainRequest]) => offChainRequest.status != onChainRequest.status;
    const updateOffChainRequest = asyncPipe([
      mergeOnChainOntoOffChain,
      updateRequest,
      (request) => ({
        action: "STATUS_CHANGED",
        payload: request,
      }),
    ]);

    const requestNotified = ([_, onChainArbitration]) => onChainArbitration.status === Status.Notified;
    const handleNotifiedRequest = asyncPipe([
      mergeOnChainOntoOffChain,
      homeChainApi.handleNotifiedRequest,
      (request) => ({
        action: "NOTIFIED_REQUEST_HANDLED",
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
        [requestStatusChanged, updateOffChainRequest],
        [requestNotified, handleNotifiedRequest],
        [() => true, noop],
      ]),
    ]);

    const notifiedRequests = await fetchRequestsByChainIdAndStatus({ status: Status.Notified, chainId });

    console.info({ data: map(pick(["questionId", "contestedAnswer"]), notifiedRequests) }, "Fetched notified requests");

    const results = await P.allSettled(map(pipeline, notifiedRequests));

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

    console.info(stats, "Processed notified requests");

    return stats;
  }

  async function fetchOnChainCounterpart(offChainRequest) {
    const { questionId, contestedAnswer } = offChainRequest;

    const onChainRequest = await homeChainApi.getRequest({ questionId, contestedAnswer });

    return [offChainRequest, onChainRequest];
  }
}
