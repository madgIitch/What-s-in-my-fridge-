const DEFAULT_RETURN_TO = "/app";

export function safeReturnTo(value: FormDataEntryValue | string | null | undefined) {
  if (typeof value !== "string" || !value.startsWith("/") || value.startsWith("//")) {
    return DEFAULT_RETURN_TO;
  }

  try {
    const parsed = new URL(value, "http://local.invalid");
    if (parsed.origin !== "http://local.invalid" || (parsed.pathname !== "/app" && !parsed.pathname.startsWith("/app/"))) {
      return DEFAULT_RETURN_TO;
    }
    return `${parsed.pathname}${parsed.search}${parsed.hash}`;
  } catch {
    return DEFAULT_RETURN_TO;
  }
}
