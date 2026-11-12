/**
 * In-memory stand-in for src/services/adoClient.ts, used only by the local harness (npm run harness).
 * Same exports and shapes, so the real UI runs unchanged; thread payloads are built by the real
 * buildLineThread() and recorded on window.__mdrCreated for inspection.
 */
import { CommentThreadStatus, GitPullRequestCommentThread } from "azure-devops-extension-api/Git/Git";
import { SourceAnchor } from "../src/markdown/sourceMap";
import { buildLineThread } from "../src/services/threadPayload";
import type { MdFile, PrContext, ReviewThread } from "../src/services/adoClient";

export type { MdFile, PrContext, ReviewThread };

const FILES: Record<string, string> = {
  "/docs/architecture.md": [
    "# Arquitectura de PROYECTO",
    "",
    "Este documento describe la **arquitectura multi-tenant** del backend",
    "y las decisiones tomadas para el despliegue en Azure KS.",
    "",
    "## Componentes",
    "",
    "- API en ASP.NET Core 10 con EF Core",
    "- PostgreSQL con un esquema por tenant",
    "- Redis para caché de sesiones",
    "- Keycloak como proveedor de identidad",
    "",
    "| Servicio | Puerto | Responsable |",
    "|----------|--------|-------------|",
    "| api      | 5000   | Backend     |",
    "| keycloak | 8080   | Infra       |",
    "",
    "```csharp",
    "builder.Services.AddDbContext<AppDb>(o =>",
    "    o.UseNpgsql(cs));",
    "```",
    "",
    "> Nota: el esquema por tenant se revisa en Q1.",
    "",
    "![Diagrama](./img/diagram.svg)",
    "",
    "Ver también [la guía de despliegue](./deploy.md) y [EF Core](https://learn.microsoft.com/ef/core/)."
  ].join("\n"),
  "/docs/deploy.md": ["# Despliegue", "", "1. Construir imágenes Docker", "2. Publicar en Linode", "3. Ejecutar migraciones"].join("\n"),
  "/README.md": ["# Proyecto", "", "Resumen corto del repo."].join("\n")
};

/** Merge-base ("left side") versions for modified files, so the harness shows added-line highlights. */
const BASE_FILES: Record<string, string> = {
  // architecture.md without the Redis/Keycloak bullets and the code block -> those render green.
  // Includes a deprecated bullet and a draft note that were removed -> those render red.
  "/docs/architecture.md": [
    "# Arquitectura de PROYECTO",
    "",
    "> Borrador: pendiente de revisión por Infra.",
    "",
    "Este documento describe la **arquitectura multi-tenant** del backend",
    "y las decisiones tomadas para el despliegue en Azure KS.",
    "",
    "## Requisitos previos",
    "",
    "- Cuenta de Azure con permisos de owner",
    "- CLI de Azure 2.60+ instalada",
    "- Acceso al registro de contenedores",
    "",
    "## Componentes",
    "",
    "- API en ASP.NET Core 10 con EF Core",
    "- PostgreSQL con un esquema por tenant",
    "- MongoDB para logs (deprecado)",
    "",
    "| Servicio | Puerto | Responsable |",
    "|----------|--------|-------------|",
    "| api      | 5000   | Backend     |",
    "| keycloak | 8080   | Infra       |",
    "",
    "> Nota: el esquema por tenant se revisa en Q1.",
    "",
    "![Diagrama](./img/diagram.svg)",
    "",
    "Ver también [la guía de despliegue](./deploy.md) y [EF Core](https://learn.microsoft.com/ef/core/)."
  ].join("\n"),
  "/README.md": ["# Proyecto", "", "Resumen corto del repo."].join("\n") // unchanged -> no highlight
};

const me = { displayName: "Fredy", id: "u1" };
let nextId = 100;
type MockThread = Omit<ReviewThread, "scope"> & { scope?: ReviewThread["scope"] };

// Ranplan change (2026): a whole-PR thread, shown under "Not on a line" on every file.
const prThreads: MockThread[] = [
  {
    id: 90, status: CommentThreadStatus.Active, scope: "pr", startLine: 0, endLine: 0,
    comments: [{ id: 90, content: "General comment on the whole pull request.", author: { displayName: "Samuel" }, publishedDate: new Date("2026-10-08T12:00:00") } as any]
  }
];

