import checkArbitrationAnswersHandler from "./handlers/checkArbitrationAnswers";
import checkNotifiedRequestsHandler from "./handlers/checkNotifiedRequests";
import checkPendingRequestsHandler from "./handlers/checkPendingRequests";
import checkRequestedArbitrationsHandler from "./handlers/checkRequestedArbitrations";
import createHomeChainApi from "./on-chain-api/home-chain/createApiInstance";
import createForeignChainApi from "./on-chain-api/foreign-chain/createApiInstance";

export async function checkNotifiedRequests() {
  await checkNotifiedRequestsHandler({homeChainApi: await createHomeChainApi()});
}

export async function checkPendingRequests() {
  await checkPendingRequestsHandler({homeChainApi: await createHomeChainApi()});
}

export async function checkArbitrationAnswers() {
  await checkArbitrationAnswersHandler({homeChainApi: await createHomeChainApi()});
}

export async function checkRequestedArbitrations() {
  await checkRequestedArbitrationsHandler({foreignChainApi: await createForeignChainApi()});
}
