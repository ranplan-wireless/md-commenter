// Ranplan changes (2026): comment HTML goes through sanitizeHtml; the author can edit or delete
// their own comments; threads not on a current line show where they sit instead of a line link.
import React, { useState } from "react";
import { CommentThreadStatus } from "azure-devops-extension-api/Git/Git";
import { ReviewThread } from "../services/adoClient";
import { md } from "../markdown/renderer";
import { sanitizeHtml } from "../markdown/sanitize";
import { I18nKey, t } from "../i18n";

const STATUS_KEY: Record<number, I18nKey> = {
  [CommentThreadStatus.Unknown]: "statusUnknown",
  [CommentThreadStatus.Active]: "statusActive",
  [CommentThreadStatus.Fixed]: "statusFixed",
  [CommentThreadStatus.WontFix]: "statusWontFix",
  [CommentThreadStatus.Closed]: "statusClosed",
  [CommentThreadStatus.ByDesign]: "statusByDesign",
  [CommentThreadStatus.Pending]: "statusPending"
};

/** Localized label for a thread status, with a dash fallback for unmapped values. */
export const statusLabel = (status: CommentThreadStatus): string =>
  STATUS_KEY[status] ? t(STATUS_KEY[status]) : t("statusFallback");

export const isOpen = (s: CommentThreadStatus) => s === CommentThreadStatus.Active || s === CommentThreadStatus.Pending;

const lineLabel = (th: ReviewThread) => (th.startLine === th.endLine ? `L${th.startLine}` : `L${th.startLine}–${th.endLine}`);

/** Where a thread sits, for threads that are not on a current line. */
function scopeLabel(th: ReviewThread): string {
  if (th.scope === "pr") return t("scopePr");
  if (th.scope === "removed") return t("scopeRemoved", { lines: lineLabel(th) });
  return t("scopeFile");
}

interface Props {
  thread: ReviewThread;
  /** Signed-in user's identity id; their own comments get Edit and Delete. */
  userId?: string;
  onReply(threadId: number, parentCommentId: number, text: string): Promise<void>;
  onStatus(threadId: number, status: CommentThreadStatus): Promise<void>;
  onEdit(threadId: number, commentId: number, text: string): Promise<boolean>;
  onDelete(threadId: number, commentId: number): Promise<void>;
  onFocus?(thread: ReviewThread): void;
}

export function ThreadView({ thread, userId, onReply, onStatus, onEdit, onDelete, onFocus }: Props) {
  const [replying, setReplying] = useState(false);
  const [text, setText] = useState("");
  const [busy, setBusy] = useState(false);
  const [editingId, setEditingId] = useState<number>();
  const [editText, setEditText] = useState("");
  const [confirmingId, setConfirmingId] = useState<number>();
  const open = isOpen(thread.status);

  const run = async (fn: () => Promise<void>) => {
    setBusy(true);
    try {
      await fn();
    } finally {
      setBusy(false);
    }
  };

  const sendReply = () =>
    run(async () => {
      if (!text.trim()) return;
      await onReply(thread.id, thread.comments[thread.comments.length - 1].id, text.trim());
      setText("");
      setReplying(false);
    });

  const startEdit = (id: number, content: string) => {
    setConfirmingId(undefined);
    setEditingId(id);
    setEditText(content);
  };

  const saveEdit = () =>
    run(async () => {
      if (editingId === undefined || !editText.trim()) return;
      if (await onEdit(thread.id, editingId, editText.trim())) setEditingId(undefined);
    });

  const confirmDelete = (id: number) =>
    run(async () => {
      await onDelete(thread.id, id);
      setConfirmingId(undefined);
    });

  return (
    <div className={`mdr-thread ${open ? "is-open" : "is-closed"}`}>
      <div className="mdr-thread-head">
        {thread.scope === "line" ? (
          <button className="mdr-link" onClick={() => onFocus?.(thread)} title={t("goToBlock")}>
            {lineLabel(thread)}
          </button>
        ) : (
          <span className="mdr-scope">{scopeLabel(thread)}</span>
        )}
        <span className={`mdr-pill ${open ? "pill-open" : "pill-closed"}`}>{statusLabel(thread.status)}</span>
      </div>

      {thread.comments.map((c) => {
        const mine = Boolean(userId) && c.author?.id === userId;
        return (
          <div key={c.id} className="mdr-comment">
            <div className="mdr-comment-meta">
              <strong>{c.author?.displayName}</strong>
              <span>{c.publishedDate ? new Date(c.publishedDate).toLocaleString() : ""}</span>
            </div>
            {editingId === c.id ? (
              <div className="mdr-reply">
                <textarea
                  autoFocus
                  value={editText}
                  onChange={(e) => setEditText(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" && (e.ctrlKey || e.metaKey)) saveEdit();
                    if (e.key === "Escape") setEditingId(undefined);
                  }}
                />
                <div className="mdr-actions">
                  <button className="mdr-btn" onClick={() => setEditingId(undefined)} disabled={busy}>{t("cancel")}</button>
                  <button className="mdr-btn primary" onClick={saveEdit} disabled={busy || !editText.trim()}>{t("save")}</button>
                </div>
              </div>
            ) : (
              <div
                className="mdr-comment-body markdown-body"
                dangerouslySetInnerHTML={{ __html: sanitizeHtml(md.render(c.content ?? "")) }}
              />
            )}
            {mine && editingId !== c.id && (
              confirmingId === c.id ? (
                <div className="mdr-comment-tools">
                  <span>{t("confirmDelete")}</span>
                  <button className="mdr-link danger" onClick={() => confirmDelete(c.id)} disabled={busy}>{t("delete")}</button>
                  <button className="mdr-link" onClick={() => setConfirmingId(undefined)} disabled={busy}>{t("cancel")}</button>
                </div>
              ) : (
                <div className="mdr-comment-tools">
                  <button className="mdr-link" onClick={() => startEdit(c.id, c.content ?? "")} disabled={busy}>{t("edit")}</button>
                  <button className="mdr-link" onClick={() => { setEditingId(undefined); setConfirmingId(c.id); }} disabled={busy}>{t("delete")}</button>
                </div>
              )
            )}
          </div>
        );
      })}

      {replying ? (
        <div className="mdr-reply">
          <textarea
            autoFocus
            value={text}
            placeholder={t("replyPlaceholder")}
            onChange={(e) => setText(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && (e.ctrlKey || e.metaKey)) sendReply();
              if (e.key === "Escape") setReplying(false);
            }}
          />
          <div className="mdr-actions">
            <button className="mdr-btn" onClick={() => setReplying(false)} disabled={busy}>{t("cancel")}</button>
            <button className="mdr-btn primary" onClick={sendReply} disabled={busy || !text.trim()}>{t("reply")}</button>
          </div>
        </div>
      ) : (
        <div className="mdr-actions">
          <button className="mdr-btn" onClick={() => setReplying(true)} disabled={busy}>{t("reply")}</button>
          {open ? (
            <button className="mdr-btn" onClick={() => run(() => onStatus(thread.id, CommentThreadStatus.Fixed))} disabled={busy}>{t("resolve")}</button>
          ) : (
            <button className="mdr-btn" onClick={() => run(() => onStatus(thread.id, CommentThreadStatus.Active))} disabled={busy}>{t("reactivate")}</button>
          )}
        </div>
      )}
    </div>
  );
}
