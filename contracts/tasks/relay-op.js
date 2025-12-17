const { task } = require("hardhat/config");

const {
  createPublicClient,
  createWalletClient,
  http,
} = require("viem");

const { privateKeyToAccount } = require("viem/accounts");

const {
  publicActionsL1,
  publicActionsL2,
  walletActionsL1,
  walletActionsL2,
} = require("viem/op-stack");
const { mainnet, sepolia, base, optimism, optimismSepolia, unichain, unichainSepolia, redstone, baseSepolia } = require("viem/chains");

// https://docs.optimism.io/app-developers/tutorials/bridging/cross-dom-solidity#interact-with-the-l2-greeter

task("relay-op", "Relays a withdrawal on OP Stack")
  .addParam("txhash", "The withdrawal tx hash from L2")
  .setAction(async ({ txhash }, hre) => {
    console.log(`Relaying OP-stack withdrawal: ${txhash}`);

    const rawPk = process.env.PRIVATE_KEY;
    if (!rawPk) throw new Error("PRIVATE_KEY missing in .env");

    const PRIVATE_KEY = rawPk.startsWith("0x") ? rawPk : `0x${rawPk}`;
    const CHAIN_MAP = {
      8453: { l2: base, l1: mainnet, l1NetworkName: "mainnet" },
      84532: { l2: baseSepolia, l1: sepolia, l1NetworkName: "sepolia" },
      690: { l2: redstone, l1: mainnet, l1NetworkName: "mainnet" },
      10: { l2: optimism, l1: mainnet, l1NetworkName: "mainnet" },
      130: { l2: unichain, l1: mainnet, l1NetworkName: "mainnet" },
      11155420: { l2: optimismSepolia, l1: sepolia, l1NetworkName: "sepolia" },
      1301: { l2: unichainSepolia, l1: sepolia, l1NetworkName: "sepolia" },
    };

    const chainId = hre.network.config.chainId;
    const chain = CHAIN_MAP[chainId];
    const l1RpcUrl = hre.config.networks[chain.l1NetworkName].url;
    const l2RpcUrl = hre.network.config.url;

    const account = privateKeyToAccount(PRIVATE_KEY);

    // L1 clients
    const l1Public = createPublicClient({
      chain: chain.l1,
      transport: http(l1RpcUrl),
    }).extend(publicActionsL1());

    const l1Wallet = createWalletClient({
      account,
      chain: chain.l1,
      transport: http(l1RpcUrl),
    }).extend(walletActionsL1());

    // L2 clients
    const l2Public = createPublicClient({
      chain: chain.l2,
      transport: http(l2RpcUrl),
    }).extend(publicActionsL2());

    const l2Wallet = createWalletClient({
      account,
      chain: chain.l2,
      transport: http(l2RpcUrl),
    }).extend(walletActionsL2());

    // Retrieve L2 tx
    const receipt = await l2Public.getTransactionReceipt({ hash: txhash });
    const status = await l1Public.getWithdrawalStatus({
      receipt,
      targetChain: l2Public.chain,
    });

    console.log(`Withdrawal status: ${status}`);

    const { output, withdrawal } = await l1Public.waitToProve({
      receipt,
      targetChain: l2Public.chain,
    });

    // Only prove if necessary
    // Note that proving the message resets the 1 week timeout each time, so this condition is mandatory.
    if (status === "waiting-to-prove" || status === "ready-to-prove") {
      console.log("Proving withdrawal...");
      
      const proveArgs = await l2Public.buildProveWithdrawal({
        account,
        output,
        withdrawal
      });

      // Note that proof cant be obtained with Infura RPC
      await l1Wallet.proveWithdrawal(proveArgs);
      console.log("Proven ✅");
    }

    if (status === "ready-to-finalize") {
      // Not required by this script but keep in case bots need it
      /*
      console.log("Waiting until message becomes relayable...");
      await l1Public.waitToFinalize({
        targetChain: l2Public.chain,
        withdrawalHash: receipt.transactionHash
      });*/

      console.log("Finalizing withdrawal...");
      await l1Wallet.finalizeWithdrawal({
        targetChain: l2Wallet.chain,
        withdrawal,
      });
      console.log("Done ✅");
    } else if (status === "waiting-to-finalize") {
      console.log("Not ready to finalize yet");
    }

    if (status === "finalized") {
      console.log("Already finalized. Nothing to do.");
      return;
    }
  });
