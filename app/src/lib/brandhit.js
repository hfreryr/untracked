// Ligne « Monoprix · Afficher les lieux » en tête des résultats, comme Google Maps (capture du porteur, 21/10) :
// quand plusieurs lieux du même type portent le même nom (une enseigne), une ligne mène à la liste de tous.
import { norm } from './searchindex.js';

/**
 * @param {{name:string, subclass?:string|null, area?:boolean}[]} results  résultats affichés
 * @returns {{ name: string } | null}  le nom de l'enseigne, tel qu'écrit le plus souvent
 */
export function brandOf(results) {
  const groups = new Map();
  for (const r of results || []) {
    if (!r?.name || r.area || !r.subclass) continue;
    const k = norm(r.name);
    if (!k) continue;
    const g = groups.get(k) || { names: new Map(), types: new Map(), n: 0 };
    g.n++;
    g.names.set(r.name, (g.names.get(r.name) || 0) + 1);
    g.types.set(r.subclass, (g.types.get(r.subclass) || 0) + 1);
    groups.set(k, g);
  }
  // seulement si l'enseigne est la meilleure réponse : « rue Paradis Marseille » vu de Paris ne doit pas commencer par
  // « Rue de Marseille · Afficher les lieux » (deux arrêts de bus plus bas dans la liste, grille du 31/10/2026)
  const head = (results || []).find((r) => r?.name);
  const top = head && !head.area && head.subclass ? norm(head.name) : null;
  let best = null;
  for (const [k, g] of groups) {
    if (k !== top) continue;
    if (g.n < 2) continue;
    // des lieux sans rapport qui portent le même nom (« Saint-Germain » : église, café…) ne font pas une enseigne
    if (Math.max(...g.types.values()) * 2 < g.n + 1) continue;
    if (!best || g.n > best.n) best = g;
  }
  if (!best) return null;
  const name = [...best.names.entries()].sort((a, b) => b[1] - a[1])[0][0];
  return { name };
}
