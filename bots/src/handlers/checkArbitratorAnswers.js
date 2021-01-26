import { andThen, cond, filter, map, pick, pipeWith, reduceBy } from "ramda";
import deepMerge from "deepmerge";
import { fetchRequestsByChainId, saveRequests, removeRequest } from "~/off-chain-storage/requests";
import { getBlockHeight, updateBlockHeight } from "~/off-chain-storage/chainMetadata";
import { Status } from "~/on-chain-api/home-chain/entities";
import * as P from "~/shared/promise";

const asyncPipe = pipeWith((f, res) => andThen(f, P.resolve(res)));

const mergeOnChainOntoOffChain = ([offChainRequest, onChainRequest]) => deepMerge(offChainRequest, onChainRequest);

export default async function checkArbitratorAnswers({ homeChainApi }) {
  const chainId = await homeChainApi.getChainId();

  await checkUntrackedArbitratorAnswers();
  await checkCurrentArbitratorAnswers();

  async function checkUntrackedArbitratorAnswers() {
    const [fromBlock, toBlock] = await P.all([getBlockHeight("RULED_REQUESTS"), homeChainApi.getBlockNumber()]);

    const untrackedNotifiedRequests = filter(
      ({ status }) => [Status.AwaitingRuling, Status.Ruled].includes(status),
      await homeChainApi.getNotifiedRequests({ fromBlock, toBlock })
    );

    await saveRequests(untrackedNotifiedRequests);

    const blockHeight = toBlock + 1;
    await updateBlockHeight({ key: "RULED_REQUESTS", blockHeight });
    console.info({ blockHeight }, "Set RULED_REQUESTS block height");

    const stats = {
      data: map(pick(["questionId", "chainId"]), untrackedNotifiedRequests),
      fromBlock,
      toBlock,
    };

    console.info(stats, "Found new requests with arbitrator answers");

    return stats;
  }

  async function checkCurrentArbitratorAnswers() {
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

    const noop = asyncPipe([
      mergeOnChainOntoOffChain,
      (arbtration) => ({
        action: "NO_OP",
        payload: arbtration,
      }),
    ]);

    const requestsWithRuling = await fetchRequestsByChainId({ status: Status.Ruled, chainId });

    console.info(
      { data: map(pick(["questionId", "requester"]), requestsWithRuling) },
      "Fetched requests which received the arbitration ruling"
    );

    const pipeline = asyncPipe([
      fetchOnChainCounterpart,
      cond([
        [requestFinishedOrCanceled, removeOffChainRequest],
        [requestRuled, reportArbitrationAnswer],
        [() => true, noop],
      ]),
    ]);

    const results = await P.allSettled(map(pipeline, requestsWithRuling));

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

    console.info(stats, "Processed requests with ruling");
  }

  async function fetchOnChainCounterpart(offChainRequest) {
    const { questionId, requester } = offChainRequest;

    const onChainRequest = await homeChainApi.getRequest({ questionId, requester });

    return [offChainRequest, onChainRequest];
  }
}
