declare module '@reality.eth/reality-eth-lib/formatters/question' {
  export function populatedJSONForTemplate(question: string, template: string): {
    title: string
    type: string
    category?: string
    lang?: string
    outcomes?: string[]
    decimals?: number
  }
} 