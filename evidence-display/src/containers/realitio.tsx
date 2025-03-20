import { useEffect, useState } from 'react'
import { createPublicClient, http, getContract } from 'viem'
import { populatedJSONForTemplate } from '@reality.eth/reality-eth-lib/formatters/question'

import RealityLogo from '../assets/images/reality_eth_logo.png'
import { homeProxyAbi, foreignProxyAbi, realitioAbi } from './abis'
import {
  ArbitrationCreatedLog,
  LogNewQuestionLog,
  LogNewTemplateLog,
  arbitrationCreatedEvent,
  logNewQuestionEvent,
  logNewTemplateEvent,
} from '../types/reality-eth-events'

console.log('evidence-display version', process.env.VERSION)

const REALITY_STARTS_AT = {
  '0x325a2e0f3cca2ddbaebb4dfc38df8d19ca165b47': 6531265, // Reality 2.0 Mainnet
  '0x5b7dd1e86623548af054a4985f7fc8ccbb554e2c': 13194676, // Reality 3.0 Mainnet
  '0xaf33dcb6e8c5c4d9ddf579f53031b514d19449ca': 3044431, // Reality 3.0 Sepolia
  '0x79e32ae03fb27b07c89c0c568f80287c01ca2e57': 14005802, // Reality 2.1 Gnosis
  '0xe78996a233895be74a66f451f1019ca9734205cc': 17997262, // Reality 3.0 Gnosis
  '0x1E732a1C5e9181622DD5A931Ec6801889ce66185': 10438389, // Reality 3.0 Chiado,
  '0x60573b8dce539ae5bf9ad7932310668997ef0428': 18901674, // Reality 3.0 Polygon
  '0x5d18bd4dc5f1ac8e9bd9b666bd71cb35a327c4a9': 459975, // Reality 3.0 ArbitrumOne
  '0xB78396EFaF0a177d125e9d45B2C6398Ac5f803B9': 41977012, // Reality 3.0 ArbitrumSepolia
  '0xA8AC760332770FcF2056040B1f964750e4bEf808': 9691, // Reality 3.0 zkSyncMain
  '0x4E346436e99fb7d6567A2bd024d8806Fc10d84D2': 255658, // Reality 3.0 zkSyncSepolia
  '0x0eF940F7f053a2eF5D6578841072488aF0c7d89A': 2462149, // Reality 3.0 Optimism,
  '0xeAD0ca922390a5E383A9D5Ba4366F7cfdc6f0dbA': 14341474, // Reality 3.0 OptimismSepolia
  '0xc716c23D75f523eF0C511456528F2A1980256a87': 3034954, // Reality 3.0 Redstone
  '0x8bF08aE62cbC9a48aaeB473a82DAE2e6D2628517': 10747559, // Reality 3.0 UnichainSepolia,
  '0xB920dBedE88B42aA77eE55ebcE3671132ee856fC': 8561869, // Reality 3.0 Unichain
  '0x2F39f464d16402Ca3D8527dA89617b73DE2F60e8': 26260675, // Reality 3.0 Base
} as const

interface QuestionState {
  questionID: `0x${string}`
  chainID: string
  realitioContractAddress: `0x${string}`
  rawQuestion: string
  rawTemplate: string
}

