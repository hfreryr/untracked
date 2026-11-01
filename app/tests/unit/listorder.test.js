// Ordre des listes de Mes lieux et liste « À tester » retirée (listorder.js), fin du glissement (swiperow.js)
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { sortLists, markUsed, usedLabel, dropEmptyTodo } from '../../src/lib/listorder.js';
import { swipeEnd, REVEAL } from '../../src/lib/swiperow.js';
import { DEFAULT_LISTS } from '../../src/lib/myplaces.js';

const L = [{ id: 'fav', name: 'Favoris' }, { id: 'a', name: 'Baléares' }, { id: 'b', name: 'Provence' }, { id: 'c', name: 'Landes' }];

test('Favoris en tête, puis la plus récemment utilisée ; jamais utilisées : ordre d\'origine, après', () => {
  let l = markUsed(L, 'c', 'o', 1000);
  l = markUsed(l, 'b', 'a', 2000);
  l = markUsed(l, 'fav', 'o', 500);
  assert.deepEqual(sortLists(l).map((x) => x.id), ['fav', 'b', 'c', 'a']);
  assert.deepEqual(l.map((x) => x.id), ['fav', 'a', 'b', 'c']);           // l'ordre enregistré ne change pas
});

test('dernière utilisation en clair, rien au-delà de 30 jours', () => {
  const now = new Date(2026, 10, 2, 12).getTime(), day = 86400000;
  assert.equal(usedLabel({ used: [now - 3600000, 'o'] }, now), 'Ouverte aujourd\'hui');
  assert.equal(usedLabel({ used: [now - day, 'a'] }, now), 'Lieu ajouté hier');
  assert.equal(usedLabel({ used: [now - 5 * day, 'o'] }, now), 'Ouverte il y a 5 jours');
  assert.equal(usedLabel({ used: [now - 40 * day, 'o'] }, now), null);
  assert.equal(usedLabel({}, now), null);
});

test('« À tester » : retirée si vide, gardée si elle contient des lieux ; plus créée par défaut', () => {
  const lists = [{ id: 'fav' }, { id: 'todo', name: 'À tester' }];
  assert.deepEqual(dropEmptyTodo(lists, [{ lists: ['fav'] }]).map((x) => x.id), ['fav']);
  assert.deepEqual(dropEmptyTodo(lists, [{ lists: ['todo'] }]).map((x) => x.id), ['fav', 'todo']);
  assert.deepEqual(DEFAULT_LISTS.map((x) => x.id), ['fav']);
});

test('glisser : un peu → corbeille découverte, jusqu\'au bout → supprimé', () => {
  assert.equal(swipeEnd(-10, 390), 'close');
  assert.equal(swipeEnd(-REVEAL, 390), 'open');
  assert.equal(swipeEnd(-250, 390), 'delete');
});
