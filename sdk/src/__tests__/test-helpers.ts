import type { PublicClient, Transport } from "viem";
import { vi } from "vitest";

export function createMockTransport(): Transport {
  return {
    type: "mock",
    request: async () => ({}),
    config: {},
    // Add required Transport methods
    /* eslint-disable @typescript-eslint/no-unused-vars */
    retryCount: 0,
    retryDelay: 0,
    timeout: 0,
    key: "mock",
    name: "Mock Transport",
    /* eslint-enable @typescript-eslint/no-unused-vars */
  } as unknown as Transport;
}

export function createMockClient(mockTransport: Transport): PublicClient {
  return {
    account: undefined,
    batch: undefined,
    cacheTime: 0,
    chain: null,
    key: "mock",
    name: "Mock Client",
    pollingInterval: 4000,
    request: vi.fn(),
    transport: mockTransport,
    type: "publicClient",
    uid: "mock",
    getChainId: vi.fn().mockResolvedValue(11155111n), // Sepolia chain ID
  } as unknown as PublicClient;
}

export function createMockContracts(
  mockQuestionID: string,
  mockHomeProxyAddress: string,
  mockRealitioAddress: string,
  mockTemplateID: bigint,
  mockQuestion: string
) {
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

  return { mockForeignProxy, mockHomeProxy, mockRealitio };
}
