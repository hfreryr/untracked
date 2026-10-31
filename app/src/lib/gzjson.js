// Lecture d'un fichier JSON peut-être compressé (gzip) : les tuiles de lieux sont stockées compressées (scripts/tileio.py),
// pour tenir dans la limite de 1 Go de GitHub Pages. On regarde les deux premiers octets plutôt que l'en-tête HTTP :
// selon l'hébergeur, le fichier arrive déjà décompressé par le navigateur, ou tel quel.
// Décompression par le navigateur (DecompressionStream : Safari 16.4, Chrome 80, Firefox 113) ; sinon fflate (MIT),
// chargé seulement dans ce cas.

/** Octets → objet JSON, décompressés si besoin. */
export async function parseBytes(buf) {
  const b = new Uint8Array(buf);
  if (b[0] !== 0x1f || b[1] !== 0x8b) return JSON.parse(new TextDecoder().decode(b));
  if (typeof DecompressionStream === 'function') {
    const s = new Blob([b]).stream().pipeThrough(new DecompressionStream('gzip'));
    return JSON.parse(await new Response(s).text());
  }
  const { gunzipSync } = await import('fflate');
  return JSON.parse(new TextDecoder().decode(gunzipSync(b)));
}

/** Réponse fetch → objet JSON. */
export async function readJson(r) {
  return parseBytes(await r.arrayBuffer());
}
