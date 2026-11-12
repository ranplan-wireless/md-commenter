// Ranplan changes (2026): English progress messages, current user id, edit/delete own comments,
// and threads that are not on a line are returned too (see threadSplit.ts).
import * as SDK from "azure-devops-extension-sdk";
import { getClient } from "azure-devops-extension-api";
import { CommonServiceIds, IHostNavigationService, ILocationService, IProjectPageService } from "azure-devops-extension-api/Common/CommonServices";
import { GitServiceIds, IVersionControlRepositoryService } from "azure-devops-extension-api/Git/GitServices";
import { GitRestClient } from "azure-devops-extension-api/Git/GitClient";
import {
  Comment,
  CommentThreadStatus,
  CommentType,
  GitPullRequest,
  GitPullRequestCommentThread,
  GitVersionOptions,
  GitVersionType,
  VersionControlChangeType
} from "azure-devops-extension-api/Git/Git";
import { SourceAnchor } from "../markdown/sourceMap";
import { buildLineThread } from "./threadPayload";
import { ReviewThread, toReviewThreads } from "./threadSplit";
import { t } from "../i18n";

export type { ReviewThread };

export interface PrContext {
  project: string;
  repositoryId: string;
  pullRequestId: number;
  pullRequest: GitPullRequest;
  /** Latest iteration: the "right side" of the full PR diff. */
  iterationId: number;
  commitId: string;
  /** Merge base (left side of the full PR diff), used to detect added lines. */
  baseCommitId: string;
  /** Signed-in user's identity id, to offer edit/delete on their own comments. */
  userId: string;
}

export interface MdFile {
  path: string;
  changeTrackingId: number;
  isNew: boolean;
}

const MD_EXT = /\.(md|markdown|mdx)$/i;

let client: GitRestClient | undefined;
const git = () => (client ??= getClient(GitRestClient));

function toNumber(value: unknown): number | undefined {
  const n = parseInt(String(value ?? ""), 10);
  return Number.isFinite(n) && n > 0 ? n : undefined;
}

/**
 * Finds out which PR the tab is showing. The PR-tab configuration has varied between
 * host versions, so we try the configuration first and fall back to the page route
 * and the host's repository service.
 */
export async function resolvePrContext(report: (stage: string) => void = () => undefined): Promise<PrContext> {
  report(t("stageReadingConfig"));
  const config = (SDK.getConfiguration() ?? {}) as any;
  console.info("[MD Commenter] tab configuration keys:", Object.keys(config));

  let pullRequestId = toNumber(config.pullRequest?.pullRequestId ?? config.pullRequestId);
  let repositoryId: string | undefined = config.pullRequest?.repository?.id ?? config.repositoryId;
  let project: string | undefined = config.pullRequest?.repository?.project?.id ?? config.projectId;

  if (!pullRequestId) {
    report(t("stagePrIdFromUrl"));
    const nav = await SDK.getService<IHostNavigationService>(CommonServiceIds.HostNavigationService);
    const route = await nav.getPageRoute();
    const rv = route.routeValues ?? {};
    console.info("[MD Commenter] page route:", route.id, rv);
    pullRequestId = toNumber(rv.pullRequestId ?? rv.parameters);
  }
  if (!repositoryId) {
    report(t("stageRepository"));
    const repoService = await SDK.getService<IVersionControlRepositoryService>(GitServiceIds.VersionControlRepositoryService);
    const repo = await repoService.getCurrentGitRepository();
    repositoryId = repo?.id;
    project ??= repo?.project?.id;
  }
  if (!project) {
    report(t("stageProject"));
    const projectService = await SDK.getService<IProjectPageService>(CommonServiceIds.ProjectPageService);
    project = (await projectService.getProject())?.id;
  }
  if (!pullRequestId || !repositoryId || !project) {
    throw new Error(t("prNotIdentified"));
  }

  console.info("[MD Commenter] resolved:", { pullRequestId, repositoryId, project });
  report(t("stageLoadingPr", { id: pullRequestId }));
  const pullRequest = await git().getPullRequest(repositoryId, pullRequestId, project);
  report(t("stageLoadingIterations", { id: pullRequestId }));
  const iterations = await git().getPullRequestIterations(repositoryId, pullRequestId, project);
  const latest = iterations[iterations.length - 1];

  return {
    project,
    repositoryId,
    pullRequestId,
    pullRequest,
    iterationId: latest.id,
    commitId: latest.sourceRefCommit?.commitId ?? pullRequest.lastMergeSourceCommit.commitId,
    baseCommitId: latest.commonRefCommit?.commitId ?? pullRequest.lastMergeTargetCommit?.commitId ?? "",
    userId: SDK.getUser()?.id ?? ""
  };
}

