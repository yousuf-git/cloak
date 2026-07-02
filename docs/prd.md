
# Product Requirement Document (PRD)

## Project Overview

This project is a highly secure, developer-centric, zero-knowledge secrets manager and password vault designed exclusively as a desktop application. It unifies standard credential tracking with modern developer workflows (like `.env` configuration management) inside an interface tailored for rapid access.

---

## Core Philosophy

- **Zero-Knowledge Security:** All master cryptographic keys are derived locally on the user's machine. Plaintext secrets are never transmitted across the network or stored on the backend database.
- **On-Demand Exposure:** No raw secrets are rendered automatically on the UI. Exposure is strictly interactive and opt-in per field or profile.
- **Desktop Focus:** Engineered for speed, safety, and modern desktop experiences.

---

## 1. Technical Stack Architecture

### Client-Side (Desktop App)
- **Framework:** Tauri (Rust Backend core + Webview Frontend)
- **Frontend Engine:** React (utilizing React 19 Compiler), TypeScript (Strict Mode)
- **State & Data Fetching:** TanStack Query (v5), Zustand/Jotai
- **UI/UX Componentry:** Tailwind CSS (v4+), shadcn/ui, Radix UI primitives, Lucide React
- **Animations:** Framer Motion, GSAP
- **Form & Validation Execution:** React Hook Form + Zod
- **Package Management & Build System:** pnpm + Vite

### Server-Side (Cloud Backend API)
- **Runtime/Framework:** Node.js (Express)
- **Database:** MongoDB Atlas (Cloud Hosted)
- **ODM/Driver:** Mongoose
- **Email Dispatch:** Resend API (for transactional and authentication-related routing)

---

## 2. Cryptographic Blueprint & Data Lifecycle

### Key Derivation & Master Key Rules

- **Inputs:** User Email, Master Password, and a cryptographically secure random Salt (16+ bytes).
- **Derivation Engine:** Executed inside the local application layer using Argon2id.
- **Storage Boundaries:** The resulting Master Key exists exclusively in volatile memory during an active session. It is never written directly to the database or stored in local configuration files in plaintext.

### Environment File (.env) Architecture

The application handles multi-layered encryption for project configuration files using dotenvx:

```
[ Plaintext Variable Value ] ──> Encrypted via dotenvx Engine ──> [ Wrapped Value Block ]
                                               │
[ Raw dotenvx Private Key ] ───> Encrypted via Master Key ─────> [ Sealed Key Token ]
```

- **Value Encryption:** dotenvx parses the .env file and encrypts the key-value structures individually at the field/value level.
- **Key Isolation:** The specific dotenvx private key required to decrypt those values is itself encrypted using the user's derived Master Key.
- **Database Storage:** Both the field-encrypted .env text block and the sealed dotenvx private key are transmitted to the remote API server to be synchronized with MongoDB Atlas.

---

## 3. Comprehensive Feature Requirements

### 3.1 Secret Management Modules

The system must support five primary categories of credential tiles inside the layout:

- **User Credentials & Logins**
  - Storage of traditional username/password combinations.
  - Association fields for environment tags (Sandbox, Staging, Production) linked directly to parent projects.
  - Support for manual entry alongside secure generic file imports/exports.
- **Environment Files (.env)**
  - Support for managing multiple target .env files per project architecture.
  - **Import Strategy:** The user specifies if the incoming file is plaintext or pre-encrypted via dotenvx.
  - **Validation Check:** Optional validation using automated field checks to verify schema formatting and identify structural anomalies. For .env file validation and debugging related help, we'll utilize dotenv-parse and envalid npm packages. And on each import there will be a user friendly UX flow to help the user with the validation process.
- **Backup Codes**
  - Static entry blocks designed explicitly for account recovery codes.
  - **Usage State Tracking:** UI toggle buttons allowing developers to mark an individual code as consumed or remaining, updating metadata dynamically.
- **API Keys & Secrets**
  - Dedicated fields for cryptographic hashes, access tokens, and cloud platform secrets.
  - Configuration options to assign them to a explicit parent project or leave them as standalone global credentials.

### 3.2 Secure UI Display & Visibility Rules

- **Masked Default State:** On view loading, plain-text passwords or secret properties are never displayed. The interface pulls the encrypted raw value from the local data store and displays it as a truncated string of characters or masked circles.
- **Targeted Exposure:** Every credential field must feature independent, dedicated action icons:
  - **Reveal Icon:** Temporarily unmasks the specific field value within its tile.
  - **Copy Icon:** Copies the clear plaintext string straight to the system clipboard without displaying it visually.
- **Global Layout Triggers:** Environment variable profile panels must feature a top-level macro action button labeled "Reveal All". Clicking this button executes a batch decryption loop across the entire active file template to expose all variables simultaneously for quick visual auditing.

---

## 4. Authentication & Session Lifecycles

### 4.1 Login & Dual-Factor Validation Flow

- **Primary Authentication:** User inputs Email and Password via the desktop interface.
- **Remote Verification:** The client sends an authentication request to the remote backend server. The server verifies the identity hash against MongoDB Atlas.
- **Two-Factor Authentication (2FA):** If 2FA is active for the profile, the backend triggers an automated transactional email containing a single-use Time-based OTP via the Resend API.
- **Session Authorization:** The client must supply the matching verification token within a defined expiry window to authorize the connection and unlock access to synced data payloads.

