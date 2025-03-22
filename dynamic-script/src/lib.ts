import RealitioQuestion from "@reality.eth/reality-eth-lib/formatters/question.js";
import { createPublicClient, getContract, http } from "viem";
import {
  homeProxyAbi,
  foreignProxyAbi,
  realitioAbi,
  REALITY_STARTS_AT,
  foreignProxyEvents,
  realitioEvents,
} from "./contracts";
import type { ArbitrationCreatedLog, LogNewQuestionLog, LogNewTemplateLog } from "./contracts";

const isNil = (value: unknown): value is undefined | null => value === undefined || value === null;

export interface RealityQuestionParams {
  disputeID: string;
  arbitrableContractAddress: `0x${string}`;
  arbitrableJsonRpcUrl?: string;
  arbitratorJsonRpcUrl?: string;
  jsonRpcUrl?: string;
}

export interface RealityQuestionData {
  questionID: `0x${string}`;
  realitioAddress: `0x${string}`;
  questionData: {
    title?: string;
    type: "bool" | "uint" | "single-select" | "multiple-select" | "datetime";
    decimals?: number;
    outcomes?: string[];
  };
  rawQuestion: string;
  rawTemplate: string;
}

export async function fetchRealityQuestionData({
  disputeID,
  arbitrableContractAddress,
  arbitrableJsonRpcUrl,
  arbitratorJsonRpcUrl,
  jsonRpcUrl,
}: RealityQuestionParams): Promise<RealityQuestionData> {
  if (isNil(disputeID) || isNil(arbitrableContractAddress)) {
    throw new Error("Both `disputeID` and `arbitrableContractAddress` parameters are required");
  }

  const foreignClient = createPublicClient({
    transport: http(arbitratorJsonRpcUrl || jsonRpcUrl),
  });

  const foreignProxy = getContract({
    address: arbitrableContractAddress,
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
    throw new Error("Could not find the dispute");
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

  const { template_id: templateID, question } = questionEventLog[0].args as LogNewQuestionLog;

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

  const questionData = JSON.parse(
    RealitioQuestion.populatedJSONForTemplate(templateText, question)
  ) as RealityQuestionData["questionData"];

  return {
    questionID,
    realitioAddress,
    questionData,
    rawQuestion: question,
    rawTemplate: templateText,
  };
}

export interface RealityMetaEvidence {
  question?: string;
  rulingOptions?: {
    type: "single-select" | "uint" | "datetime" | "multiple-select";
    titles?: string[];
    precision?: number;
    reserved: Record<string, string>;
  };
}

type RulingOptionsType = NonNullable<RealityMetaEvidence["rulingOptions"]>;

export async function fetchRealityMetaEvidence(params: RealityQuestionParams): Promise<RealityMetaEvidence> {
  const { questionData } = await fetchRealityQuestionData(params);

  const erc1497OverridesMixin = questionData.title ? { question: questionData.title } : {};

  const reservedAnswers: Record<string, string> = {
    "0xFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFF": "Answered Too Soon",
  };

  const rulingOptions = (() => {
    switch (questionData.type) {
      case "bool":
        return {
          type: "single-select" as const,
          titles: ["No", "Yes"],
          reserved: reservedAnswers,
        } satisfies RulingOptionsType;
      case "uint":
        return {
          type: "uint" as const,
          precision: questionData.decimals ?? 0,
          reserved: reservedAnswers,
        } satisfies RulingOptionsType;
      case "single-select":
        return {
          type: "single-select" as const,
          titles: questionData.outcomes ?? [],
          reserved: reservedAnswers,
        } satisfies RulingOptionsType;
      case "multiple-select":
        return {
          type: "multiple-select" as const,
          titles: questionData.outcomes ?? [],
          reserved: reservedAnswers,
        } satisfies RulingOptionsType;
      case "datetime":
        return {
          type: "datetime" as const,
          reserved: reservedAnswers,
        } satisfies RulingOptionsType;
      default:
        return undefined;
    }
  })();

  return {
    ...erc1497OverridesMixin,
    ...(rulingOptions ? { rulingOptions } : {}),
  };
}
