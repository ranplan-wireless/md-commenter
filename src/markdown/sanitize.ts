// Ranplan change (2026): new file. A second safety layer on every piece of HTML the tab shows
// (the document and each comment), on top of markdown-it's html:false and link checks.
import DOMPurify, { type Config } from "dompurify";

/** Keep the data-* attributes the preview relies on (source lines, repo images, relative links) and link targets. */
export const PURIFY_CONFIG: Config = { ADD_ATTR: ["target"], ALLOW_DATA_ATTR: true };

type Purifier = { sanitize(html: string, config: Config): unknown };

/** Sanitises rendered Markdown HTML. Tests pass their own purifier bound to a jsdom window. */
export function sanitizeHtml(html: string, purifier: Purifier = DOMPurify): string {
  return String(purifier.sanitize(html, PURIFY_CONFIG));
}
