// Ranplan changes (2026): progress/error strings moved here from adoClient.ts; keys added for
// refresh, comments not on a line, and edit/delete.
// Minimal runtime i18n for the MD Commenter tab (English + Spanish).
// The language is picked once from the host/browser; strings are looked up by key
// and support {name} placeholders filled from the params object.

export type Lang = "en" | "es";

type Params = Record<string, string | number>;

const en = {
  // App — loading / errors
  stageConnecting: "Connecting to Azure DevOps",
  stageListingFiles: "Listing the Markdown files of PR #{id}",
  stageReadingConfig: "Reading the tab configuration",
  stagePrIdFromUrl: "Reading the PR number from the page address",
  stageRepository: "Finding the current repository",
  stageProject: "Finding the current project",
  stageLoadingPr: "Loading PR #{id}",
  stageLoadingIterations: "Loading the updates of PR #{id}",
  prNotIdentified: "Could not identify the current pull request (PR, repository or project).",
  watchdog:
    'No response after 20 s at step: "{step}". Check the browser console (MD Commenter tab) and share the error.',
  stepError: 'Error at step "{step}": {message}',
  linkNotInPr: "That link points to a file that is not part of this PR.",
  commentPosted: "Comment published on line {line}.",
  postFailed: "Could not publish: {message}",
  replyFailed: "Could not reply: {message}",
  statusFailed: "Could not update the status: {message}",
  noMarkdownFiles: "This Pull Request does not modify any Markdown files.",
  refreshing: "Refreshing…",
  refreshFailed: "Could not refresh: {message}",
  updatedToLatest: "Now showing the latest update of this pull request.",
  editFailed: "Could not save the change: {message}",
  deleteFailed: "Could not delete: {message}",
  // App — layout
  markdownFiles: "Markdown files",
  tagNew: "new",
  showResolved: "Show resolved",
  refresh: "Refresh",
  viewInFiles: "View in Files",
  collapse: "Collapse",
  expand: "Expand",
  railFiles: "Files",
  railComments: "Comments",
  pickHint: "Click any block, or select a fragment of text, to comment on those lines.",
  loadingFile: "Loading file…",
  line: "Line {line}",
  lines: "Lines {start}–{end}",
  close: "Close (Esc)",
  draftPlaceholder: "Write your comment (Markdown). Ctrl+Enter to publish.",
  posting: "Publishing…",
  comment: "Comment",
  fileComments: "Comments on this file ({count})",
  noComments: "No {scope}comments yet.",
  scopeActive: "active ",
  notOnLine: "Not on a line ({count})",
  scopePr: "Whole pull request",
  scopeFile: "This file, not on a current line",
  scopeRemoved: "Removed {lines}",
  // ThreadView
  goToBlock: "Go to block",
  replyPlaceholder: "Reply…",
  cancel: "Cancel",
  reply: "Reply",
  resolve: "Resolve",
  reactivate: "Reactivate",
  edit: "Edit",
  save: "Save",
  delete: "Delete",
  confirmDelete: "Delete this comment?",
  statusFallback: "—",
  statusUnknown: "Unknown",
  statusActive: "Active",
  statusFixed: "Resolved",
  statusWontFix: "Won't fix",
  statusClosed: "Closed",
  statusByDesign: "By design",
  statusPending: "Pending"
};

const es: typeof en = {
  stageConnecting: "Conectando con Azure DevOps",
  stageListingFiles: "Listando archivos Markdown del PR #{id}",
  stageReadingConfig: "Leyendo la configuración de la pestaña",
  stagePrIdFromUrl: "Obteniendo el ID del PR desde la URL",
  stageRepository: "Obteniendo el repositorio actual",
  stageProject: "Obteniendo el proyecto actual",
  stageLoadingPr: "Cargando el PR #{id}",
  stageLoadingIterations: "Cargando las iteraciones del PR #{id}",
  prNotIdentified: "No se pudo identificar el Pull Request actual (PR, repositorio o proyecto).",
  watchdog:
    'No hubo respuesta después de 20 s en el paso: "{step}". Revisa la consola del navegador (pestaña MD Commenter) y comparte el error.',
  stepError: 'Error en el paso "{step}": {message}',
  linkNotInPr: "Ese enlace apunta a un archivo que no forma parte de este PR.",
  commentPosted: "Comentario publicado en la línea {line}.",
  postFailed: "No se pudo publicar: {message}",
  replyFailed: "No se pudo responder: {message}",
  statusFailed: "No se pudo actualizar el estado: {message}",
  noMarkdownFiles: "Este Pull Request no modifica archivos Markdown.",
  refreshing: "Actualizando…",
  refreshFailed: "No se pudo actualizar: {message}",
  updatedToLatest: "Ahora se muestra la última actualización de este PR.",
  editFailed: "No se pudo guardar el cambio: {message}",
  deleteFailed: "No se pudo eliminar: {message}",
  markdownFiles: "Archivos Markdown",
  tagNew: "nuevo",
  showResolved: "Mostrar resueltos",
  refresh: "Actualizar",
  viewInFiles: "Ver en Files",
  collapse: "Contraer",
  expand: "Expandir",
  railFiles: "Archivos",
  railComments: "Comentarios",
  pickHint: "Haz clic en cualquier bloque, o selecciona un fragmento de texto, para comentar esas líneas.",
  loadingFile: "Cargando archivo…",
  line: "Línea {line}",
  lines: "Líneas {start}–{end}",
  close: "Cerrar (Esc)",
  draftPlaceholder: "Escribe tu comentario (Markdown). Ctrl+Enter para publicar.",
  posting: "Publicando…",
  comment: "Comentar",
  fileComments: "Comentarios en este archivo ({count})",
  noComments: "Sin comentarios {scope}todavía.",
  scopeActive: "activos ",
  notOnLine: "Sin línea ({count})",
  scopePr: "Todo el Pull Request",
  scopeFile: "Este archivo, sin línea actual",
  scopeRemoved: "Eliminado {lines}",
  goToBlock: "Ir al bloque",
  replyPlaceholder: "Responder…",
  cancel: "Cancelar",
  reply: "Responder",
  resolve: "Resolver",
  reactivate: "Reactivar",
  edit: "Editar",
  save: "Guardar",
  delete: "Eliminar",
  confirmDelete: "¿Eliminar este comentario?",
  statusFallback: "—",
  statusUnknown: "Desconocido",
  statusActive: "Activo",
  statusFixed: "Resuelto",
  statusWontFix: "No se corregirá",
  statusClosed: "Cerrado",
  statusByDesign: "Por diseño",
  statusPending: "Pendiente"
};

export type I18nKey = keyof typeof en;

const DICTS: Record<Lang, typeof en> = { en, es };

function detectLang(): Lang {
  const nav = typeof navigator !== "undefined" ? navigator.language : "en";
  return /^es\b/i.test(nav || "") ? "es" : "en";
}

let lang: Lang = detectLang();

/** Override the detected language (e.g. from the Azure DevOps host culture). */
export function setLang(l: Lang): void {
  lang = l;
}

export function getLang(): Lang {
  return lang;
}

/** Translate a key, filling {name} placeholders from params. Falls back to English, then the key. */
export function t(key: I18nKey, params?: Params): string {
  const template = DICTS[lang][key] ?? DICTS.en[key] ?? key;
  return params ? template.replace(/\{(\w+)\}/g, (_, k) => String(params[k] ?? `{${k}}`)) : template;
}
