require("dotenv/config");
const {task} = require("hardhat/config");
const prompts = require("prompts");
const getContracts = require("./helpers/getContracts");

task("initialize-foreign-proxy", "Initializes the Foreign Proxy instance", async (args, {ethers}) => {
  const {foreignProxy} = await getContracts({env: args.env, ethers});

  const responses = await prompts([
    {
      type: "confirm",
      name: "metaEvidence",
      message: `Set meta evidence to ${args.metaEvidence}?`,
    },
    {
      type: (prev) => (prev === true ? "confirm" : null),
      name: "termsOfService",
      message: `Set terms of service to ${args.termsOfService}?`,
    },
    {
      type: (prev) => (prev === true ? "confirm" : null),
      name: "confirmation",
      message: `ATTENTION: This action is irreversible. Do you wish to continue?`,
    },
  ]);

  if (!responses.confirmation) {
    console.log("Aborting...");
    return;
  }

  const tx = await foreignProxy.initialize(args.metaEvidence, args.termsOfService);

  await tx.wait();

  console.log("Foreign Proxy successfully initialized!");
})
  .addParam("env", 'The environment to link the proxies. One of "staging", "production".')
  .addParam("metaEvidence", "The meta evidence path to initialize the contract with.")
  .addParam("termsOfService", "The terms of service path to initialize the contract with.");
