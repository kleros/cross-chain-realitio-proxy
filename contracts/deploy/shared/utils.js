const { ethers } = require("ethers");

const gwei = (units) => ethers.parseUnits(units, "gwei");
const eth = (units) => ethers.parseEther(units);
const toBytes32 = (number) => ethers.zeroPadValue(ethers.toBeHex(number), 32);
const encodeExtraData = (courtId, minJurors) =>
  ethers.AbiCoder.defaultAbiCoder().encode(["uint96", "uint96"], [courtId, minJurors]);

module.exports = {
  gwei,
  eth,
  toBytes32,
  encodeExtraData,
};
