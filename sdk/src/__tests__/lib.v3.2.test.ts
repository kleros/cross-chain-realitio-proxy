import { type RealityConfig, configForAddress } from "@reality.eth/contracts";
import RealitioQuestion from "@reality.eth/reality-eth-lib/formatters/question.js";
import { http, type PublicClient, type Transport, createPublicClient, getContract } from "viem";
import { type Mock, beforeEach, describe, expect, it, vi } from "vitest";
import { foreignProxyAbi, homeProxyAbi, realitioAbi } from "../contracts";
import { fetchRealityQuestionData } from "../lib";
import { createMockClient, createMockContracts, createMockTransport } from "./test-helpers";

// Mock viem
vi.mock("viem", () => ({
  http: vi.fn(),
  createPublicClient: vi.fn(),
  getContract: vi.fn(),
}));

// Mock @reality.eth/contracts to return a v3.2 config
vi.mock("@reality.eth/contracts", async () => {
  const actual = await vi.importActual<typeof import("@reality.eth/contracts")>("@reality.eth/contracts");
  return {
    ...actual,
    configForAddress: vi.fn().mockImplementation((address: string, chainId: number) => {
      const realConfig = actual?.configForAddress(address, chainId) as RealityConfig;
      return {
        ...realConfig,
        contract_version: "3.2",
      };
    }),
  };
});

// Reset mocks for v3.2 tests
vi.resetModules();
vi.clearAllMocks();

// Mock RealitioQuestion for v3.2
vi.mock("@reality.eth/reality-eth-lib/formatters/question.js", () => ({
  default: {
    populatedJSONForTemplate: vi.fn().mockImplementation((_template, _question) => {
      // Mock implementation that returns a valid JSON string for v3.2
      return JSON.stringify({
        title: "Title",
        type: "single-select",
        outcomes: ["Option 1", "Option 2", "Option 3"],
        description: "Useful question description", // Changed from category (v3.0) to description (v3.2)
        lang: "en_US",
      });
    }),
  },
}));

describe("fetchRealityQuestionData (v3.2)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    (http as unknown as Mock).mockReturnValue(() => {});
  });

  it("should fetch reality question data correctly", async () => {
    // Mock data
    const mockQuestionID = "0x1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef" as const;
    const mockHomeProxyAddress = "0x9876543210fedcba9876543210fedcba98765432" as const;
    const mockRealitioAddress = "0xaf33DcB6E8c5c4D9dDF579f53031b514d19449CA" as const;
    const mockTemplateID = 2n; // Using template 2 (single-select)
    const mockQuestion = "Title␟Option 1|Option 2|Option 3␟category␟en_US";

    // Setup mocks
    const mockTransport = createMockTransport();
    const mockClient = createMockClient(mockTransport);
    const { mockForeignProxy, mockHomeProxy, mockRealitio } = createMockContracts(
      mockQuestionID,
      mockHomeProxyAddress,
      mockRealitioAddress,
      mockTemplateID,
      mockQuestion
    );

    (createPublicClient as unknown as Mock).mockReturnValue(mockClient);
    (getContract as unknown as Mock).mockImplementation(({ abi }: { abi: unknown }) => {
      if (abi === foreignProxyAbi) return mockForeignProxy;
      if (abi === homeProxyAbi) return mockHomeProxy;
      if (abi === realitioAbi) return mockRealitio;
      throw new Error("Unexpected contract ABI");
    });

    // Execute test
    const result = await fetchRealityQuestionData({
      disputeID: "114",
      arbitrableContractAddress: "0x807f4D900E0c5B63Ed87a5C97f2B3482d82649eE",
      arbitratorJsonRpcUrl: "https://1rpc.io/sepolia",
      arbitrableJsonRpcUrl: "https://sepolia.unichain.org/",
    });

    // Verify results
    expect(result).toEqual({
      questionID: mockQuestionID,
      realitioAddress: mockRealitioAddress,
      questionData: {
        title: "Title",
        type: "single-select",
        outcomes: ["Option 1", "Option 2", "Option 3"],
        description: "Useful question description", // Changed from category (v3.0) to description (v3.2)
        lang: "en_US",
      },
      rawQuestion: mockQuestion,
      rawTemplate: '{"title": "%s", "type": "single-select", "outcomes": [%s], "description": "%s", "lang": "%s"}', // Changed category to description
    });

    // Verify mock calls
    expect(createPublicClient).toHaveBeenCalledWith({
      transport: expect.any(Function),
    });
    expect(getContract).toHaveBeenCalledWith(
      expect.objectContaining({
        address: "0x807f4D900E0c5B63Ed87a5C97f2B3482d82649eE",
        abi: foreignProxyAbi,
      })
    );
    expect(RealitioQuestion.populatedJSONForTemplate).toHaveBeenCalledWith(
      '{"title": "%s", "type": "single-select", "outcomes": [%s], "description": "%s", "lang": "%s"}', // Changed category to description
      mockQuestion
    );
    expect(configForAddress).toHaveBeenCalledWith(mockRealitioAddress, 11155111n);
  });

  it("should throw error when required parameters are missing", async () => {
    await expect(
      fetchRealityQuestionData({
        disputeID: "",
        arbitrableContractAddress: "0x807f4D900E0c5B63Ed87a5C97f2B3482d82649eE",
      })
    ).rejects.toThrow("Both `disputeID` and `arbitrableContractAddress` parameters are required");

    // Verify that no contract calls were made
    expect(createPublicClient).not.toHaveBeenCalled();
    expect(getContract).not.toHaveBeenCalled();
  });
});
