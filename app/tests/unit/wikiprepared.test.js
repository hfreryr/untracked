// Photos Wikimedia préparées à l'avance (wikiprepared.js)
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { preparedPhotos } from '../../src/lib/wikiprepared.js';

test('chemin des tuiles → adresse de l\'image, page Commons et crédit', () => {
  const [p] = preparedPhotos([['a/ab/Caf%C3%A9_de_Flore.jpg/960px-Caf%C3%A9_de_Flore.jpg', 'Jean Dupont · CC BY-SA 4.0']]);
  assert.equal(p.src, 'https://upload.wikimedia.org/wikipedia/commons/thumb/a/ab/Caf%C3%A9_de_Flore.jpg/960px-Caf%C3%A9_de_Flore.jpg');
  assert.equal(p.page, 'https://commons.wikimedia.org/wiki/File%3ACaf%C3%A9_de_Flore.jpg');
  assert.equal(p.title, 'Café_de_Flore.jpg');
  assert.equal(p.credit, 'Jean Dupont · CC BY-SA 4.0');
});

test('données absentes ou douteuses ignorées', () => {
  assert.deepEqual(preparedPhotos(null), []);
  assert.deepEqual(preparedPhotos([['../../x', ''], 'texte', [3]]), []);
});
