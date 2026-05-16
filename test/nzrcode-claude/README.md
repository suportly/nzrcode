# Claude Code bridge smoke tests

Structural checks for feature `0005-claude-code-bridge`. Behavioural
coverage lives in the mocha suite at
`src/vs/workbench/services/nzr/test/common/claudeCodeBridge.test.ts`.

## Run

```sh
bash test/nzrcode-claude/run_all.sh
```

## What each script checks

- `test_files_exist.sh` — the four source files exist (types, interface,
  Electron implementation, mocha test).
- `test_interface_shape.sh` — types in `claudeCode.ts` carry the six
  declared shapes; `claudeCodeBridge.ts` declares the four events and
  four methods of the `IClaudeCodeBridge` contract.
- `test_registration.sh` — the existing electron contribution
  (shared with feature 0004) registers `IClaudeCodeBridge` alongside
  `IAiadevAdapter`.

## What this suite does NOT cover

- Real spawn behaviour, ENOENT handling, signal escalation — those need
  the dev build or a Node mocha runner.
- The `claude` CLI being on the user's PATH at runtime.
