// Grille « d'où je cherche × ce que je cherche » (grid.json), dans l'app construite (npm run build) :
// la bonne réponse doit sortir en premier, où que l'on soit et quelle que soit la distance.
//   node tests/search/grid.mjs                → avec Photon
//   node tests/search/grid.mjs --sans-photon  → Photon coupé : ce que nous savons faire seuls
//   node tests/search/grid.mjs --json out.json
// Les réponses viennent des vrais services (géocodeur de l'État, Photon) : le taux peut varier d'un jour à l'autre.
import { chromium } from 'playwright';
import { spawn } from 'node:child_process';
import { readFileSync, writeFileSync } from 'node:fs';

const here = new URL('.', import.meta.url).pathname;
const grid = JSON.parse(readFileSync(`${here}grid.json`, 'utf8'));
const args = process.argv.slice(2);
const noPhoton = args.includes('--sans-photon');
const jsonOut = args.includes('--json') ? args[args.indexOf('--json') + 1] : null;

const PORT = 4198;
const server = spawn('python3', ['-m', 'http.server', String(PORT), '-d', `${here}../../build`], { stdio: 'ignore', detached: true });
for (let i = 0; i < 60; i++) {
  try { if ((await fetch(`http://localhost:${PORT}/`)).ok) break; } catch { /* pas encore prêt */ }
  await new Promise((r) => setTimeout(r, 500));
}
const proxy = process.env.HTTPS_PROXY ? { proxy: { server: process.env.HTTPS_PROXY, bypass: '<-loopback>,localhost,127.0.0.1' } } : {};
const browser = await chromium.launch({ ...proxy, args: ['--use-gl=swiftshader', '--enable-unsafe-swiftshader'] });

// premier résultat une fois la liste stable (les résultats du téléphone arrivent avant ceux des services)
async function firstResult(p, q) {
  await p.fill('#search', ''); await p.waitForTimeout(300);
  const t0 = Date.now();
  await p.fill('#search', q);
  let last = null, since = Date.now(), firstAt = null;
  while (Date.now() - t0 < 12000) {
    await p.waitForTimeout(250);
    const t = await p.$eval('.results li.opt', (e) => e.innerText.replace(/\s+/g, ' ')).catch(() => null);
    if (t && firstAt == null) firstAt = Date.now() - t0;
    if (t !== last) { last = t; since = Date.now(); } else if (t && Date.now() - since > 2000) break;
  }
  return { text: last || '', ms: firstAt };
}

const rows = [];
for (const [name, hash] of Object.entries(grid.starts)) {
  const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true, locale: 'fr-FR' });
  await ctx.addInitScript(() => { localStorage.setItem('promesse-vue', '1'); localStorage.setItem('installer-plus-tard', JSON.stringify({ n: 2, at: Date.now() })); });
  const p = await ctx.newPage();
  if (noPhoton) await p.route('**/photon.komoot.io/**', (r) => r.abort());
  await p.goto(`http://localhost:${PORT}/#carte=${hash}`, { waitUntil: 'networkidle' });
  await p.waitForTimeout(2500);
  await p.click('#search'); await p.waitForTimeout(1500);
  for (const g of grid.queries.filter((g) => !g.from || g.from.includes(name))) {
    const { text, ms } = await firstResult(p, g.q);
    const ok = new RegExp(g.expect, 'i').test(text);
    rows.push({ from: name, kind: g.kind, q: g.q, ok, ms, first: text.slice(0, 90) });
    console.log(`${ok ? '✓' : '✗'} ${name.padEnd(9)} ${g.q.padEnd(36)} ${ms == null ? '—' : `${ms} ms`.padStart(8)}  ${text.slice(0, 70)}`);
  }
  await ctx.close();
}
await browser.close();
try { process.kill(-server.pid); } catch { /* déjà arrêté */ }

console.log(`\nRéussite (bonne réponse en premier)${noPhoton ? ', Photon coupé' : ''} :`);
for (const kind of [...new Set(rows.map((r) => r.kind))]) {
  const k = rows.filter((r) => r.kind === kind), ok = k.filter((r) => r.ok).length;
  console.log(`  ${kind.padEnd(8)} ${ok}/${k.length}`);
}
const ok = rows.filter((r) => r.ok).length;
console.log(`  total    ${ok}/${rows.length} (${Math.round((100 * ok) / rows.length)} %)`);
if (jsonOut) writeFileSync(jsonOut, JSON.stringify(rows, null, 1));
