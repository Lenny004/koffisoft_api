import fs from 'fs';

const j = JSON.parse(fs.readFileSync('scripts/audit-docs-result.json', 'utf8'));
const legend = {
  completo: '[x]',
  parcial: '[~]',
  pendiente: '[ ]',
  'sin-funciones': '[-]',
};

const lines = [
  '# Checklist documentación (funciones y métodos)',
  '',
  'Auditoría: `node scripts/audit-docs.mjs` y `node scripts/generate-checklist.mjs`.',
  'Criterio: bloque `/**` en español inmediatamente encima de cada declaración de función o método.',
  '',
  '## Leyenda',
  '',
  '| Símbolo | Significado |',
  '| --- | --- |',
  '| [x] | Todas las funciones detectadas documentadas |',
  '| [~] | Parcial |',
  '| [ ] | Pendiente |',
  '| [-] | Sin funciones declaradas |',
  '',
  '## Resumen',
  '',
  '| Métrica | Cantidad |',
  '| --- | ---: |',
  ...Object.entries(j.summary).map(([k, v]) => `| ${k} | ${v} |`),
  '',
  '## Archivos',
  '',
  '| | Archivo | Funciones | Doc |',
  '| --- | --- | ---: | ---: |',
];

for (const r of j.report.sort((a, b) => a.rel.localeCompare(b.rel))) {
  const icon = legend[r.status] || '?';
  const doc = r.status === 'sin-funciones' ? '—' : String(r.documented);
  lines.push(`| ${icon} | \`${r.rel}\` | ${r.total || '—'} | ${doc} |`);
}

const pending = j.report.filter((r) => r.status === 'pendiente' || r.status === 'parcial');
if (pending.length) {
  lines.push('', '## Pendientes (detalle)', '');
  for (const r of pending) {
    lines.push(`- **${r.rel}**: ${(r.missingNames || []).join(', ')}`);
  }
}

fs.writeFileSync('docs/checklist-documentacion.md', lines.join('\n'));
console.log('Wrote docs/checklist-documentacion.md');
