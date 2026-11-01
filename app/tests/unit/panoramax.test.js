import { test } from 'node:test';
import assert from 'node:assert/strict';
import { pictureUrls, instanceHost } from '#lib/panoramax.js';

const ID = 'a4d622ec-bf42-417b-811c-6bf5e961fe04';  // Wagyu Restaurant 1129 (Paris 1er), photo IGN

test("hôte de stockage S3 de l'IGN : on passe par l'API de l'instance (sinon 403 XML, bloqué par le navigateur)", () => {
  const { src, tile } = pictureUrls(ID, 'panoramax-storage-public-fast.s3.gra.perf.cloud.ovh.net');
  assert.equal(src, `https://panoramax.ign.fr/api/pictures/${ID}/sd.jpg`);
  assert.equal(tile(3, 1), `https://panoramax.ign.fr/api/pictures/${ID}/tiled/3_1.jpg`);
});

test("hôte d'instance : gardé tel quel", () => {
  assert.equal(instanceHost('panoramax.openstreetmap.fr'), 'panoramax.openstreetmap.fr');
  assert.equal(pictureUrls(ID, 'panoramax.ign.fr').src, `https://panoramax.ign.fr/api/pictures/${ID}/sd.jpg`);
});
