// App installée sur iPhone : la carte va jusqu'en haut de l'écran, sous l'heure et la caméra (28/10).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

const html = fs.readFileSync(new URL('../../src/app.html', import.meta.url), 'utf8');
const css = fs.readFileSync(new URL('../../src/lib/ui/base.css', import.meta.url), 'utf8');

test('barre d’état transparente et page sous la zone de la caméra', () => {
  assert.match(html, /name="apple-mobile-web-app-status-bar-style" content="black-translucent"/);
  assert.match(html, /viewport-fit=cover/);
});

test('l’heure reste lisible : voile en haut, seulement dans l’app installée', () => {
  assert.match(css, /@media \(display-mode: standalone\)\s*\{\s*body::before/);
});
