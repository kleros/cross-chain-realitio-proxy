import checkArbitratorAnswersHandler from "./handlers/checkArbitratorAnswers";
import checkNotifiedRequestsHandler from "./handlers/checkNotifiedRequests";
import checkRejectedRequestsHandler from "./handlers/checkRejectedRequests";
import checkRequestedArbitrationsHandler from "./handlers/checkRequestedArbitrations";
import createHomeChainApi from "./on-chain-api/home-chain/createApiInstance";
import createForeignChainApi from "./on-chain-api/foreign-chain/createApiInstance";

export async function checkNotifiedRequests() {
  await checkNotifiedRequestsHandler({ homeChainApi: await createHomeChainApi() });
}

export async function checkRejectedRequests() {
  await checkRejectedRequestsHandler({ homeChainApi: await createHomeChainApi() });
}

export async function checkArbitratorAnswers() {
  await checkArbitratorAnswersHandler({ homeChainApi: await createHomeChainApi() });
}

export async function checkRequestedArbitrations() {
  await checkRequestedArbitrationsHandler({ foreignChainApi: await createForeignChainApi() });
}
