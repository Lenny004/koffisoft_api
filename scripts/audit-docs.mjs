import fs from 'fs';
import path from 'path';

function walk(dir, acc = []) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, entry.name);
    if (entry.name === 'node_modules' || entry.name === 'dist' || entry.name === 'generated') continue;
    if (entry.isDirectory()) walk(p, acc);
    else if (
      /\.ts$/.test(entry.name) &&
      !entry.name.endsWith('.test.ts') &&
      !entry.name.endsWith('.spec.ts') &&
      !entry.name.endsWith('.e2e.spec.ts')
    ) {
      acc.push(p);
    }
  }
  return acc;
}

function hasDocBefore(lines, idx) {
  let j = idx - 1;
  while (j >= 0 && lines[j].trim() === '') j--;
  if (j < 0) return false;
  if (!lines[j].trim().endsWith('*/')) return false;
  while (j >= 0 && !lines[j].trim().startsWith('/**')) j--;
  return j >= 0 && lines[j].trim().startsWith('/**');
}

function detectFunctionLine(line) {
  const trimmed = line.trim();
  if (trimmed.startsWith('//') || trimmed.startsWith('*')) return null;

  const fn = line.match(/^\s*(export\s+)?(async\s+)?function\s+(\w+)/);
  if (fn) return { name: fn[3], kind: 'function' };

  const typedArrow = line.match(/^\s*(export\s+)?const\s+(\w+)\s*:\s*[^=]+=\s*async\s*\(/);
  if (typedArrow) return { name: typedArrow[2], kind: 'const' };

  const asyncArrow = line.match(/^\s*(export\s+)?const\s+(\w+)\s*=\s*async\s*\(/);
  if (asyncArrow) return { name: asyncArrow[2], kind: 'const' };

  const arrowFn = line.match(/^\s*(export\s+)?const\s+(\w+)\s*=\s*\([^)]*\)\s*=>/);
  if (arrowFn) return { name: arrowFn[2], kind: 'const' };

  const factoryExport = line.match(/^\s*export const\s+(\w+)\s*=\s*[A-Za-z_$]\w*\s*\(/);
  if (factoryExport) return { name: factoryExport[1], kind: 'export' };

  const classMethod = line.match(/^\s+(async\s+)?(\w+)\s*\([^)]*\)\s*[:{]/);
  if (classMethod) {
    const name = classMethod[2];
    if (['if', 'for', 'while', 'switch', 'catch', 'constructor'].includes(name)) return null;
    return { name, kind: 'method' };
  }

  return null;
}

function auditFile(filePath) {
  const text = fs.readFileSync(filePath, 'utf8');
  const lines = text.split('\n');
  const funcs = [];

  for (let i = 0; i < lines.length; i++) {
    const detected = detectFunctionLine(lines[i]);
    if (!detected) continue;
    funcs.push({
      line: i + 1,
      name: detected.name,
      kind: detected.kind,
      hasDoc: hasDocBefore(lines, i),
    });
  }

  const missing = funcs.filter((f) => !f.hasDoc);
  return { funcs, missing };
}

const root = path.join(process.cwd(), 'src');
const files = walk(root).sort();
const report = [];

for (const file of files) {
  const rel = path.relative(process.cwd(), file).replace(/\\/g, '/');
  const { funcs, missing } = auditFile(file);
  if (funcs.length === 0) {
    report.push({ rel, total: 0, missing: 0, status: 'sin-funciones' });
    continue;
  }
  const status =
    missing.length === 0 ? 'completo' : missing.length === funcs.length ? 'pendiente' : 'parcial';
  report.push({
    rel,
    total: funcs.length,
    missing: missing.length,
    documented: funcs.length - missing.length,
    status,
    missingNames: missing.map((m) => `${m.name}:${m.line}`),
  });
}

const summary = {
  files: report.length,
  completo: report.filter((r) => r.status === 'completo').length,
  parcial: report.filter((r) => r.status === 'parcial').length,
  pendiente: report.filter((r) => r.status === 'pendiente').length,
  sinFunciones: report.filter((r) => r.status === 'sin-funciones').length,
};

const out = { summary, report };
const outPath = path.join(process.cwd(), 'scripts', 'audit-docs-result.json');
fs.writeFileSync(outPath, JSON.stringify(out, null, 2), 'utf8');
console.log(JSON.stringify(summary, null, 2));
