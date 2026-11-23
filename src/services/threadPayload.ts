import { CommentThreadStatus, CommentType, GitPullRequestCommentThread } from "azure-devops-extension-api/Git/Git";
import { SourceAnchor } from "../markdown/sourceMap";
// Ranplan change (2026, 0.2.1): the first iteration comes from threadSplit.ts, shared with thread reads.
import { FIRST_ITERATION } from "./threadSplit";

/**
 * Body for POST .../pullRequests/{id}/threads, anchored like a comment made in the diff view:
 * right side of the full PR diff (iteration 1 → latest), on the file's changeTrackingId.
 */
export function buildLineThread(
  filePath: string,
  changeTrackingId: number,
  latestIterationId: number,
  anchor: SourceAnchor,
  content: string
): GitPullRequestCommentThread {
  return {
    comments: [{ parentCommentId: 0, content, commentType: CommentType.Text }],
    status: CommentThreadStatus.Active,
    threadContext: {
      filePath,
      rightFileStart: { line: anchor.startLine, offset: anchor.startOffset },
      rightFileEnd: { line: anchor.endLine, offset: anchor.endOffset }
    },
    pullRequestThreadContext: {
      changeTrackingId,
      iterationContext: { firstComparingIteration: FIRST_ITERATION, secondComparingIteration: latestIterationId }
    }
  } as unknown as GitPullRequestCommentThread;
}
