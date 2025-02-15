const { task } = require("hardhat/config");
const axios = require("axios");
const { version } = require("../package.json");
const fs = require("fs");
const path = require("path");

async function fetchContractABI({ apiURL, apiKey }, address) {
  const params = {
    module: "contract",
    action: "getabi",
    address,
  };
  if (apiKey) params.apikey = apiKey;

  const url = new URL(apiURL);
  url.search = new URLSearchParams(params).toString();
  console.log("Full URL:", url.toString());

  const response = await axios.get(apiURL, { params });

  if (response.data.status !== "1" || !response.data.result)
    throw new Error(`Failed to fetch ABI: ${response.data.message || "Unknown error"}`);

  return JSON.parse(response.data.result);
}

async function fetchContractInfo({ apiURL, apiKey }, address) {
  console.log("fetching contract info", apiURL, apiKey, address);
  const params = {
    module: "contract",
    action: "getsourcecode",
    address,
  };
  if (apiKey) params.apikey = apiKey;

  const url = new URL(apiURL);
  url.search = new URLSearchParams(params).toString();
  console.log("Full URL:", url.toString());

  const response = await axios.get(apiURL, { params });

  if (response.data.status !== "1" || !response.data.result || !response.data.result[0])
    throw new Error(`Failed to fetch contract info: ${response.data.message || "Unknown error"}`);

  return response.data.result[0];
}

task("add-deployment", "Add a deployment to the deployments JSON")
  .addParam("name", "Name of the deployment (e.g. Gnosis, Optimism)")
  .addParam("homeProxy", "Address of the Realitio home proxy")
  .addParam("homeProxyTxHash", "Transaction hash of the home proxy deployment")
  .addParam("foreignProxyTxHash", "Transaction hash of the foreign proxy deployment")
  .addOptionalParam("contractVersion", "Version of the deployment", version)
  .addOptionalParam("homeProxyBlockNumber", "Block number of the home proxy deployment")
  .addOptionalParam("foreignProxyBlockNumber", "Block number of the foreign proxy deployment")
  .addFlag("force", "Force update if deployment already exists")
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
        force,
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

      const homeProxyAbi = await fetchContractABI(network.verify.etherscan, homeProxy);

      // Get the home proxy contract instance and fetch realitio address
      const homeProxyContract = await ethers.getContractAt(homeProxyAbi, homeProxy);
      const realitioAddress = await homeProxyContract.realitio();
      const metadata = await homeProxyContract.metadata();
      let tos = "";
      try {
        const parsedMetadata = JSON.parse(metadata || "{}");
        tos = parsedMetadata.tos ? parsedMetadata.tos.replace("ipfs://", "https://cdn.kleros.link/ipfs/") : "";
      } catch (e) {
        console.warn("Failed to parse metadata or access tos field:", e.message);
      }

      // Get Realitio contract name from Etherscan
      const realitioContractInfo = await fetchContractInfo(network.verify.etherscan, realitioAddress);
      let realitioContractName =
        (realitioContractInfo.ContractName && realitioContractInfo.ContractName.trim()) || "RealityUnverified";
      realitioContractName = realitioContractName.includes(":") // Example: contracts/RealityETH-3.0.sol:RealityETH_zksync_v3_0
        ? realitioContractName.split(":").pop()
        : realitioContractName;

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
      try {
        const foreignHomeProxy = await foreignProxyContract.homeProxy();
        if (foreignHomeProxy.toLowerCase() !== homeProxy.toLowerCase())
          throw new Error(`Foreign proxy home address mismatch: expected ${homeProxy}, got ${foreignHomeProxy}`);
      } catch (e) {
        console.warn(`Warning: Could not verify foreign proxy's home address - contract may be legacy: ${e.message}`);
      }

      // Get the MetaEvidence event from foreign proxy contract
      const metaEvidenceFilter = foreignProxyContract.filters.MetaEvidence();
      const metaEvidenceEvents = await foreignProxyContract.queryFilter(
        metaEvidenceFilter,
        Number(foreignProxyBlockNumber)
      );
      if (metaEvidenceEvents.length === 0) throw new Error("No MetaEvidence event found");
      const metaevidence = `https://cdn.kleros.link${metaEvidenceEvents[0].args[1]}`;

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
              tos,
              blockNumber: homeProxyBlockNumber.toString(),
              transactionHash: homeProxyTxHash,
            },
            foreignProxy: {
              courtId: courtId.toString(),
              minJurors: minJurors.toString(),
              metaevidence,
              address: foreignProxyAddress,
              chainId: foreignChainId,
              blockNumber: foreignProxyBlockNumber.toString(),
              transactionHash: foreignProxyTxHash,
            },
          },
        ],
        homeProxyAbi,
        foreignProxyAbi,
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
        if (JSON.stringify(existingContent.homeProxyAbi) !== JSON.stringify(homeProxyAbi)) {
          throw new Error("Home proxy ABI in existing file doesn't match current ABI");
        }
        if (JSON.stringify(existingContent.foreignProxyAbi) !== JSON.stringify(foreignProxyAbi)) {
          throw new Error("Foreign proxy ABI in existing file doesn't match current ABI");
        }

        // Check if deployment with this home proxy already exists
        const existingDeploymentIndex = existingContent.deployments.findIndex(
          (d) => d.homeProxy.address.toLowerCase() === homeProxy.toLowerCase()
        );

        if (existingDeploymentIndex !== -1) {
          if (!force) {
            throw new Error(`Deployment with home proxy ${homeProxy} already exists in ${filePath}`);
          }
          // Replace the existing deployment if force is true, but preserve versionNotes
          deploymentInfo.versionNotes = existingContent.versionNotes;
          console.log(`Force flag enabled - replacing existing deployment for ${homeProxy}`);
          existingContent.deployments[existingDeploymentIndex] = deploymentInfo.deployments[0];
          deploymentInfo.deployments = existingContent.deployments;
        } else {
          // Merge deployments if no existing deployment found
          deploymentInfo.versionNotes = existingContent.versionNotes;
          deploymentInfo.deployments = [...existingContent.deployments, deploymentInfo.deployments[0]];
          console.log(
            "Appending new deployment to existing ones:",
            deploymentInfo.deployments.map((d) => d.name).join(", ")
          );
        }
      }

      fs.writeFileSync(filePath, JSON.stringify(deploymentInfo, null, 2));
      console.log(`\nDeployment info written to: ${filePath}`);
    }
  );

