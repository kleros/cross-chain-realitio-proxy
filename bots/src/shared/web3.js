import Web3 from "web3";

const homeRpcEndpoints = {
  77: "https://sokol.poa.network/",
  100: "https://rpc.xdaichain.com/",
};

const HOME_CHAIN_ID = process.env.HOME_CHAIN_ID ?? "100";

export const homeWeb3 = new Web3(new Web3.providers.HttpProvider(homeRpcEndpoints[HOME_CHAIN_ID]));

const foreignRpcEndpoints = {
  1: `https://mainnet.infura.io/v3/${process.env.INFURA_API_KEY}`,
  4: `https://rinkeby.infura.io/v3/${process.env.INFURA_API_KEY}`,
  42: `https://kovan.infura.io/v3/${process.env.INFURA_API_KEY}`,
};

const FOREIGN_CHAIN_ID = process.env.FOREIGN_CHAIN_ID ?? "4";

export const foreignWeb3 = new Web3(new Web3.providers.HttpProvider(foreignRpcEndpoints[FOREIGN_CHAIN_ID]));
