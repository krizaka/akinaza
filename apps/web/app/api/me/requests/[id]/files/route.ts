import { addClientRequestFile, ownClientRequest } from "@akinaza/db";
import { z } from "zod";

import { requireOwnClient } from "@/lib/access";
import { audit } from "@/lib/audit";
import { db } from "@/lib/db";
import { handle, refuse } from "@/lib/http";
import { mediaStorage } from "@/lib/media-storage";
import { detectRequestFile, MAX_REQUEST_FILE_BYTES, storeRequestFile } from "@/lib/media-upload";

export const dynamic = "force-dynamic";

/**
 * One file for a request (akinaza#210): a photo of the cut they want, a document. Checked by its bytes (JPEG, PNG, WebP,
 * PDF), stored content-hashed under the shop's `requests/<id>/`, kept as its address. Off — 503 — until the storage is set.
 */
export const POST = (req: Request, { params }: { params: Promise<{ id: string }> }) =>
  handle(async () => {
    const id = z.uuid().parse((await params).id);
    const media = await mediaStorage({ maxBytes: MAX_REQUEST_FILE_BYTES });
    if (!media) throw refuse(503, "UPLOAD_UNAVAILABLE", "media storage is not configured");
    if (Number(req.headers.get("content-length") ?? 0) > MAX_REQUEST_FILE_BYTES + 4096) throw refuse(413, "UPLOAD_TOO_LARGE", "file too large");
    const form = await req.formData().catch(() => null);
    const clientId = String(form?.get("clientId") ?? "");
    if (!z.uuid().safeParse(clientId).success) throw refuse(400, "BAD_REQUEST", "clientId expected");
    const { session, client } = await requireOwnClient(req, clientId);
    const request = await ownClientRequest(db(), client.id, id);
    const file = form?.get("file");
    if (!(file instanceof File)) throw refuse(400, "BAD_REQUEST", "no file");
    if (file.size > MAX_REQUEST_FILE_BYTES) throw refuse(413, "UPLOAD_TOO_LARGE", "file too large");
    const bytes = new Uint8Array(await file.arrayBuffer());
    if (!detectRequestFile(bytes)) throw refuse(400, "UPLOAD_NOT_ALLOWED", "not a JPEG, PNG, WebP image or a PDF");
    const stored = await storeRequestFile(media, request.shopId, request.id, bytes);
    const fileId = await addClientRequestFile(db(), client.id, request.id, { ...stored, bytes: bytes.length });
    await audit({ action: "client.request_file_added", actorId: session.account.id, actorLabel: session.account.email, targetId: request.id, detail: { bytes: bytes.length, kind: stored.kind }, headers: req.headers });
    return Response.json({ id: fileId, url: stored.url, kind: stored.kind }, { status: 201 });
  });
