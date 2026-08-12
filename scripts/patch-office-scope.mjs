#!/usr/bin/env node
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), "..");
const apiDir = path.join(root, "app/api");
const libDir = path.join(root, "lib");

function walk(dir, acc = []) {
  for (const ent of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, ent.name);
    if (ent.isDirectory()) walk(p, acc);
    else if (ent.name.endsWith(".ts")) acc.push(p);
  }
  return acc;
}

function patchFile(file) {
  let s = fs.readFileSync(file, "utf8");
  const orig = s;

  // nextUnitId with office scope
  s = s.replace(/nextUnitId\((["'`][^"'`]+["'`])\)/g, "nextUnitId($1, user)");

  // unitId lookups scoped to office
  s = s.replace(
    /\.findUnique\(\{\s*where:\s*\{\s*unitId(?::|\s)/g,
    ".findFirst({ where: { unitId, officeId: user.officeId "
  );
  s = s.replace(
    /\.findUnique\(\{\s*where:\s*\{\s*unitId:\s*([^,}]+)\s*\}/g,
    ".findFirst({ where: { unitId: $1, officeId: user.officeId }"
  );

  // writeAudit officeId
  s = s.replace(
    /writeAudit\(\{\s*\n(\s*)actorUnitId:/g,
    "writeAudit({\n$1officeId: user.officeId,\n$1actorUnitId:"
  );

  // prisma.*.create data — inject office fields after opening data: {
  if (file.includes("/app/api/") && s.includes("prisma.") && s.includes(".create(")) {
    s = s.replace(
      /(\.create\(\{\s*data:\s*\{)(?!\s*officeId)/g,
      "$1\n      officeId: user.officeId,\n      officeUnitId: user.officeUnitId,"
    );
  }

  // List queries: spread officeId into where objects that lack it (heuristic)
  s = s.replace(
    /(const where(?::[^=]+)?=\s*\{)(?!([^}]*officeId))/g,
    (m, prefix, _rest, offset, full) => {
      if (!full.slice(offset).includes("user.officeId")) return m;
      if (full.slice(offset, offset + 200).includes("officeId")) return m;
      return `${prefix}\n    officeId: user.officeId,`;
    }
  );

  if (s !== orig) {
    fs.writeFileSync(file, s);
    return true;
  }
  return false;
}

let count = 0;
for (const file of [...walk(apiDir), ...walk(libDir)]) {
  if (file.includes("/auth/")) continue;
  if (patchFile(file)) count++;
}
console.log(`Patched ${count} files`);
