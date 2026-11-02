// Un geste sur une fiche : la faire monter ou descendre, ou le laisser à ce qu'il touche (porteur, 02/11/2026 :
// « quand on fait défiler les photos, la fiche bouge dès que le glissement n'est pas parfaitement droit »).
// Un geste plutôt horizontal n'est jamais pour la fiche ; sur une rangée qui défile de côté (photos, lignes à glisser),
// il faut un geste nettement vertical pour bouger la fiche.

/** 'wait' (trop court pour décider), 'sheet' (la fiche suit le doigt) ou 'other' (on laisse faire). Pure. */
export function sheetIntent(dx, dy, sideways) {
  if (Math.hypot(dx, dy) < 6) return 'wait';
  const ratio = sideways ? 2.5 : 1;
  return Math.abs(dy) > Math.abs(dx) * ratio ? 'sheet' : 'other';
}

/** Le geste commence-t-il sur une rangée qui défile de côté ? */
export const startsSideways = (target) => !!target?.closest?.('.pstrip, .swipe-row, [data-sideways]');
