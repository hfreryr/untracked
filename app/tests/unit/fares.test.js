// Prix estimé d'un trajet en transports (tickets à l'unité Île-de-France 2026).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { tripFare, fmtEuros } from '#lib/fares.js';
import paris from '#lib/cities/paris.js';

const t0 = Date.parse('2026-10-15T09:00:00Z'), min = 60000;
const leg = (mode, m, extra = {}) => ({ mode, start: t0 + m * min, from: 'A', to: 'B', ...extra });

test('métro + RER dans les 2 h : un seul ticket Métro-Train-RER', () => {
  assert.equal(tripFare([leg('WALK', 0), leg('SUBWAY', 5), leg('REGIONAL_RAIL', 25), leg('WALK', 50)], paris.fares), 2.55);
});
test('bus puis tram : un seul ticket Bus-Tram ; métro puis bus : deux tickets', () => {
  assert.equal(tripFare([leg('BUS', 0), leg('TRAM', 30)], paris.fares), 2.05);
  assert.equal(tripFare([leg('SUBWAY', 0), leg('BUS', 20)], paris.fares), 4.6);
});
test('au-delà de la durée de validité : nouveau ticket', () => {
  assert.equal(tripFare([leg('BUS', 0), leg('BUS', 100)], paris.fares), 4.1);
  assert.equal(tripFare([leg('RAIL', 0), leg('SUBWAY', 130)], paris.fares), 5.1);
});
test('aéroport, mode inconnu, trajet à pied ou ville sans tarifs : pas de prix', () => {
  assert.equal(tripFare([leg('REGIONAL_RAIL', 0, { to: 'Aéroport Charles de Gaulle 2 TGV' })], paris.fares), null);
  assert.equal(tripFare([leg('FERRY', 0)], paris.fares), null);
  assert.equal(tripFare([leg('WALK', 0)], paris.fares), null);
  assert.equal(tripFare([leg('BUS', 0)], null), null);
});
test('affichage', () => assert.equal(fmtEuros(2.55), '2,55 €'));

test('hors du réseau de la ville (Lyon) : pas de prix francilien', async () => {
  const { tripFare } = await import('../../src/lib/fares.js');
  const t = Date.UTC(2026, 9, 23, 8);
  const lyon = [{ mode: 'SUBWAY', from: 'Bellecour', to: 'Part-Dieu', start: t, fromStop: 'fr-tcl_STOP:1234' }];
  const paris = [{ mode: 'SUBWAY', from: 'Odéon', to: 'Châtelet', start: t, fromStop: 'fr-idfm_IDFM:22152' }];
  const fares = { rail: { price: 2.55, minutes: 120, modes: ['SUBWAY'] }, road: { price: 2.05, minutes: 90, modes: ['BUS'] }, unsure: /aeroport/ };
  assert.equal(tripFare(lyon, fares, 'IDFM'), null);
  assert.equal(tripFare(paris, fares, 'IDFM'), 2.55);
});
