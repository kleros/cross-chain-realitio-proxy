import type { RealityQuestionData } from "@kleros/cross-chain-realitio-sdk";

export const mockQuestionData: RealityQuestionData = {
  questionID: "0xe001fab74d003e5ac5ebd84f12973197180986e5b768f37313f3bc8b41174504",
  realitioAddress: "0x012fb3aDce7D60672cF634e730927Fa5822b3cAb",
  questionData: {
    title: "What's the best hash?",
    description: "More info [here](https://www.google.com).",
    type: "hash",
  },
  rawQuestion: "What's the best hash?␟More info [here](https://www.google.com).␟",
  rawTemplate: '{"title": "%s", "type": "hash", "description": "%s", "lang": "%s"}',
};
