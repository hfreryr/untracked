// Info trafic d'un trajet (trafic.js) : messages de ligne et de station, tri par heure, titres courts.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { legTrafic, toAlert, plainText, activeDuring, tripAlert, alertSub } from '../../src/lib/trafic.js';

// messages réels relevés le 27/10/2026 (api.transitous.org)
const M4 = { impactPeriod: [{ start: '2026-10-11T16:00:00Z', end: '2026-12-20T03:30:00Z' }], cause: 'CONSTRUCTION', effect: 'NO_SERVICE',
  headerText: 'Métro 4 : Travaux de rénovation - Arrêt non desservi', descriptionText: "<p>Jusqu'au 19 décembre inclus, l'arrêt n'est pas desservi à Saint-Michel en raison de travaux de rénovation</p>" };
const LIFT = { impactPeriod: [{ start: '2026-10-27T07:06:00Z', end: '1970-01-01T00:00:00Z' }], effect: 'ACCESSIBILITY_ISSUE',
  headerText: '2 ascenseurs sur 5 hors service — Saint-Michel Notre-Dame', descriptionText: '2 ascenseurs sur 5 sont actuellement hors service dans cette station.' };
const RERB_NOV = { impactPeriod: [{ start: '2026-11-07T02:00:00Z', end: '2026-11-08T02:00:00Z' }], effect: 'REDUCED_SERVICE',
  headerText: 'RER B : Aulnay-sous-Bois <-> Mitry - Claye 07-08/11', descriptionText: '<p>Le trafic est interrompu entre Aulnay sous Bois &lt;&gt; Mitry Claye.<br><br>P&#233;riode : les week-ends</p>' };
const M13 = { impactPeriod: [{ start: '2026-10-27T06:36:00Z', end: '2026-10-27T07:00:00Z' }], effect: 'MODIFIED_SERVICE',
  headerText: 'Métro 13 : Travaux de modernisation - Trafic interrompu', descriptionText: '' };

const leg = (over = {}) => ({ mode: 'SUBWAY', startTime: '2026-10-27T08:00:00Z', endTime: '2026-10-27T08:20:00Z',
  from: { name: 'Gare Montparnasse' }, to: { name: 'Châtelet' },
  intermediateStops: [{ name: 'Odéon' }, { name: 'Saint-Michel Notre-Dame', alerts: [M4, LIFT] }, { name: 'Cité' }], ...over });

test('le texte du transporteur est lisible : balises retirées, caractères décodés, paragraphes gardés', () => {
  assert.equal(plainText(RERB_NOV.descriptionText), 'Le trafic est interrompu entre Aulnay sous Bois <> Mitry Claye.\nPériode : les week-ends');
});

test('station non desservie : titre court, station barrée ; ascenseurs ignorés au milieu du trajet', () => {
  const t = legTrafic(leg());
  assert.equal(t.all.length, 1);
  assert.equal(t.all[0].title, 'Saint-Michel Notre-Dame non desservie');
  assert.equal(t.all[0].cause, 'Travaux de rénovation');
  assert.deepEqual(t.skipped, ['Saint-Michel Notre-Dame']);
  assert.equal(t.level, 'orange');
  assert.equal(t.lifts.length, 0);
});

test('ascenseurs : affichés seulement là où l’on monte ou descend', () => {
  const t = legTrafic(leg({ to: { name: 'Saint-Michel Notre-Dame', alerts: [LIFT] }, intermediateStops: [] }));
  assert.equal(t.lifts.length, 1);
  assert.equal(t.all.length, 0);
  assert.equal(t.level, null);
});

test('seuls les messages valables à l’heure du trajet : travaux de novembre absents d’un trajet d’octobre', () => {
  assert.equal(activeDuring(RERB_NOV, new Date('2026-10-27T08:00:00Z'), new Date('2026-10-27T08:20:00Z')), false);
  assert.equal(activeDuring(RERB_NOV, new Date('2026-11-07T10:00:00Z'), new Date('2026-11-07T10:30:00Z')), true);
  assert.equal(legTrafic(leg({ mode: 'REGIONAL_RAIL', alerts: [RERB_NOV], intermediateStops: [] })).all.length, 0);
  // fin « 1970 » = jusqu'à nouvel ordre
  assert.equal(activeDuring(LIFT, new Date('2027-01-01'), new Date('2027-01-01')), true);
});

test('trafic interrompu sur la ligne : rouge, titre « Trafic interrompu », cause à part', () => {
  const t = legTrafic(leg({ startTime: '2026-10-27T06:40:00Z', endTime: '2026-10-27T06:55:00Z', alerts: [M13], intermediateStops: [] }));
  assert.equal(t.level, 'red');
  assert.equal(t.line[0].title, 'Trafic interrompu');
  assert.equal(alertSub(t.line[0], new Date('2026-10-27T06:40:00Z')), 'Travaux de modernisation, jusqu’à 8 h 00'.replace('’', "'"));
});

test('titre sans format connu : on garde le texte du transporteur (sans le nom de la ligne)', () => {
  const a = toAlert({ headerText: 'RER B : Aulnay-sous-Bois <-> Mitry - Claye 07-08/11' });
  assert.equal(a.title, 'Aulnay-sous-Bois <-> Mitry - Claye 07-08/11');
});

test('un même message en double n’apparaît qu’une fois ; le plus grave du trajet ressort en premier', () => {
  const l1 = { trafic: legTrafic(leg({ alerts: [M4], from: { name: 'Gare Montparnasse', alerts: [] } })) };
  const l2 = { trafic: legTrafic(leg({ startTime: '2026-10-27T06:40:00Z', endTime: '2026-10-27T06:55:00Z', alerts: [M13, M13], intermediateStops: [] })) };
  assert.equal(l2.trafic.all.length, 1);
  assert.equal(tripAlert({ legs: [l1, l2] }).alert.level, 'red');
  assert.equal(tripAlert({ legs: [{ trafic: null }] }), null);
});

test('fin dans la nuit = veille : « jusqu’au 19 déc. » pour une fin publiée le 20 à 4 h 30 (Paris)', () => {
  const a = legTrafic(leg()).all[0];
  assert.equal(alertSub(a, new Date('2026-10-27T08:00:00Z')), "Travaux de rénovation, jusqu'au 19 déc.");
});
