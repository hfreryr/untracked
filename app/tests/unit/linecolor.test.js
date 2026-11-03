import test from 'node:test';
import assert from 'node:assert/strict';
import { readableLine, contrast } from '#lib/linecolor.js';

test('pastilles de ligne : contraste 4,5:1 au moins, couleur gardée si elle suffit', () => {
  const rerB = readableLine('#5091CB', '#FFFFFF');
  assert.ok(contrast(rerB.color, '#FFFFFF') >= 4.5, rerB.color);
  assert.notEqual(rerB.color, '#5091CB');
  assert.deepEqual(readableLine('#003CA6', '#FFFFFF'), { color: '#003CA6', textColor: '#FFFFFF' });   // M2 : déjà lisible
  const yellow = readableLine('#FFCD00', '#FFFFFF');                                                     // texte clair sur jaune → fond foncé
  assert.ok(contrast(yellow.color, '#FFFFFF') >= 4.5);
  const light = readableLine('#6E6E00', '#000000');                                                      // texte foncé → fond éclairci
  assert.ok(contrast(light.color, '#000000') >= 4.5, light.color);
  assert.deepEqual(readableLine('nope', '#FFFFFF'), { color: 'nope', textColor: '#FFFFFF' });
});
