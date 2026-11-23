import React, { useEffect, useRef } from "react";
import { END_ATTR, START_ATTR } from "../markdown/sourceMap";
import { RemovedSegment } from "../markdown/diff";
import { ReviewThread } from "../services/adoClient";

export interface BlockPick {
  startLine: number;
  endLine: number;
  selectedText: string;
}

interface Props {
  html: string;
  threads: ReviewThread[];
  /** Right-side source lines added in this PR; their rendered blocks get a green background. */
  addedLines: Set<number>;
  /** Deleted base-line runs to show inline (red, struck-through, inert) where they used to be. */
  removedLines: RemovedSegment[];
  selected: { startLine: number; endLine: number } | null;
  /** Bumped by a jump from the comment list: centre the selected block and flash it. */
  reveal?: number;
  onPick(pick: BlockPick): void;
  onRelativeLink(href: string): void;
  resolveImage(src: string): Promise<string>;
}

const BLOCK_SELECTOR = `[${START_ATTR}]`;

function lineRange(el: Element): [number, number] {
  return [Number(el.getAttribute(START_ATTR)), Number(el.getAttribute(END_ATTR))];
}

function closestBlock(node: Node | null, root: HTMLElement): HTMLElement | null {
  const el = node instanceof Element ? node : node?.parentElement ?? null;
  const block = el?.closest<HTMLElement>(BLOCK_SELECTOR) ?? null;
  return block && root.contains(block) ? block : null;
}

/** Smallest (most specific) rendered block that contains a source line. */
function blockForLine(root: HTMLElement, line: number): HTMLElement | null {
  let best: HTMLElement | null = null;
  let bestSpan = Infinity;
  root.querySelectorAll<HTMLElement>(BLOCK_SELECTOR).forEach((el) => {
    const [s, e] = lineRange(el);
    if (line < s || line > e) return;
    const span = e - s;
    if (span <= bestSpan) {
      best = el; // later = deeper in document order on ties
      bestSpan = span;
    }
  });
  return best;
}

/** Ranplan change (2026, 0.2.1): briefly highlights an element; restarts if it is already flashing. */
export function flash(el: HTMLElement) {
  el.classList.remove("mdr-flash");
  void el.offsetWidth; // restart the animation
  el.classList.add("mdr-flash");
  window.setTimeout(() => el.classList.remove("mdr-flash"), 1600);
}

/** Highest block ancestor that is still a direct child of the preview root (keeps injected rows top-level). */
function topLevelBlockForLine(root: HTMLElement, line: number): HTMLElement | null {
  let el = blockForLine(root, line);
  while (el && el.parentElement && el.parentElement !== root) {
    const parent = el.parentElement.closest<HTMLElement>(BLOCK_SELECTOR);
    if (!parent || !root.contains(parent)) break;
    el = parent;
  }
  return el;
}

