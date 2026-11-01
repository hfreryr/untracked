// Mesure du classement des lieux mis en avant TELS QUE LA CARTE LES DESSINE (chevauchements réglés par MapLibre) :
// part des lieux d'un étalon (docs/mesures/etalon-classement.json, branche mesure-classement) visibles aux zooms 14,
// 15 et 16, et nombre d'étiquettes dessinées (la densité, pour comparer à densité égale).
// Usage (après npm run build, tuiles de lieux mis en avant copiées dans build/data/…/landmarks) :
//   node tests/landmarks-rendu.mjs etalon.json [--json sortie.json]
import { chromium } from 'playwright';
import { spawn } from 'node:child_process';
import { readFileSync, writeFileSync } from 'node:fs';

const [etalonPath, ...rest] = process.argv.slice(2);
const out = rest.includes('--json') ? rest[rest.indexOf('--json') + 1] : null;
const et = JSON.parse(readFileSync(etalonPath, 'utf8'));
const PORT = 4197;
const here = new URL('.', import.meta.url).pathname;
const srv = spawn('python3', ['-m', 'http.server', String(PORT), '-d', `${here}../build`], { stdio: 'ignore', detached: true });
for (let i = 0; i < 40; i++) { try { if ((await fetch(`http://localhost:${PORT}/`)).ok) break; } catch { /* pas prêt */ } await new Promise((r) => setTimeout(r, 300)); }
const proxy = process.env.HTTPS_PROXY ? { proxy: { server: process.env.HTTPS_PROXY, bypass: '<-loopback>,localhost,127.0.0.1' } } : {};
const browser = await chromium.launch({ ...proxy, args: ['--use-gl=swiftshader', '--enable-unsafe-swiftshader'] });
const norm = (s) => (s || '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();
const res = {};
for (const [city, q] of Object.entries(et)) {
  if (city.startsWith('_')) continue;
  const [w, s, e, n] = q.bbox, lat = (s + n) / 2, lon = (w + e) / 2;
  res[city] = {};
  for (const z of [14, 15, 16]) {
    const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true, locale: 'fr-FR' });
    await ctx.addInitScript(() => { localStorage.setItem('promesse-vue', '1'); localStorage.setItem('installer-plus-tard', JSON.stringify({ n: 2, at: Date.now() })); });
    const p = await ctx.newPage();
    await p.goto(`http://localhost:${PORT}/#carte=${z}/${lat.toFixed(5)}/${lon.toFixed(5)}`);
    await p.waitForFunction(() => window.__map?.loaded() && window.__map.areTilesLoaded(), null, { timeout: 30000 }).catch(() => {});
    await p.waitForTimeout(3500);
    const names = await p.evaluate(() => [...new Set(window.__map.queryRenderedFeatures({ layers: ['landmark'] }).map((f) => f.properties.name))]);
    const all = await p.evaluate(() => [...new Set(window.__map.queryRenderedFeatures().filter((f) => f.layer.type === 'symbol' && /^(landmark|poi)/.test(f.layer.id)).map((f) => f.properties.name))]);
    const seen = new Set(all.map(norm));
    const hit = (x) => [...seen].some((s) => s === norm(x) || s.includes(norm(x)) || norm(x).includes(s) && s.length > 5);
    const r = {};
    for (const kind of ['voir', 'manger']) r[kind] = q[kind].filter(hit);
    res[city][`z${z}`] = { voir: r.voir.length, voirN: q.voir.length, manger: r.manger.length, mangerN: q.manger.length, etiquettes: names.length, lieux: all.length, vus: [...r.voir, ...r.manger] };
    console.log(city, `z${z}`, `voir ${r.voir.length}/${q.voir.length}`, `manger ${r.manger.length}/${q.manger.length}`, `étiquettes mises en avant ${names.length}, lieux dessinés ${all.length}`);
    await ctx.close();
  }
}
if (out) writeFileSync(out, JSON.stringify(res, null, 1));
await browser.close();
try { process.kill(-srv.pid); } catch { /* déjà arrêté */ }
