declare module '@reality.eth/reality-eth-lib/formatters/question.js' {
  export default class RealitioQuestion {
    static populatedJSONForTemplate(templateText: string, question: string): {
      title?: string
      type: 'bool' | 'uint' | 'single-select' | 'multiple-select' | 'datetime'
      decimals?: number
      outcomes?: string[]
    }
  }
} 