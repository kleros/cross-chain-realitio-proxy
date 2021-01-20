const { BN, Address, toChecksumAddress } = require("ethereumjs-util");

module.exports = function getContractAddress(origin, nonce) {
  const deployAddress = Address.generate(Address.fromString(origin), new BN(String(nonce)));
  return toChecksumAddress(deployAddress.toString());
};
