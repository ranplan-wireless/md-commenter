// Ranplan change (2026): new file. Sorts a PR's threads for one Markdown file into those on a
// current line and those that are not (whole PR, whole file, removed lines), so none are hidden.
// 0.2.1: threadReadIterations, so threads from older pushes are read at their current lines.
import type { Comment, CommentThreadStatus, GitPullRequestCommentThread } from "azure-devops-extension-api/Git/Git";

/** Where a thread sits: on a current line, on a removed line, on the whole file, or on the whole PR. */
export type ThreadScope = "line" | "removed" | "file" | "pr";

export interface ReviewThread {
  id: number;
  status: CommentThreadStatus;
  scope: ThreadScope;
  /** Source lines for "line" (right side) and "removed" (left side); 0 for "file" and "pr". */
  startLine: number;
  endLine: number;
  comments: Comment[];
}

/** CommentType.System; kept as a number so this module has no runtime dependency on the SDK. */
const SYSTEM_COMMENT = 3;

/** First iteration of the full PR diff; new threads are anchored from it (threadPayload.ts). */
export const FIRST_ITERATION = 1;

/**
 * The `iteration` and `baseIteration` to read threads with. Azure DevOps moves a thread posted on an
 * older push to its line in the latest push only when both are given; with `iteration` alone it
 * returns the line number the thread was posted on, which points at unrelated text after a big push.
 */
export function threadReadIterations(latestIterationId: number): [iteration: number, baseIteration: number] {
  return [latestIterationId, FIRST_ITERATION];
}

/**
 * Threads that belong to `path`, plus the PR's general threads. Deleted threads, system
 * messages and threads left with no comments are dropped; threads on other files are skipped.
 */
export function toReviewThreads(threads: GitPullRequestCommentThread[], path: string): ReviewThread[] {
  const out: ReviewThread[] = [];
  for (const t of threads) {
    if (t.isDeleted) continue;
    const comments = (t.comments ?? []).filter((c) => !c.isDeleted && (c.commentType as number) !== SYSTEM_COMMENT);
    if (!comments.length) continue;

    const tc = t.threadContext;
    let scope: ThreadScope;
    let startLine = 0;
    let endLine = 0;
    if (!tc || !tc.filePath) {
      scope = "pr";
    } else if (tc.filePath !== path) {
      continue;
    } else if (tc.rightFileStart?.line) {
      scope = "line";
      startLine = tc.rightFileStart.line;
      endLine = tc.rightFileEnd?.line ?? startLine;
    } else if (tc.leftFileStart?.line) {
      scope = "removed";
      startLine = tc.leftFileStart.line;
      endLine = tc.leftFileEnd?.line ?? startLine;
    } else {
      scope = "file";
    }
    out.push({ id: t.id, status: t.status, scope, startLine, endLine, comments });
  }
  return out;
}
