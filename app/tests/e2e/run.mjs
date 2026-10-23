// Tests de bout en bout (Playwright + Chromium) sur le site construit (npm run build), servi en local.
// Ils appellent les vrais services (OpenFreeMap, Photon, Géoplateforme, Valhalla, Transitous) : à lancer à la main
// avant une publication, pas en intégration continue.   Usage : npm run e2e
import { chromium } from 'playwright';
import { spawn, execFileSync } from 'node:child_process';
import { readFileSync, writeFileSync } from 'node:fs';
import { createRequire } from 'node:module';
const AXE = readFileSync(createRequire(import.meta.url).resolve('axe-core/axe.min.js'), 'utf8');
import { packList, pack, snapshot, DEFAULT_LISTS } from '../../src/lib/myplaces.js';

const PORT = 4199;
// le site construit (build/), servi tel quel, comme sur GitHub Pages (vite preview dépend de fichiers que svelte-check efface)
const preview = spawn('python3', ['-m', 'http.server', String(PORT), '-d', new URL('../../build', import.meta.url).pathname], { stdio: 'ignore', detached: true });
// on attend que le serveur réponde (au plus 30 s)
for (let i = 0; i < 60; i++) {
  try { if ((await fetch(`http://localhost:${PORT}/`)).ok) break; } catch { /* pas encore prêt */ }
  await new Promise((r) => setTimeout(r, 500));
}
const proxy = process.env.HTTPS_PROXY ? { proxy: { server: process.env.HTTPS_PROXY, bypass: '<-loopback>,localhost,127.0.0.1' } } : {};
const browser = await chromium.launch({ ...proxy, args: ['--use-gl=swiftshader', '--enable-unsafe-swiftshader'] });
let failed = 0;
const cspSeen = [];   // violations de la politique de sécurité, vérifiées après chaque test
const assert = (cond, msg) => { if (!cond) throw new Error(msg); };

async function page(opts = {}, hash = '') {
  const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true, locale: 'fr-FR', timezoneId: 'Europe/Paris',
    geolocation: { latitude: 48.851, longitude: 2.339 }, permissions: ['geolocation'], ...opts });
  // (bandeau de la première ouverture et invitation à installer déjà vus : ils ne gênent pas les autres tests)
  await ctx.addInitScript(() => { localStorage.setItem('promesse-vue', '1'); localStorage.setItem('installer-plus-tard', JSON.stringify({ n: 2, at: Date.now() })); });
  const p = await ctx.newPage();
  const errors = [];
  p.on('pageerror', (e) => errors.push(e.message));
  // toute violation de la politique de sécurité (CSP) compte comme une erreur : un fournisseur oublié serait bloqué
  p.on('console', (m) => { if (/Content Security Policy|Refused to (connect|load|execute)/i.test(m.text())) { errors.push(`CSP : ${m.text().slice(0, 160)}`); cspSeen.push(m.text().slice(0, 200)); } });
  await p.goto(`http://localhost:${PORT}/${hash}`, { waitUntil: 'networkidle' });
  await p.waitForTimeout(2500);
  return { p, ctx, errors };
}
const pick = (p) => p.dispatchEvent('.results li.opt button >> nth=0', 'mousedown');

