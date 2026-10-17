import { readFile } from "node:fs/promises";
import { join } from "node:path";

/**
 * MapLibre's worker and its shared module, served from this origin (the page's CSP allows no third-party script): the map
 * of a shop page points at them with `configureMaps({ workerUrl })`. Read from the installed package and rendered once at
 * build (`force-static`), so the running server needs no file of node_modules.
 */
export const dynamic = "force-static";

const FILES = ["maplibre-gl-worker.mjs", "maplibre-gl-shared.mjs"] as const;

export function generateStaticParams() {
  return FILES.map((file) => ({ file }));
}

export async function GET(_req: Request, { params }: { params: Promise<{ file: string }> }) {
  const { file } = await params;
  if (!(FILES as readonly string[]).includes(file)) return new Response("Not found", { status: 404 });
  // The build runs in apps/web, where the package is installed (a bundler would rewrite a `require.resolve`).
  return new Response(await readFile(join(process.cwd(), "node_modules/maplibre-gl/dist", file)), { headers: { "content-type": "text/javascript; charset=utf-8", "cache-control": "public, max-age=86400" } });
}
