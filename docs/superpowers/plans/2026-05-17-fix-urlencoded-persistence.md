# Fix URL Encoded Params Persistence Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Fix URL encoded (and form-data) body parameters being silently lost on app restart by persisting them through the full YAML round-trip.

**Architecture:** Three-layer fix: (1) add `form_data: Vec<KeyValuePair>` to `RequestBodyFile` in Rust (with a `#[serde(rename = "formData")]` to match the TypeScript camelCase), (2) extend `RequestFile.body` TypeScript type to include `formData?: KeyValuePair[]`, (3) fix `tabToRequestFile` and `requestFileToTab` in `tab-store.ts` to include the field on save and restore it on load.

**Tech Stack:** TypeScript (`packages/types`, `apps/desktop/src/stores/`), Rust (serde + serde_yaml), `cargo test` for Rust unit tests, `pnpm typecheck` for TypeScript.

**Upstream issue:** `berbicanes/apiark#68`

---

## Root Cause

URL encoded params live in `RequestBody.formData: KeyValuePair[]` in memory, but:
- `RequestBodyFile` (Rust on-disk struct) has no `form_data` field → serde ignores it during YAML deserialization
- `tabToRequestFile` (TS save) only writes `type` and `content` → `formData` is silently discarded
- `requestFileToTab` (TS load) hardcodes `formData: []` → always empty on load

## File Map

| File | Change |
|---|---|
| `apps/desktop/src-tauri/src/models/collection.rs:1-5` | Import `KeyValuePair` from `super::request` |
| `apps/desktop/src-tauri/src/models/collection.rs:80-87` | Add `form_data: Vec<KeyValuePair>` to `RequestBodyFile` |
| `apps/desktop/src-tauri/src/models/collection.rs` (tests) | Add YAML round-trip test for urlencoded formData |
| `packages/types/src/index.ts:243` | Add `formData?: KeyValuePair[]` to `RequestFile.body` |
| `apps/desktop/src/stores/tab-store.ts:~415` | Widen local `body` variable type to include `formData` |
| `apps/desktop/src/stores/tab-store.ts:~428-429` | Include `formData` in body when saving |
| `apps/desktop/src/stores/tab-store.ts:~299` | Load `formData` from file instead of hardcoded `[]` |

---

### Task 1: Fix Rust `RequestBodyFile` struct + round-trip test

**Files:**
- Modify: `apps/desktop/src-tauri/src/models/collection.rs`

**Note on test order:** The round-trip test references `form_data` on the struct, so the struct fix must come first. Write the test immediately after the fix in the same task — this is the TDD approach adapted for Rust struct additions where a pre-fix compile failure would break the whole test binary.

- [ ] **Step 1: Create branch**

```bash
cd /home/tito/apiark/apiark
git checkout main
git checkout -b fix/68-urlencoded-persistence
```

- [ ] **Step 2: Read `collection.rs` to understand current structure**

Read `apps/desktop/src-tauri/src/models/collection.rs`. Key things to note:
- The existing import line: `use super::request::HttpMethod;` (line ~5)
- `RequestBodyFile` struct (lines ~80-87) only has `body_type` and `content`
- The test module at the bottom (line ~175 onward)

- [ ] **Step 3: Update the import to include `KeyValuePair`**

Find:
```rust
use super::request::HttpMethod;
```

Replace with:
```rust
use super::request::{HttpMethod, KeyValuePair};
```

- [ ] **Step 4: Add `form_data` field to `RequestBodyFile`**

Find the current struct:
```rust
/// Body stored in YAML files
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct RequestBodyFile {
    #[serde(rename = "type")]
    pub body_type: String,
    #[serde(default)]
    pub content: String,
}
```

Replace with:
```rust
/// Body stored in YAML files
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct RequestBodyFile {
    #[serde(rename = "type")]
    pub body_type: String,
    #[serde(default)]
    pub content: String,
    #[serde(default, rename = "formData", skip_serializing_if = "Vec::is_empty")]
    pub form_data: Vec<KeyValuePair>,
}
```

- [ ] **Step 5: Add round-trip test inside the existing `#[cfg(test)] mod tests` block**

Add this test after the last existing test, before the closing `}` of the `mod tests` block:

```rust
#[test]
fn test_urlencoded_form_data_round_trips() {
    let yaml = r#"
name: Login
method: POST
url: https://example.com/login
body:
  type: urlencoded
  formData:
    - id: kv1
      key: username
      value: john
      enabled: true
    - id: kv2
      key: password
      value: secret
      enabled: true
"#;
    let file: RequestFile = serde_yaml::from_str(yaml).unwrap();
    let body = file.body.unwrap();
    assert_eq!(body.body_type, "urlencoded");
    assert_eq!(body.form_data.len(), 2);
    assert_eq!(body.form_data[0].key, "username");
    assert_eq!(body.form_data[0].value, "john");
    assert_eq!(body.form_data[1].key, "password");

    // Round-trip: serialize and deserialize again
    let serialized = serde_yaml::to_string(&file).unwrap();
    assert!(
        serialized.contains("username"),
        "serialized YAML must contain formData keys, got:\n{serialized}"
    );
    let reloaded: RequestFile = serde_yaml::from_str(&serialized).unwrap();
    assert_eq!(reloaded.body.unwrap().form_data.len(), 2);
}
```

- [ ] **Step 6: Run all collection tests**

```bash
cd /home/tito/apiark/apiark/apps/desktop/src-tauri
cargo test collection 2>&1
```