export function RealitioDisplayInterface() {
  const [questionState, setQuestionState] = useState<QuestionState | null>(null)

  useEffect(() => {
    const fetchQuestionData = async () => {
      if (window.location.search[0] !== '?') return

      const message = Object.fromEntries(
        new URLSearchParams(decodeURIComponent(window.location.search.substring(1)))
      )
      console.debug(message)

      const {
        arbitrableContractAddress,
        disputeID,
        arbitratorChainID,
        arbitrableChainID,
        chainID,
        arbitratorJsonRpcUrl,
        arbitrableJsonRpcUrl,
        jsonRpcUrl,
      } = message

      console.log(arbitrableContractAddress)
      const rpcURL = arbitrableJsonRpcUrl || arbitratorJsonRpcUrl || jsonRpcUrl
      const cid = arbitrableChainID || arbitratorChainID || chainID

      if (!rpcURL || !disputeID || !cid) {
        console.error('Evidence display is missing critical information.')
        return
      }

      const foreignClient = createPublicClient({
        transport: http(arbitratorJsonRpcUrl || jsonRpcUrl),
      })

      const foreignProxy = getContract({
        address: arbitrableContractAddress as `0x${string}`,
        abi: foreignProxyAbi,
        client: foreignClient,
      })

      const homeClient = createPublicClient({
        transport: http(arbitrableJsonRpcUrl || jsonRpcUrl),
      })

      const homeProxyAddress = await foreignProxy.read.homeProxy()
      const homeProxy = getContract({
        address: homeProxyAddress,
        abi: homeProxyAbi,
        client: homeClient,
      })

      const realitioContractAddress = await homeProxy.read.realitio()
      const realitio = getContract({
        address: realitioContractAddress,
        abi: [...realitioAbi, { type: 'function', name: 'templates', inputs: [{ type: 'uint256' }], outputs: [{ type: 'uint256' }], stateMutability: 'view' }] as const,
        client: homeClient,
      })

      const arbitrationCreatedBlock = await foreignProxy.read.arbitrationCreatedBlock([BigInt(disputeID)])
      const arbitrationCreatedLogs = (await foreignClient.getLogs({
        address: arbitrableContractAddress as `0x${string}`,
        events: [arbitrationCreatedEvent],
        fromBlock: arbitrationCreatedBlock,
        toBlock: arbitrationCreatedBlock,
      })) as ArbitrationCreatedLog[]

      const questionID = arbitrationCreatedLogs[0].args._questionID
      const questionEventLogs = (await homeClient.getLogs({
        address: realitioContractAddress,
        events: [logNewQuestionEvent],
        fromBlock: BigInt(
          Object.keys(REALITY_STARTS_AT).includes(realitioContractAddress.toLowerCase())
            ? REALITY_STARTS_AT[realitioContractAddress.toLowerCase() as keyof typeof REALITY_STARTS_AT]
            : 0
        ),
        toBlock: 'latest',
      })) as LogNewQuestionLog[]

      const filteredQuestionLogs = questionEventLogs.filter(
        (log) => log.args.question_id === questionID
      )

      if (filteredQuestionLogs.length === 0) {
        console.error('Question not found')
        return
      }

      const templateID = filteredQuestionLogs[0].args.template_id
      let templateText: string
      if (Number(templateID) < 5) {
        // first 5 templates are part of reality.eth spec, hardcode for faster loading
        templateText = [
          '{"title": "%s", "type": "bool", "category": "%s", "lang": "%s"}',
          '{"title": "%s", "type": "uint", "decimals": 18, "category": "%s", "lang": "%s"}',
          '{"title": "%s", "type": "single-select", "outcomes": [%s], "category": "%s", "lang": "%s"}',
          '{"title": "%s", "type": "multiple-select", "outcomes": [%s], "category": "%s", "lang": "%s"}',
          '{"title": "%s", "type": "datetime", "category": "%s", "lang": "%s"}',
        ][Number(templateID)]
      } else {
        const templateCreationBlock = await realitio.read.templates([templateID])
        const templateEventLogs = (await homeClient.getLogs({
          address: realitioContractAddress,
          events: [logNewTemplateEvent],
          fromBlock: templateCreationBlock,
          toBlock: templateCreationBlock,
        })) as LogNewTemplateLog[]

        const filteredTemplateLogs = templateEventLogs.filter(
          (log) => log.args.template_id === templateID
        )

        if (filteredTemplateLogs.length === 0) {
          console.error('Template not found')
          return
        }

        templateText = filteredTemplateLogs[0].args.question_text
      }

      console.log(filteredQuestionLogs[0].args.question)
      console.log(templateText)
      console.log(populatedJSONForTemplate(filteredQuestionLogs[0].args.question, templateText))

      setQuestionState({
        questionID,
        chainID: cid,
        realitioContractAddress,
        rawQuestion: filteredQuestionLogs[0].args.question,
        rawTemplate: templateText,
      })
    }

    void fetchQuestionData()
  }, [])

  if (!questionState) return null

  const { questionID, chainID, realitioContractAddress, rawQuestion, rawTemplate } = questionState

  return (
    <div className="bg-[#f0f4f8] p-4 font-roboto">
      <div>
        <img src={RealityLogo} alt="Logo of reality.eth" className="max-w-full" />
      </div>
      <hr
        className="h-[3px] border-none bg-gradient-to-r from-[#24b3ec] via-[#24b3ec] to-[#dcfb6c]"
        style={{
          backgroundSize: 'contain',
          color: '#27b4ee',
          background:
            'linear-gradient(45deg, #24b3ec 0%, #24b3ec 93%, #b9f9fb  93%, #b9f9fb  95%, #dcfb6c 95%)',
        }}
      />
      <div className="my-4 text-lg leading-relaxed break-words">
        {populatedJSONForTemplate(rawTemplate, rawQuestion).title}
      </div>
      <a
        className="text-[#2093ff]"
        href={`https://reality.eth.limo/app/index.html#!/network/${chainID}/question/${realitioContractAddress}-${questionID}`}
        target="_blank"
        rel="noopener noreferrer"
      >
        See on reality.eth
      </a>
    </div>
  )
}

export default RealitioDisplayInterface 