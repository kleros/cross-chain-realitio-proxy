import { andThen, cond, map, pick, pipeWith, prop, reduceBy } from "ramda";
import { getBlockHeight, updateBlockHeight } from "~/off-chain-storage/chainMetadata";
import { fetchRequestsByChainIdAndStatus, saveRequests, updateRequest } from "~/off-chain-storage/requests";
import { Status } from "~/on-chain-api/home-chain/entities";
import * as P from "~/shared/promise";

const asyncPipe = pipeWith((f, res) => andThen(f, P.resolve(res)));

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
      ([_, onChainRequest]) => onChainRequest,
      updateRequest,
      (request) => ({
        action: "STATUS_CHANGED",
        payload: request,
      }),
    ]);

    const handleNotifiedRequest = asyncPipe([
      ([_, onChainRequest]) => onChainRequest,
      homeChainApi.handleNotifiedRequest,
      (request) => ({
        action: "NOTIFIED_REQUEST_HANDLED",
        payload: request,
      }),
    ]);

    const pipeline = asyncPipe([
      fetchOnChainCounterpart,
      cond([
        [requestStatusChanged, updateOffChainRequest],
        [() => true, handleNotifiedRequest],
      ]),
    ]);

    const notifiedRequests = await fetchRequestsByChainIdAndStatus({ status: Status.Notified, chainId });

    console.info({ data: map(prop("questionId"), notifiedRequests) }, "Fetched notified requests");

    const results = await P.allSettled(map(pipeline, notifiedRequests));

    const groupQuestionIdsOrErrorMessage = (acc, r) => {
      if (r.status === "rejected") {
        return [...acc, r.reason?.message];
      }

      const questionId = r.value?.payload?.questionId ?? "<not set>";
      return [...acc, questionId];
    };
    const toTag = (r) => (r.status === "rejected" ? "FAILURE" : r.value?.action);
    const stats = reduceBy(groupQuestionIdsOrErrorMessage, [], toTag, results);

    console.info(stats, "Processed notified requests");

    return stats;
  }

  async function fetchOnChainCounterpart(offChainRequest) {
    const { questionId } = offChainRequest;

    const onChainRequest = await homeChainApi.getRequestByQuestionId(questionId);

    return [offChainRequest, onChainRequest];
  }
}
