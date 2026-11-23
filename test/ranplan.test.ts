// Ranplan (2026): tests for the fixes made in this fork.
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { JSDOM } from "jsdom";
import createDOMPurify from "dompurify";
import { FIRST_ITERATION, threadReadIterations, toReviewThreads } from "../src/services/threadSplit.ts";
import { sanitizeHtml } from "../src/markdown/sanitize.ts";
import { createRenderer } from "../src/markdown/sourceMap.ts";

let passed = 0;
function test(name: string, fn: () => void) {
  fn();
  passed++;
  console.log("  ok -", name);
}

// ---- Fix 3: threads not on a line are kept, with where they sit -------------------------------
const PATH = "/designs/x/design.md";
const comment = (id: number, extra: object = {}) => ({ id, content: `c${id}`, commentType: 1, ...extra });
const raw: any[] = [
  { id: 1, status: 1, threadContext: { filePath: PATH, rightFileStart: { line: 5, offset: 1 }, rightFileEnd: { line: 6, offset: 9 } }, comments: [comment(1)] },
  { id: 2, status: 1, comments: [comment(2)] }, // whole PR: no threadContext
  { id: 3, status: 1, threadContext: { filePath: PATH }, comments: [comment(3)] }, // whole file
  { id: 4, status: 2, threadContext: { filePath: PATH, leftFileStart: { line: 9, offset: 1 }, leftFileEnd: { line: 9, offset: 4 } }, comments: [comment(4)] },
  { id: 5, status: 1, threadContext: { filePath: "/other.md", rightFileStart: { line: 1, offset: 1 } }, comments: [comment(5)] },
  { id: 6, status: 1, isDeleted: true, threadContext: { filePath: PATH, rightFileStart: { line: 2, offset: 1 } }, comments: [comment(6)] },
  { id: 7, status: 1, threadContext: { filePath: PATH, rightFileStart: { line: 3, offset: 1 } }, comments: [comment(7, { isDeleted: true })] },
  { id: 8, status: 1, comments: [comment(8, { commentType: 3 })] }, // system message only
  { id: 9, status: 1, threadContext: { filePath: PATH, rightFileStart: { line: 7, offset: 1 } }, comments: [comment(90), comment(91, { commentType: 3 })] }
];
const split = toReviewThreads(raw, PATH);
const byId = new Map(split.map((t) => [t.id, t]));

test("line thread keeps its right-side lines", () => {
  assert.deepEqual([byId.get(1)!.scope, byId.get(1)!.startLine, byId.get(1)!.endLine], ["line", 5, 6]);
});
test("thread with no file is listed as whole PR", () => assert.equal(byId.get(2)!.scope, "pr"));
test("thread on the file without a line is listed as whole file", () => assert.equal(byId.get(3)!.scope, "file"));
test("thread on removed lines keeps its left-side lines", () => {
  assert.deepEqual([byId.get(4)!.scope, byId.get(4)!.startLine], ["removed", 9]);
});
test("threads on other files are skipped", () => assert.equal(byId.has(5), false));
test("deleted threads, emptied threads and system-only threads are dropped", () => {
  assert.equal(byId.has(6), false);
  assert.equal(byId.has(7), false);
  assert.equal(byId.has(8), false);
});
test("system messages are removed from a thread's comments", () => {
  assert.deepEqual(byId.get(9)!.comments.map((c) => c.id), [90]);
});

// ---- Fix 5: second safety layer on rendered HTML ---------------------------------------------
const purify = createDOMPurify(new JSDOM("").window as any);
const clean = (html: string) => sanitizeHtml(html, purify);
const md = createRenderer();

test("raw event handlers are removed", () => {
  const out = clean('<img src="x" onerror="alert(1)"><p onclick="alert(2)">hi</p>');
  assert.doesNotMatch(out, /onerror|onclick|alert/);
});
test("javascript: links are removed", () => {
  assert.doesNotMatch(clean('<a href="javascript:alert(1)">x</a>'), /javascript:/);
});
test("script tags are removed", () => assert.doesNotMatch(clean("<script>alert(1)</script><p>ok</p>"), /script/));
test("source-line attributes on rendered blocks survive (attribute order may change)", () => {
  const doc = new JSDOM(clean(md.render("# Title\n\n| A | B |\n|---|---|\n| 1 | 2 |\n"))).window.document;
  const h1 = doc.querySelector("h1")!;
  assert.deepEqual([h1.getAttribute("data-sl"), h1.getAttribute("data-el")], ["1", "1"]);
  const row = doc.querySelectorAll("tr")[1];
  assert.deepEqual([row.getAttribute("data-sl"), row.getAttribute("data-el")], ["5", "5"]);
});
test("repo images keep their data-repo-src for the authenticated fetch", () => {
  assert.match(clean(md.render("![m](mockups/a.png)")), /data-repo-src="mockups\/a\.png"/);
});
test("external links keep target and rel", () => {
  const out = clean(md.render("[x](https://example.com)"));
  assert.match(out, /target="_blank"/);
  assert.match(out, /rel="noopener noreferrer"/);
});
test("Markdown in a comment still renders", () => {
  assert.match(clean(md.render("**bold** and `code`")), /<strong>bold<\/strong> and <code>code<\/code>/);
});

