# Manual Actions for L2 → L1 Bridging
For Reality Cross-chain proxies L1 → L2 bridging is automatic for every bridge.  
However, L2 → L1 bridging requires manual steps, which differ by chain.  
Use this guide until bots are configured to handle everything automatically.


## Gnosis
After sending a transaction from L2 (e.g., `handleNotifiedRequest`), refer to this page:  
https://docs.gnosischain.com/bridges/using-amb

It's recommended to use **Blockscout** instead of GnosisScan due to possible encoding issues.

Before using `getSignatures` on the `AMBHelper` contract, wait until the message is processed  
(usually within an hour). After that, `getSignatures` will return a result you can pass into  
`executeSignatures`.


## Polygon
After sending the L2 transaction you'll need to manually call `receiveMessage`  
on `foreignProxy` contract.

The argument for the function can be obtained from this template URL (usually generated in **1–3 hours**):

```
https://proof-generator.polygon.technology/api/v1/matic/exit-payload/<your_L2_tx_hash>?eventSignature=0x8c5261668696ce22758910d05bab8f186d6eb247ceac2af2e82c7dc17669b036
```

This URL contains:
- Your L2 tx hash that you need to manually insert
- The event signature required by Polygon API (same for every tx, belongs to `messageSent` event)

More details:  
https://github.com/0xPolygon/fx-portal?tab=readme-ov-file#proof-generation


## zkSync
After sending the tx to L1, check its status on zkSync Etherscan.  
When the status becomes **"Executed"** (usually in 2-4 hours), use the script:

https://github.com/kleros/cross-chain-realitio-proxy/blob/master/contracts/scripts/execute_proof.js

Steps:
1. Insert your `txHash` into the script.
2. Run `yarn zksync:proof:production` from  `contracts` folder.

This script retrieves the proof and executes the tx on L1 automatically.

Requirements:
- `yarn install`
- `.env` file setup (`PRIVATE_KEY`, `INFURA_API_KEY`)

zkSync docs:  
https://code.zksync.io/tutorials/how-to-send-l2-l1-message

If the status is "Executed" but proof is `null`, wait longer.  
Once executed successfully, a dispute will be created on KlerosCourt with `ForeignProxy` as arbitrable.


## Arbitrum
Execution occurs only after the **one-week challenge period** has passed, thus a week after sending a tx to L1, navigate to `contracts` folder and run:

```
yarn relay:production --txhash <your_tx_hash>
```

Requirements:
- `yarn install`
- `.env` file setup (`PRIVATE_KEY`, `INFURA_API_KEY`)

Note: this task currently works only with **ethers v5**

Official docs page:  
https://docs.arbitrum.io/build-decentralized-apps/cross-chain-messaging  
https://github.com/OffchainLabs/arbitrum-tutorials/blob/master/packages/outbox-execute/scripts/exec.js


## Optimism (Base, Redstone, Unichain, etc.)
After sending the L2 tx run the command corresponding to the chosen chain, e.g.:

```
yarn relay-op:base --txhash <your_tx_hash>
```

You must run this command **twice**:
1. Shortly after sending the tx (usually within an hour), to prove the message. Console should show `Proven` if successful
2. One week later, to finalize it

Requirements:
- `yarn install`
- `.env` file setup (`PRIVATE_KEY`, `INFURA_API_KEY`, `ALCHEMY_API_KEY`)

Extra notes:
- Optimism stack requires `eth_getProof`, unsupported by Infura therefore **Alchemy** is used for L2 RPC.
- L1 RPC can still use Infura.

Official docs page:  
https://docs.optimism.io/app-developers/tutorials/bridging/cross-dom-solidity#interact-with-the-l2-greeter
