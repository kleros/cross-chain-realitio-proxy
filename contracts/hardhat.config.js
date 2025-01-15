require("dotenv/config");
const { task } = require("hardhat/config");
require("@nomiclabs/hardhat-waffle");
require("@nomiclabs/hardhat-ethers");
require("@nomiclabs/hardhat-web3");
require("hardhat-deploy");
require("hardhat-deploy-ethers");
require("./tasks/link-proxies");
require("@nomicfoundation/hardhat-verify");

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
    version: "0.7.6",
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
    chiado: {
      chainId: 10200,
      url: "https://rpc.chiado.gnosis.gateway.fm",
      accounts: [process.env.PRIVATE_KEY],
      live: true,
      saveDeployments: true,
      tags: ["staging"],
    },
    gnosis: {
      chainId: 100,
      url: "https://rpc.gnosis.gateway.fm",
      accounts: [process.env.PRIVATE_KEY, process.env.MAINNET_PRIVATE_KEY],
      live: true,
      saveDeployments: true,
      tags: ["production"],
    },
    sepolia: {
      chainId: 11155111,
      url: `https://sepolia.infura.io/v3/${process.env.INFURA_API_KEY}`,
      live: true,
      saveDeployments: true,
      accounts: [process.env.PRIVATE_KEY],
      tags: ["staging"],
    },
    mainnet: {
      chainId: 1,
      url: `https://mainnet.infura.io/v3/${process.env.INFURA_API_KEY}`,
      accounts: [process.env.MAINNET_PRIVATE_KEY, process.env.PRIVATE_KEY],
      live: true,
      saveDeployments: true,
      tags: ["production"],
    },
  },
  namedAccounts: {
    deployer: {
      default: 0,
    },
    counterPartyDeployer: {
      default: 0,
      gnosis: 1,
      mainnet: 1,
    },
  },
  etherscan: {
    apiKey: {
      chiado: process.env.GNOSIS_API_KEY,
      gnosis: process.env.GNOSIS_API_KEY,
      mainnet: process.env.ETHERSCAN_API_KEY,
      sepolia: process.env.ETHERSCAN_API_KEY,
    },
  },
};
