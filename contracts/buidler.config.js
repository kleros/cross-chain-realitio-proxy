require("dotenv/config");
const {usePlugin, task} = require("@nomiclabs/buidler/config");
require("./tasks/deploy");

usePlugin("@nomiclabs/buidler-waffle");
usePlugin("@nomiclabs/buidler-ethers");
usePlugin("@nomiclabs/buidler-web3");

// This is a sample Buidler task. To learn how to create your own go to
// https://buidler.dev/guides/create-task.html
task("accounts", "Prints the list of accounts", async (_, {ethers}) => {
  const accounts = await ethers.getSigners();

  for (const account of accounts) {
    console.log(await account.getAddress());
  }
});

// You have to export an object to set up your config
// This object can have the following optional entries:
// defaultNetwork, networks, solc, and paths.
// Go to https://buidler.dev/config/ to learn more
module.exports = {
  // This is a sample solc configuration that specifies which version of solc to use
  solc: {
    version: "0.7.2",
    optimizer: {
      enabled: true,
      runs: 200,
    },
  },
  paths: {
    sources: "./src",
  },
  networks: {
    buidlerevm: {},
    sokol: {
      chainId: 77,
      url: "https://sokol.poa.network/",
      accounts: [process.env.PRIVATE_KEY],
    },
    kovan: {
      chainId: 42,
      url: `https://kovan.infura.io/v3/${process.env.INFURA_API_KEY}`,
      accounts: [process.env.PRIVATE_KEY],
    },
  },
};
