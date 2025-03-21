import RealitioQuestion from "@reality.eth/reality-eth-lib/formatters/question.js";
import { createPublicClient, getContract, http } from "viem";
import {
  homeProxyAbi,
  foreignProxyAbi,
  realitioAbi,
  REALITY_STARTS_AT,
  foreignProxyEvents,
  realitioEvents,
} from "./types/contracts";
import type { ArbitrationCreatedLog, LogNewQuestionLog, LogNewTemplateLog } from "./types/contracts";

const isNil = (value: unknown): value is undefined | null => value === undefined || value === null;

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
  const { disputeID, arbitrableContractAddress, arbitrableJsonRpcUrl, arbitratorJsonRpcUrl, jsonRpcUrl } =
    scriptParameters;

  if (isNil(disputeID) || isNil(arbitrableContractAddress)) {
    return rejectScript("Both `disputeID` and `arbitrableContractAddress` script parameters are required");
  }

  const foreignClient = createPublicClient({
    transport: http(arbitratorJsonRpcUrl || jsonRpcUrl),
  });

  const foreignProxy = getContract({
    address: arbitrableContractAddress as `0x${string}`,
    abi: foreignProxyAbi,
    client: foreignClient,
  });

  const homeClient = createPublicClient({
    transport: http(arbitrableJsonRpcUrl || jsonRpcUrl),
  });

  const homeProxyAddress = await foreignProxy.read.homeProxy();
  const homeProxy = getContract({
    address: homeProxyAddress,
    abi: homeProxyAbi,
    client: homeClient,
  });

  const realitioAddress = await homeProxy.read.realitio();
  const realitio = getContract({
    address: realitioAddress,
    abi: realitioAbi,
    client: homeClient,
  });

  const arbitrationCreatedBlock = await foreignProxy.read.arbitrationCreatedBlock([BigInt(disputeID)]);
  const arbitrationCreatedLogs = await foreignClient.getLogs({
    address: arbitrableContractAddress,
    event: foreignProxyEvents.ArbitrationCreated,
    args: {
      _disputeID: BigInt(disputeID),
    },
    fromBlock: arbitrationCreatedBlock,
    toBlock: arbitrationCreatedBlock,
  });

  if (arbitrationCreatedLogs.length !== 1) {
    return rejectScript("Could not find the dispute");
  }

  const { _questionID: questionID } = arbitrationCreatedLogs[0].args as ArbitrationCreatedLog;

  const questionEventLog = await homeClient.getLogs({
    address: realitioAddress,
    event: realitioEvents.LogNewQuestion,
    args: {
      question_id: questionID,
    },
    fromBlock: BigInt(
      Object.keys(REALITY_STARTS_AT).includes(realitioAddress.toLowerCase())
        ? REALITY_STARTS_AT[realitioAddress.toLowerCase() as keyof typeof REALITY_STARTS_AT]
        : 0
    ),
    toBlock: "latest",
  });

  const { template_id: templateID } = questionEventLog[0].args as LogNewQuestionLog;

  let templateText: string;
  if (templateID < 5n) {
    // first 5 templates are part of reality.eth spec, hardcode for faster loading
    templateText = [
      '{"title": "%s", "type": "bool", "category": "%s", "lang": "%s"}',
      '{"title": "%s", "type": "uint", "decimals": 18, "category": "%s", "lang": "%s"}',
      '{"title": "%s", "type": "single-select", "outcomes": [%s], "category": "%s", "lang": "%s"}',
      '{"title": "%s", "type": "multiple-select", "outcomes": [%s], "category": "%s", "lang": "%s"}',
      '{"title": "%s", "type": "datetime", "category": "%s", "lang": "%s"}',
    ][Number(templateID)];
  } else {
    const templateCreationBlock = await realitio.read.templates([templateID]);
    const templateEventLog = await homeClient.getLogs({
      address: realitioAddress,
      event: realitioEvents.LogNewTemplate,
      args: {
        template_id: templateID,
      },
      fromBlock: templateCreationBlock,
      toBlock: templateCreationBlock,
    });

    const { question_text } = templateEventLog[0].args as LogNewTemplateLog;
    templateText = question_text;
  }

  const { question } = questionEventLog[0].args as LogNewQuestionLog;
  const questionData = RealitioQuestion.populatedJSONForTemplate(templateText, question);

  const erc1497OverridesMixin = questionData.title ? { question: questionData.title } : {};

  switch (questionData.type) {
    case "bool":
      return resolveScript({
        ...erc1497OverridesMixin,
        rulingOptions: {
          type: "single-select",
          titles: ["No", "Yes"],
          reserved: {
            "0xFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFF": "Answered Too Soon",
          },
        },
      });
    case "uint":
      return resolveScript({
        ...erc1497OverridesMixin,
        rulingOptions: {
          type: "uint",
          precision: questionData.decimals,
          reserved: {
            "0xFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFF": "Answered Too Soon",
          },
        },
      });
    case "single-select":
      return resolveScript({
        ...erc1497OverridesMixin,
        rulingOptions: {
          type: "single-select",
          titles: questionData.outcomes,
          reserved: {
            "0xFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFF": "Answered Too Soon",
          },
        },
      });
    case "multiple-select":
      return resolveScript({
        ...erc1497OverridesMixin,
        rulingOptions: {
          type: "multiple-select",
          titles: questionData.outcomes,
          reserved: {
            "0xFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFF": "Answered Too Soon",
          },
        },
      });
    case "datetime":
      return resolveScript({
        ...erc1497OverridesMixin,
        rulingOptions: {
          type: "datetime",
          reserved: {
            "0xFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFF": "Answered Too Soon",
          },
        },
      });
    default:
      return resolveScript({ ...erc1497OverridesMixin });
  }
}
