const FOREIGN_CHAIN_IDS = [42, 1];

async function deployForeignProxy({deployments, getNamedAccounts}) {
  const {deploy} = deployments;
  const {deployer} = await getNamedAccounts();

  await deploy("RealitioForeignArbitrationProxy", {
    from: deployer,
    gas: 8000000,
    args: [
      // AMB
      "0xFe446bEF1DbF7AFE24E81e05BC8B271C1BA9a560",
      // Arbitrator
      "0xA8243657a1E6ad1AAf2b59c4CCDFE85fC6fD7a8B",
      // Arbitrator extra data
      "0x00000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000001",
    ],
  });
}

deployForeignProxy.tags = ["ForeignChain"];
deployForeignProxy.skip = async ({getChainId}) => !FOREIGN_CHAIN_IDS.includes(Number(await getChainId()));

module.exports = deployForeignProxy;
