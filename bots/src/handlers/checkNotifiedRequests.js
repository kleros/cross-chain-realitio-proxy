import { andThen, cond, filter, map, pick, pipeWith, reduceBy } from "ramda";
import deepMerge from "deepmerge";
import { getBlockHeight, updateBlockHeight } from "~/off-chain-storage/chainMetadata";
import { fetchRequestsByChainIdAndStatus, saveRequests, updateRequest } from "~/off-chain-storage/requests";
import { Status } from "~/on-chain-api/home-chain/entities";
import * as P from "~/shared/promise";

const asyncPipe = pipeWith((f, res) => andThen(f, P.resolve(res)));

const mergeOnChainOntoOffChain = ([offChainRequest, onChainRequest]) => deepMerge(offChainRequest, onChainRequest);

export default async function checkNotifiedRequests({ homeChainApi }) {
  const chainId = await homeChainApi.getChainId();

  await checkUntrackedNotifiedRequests();
  await checkCurrentNotifiedRequests();

  async function checkUntrackedNotifiedRequests() {
    const [fromBlock, toBlock] = await P.all([getBlockHeight("NOTIFIED_REQUESTS"), homeChainApi.getBlockNumber()]);

    const untrackedNotifiedRequests = filter(
      ({ status }) => status !== Status.None,
      await homeChainApi.getNotifiedRequests({ fromBlock, toBlock })
    );

    await saveRequests(untrackedNotifiedRequests);

    const blockHeight = toBlock + 1;
    await updateBlockHeight({ key: "NOTIFIED_REQUESTS", blockHeight });
    console.info({ blockHeight }, "Set NOTIFIED_REQUESTS block height");

    const stats = {
      data: map(pick(["questionId", "chainId", "status"]), untrackedNotifiedRequests),
      fromBlock,
      toBlock,
    };

    console.info(stats, "Found new notified arbitration requests");

    return stats;
  }

  async function checkCurrentNotifiedRequests() {
    const requestNotified = ([_, onChainArbitration]) => onChainArbitration.status === Status.Notified;
    const handleNotifiedRequest = asyncPipe([
      mergeOnChainOntoOffChain,
      homeChainApi.handleNotifiedRequest,
      (request) => ({
        action: "NOTIFIED_REQUEST_HANDLED",
        payload: request,
      }),
    ]);

    const requestStatusChanged = ([offChainRequest, onChainRequest]) => offChainRequest.status != onChainRequest.status;
    const updateOffChainRequest = asyncPipe([
      mergeOnChainOntoOffChain,
      updateRequest,
      (request) => ({
        action: "STATUS_CHANGED",
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
        [requestNotified, handleNotifiedRequest],
        [requestStatusChanged, updateOffChainRequest],
        [() => true, noop],
      ]),
    ]);

    const notifiedRequests = await fetchRequestsByChainIdAndStatus({ status: Status.Notified, chainId });

    console.info({ data: map(pick(["questionId", "requester"]), notifiedRequests) }, "Fetched notified requests");

    const results = await P.allSettled(map(pipeline, notifiedRequests));

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

    console.info(stats, "Processed notified requests");

    return stats;
  }

  async function fetchOnChainCounterpart(offChainRequest) {
    const { questionId, requester } = offChainRequest;

    const onChainRequest = await homeChainApi.getRequest({ questionId, requester });

    return [offChainRequest, onChainRequest];
  }
}
