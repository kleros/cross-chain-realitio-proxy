# @kleros/cross-chain-realitio-contracts

Smart contracts for the Reality.eth cross-chain proxies.

## Deployments

Refresh the list of deployed contracts by running `./scripts/generateDeploymentsMarkdown.sh` or `./scripts/populateReadme.sh`.

### Testnets

#### Chiado

- [RealitioHomeArbitrationProxy](https://gnosis-chiado.blockscout.com/address/0xE620947519E8102aa625BBB4669fE317c9FffeD7)
- [RealitioForeignProxyWithAppealsGnosis](https://sepolia.etherscan.io/address/0x5d7cB72B31C080CF2de5f57fd38DedBeaf969D42)


#### UnichainSepolia

- [RealitioHomeProxyUnichain](https://sepolia.uniscan.xyz/address/0x8FeAB350A304140b1593A38a13607d122BEC44b6)
- [RealitioForeignProxyUnichain](https://sepolia.etherscan.io/address/0x807f4D900E0c5B63Ed87a5C97f2B3482d82649eE)


#### OptimismSepolia

- [RealitioHomeProxyOptimism](https://sepolia-optimism.etherscan.io/address/0xFe0eb5fC686f929Eb26D541D75Bb59F816c0Aa68)
- [RealitioForeignProxyOptimism](https://sepolia.etherscan.io/address/0x6a41AF8FC7f68bdd13B2c7D50824Ed49155DC3bA)


#### ArbitrumSepolia

- [RealitioHomeProxyArbitrum](https://sepolia.arbiscan.io/address/0x890deB4111F92fE9447e83aBEF1b754372d6770e)
- [RealitioForeignProxyArbitrum](https://sepolia.etherscan.io/address/0x26222Ec1F548953a4fEaE4C5A216337E26A821F9)


### Mainnets

#### Gnosis

- [RealitioHomeArbitrationProxy](https://gnosisscan.io/address/0x88Fb25D399310c07d35cB9091b8346d8b1893aa5)
- [RealitioForeignProxyGnosis](https://etherscan.io/address/0x79d0464Ec27F67663DADf761432fC8DD0AeA3D49)
- [RealitioForeignProxyWithAppealsGnosis](https://etherscan.io/address/0x32bcDC9776692679CfBBf8350BAd67Da13FaaA3F)

#### Polygon

- [RealitioHomeProxyPolygon](https://polygonscan.com/address/0x5AFa42b30955f137e10f89dfb5EF1542a186F90e)
- [RealitioForeignProxyPolygon](https://etherscan.io/address/0x776e5853e3d61B2dFB22Bcf872a43bF9A1231e52)


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

