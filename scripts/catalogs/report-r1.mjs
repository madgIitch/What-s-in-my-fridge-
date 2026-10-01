#!/usr/bin/env node
import { run, R1_RETAILERS } from "./import-catalog.mjs";

const reports = [];
for (const retailer of R1_RETAILERS) reports.push(await run([retailer, "--dry-run"]));
console.log(JSON.stringify({ reports }, null, 2));