/** Markdown files changed in the PR (full diff: base → latest iteration). Deleted files are skipped. */
export async function listMarkdownFiles(ctx: PrContext): Promise<MdFile[]> {
  const files: MdFile[] = [];
  let skip = 0;
  for (;;) {
    const page = await git().getPullRequestIterationChanges(ctx.repositoryId, ctx.pullRequestId, ctx.iterationId, ctx.project, 1000, skip, 0);
    for (const change of page.changeEntries ?? []) {
      const path = change.item?.path;
      if (!path || !MD_EXT.test(path)) continue;
      if (change.changeType & VersionControlChangeType.Delete) continue;
      files.push({
        path,
        changeTrackingId: change.changeTrackingId,
        isNew: Boolean(change.changeType & VersionControlChangeType.Add)
      });
    }
    if (!page.nextSkip) break;
    skip = page.nextSkip;
  }
  return files.sort((a, b) => a.path.localeCompare(b.path));
}

const atCommit = (commitId: string) => ({
  version: commitId,
  versionType: GitVersionType.Commit,
  versionOptions: GitVersionOptions.None
});

/** File text at the PR's latest source commit (the right side of the diff). */
export function getFileText(ctx: PrContext, path: string): Promise<string> {
  return git().getItemText(ctx.repositoryId, path, ctx.project, undefined, undefined, false, false, false, atCommit(ctx.commitId), true);
}

/** File text at the PR's merge base (the left side of the diff), for computing added lines. */
export function getFileBaseText(ctx: PrContext, path: string): Promise<string> {
  return git().getItemText(ctx.repositoryId, path, ctx.project, undefined, undefined, false, false, false, atCommit(ctx.baseCommitId), true);
}

const MIME: Record<string, string> = {
  png: "image/png", jpg: "image/jpeg", jpeg: "image/jpeg", gif: "image/gif",
  svg: "image/svg+xml", webp: "image/webp", bmp: "image/bmp", ico: "image/x-icon"
};

/** Repo images need auth, so <img src> can't load them directly; fetch and hand back a blob URL. */
export async function getImageObjectUrl(ctx: PrContext, path: string): Promise<string> {
  const buffer = await git().getItemContent(ctx.repositoryId, path, ctx.project, undefined, undefined, false, false, false, atCommit(ctx.commitId), true);
  const ext = path.split(".").pop()?.toLowerCase() ?? "";
  return URL.createObjectURL(new Blob([buffer], { type: MIME[ext] ?? "application/octet-stream" }));
}

/**
 * The file's threads (positions tracked to the latest iteration) plus the PR's general threads.
 * Threads not on a current line are kept, with their scope, so the panel can list them.
 */
export async function getFileThreads(ctx: PrContext, path: string): Promise<ReviewThread[]> {
  const threads = await git().getThreads(ctx.repositoryId, ctx.pullRequestId, ctx.project, ctx.iterationId);
  return toReviewThreads(threads, path);
}

/** Creates a thread anchored to the source lines/columns, exactly like commenting in the diff view. */
export async function createLineThread(ctx: PrContext, file: MdFile, anchor: SourceAnchor, content: string): Promise<GitPullRequestCommentThread> {
  const thread = buildLineThread(file.path, file.changeTrackingId, ctx.iterationId, anchor, content);
  return git().createThread(thread, ctx.repositoryId, ctx.pullRequestId, ctx.project);
}

export function replyToThread(ctx: PrContext, threadId: number, parentCommentId: number, content: string): Promise<Comment> {
  const comment = { parentCommentId, content, commentType: CommentType.Text } as Comment;
  return git().createComment(comment, ctx.repositoryId, ctx.pullRequestId, threadId, ctx.project);
}

/** Changes the text of a comment; Azure DevOps only allows this for the comment's own author. */
export function updateComment(ctx: PrContext, threadId: number, commentId: number, content: string): Promise<Comment> {
  return git().updateComment({ content } as Comment, ctx.repositoryId, ctx.pullRequestId, threadId, commentId, ctx.project);
}

/** Deletes a comment; Azure DevOps only allows this for the comment's own author. */
export function deleteComment(ctx: PrContext, threadId: number, commentId: number): Promise<void> {
  return git().deleteComment(ctx.repositoryId, ctx.pullRequestId, threadId, commentId, ctx.project);
}

export async function setThreadStatus(ctx: PrContext, threadId: number, status: CommentThreadStatus): Promise<void> {
  await git().updateThread({ status } as GitPullRequestCommentThread, ctx.repositoryId, ctx.pullRequestId, threadId, ctx.project);
}

/**
 * Opens the same file in the PR's native "Files" tab so the reviewer can cross-check a comment.
 * Uses the collection URL from the host, so it works on dev.azure.com, *.visualstudio.com and Azure DevOps Server.
 */
export async function openInFilesTab(ctx: PrContext, path: string): Promise<void> {
  const location = await SDK.getService<ILocationService>(CommonServiceIds.LocationService);
  const base = (await location.getServiceLocation()).replace(/\/$/, "");
  const repoName = encodeURIComponent(ctx.pullRequest.repository.name);
  const projectName = encodeURIComponent(ctx.pullRequest.repository.project.name);
  const url = `${base}/${projectName}/_git/${repoName}/pullrequest/${ctx.pullRequestId}?_a=files&path=${encodeURIComponent(path)}`;
  const nav = await SDK.getService<IHostNavigationService>(CommonServiceIds.HostNavigationService);
  nav.navigate(url);
}
