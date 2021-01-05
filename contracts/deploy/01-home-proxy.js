const HOME_CHAIN_IDS = [77, 100];

async function deployHomeProxy({ deployments, getNamedAccounts }) {
  const { deploy } = deployments;
  const { deployer } = await getNamedAccounts();

  await deploy("RealitioHomeArbitrationProxy", {
    from: deployer,
    gas: 8000000,
    args: [
      // AMB
      "0xFe446bEF1DbF7AFE24E81e05BC8B271C1BA9a560",
      // Realitio
      "0x63975d9e7CF434dCd04bD808d8c79d03EF69100B",
    ],
  });
}

deployHomeProxy.tags = ["HomeChain"];
deployHomeProxy.skip = async ({ getChainId }) => !HOME_CHAIN_IDS.includes(Number(await getChainId()));

module.exports = deployHomeProxy;
