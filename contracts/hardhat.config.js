require("dotenv/config");
const { task } = require("hardhat/config");
require("@nomiclabs/hardhat-waffle");
require("@nomiclabs/hardhat-ethers");
require("@nomiclabs/hardhat-web3");
require("hardhat-deploy");
require("./tasks/link-proxies");

// This is a sample Buidler task. To learn how to create your own go to
// https://buidler.dev/guides/create-task.html
task("accounts", "Prints the list of accounts", async (_, { ethers }) => {
  const accounts = await ethers.getSigners();

  for (const account of accounts) {
    console.log(await account.getAddress());
  }
});

module.exports = {
  solidity: {
    version: "0.7.4",
    settings: {
      optimizer: {
        enabled: true,
        runs: 200,
      },
    },
  },
  paths: {
    sources: "./src",
  },
  networks: {
    hardhat: {
      live: false,
      saveDeployments: false,
      tags: ["test", "local"],
    },
    sokol: {
      chainId: 77,
      url: "https://sokol.poa.network/",
      accounts: [process.env.PRIVATE_KEY],
      live: true,
      saveDeployments: true,
      tags: ["staging"],
    },
    xdai: {
      chainId: 100,
      url: "https://rpc.xdaichain.com/",
      accounts: [process.env.PRIVATE_KEY],
      live: true,
      saveDeployments: true,
      tags: ["production"],
    },
    kovan: {
      chainId: 42,
      url: `https://kovan.infura.io/v3/${process.env.INFURA_API_KEY}`,
      accounts: [process.env.PRIVATE_KEY],
      live: true,
      saveDeployments: true,
      tags: ["staging"],
    },
    mainnet: {
      chainId: 1,
      url: `https://kovan.infura.io/v3/${process.env.INFURA_API_KEY}`,
      accounts: [process.env.MAINNET_PRIVATE_KEY],
      live: true,
      saveDeployments: true,
      tags: ["production"],
    },
  },
  namedAccounts: {
    deployer: {
      default: 0,
    },
  },
};
