import { apiHandler, jsonOk, jsonFail, parsePagination } from "@/lib/api/response";
import { requireUser } from "@/lib/api/guard";
import {
  listLocationDistricts,
  listLocationStates,
} from "@/lib/locations/catalog";
import { paginateNamedOptions } from "@/lib/utils/paginate-options";

/**
 * Offline address hierarchy for Client intake (locations-seed — no external API).
 * City is free text on the form; not served here.
 *
 * GET ?level=states|districts&q&page&pageSize
 */
export const GET = apiHandler(async (request) => {
  const { user, response } = await requireUser(request);
  if (!user) return response;

  const { searchParams } = new URL(request.url);
  const level = (searchParams.get("level") ?? "states").trim();
  const q = searchParams.get("q")?.trim() ?? "";
  const { page, pageSize } = parsePagination(searchParams);
  const attribution = {
    provider: "locations-seed",
    note: "All-India state and district list. Town / city is typed on the form.",
    liveApiConfigured: false,
  };

  function pageResult(
    options: { code: string; name: string }[],
    extra: Record<string, unknown> = {}
  ) {
    const paged = paginateNamedOptions(options, { q, page, pageSize });
    return jsonOk({
      level,
      source: extra.source,
      attribution,
      ...extra,
      options: paged.options,
      total: paged.total,
      page: paged.page,
      pageSize: paged.pageSize,
    });
  }

  if (level === "states") {
    const { options, source } = listLocationStates();
    return pageResult(options, { source });
  }

  if (level === "districts") {
    const state = searchParams.get("state")?.trim();
    if (!state) return jsonFail("VALIDATION", "state is required", 400);
    const { options, source } = listLocationDistricts(state);
    return pageResult(options, { state, source });
  }

  return jsonFail("VALIDATION", "level must be states|districts", 400);
});
