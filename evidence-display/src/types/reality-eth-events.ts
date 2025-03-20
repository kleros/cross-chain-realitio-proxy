import { Log } from 'viem'

export interface ArbitrationCreatedLog extends Log {
  args: {
    _questionID: `0x${string}`
    _requester: `0x${string}`
    _disputeID: bigint
  }
}

export interface LogNewQuestionLog extends Log {
  args: {
    question_id: `0x${string}`
    user: `0x${string}`
    template_id: bigint
    question: string
    content_hash: `0x${string}`
    arbitrator: `0x${string}`
    timeout: number
    opening_ts: number
    nonce: bigint
    created: bigint
  }
}

export interface LogNewTemplateLog extends Log {
  args: {
    template_id: bigint
    user: `0x${string}`
    question_text: string
  }
}

export const arbitrationCreatedEvent = {
  type: 'event',
  name: 'ArbitrationCreated',
  inputs: [
    { type: 'bytes32', name: '_questionID', indexed: true },
    { type: 'address', name: '_requester', indexed: true },
    { type: 'uint256', name: '_disputeID', indexed: true },
  ],
} as const

export const logNewQuestionEvent = {
  type: 'event',
  name: 'LogNewQuestion',
  inputs: [
    { type: 'bytes32', name: 'question_id', indexed: true },
    { type: 'address', name: 'user', indexed: true },
    { type: 'uint256', name: 'template_id', indexed: false },
    { type: 'string', name: 'question', indexed: false },
    { type: 'bytes32', name: 'content_hash', indexed: true },
    { type: 'address', name: 'arbitrator', indexed: false },
    { type: 'uint32', name: 'timeout', indexed: false },
    { type: 'uint32', name: 'opening_ts', indexed: false },
    { type: 'uint256', name: 'nonce', indexed: false },
    { type: 'uint256', name: 'created', indexed: false },
  ],
} as const

export const logNewTemplateEvent = {
  type: 'event',
  name: 'LogNewTemplate',
  inputs: [
    { type: 'uint256', name: 'template_id', indexed: true },
    { type: 'address', name: 'user', indexed: true },
    { type: 'string', name: 'question_text', indexed: false },
  ],
} as const 