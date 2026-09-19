const PROVIDERS_WITHOUT_PASSWORD = new Set(["google.com", "apple.com", "facebook.com", "github.com"]);

export function normalizeFirebaseUser(raw) {
  if (!raw || typeof raw !== "object" || typeof raw.localId !== "string" || raw.localId.length === 0) {
    throw new Error("invalid_firebase_user");
  }

  const providers = Array.isArray(raw.providerUserInfo)
    ? raw.providerUserInfo.map((entry) => String(entry?.providerId ?? "unknown"))
    : [];
  const hasPasswordHash = typeof raw.passwordHash === "string" && raw.passwordHash.length > 0;
  const passwordProvider = providers.length === 0 || providers.includes("password");

  return {
    firebaseUid: raw.localId,
    email: typeof raw.email === "string" ? raw.email.toLowerCase() : null,
    emailVerified: raw.emailVerified === true,
    disabled: raw.disabled === true,
    providers,
    passwordStrategy: hasPasswordHash && passwordProvider ? "firebase_scrypt" : "reset_required",
    passwordlessOnly: providers.length > 0 && providers.every((provider) => PROVIDERS_WITHOUT_PASSWORD.has(provider)),
  };
}

export function buildImportPlan(rawUsers, existingFirebaseUids = new Set()) {
  const seen = new Set();
  return rawUsers.map((raw) => {
    const user = normalizeFirebaseUser(raw);
    if (seen.has(user.firebaseUid)) throw new Error("duplicate_firebase_uid");
    seen.add(user.firebaseUid);
    return { ...user, action: existingFirebaseUids.has(user.firebaseUid) ? "already_imported" : "import" };
  });
}

export function summarizePlan(plan) {
  const summary = { total: plan.length, enabled: 0, disabled: 0, emailVerified: 0, resetRequired: 0, alreadyImported: 0, providers: {} };
  for (const user of plan) {
    summary[user.disabled ? "disabled" : "enabled"] += 1;
    if (user.emailVerified) summary.emailVerified += 1;
    if (user.passwordStrategy === "reset_required") summary.resetRequired += 1;
    if (user.action === "already_imported") summary.alreadyImported += 1;
    for (const provider of user.providers.length ? user.providers : ["password"]) {
      summary.providers[provider] = (summary.providers[provider] ?? 0) + 1;
    }
  }
  return summary;
}
