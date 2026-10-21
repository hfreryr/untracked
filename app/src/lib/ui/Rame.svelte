<!-- Dessin de la rame, vue de côté, l'avant à droite (sens de la marche) : la voiture où monter est à la couleur
     de la ligne. Dessin maison d'une rame de métro (fenêtres, cabine, roues), pas une icône copiée. -->
<script>
  import { placeLabel } from '#lib/rame.js';
  /** @type {{ place: { pos: number, of: number, where: string }, color?: string }} */
  let { place, color = '#2A5BD7' } = $props();
  const W = 22, G = 3, H = 15, Y = 2;          // voiture : largeur, attelage, hauteur, marge haute
  const n = $derived(Math.max(2, Math.min(10, place.of || 5)));
  // voiture 1 = avant du train (données RATP : « Avant » = petits numéros) ; dessinée à droite
  const cars = $derived(Array.from({ length: n }, (_, i) => ({ x: i * (W + G), num: n - i, front: i === n - 1 })));
  const width = $derived(n * (W + G) + 4);
</script>

<svg class="rame" viewBox={`0 0 ${width} ${H + Y + 5}`} width={width} height={H + Y + 5} role="img" aria-label={placeLabel(place)} style:--rame={color}>
  <line class="rail" x1="0" x2={width} y1={H + Y + 4} y2={H + Y + 4} />
  {#each cars as c}
    {@const on = c.num === place.pos}
    <g class:on>
      {#if c.front}
        <!-- cabine de tête : nez arrondi et pare-brise incliné -->
        <path class="body" d={`M${c.x + 3} ${Y}h${W - 8}q5 0 7 5l1.6 6q.6 4-3.4 4H${c.x + 3}q-3 0-3-3V${Y + 3}q0-3 3-3z`} />
        <path class="win" d={`M${c.x + W - 4} ${Y + 3}h2.5q1.5 0 2.2 2l.8 3H${c.x + W - 4}z`} />
        <rect class="win" x={c.x + 2.5} y={Y + 3} width="7" height="5.5" rx="1" />
        <circle class="lamp" cx={c.x + W + 0.6} cy={Y + 11.5} r="1" />
      {:else}
        <rect class="body" x={c.x} y={Y} width={W} height={H} rx="3" />
        <rect class="win" x={c.x + 2.5} y={Y + 3} width="7" height="5.5" rx="1" />
        <rect class="win" x={c.x + W - 9.5} y={Y + 3} width="7" height="5.5" rx="1" />
        <line class="door" x1={c.x + W / 2} x2={c.x + W / 2} y1={Y + 2.5} y2={Y + H - 1.5} />
      {/if}
      <circle class="wheel" cx={c.x + 5} cy={H + Y + 2} r="1.7" />
      <circle class="wheel" cx={c.x + W - 5} cy={H + Y + 2} r="1.7" />
    </g>
    {#if !c.front}<line class="hitch" x1={c.x + W} x2={c.x + W + G} y1={Y + H - 4} y2={Y + H - 4} />{/if}
  {/each}
</svg>

<style>
  .rame { display: block; flex: none; max-width: 100%; height: auto; overflow: visible; }
  .rail { stroke: var(--line); stroke-width: 1.5; }
  .body { fill: var(--card); stroke: var(--muted); stroke-width: 1.3; }
  .win { fill: var(--line); }
  .door { stroke: var(--line); stroke-width: 1; }
  .wheel { fill: var(--muted); }
  .lamp { fill: #F2C200; }
  .hitch { stroke: var(--muted); stroke-width: 1.5; }
  .on .body { fill: var(--rame); stroke: var(--rame); }
  .on .win { fill: #FFFFFF; opacity: 0.9; }
  .on .door { stroke: #FFFFFF; opacity: 0.5; }
</style>
