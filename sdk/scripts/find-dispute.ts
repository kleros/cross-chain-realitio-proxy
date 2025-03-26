import { createPublicClient, http, getContract } from "viem";
import { foreignProxyAbi } from "../src/contracts";

async function findDispute() {
  const foreignClient = createPublicClient({
    transport: http(
      "https://sepolia.infura.io/v3/64130c1881694608a40ce82ea1b80f7a",
    ),
  });

  const foreignProxy = getContract({
    address: "0x807f4D900E0c5B63Ed87a5C97f2B3482d82649eE",
    abi: foreignProxyAbi,
    client: foreignClient,
  });

  // Get the latest block
  const latestBlock = await foreignClient.getBlockNumber();
  console.log("Latest block:", latestBlock);

  // Look for ArbitrationCreated events around block 7746523
  const fromBlock = 7746523n - BigInt(1000);
  const toBlock = 7746523n + BigInt(1000);
  console.log("Searching from block:", fromBlock, "to block:", toBlock);

  const events = await foreignProxy.getEvents.ArbitrationCreated(
    {},
    { fromBlock, toBlock },
  );

  console.log(
    "Found events:",
    JSON.stringify(
      events,
      (_, value) => (typeof value === "bigint" ? value.toString() : value),
      2,
    ),
  );

  if (events.length > 0) {
    const disputeIDs = events.map((event) => event.args._disputeID?.toString());
    console.log("Found dispute IDs:", disputeIDs);
  } else {
    console.log("No disputes found in the last 1000 blocks");
  }
}

findDispute().catch(console.error);
