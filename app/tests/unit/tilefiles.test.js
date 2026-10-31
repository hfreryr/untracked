import { test } from 'node:test';
import assert from 'node:assert/strict';
import { gzipSync } from 'node:zlib';
import { readIndex, fileOf } from '#lib/placestore.js';
import { parseBytes } from '#lib/gzjson.js';

test('index v2 : le carré de zoom 14 est trouvé dans le plus grand fichier qui le contient', () => {
  const ix = readIndex({ v: 2, zooms: [14, 10, 12], tiles: ['10/500/312', '14/8300/5640', '12/2075/1411'], built: 'x' });
  assert.deepEqual(ix.zooms, [10, 12, 14]);
  assert.equal(fileOf(ix, 8000 + 5, 4992 + 7), '10/500/312');          // campagne : grand fichier
  assert.equal(fileOf(ix, 8300, 5640), '14/8300/5640');                // ville : fichier d'un seul carré
  assert.equal(fileOf(ix, 2075 * 4 + 3, 1411 * 4), '12/2075/1411');
  assert.equal(fileOf(ix, 8301, 5640), null);                          // hors des données
  assert.equal(ix.ext, '.json.gz');
});

test('index v1 (ancien format, encore en ligne le temps d’une mise à jour) : un fichier .json par carré', () => {
  const ix = readIndex({ v: 1, zoom: 14, tiles: ['8300/5640'], built: 'x' });
  assert.equal(fileOf(ix, 8300, 5640), '14/8300/5640');
  assert.equal(ix.ext, '.json');
});

test('fichier compressé ou déjà décompressé par le navigateur : même résultat', async () => {
  const obj = { v: 1, t: [[11, 2.35, 48.85, { name: 'Café é' }]] };
  const raw = new TextEncoder().encode(JSON.stringify(obj));
  assert.deepEqual(await parseBytes(new Uint8Array(gzipSync(raw)).buffer), obj);
  assert.deepEqual(await parseBytes(raw.buffer), obj);
});
