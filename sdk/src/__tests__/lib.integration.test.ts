import { describe, expect, it } from "vitest";
import { fetchRealityQuestionData } from "../lib";

describe("fetchRealityQuestionData (integration)", () => {
  // Mark test as integration test and increase timeout since we're making real network calls
  it("should fetch reality question data from live networks", async () => {
    try {
      const result = await fetchRealityQuestionData({
        disputeID: "114",
        arbitrableContractAddress: "0x807f4D900E0c5B63Ed87a5C97f2B3482d82649eE",
        arbitratorJsonRpcUrl: "https://1rpc.io/sepolia",
        arbitrableJsonRpcUrl: "https://sepolia.unichain.org/",
      });

      // Verify the structure of the response
      expect(result).toEqual(
        expect.objectContaining({
          questionID: expect.stringMatching(/^0x[a-fA-F0-9]{64}$/),
          realitioAddress: expect.stringMatching(/^0x[a-fA-F0-9]{40}$/),
          questionData: expect.objectContaining({
            type: expect.stringMatching(/^(bool|uint|single-select|multiple-select|datetime)$/),
          }),
          rawQuestion: expect.any(String),
          rawTemplate: expect.stringContaining('"%s"'), // Templates always contain format specifiers
        })
      );

      // Log the actual result for manual verification
      console.log("Integration test result:", JSON.stringify(result, null, 2));
    } catch (error) {
      // Log more details about the error
      console.error("Test failed with error:", error);
      if (error instanceof Error) {
        console.error("Error stack:", error.stack);
      }
      throw error;
    }
  }, 30000); // 30 second timeout for network calls
});
