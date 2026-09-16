#!/usr/bin/env bash
#
# Prints the release tag of the same kind that came before a given one, for
# release notes that cover only that kind's changes. Tags from before the app
# and server were released separately (`vX.Y.Z`) count as both kinds. Prints
# nothing when there is no earlier release.
#
#   scripts/previous-release-tag.sh desktop desktop-v0.4.0

set -euo pipefail

kind="$1"
current="$2"
current_version="${current##*v}"

{
  git tag --list "${kind}-v*" 'v[0-9]*' | while read -r tag; do printf '%s %s\n' "${tag##*v}" "$tag"; done
  printf '%s %s\n' "$current_version" '(current)'
} | sort -V | awk -v cur="$current_version" '
  $2 == "(current)" { if (prev) print prev; exit }
  $1 != cur { prev = $2 }'
