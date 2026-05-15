# Commands that require an active text editor

Calling these via `commands.execute` (T017) when `vscode.window.activeTextEditor`
is `undefined` returns the bridge error `no_active_editor`. The dispatcher
short-circuits before invoking VS Code so the caller gets a stable error
instead of an internal exception.

Keep this list in sync with `CANONICAL_REQUIRES_ACTIVE_EDITOR` in
`src/rpc/commands.ts`. Each entry is the command id followed by one
sentence describing why an editor is required.

- `editor.action.formatDocument` — formats the visible document.
- `editor.action.commentLine` — toggles a line comment at the cursor.
- `editor.action.rename` — renames the symbol under the cursor.
- `editor.action.goToDeclaration` — jumps to the declaration at the cursor.
- `editor.action.formatSelection` — formats the current selection.
- `editor.action.organizeImports` — reorganises imports in the visible document.
- `editor.action.quickFix` — opens the quick-fix menu at the cursor.
- `editor.action.showHover` — shows the hover popup at the cursor.
- `editor.action.revealDefinition` — peeks/reveals the definition at the cursor.
