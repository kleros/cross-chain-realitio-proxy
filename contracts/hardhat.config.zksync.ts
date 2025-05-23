import "dotenv/config";
import "@nomicfoundation/hardhat-toolbox";
import "@matterlabs/hardhat-zksync-deploy";
import "@matterlabs/hardhat-zksync-solc";
import "@matterlabs/hardhat-zksync-verify";
import "hardhat-deploy";
import "./tasks/update-deployments";
// import "./tasks/generate-metaevidence";

import type { HardhatUserConfig } from "hardhat/config";

const config: HardhatUserConfig = {
  solidity: {
    compilers: [
      {
        version: "0.8.25",
        settings: {
          optimizer: {
            enabled: true,
            runs: 200,
          },
        },
      },
    ],
  },
  zksolc: {
    version: "1.5.11",
    settings: {
      suppressedErrors: ["sendtransfer"],
    },
  },
  paths: {
    sources: "./src/0.8",
  },
  networks: {
    hardhat: {
      blockGasLimit: 100000000000,
      zksync: !process.env.TESTING,
    },
    // ----------------------------------------------------------------------------------------
    // Testnets
    // ----------------------------------------------------------------------------------------
    sepolia: {
      chainId: 11155111,
      url: `https://sepolia.infura.io/v3/${process.env.INFURA_API_KEY}`,
      // url: `http://127.0.0.1:8545`, // fork with `anvil --fork-url https://sepolia.infura.io/v3/${process.env.INFURA_API_KEY} --port 8545`
      accounts: [process.env.PRIVATE_KEY as string],
      tags: ["foreign"],
      companionNetworks: {
        homeZksync: "zkSyncSepolia",
      },
      verify: {
        etherscan: {
          apiUrl: "https://api-sepolia.etherscan.io/api",
          apiKey: process.env.ETHERSCAN_API_KEY,
        },
      },
    },
    zkSyncSepolia: {
      chainId: 300,
      url: "https://sepolia.era.zksync.dev",
      accounts: [process.env.PRIVATE_KEY as string],
      zksync: true,
      ethNetwork: "sepolia",
      tags: ["home"],
      companionNetworks: {
        foreign: "sepolia",
      },
      verifyURL: "https://block-explorer-api.sepolia.zksync.dev/api",
      verify: {
        etherscan: {
          apiUrl: "https://block-explorer-api.sepolia.zksync.dev/api",
        },
      },
    },
    // ----------------------------------------------------------------------------------------
    // Mainnets
    // ----------------------------------------------------------------------------------------
    mainnet: {
      chainId: 1,
      url: `https://mainnet.infura.io/v3/${process.env.INFURA_API_KEY}`,
      accounts: [process.env.PRIVATE_KEY as string],
      tags: ["foreign"],
      companionNetworks: {
        homeZksync: "zkSyncMainnet",
      },
      verify: {
        etherscan: {
          apiUrl: "https://api.etherscan.io/api",
          apiKey: process.env.ETHERSCAN_API_KEY,
        },
      },
    },
    zkSyncMainnet: {
      chainId: 324,
      url: "https://mainnet.era.zksync.io",
      accounts: [process.env.PRIVATE_KEY as string],
      zksync: true,
      ethNetwork: "mainnet",
      tags: ["home"],
      companionNetworks: {
        foreign: "mainnet",
      },
      verifyURL: "https://zksync2-mainnet-explorer.zksync.io/contract_verification",
      verify: {
        etherscan: {
          apiUrl: "https://zksync2-mainnet-explorer.zksync.io/contract_verification",
        },
      },
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
};

export default config;
