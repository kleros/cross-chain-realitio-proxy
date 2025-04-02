import type { Abi, GetContractReturnType, PublicClient } from "viem";

export const homeProxyAbi = [
  {
    inputs: [],
    name: "realitio",
    outputs: [{ internalType: "contract IRealitio", name: "", type: "address" }],
    stateMutability: "view",
    type: "function",
  },
] as const satisfies Abi;

export const foreignProxyAbi = [
  {
    inputs: [],
    name: "homeProxy",
    outputs: [{ internalType: "address", name: "", type: "address" }],
    stateMutability: "view",
    type: "function",
  },
  {
    inputs: [{ internalType: "uint256", name: "", type: "uint256" }],
    name: "arbitrationCreatedBlock",
    outputs: [{ internalType: "uint256", name: "", type: "uint256" }],
    stateMutability: "view",
    type: "function",
  },
  {
    anonymous: false,
    inputs: [
      {
        indexed: true,
        internalType: "bytes32",
        name: "_questionID",
        type: "bytes32",
      },
      {
        indexed: true,
        internalType: "address",
        name: "_requester",
        type: "address",
      },
      {
        indexed: true,
        internalType: "uint256",
        name: "_disputeID",
        type: "uint256",
      },
    ],
    name: "ArbitrationCreated",
    type: "event",
  },
] as const satisfies Abi;

export const realitioAbi = [
  {
    anonymous: false,
    inputs: [
      {
        indexed: false,
        internalType: "bytes32",
        name: "answer",
        type: "bytes32",
      },
      {
        indexed: true,
        internalType: "bytes32",
        name: "question_id",
        type: "bytes32",
      },
      {
        indexed: false,
        internalType: "bytes32",
        name: "history_hash",
        type: "bytes32",
      },
      { indexed: true, internalType: "address", name: "user", type: "address" },
      {
        indexed: false,
        internalType: "uint256",
        name: "bond",
        type: "uint256",
      },
      { indexed: false, internalType: "uint256", name: "ts", type: "uint256" },
      {
        indexed: false,
        internalType: "bool",
        name: "is_commitment",
        type: "bool",
      },
    ],
    name: "LogNewAnswer",
    type: "event",
  },
  {
    anonymous: false,
    inputs: [
      {
        indexed: true,
        internalType: "bytes32",
        name: "question_id",
        type: "bytes32",
      },
      { indexed: true, internalType: "address", name: "user", type: "address" },
      {
        indexed: false,
        internalType: "uint256",
        name: "template_id",
        type: "uint256",
      },
      {
        indexed: false,
        internalType: "string",
        name: "question",
        type: "string",
      },
      {
        indexed: true,
        internalType: "bytes32",
        name: "content_hash",
        type: "bytes32",
      },
      {
        indexed: false,
        internalType: "address",
        name: "arbitrator",
        type: "address",
      },
      {
        indexed: false,
        internalType: "uint32",
        name: "timeout",
        type: "uint32",
      },
      {
        indexed: false,
        internalType: "uint32",
        name: "opening_ts",
        type: "uint32",
      },
      {
        indexed: false,
        internalType: "uint256",
        name: "nonce",
        type: "uint256",
      },
      {
        indexed: false,
        internalType: "uint256",
        name: "created",
        type: "uint256",
      },
    ],
    name: "LogNewQuestion",
    type: "event",
  },
  {
    anonymous: false,
    inputs: [
      {
        indexed: true,
        internalType: "uint256",
        name: "template_id",
        type: "uint256",
      },
      { indexed: true, internalType: "address", name: "user", type: "address" },
      {
        indexed: false,
        internalType: "string",
        name: "question_text",
        type: "string",
      },
    ],
    name: "LogNewTemplate",
    type: "event",
  },
  {
    inputs: [{ internalType: "uint256", name: "", type: "uint256" }],
    name: "templates",
    outputs: [{ internalType: "uint256", name: "", type: "uint256" }],
    stateMutability: "view",
    type: "function",
  },
  {
    inputs: [{ internalType: "uint256", name: "", type: "uint256" }],
    name: "template_hashes",
    outputs: [{ internalType: "bytes32", name: "", type: "bytes32" }],
    stateMutability: "view",
    type: "function",
  },
] as const satisfies Abi;

export type HomeProxyContract = GetContractReturnType<typeof homeProxyAbi, PublicClient>;

export type ForeignProxyContract = GetContractReturnType<typeof foreignProxyAbi, PublicClient>;

export type RealitioContract = GetContractReturnType<typeof realitioAbi, PublicClient>;