const threadsByFile: Record<string, MockThread[]> = {
  "/docs/architecture.md": [
    {
      id: 1, status: CommentThreadStatus.Active, startLine: 9, endLine: 9,
      comments: [{ id: 1, content: "¿Esquema por tenant o columna `TenantId`? Afecta las migraciones.", author: { displayName: "Samuel" }, publishedDate: new Date("2026-10-07T15:20:00") } as any]
    },
    {
      id: 2, status: CommentThreadStatus.Fixed, startLine: 1, endLine: 1,
      comments: [{ id: 2, content: "Título corregido 👍", author: { displayName: "Samuel" }, publishedDate: new Date("2026-10-06T10:00:00") } as any]
    },
    // Thread activo con cadena de respuestas (varios autores) sobre el ítem de Redis (línea 10).
    {
      id: 3, status: CommentThreadStatus.Active, startLine: 10, endLine: 10,
      comments: [
        { id: 10, content: "¿Redis solo para sesiones o también para caché de datos? Conviene aclararlo.", author: { displayName: "Lucía" }, publishedDate: new Date("2026-10-07T16:05:00") } as any,
        { id: 11, content: "Por ahora solo sesiones. La caché de datos queda para Q2.", author: me, publishedDate: new Date("2026-10-07T16:40:00") } as any,
        { id: 12, content: "Perfecto, lo dejo anotado.", author: { displayName: "Lucía" }, publishedDate: new Date("2026-10-07T16:42:00") } as any
      ]
    },
    // Comentario sobre las filas de la tabla (líneas 14-15): rango multi-línea.
    {
      id: 4, status: CommentThreadStatus.Active, startLine: 14, endLine: 15,
      comments: [{ id: 13, content: "Falta la fila de Redis (puerto 6379) en la tabla de servicios.", author: { displayName: "Victor" }, publishedDate: new Date("2026-10-08T09:15:00") } as any]
    },
    // Sugerencia ya resuelta sobre el bloque de código C# (líneas 18-20).
    {
      id: 5, status: CommentThreadStatus.Fixed, startLine: 18, endLine: 20,
      comments: [
        { id: 14, content: "El `cs` debería venir de configuración, no hardcodeado.", author: { displayName: "Samuel" }, publishedDate: new Date("2026-10-06T11:30:00") } as any,
        { id: 15, content: "Corregido, ahora sale de `builder.Configuration.GetConnectionString`.", author: me, publishedDate: new Date("2026-10-06T12:10:00") } as any
      ]
    }
  ],
  "/docs/deploy.md": [
    // Comentario activo sobre el paso de publicación (línea 4).
    {
      id: 6, status: CommentThreadStatus.Active, startLine: 4, endLine: 4,
      comments: [{ id: 16, content: "¿Seguimos en Linode o migramos a Azure Container Apps como el resto?", author: { displayName: "Victor" }, publishedDate: new Date("2026-10-08T10:00:00") } as any]
    },
    // Thread sobre las migraciones (línea 5) con una respuesta.
    {
      id: 7, status: CommentThreadStatus.Active, startLine: 5, endLine: 5,
      comments: [
        { id: 17, content: "Conviene aclarar si las migraciones corren automáticas o manuales en prod.", author: { displayName: "Lucía" }, publishedDate: new Date("2026-10-08T10:20:00") } as any,
        { id: 18, content: "Manuales en prod, automáticas en dev. Lo agrego al doc.", author: me, publishedDate: new Date("2026-10-08T10:35:00") } as any
      ]
    }
  ],
  "/README.md": [
    // Comentario sobre el resumen del repo (línea 3).
    {
      id: 8, status: CommentThreadStatus.Active, startLine: 3, endLine: 3,
      comments: [{ id: 19, content: "El resumen es muy simple; sumar un par de líneas sobre el objetivo del proyecto.", author: { displayName: "Samuel" }, publishedDate: new Date("2026-10-08T11:00:00") } as any]
    }
  ]
};

declare global {
  interface Window { __mdrCreated: GitPullRequestCommentThread[] }
}
window.__mdrCreated = [];

