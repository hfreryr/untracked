// Import des lieux enregistrés dans Google Maps, depuis l'export Google Takeout
// (« Maps (vos adresses) »). Le fichier est lu sur le téléphone : rien n'est envoyé,
// sauf, pour les rares lieux dont l'export ne donne pas la position, leur nom au moteur de recherche
// (comme si on les tapait dans la barre de recherche).
//
// Formats acceptés : l'archive .zip telle que Google la fournit, ou les fichiers qu'elle contient
// (« Lieux enregistrés.json » / « Saved Places.json », « Adresses avec libellé.json » /
// « Labeled places.json », listes « Enregistré/*.csv »).
//
// ⚠️ Google range les listes (Favoris, À visiter, vos listes) dans un produit Takeout à part, « Enregistré »
// (« Saved »), et non dans « Maps (vos adresses) », qui ne contient que les lieux suivis, les adresses
// avec libellé et les avis. Les listes n'ont que le nom et un lien Google, dont l'identifiant contient la position
// (s2cell.js, découvert le 01/11/2026).
import { tx } from '#lib/i18n/index.js';
import { latLonFromGoogleUrl } from './s2cell.js';

/** Lit une archive .zip (méthodes « stockée » et « deflate ») : [{ name, text() }] */
async function unzip(buf) {
  const v = new DataView(buf);
  let eocd = -1;
  for (let i = buf.byteLength - 22; i >= Math.max(0, buf.byteLength - 70000); i--) {
    if (v.getUint32(i, true) === 0x06054b50) { eocd = i; break; }
  }
  if (eocd < 0) throw new Error('zip');
  const count = v.getUint16(eocd + 10, true);
  let p = v.getUint32(eocd + 16, true);
  const out = [];
  const dec = new TextDecoder();
  for (let n = 0; n < count; n++) {
    const method = v.getUint16(p + 10, true);
    const size = v.getUint32(p + 20, true);
    const nameLen = v.getUint16(p + 28, true), extra = v.getUint16(p + 30, true), comment = v.getUint16(p + 32, true);
    const local = v.getUint32(p + 42, true);
    const name = dec.decode(new Uint8Array(buf, p + 46, nameLen));
    p += 46 + nameLen + extra + comment;
    const start = local + 30 + v.getUint16(local + 26, true) + v.getUint16(local + 28, true);
    const data = new Uint8Array(buf, start, size);
    out.push({
      name,
      text: async () => {
        if (method === 0) return dec.decode(data);
        if (method !== 8) throw new Error('zip-method');
        const s = new Blob([data]).stream().pipeThrough(new DecompressionStream('deflate-raw'));
        return await new Response(s).text();
      }
    });
  }
  return out;
}

// Coordonnées cachées dans une adresse Google Maps (…!3d48.85!4d2.33… ou …@48.85,2.33…).
function coordsFromUrl(url = '') {
  const m = /!3d(-?\d+\.\d+)!4d(-?\d+\.\d+)/.exec(url) || /@(-?\d+\.\d+),(-?\d+\.\d+)/.exec(url)
    || /[?&](?:q|query|ll)=(-?\d+\.\d+),\s*(-?\d+\.\d+)/.exec(url) || /\/maps\/search\/(-?\d+\.\d+),\s*(-?\d+\.\d+)/.exec(url);
  if (m) return { lat: Number(m[1]), lon: Number(m[2]) };
  // lien d'un lieu enregistré : sa position est dans son identifiant (s2cell.js)
  return latLonFromGoogleUrl(url);
}

function fromGeoJSON(j) {
  const places = [];
  for (const f of j.features || []) {
    const pr = f.properties || {};
    const loc = pr.location || pr.Location || {};
    const geo = loc['Geo Coordinates'] || {};
    let lat = Number(geo.Latitude), lon = Number(geo.Longitude);
    const c = f.geometry?.coordinates;
    if ((!lat || !lon) && Array.isArray(c) && (c[0] || c[1])) { lon = Number(c[0]); lat = Number(c[1]); }
    const url = pr.google_maps_url || pr['Google Maps URL'] || '';
    if (!lat || !lon) ({ lat, lon } = coordsFromUrl(url) || {});
    const label = pr.name || pr.Title || '';
    places.push({
      name: loc.name || loc['Business Name'] || label || loc.address || loc.Address || '',
      address: loc.address || loc.Address || pr.address || '',
      label,                       // « Home », « Work », « Domicile »… dans les adresses avec libellé
      lat, lon
    });
  }
  return places;
}

