Here's the syntax validation checklist of env:

---

### 1. Line Structure
- **Every non-comment, non-empty line must contain exactly one `=`** (or `:` if you support that format)
- **No whitespace before the `=`** — `KEY = value` is invalid in strict parsers (should be `KEY=value`)
- **No spaces in the key name** — `MY KEY=value` is invalid

---

### 2. Key Validation
- **Keys must start with a letter** (`A-Z` or `a-z`) or underscore (`_`)
- **Keys can only contain:** letters, numbers, and underscores (`A-Za-z0-9_`)
- **No special characters in keys** — `MY-KEY=value` is invalid (dash not allowed)
- **No quotes around keys** — `"KEY"=value` is invalid

---

### 3. Value Validation & Quoting
- **Values can be unquoted, single-quoted, or double-quoted**
- **Unquoted values:** No spaces allowed — `KEY=hello world` is invalid (should be `KEY="hello world"`)
- **Single quotes (`'`):** Preserve everything literally inside — `KEY='$hello'` keeps the `$` as text
- **Double quotes (`"`):** Support escape sequences like `\n`, `\t`, `\\`, and `\"`
- **Quotes must be balanced** — `KEY="hello` is invalid (missing closing quote)
- **Multiline values:** Must start and end with quotes, and support `\n` or actual line breaks inside

---

### 4. Comments
- **Comments start with `#`** (must be at the beginning of the line, or at the end after a value)
- **Inline comments:** Must have a space before the `#` — `KEY=value #comment` (valid) vs `KEY=value#comment` (invalid if your parser is strict)
- **Empty lines** — should be ignored (skipped)

---

### 5. Whitespace Rules
- **No leading/trailing spaces** around the `=` — `KEY = value` is invalid
- **No trailing spaces** at the end of a value line — `KEY=value ` is invalid
- **Indentation** — lines should start at column 0 (no tabs or spaces before the key)

---

### 6. Special Character Escaping
- **Unquoted values cannot contain:** spaces, `#`, `$`, `\`, `'`, `"`
- **In double-quoted values:** `\n`, `\r`, `\t`, `\\`, `\"`, `\$` must be recognized
- **In single-quoted values:** No escaping — everything is literal

---

### 7. Duplicate Keys
- **Duplicate keys are usually invalid** — `KEY=value1` and later `KEY=value2` in the same file should be rejected (or at least warn with "last one wins")

---

### 8. Empty Values
- **Empty values are valid** — `KEY=` (sets empty string)
- **But `KEY` alone (without `=`) is invalid**

---

### 9. Blank Lines & EOF
- **Empty lines are ignored** (valid)
- **File should end with a newline** (not strictly required, but good practice)

---

### Simple Validation Flow

```text
For each line in .env file:
  1. Trim whitespace
  2. If line starts with '#' → skip (comment)
  3. If line is empty → skip
  4. If line doesn't contain '=' → ❌ INVALID
  5. Split at first '='
  6. key = left side (trim)
  7. value = right side (trim)
  8. If key is empty → ❌ INVALID
  9. If key contains spaces or special chars → ❌ INVALID
  10. If value has unescaped spaces (unquoted) → ❌ INVALID
  11. Check quotes are balanced → ❌ INVALID
  12. Check if key already exists → ⚠️ DUPLICATE (warn or reject)
  13. If all pass → ✅ VALID
```

---

### Common Invalid Examples

| Line | Why Invalid |
|------|-------------|
| `KEY = value` | Space before `=` |
| `KEY= value` | Space after `=` |
| `KEY =value` | Space before `=` |
| `KEY=hello world` | Unquoted value with space |
| `KEY="hello` | Unbalanced quote |
| `MY-KEY=value` | Dash in key name |
| `123KEY=value` | Key starts with number |
| `KEY` | No `=` sign |
| `=value` | No key |
| `KEY=value #comment` | No space before `#` (parser dependent) |

---

### Strict vs. Lenient Mode
- **Strict:** Reject everything in the "Invalid" table above
- **Lenient:** Auto-fix by stripping spaces, trim values, and warn instead of reject

---

**Bottom line:** For a valid `.env` file syntax, enforce:
- `KEY=value` (no spaces around `=`)
- Keys: `[A-Za-z_][A-Za-z0-9_]*`
- Quotes balanced
- One key per line
- No duplicate keys

That's it. Everything else is just strictness level.