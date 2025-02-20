#! /usr/bin/env bash

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" >/dev/null 2>&1 && pwd)"
OUTPUT_FILE="$SCRIPT_DIR/../metaevidence-cids.json"

rm -f "$OUTPUT_FILE"

write() {
    # Function to write to both output file and stdout
    echo -ne "$1" | tee -a "$OUTPUT_FILE"
}

write "{\n"

# Process each file and add JSON entries
first=true
for f in $SCRIPT_DIR/../metaevidences/metaevidence-*.json; do
    filename=$(basename "$f")
    cid=$(ipfs add -q --only-hash "$f")
    if [ "$first" = true ]; then
        first=false
        write "  \"$filename\": \"$cid\""
    else
        write ",\n  \"$filename\": \"$cid\""
    fi
done

write "\n}"
