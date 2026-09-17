/** Shared domain primitives. Business behavior moves here only as its sprint is approved. */
export type EntityId = string;

export type LegacyReference = Readonly<{
  source: "FIREBASE";
  legacyId: string;
}>;
