import { useCallback, useState } from "react";
import { CommentThreadStatus } from "azure-devops-extension-api/Git/Git";
// Ranplan change (2026): editComment / removeComment for the signed-in user's own comments.
import { createLineThread, deleteComment, MdFile, PrContext, replyToThread, setThreadStatus, updateComment } from "../services/adoClient";
import { SourceAnchor } from "../markdown/sourceMap";
import { t } from "../i18n";
import { errorText } from "../util";

/**
 * Thread mutations (create/reply/status). Each reloads the file's threads on success and
 * reports failures through `flash`. `submit` returns whether it succeeded so callers can
 * clear their draft.
 */
export function useThreadActions(
  ctx: PrContext | undefined,
  reload: () => Promise<void>,
  flash: (msg: string) => void
) {
  const [posting, setPosting] = useState(false);

  const submit = useCallback(
    async (file: MdFile, anchor: SourceAnchor, content: string): Promise<boolean> => {
      if (!ctx) return false;
      setPosting(true);
      try {
        await createLineThread(ctx, file, anchor, content);
        await reload();
        flash(t("commentPosted", { line: anchor.startLine }));
        return true;
      } catch (e) {
        flash(t("postFailed", { message: errorText(e) }));
        return false;
      } finally {
        setPosting(false);
      }
    },
    [ctx, reload, flash]
  );

  const reply = useCallback(
    async (threadId: number, parentCommentId: number, content: string) => {
      if (!ctx) return;
      try {
        await replyToThread(ctx, threadId, parentCommentId, content);
        await reload();
      } catch (e) {
        flash(t("replyFailed", { message: errorText(e) }));
      }
    },
    [ctx, reload, flash]
  );

  const changeStatus = useCallback(
    async (threadId: number, status: CommentThreadStatus) => {
      if (!ctx) return;
      try {
        await setThreadStatus(ctx, threadId, status);
        await reload();
      } catch (e) {
        flash(t("statusFailed", { message: errorText(e) }));
      }
    },
    [ctx, reload, flash]
  );

  /** Saves new text for a comment; returns whether it worked so the editor can close. */
  const editComment = useCallback(
    async (threadId: number, commentId: number, content: string): Promise<boolean> => {
      if (!ctx) return false;
      try {
        await updateComment(ctx, threadId, commentId, content);
        await reload();
        return true;
      } catch (e) {
        flash(t("editFailed", { message: errorText(e) }));
        return false;
      }
    },
    [ctx, reload, flash]
  );

  const removeComment = useCallback(
    async (threadId: number, commentId: number) => {
      if (!ctx) return;
      try {
        await deleteComment(ctx, threadId, commentId);
        await reload();
      } catch (e) {
        flash(t("deleteFailed", { message: errorText(e) }));
      }
    },
    [ctx, reload, flash]
  );

  return { posting, submit, reply, changeStatus, editComment, removeComment };
}
