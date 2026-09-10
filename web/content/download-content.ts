// Copy for /download. Sourced from the README's "Deploy for your team" section
// and the server bundle's own setup.sh — keep the three in step when either
// changes. Commands are functions of the release so every filename on the page
// matches the version the visitor picked.

export type SetupMode = "solo" | "team";

export const DOWNLOAD_HERO = {
  title: "Download Cloak",
  body: "One app for every person, one small server for all of them. Run it for yourself on your own machine, or for your whole team on a host you control — either way the database and every key stay with you.",
} as const;

export const MODES: Record<
  SetupMode,
  { label: string; title: string; body: string; points: readonly string[] }
> = {
  solo: {
    label: "Just me",
    title: "A vault only you can open",
    body: "Run the server on the same machine as the app, on a home server, or on a small VPS. No domain, no certificate, nobody to invite.",
    points: [
      "Docker on your own machine is the whole setup",
      "Plain HTTP is allowed on localhost, your LAN, or Tailscale",
      "Invite someone later without starting over",
    ],
  },
  team: {
    label: "My team",
    title: "One server, everyone's keys stay theirs",
    body: "Run the server where your team can reach it and put TLS in front. You claim it first; everyone else joins by invitation.",
    points: [
      "Invite-only the moment you claim it",
      "Join keys carry the address, so nobody types one",
      "Access is granted device to device, never by the server",
    ],
  },
};

export interface GuideStep {
  id: string;
  title: string;
  /** Steps that only make sense with more than one person are hidden for solo. */
  modes: readonly SetupMode[];
}

export const GUIDE_STEPS: readonly GuideStep[] = [
  { id: "install", title: "Install the app", modes: ["solo", "team"] },
  { id: "server", title: "Start your server", modes: ["solo", "team"] },
  { id: "tls", title: "Put TLS in front", modes: ["team"] },
  { id: "check", title: "Check it", modes: ["solo", "team"] },
  { id: "claim", title: "Take ownership", modes: ["solo", "team"] },
  { id: "invite", title: "Add your team", modes: ["team"] },
];

/** Per-OS first-launch notes. The installers are not code-signed yet. */
export const INSTALL_NOTES = {
  windows: {
    steps: [
      "Run the .exe installer, or the .msi if you deploy software with Group Policy or Intune.",
      "Windows SmartScreen may stop an unsigned installer. Choose More info, then Run anyway.",
    ],
  },
  macos: {
    steps: [
      "Open the .dmg and drag Cloak into Applications. One build runs on Intel and Apple Silicon.",
      "Gatekeeper blocks unsigned apps on first launch. Control-click Cloak in Applications and choose Open, then confirm.",
      "If macOS reports the app is damaged, clear the download quarantine flag with the command below.",
    ],
    command: "xattr -dr com.apple.quarantine /Applications/Cloak.app",
  },
  linux: {
    steps: [
      "AppImage runs anywhere with no install: make it executable and start it.",
      "On Ubuntu 24.04 and later, AppImages need libfuse2t64 (22.04 ships libfuse2 already).",
      "Prefer your package manager? The .deb and .rpm pull in WebKitGTK and friends for you.",
    ],
  },
} as const;

export function linuxCommands(files: { appimage?: string; deb?: string; rpm?: string }) {
  return {
    appimage: `chmod +x ${files.appimage ?? "Cloak_*.AppImage"}\n./${files.appimage ?? "Cloak_*.AppImage"}`,
    deb: `sudo apt install ./${files.deb ?? "Cloak_*_amd64.deb"}`,
    rpm: `sudo dnf install ./${files.rpm ?? "Cloak-*.x86_64.rpm"}`,
  };
}

export function unpackCommand(zipName: string) {
  const dir = zipName.replace(/\.zip$/i, "");
  return `unzip ${zipName} && cd ${dir}\n./setup.sh`;
}

export const SETUP_SH_NOTE =
  "setup.sh writes .env with JWT_SECRET, REFRESH_SECRET, OWNERSHIP_KEY and HEALTH_TOKEN already filled in — 384 bits each from the system's secure random source — and prints the ownership key once. Copy it somewhere safe now: it is how you prove the server is yours.";

export const ENV_VARS: Record<
  SetupMode,
  readonly { name: string; required: boolean; body: string }[]
