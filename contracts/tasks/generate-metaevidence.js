const fs = require("fs")
const path = require("path")
const { task, types } = require("hardhat/config")

task("generate-metaevidence", "Generates metaevidence.json with populated chain IDs")
  .addParam("deployment", "Name of the home network to deploy to", undefined, types.string)
  .setAction(async (taskArgs, hre) => {
    // Get the network configuration for the deployment
    const homeNetwork = hre.config.networks[taskArgs.deployment]
    if (!homeNetwork) {
      throw new Error(`Network ${taskArgs.deployment} not found in configuration`)
    }

    // Verify it's a home network
    if (!homeNetwork.tags?.includes("home")) {
      throw new Error(`Network ${taskArgs.deployment} is not tagged as "home"`)
    }

    // Get the foreign network configuration
    const foreignNetworkName = homeNetwork.companionNetworks?.foreign
    if (!foreignNetworkName) {
      throw new Error(`No foreign network configured for ${taskArgs.deployment}`)
    }

    const foreignNetwork = hre.config.networks[foreignNetworkName]
    if (!foreignNetwork) {
      throw new Error(`Foreign network ${foreignNetworkName} not found in configuration`)
    }

    const template = {
      "_v": "1.0.0",
      "category": "Oracle",
      "title": "A reality.eth question",
      "description": "A reality.eth question has been raised to arbitration.",
      "question": "Give an answer to the question.",
      "evidenceDisplayInterfaceURI": "/ipfs/Qmacx3RzVgVE54FfQnRbAotwjqPFZGhn5rEVP5GEJD2tAw/index.html",
      "dynamicScriptURI": "/ipfs/QmRqZ56yvPeWR42RqobUqHpxMixV5kfqrEEpBYuMSgKqoa",
      "fileURI": "/ipfs/QmNV5NWwCudYKfiHuhdWxccrPyxs4DnbLGQace2oMKHkZv/Question_Resolution_Policy.pdf",
      "arbitrableChainID": homeNetwork.chainId.toString(),
      "arbitratorChainID": foreignNetwork.chainId.toString(),
      "dynamicScriptRequiredParams": [
        "disputeID",
        "arbitrableChainID",
        "arbitrableJsonRpcUrl",
        "arbitrableContractAddress"
      ],
      "evidenceDisplayInterfaceRequiredParams": [
        "disputeID",
        "arbitrableChainID",
        "arbitrableJsonRpcUrl",
        "arbitrableContractAddress"
      ]
    }

    const filename = `metaevidence-${taskArgs.deployment}.json`
    fs.writeFileSync(
      path.join(__dirname, "..", filename),
      JSON.stringify(template, null, 2)
    )

    console.log(`Generated ${filename} with:`)
    console.log(`- Home Network: ${taskArgs.deployment} (Chain ID: ${homeNetwork.chainId})`)
    console.log(`- Foreign Network: ${foreignNetworkName} (Chain ID: ${foreignNetwork.chainId})`)
  }) 