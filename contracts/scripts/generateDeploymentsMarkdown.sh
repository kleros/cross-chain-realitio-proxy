#!/usr/bin/env bash

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" >/dev/null 2>&1 && pwd)"

function prettify_address() {
    address=$1
    echo "${address:0:8}..${address: -6}"
}

function get_policy_from_metaevidence() {
    uri=$1
    curl -s "$uri" | jq -r '.fileURI'
}

function get_policy_name() {
    policy_path=$1
    clean_path=${policy_path#"https://cdn.kleros.link/ipfs/"}
    key=$(jq -r "to_entries | map(select(.value == \"$clean_path\")) | .[0].key // \"custom\"" "$SCRIPT_DIR/../policies.json")
    echo "$key"
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
    echo "| Version | Name | Home Proxy | Foreign Proxy | CourtID | MinJurors | Reality | Policy | Comment |"
    echo "|---------|------|------------|---------------|---------|-----------|---------|---------|---------|"

    while IFS= read -r file; do
        version=$(basename "$file" | sed -E 's/RealitioProxy-v(.*).json/\1/')

        # Process each deployment in the file
        temp_output=$(jq -r --arg version "$version" '.deployments[] | [.name, .homeProxy.address, .foreignProxy.address, .foreignProxy.courtId, .foreignProxy.minJurors, .realitio.contract, .realitio.address, .homeProxy.tos, .foreignProxy.metaevidence] | join("§")' "$file")
        while IFS='§' read -r name home_address foreign_address court_id min_jurors reality_contract realitio_address policyUrl metaevidence; do
            [ -z "$name" ] && continue
            pretty_home=$(prettify_address "$home_address")
            pretty_foreign=$(prettify_address "$foreign_address")
            relative_file_path=${file#"$SCRIPT_DIR/../"}
            line_number=$(grep -n "\"name\": \"$name\"" "$file" | cut -d: -f1)
            if [ -z "$policyUrl" ] && [ -n "$metaevidence" ]; then
                policyUrl="https://cdn.kleros.link$(get_policy_from_metaevidence "$metaevidence")"
                comment=":warning: bad metadata"
            fi
            policy_name=$(get_policy_name "$policyUrl")
            echo "| v$version | [$name](${relative_file_path}#L${line_number}) | [$pretty_home](${homeExplorerUrl}$home_address) | [$pretty_foreign](${foreignExplorerUrl}${foreign_address}) | $court_id | $min_jurors | [$reality_contract](${homeExplorerUrl}${realitio_address}) | [${policy_name}]($policyUrl) | $comment |"
        done <<<"$temp_output"
    done <<<"$version_files"
    echo
}

# shellcheck source=/dev/null
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
