// Pastilles de ligne lisibles (WCAG 2.2 AA, 4,5:1) : certaines couleurs officielles des transporteurs ne le sont pas
// (RER B : blanc sur #5091CB, 3,3:1 ; relevé par axe-core le 03/11/2026). On garde le texte et on fonce le fond juste
// assez, pour que la ligne reste reconnaissable.
const lum = (hex) => {
  const [r, g, b] = [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16) / 255)
    .map((c) => (c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4));
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
};
/** Rapport de contraste entre deux couleurs « #RRGGBB ». */
export const contrast = (a, b) => { const [x, y] = [lum(a), lum(b)].sort((m, n) => n - m); return (x + 0.05) / (y + 0.05); };

const shade = (hex, k) => '#' + [1, 3, 5].map((i) => Math.round(parseInt(hex.slice(i, i + 2), 16) * k).toString(16).padStart(2, '0')).join('').toUpperCase();

/** { color, textColor } lisibles : inchangés s'ils le sont déjà ; sinon fond foncé (texte clair) ou éclairci (texte foncé). */
export function readableLine(color, textColor) {
  if (!/^#[0-9a-f]{6}$/i.test(color) || !/^#[0-9a-f]{6}$/i.test(textColor) || contrast(color, textColor) >= 4.5) return { color, textColor };
  const darker = lum(textColor) > lum(color);
  let c = color;
  for (let k = 0.95; k > 0.2 && contrast(c, textColor) < 4.5; k -= 0.05) {
    c = darker ? shade(color, k) : '#' + [1, 3, 5].map((i) => { const v = parseInt(color.slice(i, i + 2), 16); return Math.round(v + (255 - v) * (1 - k)).toString(16).padStart(2, '0'); }).join('').toUpperCase();
  }
  return { color: c, textColor };
}
