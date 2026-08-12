import { readFile } from "fs/promises";
import path from "path";
import { apiHandler, jsonFail } from "@/lib/api/response";
import { requireStaffUser } from "@/lib/api/guard";

/** Allowlisted office PDFs under private/office-files/ */
const OFFICE_FILES: Record<
  string,
  { file: string; contentType: string; downloadName: string }
> = {
  "address-and-mail": {
    file: "address-and-mail.pdf",
    contentType: "application/pdf",
    downloadName: "address-and-mail.pdf",
  },
};

export const GET = apiHandler(async (request, context) => {
  const { user, response } = await requireStaffUser(request);
  if (!user) return response;

  const { slug } = (await context.params) ?? {};
  const entry = slug ? OFFICE_FILES[slug] : undefined;
  if (!entry) return jsonFail("NOT_FOUND", "File not found", 404);

  const root = path.join(process.cwd(), "private", "office-files");
  const fullPath = path.join(root, entry.file);
  if (!fullPath.startsWith(root + path.sep)) {
    return jsonFail("NOT_FOUND", "File not found", 404);
  }

  try {
    const buffer = await readFile(fullPath);
    return new Response(buffer, {
      status: 200,
      headers: {
        "Content-Type": entry.contentType,
        "Content-Length": String(buffer.byteLength),
        "Content-Disposition": `inline; filename="${entry.downloadName}"`,
        "Cache-Control": "private, no-store",
      },
    });
  } catch {
    return jsonFail("NOT_FOUND", "File not found", 404);
  }
});
