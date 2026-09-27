#!/usr/bin/env node
import { readFile, writeFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import path from "node:path";
import { prepareCatalog } from "./import-catalog.mjs";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../../..");
const [progress, vocabulary] = await Promise.all([
  readFile(path.join(root, "whats-in-my-fridge-backend/data/progress.json"), "utf8").then(JSON.parse),
  readFile(path.join(root, "whats-in-my-fridge-backend/data/normalized-ingredients.json"), "utf8").then(JSON.parse),
]);
const catalog = prepareCatalog(progress, vocabulary);
const names = [...new Set(catalog.recipes.flatMap((recipe) => recipe.ingredients.map((ingredient) => ingredient.normalizedName)))].sort();
const output = path.join(root, "apps/web/src/lib/recipes/catalog-name-index.json");
await writeFile(output, JSON.stringify({ checksum: catalog.checksum, names }));
process.stdout.write(`${JSON.stringify({ checksum: catalog.checksum, names: names.length })}\n`);
