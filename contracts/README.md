# @kleros/cross-chain-realitio-contracts

Smart contracts to enable cross-chain arbitration for Realitio (Reality.eth)

## Deployed Addresses

### Home Proxy

- Sokol: [deployment](deployments/sokol/RealitioHomeArbitrationProxy.json#L2).
- xDai: `<none>`

### Foreign Proxy

- Kovan: [deployment](deployments/kovan/RealitioForeignArbitrationProxy.json#L2).
- Mainnet: `<none>`

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

### Run Linter on Files

```bash
yarn lint
```

### Fix Linter Issues on Files

```bash
yarn fix
```

### Deploy Instructions

**IMPORTANT:** new versions of any of the contracts require publishing **both** Home and Foreign proxies, as their binding is immutable.

**NOTICE:** the commands bellow work only if you are inside the `contracts/` directory.

#### 1. Deploy the Home Proxy

```
yarn deploy --network <sokol|xdai> --reset
```

#### 2. Deploy the Foreign Proxy

```
yarn deploy --network <kovan|mainnet> --reset
```

#### 3. Link the Proxies Together

Instead of providing the specific network, here you must pass the _environment_ of the contracts:

- **staging**: means the Kovan/Sokol pair
- **production**: means the Mainnet/xDAI pair

```
y hardhat link-proxies --env <staging|production>
```

Answer _yes_ for the questions.

#### 4. Initialize the Foreign Proxy

The Foreign Proxy must be properly initialized before being able to receive arbitration requests.

Instead of providing the specific network, here you must pass the _environment_ of the contracts:

- **staging**: means the Kovan/Sokol pair
- **production**: means the Mainnet/xDAI pair

```
y hardhat initialize-foreign-proxy --env <staging|production> --meta-evidence <IPFS path for the meta evidence> --terms-of-service <IPFS path for the terms of service>
```

Answer _yes_ for the questions.
