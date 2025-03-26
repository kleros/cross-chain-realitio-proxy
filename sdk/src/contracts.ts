import type { Abi } from "viem";

export const REALITY_STARTS_AT = {
  "0x325a2e0f3cca2ddbaebb4dfc38df8d19ca165b47": 6531265, // Reality 2.0 Mainnet
  "0x5b7dd1e86623548af054a4985f7fc8ccbb554e2c": 13194676, // Reality 3.0 Mainnet
  "0xaf33dcb6e8c5c4d9ddf579f53031b514d19449ca": 3044431, // Reality 3.0 Sepolia
  "0x79e32ae03fb27b07c89c0c568f80287c01ca2e57": 14005802, // Reality 2.1 Gnosis
  "0xe78996a233895be74a66f451f1019ca9734205cc": 17997262, // Reality 3.0 Gnosis
  "0x1E732a1C5e9181622DD5A931Ec6801889ce66185": 10438389, // Reality 3.0 Chiado,
  "0x60573b8dce539ae5bf9ad7932310668997ef0428": 18901674, // Reality 3.0 Polygon
  "0x5d18bd4dc5f1ac8e9bd9b666bd71cb35a327c4a9": 459975, // Reality 3.0 ArbitrumOne
  "0xB78396EFaF0a177d125e9d45B2C6398Ac5f803B9": 41977012, // Reality 3.0 ArbitrumSepolia
  "0xA8AC760332770FcF2056040B1f964750e4bEf808": 9691, // Reality 3.0 zkSyncMain
  "0x4E346436e99fb7d6567A2bd024d8806Fc10d84D2": 255658, // Reality 3.0 zkSyncSepolia
  "0x0eF940F7f053a2eF5D6578841072488aF0c7d89A": 2462149, // Reality 3.0 Optimism,
  "0xeAD0ca922390a5E383A9D5Ba4366F7cfdc6f0dbA": 14341474, // Reality 3.0 OptimismSepolia
  "0xc716c23D75f523eF0C511456528F2A1980256a87": 3034954, // Reality 3.0 Redstone
  "0x807f4D900E0c5B63Ed87a5C97f2B3482d82649eE": 7686678, // Reality 3.0 UnichainSepolia old,
  "0x8bF08aE62cbC9a48aaeB473a82DAE2e6D2628517": 10747559, // Reality 3.0 UnichainSepolia,
  "0xB920dBedE88B42aA77eE55ebcE3671132ee856fC": 8561869, // Reality 3.0 Unichain
  "0x2F39f464d16402Ca3D8527dA89617b73DE2F60e8": 26260675, // Reality 3.0 Base
} as const;

export const homeProxyAbi = [
  {
    inputs: [],
    name: "realitio",
    outputs: [
      { internalType: "contract IRealitio", name: "", type: "address" },
    ],
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
] as const satisfies Abi;
