const { providers, Wallet } = require("ethers");
const { L2TransactionReceipt, L2ToL1MessageStatus } = require("@arbitrum/sdk");
const { task } = require("hardhat/config");

/**
 * Set up: instantiate L1 wallet connected to provider
 */

const walletPrivateKey = process.env.PRIVATE_KEY;

task("exec", "Execute msg on L1")
  .addParam("txhash", "Hash of txn that triggered and L2 to L1 message")
  .setAction(async (taskArgs, hre) => {
    const { txhash } = taskArgs;

    await arbLog("Outbox Execution");

    const foreignNetworks = {
      42161: hre.config.networks.mainnet,
      421614: hre.config.networks.sepolia,
    };
    const chainId = hre.network.config.chainId;
    const url = foreignNetworks[chainId];

    const l1Provider = new providers.JsonRpcProvider(url);
    const l2Provider = new providers.JsonRpcProvider(hre.network.config.url);

    const l1Wallet = new Wallet(walletPrivateKey, l1Provider);

    /**
   / * We start with a txn hash; we assume this is transaction that triggered an L2 to L1 Message on L2 (i.e., ArbSys.sendTxToL1)
  */
    if (!txhash)
      throw new Error(
        "Provide a transaction hash of an L2 transaction that sends an L2 to L1 message"
      );
    if (!txhash.startsWith("0x") || txhash.trim().length != 66)
      throw new Error(`Hmm, ${txhash} doesn't look like a txn hash...`);

    /**
     * First, let's find the Arbitrum txn from the txn hash provided
     */
    const receipt = await l2Provider.getTransactionReceipt(txhash);
    const l2Receipt = new L2TransactionReceipt(receipt);

    /**
     * Note that in principle, a single transaction could trigger any number of outgoing messages; the common case will be there's only one.
     * For the sake of this script, we assume there's only one / just grad the first one.
     */
    const messages = await l2Receipt.getL2ToL1Messages(l1Wallet);
    const l2ToL1Msg = messages[0];

    /**
     * Check if already executed
     */
    if ((await l2ToL1Msg.status(l2Provider)) == L2ToL1MessageStatus.EXECUTED) {
      console.log(`Message already executed! Nothing else to do here`);
      process.exit(1);
    }

    /**
     * before we try to execute out message, we need to make sure the l2 block it's included in is confirmed! (It can only be confirmed after the dispute period; Arbitrum is an optimistic rollup after-all)
     * waitUntilReadyToExecute() waits until the item outbox entry exists
     */
    const timeToWaitMs = 1000 * 60;
    console.log(
      "Waiting for the outbox entry to be created. This only happens when the L2 block is confirmed on L1, ~1 week after it's creation."
    );
    await l2ToL1Msg.waitUntilReadyToExecute(l2Provider, timeToWaitMs);
    console.log("Outbox entry exists! Trying to execute now");

    /**
     * Now that its confirmed and not executed, we can execute our message in its outbox entry.
     */
    const res = await l2ToL1Msg.execute(l2Provider);
    const rec = await res.wait();
    console.log("Done! Your transaction is executed", rec);
  });

const wait = (ms = 0) => {
  return new Promise((res) => setTimeout(res, ms || 0));
};

const arbLog = async (text) => {
  let str = "🔵";
  for (let i = 0; i < 25; i++) {
    await wait(40);
    if (i == 12) {
      str = `🔵${"🔵".repeat(i)}🔵`;
    } else {
      str = `🔵${" ".repeat(i * 2)}🔵`;
    }
    while (str.length < 60) {
      str = ` ${str} `;
    }

    console.log(str);
  }

  console.log("Arbitrum Demo:", text);
  await wait(2000);

  console.log("Lets");
  await wait(1000);

  console.log("Go ➡️");
  await wait(1000);
  console.log("...🚀");
  await wait(1000);
  console.log("");
};
