const { task } = require("hardhat/config");
const axios = require("axios");
const { version } = require("../package.json");
const fs = require("fs");
const path = require("path");

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
  .addParam("name", "Name of the deployment (e.g. Gnosis, Optimism)")
  .addParam("homeProxy", "Address of the Realitio home proxy")
  .addParam("homeProxyTxHash", "Transaction hash of the home proxy deployment")
  .addParam("foreignProxyTxHash", "Transaction hash of the foreign proxy deployment")
  .addOptionalParam("contractVersion", "Version of the deployment", version)
  .addOptionalParam("homeProxyBlockNumber", "Block number of the home proxy deployment")
  .addOptionalParam("foreignProxyBlockNumber", "Block number of the foreign proxy deployment")
  .setAction(
    async (
      {
        homeProxy,
        homeProxyTxHash,
        foreignProxyTxHash,
        name,
        contractVersion,
        homeProxyBlockNumber,
        foreignProxyBlockNumber,
      },
      { ethers, network, config }
    ) => {
      // Get the contract instance to fetch its deployment details
      const provider = ethers.provider;

      // Get home proxy deployment details
      if (!homeProxyBlockNumber) {
        const receipt = await provider.getTransactionReceipt(homeProxyTxHash);
        if (!receipt) throw new Error(`No transaction receipt found for ${homeProxyTxHash}`);
        homeProxyBlockNumber = receipt.blockNumber;
      }

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

      // Get foreign proxy deployment details
      if (!foreignProxyBlockNumber) {
        const foreignReceipt = await foreignProvider.getTransactionReceipt(foreignProxyTxHash);
        if (!foreignReceipt) throw new Error(`No transaction receipt found for ${foreignProxyTxHash}`);
        foreignProxyBlockNumber = foreignReceipt.blockNumber;
      }

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
        version: contractVersion,
        versionNotes: "FIX ME",
        deployments: [
          {
            name,
            realitio: {
              contract: realitioContractName,
              address: realitioAddress,
              token: tokenAddress,
            },
            homeProxy: {
              address: homeProxy,
              blockNumber: homeProxyBlockNumber.toString(),
              transactionHash: homeProxyTxHash,
            },
            foreignProxy: {
              courtId: courtId.toString(),
              minJurors: minJurors.toString(),
              address: foreignProxyAddress,
              chainId: foreignChainId,
              blockNumber: foreignProxyBlockNumber.toString(),
              transactionHash: foreignProxyTxHash,
            },
          },
        ],
        homeProxyAbi: abi,
        foreignProxyAbi: foreignProxyAbi,
      };

      // Output to stdout
      console.log(JSON.stringify(deploymentInfo, null, 2));

      // Write to file
      const deploymentsDir = path.join(__dirname, "..", "deployments", network.name);
      fs.mkdirSync(deploymentsDir, { recursive: true });
      const filePath = path.join(deploymentsDir, `RealitioProxy-v${contractVersion}.json`);

      if (fs.existsSync(filePath)) {
        console.log(`\nFile exists: ${filePath}`);
        const existingContent = JSON.parse(fs.readFileSync(filePath, "utf8"));

        // Validate ABIs match
        if (JSON.stringify(existingContent.homeProxyAbi) !== JSON.stringify(abi)) {
          throw new Error("Home proxy ABI in existing file doesn't match current ABI");
        }
        if (JSON.stringify(existingContent.foreignProxyAbi) !== JSON.stringify(foreignProxyAbi)) {
          throw new Error("Foreign proxy ABI in existing file doesn't match current ABI");
        }

        // Check if deployment with this home proxy already exists
        const existingDeployment = existingContent.deployments.find(
          (d) => d.homeProxy.address.toLowerCase() === homeProxy.toLowerCase()
        );
        if (existingDeployment) {
          throw new Error(`Deployment with home proxy ${homeProxy} already exists in ${filePath}`);
        }

        // Merge deployments
        deploymentInfo.deployments = [...existingContent.deployments, deploymentInfo.deployments[0]];
        console.log(
          "Appending new deployment to existing ones:",
          deploymentInfo.deployments.map((d) => d.name).join(", ")
        );
      }

      fs.writeFileSync(filePath, JSON.stringify(deploymentInfo, null, 2));
      console.log(`\nDeployment info written to: ${filePath}`);
    }
  );

task("update-deployments-from-artifact", "Update deployments JSON using deployment artifacts")
  .addParam("homeProxy", "Path to the home proxy deployment artifact")
  .addParam("foreignProxy", "Path to the foreign proxy deployment artifact")
  .addParam("name", "Name of the deployment (e.g. Gnosis, Optimism)")
  .addOptionalParam("contractVersion", "Version of the deployment", version)
  .setAction(async ({ homeProxy, foreignProxy, name, contractVersion }, { run }) => {
    const homeArtifact = JSON.parse(fs.readFileSync(homeProxy, "utf8"));
    const foreignArtifact = JSON.parse(fs.readFileSync(foreignProxy, "utf8"));

    if (!homeArtifact.address || !homeArtifact.transactionHash)
      throw new Error(`Invalid home proxy artifact: missing address or transactionHash`);
    if (!foreignArtifact.transactionHash) throw new Error(`Invalid foreign proxy artifact: missing transactionHash`);

    await run("update-deployments", {
      name,
      homeProxy: homeArtifact.address,
      homeProxyTxHash: homeArtifact.transactionHash,
      homeProxyBlockNumber: homeArtifact.receipt.blockNumber.toString(),
      foreignProxyTxHash: foreignArtifact.transactionHash,
      foreignProxyBlockNumber: foreignArtifact.receipt.blockNumber.toString(),
      contractVersion,
    });
  });