### 4.2 30-Day "Remember Me" Protocol

To eliminate password-entry fatigue while preserving a zero-knowledge architecture, the system implements a hardware-backed local token loop:

- **Activation:** When the user selects "Remember Me" during authentication, the derived Master Key is securely provisioned to the operating system's native secure storage vault via Tauri's native interface hooks:
  - **macOS:** Keychain Services
  - **Windows:** Credential Manager
  - **Linux:** Secret Service API
- **Persistence Boundary:** A timestamp parameter is bound to the credential block.
- **Initialization Sequence:** Upon application boot, the system verifies the storage ledger:
  - If the current date falls within the 30-day window, the application automatically reads the key out of the OS secure keychain, establishes communication with MongoDB Atlas via the API, and opens the workspace without forcing credential entry.
  - If the threshold has been exceeded ($>30$ days), the keychain storage token is purged, and the user is redirected to the primary password authentication screen.

---

## 5. Database Schema Blueprint (MongoDB Atlas)

The remote database layer maps data inside isolated tenant documents. The server handles indices and structural components but cannot decrypt the payload blocks.

### User Collection (`users`) (TypeScript)


### User Collection (`users`)

| Field               | Type       | Description                                                                                            |
|---------------------|------------|--------------------------------------------------------------------------------------------------------|
| `email`             | string     | Unique Primary User Email, must be unique globally                                                     |
| `is_verified`       | boolean    | Indicates whether the user's email has been verified                                                   |
| `verified_at`       | timestamp  | Timestamp of email verification                                                                        |
| `password_hash`     | string     | Server authentication hash (e.g., Argon2/bcrypt)                                                       |
| `crypto_salt`       | string     | Base64 encoded public salt used for client-side Master Key KDF                                         |
| `two_factor_enabled`| boolean    | 2FA global status toggle                                                                               |
| `created_at`        | timestamp  | Timestamp when the user was created                                                                    |
| `updated_at`        | timestamp  | Timestamp of last profile update                                                                       |
| `last_login_at`     | timestamp  | Updated each time user logs in to the app                                                              |
| `projects`          | array      | List of projects (see below)                                                                           |

**Project Structure (inside `projects` array):**

| Field    | Type     | Description                                  |
|----------|----------|----------------------------------------------|
| `name`   | string   | Name of the project                          |
| `url`    | string   | (Optional) URL of the project                |
| `note`   | string   | (Optional) Additional notes about the project|

---

### Environment File Collection (`env-file`)

| Field                | Type                                   | Description                                       |
|----------------------|----------------------------------------|---------------------------------------------------|
| `project_id`         | Reference (Project)                    | References associated project                     |
| `label`              | string                                 | User friendly name (e.g., '.env.local')           |
| `tag`                | string                                 | Type of environment file (e.g., 'Local', 'Staging', 'Production', 'Custom') |
| `encrypted_dotenvx_key` | string                              | Encrypted with the Client's Master Key            |
| `path`               | string                                 | Path to the env file in cloud storage             |

---

### Credentials Collection (`creds`)

| Field     | Type    | Description                                         |
|-----------|---------|-----------------------------------------------------|
| `name`    | string  | Name of the credential                              |
| `url`     | string  | (Optional) URL associated with the credential       |
| `username`| string  | Encrypted with Client's Master Key                  |
| `password`| string  | Encrypted with Client's Master Key                  |
| `note`   | string  | (Optional) Notes about the credential               |

---

### API Keys Collection (`api-keys`)

| Field     | Type    | Description                                         |
|-----------|---------|-----------------------------------------------------|
| `label`   | string  | Label for the API key                               |
| `url`     | string  | (Optional) URL associated with the API key          |
| `key`     | string  | Encrypted with Client's Master Key                  |
| `note`   | string  | (Optional) Notes about the API key                  |

---

### Platform Collection (`platform`)

| Field         | Type     | Description                                         |
|---------------|----------|-----------------------------------------------------|
| `user_id`     | ObjectId | Reference to the user                               |
| `name`        | string   | Name of the platform                                |
| `note`        | string   | (Optional) Notes about the platform                 |
| `backup_codes`| array    | List of backup codes (see structure below)          |

**Backup Code Structure (inside `backup_codes` array):**

| Field           | Type      | Description                                                     |
|-----------------|-----------|-----------------------------------------------------------------|
| `encrypted_code`| string    | Encrypted with Client's Master Key                              |
| `is_used`       | boolean   | Shows if the backup code has been used (default: false)         |
| `used_at`       | timestamp | Timestamp when the code is marked as used by the user           |

---

## 6. Non-Functional & Security Safeguards

- **Transport Protection:** All network communication between the Tauri Desktop Application and the intermediate Cloud API Server must happen exclusively over TLS 1.3.
- **Rate-Limiting Measures:** The Cloud API gateway must implement rigid rate-limiting windows (e.g., maximum 5 login or OTP validation attempts per IP/Account block every 15 minutes) to mitigate brute-force vector attacks.
- **Volatile Context Isolation:** Plaintext secret variables, raw clipboard tracking objects, and decrypted dotenvx keys must reside strictly within transient runtime memory boundaries and must never be dumped to disk or logged to diagnostic tracking streams.
- **UI Input Filtering:** Contextual search bars implemented within credential layout panels must filter content purely against non-encrypted descriptive metadata (such as project names, profile labels, or variable keys) ensuring data can be searched instantly without requiring background bulk decryption routines.