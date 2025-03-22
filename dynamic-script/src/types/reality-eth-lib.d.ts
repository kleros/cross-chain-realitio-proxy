declare module "@reality.eth/reality-eth-lib/formatters/question.js" {
  export function populatedJSONForTemplate(templateText: string, question: string): string;

  export type QuestionFormat = "bool" | "uint" | "single-select" | "multiple-select" | "datetime";

  export function getTemplateType(template: string): QuestionFormat;

  export function getTemplateText(template: string): string;
}