Expected output:
```
test models::collection::tests::test_request_meta_detects_graphql ... ok
test models::collection::tests::test_request_meta_non_graphql ... ok
test models::collection::tests::test_request_meta_detects_graphql_multiline ... ok
test models::collection::tests::test_request_meta_get_not_graphql ... ok
test models::collection::tests::test_urlencoded_form_data_round_trips ... ok

test result: ok. 5 passed; 0 failed
```

- [ ] **Step 7: Commit**

```bash
cd /home/tito/apiark/apiark
git add apps/desktop/src-tauri/src/models/collection.rs
git commit -m "fix(models): add form_data field to RequestBodyFile for YAML persistence"
```

---

### Task 2: Fix TypeScript type and save/load functions

**Files:**
- Modify: `packages/types/src/index.ts` (line 243)
- Modify: `apps/desktop/src/stores/tab-store.ts` (lines ~299, ~415, ~428-429)

- [ ] **Step 1: Extend `RequestFile.body` in `packages/types/src/index.ts`**

Read the file first to confirm line numbers. Find:
```typescript
  body?: { type: string; content: string };
```

Replace with:
```typescript
  body?: { type: string; content: string; formData?: KeyValuePair[] };
```

(`KeyValuePair` is already defined in this file at line ~23.)

- [ ] **Step 2: Widen the `body` local variable type in `tabToRequestFile`**

Read `apps/desktop/src/stores/tab-store.ts`. Find around line 415:
```typescript
  let body: { type: string; content: string } | undefined;
```

Replace with:
```typescript
  let body: { type: string; content: string; formData?: KeyValuePair[] } | undefined;
```

- [ ] **Step 3: Save `formData` in `tabToRequestFile`**

Find around line 428-429:
```typescript
  } else if (tab.body.type !== "none") {
    body = { type: tab.body.type, content: tab.body.content };
  }
```

Replace with:
```typescript
  } else if (tab.body.type !== "none") {
    body = { type: tab.body.type, content: tab.body.content };
    if (["urlencoded", "form-data"].includes(tab.body.type)) {
      const savedPairs = tab.body.formData.filter(
        (kv) => kv.key.trim() || kv.value.trim(),
      );
      if (savedPairs.length > 0) body.formData = savedPairs;
    }
  }
```

- [ ] **Step 4: Restore `formData` in `requestFileToTab`**

Find around line 295-301:
```typescript
  const body: RequestBody = file.body
    ? {
        type: file.body.type as RequestBody["type"],
        content: file.body.content || "",
        formData: [],
      }
    : { type: "none", content: "", formData: [] };
```

Replace with:
```typescript
  const body: RequestBody = file.body
    ? {
        type: file.body.type as RequestBody["type"],
        content: file.body.content || "",
        formData: file.body.formData ?? [],
      }
    : { type: "none", content: "", formData: [] };
```

- [ ] **Step 5: TypeScript type check**

```bash
cd /home/tito/apiark/apiark
pnpm --filter desktop typecheck 2>&1 | tail -30
```

Expected: no errors. If the `typecheck` script doesn't exist try:
```bash
pnpm --filter desktop exec tsc --noEmit 2>&1 | tail -30
```

- [ ] **Step 6: Commit**

```bash
cd /home/tito/apiark/apiark
git add packages/types/src/index.ts apps/desktop/src/stores/tab-store.ts
git commit -m "$(cat <<'EOF'
fix(persistence): persist urlencoded and form-data body params across restarts

Fixes berbicanes/apiark#68

URL encoded key-value pairs were stored in memory (body.formData) but
never written to YAML on save, and always loaded back as an empty array.

- Extended RequestFile.body type to include optional formData field
- tabToRequestFile: saves non-empty formData pairs for urlencoded/form-data
- requestFileToTab: restores formData from file instead of hardcoding []
EOF
)"
```

---

### Task 3: Open PR upstream

- [ ] **Step 1: Push branch to fork**

```bash
cd /home/tito/apiark/apiark
git push origin fix/68-urlencoded-persistence
```

- [ ] **Step 2: Open PR on upstream**

```bash
gh pr create \
  --repo berbicanes/apiark \
  --head diegoQuinas:fix/68-urlencoded-persistence \
  --base main \
  --title "fix(persistence): persist urlencoded and form-data body params across restarts" \
  --body "$(cat <<'EOF'
## Problem

URL encoded (and form-data) key-value pairs entered in the request body are lost when the app restarts. Closes #68.

## Root Cause

Three bugs in cascade:

1. **`RequestBodyFile` (Rust on-disk struct)** had no `form_data` field — serde silently ignored the `formData` key when reading YAML, and couldn't write it
2. **`tabToRequestFile` (TypeScript save)** only serialized `type` and `content`, discarding `formData`
3. **`requestFileToTab` (TypeScript load)** hardcoded `formData: []` regardless of what was saved

## Fix

- Added `form_data: Vec<KeyValuePair>` to `RequestBodyFile` with `#[serde(rename = "formData", skip_serializing_if = "Vec::is_empty")]` to match the camelCase TypeScript convention
- Extended `RequestFile.body` TypeScript type to include `formData?: KeyValuePair[]`
- `tabToRequestFile` now saves non-empty form pairs
- `requestFileToTab` now restores `formData` from the file

## Testing

Added Rust unit test verifying full YAML round-trip for urlencoded formData. All collection tests pass.

```bash
cd apps/desktop/src-tauri && cargo test collection
# test result: ok. 5 passed; 0 failed
```

Affects both `urlencoded` and `form-data` body types.
EOF
)"
```
