<!-- Juste après une contribution (maquette validée le 04/11/2026) : les points gagnés en grand, la barre vers le niveau
     suivant, le badge en cours. Le moment de récompense le plus fort : la personne vient d'agir. Tout est compté sur le
     téléphone (points.js, osmcontrib.js). -->
<script>
  import { tx } from '#lib/i18n/index.js';
  import { osmEdits } from '#lib/osmcontrib.js';
  import { loadReviewer } from '#lib/reviewer.js';
  import { pointsOf } from '#lib/points.js';
  import { levelOf, markAnnounced } from '#lib/contrib.js';
  import { badgeProgress, markBadges } from '#lib/badges.js';
  import { badgeName, badgeSub } from '#lib/badgetext.js';
  import BadgeIcon from './BadgeIcon.svelte';

  const BADGE_OF = { horaires: 'gardien', signalement: 'sentinelle', corrections: 'cartographe' };
  const NAME = { eclaireur: () => tx('contrib.eclaireur'), passeur: () => tx('contrib.passeur'), vigie: () => tx('contrib.vigie'), phare: () => tx('contrib.phare') };
  const mine = loadReviewer().mine;
  const edits = osmEdits();
  const last = edits.at(-1);
  const after = pointsOf(mine, edits), before = pointsOf(mine, edits.slice(0, -1));
  const gained = after - before;
  const lv = levelOf(after), up = lv.rank > levelOf(before).rank;
  const badge = last && badgeProgress(mine, edits).find((b) => b.id === BADGE_OF[last.kind]);
  markAnnounced(after);           // annoncé ici : pas de seconde fenêtre « Nouveau niveau »
  if (badge?.done) markBadges(mine);
  const what = { horaires: () => tx('points.horaires'), corrections: () => tx('points.corrections'), signalement: () => tx('points.signalement') };
</script>

{#if gained > 0}
  <div class="gain">
    <p class="pts">{tx('points.plus_n', { n: gained })}</p>
    <p class="why">{what[last.kind]?.()}{last.near ? ` · ${tx('points.sur_place')}` : ''}</p>
    {#if up}<p class="up">{tx('contrib.nouveau_niveau', { niveau: NAME[lv.level.id]() })}</p>{/if}
    {#if lv.next}
      <div class="bar" role="progressbar" aria-valuemin="0" aria-valuemax="100" aria-valuenow={Math.round(lv.progress * 100)} aria-label={tx('contrib.progression')}><i style:width={`${Math.round(lv.progress * 100)}%`}></i></div>
      <p class="next">{tx('points.encore', { n: lv.remaining, niveau: NAME[lv.next.id]() })}</p>
    {/if}
    {#if badge}
      <div class="bdg"><BadgeIcon id={badge.id} size={30} off={!badge.done} /><span><b>{badgeName(badge.id)}</b> · {badge.done ? tx('badges.obtenu_court') : badgeSub(badge.id, badge.n, badge.goal)}</span></div>
    {/if}
  </div>
{/if}

<style>
  .gain { text-align: center; margin: 4px 0 8px; }
  .gain .pts { margin: 0; font-size: 32px; font-weight: 800; color: var(--accent); }
  .gain .why { margin: 2px 0 0; color: var(--open); font-weight: 600; font-size: 14px; }
  .gain .up { margin: 8px 0 0; font-size: 17px; font-weight: 700; }
  .bar { height: 8px; background: var(--fill); border-radius: 4px; margin: 12px 0 6px; overflow: hidden; }
  .bar i { display: block; height: 100%; background: var(--accent); border-radius: 4px; }
  .gain .next { margin: 0; font-size: 13.5px; color: var(--ink); }
  .bdg { display: flex; align-items: center; justify-content: center; gap: 8px; margin-top: 10px; background: var(--fill); border-radius: 12px; padding: 8px 10px; font-size: 13.5px; text-align: left; }
</style>
