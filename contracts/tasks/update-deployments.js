const { task } = require("hardhat/config");
const axios = require("axios");

async function fetchContractABI({ apiURL, apiKey }, address) {
  const response = await axios.get(apiURL, {
    params: {
      module: "contract",
      action: "getabi",
      address,
      apikey: apiKey,
    },
  });

  if (response.data.status !== "1" || !response.data.result)
    throw new Error(`Failed to fetch ABI: ${response.data.message || "Unknown error"}`);

  return JSON.parse(response.data.result);
}

async function fetchContractInfo({ apiURL, apiKey }, address) {
  const response = await axios.get(apiURL, {
    params: {
      module: "contract",
      action: "getsourcecode",
      address,
      apikey: apiKey,
    },
  });

  if (response.data.status !== "1" || !response.data.result || !response.data.result[0])
    throw new Error(`Failed to fetch contract info: ${response.data.message || "Unknown error"}`);

  return response.data.result[0];
}

task("update-deployments", "Update deployments JSON with contract information")
  .addParam("homeProxy", "Address of the Realitio home proxy")
  .addParam("homeProxyTxHash", "Transaction hash of the home proxy deployment")
  .addParam("foreignProxyTxHash", "Transaction hash of the foreign proxy deployment")
  .setAction(async ({ homeProxy, homeProxyTxHash, foreignProxyTxHash }, { ethers, network, config }) => {
    // Get the contract instance to fetch its deployment details
    const provider = ethers.provider;

    const receipt = await provider.getTransactionReceipt(homeProxyTxHash);
    if (!receipt) throw new Error(`No transaction receipt found for ${homeProxyTxHash}`);

    const abi = await fetchContractABI(network.verify.etherscan, homeProxy);

    // Get the home proxy contract instance and fetch realitio address
    const homeProxyContract = await ethers.getContractAt(abi, homeProxy);
    const realitioAddress = await homeProxyContract.realitio();

    // Get Realitio contract name from Etherscan
    const realitioContractInfo = await fetchContractInfo(network.verify.etherscan, realitioAddress);
    const realitioContractName = realitioContractInfo.ContractName;

    // Try to get the token address
    let tokenAddress = "";
    try {
      const realitioContract = await ethers.getContractAt(
        ["function token() external view returns (address)"],
        realitioAddress
      );
      tokenAddress = await realitioContract.token();
    } catch (e) {
      // If the call fails, keep the empty string as default
    }

    // Get the foreign proxy address
    const foreignProxyAddress = await homeProxyContract.foreignProxy();

    // Get foreign proxy deployment details from the foreign network
    const foreignNetworkName = network.companionNetworks.foreign;
    if (!foreignNetworkName) throw new Error("No foreign network configured");

    const foreignNetworkUrl = config.networks[foreignNetworkName].url;
    if (!foreignNetworkUrl) throw new Error(`No RPC URL configured for network: ${foreignNetworkName}`);

    const foreignProvider = new ethers.JsonRpcProvider(foreignNetworkUrl);
    const foreignReceipt = await foreignProvider.getTransactionReceipt(foreignProxyTxHash);
    if (!foreignReceipt) throw new Error(`No transaction receipt found for ${foreignProxyTxHash}`);

    const foreignChainId = (await foreignProvider.getNetwork()).chainId.toString();

    // Get foreign proxy ABI from foreign network's Etherscan
    const foreignEtherscan = config.networks[foreignNetworkName].verify.etherscan;
    if (!foreignEtherscan || !foreignEtherscan.apiURL)
      throw new Error(`No Etherscan API URL configured for network: ${foreignNetworkName}`);

    const foreignProxyAbi = await fetchContractABI(foreignEtherscan, foreignProxyAddress);

    // Verify that the foreign proxy points back to our home proxy
    const foreignProxyContract = new ethers.Contract(foreignProxyAddress, foreignProxyAbi, foreignProvider);
    const foreignHomeProxy = await foreignProxyContract.homeProxy();
    if (foreignHomeProxy.toLowerCase() !== homeProxy.toLowerCase())
      throw new Error(`Foreign proxy home address mismatch: expected ${homeProxy}, got ${foreignHomeProxy}`);

    // Get and decode arbitrator extra data
    const extraData = await foreignProxyContract.arbitratorExtraData();
    const abiCoder = ethers.AbiCoder.defaultAbiCoder();
    const [courtId, minJurors] = abiCoder.decode(["uint96", "uint96"], extraData);

    const deploymentInfo = {
      versionNotes: "No appeals",
      deployments: [
        {
          name: "FIX ME",
          realitio: {
            contract: realitioContractName,
            address: realitioAddress,
            token: tokenAddress,
          },
          homeProxy: {
            address: homeProxy,
            blockNumber: receipt.blockNumber.toString(),
            transactionHash: receipt.hash,
          },
          foreignProxy: {
            courtId: courtId.toString(),
            minJurors: minJurors.toString(),
            address: foreignProxyAddress,
            chainId: foreignChainId,
            blockNumber: foreignReceipt.blockNumber.toString(),
            transactionHash: foreignReceipt.hash,
          },
        },
      ],
      homeProxyAbi: abi,
      foreignProxyAbi: foreignProxyAbi,
    };

    console.log(JSON.stringify(deploymentInfo, null, 2));
  });
