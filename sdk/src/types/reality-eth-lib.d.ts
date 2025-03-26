declare module "@reality.eth/reality-eth-lib/formatters/question.js" {
  export default class RealitioQuestion {
    static populatedJSONForTemplate(template: string, question: string): string;
  }
}

declare module "@reality.eth/contracts" {
  interface RealityConfig {
    address: string;
    block: number;
    notes: string | null;
    arbitrators: Record<string, string>;
    version_number: string;
    chain_id: string;
    contract_name: string;
    contract_version: string;
    token_ticker: string;
  }

  export function configForAddress(
    address: string,
    chainId: number,
  ): RealityConfig;
}
