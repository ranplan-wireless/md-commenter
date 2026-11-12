// Ranplan change (2026): `refresh()` re-reads the PR (latest iteration and its Markdown files),
// so Refresh shows new pushes instead of only re-reading the threads of the first iteration seen.
import { useCallback, useEffect, useRef, useState } from "react";
import { listMarkdownFiles, MdFile, PrContext, resolvePrContext } from "../services/adoClient";
import { t } from "../i18n";
import { errorText } from "../util";

export interface RefreshResult {
  ctx?: PrContext;
  error?: string;
}

interface PrState {
  ctx?: PrContext;
  files: MdFile[];
  /** Human-readable progress line shown until the context resolves. */
  stage: string;
  /** Set when PR resolution fails or the watchdog fires; the app shows this instead of the UI. */
  error?: string;
  /** True while a refresh triggered by the user is running. */
  refreshing: boolean;
  /** Re-reads the PR, its latest iteration and its Markdown files. */
  refresh(): Promise<RefreshResult>;
}

/**
 * Resolves the PR and its Markdown files on mount and on refresh(). Each step is reported into
 * `stage`, and a watchdog turns a silent hang into a visible error naming the step that never finished.
 */
export function usePrContext(): PrState {
  const [ctx, setCtx] = useState<PrContext>();
  const [files, setFiles] = useState<MdFile[]>([]);
  const [stage, setStage] = useState(`${t("stageConnecting")}…`);
  const [error, setError] = useState<string>();
  const [refreshing, setRefreshing] = useState(false);
  const running = useRef<Promise<RefreshResult>>();
  const watchdog = useRef<number>();

  const load = useCallback((): Promise<RefreshResult> => {
    if (running.current) return running.current;
    let current = t("stageConnecting");
    let done = false;
    const report = (s: string) => {
      current = s;
      setStage(`${s}…`);
    };
    window.clearTimeout(watchdog.current);
    watchdog.current = window.setTimeout(() => {
      if (!done) setError(t("watchdog", { step: current }));
    }, 20000);
    const run = (async (): Promise<RefreshResult> => {
      try {
        const c = await resolvePrContext(report);
        report(t("stageListingFiles", { id: c.pullRequestId }));
        const mdFiles = await listMarkdownFiles(c);
        done = true;
        setError(undefined);
        setCtx(c);
        setFiles(mdFiles);
        return { ctx: c };
      } catch (e) {
        done = true;
        console.error("[MD Commenter]", current, e);
        const message = t("stepError", { step: current, message: errorText(e) });
        setError(message);
        return { error: message };
      } finally {
        window.clearTimeout(watchdog.current);
        running.current = undefined;
      }
    })();
    running.current = run;
    return run;
  }, []);

  useEffect(() => {
    void load();
    return () => window.clearTimeout(watchdog.current);
  }, [load]);

  const refresh = useCallback(async () => {
    setRefreshing(true);
    try {
      return await load();
    } finally {
      setRefreshing(false);
    }
  }, [load]);

  return { ctx, files, stage, error, refreshing, refresh };
}
