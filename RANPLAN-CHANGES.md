# Ranplan changes

This is Ranplan Wireless's fork of [MD Commenter](https://github.com/7Rush-Software-Solutions/md-commenter)
(Apache-2.0, see `LICENSE.txt`), based on upstream commit `f6170c5` (v0.1.17).
Every modified file carries a "Ranplan change(s) (2026)" note at the top.

## Changes (2026-11)

1. **No blank tab.** In `App.tsx` a hook ran after two early returns, so the tab went blank when a
   pull request had no Markdown files or loading failed. All hooks now run first.
2. **Refresh shows new pushes.** Refresh used to re-read only the threads of the iteration seen
   when the tab opened. It now re-reads the pull request, its latest iteration, the file list, the
   file text and the threads, keeps the open file, and says when a newer update is shown.
3. **Comments not on a line are listed.** Whole-PR comments, whole-file comments and comments on
   removed lines were hidden. They now appear under "Not on a line", with reply and resolve
   (`src/services/threadSplit.ts`).
4. **English loading messages.** Progress and error messages that were hard-coded in Spanish in
   `adoClient.ts` now come from `i18n.ts`; the tab page is declared `lang="en"`.
5. **Second safety layer.** The document and every comment are passed through DOMPurify
   (`src/markdown/sanitize.ts`) on top of markdown-it's `html: false`.
6. **Edit and delete your own comments.** Only on comments whose author is the signed-in user;
   Delete asks for confirmation. Same permissions as before (`vso.code`, `vso.threads_full`).

## Changes in 0.2.1 (2026-11)

7. **Comments stay on their lines after a push.** Threads were read with only the latest iteration,
   so Azure DevOps returned the line each thread was posted on. After a push that adds or removes
   lines, older comments sat on unrelated text. Threads are now read with a base iteration (the
   first one, the same one new threads are anchored from), so Azure DevOps moves each thread to its
   line in the latest push, as the Files tab does (`threadReadIterations` in `threadSplit.ts`).
8. **Jump from the comment list.** The whole comment card, not only its line label, jumps to its
   block; clicks on the card's own buttons, links and reply box, or while text is selected, don't.
   The block is scrolled to the middle of the view and flashes briefly. Closing the block view (×
   or Esc) scrolls the list back to the card the jump started from.

## Publishing (0.2.0)

- Published as a **private** extension under the `ranplan` Marketplace publisher (`vss-extension.json`:
  `publisher`, `public: false`). Extension id stays `md-commenter-pr`.
- Version 0.2.0 is the first Ranplan release.
- Support, licence and repository links point to this fork; the upstream privacy and terms pages
  are 7Rush's and do not cover this build, so they were removed.

Tests for these changes: `test/ranplan.test.ts` (run with `npm test`).
New dependencies (exact versions): `dompurify` 3.2.4; for tests only, `jsdom` 25.0.1 and `@types/jsdom` 21.1.7.
