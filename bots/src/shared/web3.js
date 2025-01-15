import Web3 from "web3";

const homeRpcEndpoints = {
  100: "https://rpc.gnosis.gateway.fm",
  10200: "https://rpc.chiado.gnosis.gateway.fm",
};

const HOME_CHAIN_ID = process.env.HOME_CHAIN_ID ?? "100";

export const homeWeb3 = new Web3(new Web3.providers.HttpProvider(homeRpcEndpoints[HOME_CHAIN_ID]));

const foreignRpcEndpoints = {
  1: `https://mainnet.infura.io/v3/${process.env.INFURA_API_KEY}`,
  11155111: `https://sepolia.infura.io/v3/${process.env.INFURA_API_KEY}`,
};

const FOREIGN_CHAIN_ID = process.env.FOREIGN_CHAIN_ID ?? "4";

export const foreignWeb3 = new Web3(new Web3.providers.HttpProvider(foreignRpcEndpoints[FOREIGN_CHAIN_ID]));
