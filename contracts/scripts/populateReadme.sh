#!/usr/bin/env bash

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" >/dev/null 2>&1 && pwd)"

if [ ! -x "$(command -v envsubst)" ]; then
  echo >&2 "error: envsubst not installed"
  exit 1
fi

# Function to generate table of contents from markdown headings
generate_toc() {
  local file="$1"
  # Extract headings, ignore the first title, and generate TOC entries
  awk '
        BEGIN { first_heading = 1 }
        /^#/ {
            if (first_heading) {
                first_heading = 0
                next
            }
            level = length($1)  # Count number of #
            title = substr($0, level + 2)  # Remove #s and space
            link = tolower(title)
            gsub(/[^a-z0-9-]/, "", link)  # Create anchor link
            printf "%*s- **[%s](#%s)**\n", (level - 2) * 2, "", title, link
        }
    ' "$file"
}

deployments="$($SCRIPT_DIR/generateDeploymentsMarkdown.sh)" \
  envsubst '$deployments' \
  <README.md.template \
  >README.md.tmp

toc=$(generate_toc README.md.tmp) \
  envsubst '$toc' \
  <README.md.tmp \
  >README.md

rm README.md.tmp