function parseCsv(text) {
  const rows = [];
  let row = [], cell = '', q = false;
  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    if (q) {
      if (ch === '"' && text[i + 1] === '"') { cell += '"'; i++; }
      else if (ch === '"') q = false;
      else cell += ch;
    } else if (ch === '"') q = true;
    else if (ch === ',') { row.push(cell); cell = ''; }
    else if (ch === '\n' || ch === '\r') {
      if (ch === '\r' && text[i + 1] === '\n') i++;
      row.push(cell); rows.push(row); row = []; cell = '';
    } else cell += ch;
  }
  if (cell || row.length) { row.push(cell); rows.push(row); }
  return rows.filter((r) => r.some((c) => c.trim()));
}

function fromCsv(text, listName = '') {
  const [head, ...rows] = parseCsv(text.replace(/^﻿/, ''));
  if (!head) return [];
  const col = (re) => head.findIndex((h) => re.test(h.trim()));
  const iT = col(/^(title|titre)$/i), iU = col(/^url$/i);
  if (iT < 0) return [];
  return rows.map((r) => ({ name: r[iT] || '', address: '', label: '', listName, ...(coordsFromUrl(r[iU]) || {}) })).filter((p) => p.name);
}

const HOME = /^(home|domicile|maison)$/i;
const WORK = /^(work|travail|bureau)$/i;

/**
 * Lit un fichier choisi par l'utilisateur.
 * @returns {Promise<{ places: Array<{name,address,lat?,lon?}>, home?: object, work?: object }>}
 */
export async function readGoogleExport(file) {
  // garde-fou : une archive Takeout « Maps » fait quelques Mo ; au-delà, ce n'est pas le bon fichier
  if (file.size > 300e6) throw new Error('taille');
  const buf = await file.arrayBuffer();
  const u8 = new Uint8Array(buf, 0, 4);
  const isZip = u8[0] === 0x50 && u8[1] === 0x4b;
  const files = isZip
    ? (await unzip(buf)).filter((f) => /\.csv$/i.test(f.name) || (/\.json$/i.test(f.name) && /maps|adresses|places|lieux|enregistr|saved/i.test(f.name)))
    : [{ name: file.name, text: async () => new TextDecoder().decode(buf) }];
  const all = [];
  let lists = 0;
  for (const f of files) {
    const base = f.name.split('/').pop().replace(/\.(csv|json)$/i, '');
    // les avis laissés sur Google Maps ne sont pas des lieux enregistrés
    if (/^(avis|reviews?)$/i.test(base)) continue;
    const text = await f.text().catch(() => '');
    // chaque liste Google (« Favoris », « À visiter », vos listes…) est un fichier .csv à son nom
    if (/\.csv$/i.test(f.name)) {
      const rows = fromCsv(text, base);
      if (rows.length) lists++;
      all.push(...rows);
    } else {
      try {
        // « Lieux enregistrés.json » / « Saved Places.json » : les lieux suivis (étoile) de Google
        const starred = /saved places|lieux enregistr/i.test(base) ? tx('import.lieux_suivis') : '';
        all.push(...fromGeoJSON(JSON.parse(text)).map((p) => ({ ...p, listName: starred })));
      } catch { /* fichier ignoré */ }
    }
  }
  // archive sans aucune liste : le produit « Enregistré » n'a sans doute pas été coché
  const out = { places: [], listsMissing: isZip && !lists };
  const seen = new Set();
  for (const p of all) {
    if (!p.name && !p.address) continue;
    p.name = String(p.name).slice(0, 300); p.address = String(p.address || '').slice(0, 300);
    if (!(Math.abs(p.lat) <= 90 && Math.abs(p.lon) <= 180)) { delete p.lat; delete p.lon; }
    if (HOME.test(p.label)) { out.home = { ...p, name: p.address || p.name }; continue; }
    if (WORK.test(p.label)) { out.work = { ...p, name: p.address || p.name }; continue; }
    const k = `${p.name}|${p.lat?.toFixed?.(4)}|${p.listName}`;
    if (seen.has(k)) continue;
    seen.add(k);
    out.places.push(p);
  }
  return out;
}
