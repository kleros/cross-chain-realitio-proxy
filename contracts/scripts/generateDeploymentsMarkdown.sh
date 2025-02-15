#!/usr/bin/env bash

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" >/dev/null 2>&1 && pwd)"

function generate() { #deploymentDir #homeExplorerUrl #foreignExplorerUrl
    deploymentDir=$1
    homeExplorerUrl=$2
    foreignExplorerUrl=$3

    # Find all RealitioProxy version files and sort them in reverse order
    version_files=$(find "$deploymentDir" -name "RealitioProxy-v*.json" 2>/dev/null | sort -r)

    # If no files found, return early
    [ -z "$version_files" ] && return

    # Print table header
    echo "| Version | Name | Home Proxy | Foreign Proxy | CourtID | MinJurors | Reality |"
    echo "|---------|------|------------|---------------|----------|-----------|----------|"

    while IFS= read -r file; do
        version=$(basename "$file" | sed -E 's/RealitioProxy-v(.*).json/\1/')

        # Process each deployment in the file
        temp_output=$(jq -r --arg version "$version" '.deployments[] | "\(.name)\t\(.homeProxy.address)\t\(.foreignProxy.address)\t\(.foreignProxy.courtId)\t\(.foreignProxy.minJurors)\t\(.realitio.contract)\t\(.realitio.address)"' "$file")
        while IFS=$'\t' read -r name home_address foreign_address court_id min_jurors reality_contract realitio_address; do
            [ -z "$name" ] && continue
            echo "| v$version | $name | [$home_address](${homeExplorerUrl}$home_address) | [$foreign_address](${foreignExplorerUrl}$foreign_address) | $court_id | $min_jurors | [$reality_contract](${homeExplorerUrl}$realitio_address) |"
        done <<<"$temp_output"
    done <<<"$version_files"
    echo
}

# Use regular arrays to preserve the ordering
MAINNET_NETWORKS=("gnosis" "unichain" "optimism" "redstone" "base" "arbitrum" "polygon" "zksyncMainnet")
declare -A HOME_MAINNET_EXPLORERS=(
    ["gnosis"]="https://gnosisscan.io/address/"
    ["unichain"]="https://uniscan.xyz/address/"
    ["optimism"]="https://etherscan.io/address/"
    ["redstone"]="https://explorer.redstone.xyz/address/"
    ["base"]="https://basescan.org/address/"
    ["arbitrum"]="https://arbiscan.io/address/"
    ["polygon"]="https://polygonscan.com/address/"
    ["zksyncMainnet"]="https://explorer.zksync.io/address/"
)

TESTNET_NETWORKS=("chiado" "unichainSepolia" "optimismSepolia" "arbitrumSepolia" "amoy" "zksyncSepolia")
declare -A HOME_TESTNETS_EXPLORERS=(
    ["chiado"]="https://gnosis-chiado.blockscout.com/address/"
    ["unichainSepolia"]="https://sepolia.uniscan.xyz/address/"
    ["optimismSepolia"]="https://sepolia-optimism.etherscan.io/address/"
    ["arbitrumSepolia"]="https://sepolia.arbiscan.io/address/"
    ["amoy"]="https://amoy.polygonscan.com/address/"
    ["zksyncSepolia"]="https://sepolia.explorer.zksync.io/address/"
)

declare -A FOREIGN_NETWORK_EXPLORERS=(
    ["sepolia"]="https://sepolia.etherscan.io/address/"
    ["mainnet"]="https://etherscan.io/address/"
)

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

echo

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
