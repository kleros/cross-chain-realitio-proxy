export const homeProxyAbi = [
  {
    inputs: [],
    name: "realitio",
    outputs: [
      {
        internalType: "contract RealitioInterface",
        name: "",
        type: "address"
      }
    ],
    stateMutability: "view",
    type: "function"
  }
];

export const foreignProxyAbi = [
  {
    inputs: [
      {
        internalType: "uint256",
        name: "",
        type: "uint256"
      }
    ],
    name: "arbitrationCreatedBlock",
    outputs: [
      {
        internalType: "uint256",
        name: "",
        type: "uint256"
      }
    ],
    stateMutability: "view",
    type: "function"
  },
  {
    anonymous: false,
    inputs: [
      {
        indexed: true,
        internalType: "bytes32",
        name: "_questionID",
        type: "bytes32"
      },
      {
        indexed: true,
        internalType: "address",
        name: "_requester",
        type: "address"
      },
      {
        indexed: true,
        internalType: "uint256",
        name: "_disputeID",
        type: "uint256"
      }
    ],
    name: "ArbitrationCreated",
    type: "event"
  }
];