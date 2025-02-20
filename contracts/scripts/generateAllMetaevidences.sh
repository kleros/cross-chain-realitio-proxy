#! /usr/bin/env bash

SCRIPT_DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" >/dev/null 2>&1 && pwd )"

# shellcheck source=/dev/null
source "$SCRIPT_DIR/chains.env"

# Generate metaevidence for each home network
for network in "${TESTNET_NETWORKS[@]}" "${MAINNET_NETWORKS[@]}"; do
#   echo "Generating metaevidence for $network..."
  # shellcheck disable=SC2068
  yarn metaevidence:"$network" $@
done

echo "Metaevidence generation complete!"

