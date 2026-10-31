// Textes affichés : tous dans src/lib/i18n/fr.js (plan de nettoyage, étape 4).
// Ce test échoue si un texte est écrit en dur dans l'écran ou le code, si une clé utilisée n'existe pas,
// ou si une clé du fichier ne sert plus. Limite connue : un mot isolé en minuscules (« maison ») ne se distingue
// pas d'un identifiant (« walk ») ; ceux-là sont repérés à la relecture.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { createRequire } from 'node:module';
import { tx, pluriel, keys } from '../../src/lib/i18n/index.js';

const require = createRequire(import.meta.url);
const { parse } = require('svelte/compiler');
const acorn = require('acorn');
const SRC = new URL('../../src/', import.meta.url).pathname;
const files = (dir) => fs.readdirSync(dir, { withFileTypes: true }).flatMap((e) =>
  e.isDirectory() ? files(path.join(dir, e.name)) : /\.(svelte|js)$/.test(e.name) ? [path.join(dir, e.name)] : []);
const ALL = files(SRC).filter((f) => !f.includes(`${path.sep}i18n${path.sep}`));
const rel = (f) => path.relative(SRC, f);

// Exceptions : vocabulaire de recherche (mots tapés par l'utilisateur, pas affichés) et chaînes techniques.
const ALLOWED_FILES = new Set(['lib/intent.js', 'lib/cities/paris.js']);   // analyse de la saisie ; profil de ville (noms propres)
const ALLOWED = {
  'lib/categories.js': (s) => /^[a-z ]+$/.test(s),               // mots-clés de recherche par catégorie
  'lib/rame.js': (s) => s === 'allée',                           // abréviation développée dans les données RATP
  'lib/geocode.js': (s) => /^(Photon|Géoplateforme) /.test(s),   // message d'erreur technique (console)
  'lib/mapstyle.js': (s) => /sans-serif/.test(s),                // police de rendu des pictogrammes
  'lib/placeinfo.js': (s) => /^(File|Category):$/.test(s),      // préfixes de l'API Wikimedia Commons
  'lib/mangrove.js': (s) => /PUBLIC KEY-----/.test(s),            // en-tête de clé publique (format PEM)
};

