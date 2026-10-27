// Raccourcis personnels (customshortcuts.js, shortcuticons.js) : création, modification, anciens épinglés, sauvegarde.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { addCustom, updateCustom, removeCustom, cleanCustoms, fromPins, customOf, mergeCustoms, MAX_CUSTOM } from '../../src/lib/customshortcuts.js';
import { suggestIcon, ICON_IDS, SHORTCUT_ICONS } from '../../src/lib/shortcuticons.js';
import { snapshot, restore } from '../../src/lib/myplaces.js';

const stade = { id: 'way1', name: 'Stade Charléty', lat: 48.8188, lon: 2.3466, osmType: 'way', osmId: 1, subclass: 'stadium', address: '99 bd Kellermann' };
const same = (a, b) => Math.abs(a.lat - b.lat) < 1e-5 && Math.abs(a.lon - b.lon) < 1e-5;

test('12 icônes, une par famille, toutes dessinées', () => {
  assert.equal(ICON_IDS.length, 12);
  for (const id of ICON_IDS) assert.match(SHORTCUT_ICONS[id], /^<(path|rect|circle)/);
});

test('icône proposée selon le lieu ; « autre » sinon', () => {
  assert.equal(suggestIcon(stade), 'sport');
  assert.equal(suggestIcon({ subclass: 'restaurant' }), 'manger');
  assert.equal(suggestIcon({ subclass: 'pharmacy' }), 'sante');
  assert.equal(suggestIcon({ subclass: 'townhall' }), 'demarches');
  assert.equal(suggestIcon({ subclass: 'bench' }), 'autre');
  assert.equal(suggestIcon(null), 'autre');
});

test('d’abord le nom et l’icône, l’adresse ensuite ; deux raccourcis peuvent partager une icône', () => {
  let { list, id } = addCustom([], { name: '  Foot  ', icon: 'sport' });
  assert.equal(list[0].name, 'Foot');
  assert.equal(list[0].place, null);
  ({ list } = addCustom(list, { name: 'Salle', icon: 'sport', place: stade }));
  assert.equal(list.length, 2);
  list = updateCustom(list, id, { place: stade });
  assert.equal(list[0].place.name, 'Stade Charléty');
  assert.equal(customOf(list, stade, same).name, 'Foot');
  list = updateCustom(list, id, { name: '', icon: 'inconnue' });   // nom vide ignoré, icône inconnue → autre
  assert.equal(list[0].name, 'Foot');
  assert.equal(list[0].icon, 'autre');
  assert.equal(removeCustom(list, id).length, 1);
});

test('pas de raccourci sans nom, ni au-delà du maximum', () => {
  assert.equal(addCustom([], { name: '   ', icon: 'sport' }).id, null);
  const full = Array.from({ length: MAX_CUSTOM }, (_, i) => ({ id: `c${i}`, name: `R${i}`, icon: 'autre', place: null }));
  assert.equal(addCustom(full, { name: 'Un de trop', icon: 'autre' }).id, null);
});

test('les anciens lieux épinglés deviennent des raccourcis (icône « Autre »)', () => {
  const key = (p) => `${p.osmType}/${p.osmId}`;
  const c = fromPins(['way/1', 'node/404'], [stade], key);
  assert.equal(c.length, 1);
  assert.deepEqual([c[0].name, c[0].icon, c[0].place.lat], ['Stade Charléty', 'autre', 48.8188]);
});

test('données abîmées écartées à la lecture', () => {
  const c = cleanCustoms([null, { name: '' }, { name: 'Foot', icon: 'xx', place: { lat: 'a', lon: 2 } }, 'texte']);
  assert.deepEqual(c.map((x) => [x.name, x.icon, x.place]), [['Foot', 'autre', null]]);
  assert.deepEqual(cleanCustoms('pas un tableau'), []);
});

test('sauvegarde et transfert : les raccourcis partent et reviennent, sans doublon à la fusion', () => {
  const customs = [{ id: 'c1', name: 'Foot', icon: 'sport', place: stade }, { id: 'c2', name: 'Chez maman', icon: 'proches', place: null }];
  const back = restore(JSON.parse(JSON.stringify(snapshot({ lists: [], places: [], shortcuts: {}, pins: [], chips: [], customs }))));
  assert.deepEqual(back.customs.map((c) => [c.name, c.icon, !!c.place]), [['Foot', 'sport', true], ['Chez maman', 'proches', false]]);
  assert.equal(back.customs[0].place.osmId, 1);
  assert.equal(mergeCustoms(customs, back.customs, same).length, 2);
  // une ancienne sauvegarde (sans raccourcis) se relit sans erreur
  assert.deepEqual(restore({ p: [], pins: [] }).customs, []);
});
