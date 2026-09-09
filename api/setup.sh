#!/usr/bin/env bash
#
# Generates .env for a Cloak server: every secret filled in with fresh random
# values, everything site-specific left blank for you.
#
#   ./setup.sh
#
# Safe to read before running. It writes exactly one file and prints one secret.

set -euo pipefail

HERE="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ENV_FILE="$HERE/.env"
TEMPLATE="$HERE/.env.example"

bold=$'\033[1m'; dim=$'\033[2m'; red=$'\033[31m'; green=$'\033[32m'; yellow=$'\033[33m'; off=$'\033[0m'

if [[ ! -f "$TEMPLATE" ]]; then
  echo "${red}.env.example is missing — run this from the directory you unpacked.${off}" >&2
  exit 1
fi

if [[ -f "$ENV_FILE" && "${1:-}" != "--force" ]]; then
  echo "${yellow}.env already exists.${off}"
  echo "Refusing to overwrite it — regenerating would invalidate every session and"
  echo "lock you out of an already-claimed server."
  echo
  echo "  ${dim}./setup.sh --force${off}   overwrite anyway"
  exit 1
fi

# 48 bytes of kernel entropy, URL-safe so it survives shells, .env parsing and
# copy-paste without quoting. openssl is present on every host that can run a
# container; node is our own runtime, so one of the two always exists.
generate() {
  local bytes="$1"
  if command -v openssl >/dev/null 2>&1; then
    openssl rand -base64 "$bytes" | tr -d '\n=' | tr '+/' '-_'
  elif command -v node >/dev/null 2>&1; then
    node -e "process.stdout.write(require('crypto').randomBytes($bytes).toString('base64url'))"
  else
    echo "${red}Need either openssl or node to generate secrets.${off}" >&2
    exit 1
  fi
}

echo "${bold}Generating secrets${off}"
JWT_SECRET="$(generate 48)"
REFRESH_SECRET="$(generate 48)"
OWNERSHIP_KEY="$(generate 32)"
HEALTH_TOKEN="$(generate 32)"

cp "$TEMPLATE" "$ENV_FILE"

# '|' is not in the base64url alphabet, so no generated value can break out of
# the substitution.
set_value() {
  sed -i.bak "s|^$1=.*|$1=$2|" "$ENV_FILE" && rm -f "$ENV_FILE.bak"
}

set_value JWT_SECRET     "$JWT_SECRET"
set_value REFRESH_SECRET "$REFRESH_SECRET"
set_value OWNERSHIP_KEY  "$OWNERSHIP_KEY"
set_value HEALTH_TOKEN   "$HEALTH_TOKEN"

# Nobody but the operator reads this file.
chmod 600 "$ENV_FILE"

cat <<EOF

${green}Wrote .env${off} ${dim}(permissions 600)${off}

${bold}Ownership key${off}
${bold}  $OWNERSHIP_KEY${off}

  The desktop app asks for this once, to create the first account.
  It stops working the moment that account exists. Until then it is the only
  thing standing between this server and whoever else finds the address, so do
  not paste it into chat, tickets, or a shared document.

${bold}Now fill in the rest of .env${off}

  ${bold}MONGODB_URI${off}   Your database. Using docker-compose? Leave it blank —
                the compose file supplies mongodb://mongo:27017/cloak.
  ${bold}PUBLIC_URL${off}    The address teammates reach this server on, exactly as
                they would type it. This goes into invitation join keys, so a
                wrong value here means nobody can connect.
  ${bold}RESEND_*${off}      Optional. Without it, verification codes and invitations
                are written to the server log instead of being emailed.

${bold}Then start it${off}

  ${dim}docker compose up -d${off}                        with Docker
  ${dim}npm ci --omit=dev && npm start${off}              without

${bold}Then check it${off}

  ${dim}\$PUBLIC_URL/?key=$HEALTH_TOKEN${off}

EOF