const tests = {
  async 'fiche depuis les tuiles (sans Overpass)'() {
    const { p, ctx, errors } = await page();
    const hosts = new Set(); p.on('request', (r) => hosts.add(new URL(r.url()).host));
    await p.fill('#search', "Ed's rue Muller"); await p.waitForTimeout(4000); await pick(p); await p.waitForTimeout(3000);
    const txt = await p.$eval('.sheet', (e) => e.innerText);
    assert(/Horaires/.test(txt) && /Téléphone/.test(txt), 'horaires et téléphone absents');
    assert(![...hosts].some((h) => /overpass|api\.openstreetmap\.org/.test(h)), 'appel Overpass ou API OSM détecté');
    assert(!errors.length, errors.join(' | '));
    await ctx.close();
  },
  async 'vue de la rue : vignette puis visionneuse plein écran'() {
    // lieu des tuiles locales avec une photo de devanture (Panoramax)
    const { p, ctx, errors } = await page();
    await p.fill('#search', 'Etam rue de Rennes'); await p.waitForSelector('.results li.opt button', { timeout: 20000 }); await pick(p);
    await p.waitForSelector('.street-thumb', { timeout: 20000 });
    await p.click('.street-thumb'); await p.waitForSelector('.viewer .pano', { timeout: 10000 });
    await p.click('.viewer-close'); await p.waitForTimeout(500);
    assert(!(await p.$('.viewer')), 'la visionneuse ne se ferme pas');
    assert(!errors.length, errors.join(' | '));
    await ctx.close();
  },
  async 'accessibilité (WCAG 2.2 AA, axe-core) : 8 écrans, clair et sombre'() {
    // Audit automatique : ne voit qu'une partie des problèmes (pas le clavier ni VoiceOver), mais bloque les régressions.
    const resto = async (p) => { await p.click('.chip:has-text("Restaurants")'); await p.waitForTimeout(6000); await p.click('.nearby li button >> nth=0'); await p.waitForTimeout(4000); };
    const screens = {
      accueil: async () => {},
      recherche: async (p) => { await p.fill('#search', '57 rue de rennes'); await p.waitForSelector('.results li.opt', { timeout: 30000 }); },
      catégorie: async (p) => { await p.click('.chip:has-text("Restaurants")'); await p.waitForTimeout(6000); },
      fiche: resto,
      itinéraire: async (p) => { await resto(p); await p.click('.action.primary'); await p.waitForTimeout(10000); },
      'À propos': async (p) => { await p.click('.about-btn'); await p.waitForSelector('.dlg'); await p.waitForTimeout(400); },
      'Mes lieux': async (p) => { await p.click('.chip:has-text("Mes lieux")'); await p.waitForTimeout(1500); },
      'Qui voit quoi': async (p) => { await p.evaluate(() => { const a = document.createElement('a'); a.href = 'confidentialite'; document.body.appendChild(a); a.click(); a.remove(); }); await p.waitForSelector('main h1'); },
    };
    const bad = [];
    for (const dark of [false, true]) for (const [name, go] of Object.entries(screens)) {
      const { p, ctx } = await page({ bypassCSP: true, colorScheme: dark ? 'dark' : 'light' });
      await go(p);
      await p.addScriptTag({ content: AXE });
      const v = await p.evaluate(async () => (await window.axe.run(document, { runOnly: ['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22aa'] })).violations
        .map((x) => `${x.id} (${x.nodes.length}) : ${x.nodes[0].target.join(' ')}`));
      bad.push(...v.map((x) => `${name}${dark ? ' (sombre)' : ''} — ${x}`));
      await ctx.close();
    }
    assert(!bad.length, bad.join(' | '));
  },
  async 'fiche : site et téléphone complétés hors OSM, avec leur source ; pas de source pour une info OSM'() {
    // Mavrommatis : site et téléphone absents d'OSM, complétés depuis Overture (build_extras.py)
    let { p, ctx, errors } = await page({}, '#carte=18/48.873115/2.330373&lieu=node/12728253708');
    await p.waitForSelector('.sheet h1', { timeout: 15000 }); await p.waitForTimeout(2000);
    const det = await p.$eval('.details', (e) => e.innerText);
    assert(/mavrommatis\.com/.test(det) && /42 80 42 42/.test(det), `site ou téléphone absents : ${det}`);
    // site et téléphone (et l’adresse, quand Overture la complète aussi) : chacun avec sa source
    assert((det.match(/Source : Overture Maps/g) || []).length >= 2, `source non indiquée : ${det}`);
    assert(!errors.length, errors.join(' | '));
    await ctx.close();
    // Square Léo Ferré : horaires absents d'OSM, donnés par la Ville de Paris pour la saison en cours
    ({ p, ctx, errors } = await page({}, '#carte=18/48.849688/2.380574&lieu=way/25423021'));
    await p.waitForSelector('.sheet h1', { timeout: 15000 }); await p.waitForTimeout(2000);
    const sq = await p.$eval('.sheet', (e) => e.innerText);
    assert(/18:30|18 h 30/.test(sq) && /Source : Ville de Paris/.test(sq), `horaires de la Ville absents : ${sq.slice(0, 300)}`);
    await ctx.close();
    // Le Grand Pan : horaires lus sur le site du restaurant (schema.org)
    ({ p, ctx, errors } = await page({}, '#carte=18/48.833064/2.305725&lieu=node/556461131'));
    await p.waitForSelector('.sheet h1', { timeout: 15000 }); await p.waitForTimeout(2000);
    assert(/Source : site du lieu/.test(await p.$eval('.sheet', (e) => e.innerText)), 'source « site du lieu » absente');
    await ctx.close();
    // Panthéon : rien de complété, aucune mention de source
    ({ p, ctx, errors } = await page({}, '#carte=18/48.846219/2.346008&lieu=way/16407465'));
    await p.waitForSelector('.sheet h1', { timeout: 15000 }); await p.waitForTimeout(2000);
    assert(!/Source :/.test(await p.$eval('.sheet', (e) => e.innerText)), 'source affichée pour une info OSM');
    await ctx.close();
  },
  async 'lien partagé vers un lieu : fiche complète ; lieu inexistant : message « introuvable »'() {
    // Panthéon : way 16407465 dans nos tuiles. Le lien porte le vrai numéro OSM (pas le numéro codé des tuiles).
    let { p, ctx, errors } = await page({}, '#carte=18/48.846219/2.346008&lieu=way/16407465');
    await p.waitForSelector('.sheet h1', { timeout: 15000 }); await p.waitForTimeout(2000);
    let txt = await p.$eval('.sheet', (e) => e.innerText);
    assert(/Panthéon/.test(txt), `nom absent : ${txt.slice(0, 120)}`);
    assert(!/hors de la zone|introuvable/.test(txt), 'message d\'erreur affiché pour un lieu existant');
    assert(!errors.length, errors.join(' | '));
    await ctx.close();
    ({ p, ctx } = await page({}, '#carte=18/48.846219/2.346008&lieu=node/1'));
    await p.waitForSelector('.sheet', { timeout: 15000 }); await p.waitForTimeout(2500);
    txt = await p.$eval('.sheet', (e) => e.innerText);
    assert(/introuvable/.test(txt) && !/hors de la zone/.test(txt), `message attendu « introuvable » : ${txt.slice(0, 200)}`);
    await ctx.close();
  },
  async 'preuve affichée : 0 cookie, seuls les services de « Qui voit quoi » sont contactés'() {
    // Ce que dit le bandeau « 0 traceur · 0 cookie » de la première ouverture : vérifié sur un parcours complet.
    const { p, ctx, errors } = await page();
    const hosts = new Set(); p.on('request', (r) => hosts.add(new URL(r.url()).host));
    await p.fill('#search', 'Panthéon'); await p.waitForTimeout(5000); await pick(p).catch(() => {}); await p.waitForTimeout(4000);
    await p.click('.close').catch(() => {}); await p.click('.chip:has-text("Restaurants")'); await p.waitForTimeout(5000);
    await p.click('.nearby li button >> nth=0'); await p.waitForTimeout(3000);
    await p.click('.action.primary'); await p.waitForTimeout(8000);
    assert((await ctx.cookies()).length === 0, `cookies déposés : ${JSON.stringify(await ctx.cookies())}`);
    assert((await p.evaluate(() => document.cookie)) === '', 'document.cookie non vide');
    const allowed = /^(localhost(:\d+)?|tiles\.openfreemap\.org|photon\.komoot\.io|data\.geopf\.fr|valhalla1\.openstreetmap\.de|api\.transitous\.org|www\.wikidata\.org|fr\.wikipedia\.org|commons\.wikimedia\.org|upload\.wikimedia\.org|thumb\.wikimedia\.org|[a-z0-9.-]*panoramax[a-z0-9.-]*|[a-z0-9.-]*\.ign\.fr|[a-z0-9.-]*ovh[a-z0-9.-]*)$/;
    const other = [...hosts].filter((h) => !allowed.test(h));
    assert(!other.length, `services non listés contactés : ${other.join(', ')}`);
    assert(!errors.length, errors.join(' | '));
    await ctx.close();
  },
  async 'Photon en panne : la recherche par nom passe par nos données'() {
    const { p, ctx, errors } = await page();
    await p.route('**/photon.komoot.io/**', (r) => r.abort());
    await p.fill('#search', 'Café de Flore'); await p.waitForSelector('.results li.opt button', { timeout: 15000 });
    const first = await p.$eval('.results li.opt', (e) => e.innerText);
    assert(/Café de Flore/.test(first), `résultat inattendu : ${first}`);
    await pick(p); await p.waitForSelector('.sheet h1', { timeout: 10000 }); await p.waitForTimeout(2000);
    assert(/Horaires|Ouvert|Fermé/.test(await p.$eval('.sheet', (e) => e.innerText)), 'fiche incomplète');
    assert(!errors.length, errors.join(' | '));
    await ctx.close();
  },
  async 'recherche sur le téléphone : instantanée malgré Photon lent, fautes tolérées, types de lieux'() {
    const { p, ctx, errors } = await page();
    // Photon répond en 10 s, comme le soir du 15/10/2026 : nos résultats doivent s'afficher sans l'attendre
    await p.route('**/photon.komoot.io/**', async (r) => { await new Promise((ok) => setTimeout(ok, 10000)); r.abort().catch(() => {}); });
    await p.click('#search'); await p.waitForTimeout(1500);       // l'index se charge dès que l'on touche la barre
    const t0 = Date.now();
    await p.fill('#search', 'grnd palai'); await p.waitForSelector('.results li.opt button', { timeout: 5000 });
    const ms = Date.now() - t0;
    const first = await p.$eval('.results li.opt', (e) => e.innerText);
    assert(/^Grand Palais\b/.test(first) && /Musée/.test(first), `premier résultat : ${first}`);
    assert(ms < 2500, `résultats en ${ms} ms`);
    await p.fill('#search', 'élysée'); await p.waitForTimeout(1200);
    assert(/Palais de l'Élysée/.test(await p.$eval('.results li.opt', (e) => e.innerText)), 'élysée : pas le palais en premier');
    await p.fill('#search', 'pharmacie'); await p.waitForTimeout(1500);
    // (la première ligne est le raccourci « Pharmacies, les plus proches », déjà présent avant)
    const metas = (await p.$$eval('.results li.opt .r-meta', (els) => els.map((e) => e.textContent))).filter((m) => !/plus proches/.test(m));
    assert(metas.length >= 3 && metas.every((m) => /Pharmacie/i.test(m)), `pharmacie : ${metas.join(' | ')}`);
    assert(!errors.length, errors.join(' | '));
    await ctx.close();
  },
  async 'choisir « Paris 8e » cadre la zone et garde les raccourcis'() {
    const { p, ctx, errors } = await page();
    await p.fill('#search', 'paris 8e'); await p.waitForSelector('.results li.opt button', { timeout: 30000 });
    assert(/Arrondissement/.test(await p.$eval('.results li.opt', (e) => e.innerText)), 'arrondissement absent des résultats');
    await pick(p); await p.waitForTimeout(2500);
    assert((await p.locator('section.sheet').count()) === 0, 'une fiche s\'ouvre pour une zone');
    assert((await p.locator('.chip:has-text("Restaurants")').count()) === 1, 'raccourcis masqués');
    const c = await p.evaluate(() => window.__map.getCenter());
    assert(Math.abs(c.lat - 48.873) < 0.01 && Math.abs(c.lng - 2.312) < 0.015, `carte mal cadrée : ${c.lat}, ${c.lng}`);
    await p.click('.chip:has-text("Restaurants")'); await p.waitForTimeout(6000);
    assert((await p.locator('.nearby li').count()) > 3, 'pas de restaurants dans la zone');
    assert(!errors.length, errors.join(' | '));
    await ctx.close();
  },
  async 'exemples qui s\'écrivent dans la barre, une fois, puis texte habituel (rien si « réduire les animations »)'() {
    const watch = () => { window.__ph = []; new MutationObserver((ms) => ms.forEach((m) => window.__ph.push(m.target.placeholder)))
      .observe(document, { attributes: true, subtree: true, attributeFilter: ['placeholder'] }); };
    for (const reduce of [false, true]) {
      const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true, locale: 'fr-FR', reducedMotion: reduce ? 'reduce' : 'no-preference' });
      await ctx.addInitScript(() => localStorage.setItem('promesse-vue', '1'));
      await ctx.addInitScript(watch);
      const p = await ctx.newPage();
      await p.goto(`http://localhost:${PORT}/`); await p.waitForTimeout(8000);
      const seen = await p.evaluate(() => window.__ph);
      const ph = await p.getAttribute('#search', 'placeholder');
      assert(/^Rechercher un lieu/.test(ph), `texte final : ${ph}`);
      if (reduce) assert(!seen.some((t) => /restaurant/.test(t)), 'animation jouée malgré « réduire les animations »');
      else assert(seen.includes('restaurant ouvert demain dans le 8e') && seen.includes('boulangerie ouverte dimanche'), `exemples non écrits : ${seen.slice(-5)}`);
      await ctx.close();
    }
  },
  async 'exemples de recherche : toucher « restaurant ouvert demain dans le 8e » lance la recherche'() {
    const { p, ctx, errors } = await page();
    await p.click('#search'); await p.waitForSelector('.results li.example', { timeout: 5000 });
    assert((await p.locator('.results li.example').count()) === 3, 'exemples absents');
    await p.dispatchEvent('.results li.example button >> nth=0', 'mousedown'); await p.waitForTimeout(2500);
    assert((await p.$eval('#search', (e) => e.value)) === 'restaurant ouvert demain dans le 8e', 'texte non repris');
    assert(/8e arrondissement/.test(await p.$eval('.results li.opt', (e) => e.innerText)), 'suggestion sans le 8e');
    await pick(p); await p.waitForTimeout(6000);
    assert(/ouverts? demain/.test(await p.$eval('.sheet .kind', (e) => e.textContent)), 'filtre « demain » non appliqué');
    assert(!errors.length, errors.join(' | '));
    await ctx.close();
  },
  async 'Entrée dans la recherche : tous les lieux de ce nom sur la carte et en liste (retour du 21/10)'() {
    const { p, ctx, errors } = await page({ geolocation: { latitude: 48.853, longitude: 2.333 } });
    await p.fill('#search', 'Monoprix'); await p.waitForTimeout(1500); await p.press('#search', 'Enter');
    await p.waitForSelector('section.sheet .nearby li', { timeout: 15000 }); await p.waitForTimeout(800);
    assert(!(await p.$('section.sheet h1.title, .phead h1')), 'Entrée a ouvert une fiche au lieu de la liste');
    const n = await p.locator('section.sheet .nearby li').count();
    assert(n > 3, `trop peu de Monoprix : ${n}`);
    assert(/résultats/.test(await p.textContent('section.sheet .kind')), 'nombre de résultats absent');
    const pins = await p.evaluate(() => window.__map.getSource('cat-hits').serialize().data.features.length);
    assert(pins === n, `pastilles sur la carte (${pins}) ≠ lignes (${n})`);
    // les noms ne se posent pas sur les autres pastilles : couche à part, placée là où il y a de la place (retour du 21/10)
    assert(await p.evaluate(() => { const m = window.__map; return !!m.getLayer('cat-hit-label') && m.getLayoutProperty('cat-hit-label', 'text-variable-anchor')?.length === 4 && !m.getLayoutProperty('cat-hit', 'text-field'); }), 'noms des pastilles mal placés');
    assert(await p.$('.open-pills button:has-text("Ouvert maintenant")'), 'filtre « Ouvert maintenant » absent des résultats (décision du 21/10)');
    // toucher une ligne ouvre le lieu, la liste reste derrière
    await p.click('section.sheet .nearby li button >> nth=0'); await p.waitForSelector('.phead h1', { timeout: 10000 });
    assert(/Monoprix/i.test(await p.textContent('.phead h1')), 'mauvais lieu ouvert');
    // une zone ou une adresse : Entrée l'ouvre directement, comme avant
    await p.click('.sheet .close'); await p.waitForTimeout(400); await p.click('.sheet .close').catch(() => {});
    await p.fill('#search', '8e arrondissement'); await p.waitForTimeout(2500); await p.press('#search', 'Enter'); await p.waitForTimeout(1500);
    assert(!(await p.$('section.sheet .nearby li')), 'une zone a donné une liste de résultats');
    assert(!errors.length, errors.join(' | '));
    await ctx.close();
  },
  async 'ligne « Monoprix · Afficher les lieux » en tête des résultats, comme Google Maps (21/10)'() {
    const { p, ctx, errors } = await page({ geolocation: { latitude: 48.853, longitude: 2.333 } });
    await p.fill('#search', 'Monoprix'); await p.waitForSelector('.results li.brand', { timeout: 15000 });   // (« Monop » donne l'enseigne « Monop' », à juste titre)
    const row = await p.textContent('.results li.brand');
    assert(/Monoprix/i.test(row) && /Afficher les lieux/.test(row), `ligne enseigne : ${row}`);
    assert((await p.locator('.results li.opt').first().getAttribute('class')).includes('brand'), 'la ligne enseigne n’est pas en tête');
    await p.dispatchEvent('.results li.brand button', 'mousedown');
    await p.waitForSelector('section.sheet .nearby li', { timeout: 15000 }); await p.waitForTimeout(600);
    assert((await p.locator('section.sheet .nearby li').count()) > 3, 'liste des Monoprix trop courte');
    assert(/Monoprix/i.test(await p.inputValue('#search')), 'la barre ne montre pas le nom de l’enseigne');
    // un nom unique : pas de ligne enseigne
    await p.click('.sheet .close'); await p.waitForTimeout(300);
    await p.fill('#search', 'Café de Flore'); await p.waitForSelector('.results li.opt button', { timeout: 15000 }); await p.waitForTimeout(800);
    assert(!(await p.$('.results li.brand')), 'ligne enseigne pour un nom unique');
    assert(!errors.length, errors.join(' | '));
    await ctx.close();
  },
  async 'glisser vers le bas ferme les fenêtres : À propos, choix de la liste (21/10)'() {
    const { p, ctx, errors } = await page({ viewport: { width: 390, height: 844 } });
    // geste tactile simulé : vers le bas, rapide
    const swipe = (sel, dy) => p.evaluate(async ({ sel, dy }) => {
      const el = document.querySelector(sel), r = el.getBoundingClientRect(), x = r.left + r.width / 2, y0 = r.top + 30;
      const t = (y) => new Touch({ identifier: 1, target: el, clientX: x, clientY: y });
      el.dispatchEvent(new TouchEvent('touchstart', { touches: [t(y0)], changedTouches: [t(y0)], bubbles: true, cancelable: true }));
      for (let i = 1; i <= 6; i++) { el.dispatchEvent(new TouchEvent('touchmove', { touches: [t(y0 + (dy * i) / 6)], changedTouches: [t(y0 + (dy * i) / 6)], bubbles: true, cancelable: true })); await new Promise((r) => setTimeout(r, 16)); }
      el.dispatchEvent(new TouchEvent('touchend', { touches: [], changedTouches: [t(y0 + dy)], bubbles: true, cancelable: true }));
    }, { sel, dy });
    await p.click('.about-btn'); await p.waitForSelector('.dlg'); await p.waitForTimeout(300);
    assert(await p.$('.dlg-grip'), 'poignée absente de la fenêtre À propos');
    await swipe('.dlg', 40); await p.waitForTimeout(400);
    assert(await p.$('.dlg'), 'un petit glissement lent a fermé la fenêtre');
    await swipe('.dlg', 220); await p.waitForTimeout(500);
    assert(!(await p.$('.dlg')), 'glisser vers le bas ne ferme pas la fenêtre À propos');
    // choix de la liste d'un lieu : fiche-fenêtre, fermée d'un glissement
    await p.fill('#search', 'Panthéon'); await p.waitForSelector('.results li.opt button', { timeout: 15000 }); await pick(p);
    await p.waitForSelector('.phead h1', { timeout: 15000 }); await p.waitForTimeout(800);
    await p.click('.fab button >> nth=1'); await p.waitForSelector('section.sheet .new-list', { timeout: 5000 }); await p.waitForTimeout(500);
    await swipe('section.sheet', 260); await p.waitForTimeout(500);
    assert(!(await p.$('section.sheet .new-list')), 'glisser vers le bas ne ferme pas le choix de la liste');
    assert(!errors.length, errors.join(' | '));
    await ctx.close();
  },
  async 'barre de recherche : pas de liste « Mes lieux » à vide ; vos lieux en tête quand le texte leur correspond (21/10)'() {
    const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true, locale: 'fr-FR' });
    await ctx.addInitScript(() => {
      localStorage.setItem('promesse-vue', '1');
      localStorage.setItem('mes-listes', JSON.stringify([{ id: 'fav', name: 'Favoris', icon: 'heart', color: '#D63A7A' }, { id: 'lr', name: 'Restos', icon: 'star', color: '#2A5BD7' }]));
      localStorage.setItem('lieux-favoris', JSON.stringify([{ id: 'node1', name: 'Café de Flore', type: 'Café', address: '', lat: 48.85414, lon: 2.33263, lists: ['lr'] }]));
    });
    const p = await ctx.newPage(); const errors = []; p.on('pageerror', (e) => errors.push(e.message));
    await p.goto(`http://localhost:${PORT}/`); await p.waitForTimeout(2500);
    await p.click('#search'); await p.waitForTimeout(600);
    assert(!(await p.$('.results li.saved-hit')) && !/Café de Flore/.test(await p.textContent('.results')), 'lieux enregistrés listés à vide');
    await p.fill('#search', 'flore'); await p.waitForSelector('.results li.saved-hit', { timeout: 10000 }); await p.waitForTimeout(1500);
    const first = await p.textContent('.results li.opt >> nth=0');
    assert(/Café de Flore/.test(first) && /Dans Restos/.test(first), `votre lieu n'est pas en tête : ${first}`);
    assert((await p.locator('.results li.opt:has-text("Café de Flore")').count()) === 1, 'Café de Flore en double');
    await p.dispatchEvent('.results li.saved-hit button', 'mousedown'); await p.waitForSelector('.phead h1', { timeout: 10000 });
    assert(/Café de Flore/.test(await p.textContent('.phead h1')), 'fiche non ouverte');
    assert(!errors.length, errors.join(' | '));
    await ctx.close();
  },
  async 'invitation à installer : après un lieu enregistré, iPhone (deux gestes) et Android (fenêtre du téléphone) (21/10)'() {
    const fav = JSON.stringify([{ id: 'node1', name: 'Café de Flore', type: 'Café', address: '', lat: 48.85414, lon: 2.33263, lists: ['fav'] }]);
    // iPhone (Safari) : la carte, puis les deux gestes
    let ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true, locale: 'fr-FR',
      userAgent: 'Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.0 Mobile/15E148 Safari/604.1' });
    await ctx.addInitScript((f) => { localStorage.setItem('promesse-vue', '1'); if (!sessionStorage.getItem('vide')) localStorage.setItem('lieux-favoris', f); }, fav);
    let p = await ctx.newPage(); const errors = []; p.on('pageerror', (e) => errors.push(e.message));
    await p.goto(`http://localhost:${PORT}/`); await p.waitForSelector('.install', { timeout: 8000 });
    await p.click('.install .go'); await p.waitForSelector('.dlg .steps');
    assert(/Partager/.test(await p.textContent('.dlg')) && /Sur l.écran d.accueil/.test(await p.textContent('.dlg')), 'étapes iPhone absentes');
    assert(/sans vos lieux de Safari/.test(await p.textContent('.dlg')), 'avertissement sur les lieux de Safari absent');
    await p.keyboard.press('Escape'); await p.waitForTimeout(300);
    assert(!(await p.$('.install')), 'la carte reste après « Installer »');
    // ⓘ propose aussi l'installation
    await p.click('.about-btn'); await p.waitForSelector('.dlg');
    assert(/Installer l.app sur l.écran d.accueil/.test(await p.textContent('.dlg')), 'entrée « Installer » absente de ⓘ');
    await ctx.close();
    // « Plus tard » : la carte ne revient pas à l'ouverture suivante
    ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true, locale: 'fr-FR',
      userAgent: 'Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.0 Mobile/15E148 Safari/604.1' });
    await ctx.addInitScript((f) => { localStorage.setItem('promesse-vue', '1'); localStorage.setItem('lieux-favoris', f); }, fav);
    p = await ctx.newPage(); await p.goto(`http://localhost:${PORT}/`); await p.waitForSelector('.install', { timeout: 8000 });
    await p.click('.install .later'); await p.reload(); await p.waitForTimeout(2500);
    assert(!(await p.$('.install')), 'la carte revient malgré « Plus tard »');
    await ctx.close();
    // Android : le navigateur propose l'installation (événement simulé) ; « Installer » ouvre sa fenêtre
    ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true, locale: 'fr-FR' });
    await ctx.addInitScript((f) => { localStorage.setItem('promesse-vue', '1'); localStorage.setItem('lieux-favoris', f); }, fav);
    p = await ctx.newPage(); await p.goto(`http://localhost:${PORT}/`); await p.waitForTimeout(2500);
    assert(!(await p.$('.install')), 'carte affichée alors que le navigateur ne sait pas installer');
    await p.evaluate(() => { const e = new Event('beforeinstallprompt'); e.prompt = () => { window.__prompted = true; }; e.userChoice = Promise.resolve({ outcome: 'accepted' }); window.dispatchEvent(e); });
    await p.waitForSelector('.install', { timeout: 5000 }); await p.click('.install .go'); await p.waitForTimeout(500);
    assert(await p.evaluate(() => window.__prompted === true), 'la fenêtre d’installation du téléphone ne s’ouvre pas');
    assert(!errors.length, errors.join(' | '));
    await ctx.close();
  },
  async 'filtres des listes : terrasse sur les restaurants, seulement les filtres utiles, lieux sans information à part (21/10)'() {
    const { p, ctx, errors } = await page({ geolocation: { latitude: 48.853, longitude: 2.333 } });
    await p.click('.chip:has-text("Restaurants")'); await p.waitForTimeout(6000);
    const before = await p.locator('section.sheet .nearby li').count();
    await p.click('.open-pills button:has-text("Terrasse")'); await p.waitForTimeout(600);
    assert(/Terrasse/.test(await p.textContent('.open-pills button >> nth=0')), 'le filtre actif ne passe pas en tête');
    assert(/avec terrasse/.test(await p.textContent('section.sheet .kind')), 'nombre de lieux avec terrasse absent');
    assert(await p.$('.unknown-row'), 'lieux sans information non proposés');
    const after = await p.locator('section.sheet .nearby li').count();
    assert(after > 0 && after <= before, `liste filtrée : ${after} sur ${before}`);
    await p.click('.open-pills button.on:has-text("Terrasse")'); await p.waitForTimeout(400);
    assert(!(await p.$('.open-pills button.on')), 'filtre non retiré');
    // une recherche de banques : pas de filtre « Terrasse », et seulement des lieux portant ce nom
    await p.click('.sheet .close'); await p.waitForTimeout(300);
    await p.fill('#search', 'Société générale'); await p.waitForTimeout(1500); await p.press('#search', 'Enter');
    await p.waitForSelector('section.sheet .nearby li', { timeout: 15000 }); await p.waitForTimeout(800);
    const pills = await p.$$eval('.open-pills button', (e) => e.map((x) => x.textContent.trim()));
    assert(pills.includes('Ouvert maintenant') && !pills.includes('Terrasse'), `filtres proposés : ${pills}`);
    const names = await p.$$eval('section.sheet .nearby .r-name', (e) => e.map((x) => x.textContent));
    assert(names.every((n) => /soci[ée]t[ée] g[ée]n[ée]rale/i.test(n)), `résultat hors sujet : ${names.find((n) => !/g[ée]n[ée]rale/i.test(n))}`);
    assert(!errors.length, errors.join(' | '));
    await ctx.close();
  },
  async 'adresse via Géoplateforme'() {
    const { p, ctx } = await page();
    await p.fill('#search', '57 rue de rennes'); await p.waitForSelector('.results li.opt', { timeout: 30000 });
    const first = await p.$eval('.results li.opt', (e) => e.innerText);
    assert(/75006/.test(first), `première adresse hors Paris : ${first}`);
    await ctx.close();
  },
  async 'recherche « restaurant ce soir 8e »'() {
    const { p, ctx } = await page();
    await p.fill('#search', 'restaurant ce soir 8e'); await p.waitForTimeout(2500);
    assert(/8e arrondissement/.test(await p.$eval('.results li.opt', (e) => e.innerText)), 'suggestion sans le 8e');
    await pick(p); await p.waitForTimeout(6000);
    const kind = await p.$eval('.sheet .kind', (e) => e.textContent);
    assert(/ouverts? (ce soir|maintenant)/.test(kind), `filtre non appliqué : ${kind}`);
    assert((await p.locator('.nearby li').count()) > 3, 'liste vide');
    await ctx.close();
  },
  async 'catégorie : liste en aperçu, glisser ne la ferme pas'() {
    const { p, ctx } = await page();
    await p.click('.chip:has-text("Restaurants")'); await p.waitForTimeout(6000);
    const h = await p.$eval('.sheet', (e) => e.getBoundingClientRect().height);
    assert(h < 300, `la liste s'ouvre trop grande (${h}px) : attendu un aperçu`);
    assert((await p.locator('.chip.on').count()) === 1, 'catégorie non marquée active');
    await ctx.close();
  },
  async 'retirer un lieu d\'une liste depuis le menu « ⋯ » de sa fiche'() {
    const { p, ctx, errors } = await page();
    await p.click('.chip:has-text("Restaurants")'); await p.waitForTimeout(6000);
    await p.click('.nearby li button >> nth=0'); await p.waitForTimeout(3000);
    await p.click('.fab button >> nth=0'); await p.waitForTimeout(500);              // cœur : ajouté aux Favoris
    await p.click('.fab button >> nth=2');                                           // ⋯
    await p.click('.pmenu button:has-text("Enregistré dans")');
    await p.waitForSelector('.pick-lists'); await p.uncheck('.pick-lists li:has-text("Favoris") input'); await p.waitForTimeout(400);
    await p.click('.done'); await p.waitForTimeout(500);
    assert((await p.locator('.fab button.on').count()) === 0, 'toujours enregistré');
    assert(!errors.length, errors.join(' | '));
    await ctx.close();
  },
  async 'chercher « fleuriste » propose de l\'ajouter aux raccourcis'() {
    const { p, ctx, errors } = await page();
    assert((await p.locator('.chip:has-text("Fleuristes")').count()) === 0, 'déjà en raccourci');
    await p.fill('#search', 'fleuriste'); await p.waitForTimeout(1500); await p.press('#search', 'Enter');
    await p.waitForSelector('.add-chip', { timeout: 10000 }); await p.click('.add-chip'); await p.waitForTimeout(500);
    assert((await p.locator('.chip:has-text("Fleuristes")').count()) === 1, 'raccourci non ajouté');
    assert((await p.locator('.add-chip').count()) === 0, 'le bouton reste affiché');
    assert(!errors.length, errors.join(' | '));
    await ctx.close();
  },
  async 'aperçu d\'itinéraire : la fiche se réduit à une fine bande, puis remonte'() {
    const { p, ctx, errors } = await page();
    await p.click('.chip:has-text("Restaurants")'); await p.waitForTimeout(6000);
    await p.click('.nearby li button >> nth=0'); await p.waitForTimeout(3000);
    await p.click('.action.primary'); await p.waitForSelector('.route-sheet .mode-tabs', { timeout: 15000 }); await p.waitForTimeout(6000);
    // à l'aperçu, la suite (titre des étapes ou des autres trajets) dépasse sous « Aller », coupée exprès :
    // on comprend qu'il y a plus à voir (retour du porteur, 15/10)
    const cut = await p.$eval('.route-sheet', (s) => {
      const end = s.querySelector('[data-peek-end]'), next = end.nextElementSibling, b = s.getBoundingClientRect().bottom;
      return { next: next.getBoundingClientRect().top, nextEnd: next.getBoundingClientRect().bottom, b, after: s.scrollHeight > s.clientHeight + 30 };
    });
    assert(cut.next < cut.b - 12 && cut.after, `rien ne dépasse sous « Aller » : ${JSON.stringify(cut)}`);
    // glisser du doigt (événements tactiles réels) depuis la poignée
    const cdp = await ctx.newCDPSession(p);
    const swipe = async (y0, y1) => {
      const pt = (y) => [{ x: 195, y }];
      await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: pt(y0) });
      for (let k = 1; k <= 8; k++) { await cdp.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: pt(y0 + (y1 - y0) * k / 8) }); await p.waitForTimeout(40); }
      await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] }); await p.waitForTimeout(700);
    };
    const box = async () => p.$eval('.route-sheet', (e) => e.getBoundingClientRect());
    const top = (await box()).top;
    await swipe(top + 8, 840);
    const low = await box();
    assert(low.height < 120 && low.height > 40, `fiche pas réduite à une bande : ${Math.round(low.height)} px`);
    assert(await p.$eval('.route-sheet .mode-tabs', (e) => e.getBoundingClientRect().bottom <= 844), 'durées des modes cachées');
    await swipe(low.top + 8, low.top - 250);
    assert((await box()).height > low.height + 60, 'la fiche ne remonte pas');
    assert(!errors.length, errors.join(' | '));
    await ctx.close();
  },
  async 'liste : choisir son pictogramme et sa couleur'() {
    const { p, ctx, errors } = await page();
    await p.click('.chip:has-text("Restaurants")'); await p.waitForTimeout(6000);
    await p.click('.nearby li button >> nth=0'); await p.waitForTimeout(3000);
    await p.click('.fab button >> nth=0'); await p.waitForTimeout(500);
    await p.click('.close'); await p.waitForTimeout(500);
    await p.click('.chip:has-text("Mes lieux")'); await p.waitForTimeout(1200);
    await p.click('.hub-lists > li > button:has-text("Favoris")'); await p.waitForTimeout(1200);
    await p.click('.list-actions .link:has-text("Modifier")');
    await p.waitForSelector('.list-style');
    await p.click('.ls-btn >> nth=4'); await p.click('.ls-color >> nth=2'); await p.waitForTimeout(400);
    const l = await p.evaluate(() => JSON.parse(localStorage.getItem(Object.keys(localStorage).find((k) => /list/i.test(k) && localStorage.getItem(k).includes('Favoris')))).find((x) => x.id === 'fav'));
    assert(l.icon === 'cup' && l.color === '#2A5BD7', `style non enregistré : ${JSON.stringify(l)}`);
    assert(!errors.length, errors.join(' | '));
    await ctx.close();
  },
  async 'Mes lieux : favori, nouvelle liste, renommer, supprimer'() {
    const { p, ctx, errors } = await page();
    await p.fill('#search', "Ed's rue Muller"); await p.waitForSelector('.results li.opt button', { timeout: 20000 }); await pick(p); await p.waitForTimeout(3000);
    await p.click('.fab button >> nth=0');                       // cœur : ajouté aux Favoris
    await p.waitForSelector('.toast'); assert(/Favoris/.test(await p.textContent('.toast')), 'pas de confirmation du favori');
    await p.click('.close'); await p.waitForTimeout(500);
    await p.click('.chip:has-text("Mes lieux")'); await p.waitForTimeout(1200);
    await p.fill('.hub-lists .new-list input', 'Brunch'); await p.press('.hub-lists .new-list input', 'Enter'); await p.waitForTimeout(500);
    assert(await p.locator('.hub-lists li:has-text("Brunch")').count() === 1, 'liste non créée');
    assert(/1/.test(await p.textContent('.hub-lists li:has-text("Favoris") .pl-count')), 'favori absent de la liste');
    await p.click('.hub-lists li:has-text("Brunch") button'); await p.waitForTimeout(500);
    p.once('dialog', (d) => d.accept('Brunch du dimanche'));
    await p.click('.list-actions button:has-text("Renommer")'); await p.waitForTimeout(500);
    assert(/Brunch du dimanche/.test(await p.textContent('.list-title')), 'liste non renommée');
    p.once('dialog', (d) => d.accept());
    await p.click('.list-actions button:has-text("Supprimer")'); await p.waitForTimeout(800);
    assert(await p.locator('.hub-lists li:has-text("Brunch")').count() === 0, 'liste non supprimée');
    assert(!errors.length, errors.join(' | '));
    await ctx.close();
  },
  async 'raccourcis : 5 par défaut, bouton « + » visible sans faire défiler'() {
    const { p, ctx, errors } = await page();
    const chips = await p.$$eval('.chips .chip', (els) => els.map((e) => e.textContent.trim()));
    assert(chips.join('|') === 'Mes lieux|Restaurants|Cafés|Métro|Pharmacies', `raccourcis par défaut : ${chips.join(', ')}`);
    const b = await p.$eval('.chip.add', (e) => e.getBoundingClientRect());
    assert(b.right <= 390 && b.left >= 0 && b.width > 20, `bouton + hors de l'écran : ${JSON.stringify(b)}`);
    assert(!errors.length, errors.join(' | '));
    await ctx.close();
  },
  async 'Maison et raccourcis personnalisés'() {
    const { p, ctx, errors } = await page();
    await p.fill('#search', "Ed's rue Muller"); await p.waitForSelector('.results li.opt button', { timeout: 20000 }); await pick(p); await p.waitForTimeout(3000);
    await p.click('.fab button[aria-label="Plus d\'options"]');
    await p.click('.pmenu button:has-text("Définir comme Maison")'); await p.waitForTimeout(500);
    assert(/Maison enregistré/.test(await p.textContent('.toast')), 'Maison non enregistrée');
    await p.click('.close'); await p.waitForTimeout(500);
    await p.click('.chip.add'); await p.waitForTimeout(800);
    await p.click('.ce-toggle[aria-label="Afficher Cafés"]');
    await p.fill('input[aria-label="Nom du raccourci Restaurants"]', 'Restos'); await p.press('input[aria-label="Nom du raccourci Restaurants"]', 'Tab');
    await p.click('section[aria-label="Personnaliser les raccourcis"] .close'); await p.waitForTimeout(500);
    const chips = await p.$$eval('.chips .chip', (els) => els.map((e) => e.textContent.trim()));
    assert(chips.includes('Restos') && !chips.includes('Cafés'), `raccourcis non appliqués : ${chips.join(', ')}`);
    await p.reload({ waitUntil: 'networkidle' }); await p.waitForTimeout(2000);
    assert((await p.$$eval('.chips .chip', (els) => els.map((e) => e.textContent.trim()))).includes('Restos'), 'raccourcis non gardés après rechargement');
    await p.click('#search'); await p.waitForTimeout(800);
    assert(/Itinéraire/.test(await p.textContent('.pinned')), 'Maison absente des raccourcis de recherche');
    assert(!errors.length, errors.join(' | '));
    await ctx.close();
  },
  async 'sauvegarde puis restauration (avec mot de passe)'() {
    let { p, ctx } = await page();
    await p.evaluate(() => localStorage.setItem('lieux-favoris', JSON.stringify([{ id: 'node1', name: 'Lieu sauvegardé', lat: 48.85, lon: 2.34, lists: ['fav'] }])));
    await p.reload({ waitUntil: 'networkidle' }); await p.waitForTimeout(2000);
    await p.click('.chip:has-text("Mes lieux")'); await p.waitForTimeout(1000);
    await p.click('.row-btn:has-text("Sauvegarder")');
    await p.fill('label.pw input', 'secret');
    const [dl] = await Promise.all([p.waitForEvent('download'), p.click('button:has-text("Créer la sauvegarde")')]);
    const file = `/tmp/untracked-e2e-sauvegarde-${Date.now()}.json`;
    await dl.saveAs(file);
    assert(!readFileSync(file, 'utf8').includes('Lieu sauvegardé'), 'sauvegarde chiffrée lisible en clair');
    await ctx.close();
    ({ p, ctx } = await page());
    await p.click('.chip:has-text("Mes lieux")'); await p.waitForTimeout(1000);
    await p.click('.row-btn:has-text("Restaurer")');
    await p.setInputFiles('label.import-btn input[type=file]', file); await p.waitForTimeout(1500);
    await p.fill('label.pw input', 'faux'); await p.click('button:has-text("Restaurer")'); await p.waitForTimeout(2500);
    assert(/incorrect/.test(await p.textContent('.toast')), 'mauvais mot de passe non signalé');
    await p.fill('label.pw input', 'secret'); await p.click('button:has-text("Restaurer")'); await p.waitForTimeout(2500);
    assert(/1 lieu restauré/.test(await p.textContent('.toast')), 'restauration non confirmée');
    await ctx.close();
  },
  async 'import Google : listes sans position retrouvées par leur nom'() {
    const { p, ctx } = await page();
    await p.click('.chip:has-text("Mes lieux")'); await p.waitForTimeout(1000);
    await p.click('.row-btn:has-text("Importer depuis Google Maps")'); await p.waitForTimeout(600);
    assert(/Enregistré/.test(await p.textContent('.howto')), 'consigne : cocher « Enregistré » (les listes)');
    const file = `/tmp/untracked-e2e-Restos-${Date.now()}.csv`;
    writeFileSync(file, 'Title,Note,URL,Comment\nCafé de Flore,,https://www.google.com/maps/place/x/data=!4m2!3m1!1s0x1:0x2,\n');
    await p.setInputFiles('label.import-btn input[type=file]', file);
    await p.waitForSelector('.toast', { timeout: 15000 });
    assert(/1 lieu importé/.test(await p.textContent('.toast')), 'lieu de liste non importé : ' + await p.textContent('.toast'));
    const saved = await p.evaluate(() => localStorage.getItem('lieux-favoris') || '');
    assert(/Café de Flore/.test(saved) && /48\.85/.test(saved), 'position du lieu non retrouvée');
    await ctx.close();
  },
  async 'import Google de plusieurs listes : Mes lieux s’ouvre, et la fiche du lieu montre sa liste (bug Android du 20/10)'() {
    const { p, ctx, errors } = await page({ geolocation: { latitude: 48.853, longitude: 2.333 } });
    // archive Takeout avec trois listes, créées en même temps à l'import (avant : même identifiant → écran « 500 »)
    const zip = `/tmp/untracked-e2e-takeout-${Date.now()}.zip`;
    execFileSync('python3', ['-c', `import zipfile,sys
z=zipfile.ZipFile(sys.argv[1],'w',zipfile.ZIP_DEFLATED)
h='Title,Note,URL,Comment\\n'
z.writestr('Takeout/Enregistré/Restos.csv',h+'Café de Flore,,https://www.google.com/maps/place/x,\\n')
z.writestr('Takeout/Enregistré/Musées.csv',h+"Musée d'Orsay,,https://www.google.com/maps/place/y,\\n")
z.writestr('Takeout/Enregistré/Cafés.csv',h+'Les Deux Magots,,https://www.google.com/maps/place/z,\\n')
z.close()`, zip]);
    await p.click('.chip:has-text("Mes lieux")'); await p.waitForTimeout(1000);
    await p.click('.row-btn:has-text("Importer depuis Google Maps")'); await p.waitForTimeout(600);
    await p.setInputFiles('label.import-btn input[type=file]', zip);
    await p.waitForFunction(() => /import/i.test(document.querySelector('.toast')?.textContent || ''), null, { timeout: 90000 });
    const lists = await p.evaluate(() => JSON.parse(localStorage.getItem('mes-listes')));
    assert(new Set(lists.map((l) => l.id)).size === lists.length, 'deux listes au même identifiant');
    // Mes lieux s'ouvre et montre les listes importées
    if (!(await p.$('.chip.on:has-text("Mes lieux")'))) await p.click('.chip:has-text("Mes lieux")');
    await p.waitForTimeout(1200);
    const sheet = await p.textContent('section.sheet');
    assert(/Restos/.test(sheet) && /Musées/.test(sheet), 'listes importées absentes de Mes lieux : ' + sheet.slice(0, 200));
    // la fiche du lieu OSM indique la liste
    await p.click('.chip:has-text("Mes lieux")'); await p.waitForTimeout(400);
    await p.fill('#search', 'Café de Flore'); await p.waitForSelector('.results li.opt button', { timeout: 20000 }); await pick(p);
    await p.waitForSelector('.sheet h1', { timeout: 15000 }); await p.waitForTimeout(800);
    assert(/Restos/.test(await p.textContent('section.sheet')), 'la fiche du lieu ne montre pas sa liste « Restos »');
    assert(!errors.length, errors.join(' | '));
    await ctx.close();
  },
  async 'listes déjà abîmées (même identifiant) : Mes lieux s’ouvre quand même'() {
    const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true, locale: 'fr-FR' });
    await ctx.addInitScript(() => {
      localStorage.setItem('promesse-vue', '1');
      localStorage.setItem('mes-listes', JSON.stringify([{ id: 'fav', name: 'Favoris', icon: 'heart', color: '#D63A7A' }, { id: 'labc', name: 'Restos', icon: 'star', color: '#2A5BD7' }, { id: 'labc', name: 'Musées', icon: 'star', color: '#1E8E3E' }]));
      localStorage.setItem('lieux-favoris', JSON.stringify([{ id: 'g1', name: 'Café de Flore', type: 'x', address: '', lat: 48.8541, lon: 2.3326, lists: ['labc'] }]));
    });
    const p = await ctx.newPage(); const errors = []; p.on('pageerror', (e) => errors.push(e.message));
    await p.goto(`http://localhost:${PORT}/`); await p.waitForTimeout(2500);
    await p.click('.chip:has-text("Mes lieux")'); await p.waitForTimeout(1200);
    const sheet = await p.textContent('section.sheet');
    assert(/Restos/.test(sheet) && /Musées/.test(sheet), 'Mes lieux ne s’ouvre pas : ' + (await p.textContent('body')).slice(0, 100));
    assert(!errors.length, errors.join(' | '));
    await ctx.close();
  },
  async 'lien de liste partagée et lien de transfert'() {
    const lien = await packList({ name: 'Sorties', icon: 'star', color: '#2A5BD7' }, [{ name: 'Le Comptoir', lat: 48.8515, lon: 2.3387, osmType: 'node', osmId: 1 }]);
    let { p, ctx } = await page({}, `#liste=${lien}`);
    await p.waitForSelector('.list-title', { timeout: 8000 });
    assert(/Sorties/.test(await p.textContent('.list-title')) && /Liste partagée/.test(await p.textContent('.sheet .kind')), 'liste partagée non affichée');
    await p.click('button:has-text("Ajouter à Mes lieux")'); await p.waitForTimeout(800);
    assert(/Sorties/.test(await p.evaluate(() => localStorage.getItem('mes-listes') || '')), 'liste non enregistrée');
    await ctx.close();
    const t = await pack(snapshot({ lists: DEFAULT_LISTS, places: [{ name: 'Chez moi', lat: 48.86, lon: 2.35, lists: ['fav'] }], shortcuts: { home: { name: 'Chez moi', lat: 48.86, lon: 2.35 } } }));
    ({ p, ctx } = await page({}, `#transfert=${t}`));
    await p.waitForSelector('section[aria-label="Récupérer vos lieux"]', { timeout: 8000 });
    assert(/Maison/.test(await p.textContent('section[aria-label="Récupérer vos lieux"]')), 'Maison absente du transfert');
    await ctx.close();
    ({ p, ctx } = await page({}, '#liste=lien-abime'));
    await p.waitForSelector('.toast', { timeout: 8000 });
    assert(/incomplet/.test(await p.textContent('.toast')), 'lien abîmé non signalé');
    await ctx.close();
  },
  async 'station de métro : prochains passages et sorties'() {
    const { p, ctx } = await page();
    await p.fill('#search', 'Odéon métro'); await p.waitForSelector('.results li.opt button', { timeout: 20000 });
    await p.dispatchEvent('.results li.opt:has-text("Station") button >> nth=0', 'mousedown').catch(() => pick(p));
    await p.waitForTimeout(6000);
    const txt = await p.$eval('section.sheet', (e) => e.innerText);
    assert(/Sorties/.test(txt), 'sorties absentes');
    assert((await p.locator('.deps li').count()) > 0 || /passage/i.test(txt), 'prochains passages absents');
    await ctx.close();
  },
  async 'mode proposé par défaut : transports si c’est loin, puis le dernier mode choisi'() {
    const { p, ctx, errors } = await page({ geolocation: { latitude: 48.8867, longitude: 2.3431 } });
    await p.fill('#search', 'Panthéon'); await p.waitForSelector('.results li.opt button', { timeout: 20000 }); await pick(p); await p.waitForTimeout(2500);
    // 4 km : plus de « 50 min à pied » sur le bouton, mais les transports
    assert(/en transports/.test(await p.getAttribute('.action.primary', 'aria-label')), 'transports non proposés pour un lieu lointain');
    await p.click('.action.primary'); await p.waitForTimeout(1500);
    assert(await p.$('.mode-tab.on[aria-label="Transports"]'), 'onglet transports non choisi');
    await p.click('.mode-tab[aria-label="Vélo"]'); await p.waitForTimeout(500);
    await p.click('.top .back'); await p.waitForTimeout(800);
    assert(/à vélo/.test(await p.getAttribute('.action.primary', 'aria-label')), 'le dernier mode choisi (vélo) n’est pas repris');
    assert(!errors.length, errors.join(' | '));
    await ctx.close();
  },
  async 'nouvelle version en ligne : un bandeau propose de mettre à jour'() {
    const { p, ctx, errors } = await page();
    assert(!(await p.$('.update')), 'bandeau affiché sans nouvelle version');
    // le site annonce une autre version que celle chargée → bandeau ; « Mettre à jour » recharge la page
    await p.route('**/_app/version.json', (r) => r.fulfill({ contentType: 'application/json', body: '{"version":"autre"}' }));
    await p.evaluate(() => window.dispatchEvent(new Event('focus')));
    await p.waitForSelector('.update', { timeout: 8000 });
    assert(/Nouvelle version/.test(await p.textContent('.update')), 'texte du bandeau');
    await Promise.all([p.waitForEvent('load'), p.click('.update button')]);
    assert(!errors.length, errors.join(' | '));
    await ctx.close();
  },
  async 'carte vélo : type de carte « Vélo », légende, et affichée pendant un itinéraire à vélo'() {
    const { p, ctx, errors } = await page({ geolocation: { latitude: 48.8867, longitude: 2.3431 } });
    // pistes du fond de carte, ou réseau complet (data/bikes.geojson, publié chaque nuit) quand il est là
    const vis = () => p.evaluate(() => ['bike-track', 'bikes-track'].some((id) => window.__map.getLayoutProperty(id, 'visibility') === 'visible') ? 'visible' : 'none');
    assert((await vis()) === 'none', 'carte vélo visible par défaut');
    await p.click('button[aria-label="Type de carte"]'); await p.click('.modes-pop button:has-text("Vélo")'); await p.waitForTimeout(500);
    assert((await vis()) === 'visible', 'pistes non affichées');
    await p.waitForSelector('.bike-legend');
    // menu en grille 2 × 2 : Plan et Transports sur la 1re ligne, Satellite et Vélo sur la 2e
    await p.click('button[aria-label="Type de carte"]'); await p.waitForSelector('.modes-grid');
    const ys = await p.$$eval('.modes-grid > button', (b) => b.map((x) => Math.round(x.getBoundingClientRect().top)));
    assert(ys.length === 4 && ys[0] === ys[1] && ys[2] === ys[3] && ys[2] > ys[0], `grille 2 × 2 attendue : ${ys}`);
    await p.keyboard.press('Escape'); await p.waitForTimeout(300);
    await p.click('.bike-legend .more'); await p.waitForSelector('.dlg');
    assert(/bandes peintes/i.test(await p.textContent('.dlg')), 'explication des bandes absente');
    await p.keyboard.press('Escape'); await p.waitForTimeout(300);
    // légende repliable en pastille, et le choix est retenu
    await p.click('.bike-legend .fold'); await p.waitForSelector('.bike-legend.pill');
    assert(await p.evaluate(() => localStorage.getItem('legende-velo') === 'repliee'), 'repli non retenu');
    await p.click('.bike-legend.pill'); await p.waitForSelector('.bike-legend .fold');
    await p.click('button[aria-label="Type de carte"]'); await p.click('.modes-pop button:has-text("Plan")'); await p.waitForTimeout(400);
    assert((await vis()) === 'none' && !(await p.$('.bike-legend')), 'carte vélo encore affichée en mode Plan');
    // itinéraire : choisir le vélo affiche les pistes ; fermer l'itinéraire les retire
    await p.fill('#search', 'Panthéon'); await p.waitForSelector('.results li.opt button', { timeout: 20000 }); await pick(p); await p.waitForTimeout(2500);
    await p.click('.action.primary'); await p.waitForTimeout(1500);
    await p.click('.mode-tab[aria-label="Vélo"]'); await p.waitForTimeout(800);
    assert((await vis()) === 'visible', 'pistes absentes pendant un itinéraire à vélo');
    await p.click('.top .back'); await p.waitForTimeout(600);
    assert((await vis()) === 'none', 'pistes encore affichées après l’itinéraire');
    assert(!errors.length, errors.join(' | '));
    await ctx.close();
  },
  async 'carte vélo hors Île-de-France (Lyon) : les pistes du fond de carte, pas une carte vide'() {
    const { p, ctx, errors } = await page({ geolocation: { latitude: 45.76, longitude: 4.835 } }, '#carte=14/45.76/4.835');
    await p.click('button[aria-label="Type de carte"]'); await p.click('.modes-pop button:has-text("Vélo")'); await p.waitForTimeout(1500);
    assert((await p.evaluate(() => window.__map.getLayoutProperty('bike-track', 'visibility'))) === 'visible', 'aucune piste affichée à Lyon');
    assert(!errors.length, errors.join(' | '));
    await ctx.close();
  },
  async 'carte Transports : lignes chargées à la demande, RER jusqu’en banlieue'() {
    const { p, ctx, errors } = await page({}, '#carte=11/48.85/2.35');
    const got = [];
    p.on('request', (r) => { if (r.url().includes('transit-lines')) got.push(r.url()); });
    await p.waitForTimeout(1000);
    assert(!got.length, 'lignes chargées dès l’ouverture (ralentit le démarrage)');
    await p.click('button[aria-label="Type de carte"]'); await p.click('.modes-pop button:has-text("Transports")'); await p.waitForTimeout(2500);
    assert(got.length === 1, 'lignes non chargées en carte Transports');
    // les lignes vont au-delà de Paris (RER A jusqu'à Marne-la-Vallée)
    const east = await p.evaluate(async () => Math.max(...(await window.__map.getSource('transit').getData()).features
      .flatMap((f) => (f.geometry.type === 'LineString' ? f.geometry.coordinates : f.geometry.coordinates.flat())).map((c) => c[0])));
    assert(east > 2.7, `lignes limitées à Paris (est : ${east})`);
    // le Transilien est dessiné (H à V), en plus du métro, du RER et du tram (porteur, 23/10)
    const trains = await p.evaluate(async () => [...new Set((await window.__map.getSource('transit').getData()).features
      .filter((f) => f.properties.mode === 'train').map((f) => f.properties.ref))].sort().join(''));
    assert(trains.includes('HJKLNPRU'), `Transilien manquant (${trains})`);
    assert(!errors.length, errors.join(' | '));
    await ctx.close();
  },
  async 'guidage à pied : démarrer puis terminer'() {
    const { p, ctx, errors } = await page({ geolocation: { latitude: 48.853, longitude: 2.34 } });
    await p.fill('#search', 'Panthéon'); await p.waitForSelector('.results li.opt button', { timeout: 20000 }); await pick(p); await p.waitForTimeout(2500);
    await p.click('.action.primary'); await p.waitForTimeout(6000);
    await p.click('.mode-tabs .mode-tab >> nth=0'); await p.waitForTimeout(3000);
    // départ = votre position : pas de gros point de départ, la flèche de position suffit (porteur, 21/10)
    assert(!(await p.evaluate(() => window.__map.getSource('route-ends').serialize().data.features.some((f) => f.properties.kind === 'from'))), 'point de départ affiché alors que le départ est votre position');
    // on bouge de ~120 m avant de partir : l'itinéraire repart de la nouvelle position, sans « Calcul… »
    await ctx.setGeolocation({ latitude: 48.854, longitude: 2.3405 }); await p.waitForTimeout(6000);
    const start = await p.evaluate(() => window.__map.getSource('route').serialize().data.features.at(-1).geometry.coordinates[0]);
    assert(Math.hypot(start[0] - 2.3405, (start[1] - 48.854) * 1.5) < 0.0008, `l'itinéraire ne suit pas la position : ${start}`);
    await p.click('.sum-actions .go'); await p.waitForSelector('.nav-top', { timeout: 8000 }); await p.waitForTimeout(1500);
    // pendant le guidage : plus de point de départ, ni de rond bleu ; on avance → le tronçon fait disparaît du tracé
    const ends = () => p.evaluate(() => window.__map.getSource('route-ends').serialize().data.features.length);
    assert((await ends()) === 0, 'point de départ encore affiché pendant le guidage');
    assert(!(await p.$eval('.me .me-dot', (e) => e.offsetParent !== null || getComputedStyle(e).display !== 'none').catch(() => false)), 'rond bleu encore visible');
    const coords = (await p.evaluate(() => window.__nav())).coords;
    const mid = coords[Math.floor(coords.length / 2)];
    await ctx.setGeolocation({ latitude: mid[1], longitude: mid[0] }); await p.waitForTimeout(4000);
    const first = await p.evaluate(() => window.__map.getSource('route').serialize().data.features[0].geometry.coordinates[0]);
    assert(Math.hypot(first[0] - mid[0], first[1] - mid[1]) < 0.0005, `le tracé ne commence pas à la position : ${first} / ${mid}`);
    // « Puis » est collé sous le panneau ; « Terminer » est dans la barre du bas remontée (comme Plans)
    assert(await p.$('.nav-top .nav-then'), '« Puis » absent du panneau');
    assert(!(await p.$('.nav-end')), '« Terminer » visible sans remonter la barre');
    await p.click('.nav-stats'); await p.waitForSelector('.nav-end');
    await p.click('.nav-end'); await p.waitForTimeout(800);
    assert((await p.locator('.nav-top').count()) === 0, 'guidage non terminé');
    assert(!errors.length, errors.join(' | '));
    await ctx.close();
  },
  async 'guidage sans localisation : on passe les étapes à la main'() {
    const { p, ctx, errors } = await page({ permissions: [], geolocation: undefined });
    await p.click('.chip:has-text("Restaurants")'); await p.waitForTimeout(6000);
    await p.click('.nearby li button >> nth=0'); await p.waitForTimeout(3000);
    await p.click('.action.primary'); await p.waitForTimeout(2000);
    // pas de position : on choisit le départ à la main
    if (!(await p.$('#field-from'))) await p.click('.field-btn >> nth=0');
    await p.fill('#field-from', '57 rue de rennes'); await p.waitForSelector('.results li.opt:has-text("Rennes") button', { timeout: 30000 });
    await p.dispatchEvent('.results li.opt:has-text("Rennes") button >> nth=0', 'mousedown'); await p.waitForTimeout(6000);
    await p.click('.mode-tabs .mode-tab >> nth=0'); await p.waitForTimeout(4000);
    await p.click('.sum-actions .go'); await p.waitForSelector('.nav-manual', { timeout: 8000 });
    const before = await p.$eval('.nav-text', (e) => e.textContent);
    await p.click('.nav-manual button[aria-label="Étape suivante"]'); await p.waitForTimeout(900);
    const after = await p.$eval('.nav-text', (e) => e.textContent);
    assert(before !== after, `l'étape ne change pas : ${before}`);
    await p.click('.nav-manual button[aria-label="Étape précédente"]'); await p.waitForTimeout(900);
    assert((await p.$eval('.nav-text', (e) => e.textContent)) === before, 'retour à l\'étape précédente impossible');
    await p.click('.nav-stats'); await p.click('.nav-end');
    assert(!errors.length, errors.join(' | '));
    await ctx.close();
  },
  async 'page « Qui voit quoi » : on peut la faire défiler'() {
    const { p, ctx } = await page();
    await p.evaluate(() => { const a = document.createElement('a'); a.href = 'confidentialite'; a.id = 'qvq'; document.body.appendChild(a); a.click(); });
    await p.waitForSelector('.scroller'); await p.mouse.move(200, 400); await p.mouse.wheel(0, 1200); await p.waitForTimeout(600);
    assert((await p.$eval('.scroller', (e) => e.scrollTop)) > 300, 'la page ne défile pas');
    await ctx.close();
  },
  async 'transports : sortie conseillée et trajet à pied recalculé'() {
    const { p, ctx } = await page({ geolocation: { latitude: 48.8867, longitude: 2.3431 } });
    let valhalla = 0; p.on('request', (r) => { if (r.url().includes('valhalla')) valhalla++; });
    await p.fill('#search', 'Panthéon'); await p.waitForTimeout(3500); await pick(p); await p.waitForTimeout(2500);
    await p.click('.action.primary'); await p.waitForTimeout(2000);
    await p.click('.mode-tabs .mode-tab >> nth=2'); await p.waitForSelector('.t-opt', { timeout: 25000 });
    // la liste des propositions, puis le détail d'une proposition : une carte par étape (retour Citymapper, 21/10)
    await p.click('.t-opt >> nth=0'); await p.waitForSelector('.cards .card.ride', { timeout: 5000 }); await p.waitForTimeout(8000);
    // si une sortie est conseillée (métro ou RER), le trajet à pied qui suit a été recalculé depuis cette sortie
    // (la place dans la rame n'existe que là où la RATP la publie : pas d'assertion, la sortie peut venir seule)
    if (await p.locator('.card.off .sub:has-text("Meilleure sortie")').count()) assert(valhalla >= 4, `trajet à pied depuis la sortie non recalculé (${valhalla} appels Valhalla)`);
    // la rame dessinée, nommée pour les lecteurs d'écran
    if (await p.locator('.card .rame').count()) assert(/voiture \d+ sur \d+/.test(await p.getAttribute('.card .rame >> nth=0', 'aria-label')), 'rame sans nom');
    // les arrêts se déplient
    await p.click('.card.ride .more >> nth=0');
    assert((await p.locator('.card.ride .stops li').count()) >= 2, 'arrêts de la ligne non dépliés');
    // toucher une étape : elle est cadrée sur la carte, les autres bouts s'estompent ; retoucher : tout le trajet
    await p.click('.card.ride .head >> nth=0'); await p.waitForTimeout(400);
    assert(await p.$('.card.ride.sel'), 'étape touchée non mise en avant');
    // comme Citymapper : la fiche se réduit à une fine bande pour laisser voir l'étape sur la carte
    assert((await p.getAttribute('.route-sheet', 'data-snap')) === 'min', 'la fiche ne se réduit pas');
    const dims = () => p.evaluate(async () => (await window.__map.getSource('route').getData()).features.filter((f) => f.properties.dim).length);
    assert((await dims()) > 0, 'les autres étapes ne s\'estompent pas');
    // toucher ailleurs sur la carte : retour au trajet entier
    const empty = await p.evaluate(() => {
      const m = window.__map;
      for (let y = 250; y < 600; y += 25) for (let x = 20; x < 370; x += 25) {
        if (!m.queryRenderedFeatures([[x - 14, y - 14], [x + 14, y + 14]], { layers: ['route-line', 'route-walk'] }).length) return [x, y];
      }
    });
    await p.mouse.click(empty[0], empty[1]); await p.waitForTimeout(400);
    assert((await dims()) === 0 && !(await p.$('.card.sel')), 'toucher la carte ne revient pas au trajet entier');
    await p.click('.route-sheet .grip'); await p.waitForTimeout(500);
    // retour à la liste des propositions
    await p.click('.t-head .back'); await p.waitForSelector('.t-opt', { timeout: 3000 });
    await ctx.close();
  },
  async 'transports : prix du trajet et choix des modes (« Bus et tram » seulement)'() {
    const { p, ctx, errors } = await page({ geolocation: { latitude: 48.8867, longitude: 2.3431 } });
    await p.fill('#search', '57 rue de rennes'); await p.waitForSelector('.results li.opt button', { timeout: 30000 }); await pick(p); await p.waitForTimeout(2500);
    await p.click('.action.primary'); await p.waitForTimeout(2000);
    await p.click('.mode-tabs .mode-tab >> nth=2'); await p.waitForSelector('.t-opt', { timeout: 25000 });
    assert(/\d,\d\d €/.test(await p.$eval('.t-opt', (e) => e.innerText)), 'prix absent de la proposition');
    // départs comme Citymapper : « dans 1, 4, 7 min de Station » (minutes avant de partir), ou l'heure du train
    assert(/dans [\d, ]+ min de |\d\d:\d\d.* de /.test(await p.$eval('.t-opt .depart', (e) => e.innerText)), 'départs absents de la proposition');
    // « pas de métro, pas de RER » (P5 : liste excluante) : il reste bus et tram
    await p.click('.t-pref:has-text("Métro")'); await p.waitForTimeout(400); await p.click('.t-pref:has-text("RER")'); await p.waitForTimeout(1000);
    await p.waitForSelector('.t-opt', { timeout: 25000 }); await p.waitForTimeout(1500);
    const metas = await p.$$eval('.t-opts .chain .badge', (els) => els.map((e) => e.getAttribute('aria-label') || ''));
    assert(metas.length && metas.every((m) => /Bus|Tram/.test(m)), `autre mode que bus ou tram : ${metas.join(' | ')}`);
    assert(!errors.length, errors.join(' | '));
    await ctx.close();
  },
  async 'transports : arriver demain à 9 h (heure de départ choisie)'() {
    const { p, ctx, errors } = await page({ geolocation: { latitude: 48.8867, longitude: 2.3431 } });
    await p.fill('#search', '57 rue de rennes'); await p.waitForSelector('.results li.opt button', { timeout: 30000 }); await pick(p); await p.waitForTimeout(2500);
    await p.click('.action.primary'); await p.waitForTimeout(2000);
    await p.click('.mode-tabs .mode-tab >> nth=2'); await p.waitForSelector('.t-opt', { timeout: 25000 });
    assert(/Partir maintenant/.test(await p.textContent('.when-btn')), 'bouton « Partir maintenant » absent');
    await p.click('.when-btn'); await p.click('.seg-btn:has-text("Arriver à")');
    // « demain » selon l'heure du téléphone simulé (le fuseau du navigateur peut différer de celui de la machine)
    const day = await p.evaluate(() => { const d = new Date(Date.now() + 864e5); const pad = (n) => String(n).padStart(2, '0'); return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`; });
    await p.fill('.when-field input', `${day}T09:00`);
    await p.click('.when-ok');
    assert(/Arrivée demain à 09:00/.test(await p.textContent('.when-btn')), 'heure choisie non affichée : ' + await p.textContent('.when-btn'));
    await p.waitForSelector('.t-opt', { timeout: 25000 }); await p.waitForTimeout(1000);
    const opt = await p.$eval('.t-opt', (e) => e.innerText);
    assert(/Départ \d\d:\d\d/.test(opt), `« Départ HH:MM » absent (comme Citymapper) : ${opt}`);
    await p.click('.t-opt >> nth=0'); await p.waitForSelector('.t-head');
    const sum = await p.$eval('.t-head', (e) => e.innerText);
    const arr = /→ (\d\d):(\d\d)/.exec(sum);
    assert(arr && +arr[1] * 60 + +arr[2] <= 9 * 60 && +arr[1] >= 7, `arrivée hors de 7 h – 9 h : ${sum}`);
    await p.click('.mode-tabs .mode-tab >> nth=0'); await p.waitForTimeout(1500);
    assert(/Départ \d\d:\d\d/.test(await p.$eval('.route-sheet .sum', (e) => e.innerText)), 'heure de départ à pied absente');
    assert(!errors.length, errors.join(' | '));
    await ctx.close();
  },
  async 'petits retours P5-P7 : position refusée expliquée, menu ⋯ refermé en touchant ailleurs, signet des listes'() {
    // position refusée au démarrage (P6, P7) : un message, une seule fois
    let { p, ctx } = await page({ permissions: [] });
    await p.waitForTimeout(1500);
    assert(/Localisation refusée/.test(await p.textContent('.toast').catch(() => '')), 'refus de position non expliqué');
    await p.reload({ waitUntil: 'networkidle' }); await p.waitForTimeout(2500);
    assert(!/Localisation refusée/.test(await p.textContent('.toast', { timeout: 500 }).catch(() => '')), 'message répété à chaque ouverture');
    await ctx.close();
    ({ p, ctx } = await page());
    await p.fill('#search', 'Panthéon'); await p.waitForSelector('.results li.opt button', { timeout: 15000 }); await pick(p);
    await p.waitForSelector('.fab', { timeout: 10000 });
    assert(await p.$('.fab button[aria-label="Ajouter à une liste"] svg path[d^="M7.5 4h9"]'), 'icône signet absente');
    await p.click('.fab button[aria-label="Plus d\'options"]'); await p.waitForSelector('.pmenu');
    await p.mouse.click(195, 200); await p.waitForTimeout(400);
    assert(!(await p.$('.pmenu')), 'le menu ⋯ reste ouvert après un toucher ailleurs');
    await ctx.close();
  },
  async 'recherche « restaurant végétarien 11e » : seulement des lieux végétariens, dans le 11e (P6, P7)'() {
    const { p, ctx, errors } = await page();
    await p.fill('#search', 'restaurant ouvert demain dans le 8e'); await p.waitForTimeout(3000);
    assert(!/Aucun résultat/.test(await p.textContent('.results')), '« Aucun résultat » sous une catégorie trouvée');
    await p.fill('#search', 'restaurant végétarien 11e'); await p.waitForTimeout(2500);
    const first = await p.$eval('.results li', (e) => e.innerText);
    assert(/Restaurants végétariens/.test(first) && /11e/.test(first), `ligne de catégorie : ${first}`);
    await p.dispatchEvent('.results li button >> nth=0', 'mousedown'); await p.waitForTimeout(5000);
    const names = await p.$$eval('.nearby .r-name', (els) => els.map((e) => e.textContent));
    assert(names.length >= 3, `trop peu de lieux : ${names.join(', ')}`);
    assert(!errors.length, errors.join(' | '));
    await ctx.close();
  },
  async 'itinéraire sans bouton dédié : chercher la destination, puis « Itinéraire » sur sa fiche (comme Citymapper)'() {
    const { p, ctx, errors } = await page({ geolocation: { latitude: 48.8867, longitude: 2.3431 } });
    assert(!(await p.$('.route-btn')), 'bouton itinéraire encore dans la barre');
    await p.fill('#search', 'Panthéon'); await p.waitForSelector('.results li.opt button', { timeout: 15000 }); await pick(p);
    await p.waitForSelector('.action.primary', { timeout: 15000 }); await p.click('.action.primary');
    await p.waitForSelector('.route-sheet .mode-tabs', { timeout: 15000 });
    const card = await p.textContent('.dir-card');
    assert(/position/i.test(card) && /Panthéon/.test(card), `départ ou arrivée absents : ${card}`);
    assert(!errors.length, errors.join(' | '));
    await ctx.close();
  },
  async 'première ouverture : promesse et preuve une seule fois ; ⓘ ouvre « À propos » ; mention OSM repliée après 5 s'() {
    const ctx = await browser.newContext({ viewport: { width: 375, height: 667 }, isMobile: true, hasTouch: true, locale: 'fr-FR' });
    const p = await ctx.newPage(); const errors = []; p.on('pageerror', (e) => errors.push(e.message));
    await p.goto(`http://localhost:${PORT}/`); await p.waitForSelector('.promise', { timeout: 10000 });
    const txt = await p.textContent('.promise');
    assert(/0 traceur/.test(txt) && /0 cookie/.test(txt) && /Pour en savoir plus/.test(txt), `bandeau incomplet : ${txt}`);
    // rien de caché sous le bandeau : il est au-dessus des trois boutons ronds
    const [ban, btn] = await Promise.all(['.promise', '.modes-ctl'].map((s) => p.$eval(s, (e) => e.getBoundingClientRect().toJSON())));
    assert(ban.bottom <= btn.top, `le bandeau recouvre les boutons : ${ban.bottom} > ${btn.top}`);
    assert(await p.isVisible('.credit'), 'mention © OpenStreetMap absente au démarrage');
    await p.tap('.promise .info'); await p.waitForSelector('.dlg');
    assert(/Untracked Maps/.test(await p.textContent('.dlg')), 'fenêtre À propos non ouverte');
    // conditions de FOSSGIS (serveur d'itinéraires) : e-mail de l'éditeur visible, lien « fixthemap »
    assert(await p.$('.dlg a[href="mailto:contact@untrackedmaps.app"]'), 'e-mail de contact absent');
    assert(await p.$('.dlg a[href="https://www.openstreetmap.org/fixthemap"]'), 'lien fixthemap absent');
    await p.keyboard.press('Escape'); await p.waitForTimeout(300);
    assert(!(await p.$('.dlg')) && !(await p.$('.promise')), 'fenêtre ou bandeau restés ouverts');
    await p.reload(); await p.waitForTimeout(2500);
    assert(!(await p.$('.promise')), 'bandeau réaffiché à la deuxième ouverture');
    assert(!(await p.$('.privacy-line')), 'ancienne ligne « 0 traceur » encore sous la recherche');
    assert(await p.isVisible('.credit'), 'mention © OpenStreetMap absente à la deuxième ouverture');
    await p.waitForTimeout(5500);
    assert(!(await p.$('.credit')), 'mention OSM pas repliée après 5 s');
    // les trois boutons ronds ont la même taille
    const sizes = await p.$$eval('.modes-ctl .round-btn, .locate, .about-btn', (els) => els.map((e) => `${e.offsetWidth}x${e.offsetHeight}`));
    assert(new Set(sizes).size === 1, `tailles différentes : ${sizes}`);
    assert(!errors.length, errors.join(' | '));
    await ctx.close();
  },
  async 'exemples touchables seulement tant qu’on n’a rien cherché, sans titre « Essayez »'() {
    const { p, ctx, errors } = await page();
    await p.click('#search'); await p.waitForSelector('.results li.example', { timeout: 5000 });
    assert(!/Essayez/.test(await p.textContent('.results')), 'titre « Essayez » encore là');
    await p.fill('#search', 'Panthéon'); await p.waitForSelector('.results li.opt button', { timeout: 15000 }); await pick(p);
    await p.waitForSelector('.sheet h1', { timeout: 15000 }); await p.click('.sheet .close'); await p.waitForTimeout(500);
    await p.click('#search'); await p.waitForTimeout(500);
    assert((await p.locator('.results li.example').count()) === 0, 'exemples encore affichés après une recherche');
    assert(/Panthéon/.test(await p.textContent('.results')), 'recherche récente absente');
    assert(!errors.length, errors.join(' | '));
    await ctx.close();
  },
  async 'vue satellite (IGN) et thème au choix, retenu sur l’appareil (P5, P6)'() {
    const { p, ctx, errors } = await page();
    await p.click('button[aria-label="Type de carte"]'); await p.click('.modes-pop button:has-text("Satellite")'); await p.waitForTimeout(1500);
    assert(await p.evaluate(() => !!window.__map.getLayer('satellite')), 'couche satellite absente');
    await p.click('button[aria-label="Type de carte"]'); await p.click('.modes-pop button:has-text("Plan")'); await p.waitForTimeout(500);
    assert(await p.evaluate(() => !window.__map.getLayer('satellite')), 'couche satellite restée après retour au plan');
    await p.click('button[aria-label="Type de carte"]'); await p.click('.theme button:has-text("Sombre")'); await p.waitForTimeout(1500);
    await p.reload({ waitUntil: 'networkidle' }); await p.waitForTimeout(2000);
    assert(await p.evaluate(() => document.documentElement.dataset.theme === 'dark' && getComputedStyle(document.documentElement).getPropertyValue('--card').trim() === '#1c1f24'), 'thème sombre non retenu');
    assert(!errors.length, errors.join(' | '));
    await ctx.close();
  },
  async 'sorties de la station sur la carte (P5)'() {
    const { p, ctx, errors } = await page();
    await p.click('.chip:has-text("Métro")'); await p.waitForTimeout(4000);
    await p.click('.nearby li button >> nth=0'); await p.waitForSelector('.exits', { timeout: 15000 });
    const n = await p.evaluate(() => window.__map.getSource('exits')?.serialize()?.data?.features?.length || 0);
    assert(n > 0, 'aucune sortie dessinée sur la carte');
    await p.click('.sheet .close'); await p.waitForTimeout(800);
    assert(await p.evaluate(() => (window.__map.getSource('exits')?.serialize()?.data?.features?.length || 0) === 0), 'sorties restées après fermeture');
    assert(!errors.length, errors.join(' | '));
    await ctx.close();
  },
  async 'règles d’interface : menus entiers à l’écran, un seul ouvert, fermés en touchant ailleurs ou par Échap'() {
    // docs/regles-interface.md — vérifié sur chaque menu de l'app ; un nouveau menu doit être ajouté ici
    const { p, ctx, errors } = await page({ viewport: { width: 375, height: 667 } });   // petit écran : le cas le plus dur
    const visibleWhole = (sel) => p.$eval(sel, (el) => {
      const r = el.getBoundingClientRect();
      if (r.top < 0 || r.left < 0 || r.bottom > innerHeight || r.right > innerWidth) return `hors écran ${JSON.stringify(r)}`;
      // (10 px à l'intérieur des coins : les fenêtres ont des coins arrondis)
      for (const [x, y] of [[r.left + 10, r.top + 10], [r.right - 10, r.top + 10], [r.left + 10, r.bottom - 10], [r.right - 10, r.bottom - 10]]) {
        const hit = document.elementFromPoint(x, y);
        if (!hit || !el.contains(hit)) return `masqué en ${Math.round(x)},${Math.round(y)} par ${hit?.className || hit?.tagName}`;
      }
      return 'ok';
    });
    // 1. menu « ⋯ » d'une fiche, fiche à mi-hauteur (bug du 16/10 : première ligne rognée par la fiche)
    await p.fill('#search', 'Panthéon'); await p.waitForSelector('.results li.opt button', { timeout: 15000 }); await pick(p);
    await p.waitForSelector('.fab', { timeout: 10000 }); await p.waitForTimeout(800);
    const more = 'button[aria-label="Plus d\'options"]';
    await p.click(more); await p.waitForSelector('.pmenu');
    assert((await visibleWhole('.pmenu')) === 'ok', `menu ⋯ : ${await visibleWhole('.pmenu')}`);
    assert(await p.getAttribute(more, 'aria-expanded') === 'true', 'aria-expanded du bouton ⋯');
    await p.keyboard.press('Escape'); await p.waitForTimeout(200);
    assert(!(await p.$('.pmenu')), 'Échap ne ferme pas le menu ⋯');
    await p.click(more); await p.waitForSelector('.pmenu');
    await p.mouse.click(187, 90); await p.waitForTimeout(400);
    assert(!(await p.$('.pmenu')), 'toucher ailleurs ne ferme pas le menu ⋯');
    assert((await p.locator('.sheet h1').textContent()).includes('Panthéon'), 'le toucher qui ferme le menu a déclenché autre chose');
    // fenêtre (i) « Infos vérifiées » quand le lieu a une date de vérification
    if (await p.$('.info-btn')) {
      await p.click('.info-btn'); await p.waitForSelector('.dlg');
      assert((await visibleWhole('.dlg')) === 'ok', `fenêtre (i) : ${await visibleWhole('.dlg')}`);
      await p.keyboard.press('Escape'); await p.waitForTimeout(200);
      assert(!(await p.$('.dlg')), 'Échap ne ferme pas la fenêtre (i)');
    }
    await p.click('.sheet .close'); await p.waitForTimeout(600);
    // 1 bis. « Ouvert à » dans une liste de restaurants
    await p.click('.chip:has-text("Restaurants")'); await p.waitForTimeout(3000);
    const openAt = '.opill[aria-expanded]';
    await p.click(openAt); await p.waitForSelector('.moment'); await p.waitForTimeout(300);
    assert((await visibleWhole('.moment')) === 'ok', `ouvert à : ${await visibleWhole('.moment')}`);
    await p.keyboard.press('Escape'); await p.waitForTimeout(200);
    assert(!(await p.$('.moment')), 'Échap ne ferme pas « Ouvert à »');
    await p.click('.sheet .close').catch(() => {}); await p.waitForTimeout(600);
    // 2. menu des cartes
    const layers = 'button[aria-label="Type de carte"]';
    await p.click(layers); await p.waitForSelector('.modes-pop');
    assert((await visibleWhole('.modes-pop')) === 'ok', `menu des cartes : ${await visibleWhole('.modes-pop')}`);
    await p.mouse.click(100, 190); await p.waitForTimeout(400);
    assert(!(await p.$('.modes-pop')), 'toucher la carte ne ferme pas le menu des cartes');
    assert(!(await p.$('section.sheet')), 'le toucher qui ferme le menu a ouvert une fiche');
    // fenêtre « À propos » (bouton ⓘ) : entière à l'écran, vue « Sources », fermée par Échap
    await p.click('.about-btn'); await p.waitForSelector('.dlg'); await p.waitForTimeout(300);
    assert((await visibleWhole('.dlg')) === 'ok', `fenêtre À propos : ${await visibleWhole('.dlg')}`);
    await p.click('.about-sources'); await p.waitForSelector('.dlg .back');
    assert(/All The Places/.test(await p.textContent('.dlg')), 'vue des sources absente');
    await p.keyboard.press('Escape'); await p.waitForTimeout(200);
    assert(!(await p.$('.dlg')), 'Échap ne ferme pas la fenêtre À propos');
    // 3. le choix de l'heure d'un trajet
    await p.click('button[aria-label="Effacer la recherche"]').catch(() => {}); await p.mouse.click(120, 300); await p.waitForTimeout(300);
    await p.fill('#search', 'Panthéon'); await p.waitForSelector('.results li.opt button', { timeout: 15000 }); await pick(p);
    await p.waitForSelector('.action.primary', { timeout: 15000 }); await p.click('.action.primary');
    await p.waitForSelector('.when-btn', { timeout: 15000 });
    await p.click('.when-btn'); await p.waitForSelector('.when-panel'); await p.waitForTimeout(500);
    assert((await visibleWhole('.when-panel')) === 'ok', `heure du trajet : ${await visibleWhole('.when-panel')}`);
    await p.keyboard.press('Escape'); await p.waitForTimeout(200);
    assert(!(await p.$('.when-panel')), 'Échap ne ferme pas le choix de l’heure');
    assert(!errors.length, errors.join(' | '));
    await ctx.close();
  },
  async 'la liste se recharge quand on déplace la carte'() {
    const { p, ctx } = await page({ viewport: { width: 1280, height: 800 }, isMobile: false, hasTouch: false });
    await p.click('.chip:has-text("Restaurants")'); await p.waitForTimeout(4000);
    const before = await p.$eval('.nearby .r-name', (e) => e.textContent);
    for (let i = 0; i < 2; i++) { await p.mouse.move(900, 400); await p.mouse.down(); await p.mouse.move(200, 440, { steps: 10 }); await p.mouse.up(); await p.waitForTimeout(3000); }
    await p.waitForTimeout(3000);
    assert(before !== await p.$eval('.nearby .r-name', (e) => e.textContent), 'liste inchangée après déplacement');
    await ctx.close();
  }
};

// E2E_ONLY=mot : ne lancer que les tests dont le nom contient ce mot
for (const [name, fn] of Object.entries(tests).filter(([n]) => !process.env.E2E_ONLY || n.includes(process.env.E2E_ONLY))) {
  const before = cspSeen.length;
  try { await fn(); if (cspSeen.length > before) throw new Error(`bloqué par la politique de sécurité : ${cspSeen.slice(before).join(' | ')}`); console.log('✓', name); } catch (e) { failed++; console.log('✗', name, '—', e.message); }
}
await browser.close();
try { process.kill(-preview.pid); } catch { preview.kill(); }
console.log(failed ? `${failed} test(s) en échec` : 'Tous les tests passent');
process.exit(failed ? 1 : 0);
