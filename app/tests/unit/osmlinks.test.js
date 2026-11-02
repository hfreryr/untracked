// Contribuer à OSM depuis une fiche (osmlinks.js) : une note sur téléphone, l'éditeur sur ordinateur
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { contributeUrl, noteUrl } from '../../src/lib/osmlinks.js';

const p = { osmType: 'node', osmId: 42, lat: 48.8531, lon: 2.3389 };
test('téléphone : une note, au zoom 18', () => assert.equal(contributeUrl(p, true), 'https://www.openstreetmap.org/note/new#map=18/48.853100/2.338900'));
test('ordinateur : l\'éditeur, sur le lieu', () => assert.equal(contributeUrl(p, false), 'https://www.openstreetmap.org/edit?node=42'));
test('lieu sans identifiant OSM : une note', () => assert.equal(contributeUrl({ lat: 1, lon: 2 }, false), noteUrl({ lat: 1, lon: 2 })));
