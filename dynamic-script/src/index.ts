import { type RealityQuestionParams, fetchRealityMetaEvidence } from "@kleros/cross-chain-realitio-sdk";

console.log("dynamic-script version", process.env.VERSION);

interface ScriptParameters {
  disputeID: string;
  arbitrableContractAddress: `0x${string}`;
  arbitrableJsonRpcUrl?: string;
  arbitratorJsonRpcUrl?: string;
  jsonRpcUrl?: string;
}

declare const scriptParameters: ScriptParameters;
declare function resolveScript(data: unknown): void;
declare function rejectScript(reason: string): void;

export default async function getMetaEvidence() {
  try {
    const metaEvidence = await fetchRealityMetaEvidence(scriptParameters);
    return resolveScript(metaEvidence);
  } catch (error) {
    return rejectScript(error instanceof Error ? error.message : "Unknown error");
  }
}

export async function generateMetaEvidence(params: RealityQuestionParams) {
  return fetchRealityMetaEvidence(params);
}

export type { RealityQuestionParams };
