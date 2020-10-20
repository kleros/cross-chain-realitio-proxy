const {task, usePlugin} = require("@nomiclabs/buidler/config");

usePlugin("@nomiclabs/buidler-ethers");

task("deploy", "Deploy a contract", async ({contractName, force, constructorArgs, silent}, {run, ethers}) => {
  const factory = await ethers.getContractFactory(contractName);

  await run("compile", {force});

  if (!silent) {
    console.log(`\nDeploying contract ${contractName}... Please wait.`);
  }

  const contractInstance = await factory.deploy(...constructorArgs);

  if (!silent) {
    console.log(`\nContract ${contractName} address:\n`);
    console.log(contractInstance.address);
    console.log("\n-------------------------------\n");

    console.log(`\nTransaction hash:\n`);
    console.log(contractInstance.deployTransaction.hash);
    console.log("\n-------------------------------\n");
  }

  return contractInstance.deployed();
})
  .addFlag("force", "Forces re-deploying the contract")
  .addFlag("silent", "Do not display deployed contract info")
  .addParam("contractName", "Name of the contract to be deployed")
  .addOptionalVariadicPositionalParam("constructorArgs", "Contract constructor arguments", []);