const delay = <T>(v: T, ms = 120) => new Promise<T>((r) => setTimeout(() => r(v), ms));

export async function resolvePrContext(): Promise<PrContext> {
  return delay({
    project: "p1", repositoryId: "r1", pullRequestId: 42, iterationId: 3, commitId: "abc123", baseCommitId: "base000", userId: "u1",
    pullRequest: { repository: { name: "odentys-api", project: { name: "ODENTYS" } } } as any
  });
}

export async function listMarkdownFiles(): Promise<MdFile[]> {
  return delay([
    { path: "/docs/architecture.md", changeTrackingId: 7, isNew: false },
    { path: "/docs/deploy.md", changeTrackingId: 8, isNew: true },
    { path: "/README.md", changeTrackingId: 9, isNew: false }
  ].sort((a, b) => a.path.localeCompare(b.path)));
}

export async function getFileText(_ctx: PrContext, path: string): Promise<string> {
  return delay(FILES[path] ?? "");
}

export async function getFileBaseText(_ctx: PrContext, path: string): Promise<string> {
  return delay(BASE_FILES[path] ?? "");
}

export async function getImageObjectUrl(): Promise<string> {
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="420" height="110"><rect width="420" height="110" rx="8" fill="#e8f1fb"/><g font-family="sans-serif" font-size="14" text-anchor="middle"><rect x="20" y="35" width="100" height="40" rx="4" fill="#0078d4"/><text x="70" y="60" fill="#fff">Nginx</text><rect x="160" y="35" width="100" height="40" rx="4" fill="#0078d4"/><text x="210" y="60" fill="#fff">API</text><rect x="300" y="35" width="100" height="40" rx="4" fill="#0078d4"/><text x="350" y="60" fill="#fff">Postgres</text></g><path d="M120 55h40M260 55h40" stroke="#333" stroke-width="2"/></svg>`;
  return delay(URL.createObjectURL(new Blob([svg], { type: "image/svg+xml" })));
}

export async function getFileThreads(_ctx: PrContext, path: string): Promise<ReviewThread[]> {
  return delay(
    [...(threadsByFile[path] ?? []), ...prThreads]
      .map((t) => ({ ...t, scope: t.scope ?? "line", comments: t.comments.filter((c) => !c.isDeleted) }))
      .filter((t) => t.comments.length > 0)
  );
}

const allThreads = () => [...Object.values(threadsByFile).flat(), ...prThreads];

export async function updateComment(_ctx: PrContext, threadId: number, commentId: number, content: string) {
  const c = allThreads().find((x) => x.id === threadId)?.comments.find((x) => x.id === commentId);
  if (c) c.content = content;
  return delay({} as any);
}

export async function deleteComment(_ctx: PrContext, threadId: number, commentId: number) {
  const c = allThreads().find((x) => x.id === threadId)?.comments.find((x) => x.id === commentId);
  if (c) c.isDeleted = true;
  await delay(null);
}

export async function createLineThread(ctx: PrContext, file: MdFile, anchor: SourceAnchor, content: string) {
  const payload = buildLineThread(file.path, file.changeTrackingId, ctx.iterationId, anchor, content);
  window.__mdrCreated.push(payload);
  const list = (threadsByFile[file.path] ??= []);
  list.push({
    id: nextId++, status: CommentThreadStatus.Active, startLine: anchor.startLine, endLine: anchor.endLine,
    comments: [{ id: nextId++, content, author: me, publishedDate: new Date() } as any]
  });
  return delay(payload);
}

export async function replyToThread(_ctx: PrContext, threadId: number, _parent: number, content: string) {
  for (const list of Object.values(threadsByFile)) {
    const t = list.find((x) => x.id === threadId);
    if (t) t.comments.push({ id: nextId++, content, author: me, publishedDate: new Date() } as any);
  }
  return delay({} as any);
}

export async function setThreadStatus(_ctx: PrContext, threadId: number, status: CommentThreadStatus) {
  for (const list of Object.values(threadsByFile)) {
    const t = list.find((x) => x.id === threadId);
    if (t) t.status = status;
  }
  await delay(null);
}

export async function openInFilesTab() {
  alert("(harness) Navegaría a la pestaña Files del PR");
}
