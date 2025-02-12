#!/usr/bin/env bash

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" >/dev/null 2>&1 && pwd)"

function generate() { #deploymentDir #homeExplorerUrl #foreignExplorerUrl
    deploymentDir=$1
    homeExplorerUrl=$2
    foreignExplorerUrl=$3
    deployments_file="$deploymentDir/RealitioProxy-v1.2.0.json"
    if [ -f "$deployments_file" ]; then
        temp_output=$(jq -r '.deployments[] | "\(.name)\t\(.homeProxy.address)\t\(.foreignProxy.address)"' "$deployments_file")
        while IFS=$'\t' read -r name home_address foreign_address; do
            echo "- $name 
  - [Home Proxy](${homeExplorerUrl}$home_address)
  - [Foreign Proxy](${foreignExplorerUrl}$foreign_address)
"
        done <<<"$temp_output"
    fi
}

IGNORED_ARTIFACTS=("NOP")

# Use regular arrays to preserve the ordering
TESTNET_NETWORKS=("chiado" "unichainSepolia" "optimismSepolia" "arbitrumSepolia" "amoy" "zksyncSepolia")
declare -A HOME_TESTNETS_EXPLORERS=(
    ["chiado"]="https://gnosis-chiado.blockscout.com/address/"
    ["unichainSepolia"]="https://sepolia.uniscan.xyz/address/"
    ["optimismSepolia"]="https://sepolia-optimism.etherscan.io/address/"
    ["arbitrumSepolia"]="https://sepolia.arbiscan.io/address/"
    ["amoy"]="https://amoy.polygonscan.com/address/"
    ["zksyncSepolia"]="https://sepolia.explorer.zksync.io/address/"
)

MAINNET_NETWORKS=("gnosis" "unichain" "optimism" "redstone" "arbitrum" "polygon" "zksyncMainnet")
declare -A HOME_MAINNET_EXPLORERS=(
    ["gnosis"]="https://gnosisscan.io/address/"
    ["unichain"]="https://uniscan.xyz/address/"
    ["optimism"]="https://etherscan.io/address/"
    ["redstone"]="https://explorer.redstone.xyz/address/"
    ["arbitrum"]="https://arbiscan.io/address/"
    ["polygon"]="https://polygonscan.com/address/"
    ["zksyncMainnet"]="https://explorer.zksync.io/address/"
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
    ["zksyncSepolia"]="ZkSync"
    ["gnosis"]="Gnosis"
    ["unichain"]="Unichain"
    ["optimism"]="Optimism"
    ["redstone"]="Redstone"
    ["arbitrum"]="Arbitrum"
    ["polygon"]="Polygon"
    ["zksyncMainnet"]="ZkSync"
)

echo "### Testnets"
for network in "${TESTNET_NETWORKS[@]}"; do
    output=$(generate "$SCRIPT_DIR/../deployments/${network}" "${HOME_TESTNETS_EXPLORERS[$network]}" "${FOREIGN_NETWORK_EXPLORERS[sepolia]}")

    # Skip if not output
    [ -z "$output" ] && continue

    echo
    echo "#### ${network^}"
    echo
    echo "$output"
    echo
done

echo
echo "### Mainnets"
for network in "${MAINNET_NETWORKS[@]}"; do
    output=$(generate "$SCRIPT_DIR/../deployments/${network}" "${HOME_MAINNET_EXPLORERS[$network]}" "${FOREIGN_NETWORK_EXPLORERS[mainnet]}")

    # Skip if not output
    [ -z "$output" ] && continue

    echo
    echo "#### ${network^}"
    echo
    echo "$output"
    echo
done