task("add-deployment-from-artifact", "Add a deployment to the deployments JSON using deployment artifacts")
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

    await run("add-deployment", {
      name,
      homeProxy: homeArtifact.address,
      homeProxyTxHash: homeArtifact.transactionHash,
      homeProxyBlockNumber: homeArtifact.receipt.blockNumber.toString(),
      foreignProxyTxHash: foreignArtifact.transactionHash,
      foreignProxyBlockNumber: foreignArtifact.receipt.blockNumber.toString(),
      contractVersion,
    });
  });

task("update-deployments", "Update all deployments from existing deployment files").setAction(
  async (_, { run, network }) => {
    const deploymentsDir = path.join(__dirname, "..", "deployments", network.name);

    // Check if directory exists
    if (!fs.existsSync(deploymentsDir)) {
      console.log(`No deployments directory found for network ${network.name}`);
      return;
    }

    // Find all RealitioProxy JSON files
    const files = fs.readdirSync(deploymentsDir).filter((file) => file.match(/^RealitioProxy-v.*\.json$/));

    if (files.length === 0) {
      console.log(`No RealitioProxy deployment files found in ${deploymentsDir}`);
      return;
    }

    for (const file of files) {
      const filePath = path.join(deploymentsDir, file);
      console.log(`\nProcessing ${file}...`);

      const content = JSON.parse(fs.readFileSync(filePath, "utf8"));
      const contractVersion = content.version;

      for (const deployment of content.deployments) {
        console.log(`\nUpdating deployment for ${deployment.name}...`);

        await run("add-deployment", {
          name: deployment.name,
          homeProxy: deployment.homeProxy.address,
          homeProxyTxHash: deployment.homeProxy.transactionHash,
          homeProxyBlockNumber: deployment.homeProxy.blockNumber,
          foreignProxyTxHash: deployment.foreignProxy.transactionHash,
          foreignProxyBlockNumber: deployment.foreignProxy.blockNumber,
          contractVersion,
          force: true,
        });
      }
    }
  }
);
