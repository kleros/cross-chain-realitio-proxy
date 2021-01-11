import checkArbitrationAnswersHandler from "./handlers/checkArbitrationAnswers";
import checkNotifiedRequestsHandler from "./handlers/checkNotifiedRequests";
import checkRejectedRequestsHandler from "./handlers/checkRejectedRequests";
import checkAcceptedArbitrationRequestsHandler from "./handlers/checkAcceptedArbitrationRequests";
import createHomeChainApi from "./on-chain-api/home-chain/createApiInstance";
import createForeignChainApi from "./on-chain-api/foreign-chain/createApiInstance";

export async function checkNotifiedRequests() {
  await checkNotifiedRequestsHandler({ homeChainApi: await createHomeChainApi() });
}

export async function checkRejectedRequests() {
  await checkRejectedRequestsHandler({ homeChainApi: await createHomeChainApi() });
}

export async function checkArbitrationAnswers() {
  await checkArbitrationAnswersHandler({ homeChainApi: await createHomeChainApi() });
}

export async function checkAcceptedArbitrationRequests() {
  await checkAcceptedArbitrationRequestsHandler({ foreignChainApi: await createForeignChainApi() });
}