// ---- Fix 4: no hard-coded Spanish outside the Spanish dictionary -----------------------------
const src = (p: string) => readFileSync(new URL(`../${p}`, import.meta.url), "utf8");
test("adoClient has no hard-coded user-facing Spanish", () => {
  assert.doesNotMatch(src("src/services/adoClient.ts"), /Leyendo|Obteniendo|Cargando|No se pudo/);
});
test("the tab page is declared as English", () => assert.match(src("webpack.config.js"), /<html lang="en">/));

// ---- Fix 1: every hook in App runs before the early returns ----------------------------------
test("App calls no hook after its first early return", () => {
  const app = src("src/components/App.tsx");
  const body = app.slice(app.indexOf("export function App()"));
  const firstReturn = body.search(/\n\s+if \([^)]*\) return </);
  assert.ok(firstReturn > 0, "early return not found");
  const after = body.slice(firstReturn);
  const hookCall = after.match(/\buse[A-Z]\w*\(/);
  assert.equal(hookCall, null, `hook called after an early return: ${hookCall?.[0]}`);
});

// ---- 0.2.1: threads from older pushes are read at their current line -------------------------
// A real thread posted on push 1, as Azure DevOps returns it with $iteration=3 and each base.
const tracking = JSON.parse(readFileSync(new URL("./fixtures/thread-tracking.json", import.meta.url), "utf8"));
const FIXTURE_PATH = "/docs/design.md";
const readWithBase = (base: number) => toReviewThreads([tracking[`base${base}`]], FIXTURE_PATH)[0];

test("threads are read with the latest iteration and base 0", () => {
  const [iteration, base] = threadReadIterations(3);
  assert.equal(iteration, 3);
  assert.equal(base, 0);
  assert.ok(`base${base}` in tracking, "the fixture holds the response for the base the code uses");
});
test("with base 0, a thread from push 1 is on its current line", () => {
  const th = readWithBase(threadReadIterations(3)[1]);
  assert.deepEqual([th.scope, th.startLine, th.endLine], ["line", 115, 115]);
});
test("with base 1, the same thread would be wrongly listed as removed", () => {
  const th = readWithBase(1);
  assert.deepEqual([th.scope, th.startLine], ["removed", 110]);
});
test("new threads are still anchored from iteration 1", () => assert.equal(FIRST_ITERATION, 1));
test("adoClient passes a base iteration when reading threads", () => {
  const call = src("src/services/adoClient.ts").match(/getThreads\(([^)]*)\)/);
  assert.ok(call, "getThreads call not found");
  assert.equal(call![1].split(",").length, 5, "getThreads needs iteration and baseIteration");
  assert.match(src("src/services/adoClient.ts"), /threadReadIterations\(ctx\.iterationId\)/);
});
test("new threads are anchored from the same first iteration", () => {
  assert.match(src("src/services/threadPayload.ts"), /firstComparingIteration: FIRST_ITERATION/);
});

// ---- 0.2.1: jumping from the comment list --------------------------------------------------------
test("the whole card jumps to its block, but not from its own controls or a text selection", () => {
  const view = src("src/components/ThreadView.tsx");
  assert.match(view, /data-thread-id=\{thread\.id\}/);
  assert.match(view, /onClick=\{onCardClick\}/);
  assert.match(view, /closest\?\.\("button, a, textarea, input, select, label"\)/);
  assert.match(view, /!sel\.isCollapsed/);
  assert.match(view, /thread\.scope === "line"/);
});
test("a card with an open reply, edit or delete box doesn't jump, so a draft isn't lost", () => {
  assert.match(src("src/components/ThreadView.tsx"), /if \(replying \|\| editingId !== undefined \|\| confirmingId !== undefined\) return;/);
});
test("a jump centres and flashes the block, and closing returns to the card", () => {
  assert.match(src("src/components/MarkdownPreview.tsx"), /block: "center"/);
  assert.match(src("src/components/CommentPanel.tsx"), /data-thread-id="\$\{returnToThreadId\}"/);
  assert.match(src("src/styles/styles.css"), /@keyframes mdr-flash/);
});

console.log(`\n${passed} tests passed`);
