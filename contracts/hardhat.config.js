require("dotenv/config");
require("@nomicfoundation/hardhat-toolbox");
require("hardhat-deploy");
require("./tasks/generate-metaevidence");

module.exports = {
  solidity: {
    compilers: [
      {
        version: "0.7.6",
        settings: {
          optimizer: {
            enabled: true,
            runs: 200,
          },
        },
      },
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
  paths: {
    sources: "./src",
  },
  networks: {
    // ----------------------------------------------------------------------------------------
    // Testnets
    // ----------------------------------------------------------------------------------------
    sepolia: {
      chainId: 11155111,
      url: `https://sepolia.infura.io/v3/${process.env.INFURA_API_KEY}`,
      // url: `http://127.0.0.1:8545`, // fork with `anvil --fork-url https://sepolia.infura.io/v3/${process.env.INFURA_API_KEY} --port 8545`
      accounts: [process.env.PRIVATE_KEY],
      tags: ["foreign"],
      companionNetworks: {
        homeGnosis: "chiado",
        homeUnichain: "unichainSepolia",
        homeOptimism: "optimismSepolia",
      },
      verify: {
        etherscan: {
          apiURL: "https://api-sepolia.etherscan.io/api",
          apiKey: process.env.ETHERSCAN_API_KEY,
        },
      },
    },
    chiado: {
      chainId: 10200,
      url: "https://rpc.chiado.gnosis.gateway.fm",
      accounts: [process.env.PRIVATE_KEY],
      tags: ["home"],
      companionNetworks: {
        foreign: "sepolia",
      },
      verify: {
        etherscan: {
          apiURL: "https://gnosis-chiado.blockscout.com",
        },
      },
    },
    unichainSepolia: {
      chainId: 1301,
      url: `https://sepolia.unichain.org/`,
      // url: `http://127.0.0.1:8546`, // fork with `anvil --fork-url https://sepolia.unichain.org --port 8546`
      accounts: [process.env.PRIVATE_KEY],
      tags: ["home"],
      companionNetworks: {
        foreign: "sepolia",
      },
      verify: {
        etherscan: {
          apiURL: "https://api-sepolia.uniscan.xyz/api",
          apiKey: process.env.UNISCAN_API_KEY,
        },
      },
    },
    optimismSepolia: {
      chainId: 11155420,
      url: `https://optimism-sepolia.infura.io/v3/${process.env.INFURA_API_KEY}`,
      // url: `http://127.0.0.1:8547`, // fork with `anvil --fork-url https://optimism-sepolia.infura.io/v3/${process.env.INFURA_API_KEY} --port 8547`
      accounts: [process.env.PRIVATE_KEY],
      tags: ["home"],
      companionNetworks: {
        foreign: "sepolia",
      },
      verify: {
        etherscan: {
          apiURL: "https://api-sepolia-optimistic.etherscan.io/api",
          apiKey: process.env.OPTIMISM_API_KEY,
        },
      },
    },
    // ----------------------------------------------------------------------------------------
    // Mainnets
    // ----------------------------------------------------------------------------------------
    mainnet: {
      chainId: 1,
      url: `https://mainnet.infura.io/v3/${process.env.INFURA_API_KEY}`,
      accounts: [process.env.PRIVATE_KEY],
      tags: ["foreign"],
      companionNetworks: {
        homeGnosis: "gnosis",
        homeUnichain: "unichain",
        homeOptimism: "optimism",
        homeRedstone: "redstone",
      },
      verify: {
        etherscan: {
          apiURL: "https://api.etherscan.io/api",
          apiKey: process.env.ETHERSCAN_API_KEY,
        },
      },
    },
    gnosis: {
      chainId: 100,
      url: "https://rpc.gnosis.gateway.fm",
      accounts: [process.env.PRIVATE_KEY],
      tags: ["home"],
      companionNetworks: {
        foreign: "mainnet",
      },
      verify: {
        etherscan: {
          apiURL: "https://api.gnosisscan.com/api",
          apiKey: process.env.GNOSIS_API_KEY,
        },
      },
    },
    unichain: {
      chainId: 130,
      url: `https://FIXME.unichain.org/`,
      accounts: [process.env.PRIVATE_KEY],
      tags: ["home"],
      companionNetworks: {
        foreign: "mainnet",
      },
      verify: {
        etherscan: {
          apiURL: "https://api.uniscan.xyz/api",
          apiKey: process.env.UNISCAN_API_KEY,
        },
      },
    },
    optimism: {
      chainId: 10,
      url: `https://optimism.infura.io/v3/${process.env.INFURA_API_KEY}`,
      accounts: [process.env.PRIVATE_KEY],
      tags: ["home"],
      companionNetworks: {
        foreign: "mainnet",
      },
      verify: {
        etherscan: {
          apiURL: "https://api.optimistic.etherscan.io/api",
          apiKey: process.env.OPTIMISM_API_KEY,
        },
      },
    },
    redstone: {
      chainId: 690,
      url: `https://rpc.redstonechain.com`,
      accounts: [process.env.PRIVATE_KEY],
      tags: ["home"],
      companionNetworks: {
        foreign: "mainnet",
      },
      verify: {
        etherscan: {
          apiURL: "https://api.redstone.xyz/api",
          apiKey: process.env.REDSTONE_API_KEY,
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
