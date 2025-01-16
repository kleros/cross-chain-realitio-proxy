# Cross-Chain Realitio Proxy

Enables cross-chain arbitration for Realitio (Reality.eth) using Kleros as arbitrator.

## Supported Chains

### Mainnets
- Gnosis
- Optimism and other OP stack chains: Unichain, Redstone
- Arbitrum
- Polygon PoS
- ZkSync

### Testnets
The testnet of the above chains except Redstone.

## High-Level Flow Description

1. Alice requests arbitration on the main chain paying the arbitration fee to the ETH proxy and indicates the maximum value of the bond for the question (A.K.A. `max_previous`).
1. The ETH proxy communicates the request to the Gnosis proxy through the AMB.
1. The Gnosis tries to notify Realitio of the arbitration request and forwards the `max_previous` value:
   1. If the bond has not changed, the arbitration request will be accepted.
      1. Notify the ETH proxy through the AMB.
   1. Otherwise, if it changed then:
      1. Notify the ETH proxy through the AMB.
      1. The ETH proxy refunds Alice. **END**
1. In the mean time while Realitio was being notified of the arbitration request, the arbitration fees might have changed:
   1. If the fees stayed the same (most common case) then:
      1. Create a dispute on Kleros Court.
   1. If the fees have decreased then:
      1. Create a dispute on Kleros Court.
      1. Refund Alice of the difference.
   1. If the fees have increased, then the arbitration request will fail:
      1. Refund Alice of the value paid so far.
      1. The ETH proxy notifies the Gnosis proxy through the AMB that the arbitration failed to be created.
      1. The Gnosis proxy notifies Realitio of the failed arbitration. **END**
1. The Kleros court gives a ruling. It is relayed to the Gnosis proxy through the AMB.
   1. If the ruling is the current answer, Bob, the last answerer, is the winner. **END**
   1. If it is not, Alice is the winner. **END**

## Deployed Addresses

See [contracts/README.md](contracts/README.md#deployed-addresses).

## Contributing

### Repo Structure

Each directory at the root of this repository contains code for each individual part that enables this integration:

- **`bots/`**: service to automate some steps of the flow which otherwise would required manual intervention from users.
  - **Notice:** while this is a centralized service, it exists only for convenience. Users can fulfill the role of the bots if they wish to.
- **`contracts/`**: Smart contracts to enable cross-chain arbitration for Realitio (Reality.eth). [Learn more](contracts/README.md).
- **`dynamic-script/`**: allows fetching the dynamic content for the arbitration, as described by [ERC-1497: Evidence Standard](https://github.com/ethereum/EIPs/issues/1497).
- **`evidence-display/`**: display interface that should be used to render the evidence for arbitrators, as described by [ERC-1497: Evidence Standard](https://github.com/ethereum/EIPs/issues/1497).

### Adding support for a new chain

#### 0. Preliminary
* Get the Reality.eth contract **address** and deployment **block number** from the [Reality monorepo](https://github.com/RealityETH/reality-eth-monorepo/tree/main/packages/contracts/chains/deployments).

#### 1. Hardhat configuration
* Add the new chain configuration to hardhat.config.
* Make sure to add the correct **tag** (home or foreign) and the correct **companion network** for the home and foreign networks (so that both networks have a companion network referring to the other). The deployment scripts rely on them.
* In `package.json`, add the extra convenience scripts: `metaevidence:xxx` , `deploy:xxx`

#### 2. Contracts code
* Build the bridging logic in the proxies if needed. 
  * E.g. for an OP L2 it is not needed, the logic is the same for all OP L2s and is already implemented.
* Test, review etc

#### 3. Dynamic & Evidence scripts
* Add the Reality.eth contract and deployment block number to the script files [here](https://github.com/kleros/cross-chain-realitio-proxy-optimism/blob/1ed08c3ea06ef00398b02f64d1657de3d4ac50c8/dynamic-script/src/index.js#L8) and [here](https://github.com/kleros/cross-chain-realitio-proxy-optimism/blob/1ed08c3ea06ef00398b02f64d1657de3d4ac50c8/evidence-display/src/containers/realitio.js#L10). 
* `yarn build`
* Upload the file `dynamic-script/dist/realitio-dynamic-script-vx.x.x.js` to IPFS.
* Upload the folder `evidence-display/evidence-display-vx.x.x` to IPFS.

#### 4. MetaEvidence
* [In this script](https://github.com/kleros/cross-chain-realitio-proxy-optimism/blob/1ed08c3ea06ef00398b02f64d1657de3d4ac50c8/contracts/tasks/generate-metaevidence.js#L36-L37), update the CIDs with the latest dynamic and evidence scripts uploaded to IPFS in the above steps.
* Run `yarn metaevidence:xxx` for the new chain
* Upload the resulting metaevidence-xxx.json to IPFS

#### 5. Contracts deployment
* Configuration:
  * In the home and foreign proxy deployment script, add a configuration object to `params` .
  * The home script needs the Reality contract address.
  * The foreign script needs the desired courtId and number of jurors (arbitratorExtraData), the L1 bridge address (messenger) and the metaEvidence IPFS URI (from earlier step).
* Deploy and verify with `yarn deploy:xxx`.
* Update the contracts README by running `./scripts/populateReadme.sh`, expand the script if needed.
* Make sure to commit to `deployments` folder to git.

#### 6. Adding support to the Court v1
* Add support for the new chain (because the dynamic/evidence scripts need a RPC provided by the court).
* Whitelist the newly deployed arbitrable.
