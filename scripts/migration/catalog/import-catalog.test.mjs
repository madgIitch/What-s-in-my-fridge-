import assert from "node:assert/strict";
import test from "node:test";
import { prepareCatalog } from "./import-catalog.mjs";

const vocabulary = { version: "1", ingredients: { tomato: { normalized: "tomato", synonyms: ["tomatoes"], category: "vegetable" } } };
const progress = { normalizedRecipes: [{ id: "r-1", name: "Soup", ingredients: ["tomatoes"] }] };
test("catalog checksum is canonical", () => assert.equal(prepareCatalog(progress, vocabulary).checksum, prepareCatalog(structuredClone(progress), structuredClone(vocabulary)).checksum));
test("invalid input aborts before import", () => assert.throws(() => prepareCatalog({ normalizedRecipes: [{ id: "x", name: "", ingredients: [] }] }, vocabulary), /CATALOG_INVALID/));