> = {
  solo: [
    {
      name: "MONGODB_URI",
      required: false,
      body: "Leave it blank with Docker — the compose file runs its own MongoDB. Without Docker, point it at any MongoDB 7 you own: a local mongod or a free Atlas cluster.",
    },
    {
      name: "PUBLIC_URL",
      required: false,
      body: "Where the server is reached from. On one machine, http://localhost:4000. From other devices on your LAN or Tailscale, that machine's address instead.",
    },
    {
      name: "RESEND_API_KEY",
      required: false,
      body: "Optional. Without it, your sign-up verification code is written to the server log — fine when you are the only user.",
    },
  ],
  team: [
    {
      name: "MONGODB_URI",
      required: true,
      body: "Your database. Leave it blank with Docker, which runs MongoDB alongside the API.",
    },
    {
      name: "PUBLIC_URL",
      required: true,
      body: "The address teammates reach this server on, exactly as they would type it. It is written into every join key, so a wrong value means nobody can connect.",
    },
    {
      name: "RESEND_API_KEY",
      required: false,
      body: "Optional, with RESEND_FROM_EMAIL. Without it, codes and invitations go to the server log and the app hands you join keys to pass on yourself.",
    },
  ],
};

export const START_COMMANDS = {
  docker: "docker compose up -d",
  node: "npm ci --omit=dev && npm start",
  pm2: "npm ci --omit=dev\npm2 start ecosystem.config.cjs && pm2 save",
} as const;

export const TLS_COMMAND = `CLOAK_DOMAIN=vault.example.com \\
  docker compose -f docker-compose.yml -f docker-compose.tls.yml up -d`;

export const TLS_NOTE =
  "The Caddy overlay gets and renews a certificate by itself once DNS points at the machine. The desktop app refuses plain http:// except on loopback, private LAN ranges and Tailscale, because vault contents are encrypted on each device but session tokens are not.";

export const CHECK_POINTS = [
  {
    title: "Status page",
    body: "Open PUBLIC_URL in a browser for a status page that refreshes itself: is the server up, and does anyone own it yet.",
  },
  {
    title: "Detailed view",
    body: "Append ?key=<HEALTH_TOKEN> for the database, record counts, the Resend key (masked), uptime and memory. Owners see the same inside the app.",
  },
  {
    title: "For monitoring",
    body: "GET /status.json serves both tiers as JSON for uptime checks and dashboards.",
  },
] as const;

export const CLAIM_STEPS: Record<SetupMode, readonly string[]> = {
  solo: [
    "Open Cloak. Its first screen asks which server, not for a password — enter http://localhost:4000, or wherever your server runs.",
    "The app checks that it is a Cloak server, that the versions match, and that the database is healthy, and says exactly what to fix if not.",
    "Enter the ownership key from setup.sh, then sign up: name, email, master password, verification code, recovery keys.",
    "The key is spent the moment your account exists, and the server closes to everyone else. Remove OWNERSHIP_KEY from .env.",
  ],
  team: [
    "Open Cloak. Its first screen asks which server — enter your PUBLIC_URL.",
    "The app checks the server, its version, database and mail, and says exactly what to fix if something is off.",
    "Enter the ownership key from setup.sh, then sign up as normal. You become the owner.",
    "The key is spent atomically with your account and the server becomes invite-only. Remove OWNERSHIP_KEY from .env.",
  ],
};

export const INVITE_POINTS = [
  {
    title: "Invite",
    body: "Team → Invite creates a join key: one string that names your server and carries the invitation. It is tied to one email address and expires.",
  },
  {
    title: "Join",
    body: "The new member installs Cloak and pastes the join key into the first screen. The app finds your server and redeems the invitation in one step.",
  },
  {
    title: "Grant",
    body: "Joining grants nothing. An existing member seals the organization's key to the new device, on their own machine, with a key the server never holds.",
  },
  {
    title: "Verify",
    body: "Before granting, read the member's key fingerprint back to them on a call. It is the defence against a compromised server swapping in its own key.",
  },
] as const;

export const REQUIREMENTS = [
  {
    title: "Desktop app",
    rows: [
      ["Windows", "10 or 11, x64"],
      ["macOS", "Intel or Apple Silicon"],
      ["Linux", "x64 — AppImage, .deb or .rpm"],
    ],
  },
  {
    title: "Server",
    rows: [
      ["Runtime", "Docker, or Node.js 22+"],
      ["Database", "MongoDB Atlas or v7 (bundled with Docker)"],
      ["Email", "Resend API key (optional)"],
    ],
  },
] as const;

export const OPERATING_NOTES = [
  {
    title: "Back up MongoDB",
    body: "It holds the only copy of every wrapped key. Lose it and every vault is gone — no support path can bring it back. That is the design.",
  },
  {
    title: "Run one API instance",
    body: "Rate limits live in process memory, so a second worker quietly doubles every limit. The pm2 config pins one instance for this reason.",
  },
  {
    title: "Rotating JWT secrets",
    body: "Changing JWT_SECRET or REFRESH_SECRET signs everyone out. Nothing is lost; everyone signs in again.",
  },
  {
    title: "Removing a member",
    body: "They lose server access immediately, but anything already decrypted on their device stays readable. The organization key is not rotated.",
  },
] as const;