export function MarkdownPreview({ html, threads, addedLines, removedLines, selected, reveal, onPick, onRelativeLink, resolveImage }: Props) {
  const rootRef = useRef<HTMLDivElement>(null);
  const hoverRef = useRef<HTMLElement | null>(null);

  // Load repo images through the authenticated API.
  useEffect(() => {
    const root = rootRef.current;
    if (!root) return;
    let cancelled = false;
    root.querySelectorAll<HTMLImageElement>("img[data-repo-src]").forEach((img) => {
      const src = img.getAttribute("data-repo-src")!;
      img.classList.add("mdr-img-loading");
      resolveImage(src)
        .then((url) => {
          if (!cancelled) img.src = url;
        })
        .catch(() => {
          if (!cancelled) img.classList.add("mdr-img-error");
        })
        .finally(() => img.classList.remove("mdr-img-loading"));
    });
    return () => {
      cancelled = true;
    };
  }, [html, resolveImage]);

  // Mark blocks that already have comment threads.
  useEffect(() => {
    const root = rootRef.current;
    if (!root) return;
    root.querySelectorAll(".mdr-has-thread, .mdr-row-badge").forEach((el) => {
      el.classList.remove("mdr-has-thread", "mdr-has-active", "mdr-row-badge");
      el.removeAttribute("data-thread-count");
    });
    const counts = new Map<HTMLElement, { n: number; active: boolean }>();
    for (const t of threads) {
      const el = blockForLine(root, t.startLine);
      if (!el) continue;
      const entry = counts.get(el) ?? { n: 0, active: false };
      entry.n += 1;
      entry.active ||= t.status === 1 || t.status === 6; // Active / Pending
      counts.set(el, entry);
    }
    counts.forEach(({ n, active }, el) => {
      el.classList.add("mdr-has-thread");
      if (active) el.classList.add("mdr-has-active");
      el.setAttribute("data-thread-count", String(n));
      // Table rows can't host a positioned pseudo-element; badge the last cell instead.
      if (el.tagName === "TR" && el.lastElementChild) {
        el.lastElementChild.classList.add("mdr-row-badge");
        el.lastElementChild.setAttribute("data-thread-count", String(n));
      }
    });
  }, [html, threads]);

  // Tint the smallest block over each added source line (diff-style green).
  useEffect(() => {
    const root = rootRef.current;
    if (!root) return;
    root.querySelectorAll(".mdr-added").forEach((el) => el.classList.remove("mdr-added"));
    addedLines.forEach((line) => blockForLine(root, line)?.classList.add("mdr-added"));
  }, [html, addedLines]);

  // Inject deleted base-line runs as inert red blocks where they used to sit.
  // No source-map attrs, so hover/click/selection logic skips them entirely.
  useEffect(() => {
    const root = rootRef.current;
    if (!root) return;
    root.querySelectorAll(".mdr-removed").forEach((el) => el.remove());
    for (const seg of removedLines) {
      const text = seg.lines.join("\n");
      if (!text.trim()) continue; // skip splitLines' trailing-newline artifact and blank-only runs
      const block = document.createElement("pre");
      block.className = "mdr-removed";
      block.setAttribute("aria-label", "Deleted");
      block.textContent = text; // raw source — never parsed as markdown/HTML
      const anchor = seg.afterRightLine > 0 ? topLevelBlockForLine(root, seg.afterRightLine) : null;
      if (anchor) anchor.after(block);
      else root.insertBefore(block, root.firstChild); // top of file
    }
  }, [html, removedLines]);

  // Highlight the selected range and bring it into view.
  useEffect(() => {
    const root = rootRef.current;
    if (!root) return;
    root.querySelectorAll(".mdr-selected").forEach((el) => el.classList.remove("mdr-selected"));
    if (!selected) return;
    let first: HTMLElement | null = null;
    root.querySelectorAll<HTMLElement>(BLOCK_SELECTOR).forEach((el) => {
      const [s, e] = lineRange(el);
      const inside = s >= selected.startLine && e <= selected.endLine;
      const parentInside = el.parentElement?.closest(BLOCK_SELECTOR) &&
        lineRange(el.parentElement.closest(BLOCK_SELECTOR)!)[0] >= selected.startLine &&
        lineRange(el.parentElement.closest(BLOCK_SELECTOR)!)[1] <= selected.endLine;
      if (inside && !parentInside) {
        el.classList.add("mdr-selected");
        first ??= el;
      }
    });
    if (!first) {
      first = blockForLine(root, selected.startLine);
      first?.classList.add("mdr-selected");
    }
    (first as HTMLElement | null)?.scrollIntoView({ block: "nearest", behavior: "smooth" });
  }, [html, selected]);

  // Ranplan change (2026, 0.2.1): a jump from the comment list puts the block in the middle of the
  // view and flashes it, so it is easy to spot. Runs after the effect above, so it wins.
  useEffect(() => {
    const root = rootRef.current;
    if (!root || !reveal) return;
    const first = root.querySelector<HTMLElement>(".mdr-selected");
    if (!first) return;
    first.scrollIntoView({ block: "center", behavior: "smooth" });
    root.querySelectorAll(".mdr-selected").forEach((el) => flash(el as HTMLElement));
  }, [reveal]);

  const onMouseOver = (e: React.MouseEvent) => {
    const block = closestBlock(e.target as Node, rootRef.current!);
    if (block === hoverRef.current) return;
    hoverRef.current?.classList.remove("mdr-hover");
    block?.classList.add("mdr-hover");
    hoverRef.current = block;
  };

  const onMouseLeave = () => {
    hoverRef.current?.classList.remove("mdr-hover");
    hoverRef.current = null;
  };

  const onClick = (e: React.MouseEvent) => {
    const root = rootRef.current!;
    const anchor = (e.target as Element).closest?.("a");
    if (anchor) {
      if (anchor.getAttribute("data-relative-link")) {
        e.preventDefault();
        onRelativeLink(anchor.getAttribute("href") ?? "");
      }
      return; // external links keep their default (new tab) behaviour
    }

    const sel = window.getSelection();
    if (sel && !sel.isCollapsed && sel.rangeCount > 0) {
      const range = sel.getRangeAt(0);
      const a = closestBlock(range.startContainer, root);
      const b = closestBlock(range.endContainer, root);
      if (a && b) {
        const [as, ae] = lineRange(a);
        const [bs, be] = lineRange(b);
        onPick({ startLine: Math.min(as, bs), endLine: Math.max(ae, be), selectedText: sel.toString() });
        return;
      }
    }

    const block = closestBlock(e.target as Node, root);
    if (!block) return;
    const [s, end] = lineRange(block);
    onPick({ startLine: s, endLine: end, selectedText: "" });
  };

  return (
    <div
      ref={rootRef}
      className="mdr-preview markdown-body"
      onClick={onClick}
      onMouseOver={onMouseOver}
      onMouseLeave={onMouseLeave}
      dangerouslySetInnerHTML={{ __html: html }}
    />
  );
}
