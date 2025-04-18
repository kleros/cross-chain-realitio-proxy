const { ethers } = require("ethers");

const gwei = (units) => ethers.parseUnits(units, "gwei");
const eth = (units) => ethers.parseEther(units);
const toBytes32 = (number) => ethers.zeroPadValue(ethers.toBeHex(number), 32);
const encodeExtraData = (courtId, minJurors) =>
  ethers.AbiCoder.defaultAbiCoder().encode(["uint96", "uint96"], [courtId, minJurors]);

function getPolicy(policyName = "default") {
  const policies = require("../../policies.json");
  const policyPath = policies[policyName];
  if (!policyPath) {
    const validPolicies = Object.keys(policies).join(", ");
    throw new Error(`Policy not found: ${policyName}. Valid options are: ${validPolicies}`);
  }
  return policyPath;
}

function generatePolicyUri(policyName = "default") {
  const policyPath = getPolicy(policyName);
  return `/ipfs/${policyPath}`; // for Kleros: https://multiformats.io/multiaddr/
}

function generateMetadata(policyName = "default") {
  const policyPath = getPolicy(policyName);
  const tosUri = `ipfs://${policyPath}`; // URI format for Reality: https://en.wikipedia.org/wiki/Uniform_Resource_Identifier#Example_URIs
  return `{"tos":"${tosUri}", "foreignProxy":true}`;
}

const getMetaEvidenceFilename = (homeNetworkName, termsOfService) => {
  const termsOfServiceValidated = termsOfService ? termsOfService.toLowerCase() : "default";
  return `metaevidence-${homeNetworkName}-${termsOfServiceValidated}.json`;
};

const getMetaEvidenceCID = (homeNetworkName) => {
  try {
    // Run ./scripts/generateMetaevidenceCids.sh to generate this file
    const metaEvidenceData = require("../../metaevidence-cids.json");
    const key = getMetaEvidenceFilename(homeNetworkName, process.env.TOS);
    const cid = metaEvidenceData[key];
    if (!cid) throw new Error(`No CID found for ${key}`);
    return `/ipfs/${cid}`;
  } catch (error) {
    throw new Error(`Failed to get metaEvidence CID: ${error.message}`);
  }
};

module.exports = {
  gwei,
  eth,
  toBytes32,
  encodeExtraData,
  getPolicy,
  generatePolicyUri,
  generateMetadata,
  getMetaEvidenceFilename,
  getMetaEvidenceCID,
};
