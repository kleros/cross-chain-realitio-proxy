// Adapted from https://github.com/RealityETH/reality-eth-monorepo/blob/5de7ca2957f604eed35a5357736ad5c297d7a302/packages/contracts/example.js

const realityeth_contracts = require("@reality.eth/contracts");
const { createPublicClient, http, getContract } = require("viem");

// The chain ID is usually either specified by the user or detected from metamask etc.
const chain_id = 1;
console.log(
  "Using chain",
  chain_id,
  realityeth_contracts.getChainLabel(chain_id),
);

// We provide some basic information about chains we support.
// This will include an RPC node and a Graph endpoint where available.
const chain_info = realityeth_contracts.chainData(chain_id);
console.log("Loaded chain info", chain_info);

const provider = createPublicClient({
  transport: http(chain_info.hostedRPC),
});

// The tokens are specified under tokens/
// If you don't know which token to use you can list the tokens on the current chain to let the user choose
const available_tokens = realityeth_contracts.chainTokenList(chain_id);
console.log("Available tokens on this chain are", available_tokens);

// Alternatively you can get the name of the default for the network, which will normally be the chain's native token (eg on XDAI, the XDAI token).
const default_token = realityeth_contracts.defaultTokenForChain(chain_id);
console.log("Default token is", default_token);

// Once you know your chain ID and token you can get the configuration information for reality.eth on that chain.
// The following will get you the currently recommended version, which will be the latest stable version:
const default_config = realityeth_contracts.realityETHConfig(chain_id, "ETH");
console.log("Default config is", default_config);

// If you want to specify the version, you can add a third parameter:
const version = "2.0";
const config = realityeth_contracts.realityETHConfig(chain_id, "ETH", version);
console.log("Config for version", version, config);

// Some features are only supported on some versions.
// You can check whether the current version has a feature with:
const has_min_bond = realityeth_contracts.versionHasFeature(
  version,
  "min-bond",
);
console.log("Version support for minimum bonds?", has_min_bond);
const has_reopen_question = realityeth_contracts.versionHasFeature(
  version,
  "reopen-question",
);
console.log("Version support for reopening questions?", has_reopen_question);

// You can get an instance of the contract with
const contract = realityeth_contracts.realityETHInstance(config);
console.log("Contract is", contract);

const contractClient = getContract({
  address: contract.address,
  abi: contract.abi,
  client: provider,
});

// Now we can query the contract. Here's the ID of a question that's already on mainnet:
const question_id =
  "0xa8fc96981fe9010d7ab5649af6a454202c7053b370f9ab84023277b5bfaf268e";

console.log("Querying the default RPC node", chain_info.hostedRPC);
contractClient.read.resultFor([question_id]).then((result) => {
  console.log("The result for question", question_id, "is", result);
});

const config2 = realityeth_contracts.configForAddress(
  "0x95b2b2b4b66A5a47Df79bF07BEBe72E9870fceb2",
  100,
);
console.log("Config for address", config2);

const contract2 = realityeth_contracts.realityETHInstance(config2);
console.log("Contract for address", contract2);

const templates = require("@reality.eth/contracts/config/templates.json");
console.log("Templates", templates.content);
