import fs from "node:fs";
import path from "node:path";

const repoRoot = process.cwd();
const baselinePath = path.join(repoRoot, "scripts", "ci", "no-any-baseline.json");
const writeBaseline = process.argv.includes("--write-baseline");

const candidateScopes = [
  "lib/controlTowerV3",
  "src/lib/controlTowerV3",
  "src/lib/domain/controlTowerV3",
];

const scopes = candidateScopes.filter((scope) => fs.existsSync(path.join(repoRoot, scope)));

if (scopes.length === 0) {
  console.log("no-new-any: no configured scope exists, skipping");
  process.exit(0);
}

const skipDir = new Set(["node_modules", ".next", "dist", "build", "coverage", ".git"]);
const fileRegex = /\.(ts|tsx)$/i;
const patterns = [/\:\s*any\b/g, /<\s*any\s*>/g, /\bas\s+any\b/g, /\bany\s*\[\s*\]/g];

function walk(dir, files = []) {
  const entries = fs.readdirSync(dir, { withFileTypes: true });
  for (const entry of entries) {
    const abs = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      if (!skipDir.has(entry.name)) {
        walk(abs, files);
      }
      continue;
    }
    if (fileRegex.test(entry.name)) {
      files.push(abs);
    }
  }
  return files;
}

function countAnyUsages(content) {
  let total = 0;
  for (const regex of patterns) {
    const matches = content.match(regex);
    total += matches ? matches.length : 0;
  }
  return total;
}

function collectCurrentCounts() {
  const result = {};
  for (const scope of scopes) {
    const absScope = path.join(repoRoot, scope);
    const files = walk(absScope);
    for (const file of files) {
      const content = fs.readFileSync(file, "utf8");
      const count = countAnyUsages(content);
      if (count > 0) {
        const relative = path.relative(repoRoot, file).replace(/\\/g, "/");
        result[relative] = count;
      }
    }
  }
  return result;
}

function writeBaselineFile(files) {
  const payload = {
    version: 1,
    generatedAt: new Date().toISOString(),
    scope: scopes,
    files,
  };
  fs.mkdirSync(path.dirname(baselinePath), { recursive: true });
  fs.writeFileSync(baselinePath, `${JSON.stringify(payload, null, 2)}\n`, "utf8");
}

const current = collectCurrentCounts();

if (writeBaseline) {
  writeBaselineFile(current);
  console.log(`no-new-any: baseline written (${Object.keys(current).length} file(s) with any)`);
  process.exit(0);
}

if (!fs.existsSync(baselinePath)) {
  console.error("no-new-any: baseline file missing at scripts/ci/no-any-baseline.json");
  console.error("Run: node scripts/ci/no-new-any.mjs --write-baseline");
  process.exit(1);
}

const rawBaseline = fs.readFileSync(baselinePath, "utf8");
const baseline = JSON.parse(rawBaseline);
const baselineFiles = baseline.files && typeof baseline.files === "object" ? baseline.files : {};

const regressions = [];
for (const [file, count] of Object.entries(current)) {
  const previous = Number(baselineFiles[file] ?? 0);
  if (count > previous) {
    regressions.push({ file, previous, count });
  }
}

if (regressions.length > 0) {
  console.error("no-new-any: regression detected");
  for (const row of regressions) {
    console.error(`- ${row.file}: ${row.previous} -> ${row.count}`);
  }
  process.exit(1);
}

console.log("no-new-any: OK (no increases vs baseline)");
