// Textes des badges (badges.js), par badge : nom, avancement, remerciement à l'obtention.
import { tx } from './i18n/index.js';

const NAME = { gourmet: () => tx('badges.gourmet'), explorateur: () => tx('badges.explorateur'), quartier: () => tx('badges.quartier'),
  culture: () => tx('badges.culture'), cafe: () => tx('badges.cafe'), nuit: () => tx('badges.nuit') };
const SUB = { gourmet: (o) => tx('badges.n_restaurants', o), explorateur: (o) => tx('badges.n_villes', o), quartier: (o) => tx('badges.n_quartier', o),
  culture: (o) => tx('badges.n_culture', o), cafe: (o) => tx('badges.n_cafes', o), nuit: (o) => tx('badges.n_bars', o) };
const THANKS = { gourmet: (o) => tx('badges.gourmet_merci', o), explorateur: (o) => tx('badges.explorateur_merci', o),
  quartier: (o) => tx('badges.quartier_merci', o), culture: (o) => tx('badges.culture_merci', o), cafe: (o) => tx('badges.cafe_merci', o),
  nuit: (o) => tx('badges.nuit_merci', o) };

export const badgeName = (id) => NAME[id]?.() || '';
/** « 4 / 10 restaurants » */
export const badgeSub = (id, n, goal) => SUB[id]?.({ n, goal }) || '';
export const badgeThanks = (id, n) => THANKS[id]?.({ n }) || '';
