import { useEffect, useState } from 'react'
import { fetchRealityQuestionData } from '@kleros/cross-chain-realitio-dynamic-script/lib'
import type { RealityQuestionData } from '@kleros/cross-chain-realitio-dynamic-script/lib'
import RealityLogo from '../assets/images/reality_eth_logo.png'

console.log('evidence-display version', process.env.VERSION)

export function RealitioDisplayInterface() {
  const [questionState, setQuestionState] = useState<RealityQuestionData | null>(null)

  useEffect(() => {
    const fetchData = async () => {
      if (window.location.search[0] !== '?') return

      const params = Object.fromEntries(
        new URLSearchParams(decodeURIComponent(window.location.search.substring(1)))
      )

      const {
        arbitrableContractAddress,
        disputeID,
        arbitratorChainID,
        arbitrableChainID,
        chainID,
        arbitratorJsonRpcUrl,
        arbitrableJsonRpcUrl,
        jsonRpcUrl,
      } = params

      if (!arbitrableContractAddress || !disputeID || !(arbitrableChainID || arbitratorChainID || chainID)) {
        console.error('Evidence display is missing critical information.')
        return
      }

      try {
        const data = await fetchRealityQuestionData({
          disputeID,
          arbitrableContractAddress: arbitrableContractAddress as `0x${string}`,
          arbitrableJsonRpcUrl,
          arbitratorJsonRpcUrl,
          jsonRpcUrl,
        })
        setQuestionState(data)
      } catch (error) {
        console.error('Failed to fetch question data:', error)
      }
    }

    void fetchData()
  }, [])

  if (!questionState) return null

  const { questionID, realitioAddress, questionData } = questionState
  const chainID = new URLSearchParams(window.location.search).get('chainID') ||
    new URLSearchParams(window.location.search).get('arbitrableChainID') ||
    new URLSearchParams(window.location.search).get('arbitratorChainID')

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
        {questionData.title}
      </div>
      <a
        className="text-[#2093ff]"
        href={`https://reality.eth.limo/app/index.html#!/network/${chainID}/question/${realitioAddress}-${questionID}`}
        target="_blank"
        rel="noopener noreferrer"
      >
        See on reality.eth
      </a>
    </div>
  )
}

export default RealitioDisplayInterface 