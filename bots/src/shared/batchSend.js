import doCreateBatchSend from "web3-batched-send";
import {getDefaultAccount} from "./account";

const DEBOUNCE_PERIOD = 10000; // milliseconds

export async function createBatchSend(web3, batcherContractAddress) {
  const account = await getDefaultAccount(web3);
  return doCreateBatchSend(web3, batcherContractAddress, account.privateKey, DEBOUNCE_PERIOD);
}
