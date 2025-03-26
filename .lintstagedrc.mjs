const yarnContracts = "yarn workspace @kleros/cross-chain-realitio-contracts";
const yarnEvidenceScript =
  "yarn workspace @kleros/cross-chain-realitio-evidence-display";
const yarnDynamicScript =
  "yarn workspace @kleros/cross-chain-realitio-dynamic-script";

const defaultExtensions =
  "{js,ts,cjs,mjs,d.cts,d.mts,jsx,tsx,json,jsonc,md,html,css,yaml,yml}";

const biomeCheckCommand = "biome check --write --no-errors-on-unmatched";

export default {
  [`contracts/**/*.${defaultExtensions}`]: (files) =>
    `${yarnContracts} ${biomeCheckCommand} ${files.join(" ")}`,
  [`contracts/**/*.sol`]: (files) => [
    `${yarnContracts} prettier --write ${files.join(" ")}`,
    `${yarnContracts} solhint --fix ${files.join(" ")}`,
  ],
  [`evidence-display/**/*.${defaultExtensions}`]: (files) =>
    `${yarnEvidenceScript} ${biomeCheckCommand} ${files.join(" ")}`,
  [`dynamic-script/**/*.${defaultExtensions}`]: (files) =>
    `${yarnDynamicScript} ${biomeCheckCommand} ${files.join(" ")}`,
};
