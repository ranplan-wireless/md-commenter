// Ranplan changes (2026): a "Not on a line" section lists whole-PR, whole-file and removed-line
// threads; edit/delete handlers and the user id are passed to each thread.
import React, { Ref } from "react";
import { CommentThreadStatus } from "azure-devops-extension-api/Git/Git";
import { ReviewThread } from "../services/adoClient";
import { PickState } from "../types";
import { Excerpt } from "./Excerpt";
import { ThreadView } from "./ThreadView";
import { t } from "../i18n";

interface Props {
  pick: PickState | null;
  lines: string[];
  pickThreads: ReviewThread[];
  visibleThreads: ReviewThread[];
  /** Threads not on a current line (already filtered by "Show resolved"). */
  looseThreads: ReviewThread[];
  showResolved: boolean;
  userId?: string;
  draft: string;
  posting: boolean;
  draftRef: Ref<HTMLTextAreaElement>;
  onClosePick(): void;
  onDraftChange(value: string): void;
  onSubmit(): void;
  onReply(threadId: number, parentCommentId: number, text: string): Promise<void>;
  onStatus(threadId: number, status: CommentThreadStatus): Promise<void>;
  onEdit(threadId: number, commentId: number, text: string): Promise<boolean>;
  onDelete(threadId: number, commentId: number): Promise<void>;
  onFocus(thread: ReviewThread): void;
}

/** Right panel: either the picked block (excerpt + its threads + a new-comment draft) or the file's full thread list. */
export function CommentPanel({
  pick, lines, pickThreads, visibleThreads, looseThreads, showResolved, userId,
  draft, posting, draftRef, onClosePick, onDraftChange, onSubmit, onReply, onStatus, onEdit, onDelete, onFocus
}: Props) {
  const threadView = (thread: ReviewThread) => (
    <ThreadView
      key={thread.id}
      thread={thread}
      userId={userId}
      onReply={onReply}
      onStatus={onStatus}
      onEdit={onEdit}
      onDelete={onDelete}
      onFocus={onFocus}
    />
  );

  return (
    <aside className="mdr-panel">
      {pick ? (
        <>
          <div className="mdr-panel-head">
            <div className="mdr-section-title">
              {pick.anchor.startLine === pick.anchor.endLine
                ? t("line", { line: pick.anchor.startLine })
                : t("lines", { start: pick.anchor.startLine, end: pick.anchor.endLine })}
            </div>
            <button className="mdr-icon-btn" onClick={onClosePick} title={t("close")}>×</button>
          </div>
          <Excerpt lines={lines} anchor={pick.anchor} />
          {pickThreads.map(threadView)}
          <div className="mdr-new">
            <textarea
              ref={draftRef}
              value={draft}
              placeholder={t("draftPlaceholder")}
              onChange={(e) => onDraftChange(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && (e.ctrlKey || e.metaKey)) onSubmit();
              }}
            />
            <div className="mdr-actions">
              <button className="mdr-btn primary" onClick={onSubmit} disabled={posting || !draft.trim()}>
                {posting ? t("posting") : t("comment")}
              </button>
            </div>
          </div>
        </>
      ) : (
        <>
          <div className="mdr-section-title">{t("fileComments", { count: visibleThreads.length })}</div>
          {visibleThreads.length === 0 && <div className="mdr-muted">{t("noComments", { scope: showResolved ? "" : t("scopeActive") })}</div>}
          {visibleThreads.map(threadView)}
          {looseThreads.length > 0 && (
            <>
              <div className="mdr-section-title mdr-section-gap">{t("notOnLine", { count: looseThreads.length })}</div>
              {looseThreads.map(threadView)}
            </>
          )}
        </>
      )}
    </aside>
  );
}
