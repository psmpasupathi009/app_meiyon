#!/usr/bin/env node
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), "..");

function walk(dir, acc = []) {
  if (!fs.existsSync(dir)) return acc;
  for (const ent of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, ent.name);
    if (ent.isDirectory()) walk(p, acc);
    else if (ent.name.endsWith(".ts")) acc.push(p);
  }
  return acc;
}

function repair(content) {
  let s = content;
  // Fix broken patch: { unitId, officeId: user.officeId  expr }
  s = s.replace(
    /\{\s*unitId,\s*officeId:\s*user\.officeId\s+([^,}\n]+?)\s*\}/g,
    "{ unitId: $1, officeId: user.officeId }"
  );
  // Fix shorthand unitId variable: { unitId, officeId: user.officeId }
  s = s.replace(
    /\{\s*unitId,\s*officeId:\s*user\.officeId\s*\}/g,
    "{ unitId, officeId: user.officeId }"
  );
  return s;
}

let count = 0;
for (const file of [
  ...walk(path.join(root, "app/api")),
  ...walk(path.join(root, "lib")),
]) {
  const orig = fs.readFileSync(file, "utf8");
  const next = repair(orig);
  if (next !== orig) {
    fs.writeFileSync(file, next);
    count++;
  }
}
console.log(`Repaired ${count} files`);
