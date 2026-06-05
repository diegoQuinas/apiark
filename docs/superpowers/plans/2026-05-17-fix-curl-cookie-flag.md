# Fix curl -b/--cookie import Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Fix curl import so that `-b` / `--cookie` flags are parsed and their value is imported as a `Cookie` header instead of being silently dropped.

**Architecture:** Single match arm addition in the `parse_curl` token loop in `curl.rs`. Follows the exact same pattern as existing `-H`/`-u`/`-d` arms — consume the flag, advance `i`, read the next token as the value.

**Tech Stack:** Rust, `cargo test` for unit tests.

**Upstream issue:** `berbicanes/apiark#66`

---

## File Map

- Modify: `apps/desktop/src-tauri/src/http/curl.rs` — add match arm for `-b`/`--cookie` and two new unit tests

---

### Task 1: Write failing tests

**Files:**
- Modify: `apps/desktop/src-tauri/src/http/curl.rs` (tests module, lines 204–240)

- [ ] **Step 1: Add two failing tests to the `tests` module**

Open `apps/desktop/src-tauri/src/http/curl.rs` and add the following two tests inside the existing `#[cfg(test)] mod tests { ... }` block, after `test_insecure_flag`:

```rust
#[test]
fn test_cookie_short_flag() {
    let result = parse_curl(
        "curl https://example.com -b 'session=abc123; token=xyz'",
    )
    .unwrap();
    assert_eq!(
        result.headers.get("Cookie").map(String::as_str),
        Some("session=abc123; token=xyz"),
    );
}

#[test]
fn test_cookie_long_flag() {
    let result = parse_curl(
        "curl https://example.com --cookie 'session=abc123'",
    )
    .unwrap();
    assert_eq!(
        result.headers.get("Cookie").map(String::as_str),
        Some("session=abc123"),
    );
}
```

- [ ] **Step 2: Run tests to verify they fail**

```bash
cd apps/desktop/src-tauri
cargo test http::curl 2>&1
```

Expected output includes:
```
FAILED
test http::curl::tests::test_cookie_short_flag ... FAILED
test http::curl::tests::test_cookie_long_flag ... FAILED
```

The failures confirm the tests are wired up and the feature is missing.

- [ ] **Step 3: Commit the failing tests**

```bash
git add apps/desktop/src-tauri/src/http/curl.rs
git commit -m "test(curl): add failing tests for -b/--cookie flag parsing"
```

---

### Task 2: Implement the fix

**Files:**
- Modify: `apps/desktop/src-tauri/src/http/curl.rs` (parse_curl match block, around line 66)

- [ ] **Step 1: Add the match arm for `-b` / `--cookie`**

In `parse_curl`, find the match arm for `"-L" | "--location"` (currently around line 64) and add the new arm **before** the `_ =>` catch-all:

```rust
"-b" | "--cookie" => {
    i += 1;
    if let Some(cookie_val) = tokens.get(i) {
        headers.insert("Cookie".to_string(), cookie_val.clone());
    }
}
```

The resulting match block should look like:

```rust
"-k" | "--insecure" => {
    verify_ssl = false;
}
"-L" | "--location" => {
    follow_redirects = true;
}
"-b" | "--cookie" => {
    i += 1;
    if let Some(cookie_val) = tokens.get(i) {
        headers.insert("Cookie".to_string(), cookie_val.clone());
    }
}
"--compressed" | "-s" | "--silent" | "-S" | "--show-error" | "-v" | "--verbose" => {
    // Ignored flags
}
```

- [ ] **Step 2: Run all curl tests to verify they pass**

```bash
cd apps/desktop/src-tauri
cargo test http::curl 2>&1
```

Expected output:
```
running 6 tests
test http::curl::tests::test_basic_auth ... ok
test http::curl::tests::test_cookie_long_flag ... ok
test http::curl::tests::test_cookie_short_flag ... ok
test http::curl::tests::test_insecure_flag ... ok
test http::curl::tests::test_post_with_data ... ok
test http::curl::tests::test_simple_get ... ok

test result: ok. 6 passed; 0 failed
```

- [ ] **Step 3: Commit the fix**

```bash
git add apps/desktop/src-tauri/src/http/curl.rs
git commit -m "fix(curl): parse -b/--cookie flag as Cookie header

Fixes berbicanes/apiark#66

The -b / --cookie flag was hitting the unknown-flag catch-all and
being silently dropped along with its value. Added a match arm that
reads the next token and inserts it as a Cookie header, consistent
with how other value-consuming flags (-H, -d, -u) are handled."
```

---

### Task 3: Open PR upstream

- [ ] **Step 1: Create branch and push to your fork**

```bash
git checkout main
git checkout -b fix/66-curl-cookie-flag
git cherry-pick <commit-hash-of-fix-commit>
git push origin fix/66-curl-cookie-flag
```

(The commits from Tasks 1 and 2 should be on this branch. If you worked directly on it, just push.)

- [ ] **Step 2: Open PR on upstream**

```bash
gh pr create \
  --repo berbicanes/apiark \
  --title "fix(curl): parse -b/--cookie flag as Cookie header" \
  --body "$(cat <<'EOF'
## Problem

When importing a curl command that uses `-b` or `--cookie`, the flag and its value were silently dropped. No error was shown. Closes #66.

## Root Cause

In `parse_curl()` (`apps/desktop/src-tauri/src/http/curl.rs`), the `-b`/`--cookie` flag hit the `_ =>` catch-all, which skipped the flag but left the cookie value to be mishandled by the next loop iteration.

## Fix

Added a match arm that consumes the next token and inserts it as a `Cookie` header — consistent with how `-H`, `-d`, and `-u` are handled.

## Testing

Added two unit tests: one for `-b` (short form) and one for `--cookie` (long form). All 6 curl unit tests pass.

```bash
cd apps/desktop/src-tauri && cargo test http::curl
# test result: ok. 6 passed; 0 failed
```
EOF
)"
```
