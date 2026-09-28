type LegacyQuery = Record<string, string | string[] | undefined>;

/** Only known, bounded query values survive a legacy collection redirect. Detail URLs stay in place. */
export function legacyV3CollectionDestination(view: "today" | "saved", query: LegacyQuery): string {
  const params = new URLSearchParams({ view });
  const search = query.q;
  if (typeof search === "string" && search.length <= 100 && search.trim()) params.set("q", search);
  const page = query.page;
  if (typeof page === "string" && /^[1-9]\d{0,2}$/.test(page)) params.set("page", page);
  return `/app/cook?${params.toString()}`;
}
