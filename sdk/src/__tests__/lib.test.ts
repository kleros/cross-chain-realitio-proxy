import { describe, expect, it, vi, beforeEach } from "vitest";
import {
  http,
  createPublicClient,
  getContract,
  type PublicClient,
  type GetContractReturnType,
} from "viem";
import { fetchRealityQuestionData } from "../lib";
import { foreignProxyAbi, homeProxyAbi, realitioAbi } from "../contracts";
import RealitioQuestion from "@reality.eth/reality-eth-lib/formatters/question.js";

// Mock viem
vi.mock("viem", () => ({
  http: vi.fn(),
  createPublicClient: vi.fn(),
  getContract: vi.fn(),
}));

// Mock RealitioQuestion
vi.mock("@reality.eth/reality-eth-lib/formatters/question.js", () => ({
  default: {
    populatedJSONForTemplate: vi
      .fn()
      .mockImplementation((template, question) => {
        // Mock implementation that returns a valid JSON string
        return JSON.stringify({
          title: "Title",
          type: "single-select",
          outcomes: ["Option 1", "Option 2", "Option 3"],
          category: "category",
          lang: "en_US",
        });
      }),
  },
}));

describe("fetchRealityQuestionData", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    (http as any).mockReturnValue(() => {});
  });

  it("should fetch reality question data correctly", async () => {
    // Mock data
    const mockQuestionID =
      "0x1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef" as const;
    const mockHomeProxyAddress =
      "0x9876543210fedcba9876543210fedcba98765432" as const;
    const mockRealitioAddress =
      "0xaf33DcB6E8c5c4D9dDF579f53031b514d19449CA" as const;
    const mockTemplateID = 2n; // Using template 2 (single-select)
    const mockQuestion = "Title␟Option 1|Option 2|Option 3␟category␟en_US";

    // Mock contract instances
    const mockForeignProxy = {
      read: {
        homeProxy: vi.fn().mockResolvedValue(mockHomeProxyAddress),
        arbitrationCreatedBlock: vi.fn().mockResolvedValue(12345n),
      },
      getEvents: {
        ArbitrationCreated: vi.fn().mockResolvedValue([
          {
            args: {
              _disputeID: 114n,
              _questionID: mockQuestionID,
            },
          },
        ]),
      },
    };

    const mockHomeProxy = {
      read: {
        realitio: vi.fn().mockResolvedValue(mockRealitioAddress),
      },
    };

    const mockRealitio = {
      read: {
        templates: vi.fn().mockResolvedValue(12345n),
      },
      getEvents: {
        LogNewQuestion: vi.fn().mockResolvedValue([
          {
            args: {
              question_id: mockQuestionID,
              template_id: mockTemplateID,
              question: mockQuestion,
            },
          },
        ]),
      },
    };

    // Setup mocks
    const mockClient = {
      account: undefined,
      batch: undefined,
      cacheTime: 0,
      chain: null,
      key: "mock",
      name: "Mock Client",
      pollingInterval: 4000,
      request: vi.fn(),
      transport: { type: "mock" },
      type: "publicClient",
      uid: "mock",
      getChainId: vi.fn().mockResolvedValue(11155111n), // Sepolia chain ID
    } as unknown as PublicClient;
    (createPublicClient as any).mockReturnValue(mockClient);
    (getContract as any).mockImplementation(
      ({ address, abi }: { address: `0x${string}`; abi: any }) => {
        if (abi === foreignProxyAbi) return mockForeignProxy;
        if (abi === homeProxyAbi) return mockHomeProxy;
        if (abi === realitioAbi) return mockRealitio;
        throw new Error("Unexpected contract ABI");
      },
    );

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
        category: "category",
        lang: "en_US",
      },
      rawQuestion: mockQuestion,
      rawTemplate:
        '{"title": "%s", "type": "single-select", "outcomes": [%s], "category": "%s", "lang": "%s"}',
    });

    // Verify mock calls
    expect(createPublicClient).toHaveBeenCalledWith({
      transport: expect.any(Function),
    });
    expect(getContract).toHaveBeenCalledWith(
      expect.objectContaining({
        address: "0x807f4D900E0c5B63Ed87a5C97f2B3482d82649eE",
        abi: foreignProxyAbi,
      }),
    );
    expect(RealitioQuestion.populatedJSONForTemplate).toHaveBeenCalledWith(
      '{"title": "%s", "type": "single-select", "outcomes": [%s], "category": "%s", "lang": "%s"}',
      mockQuestion,
    );
  });

  it("should throw error when required parameters are missing", async () => {
    await expect(
      fetchRealityQuestionData({
        disputeID: "",
        arbitrableContractAddress: "0x807f4D900E0c5B63Ed87a5C97f2B3482d82649eE",
      }),
    ).rejects.toThrow(
      "Both `disputeID` and `arbitrableContractAddress` parameters are required",
    );

    // Verify that no contract calls were made
    expect(createPublicClient).not.toHaveBeenCalled();
    expect(getContract).not.toHaveBeenCalled();
  });
});
