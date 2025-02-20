#!/usr/bin/env bash

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" >/dev/null 2>&1 && pwd)"

function prettify_address() {
    address=$1
    echo "${address:0:8}..${address: -6}"
}

function generate() { #deploymentDir #homeExplorerUrl #foreignExplorerUrl
    deploymentDir=$1
    homeExplorerUrl=$2
    foreignExplorerUrl=$3

    # Find all RealitioProxy version files and sort them in reverse order
    version_files=$(find "$deploymentDir" -name "RealitioProxy-v*.json" 2>/dev/null | grep -v "\-broken" | sort -r)

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
            pretty_home=$(prettify_address "$home_address")
            pretty_foreign=$(prettify_address "$foreign_address")
            echo "| v$version | $name | [$pretty_home](${homeExplorerUrl}$home_address) | [$pretty_foreign](${foreignExplorerUrl}$foreign_address) | $court_id | $min_jurors | [$reality_contract](${homeExplorerUrl}$realitio_address) |"
        done <<<"$temp_output"
    done <<<"$version_files"
    echo
}

source "$SCRIPT_DIR/chains.env"

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
