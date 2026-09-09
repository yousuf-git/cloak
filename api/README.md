# Cloak Server

The backend for [Cloak](https://github.com/yousuf-git/cloak). You run this; nobody
else can read what it stores.

The server holds ciphertext and metadata only. Vault contents are encrypted on
each member's device before they are sent, and the keys never leave those
devices — so an operator with full database access still cannot read a secret.

---

## Setup

**1. Generate the configuration.**

```bash
./setup.sh
```

Writes `.env` with fresh random values for `JWT_SECRET`, `REFRESH_SECRET`,
`OWNERSHIP_KEY` and `HEALTH_TOKEN`, and prints the ownership key once.

**2. Fill in the rest of `.env`.**

| Variable | Notes |
|---|---|
| `MONGODB_URI` | Leave blank if you use `docker-compose.yml`; it supplies its own. |
| `PUBLIC_URL` | The address teammates reach this server on. Goes into invitation join keys, so a wrong value means nobody can connect. |
| `RESEND_API_KEY`, `RESEND_FROM_EMAIL` | Optional. Without them, verification codes and invitations are written to the server log instead of being emailed. |

**3. Start it.**

```bash
docker compose up -d                          # with Docker
npm ci --omit=dev && npm run build && npm start   # without
```

For TLS on a public host, point a DNS record at the machine and use the Caddy
overlay, which obtains a certificate on its own:

```bash
CLOAK_DOMAIN=vault.example.com \
  docker compose -f docker-compose.yml -f docker-compose.tls.yml up -d
```

**4. Check it.** Open `$PUBLIC_URL/` for a live status page. The public view
shows whether the server is up and whether anyone owns it yet; append
`?key=<HEALTH_TOKEN>` for database, mail and runtime detail.

**5. Claim it.** Install the Cloak desktop app, point it at your address, and
enter the ownership key. That creates the first account and permanently closes
the ownership flow. Remove `OWNERSHIP_KEY` from `.env` afterwards.

---

## After the first owner exists

Signup is invite-only. An address with no pending invitation is refused, so an
exposed server cannot be joined by whoever finds it.

Invitations are issued from the desktop app. Each one produces a **join key** —
one string naming this server and carrying the invitation token — which the
invitee pastes into their first screen. If mail is unconfigured, the app shows
the key for you to pass along yourself.

Joining does not grant access. A new member can see the organization but read
nothing in it until an existing member seals the organization's key to their
device. That step happens on the granting member's machine and is the reason
this server never holds anything readable.

---

## Operating notes

- **Back up MongoDB.** It is the only copy of every wrapped key. Losing it loses
  every vault, and no support path can recover them — that is the design.
- **Run one instance.** Rate-limit counters live in process memory, so a second
  worker silently doubles every limit. `ecosystem.config.cjs` pins pm2 to one.
- **Rotating `JWT_SECRET` or `REFRESH_SECRET`** signs everyone out. Nothing is
  lost; everyone signs in again.
- **`OWNERSHIP_KEY` is ignored once claimed.** Re-running the ownership flow
  needs a wiped database and a redeploy.
- **The `overrides` block in `package.json`** pins transitive dependencies with
  known advisories. Keep it when updating.

Full documentation, including the key hierarchy and what removing a member does
and does not protect against, is in the repository's `docs/`.
