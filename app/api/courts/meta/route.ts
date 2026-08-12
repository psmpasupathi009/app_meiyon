import { apiHandler, jsonOk, jsonFail, parsePagination } from "@/lib/api/response";
import { requireUser } from "@/lib/api/guard";
import {
  listIndiaComplexes,
  listIndiaCourts,
  listIndiaDistricts,
  listIndiaStates,
} from "@/lib/courts/local-catalog";
import { paginateNamedOptions } from "@/lib/utils/paginate-options";

/**
 * Offline court hierarchy for Register Case (all-India office seed + used cases).
 *
 * GET ?level=states|districts|complexes|courts&q&page&pageSize
 */
export const GET = apiHandler(async (request) => {
  const { user, response } = await requireUser(request);
  if (!user) return response;

  const { searchParams } = new URL(request.url);
  const level = (searchParams.get("level") ?? "states").trim();
  const q = searchParams.get("q")?.trim() ?? "";
  const { page, pageSize } = parsePagination(searchParams);
  const attribution = {
    provider: "office-seed",
    note: "All-India court list (seed + courts used on existing cases). Type “Other” for any court not listed. Verify filings on official eCourts if needed.",
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
    const { options, source } = listIndiaStates();
    return pageResult(options, { source });
  }

  if (level === "districts") {
    const state = searchParams.get("state")?.trim();
    if (!state) return jsonFail("VALIDATION", "state is required", 400);
    const { options, source } = await listIndiaDistricts(state);
    return pageResult(options, { state, source });
  }

  if (level === "complexes") {
    const state = searchParams.get("state")?.trim();
    const district = searchParams.get("district")?.trim();
    if (!state || !district) {
      return jsonFail("VALIDATION", "state and district are required", 400);
    }
    const { options, source } = await listIndiaComplexes(state, district);
    return pageResult(options, { state, district, source });
  }

  if (level === "courts") {
    const state = searchParams.get("state")?.trim();
    const district = searchParams.get("district")?.trim();
    const complex = searchParams.get("complex")?.trim();
    if (!state || !district || !complex) {
      return jsonFail(
        "VALIDATION",
        "state, district and complex are required",
        400
      );
    }
    const { options, source } = await listIndiaCourts(
      state,
      district,
      complex
    );
    return pageResult(options, { state, district, complex, source });
  }

  return jsonFail(
    "VALIDATION",
    "level must be states|districts|complexes|courts",
    400
  );
});
