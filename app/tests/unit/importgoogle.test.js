// Import Google Takeout : fichiers JSON (lieux enregistrés, adresses avec libellé) et listes CSV.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readGoogleExport } from '#lib/importgoogle.js';

const geo = {
  type: 'FeatureCollection',
  features: [
    { geometry: { coordinates: [2.3376, 48.8606] }, properties: { google_maps_url: 'https://maps.google.com/?cid=1', location: { name: 'Musée du Louvre', address: 'Rue de Rivoli, 75001 Paris' } } },
    { geometry: { coordinates: [0, 0] }, properties: { google_maps_url: 'https://www.google.com/maps/place/X/@48.85,2.29,17z', location: { name: 'Tour' } } }
  ]
};
const labeled = { type: 'FeatureCollection', features: [
  { geometry: { coordinates: [2.35, 48.86] }, properties: { name: 'Domicile', address: '10 rue Y, 75003 Paris' } }
] };

test('lieux enregistrés (JSON) : position directe ou tirée de l’adresse Google', async () => {
  const r = await readGoogleExport(new File([JSON.stringify(geo)], 'Saved Places.json'));
  assert.equal(r.places.length, 2);
  assert.equal(r.places[0].name, 'Musée du Louvre');
  assert.equal(r.places[0].lat, 48.8606);
  assert.equal(r.places[1].lat, 48.85);
  assert.equal(r.places[0].listName, 'Lieux suivis');
});
test('adresses avec libellé : Domicile devient Maison', async () => {
  const r = await readGoogleExport(new File([JSON.stringify(labeled)], 'Labeled places.json'));
  assert.equal(r.home.name, '10 rue Y, 75003 Paris');
  assert.equal(r.places.length, 0);
});
test('liste CSV : guillemets, virgules, doublons', async () => {
  const csv = '﻿Title,Note,URL,Comment\n"Chez ""Lulu"", bistrot",,https://www.google.com/maps/place/a/data=!3d48.8566!4d2.3522,\nChez Lulu,,,\n"Chez ""Lulu"", bistrot",,https://www.google.com/maps/place/a/data=!3d48.8566!4d2.3522,\n';
  const r = await readGoogleExport(new File([csv], 'À visiter.csv'));
  assert.equal(r.places.length, 2);
  assert.equal(r.places[0].name, 'Chez "Lulu", bistrot');
  assert.equal(r.places[0].lon, 2.3522);
  assert.equal(r.places[0].listName, 'À visiter');
});
test('fichier quelconque : rien d’importé, pas de plantage', async () => {
  const r = await readGoogleExport(new File(['bonjour'], 'notes.json'));
  assert.deepEqual(r.places, []);
});

test('avis Google : ignorés (ce ne sont pas des lieux enregistrés)', async () => {
  const r = await readGoogleExport(new File([JSON.stringify(geo)], 'Avis.json'));
  assert.deepEqual(r.places, []);
});
test('fichier seul (pas une archive) : pas d’alerte « listes absentes »', async () => {
  const r = await readGoogleExport(new File([JSON.stringify(geo)], 'Saved Places.json'));
  assert.equal(r.listsMissing, false);
});

test('liste Google : la position est lue dans le lien du lieu (identifiant S2), et dans les repères placés', async () => {
  const { readGoogleExport } = await import('#lib/importgoogle.js');
  const csv = 'Titre,Note,URL,Tags,Commentaire\n,,,,\nColmar,,https://www.google.com/maps/place/Colmar/data=!4m2!3m1!1s0x479165dff670c1cf:0xd7a4b0d6c4f2a8c1,,\n'
    + 'Repère placé,,"https://www.google.com/maps/search/43.7224713,4.803497",,\n';
  const r = await readGoogleExport(new File([csv], 'Alsace.csv'));
  const colmar = r.places.find((p) => p.name === 'Colmar');
  assert.ok(Math.abs(colmar.lat - 48.0837) < 1e-3 && Math.abs(colmar.lon - 7.3548) < 1e-3, `${colmar.lat}, ${colmar.lon}`);
  const pin = r.places.find((p) => p.name === 'Repère placé');
  assert.equal(pin.lat, 43.7224713);
});

test('lieu sans position : cherché autour de sa liste ; un homonyme lointain est écarté', async () => {
  const { listCenters, tooFar } = await import('#lib/importcenter.js');
  const places = [{ listName: 'Bavière', lat: 48.14, lon: 11.58 }, { listName: 'Bavière', lat: 47.56, lon: 10.75 }, { listName: 'Bavière', lat: 48.37, lon: 10.9 },
    { listName: 'Bavière', name: 'Neuschwanstein' }, { listName: 'Paris', lat: 48.85, lon: 2.35 }];
  const { centers, all } = listCenters(places);
  assert.equal(centers.get('Bavière').n, 3);
  assert.ok(Math.abs(centers.get('Bavière').lat - 48.14) < 0.01);
  assert.ok(all.n === 4);
  assert.equal(tooFar({ lat: 48.86, lon: 2.34 }, centers.get('Bavière')), true);     // homonyme parisien
  assert.equal(tooFar({ lat: 47.56, lon: 10.75 }, centers.get('Bavière')), false);
  assert.equal(tooFar({ lat: 48.86, lon: 2.34 }, centers.get('Paris')), false);      // un seul lieu placé : pas de jugement
});
