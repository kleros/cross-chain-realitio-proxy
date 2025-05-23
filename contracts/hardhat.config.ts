import "dotenv/config";
import "@nomicfoundation/hardhat-toolbox";
import "hardhat-deploy";
import "hardhat-deploy-ethers";
import "./tasks/generate-metaevidence";
import "./tasks/relay-arbitrum";
import "./tasks/find-dispute-id";
import "./tasks/update-deployments";

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
  paths: {
    sources: "./src/0.8",
  },
  networks: {
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
        homeGnosis: "chiado",
        homeUnichain: "unichainSepolia",
        homeOptimism: "optimismSepolia",
        homeArbitrum: "arbitrumSepolia",
        homePolygon: "amoy",
      },
      verify: {
        etherscan: {
          apiUrl: "https://api-sepolia.etherscan.io/api",
          apiKey: process.env.ETHERSCAN_API_KEY,
        },
      },
    },
    chiado: {
      chainId: 10200,
      url: "https://rpc.chiado.gnosis.gateway.fm",
      // url: `http://127.0.0.1:8546`, // fork with `anvil --fork-url https://rpc.chiado.gnosis.gateway.fm --port 8546`
      accounts: [process.env.PRIVATE_KEY as string],
      tags: ["home"],
      companionNetworks: {
        foreign: "sepolia",
      },
      verify: {
        etherscan: {
          apiUrl: "https://gnosis-chiado.blockscout.com/api",
        },
      },
    },
    unichainSepolia: {
      chainId: 1301,
      url: "https://sepolia.unichain.org/",
      // url: `http://127.0.0.1:8546`, // fork with `anvil --fork-url https://sepolia.unichain.org --port 8546`
      accounts: [process.env.PRIVATE_KEY as string],
      tags: ["home"],
      companionNetworks: {
        foreign: "sepolia",
      },
      verify: {
        etherscan: {
          apiUrl: "https://api-sepolia.uniscan.xyz/api",
          apiKey: process.env.UNISCAN_API_KEY,
        },
      },
    },
    optimismSepolia: {
      chainId: 11155420,
      url: `https://optimism-sepolia.infura.io/v3/${process.env.INFURA_API_KEY}`,
      // url: `http://127.0.0.1:8547`, // fork with `anvil --fork-url https://optimism-sepolia.infura.io/v3/${process.env.INFURA_API_KEY} --port 8547`
      accounts: [process.env.PRIVATE_KEY as string],
      tags: ["home"],
      companionNetworks: {
        foreign: "sepolia",
      },
      verify: {
        etherscan: {
          apiUrl: "https://api-sepolia-optimistic.etherscan.io/api",
          apiKey: process.env.OPTIMISM_API_KEY,
        },
      },
    },
    arbitrumSepolia: {
      chainId: 421614,
      url: `https://arbitrum-sepolia.infura.io/v3/${process.env.INFURA_API_KEY}`,
      // url: `http://127.0.0.1:8548`, // fork with `anvil --fork-url https://arbitrum-sepolia.infura.io/v3/${process.env.INFURA_API_KEY} --port 8548`
      accounts: [process.env.PRIVATE_KEY as string],
      tags: ["home"],
      companionNetworks: {
        foreign: "sepolia",
      },
      verify: {
        etherscan: {
          apiUrl: "https://api-sepolia.arbiscan.io/api",
          apiKey: process.env.ARBISCAN_API_KEY,
        },
      },
    },
    amoy: {
      chainId: 80002,
      url: "https://rpc-amoy.polygon.technology",
      // url: `http://127.0.0.1:8549`, // fork with `anvil --fork-url https://rpc-amoy.polygon.technology --port 8549`
      accounts: [process.env.PRIVATE_KEY as string],
      tags: ["home"],
      companionNetworks: {
        foreign: "sepolia",
      },
      verify: {
        etherscan: {
          apiUrl: "https://api-amoy.polygonscan.com/api",
          apiKey: process.env.POLYGONSCAN_API_KEY,
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
        homeGnosis: "gnosis",
        homeUnichain: "unichain",
        homeOptimism: "optimism",
        homeRedstone: "redstone",
        homeBase: "base",
        homeArbitrum: "arbitrum",
        homePolygon: "polygon",
      },
      verify: {
        etherscan: {
          apiUrl: "https://api.etherscan.io/api",
          apiKey: process.env.ETHERSCAN_API_KEY,
        },
      },
    },
    gnosis: {
      chainId: 100,
      url: `https://gnosis-mainnet.g.alchemy.com/v2/${process.env.ALCHEMY_API_KEY}`,
      accounts: [process.env.PRIVATE_KEY as string],
      tags: ["home"],
      companionNetworks: {
        foreign: "mainnet",
      },
      verify: {
        etherscan: {
          apiUrl: "https://api.gnosisscan.io/api",
          apiKey: process.env.GNOSISSCAN_API_KEY,
        },
      },
    },
    unichain: {
      chainId: 130,
      url: "https://unichain-rpc.publicnode.com",
      accounts: [process.env.PRIVATE_KEY as string],
      tags: ["home"],
      companionNetworks: {
        foreign: "mainnet",
      },
      verify: {
        etherscan: {
          apiUrl: "https://api.uniscan.xyz/api",
          apiKey: process.env.UNISCAN_API_KEY,
        },
      },
    },
    optimism: {
      chainId: 10,
      url: `https://optimism-mainnet.infura.io/v3/${process.env.INFURA_API_KEY}`,
      accounts: [process.env.PRIVATE_KEY as string],
      tags: ["home"],
      companionNetworks: {
        foreign: "mainnet",
      },
      verify: {
        etherscan: {
          apiUrl: "https://api-optimistic.etherscan.io/api",
          apiKey: process.env.OPTIMISM_API_KEY,
        },
      },
    },
    redstone: {
      chainId: 690,
      url: "https://rpc.redstonechain.com",
      accounts: [process.env.PRIVATE_KEY as string],
      tags: ["home"],
      companionNetworks: {
        foreign: "mainnet",
      },
      verify: {
        etherscan: {
          apiUrl: "https://api.redstone.xyz/api",
          apiKey: process.env.REDSTONE_API_KEY,
        },
      },
    },
    base: {
      chainId: 8453,
      url: `https://base-mainnet.infura.io/v3/${process.env.INFURA_API_KEY}`,
      accounts: [process.env.PRIVATE_KEY as string],
      tags: ["home"],
      companionNetworks: {
        foreign: "mainnet",
      },
      verify: {
        etherscan: {
          apiUrl: "https://api.basescan.org/api",
          apiKey: process.env.BASESCAN_API_KEY,
        },
      },
    },
    arbitrum: {
      chainId: 42161,
      url: `https://arbitrum-mainnet.infura.io/v3/${process.env.INFURA_API_KEY}`,
      accounts: [process.env.PRIVATE_KEY as string],
      tags: ["home"],
      companionNetworks: {
        foreign: "mainnet",
      },
      verify: {
        etherscan: {
          apiUrl: "https://api.arbiscan.io/api",
          apiKey: process.env.ARBISCAN_API_KEY,
        },
      },
    },
    polygon: {
      chainId: 137,
      url: `https://polygon-mainnet.infura.io/v3/${process.env.INFURA_API_KEY}`,
      accounts: [process.env.PRIVATE_KEY as string],
      tags: ["home"],
      companionNetworks: {
        foreign: "mainnet",
      },
      verify: {
        etherscan: {
          apiUrl: "https://api.polygonscan.com/api",
          apiKey: process.env.POLYGONSCAN_API_KEY,
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
