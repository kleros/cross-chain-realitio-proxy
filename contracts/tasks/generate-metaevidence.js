const fs = require("node:fs");
const path = require("node:path");
const { task, types } = require("hardhat/config");

task("generate-metaevidence", "Generates metaevidence.json with populated chain IDs")
  .addParam("deployment", "Name of the home network to deploy to", undefined, types.string)
  .addOptionalParam(
    "termsOfService",
    "Key for the terms of service to use",
    "default",
    types.string
  )
  .setAction(async (taskArgs, hre) => {
    // Get the network configuration for the deployment
    const homeNetwork = hre.config.networks[taskArgs.deployment];
    if (!homeNetwork) {
      throw new Error(`Network ${taskArgs.deployment} not found in configuration`);
    }

    // Verify it's a home network
    if (!homeNetwork.tags?.includes("home")) {
      throw new Error(`Network ${taskArgs.deployment} is not tagged as "home"`);
    }

    // Get the foreign network configuration
    const foreignNetworkName = homeNetwork.companionNetworks?.foreign;
    if (!foreignNetworkName) {
      throw new Error(`No foreign network configured for ${taskArgs.deployment}`);
    }

    const foreignNetwork = hre.config.networks[foreignNetworkName];
    if (!foreignNetwork) {
      throw new Error(`Foreign network ${foreignNetworkName} not found in configuration`);
    }

    const { generatePolicyUri, getMetaEvidenceFilename } = require("../deploy/shared");
    const fileURI = generatePolicyUri(taskArgs.termsOfService.toLowerCase());

    const template = {
      _v: "1.0.0",
      category: "Oracle",
      title: "A reality.eth question",
      description: "A reality.eth question has been raised to arbitration.",
      question: "Give an answer to the question.",
      evidenceDisplayInterfaceURI:
        "/ipfs/Qmc6ptmVbihmBXiYzryME9HNEezJf6ndw8ZrYo2qz72gto/index.html",
      dynamicScriptURI: "/ipfs/QmcRGGmzzxSvXaajMCFYErZb5knuexoaDCZhJ5rSHRbcvw",
      fileURI: fileURI,
      arbitrableChainID: homeNetwork.chainId.toString(),
      arbitratorChainID: foreignNetwork.chainId.toString(),
      dynamicScriptRequiredParams: [
        "disputeID",
        "arbitrableChainID",
        "arbitrableJsonRpcUrl",
        "arbitrableContractAddress",
      ],
      evidenceDisplayInterfaceRequiredParams: [
        "disputeID",
        "arbitrableChainID",
        "arbitrableJsonRpcUrl",
        "arbitrableContractAddress",
      ],
    };

    const filename = getMetaEvidenceFilename(taskArgs.deployment, taskArgs.termsOfService);
    try {
      const dir = path.join(__dirname, "..", "metaevidences");
      if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
      }
      fs.writeFileSync(path.join(dir, filename), JSON.stringify(template, null, 2));
    } catch (error) {
      throw new Error(`Failed to write metaevidence file: ${error.message}`);
    }

    console.log(`Generated metaevidences/${filename} with:`);
    console.log(`- Home Network: ${taskArgs.deployment} (Chain ID: ${homeNetwork.chainId})`);
    console.log(`- Foreign Network: ${foreignNetworkName} (Chain ID: ${foreignNetwork.chainId})`);
    console.log(`- Terms of Service: ${fileURI}`);
  });
