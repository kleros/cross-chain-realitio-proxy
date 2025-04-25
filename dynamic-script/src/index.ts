import { Buffer } from "node:buffer";
import { type RealityQuestionParams, fetchRealityMetaEvidence } from "@kleros/cross-chain-realitio-sdk";
import process from "./process";

interface ScriptParameters {
  disputeID: string;
  arbitrableContractAddress: `0x${string}`;
  arbitrableJsonRpcUrl?: string;
  arbitratorJsonRpcUrl?: string;
  jsonRpcUrl?: string;
  arbitratorChainID?: string;
  arbitrableChainID?: string;
  chainID?: string;
}

// Declare global functions provided by the test environment
declare global {
  function resolveScript(data: unknown): void;
  function rejectScript(reason: string): void;
  interface Window {
    getMetaEvidence: typeof getMetaEvidence;
  }
}

console.log("dynamic-script version", process.env.VERSION);

function parseScriptParameters(injectedParams?: Partial<ScriptParameters>): ScriptParameters | null {
  const urlParams =
    typeof window !== "undefined" ? Object.fromEntries(new URLSearchParams(window.location.search).entries()) : {};

  // Merge URL parameters with injected parameters, giving priority to injected ones
  const params = {
    ...urlParams,
    ...injectedParams,
  };

  const { disputeID, arbitrableContractAddress, arbitrableJsonRpcUrl, arbitratorJsonRpcUrl, jsonRpcUrl } = params;

  if (!disputeID || !arbitrableContractAddress) return null;

  return {
    disputeID,
    arbitrableContractAddress: arbitrableContractAddress as `0x${string}`,
    arbitrableJsonRpcUrl,
    arbitratorJsonRpcUrl,
    jsonRpcUrl,
  };
}

export default async function getMetaEvidence(injectedParams?: Partial<ScriptParameters>) {
  const scriptParameters = parseScriptParameters(injectedParams);

  if (!scriptParameters) {
    if (typeof rejectScript === "function") {
      rejectScript("Both `disputeID` and `arbitrableContractAddress` parameters are required");
      return;
    }
    throw new Error("Both `disputeID` and `arbitrableContractAddress` parameters are required");
  }

  try {
    const metaEvidence = await fetchRealityMetaEvidence({
      disputeID: scriptParameters.disputeID,
      arbitrableContractAddress: scriptParameters.arbitrableContractAddress,
      arbitrableJsonRpcUrl: scriptParameters.arbitrableJsonRpcUrl,
      arbitratorJsonRpcUrl: scriptParameters.arbitratorJsonRpcUrl,
      jsonRpcUrl: scriptParameters.jsonRpcUrl,
    });

    if (typeof resolveScript === "function") {
      resolveScript(metaEvidence);
      return;
    }
    return metaEvidence;
  } catch (error) {
    if (typeof rejectScript === "function") {
      rejectScript(error instanceof Error ? error.message : "Unknown error");
      return;
    }
    throw error;
  }
}

export async function generateMetaEvidence({ questionParams }: { questionParams: RealityQuestionParams }) {
  return {
    title: "Cross Chain Reality.eth Question",
    description: "A question asked on Reality.eth",
    rulingOptions: {
      type: "single-select",
      titles: ["No", "Yes"],
      descriptions: ["The answer to the question is no", "The answer to the question is yes"],
    },
    category: "Kleros Cross Chain Reality.eth",
    metadata: questionParams,
  };
}

// Add functions to window object for external access
if (typeof window !== "undefined") {
  window.getMetaEvidence = getMetaEvidence;
}

export type { RealityQuestionParams };
