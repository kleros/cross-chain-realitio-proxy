# @kleros/cross-chain-realitio-contracts

Smart contracts for the Reality.eth cross-chain proxies.

## Deployments

Refresh the list of deployed contracts by running `./scripts/generateDeploymentsMarkdown.sh` or `./scripts/populateReadme.sh`.

### Testnets

#### UnichainSepolia

- Butter 
  - [Home Proxy](https://sepolia.uniscan.xyz/address/0x8FeAB350A304140b1593A38a13607d122BEC44b6)
  - [Foreign Proxy](https://sepolia.etherscan.io/address/0x807f4D900E0c5B63Ed87a5C97f2B3482d82649eE)


### Mainnets

#### Unichain

- Unichain default 
  - [Home Proxy](https://uniscan.xyz/address/0x05295972F75cFeE7fE66E6BDDC0435c9Fd083D18)
  - [Foreign Proxy](https://etherscan.io/address/0x8FeAB350A304140b1593A38a13607d122BEC44b6)


#### Base

- Base default 
  - [Home Proxy](https://basescan.org/address/0x05295972F75cFeE7fE66E6BDDC0435c9Fd083D18)
  - [Foreign Proxy](https://etherscan.io/address/0x05295972F75cFeE7fE66E6BDDC0435c9Fd083D18)


## Contributing

### Install Dependencies

```bash
yarn install
```

### Run Tests

```bash
yarn test
```

### Compile the Contracts

```bash
yarn build
```

### Deploy Instructions

**IMPORTANT:** new versions of any of the contracts require publishing **both** Home and Foreign proxies, as their binding is immutable.

**NOTICE:** the commands bellow work only if you are inside the `contracts/` directory.

#### 0. Set the Environment Variables

Copy `.env.example` file as `.env` and edit it accordingly.

```bash
cp .env.example .env
```

Set the following env vars:
- `PRIVATE_KEY`: the private key of the deployer account.
- `INFURA_API_KEY`: the API key for infura.
- `ETHERSCAN_API_KEY`: the API key to verify the contracts on Etherscan.

#### 1. Update the Constructor Parameters (optional)

If some of the constructor parameters (such as the Meta Evidence) needs to change, you need to update the files in the `deploy/` directory.

#### 2. Deploy the Proxies

```bash
yarn deploy:chiado:home
yarn deploy:chiado:foreign
```

The deployed addresses should be output to the screen after the deployment is complete.
If you miss that, you can always go to the `deployments/<network>` directory and look for the respective file.

