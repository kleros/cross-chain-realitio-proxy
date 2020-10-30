# Cross-Chain Realitio Proxy

Enables cross-chain arbitration for Realition (Reality.eth) on xDAI or other AMB-compatible networks using Kleros as arbitrator.

## High-Level Flow Description

1. Alice requests arbitration on the main chain paying the arbitration fee to the ETH proxy and indicates the current answer she deems to be **incorrect**.
1. The ETH proxy communicates the request (questionID, currentAnswer) to the xDAI proxy through the AMB.
1. The xDAI proxy looks at the current answer on Realitio:
    1. If it **is the same** as the one pointed by Alice and it **is not** final then:
        1. Notify Realitio of the dispute.
        1. Notify the ETH proxy through the AMB.
    1. Otherwise, if it became a **different answer** then:
        1. Notify the ETH proxy through the AMB.
        1. The ETH proxy refunds Alice. **END**
1. At this point Realitio has been notified of arbitration. However arbitration fees might have changed:
    1. If the fees stayed the same (most common case) then:
        1. Create a dispute on Kleros Court.
    1. If the fees have decreased then:
        1. Create a dispute on Kleros Court.
        1. Refund Alice of the difference.
    1. If the fees have increased, then the arbitration request will fail:
        1. Refund Alice of the value paid so far.
        1. The ETH proxy notifies the xDAI proxy through the AMB that the arbitration failed to be created.
        1. The xDAI proxy notifies Realitio of the failed arbitration. **END**
1. The Kleros court gives a ruling. It is relayed to the xDAI proxy through the AMB.
    1. If the ruling is the current answer, Bob, the last answerer, is the winner. **END**
    1. If it is not, Alice is the winner. **END**

## Deployed Addresses

### Home Proxy

- Sokol: `<none>`
- xDai: `<none>`

### Foreign Proxy

- Kovan: `<none>`
- Mainnet: `<none>`

## Contributing

### Repo Structure

Each directory at the root of this repository contains code for each individual part that enables this integration:

- **`bots/`**: service to automate some steps of the flow which otherwise would required manual intervention from users.
    - **Notice:** while this is a centralized service, it exists only for convenience. Users can fulfill the role of the bots if they wish to.
- **`contracts/`**: Smart contracts to enable cross-chain arbitration for Realitio (Reality.eth). [Learn more](contracts/README.md).
- **`dynamic-script/`**: allows fetching the dynamic content for the arbitration, as described by [ERC-1497: Evidence Standard](https://github.com/ethereum/EIPs/issues/1497).
- **`evidence-display/`**: display interface that should be used to render the evidence for arbitrators, as described by [ERC-1497: Evidence Standard](https://github.com/ethereum/EIPs/issues/1497).

