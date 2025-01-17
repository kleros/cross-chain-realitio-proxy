#!/usr/bin/env bash

SCRIPT_DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" >/dev/null 2>&1 && pwd )"

function generate() { #deploymentDir #explorerUrl
    deploymentDir=$1
    explorerUrl=$2
    # shellcheck disable=SC2068
    for f in $(ls -1 $deploymentDir/*.json 2>/dev/null | grep -v ${IGNORED_ARTIFACTS[@]/#/-e } | sort); do
        contractName=$(basename $f .json)
        address=$(cat $f | jq -r .address)
        implementation=$(cat $f | jq -r .implementation)

        if [ "$implementation" != "null" ]; then
            echo "- [$contractName: proxy]($explorerUrl$address), [implementation]($explorerUrl$implementation)"
        else
            echo "- [$contractName]($explorerUrl$address)"
        fi
    done
}

IGNORED_ARTIFACTS=("NOP")

# Use regular arrays to preserve the ordering
TESTNET_NETWORKS=("chiado" "unichainSepolia" "optimismSepolia" "arbitrumSepolia" "amoy")
declare -A HOME_TESTNETS_EXPLORERS=(
    ["chiado"]="https://gnosis-chiado.blockscout.com/address/"
    ["unichainSepolia"]="https://sepolia.uniscan.xyz/address/"
    ["optimismSepolia"]="https://sepolia-optimism.etherscan.io/address/"
    ["arbitrumSepolia"]="https://sepolia.arbiscan.io/address/"
    ["amoy"]="https://amoy.polygonscan.com/address/"
)

MAINNET_NETWORKS=("gnosis" "unichain" "optimism" "redstone" "arbitrum" "polygon")
declare -A HOME_MAINNET_EXPLORERS=(
    ["gnosis"]="https://gnosisscan.io/address/"
    ["unichain"]="https://uniscan.xyz/address/"
    ["optimism"]="https://etherscan.io/address/"
    ["redstone"]="https://explorer.redstone.xyz/address/"
    ["arbitrum"]="https://arbiscan.io/address/"
    ["polygon"]="https://polygonscan.com/address/"
)

declare -A FOREIGN_NETWORK_EXPLORERS=(
    ["sepolia"]="https://sepolia.etherscan.io/address/"
    ["mainnet"]="https://etherscan.io/address/"
)

declare -A FILTERS=(
    ["chiado"]="Gnosis"
    ["unichainSepolia"]="Unichain"
    ["optimismSepolia"]="Optimism"
    ["arbitrumSepolia"]="Arbitrum"
    ["amoy"]="Polygon"
    ["gnosis"]="Gnosis"
    ["unichain"]="Unichain"
    ["optimism"]="Optimism"
    ["redstone"]="Redstone"
    ["arbitrum"]="Arbitrum"
    ["polygon"]="Polygon"
)

echo "### Testnets"
for network in "${TESTNET_NETWORKS[@]}"; do
    home_output=$(generate "$SCRIPT_DIR/../deployments/${network}" "${HOME_TESTNETS_EXPLORERS[$network]}")
    foreign_output=$(generate "$SCRIPT_DIR/../deployments/sepolia" "${FOREIGN_NETWORK_EXPLORERS[sepolia]}" | grep "${FILTERS[$network]}")
    
    # Skip if both outputs are empty
    [ -z "$home_output" ] && [ -z "$foreign_output" ] && continue
    
    echo
    echo "#### ${network^}"
    echo
    [ -n "$home_output" ] && echo "$home_output"
    [ -n "$foreign_output" ] && echo "$foreign_output"
    echo
done

echo
echo "### Mainnets"
for network in "${MAINNET_NETWORKS[@]}"; do
    home_output=$(generate "$SCRIPT_DIR/../deployments/${network}" "${HOME_MAINNET_EXPLORERS[$network]}")
    foreign_output=$(generate "$SCRIPT_DIR/../deployments/mainnet" "${FOREIGN_NETWORK_EXPLORERS[mainnet]}" | grep "${FILTERS[$network]}")
    
    # Skip if both outputs are empty
    [ -z "$home_output" ] && [ -z "$foreign_output" ] && continue
    
    echo
    echo "#### ${network^}"
    echo
    [ -n "$home_output" ] && echo "$home_output"
    [ -n "$foreign_output" ] && echo "$foreign_output"
done