const CODE = /[|=&{}]|\.json\b|\b(rotate|translate\w*|scale)\(|cubic-bezier|ease-in|^Inter |^UntrackedMaps|^Europe\/|^Île-de-France$/;
const GEO = new Set(['Feature', 'FeatureCollection', 'Point', 'LineString', 'MultiLineString', 'Polygon', 'MultiPolygon', 'City']);
function french(s) {
  if (!/[A-Za-zÀ-ÿ]{3}/.test(s) && !/^[A-ZÀ-Ý][a-zà-ÿ]?$/.test(s) && !/[À-ÿ]/.test(s)) return false;
  if (CODE.test(s) || GEO.has(s)) return false;
  if (/^[a-z0-9_.:\/#?=&%@|*+-]*$/.test(s)) return false;
  if (/^(https?:|data:|mailto:|tel:|#|\.|\/)/.test(s) || /<\w|;\s*$|\bvar\(--|rgb\(|\d+px\b/.test(s)) return false;
  if (/^[A-Z0-9 ]{1,4}$/.test(s)) return false;
  return /\s/.test(s.trim()) || /[À-ÿ]/.test(s) || /^[A-ZÀ-Ý][a-zà-ÿ]/.test(s) || /^[a-zà-ÿ]+'/.test(s);
}
const SKIP_CALLEES = /^(tx|querySelector(All)?|getElementById|getItem|setItem|removeItem|addEventListener|removeEventListener|setAttribute|getAttribute|add|remove|toggle|contains|matchMedia|fetch|URL|RegExp|on|once|off|getLayer|getSource|setLayoutProperty|setPaintProperty|setFilter|addLayer|removeLayer|addSource|removeSource|addImage|hasImage|log|warn|error|createElement|getContext|setContext|toLocaleDateString|toLocaleTimeString|toLocaleString|DateTimeFormat|NumberFormat|startsWith|endsWith|includes|indexOf|split|test|match|replace|replaceAll|closest|matches|join|padStart)$/;
const calleeName = (c) => (c?.type === 'Identifier' ? c.name : c?.type === 'MemberExpression' && !c.computed ? c.property.name : '');

function hardcoded(file) {
  const src = fs.readFileSync(file, 'utf8');
  const svelte = file.endsWith('.svelte');
  const ast = svelte ? parse(src, { modern: true }) : acorn.parse(src, { ecmaVersion: 'latest', sourceType: 'module' });
  const css = svelte && ast.css ? [ast.css.start, ast.css.end] : [0, 0];
  const found = [];
  const seen = new Set();
  (function walk(n, p, k) {
    if (!n || typeof n !== 'object' || seen.has(n)) return;
    seen.add(n);
    if (Array.isArray(n)) { n.forEach((x) => walk(x, p, k)); return; }
    const inCss = n.start >= css[0] && n.end <= css[1];
    if (!inCss) {
      if (n.type === 'Text' && /[A-Za-zÀ-ÿ]{2}/.test(n.data) && p?.type !== 'Attribute') found.push(n.data.trim());
      if (n.type === 'Attribute' && /^(aria-label|placeholder|title|alt)$/.test(n.name) && Array.isArray(n.value)
        && n.value.some((v) => v.type === 'Text' && /[A-Za-zÀ-ÿ]{2}/.test(v.data))) found.push(`${n.name}="…"`);
      if (n.type === 'Literal' && typeof n.value === 'string' && french(n.value)
        && !(p?.type === 'Property' && k === 'key' && !p.computed) && !/^(Import|Export)/.test(p?.type || '')
        && !(p?.type === 'MemberExpression' && k === 'property') && !(p?.type === 'BinaryExpression' && /^(===|!==|==|!=|in)$/.test(p.operator))
        && p?.type !== 'SwitchCase' && !((p?.type === 'CallExpression' || p?.type === 'NewExpression') && k === 'arguments' && SKIP_CALLEES.test(calleeName(p.callee))))
        found.push(n.value);
      if (n.type === 'TemplateLiteral' && p?.type !== 'TaggedTemplateExpression') {
        const txt = n.quasis.map((q) => q.value.cooked).join(' ');
        if (french(txt) && !((p?.type === 'CallExpression' || p?.type === 'NewExpression') && k === 'arguments' && SKIP_CALLEES.test(calleeName(p.callee))))
          found.push(n.quasis.map((q) => q.value.cooked).join('…'));
      }
    }
    for (const key in n) {
      if (key === 'parent' || key === 'metadata' || key === 'loc') continue;
      if (n[key] && typeof n[key] === 'object') walk(n[key], typeof n.type === 'string' ? n : p, key);
    }
  })(ast, null, null);
  const ok = ALLOWED[rel(file)];
  return found.filter((s) => !(ok && ok(s)));
}

test('aucun texte affiché écrit en dur (tout passe par fr.js)', () => {
  const bad = ALL.filter((f) => !ALLOWED_FILES.has(rel(f))).flatMap((f) => hardcoded(f).map((s) => `${rel(f)} : « ${s.slice(0, 80)} »`));
  assert.deepEqual(bad, [], `Textes à déplacer dans src/lib/i18n/fr.js :\n${bad.join('\n')}`);
});

test('chaque clé utilisée existe dans fr.js, et chaque clé de fr.js sert', () => {
  const known = new Set(keys());
  const used = new Set();
  for (const f of ALL) for (const m of fs.readFileSync(f, 'utf8').matchAll(/\btx\('([^']+)'/g)) used.add(m[1]);
  const missing = [...used].filter((k) => !known.has(k));
  const unused = [...known].filter((k) => !used.has(k));
  assert.deepEqual(missing, [], `clés absentes de fr.js : ${missing.join(', ')}`);
  assert.deepEqual(unused, [], `clés de fr.js inutilisées : ${unused.join(', ')}`);
});

test('tx : texte simple, valeurs, accords, clé inconnue', () => {
  assert.equal(tx('promesse.compris'), 'Compris');
  assert.equal(tx('photos.photos_de', { title: 'Panthéon' }), 'Photos de Panthéon');
  assert.equal(tx('meslieux.lieu_restaure', { n: 1 }), '1 lieu restauré');
  assert.equal(tx('meslieux.lieu_restaure', { n: 3 }), '3 lieux restaurés');
  assert.equal(tx('transfert.lieu_dans_liste', { lieux: 2, listes: 1 }), '2 lieux dans 1 liste');
  assert.equal(tx('cle.inconnue'), 'cle.inconnue');
  assert.equal(pluriel(0, 'lieu', 'lieux'), 'lieu');
  assert.equal(pluriel(1.5, 'kilomètre', 'kilomètres'), 'kilomètre');
});

test('chaque {valeur} d\'un texte est fournie à l\'appel de tx()', async () => {
  const fr = (await import('../../src/lib/i18n/fr.js')).default;
  const bad = [];
  for (const f of ALL) {
    const src = fs.readFileSync(f, 'utf8');
    const ast = f.endsWith('.svelte') ? parse(src, { modern: true }) : acorn.parse(src, { ecmaVersion: 'latest', sourceType: 'module' });
    const seen = new Set();
    (function walk(n) {
      if (!n || typeof n !== 'object' || seen.has(n)) return;
      seen.add(n);
      if (Array.isArray(n)) { n.forEach(walk); return; }
      if (n.type === 'CallExpression' && n.callee.type === 'Identifier' && n.callee.name === 'tx' && n.arguments[0]?.type === 'Literal') {
        const key = n.arguments[0].value, v = fr[key];
        if (typeof v === 'string') {
          const given = new Set((n.arguments[1]?.properties || []).map((p) => p.key?.name));
          for (const [, name] of v.matchAll(/\{(\w+)\}/g)) if (!given.has(name)) bad.push(`${rel(f)} : ${key} sans {${name}}`);
        }
      }
      for (const k in n) if (k !== 'parent' && k !== 'metadata' && n[k] && typeof n[k] === 'object') walk(n[k]);
    })(ast);
  }
  assert.deepEqual(bad, []);
});
