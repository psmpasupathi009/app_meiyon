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

function patch(content) {
  let s = content;
  s = s.replace(
    /findUsersWithPermission\(\s*(["'`])/g,
    "findUsersWithPermission(user.officeId, $1"
  );
  s = s.replace(
    /findUsersByRoles\(\s*(\[)/g,
    "findUsersByRoles(user.officeId, $1"
  );
  s = s.replace(
    /findUsersByMobiles\(\s*(\[)/g,
    "findUsersByMobiles(user.officeId, $1"
  );
  s = s.replace(
    /findCaseNotifyRecipients\(\s*(\[)/g,
    "findCaseNotifyRecipients(user.officeId, $1"
  );
  s = s.replace(
    /\.map\(\(u\) => \(\{\s*\n(\s*)userId: u\.id,/g,
    ".map((u) => ({\n$1officeId: user.officeId,\n$1officeUnitId: user.officeUnitId,\n$1userId: u.id,"
  );
  s = s.replace(
    /await notifyUser\(\{\s*\n(\s*)userId:/g,
    "await notifyUser({\n$1officeId: user.officeId,\n$1officeUnitId: user.officeUnitId,\n$1userId:"
  );
  s = s.replace(/ensureDefaultPermissions\(\)/g, "ensureDefaultPermissions(user.officeId)");
  return s;
}

let n = 0;
for (const file of walk(path.join(root, "app/api"))) {
  const orig = fs.readFileSync(file, "utf8");
  const next = patch(orig);
  if (next !== orig) {
    fs.writeFileSync(file, next);
    n++;
  }
}
console.log(`notify patch: ${n} files`);
