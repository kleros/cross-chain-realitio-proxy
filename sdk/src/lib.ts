import RealitioQuestion from "@reality.eth/reality-eth-lib/formatters/question.js";
import { http, createPublicClient, getContract } from "viem";
import {
  REALITY_STARTS_AT,
  foreignProxyAbi,
  homeProxyAbi,
  realitioAbi,
} from "./contracts";

const isNil = (value: unknown): value is undefined | null =>
  value === undefined || value === null;

const isEmpty = (value: string): boolean => value.trim() === "";

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
  if (
    isNil(disputeID) ||
    isNil(arbitrableContractAddress) ||
    isEmpty(disputeID)
  ) {
    throw new Error(
      "Both `disputeID` and `arbitrableContractAddress` parameters are required",
    );
  }

  console.log("Creating foreign client...");
  const foreignClient = createPublicClient({
    transport: http(arbitratorJsonRpcUrl || jsonRpcUrl),
  });

  console.log("Getting foreign proxy contract...");
  const foreignProxy = getContract({
    address: arbitrableContractAddress,
    abi: foreignProxyAbi,
    client: foreignClient,
  });

  console.log("Creating home client...");
  const homeClient = createPublicClient({
    transport: http(arbitrableJsonRpcUrl || jsonRpcUrl),
  });

  console.log("Getting home proxy address...");
  const homeProxyAddress = await foreignProxy.read.homeProxy();
  console.log("Home proxy address:", homeProxyAddress);

  console.log("Getting home proxy contract...");
  const homeProxy = getContract({
    address: homeProxyAddress,
    abi: homeProxyAbi,
    client: homeClient,
  });

  console.log("Getting realitio address...");
  const realitioAddress = await homeProxy.read.realitio();
  console.log("Realitio address:", realitioAddress);

  console.log("Getting realitio contract...");
  const realitio = getContract({
    address: realitioAddress,
    abi: realitioAbi,
    client: homeClient,
  });

  console.log("Getting arbitration created block...");
  const arbitrationCreatedBlock =
    await foreignProxy.read.arbitrationCreatedBlock([BigInt(disputeID)]);
  console.log("Arbitration created block:", arbitrationCreatedBlock.toString());

  console.log("Getting arbitration created logs...");
  const arbitrationCreatedLogs =
    await foreignProxy.getEvents.ArbitrationCreated(
      {
        _disputeID: BigInt(disputeID),
      },
      { fromBlock: arbitrationCreatedBlock, toBlock: arbitrationCreatedBlock },
    );
  console.log(
    "Arbitration created logs:",
    JSON.stringify(
      arbitrationCreatedLogs,
      (_, value) => (typeof value === "bigint" ? value.toString() : value),
      2,
    ),
  );

  if (arbitrationCreatedLogs.length !== 1) {
    throw new Error("Could not find the dispute");
  }

  const { _questionID: questionID } = arbitrationCreatedLogs[0].args;
  if (!questionID) {
    throw new Error("Missing question ID from arbitration event");
  }
  console.log("Question ID:", questionID);

  console.log("Getting question event log...");
  const questionEventLog = await realitio.getEvents.LogNewQuestion(
    {
      question_id: questionID,
    },
    {
      fromBlock: BigInt(
        Object.keys(REALITY_STARTS_AT).includes(realitioAddress.toLowerCase())
          ? REALITY_STARTS_AT[
              realitioAddress.toLowerCase() as keyof typeof REALITY_STARTS_AT
            ]
          : 0,
      ),
      toBlock: "latest",
    },
  );
  console.log(
    "Question event log:",
    JSON.stringify(
      questionEventLog,
      (_, value) => (typeof value === "bigint" ? value.toString() : value),
      2,
    ),
  );

  if (questionEventLog.length === 0) {
    throw new Error("Could not find the question event");
  }

  const { template_id, question } = questionEventLog[0].args;
  console.log("template_id:", template_id, "type:", typeof template_id);
  console.log("question:", question, "type:", typeof question);
  if (template_id === undefined || !question) {
    throw new Error("Missing template ID or question from event");
  }

  let templateText: string;
  if (template_id < 5n) {
    // first 5 templates are part of reality.eth spec, hardcode for faster loading
    templateText = [
      '{"title": "%s", "type": "bool", "category": "%s", "lang": "%s"}',
      '{"title": "%s", "type": "uint", "decimals": 18, "category": "%s", "lang": "%s"}',
      '{"title": "%s", "type": "single-select", "outcomes": [%s], "category": "%s", "lang": "%s"}',
      '{"title": "%s", "type": "multiple-select", "outcomes": [%s], "category": "%s", "lang": "%s"}',
      '{"title": "%s", "type": "datetime", "category": "%s", "lang": "%s"}',
    ][Number(template_id)];
  } else {
    const templateCreationBlock = await realitio.read.templates([template_id]);
    const templateEventLog = await realitio.getEvents.LogNewTemplate(
      {
        template_id: template_id,
      },
      { fromBlock: templateCreationBlock, toBlock: templateCreationBlock },
    );

    if (templateEventLog.length === 0) {
      throw new Error("Could not find the template event");
    }

    const { question_text } = templateEventLog[0].args;
    if (!question_text) {
      throw new Error("Missing question text from template event");
    }
    templateText = question_text;
  }

  const questionParts = question.split("␟");
  console.log("questionParts:", questionParts);

  const populatedJSON = RealitioQuestion.populatedJSONForTemplate(
    templateText,
    question,
  );
  console.log("populatedJSON:", populatedJSON);

  const questionData = (
    typeof populatedJSON === "string"
      ? JSON.parse(populatedJSON)
      : populatedJSON
  ) as RealityQuestionData["questionData"];
  console.log("questionData:", questionData);

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

export async function fetchRealityMetaEvidence(
  params: RealityQuestionParams,
): Promise<RealityMetaEvidence> {
  const { questionData } = await fetchRealityQuestionData(params);

  const erc1497OverridesMixin = questionData.title
    ? { question: questionData.title }
    : {};

  const reservedAnswers: Record<string, string> = {
    "0xFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFF":
      "Answered Too Soon",
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
