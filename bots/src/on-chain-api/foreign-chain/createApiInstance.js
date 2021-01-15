import ForeignProxy from "@kleros/cross-chain-realitio-contracts/artifacts/src/RealitioForeignArbitrationProxy.sol/RealitioForeignArbitrationProxy.json";
import { compose, filter, into, map, path, prop, propEq } from "ramda";
import { createBatchSend } from "~/shared/batchSend";
import { getContract } from "~/shared/contract";
import { getPastEvents } from "~/shared/events";
import * as P from "~/shared/promise";
import { foreignWeb3 as web3 } from "~/shared/web3";

const FOREIGN_TX_BATCHER_CONTRACT_ADDRESS = process.env.FOREIGN_TX_BATCHER_CONTRACT_ADDRESS;

export default async function createApiInstance() {
  const [batchSend, foreignProxy] = await Promise.all([
    createBatchSend(web3, FOREIGN_TX_BATCHER_CONTRACT_ADDRESS),
    getContract(web3, ForeignProxy.abi, process.env.FOREIGN_PROXY_CONTRACT_ADDRESS),
  ]);

  async function getBlockNumber() {
    return Number(await web3.eth.getBlockNumber());
  }

  async function getChainId() {
    return Number(await web3.eth.getChainId());
  }

  async function getArbitrationRequest({ questionId, contestedAnswer }) {
    const [arbitration, chainId] = await P.all([
      foreignProxy.methods.arbitrationRequests(questionId, contestedAnswer).call(),
      getChainId(),
    ]);

    return {
      ...arbitration,
      chainId,
      questionId,
      contestedAnswer,
      status: Number(arbitration.status),
    };
  }

  async function getRequestedArbitrations({ fromBlock = 0, toBlock = "latest" } = {}) {
    const events = await getPastEvents(foreignProxy, "ArbitrationRequested", { fromBlock, toBlock });

    const allNotifiedRequests = await P.allSettled(
      map(
        ({ returnValues }) =>
          getArbitrationRequest({
            questionId: returnValues._questionID,
            contestedAnswer: returnValues._contestedAnswer,
          }),
        events
      )
    );
    const onlyFulfilled = compose(filter(propEq("status", "fulfilled")), map(prop("value")));

    return into([], onlyFulfilled, allNotifiedRequests);
  }

  async function handleFailedDisputeCreation(arbitration) {
    await batchSend({
      args: [arbitration.questionId, arbitration.contestedAnswer],
      method: foreignProxy.methods.handleFailedDisputeCreation,
      to: foreignProxy.options.address,
    });
    return arbitration;
  }

  return {
    getChainId,
    getBlockNumber,
    getArbitrationRequest,
    getRequestedArbitrations,
    handleFailedDisputeCreation,
  };
}
