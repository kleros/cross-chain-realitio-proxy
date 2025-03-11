const { ethers } = require("ethers");

const gwei = (units) => ethers.parseUnits(units, "gwei");
const eth = (units) => ethers.parseEther(units);
const toBytes32 = (number) => ethers.zeroPadValue(ethers.toBeHex(number), 32);
const encodeExtraData = (courtId, minJurors) =>
  ethers.AbiCoder.defaultAbiCoder().encode(["uint96", "uint96"], [courtId, minJurors]);

const getMetaEvidenceFilename = (homeNetworkName, termsOfService) => {
  termsOfService = termsOfService ? termsOfService.toLowerCase() : "default";
  return `metaevidence-${homeNetworkName}-${termsOfService}.json`;
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
  getMetaEvidenceFilename,
  getMetaEvidenceCID,
};
