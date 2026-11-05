// Lien partagé vers un point placé à la main (sharedpoint.js)
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { sharedPoint } from '../../src/lib/sharedpoint.js';

test('point partagé : position lue dans l’adresse ; rien sans « point=1 »', () => {
  assert.deepEqual(sharedPoint('#carte=17/48.84712/2.30715&point=1'), { lat: 48.84712, lon: 2.30715 });
  assert.equal(sharedPoint('#carte=17/48.84712/2.30715'), null);
  assert.equal(sharedPoint('#carte=17/48.8/2.3&lieu=node/12'), null);
  assert.equal(sharedPoint('#point=1'), null);
  assert.equal(sharedPoint(''), null);
});
