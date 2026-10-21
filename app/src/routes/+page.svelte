<script>
  import { tx } from '#lib/i18n/index.js';
  import { onMount, setContext } from 'svelte';
  import 'maplibre-gl/dist/maplibre-gl.css';
  import '#lib/ui/base.css';
  import RouteSheet from '#lib/ui/RouteSheet.svelte';
  import NavView from '#lib/ui/NavView.svelte';
  import MapControls from '#lib/ui/MapControls.svelte';
  import StreetThumb from '#lib/ui/StreetThumb.svelte';
  import PromiseBanner from '#lib/ui/PromiseBanner.svelte';
  import ChipsEditor from '#lib/ui/ChipsEditor.svelte';
  import ImportSheet from '#lib/ui/ImportSheet.svelte';
  import TransferSheet from '#lib/ui/TransferSheet.svelte';
  import ListPicker from '#lib/ui/ListPicker.svelte';
  import PhotoViewer from '#lib/ui/PhotoViewer.svelte';
  import TopBar from '#lib/ui/TopBar.svelte';
  import CategorySheet from '#lib/ui/CategorySheet.svelte';
  import PlaceSheet from '#lib/ui/PlaceSheet.svelte';
  import { PARIS } from '#lib/places.js';
  import { search } from '#lib/geocode.js';
  import { dataDate } from '#lib/placestore.js';
  import { hoursStatus, hoursTable, momentLabel } from '#lib/hours.js';
  import { parseIntent, arrName, dietHit } from '#lib/intent.js';
  import { themePref as loadTheme } from '#lib/theme.js';
  import { FAMILIES, GLYPHS } from '#lib/mapstyle.js';
  import { streetRoute, MODE_NAMES, fmtDuration, fmtTime, fmtDistance } from '#lib/routing.js';
  import { bestExit } from '#lib/exits.js';
  import { DEFAULT_LISTS, migratePlaces, restore, uniqueListIds } from '#lib/myplaces.js';
  import { exitForQuay, placeForTransfer } from '#lib/rame.js';
  import { ALL_CATEGORIES, CATEGORY_WORDS, FILLER, loadChipPrefs, categoryFor as catFor } from '#lib/categories.js';
  import { createImport } from '#lib/importflow.js';
  import { createNav } from '#lib/navflow.js';
  import { createDirections } from '#lib/directionsflow.js';
  import { createLocation } from '#lib/location.js';
  import { createScreen } from '#lib/screen.js';
  import { createSearch } from '#lib/searchflow.js';
  import { createPlace } from '#lib/placeflow.js';
  import { createMyPlaces } from '#lib/myplacesflow.js';
  import { createChips } from '#lib/chipsflow.js';
  import { createShortcuts } from '#lib/shortcutsflow.js';
  import { createMapDraw } from '#lib/mapdraw.js';
  import { createZoom } from '#lib/zoom.js';
  import { createMapSetup } from '#lib/mapsetup.svelte.js';
  import { navDistance } from '#lib/nav.js';

  const WALK_COLOR = '#2A5BD7';
  const BIKE_COLOR = WALK_COLOR;   // une seule couleur pour « mon itinéraire », comme Plans

  let mapEl;
  let map;
  let marker;
  let meMarker;

  // ——— Exploration ———
  let query = $state('');
  let results = $state([]);
  let searching = $state(false);
  let searchError = $state('');
  let focused = $state(false);
  let active = $state(-1);

  let category = $state(null);
  let nearby = $state([]);
  let nearbyFromMe = $state(false);
  let nearbyDone = $state(false);

  let place = $state(null);
  let info = $state(null);
  let showWeek = $state(false);
  let wiki = $state(null);           // extrait Wikipédia et photo Commons
  let moreText = $state(false);
  let viewer = $state(null);
  let placeSheetH = $state(null);    // hauteur de la fiche lieu (téléphone), pour poser la vignette de vue de la rue au-dessus
  let innerH = $state(typeof window === 'undefined' ? 800 : window.innerHeight);
  $effect(() => { if (!place) placeSheetH = null; });         // photo affichée en plein écran (indice), null : fermé
  let viewerEl = $state();
  let viewerIdx = $state(0);
  // Zoom dans la visionneuse : pincer, double-toucher, déplacer ; glisser vers le bas (sans zoom) ferme.
  let zoom = $state({ s: 1, x: 0, y: 0 });
  let dragY = $state(0);
  let gesture = null;
  let lastTap = 0;
  $effect(() => {
    zoom = { s: 1, x: 0, y: 0 };
    dragY = 0;
    if (viewer == null || !viewerEl) return;
    viewerIdx = viewer;
    viewerEl.scrollTo({ left: viewer * viewerEl.clientWidth, behavior: 'instant' });
  });
  let deps = $state(null);           // prochains passages d'une station : { status, data? }
  let now = $state(Date.now());
  let locating = $state(false);
  let toast = $state('');
  let me = $state(null); // dernière position connue de l'utilisateur, gardée sur l'appareil
  // Lieux récents : gardés uniquement dans ce navigateur, jamais envoyés ; effaçables d'un geste.
  const RECENTS_KEY = 'lieux-recents';
  let recents = $state(loadRecents());
  // Favoris : même principe, gardés uniquement dans ce navigateur.
  // Mes lieux : lieux enregistrés (chacun dans une ou plusieurs listes), listes, lieux épinglés.
  const FAVS_KEY = 'lieux-favoris';
  const LISTS_KEY = 'mes-listes';
  const PINS_KEY = 'lieux-epingles';
  const BACKUP_KEY = 'derniere-sauvegarde';
  let favorites = $state(migratePlaces(loadList(FAVS_KEY, 5000)));
  let lists = $state((() => { const l = uniqueListIds(loadList(LISTS_KEY, 100)); return l.length ? l : DEFAULT_LISTS; })());
  let pins = $state(loadList(PINS_KEY, 30));
  let showSaved = $state((() => { try { return localStorage.getItem('mes-lieux-carte') !== 'non'; } catch { return true; } })());
  let lastBackup = $state((() => { try { return Number(localStorage.getItem(BACKUP_KEY)) || 0; } catch { return 0; } })());
  let savedList = $state(null);      // liste ouverte dans « Mes lieux » (null : vue d'ensemble)
  let listPicker = $state(false);    // fiche « Enregistrer dans… »
  let hubPanel = $state(null);       // 'transfer' | 'backup' | 'restore' | 'newlist'
  let incoming = $state(null);       // liste partagée ou transfert reçu par lien
  const savedEntry = $derived(place ? favorites.find((f) => sameSpot(f, place)) : null);
  const isFav = $derived(!!savedEntry);
  const listOf = (id) => lists.find((l) => l.id === id) || DEFAULT_LISTS[0];
  const listIcon = (l) => `cat|${l.icon}|${l.color}`;
  // pictogramme blanc (mêmes dessins que la carte) en image, pour les listes dans les fiches
  const glyphUrl = (g) => `data:image/svg+xml,${encodeURIComponent(`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24"><path fill="#fff" fill-rule="evenodd" d="${GLYPHS[g] || GLYPHS.dot}"/></svg>`)}`;
  const placeKey = (p) => (p.osmType ? `${p.osmType}/${p.osmId}` : `${(+p.lat).toFixed(5)},${(+p.lon).toFixed(5)}`);
  const pinnedPlaces = $derived(pins.map((k) => favorites.find((f) => placeKey(f) === k)).filter(Boolean));

  // Maison et Travail : raccourcis gardés sur l'appareil.
  const SHORTCUTS_KEY = 'maison-travail';
  let shortcuts = $state(loadObj(SHORTCUTS_KEY));
  let assigning = $state(null);      // 'home' | 'work' : la prochaine adresse choisie devient ce raccourci
  const SHORT_NAMES = { home: tx('transfert.maison'), work: tx('transfert.travail') };
  const placeShortcut = $derived(place ? ['home', 'work'].find((k) => shortcuts[k] && sameSpot(shortcuts[k], place)) : null);

  // Onglets de catégories
  let chipPrefs = $state(loadChipPrefs());
  const chipList = $derived(chipPrefs.filter((p) => !p.hidden).map((p) => {
    const c = ALL_CATEGORIES.find((x) => x.key === p.key);
    return { ...c, label: p.label?.trim() || c.label };
  }));
  let editChips = $state(false);
  let importOpen = $state(false);
  let importing = $state('');        // message de progression de l'import
  let exits = $state(null);          // sorties de la station ouverte : { status, data? }
  let allExits = $state(false);
  let legExits = $state({});         // sortie conseillée par étape du trajet en transport
  // Promesse affichée à la première ouverture (« ni compte, ni pistage »).
  let showPromise = $state((() => { try { return !localStorage.getItem('promesse-vue'); } catch { return false; } })());
  function closePromise() {
    showPromise = false;
    try { localStorage.setItem('promesse-vue', '1'); } catch { /* rien */ }
  }
  let aboutOpen = $state(false);     // fenêtre « À propos » (bouton ⓘ de la carte)

  // Panorama plein écran : on l'ouvre centré sur le lieu (rel : degrés depuis le centre de la photo)
  function panoScroll(node, rel) {
    const img = node.querySelector('img');
    const center = () => { node.scrollLeft = (rel / 360 + 0.5) * img.clientWidth - node.clientWidth / 2; };
    if (img.complete) center(); else img.addEventListener('load', center, { once: true });
  }

  // ——— Itinéraire ———
  let directions = $state(false);
  let from = $state(null);           // { label, lat, lon, isMe? }
  let to = $state(null);
  let via = $state(null);            // arrêt intermédiaire facultatif
  let showVia = $state(false);
  let mode = $state('walk');
  let pickedStreet = $state(0);      // itinéraire choisi parmi le principal et ses variantes (à pied, vélo, voiture)
  let showSteps = $state(false);
  // Guidage en cours : { kind, mode, steps, coords, cum, total, s, k, off, arrived, … }
  let nav = $state(null);
  let navFollow = $state(true);      // la carte suit la position (jusqu'à ce qu'on la déplace à la main)
  let navList = $state(false);
  let voice = $state(true);
  let editing = $state(null);        // 'from' | 'to' | null
  let fieldQuery = $state('');
  let fieldEl = $state();
  let routes = $state({ walk: null, bike: null, transit: null }); // { status, data?, error? }
  let picked = $state(0);            // proposition de transport choisie
  let mapMode = $state('plan');      // 'plan' | 'transit' | 'satellite'
  let themePref = $state(loadTheme()); // 'auto' | 'light' | 'dark' (theme.js)
  let restyle = () => {};
  let showModes = $state(false);
  let lastEdit = { which: null, at: 0 }; // champ quitté juste avant un toucher sur la carte

  const status = $derived(info?.hours ? hoursStatus(info.hours, place.lat, place.lon) : null);
  const week = $derived(info?.hours ? hoursTable(info.hours, place.lat, place.lon) : null);
  let placeMenu = $state(false);     // menu « ••• » de la fiche lieu
  let osmDate = $state('');
  dataDate().then((d) => { if (d) osmDate = new Date(d).toLocaleDateString('fr-FR', { day: 'numeric', month: 'long' }); }).catch(() => {});
  // Fraîcheur : date de la dernière vérification sur place notée dans OSM (check_date).
  const freshness = $derived.by(() => {
    const d = info?.checkDate ? new Date(info.checkDate) : null;
    if (!d || isNaN(d)) return null;
    const months = (Date.now() - d) / 2.63e9;
    const when = d.toLocaleDateString('fr-FR', { month: 'short', year: 'numeric' });
    return months <= 24 ? { ok: true, text: tx('ecran.infos_verifiees_en', { when }) } : { ok: false, text: tx('ecran.infos_non_verifiees_depuis', { getFullYear: d.getFullYear() }) };
  });
  // Bandeau d'infos (distance, accès, entrée) : seulement ce qui est connu.
  const infoStrip = $derived.by(() => {
    const out = [];
    if (me && place) out.push({ label: tx('ecran.distance'), value: fmtDistance(dist(me.lat, me.lon, place.lat, place.lon)) });
    const wc = { yes: tx('ecran.oui'), limited: tx('ecran.partiel'), no: tx('ecran.non') }[info?.wheelchair];
    if (wc) out.push({ label: tx('ecran.acces_fauteuil'), value: wc, wc: true });
    const fee = { no: tx('ecran.gratuite'), yes: tx('ecran.payante') }[info?.fee];
    if (fee) out.push({ label: tx('ecran.entree'), value: fee });
    return out;
  });
  // Liens vers OpenStreetMap : c'est l'utilisateur qui modifie, sur le site d'OSM (nous n'écrivons rien).
  const osmEditUrl = $derived(place?.osmType ? `https://www.openstreetmap.org/edit?${place.osmType}=${place.osmId}` : null);
  const osmNoteUrl = $derived(place ? `https://www.openstreetmap.org/note/new#map=19/${(+place.lat).toFixed(6)}/${(+place.lon).toFixed(6)}` : '');
  const inFav = $derived(!!savedEntry?.lists?.includes('fav'));
  const isPinned = $derived(!!place && pins.includes(placeKey(place)));
  function favTap() {
    const was = inFav;
    setMembership('fav', !was);
    if (!was) say(tx('ecran.ajoute_a', { name: listOf('fav').name }), { label: tx('ecran.autre_liste'), run: () => (listPicker = true) });
  }
  async function copyAddress() {
    placeMenu = false;
    try { await navigator.clipboard.writeText([title, address].filter(Boolean).join(', ')); say(tx('ecran.adresse_copiee')); } catch { /* refusé */ }
  }
  const activeQuery = $derived(editing ? fieldQuery : query);
  // « restaurant ce soir 8e » : catégorie + moment + zone
  const intent = $derived(editing ? null : parseIntent(query));
  const catHit = $derived.by(() => {
    if (editing) return null;
    const direct = catFor(query, chipList);
    if (direct && !intent?.any) return direct;
    // un régime sans catégorie (« vegan paris 11 ») : des restaurants
    const words = intent?.diet && !intent.words.some((w) => catFor(w, chipList)) ? ['restaurant', ...intent.words] : intent?.words || [];
    if (!intent?.any || !words.length || (intent.diet && !intent.area && !intent.when && words.length === 1 && !intent.words.length)) return direct;
    // une catégorie parmi les mots restants ; les autres mots forment un nom de quartier
    for (const w of words) {
      const c = catFor(w, chipList);
      if (c) {
        const rest = words.filter((x) => !CATEGORY_WORDS[c.key].includes(x) && !FILLER.has(x));
        return { ...c, when: intent.when, area: intent.area || (rest.length ? { text: rest.join(' ') } : null), ...dietHit(c, intent.diet) };
      }
    }
    return direct;
  });
  const whenText = (w) => (!w ? '' : w.now ? tx('ecran.ouverts_maintenant') : `ouverts ${momentLabel(w.at)}`);
  const areaText = (a) => (!a ? '' : a.arr ? arrName(a.arr) : a.text.replace(/^./, (x) => x.toUpperCase()));
  const showList = $derived(editing ? true : focused && (query.trim().length >= 2 || !query.trim()));
  const isAddress = $derived(place?.type === 'Adresse');
  const title = $derived(isAddress ? place.name.split(',')[0] : place?.name);
  const address = $derived(isAddress ? '' : (info?.address && info.address.includes(' ') ? info.address : '') || place?.address || '');
  const current = $derived(routes[mode]);
  const STATION_TYPES = [tx('ecran.station_de_metro'), tx('liste.station'), tx('ecran.gare'), tx('ecran.entree_de_metro'), tx('ecran.station_de_tram')];
  const isStation = $derived(!!place && STATION_TYPES.includes(place.type));
  // « Métro 4 · RER B » : les lignes qui passent, déduites des prochains passages.
  const stationKind = $derived(deps?.status === 'ok'
    ? [...deps.data.lines.reduce((acc, l) => {
        const m = MODE_NAMES[l.mode] || tx('ecran.train');
        if (!acc.has(m)) acc.set(m, new Set());
        if (l.line !== m) acc.get(m).add(l.line);
        return acc;
      }, new Map())].map(([m, ls]) => `${m} ${[...ls].join(', ')}`.trim()).join(' · ')
    : null);

  onMount(() => setupMap());
  let topH = $state(120);
  let searchH = $state(56);   // sur grand écran, les raccourcis sont à droite de la recherche : seule la recherche compte   // hauteur du haut d'écran (recherche, ou départ/arrivée + modes) : la fiche se place dessous
  let bearing = $state(0);
  let pitch = $state(0);

  let dark = $state(false);



  // ——— Carte ———

  // Pendant un itinéraire, les lieux de la carte s'effacent derrière le trajet.
  // Le lieu sélectionné est masqué à sa place (état « sel ») : c'est sa version agrandie qui s'affiche.
  let dimmed = false;





  // ——— Recherche (barre principale ou champ de départ / d'arrivée) ———
  let timer;
  let controller;
  $effect(() => {
    const q = activeQuery.trim();
    clearTimeout(timer);
    controller?.abort();
    searchError = '';
    if (q.length < 2 || (!editing && q === place?.name)) { results = []; searching = false; return; }
    searching = true;
    timer = setTimeout(async () => {
      controller = new AbortController();
      try {
        const c = map?.getCenter();
        // résultats du téléphone tout de suite, complétés par Photon quand il répond (geocode.js)
        const ctl = controller;
        const early = (r) => { if (!ctl.signal.aborted) { results = r; resultsFor = q; active = -1; } };
        results = await search(q, c ? { lat: c.lat, lon: c.lng } : PARIS, controller.signal, early);
        resultsFor = q;
        active = -1;
      } catch (e) {
        if (e.name !== 'AbortError') {
          results = [];
          searchError = tx('ecran.la_recherche_ne_repond_pas_verifiez');
        }
      } finally {
        searching = false;
      }
    }, 250);
  });



  // Sélection d'un lieu : sa propre pastille, agrandie, à la place de la petite (repère rouge pour une adresse).
  let selStates = [];


  function loadList(key, max) {
    try { return JSON.parse(localStorage.getItem(key) || '[]').slice(0, max); } catch { return []; }
  }
  function loadRecents() { return loadList(RECENTS_KEY, 8); }
  function loadObj(key) {
    try { return JSON.parse(localStorage.getItem(key) || '{}') || {}; } catch { return {}; }
  }


  let newListName = $state('');
  let listEditing = $state(false);   // « Modifier » : une poubelle sur chaque lieu de la liste
  let swiped = $state(null);         // lieu glissé vers la gauche (poubelle visible)
  let swipeStart = null;

  // ——— Transfert vers un autre appareil (lien ou QR code) et sauvegarde dans un fichier ———
  let transfer = $state(null);       // { url, qr? }
  let backupPassword = $state('');
  let restoreFile = null;
  let restoreNeedsPw = $state(false);
  let restorePassword = $state('');
  const backupAge = $derived(lastBackup ? Math.floor((Date.now() - lastBackup) / 86400000) : null);

  // Les favoris apparaissent aussi sur la carte (pastille rose à cœur).
  $effect(() => {
    lists;
    const data = favData();
    map?.getSource('favs')?.setData(data);
  });


  // Temps de marche estimé sur le téléphone (distance à vol d'oiseau × 1,3, à 4,8 km/h) : rien n'est envoyé.
  const walkEta = $derived.by(() => {
    if (!me || !place) return null;
    const m = dist(me.lat, me.lon, place.lat, place.lon) * 1.3;
    if (m < 60) return null;
    const min = Math.round(m / 80);
    return min <= 45 ? tx('ecran.min_a_pied', { min }) : `≈ ${fmtDistance(m)}`;   // (texte complet pour l’accessibilité)
  });


  $effect(() => {
    if (!isStation || directions) return;
    const p = place;
    const t = setInterval(() => { now = Date.now(); loadDepartures(p); }, 30000);
    const tick1 = setInterval(() => (now = Date.now()), 10000);
    return () => { clearInterval(t); clearInterval(tick1); };
  });




  $effect(() => { nearby; category; applyHit(category); });


  // Filtre « ouvert à… » : null (pas de filtre) | { now: true } | { at: Date }
  let openAt = $state(null);
  let showUnknown = $state(false);   // afficher aussi les lieux aux horaires inconnus
  let resultsFor = '';               // texte pour lequel « results » a été calculé (Entrée tapée avant la réponse)
  let filters = $state([]);          // filtres actifs de la liste : terrasse, végétarien… (filters.js)
  let momentPicker = $state(false);
  let nearbyAll = $state.raw([]);                 // lieux trouvés avant filtre (avec leurs horaires bruts)
  let openCounts = $state(null);      // { open, unknown, closed }
  // Choix du moment : jour et heure
  const pickerDays = $derived.by(() => {
    const out = [];
    for (let i = 0; i < 7; i++) {
      const d = new Date(); d.setDate(d.getDate() + i);
      out.push({ i, label: i === 0 ? tx('ecran.aujourd_hui') : i === 1 ? tx('ecran.demain') : d.toLocaleDateString('fr-FR', { weekday: 'long' }).replace(/^./, (x) => x.toUpperCase()) });
    }
    return out;
  });
  const pickerHours = Array.from({ length: 44 }, (_, k) => { const m = 6 * 60 + k * 30; return [Math.floor(m / 60) % 24, m % 60]; });
  const pickerDay = $derived(openAt?.at ? Math.max(0, Math.round((new Date(openAt.at).setHours(0, 0, 0, 0) - new Date().setHours(0, 0, 0, 0)) / 864e5) - (openAt.at.getHours() < 6 ? 1 : 0)) : 0);
  const pickerTime = $derived(openAt?.at ? `${openAt.at.getHours()}:${openAt.at.getMinutes()}` : '20:0');

  let userMoved = false;
  let reloadTimer = null;
  let catRequest = 0;
  // Recharger la catégorie ouverte pour la zone affichée (après un déplacement de la carte à la main).
  let reloadLater = false;
  let viewChosen = false;   // la personne a choisi ce qu'elle regarde (carte déplacée, lieu ou quartier cherché)







  // Message bref ; avec une action (« Annuler ») pour revenir sur un geste qui efface quelque chose.
  let toastAction = $state(null);
  let toastTimer;
  $effect(() => { category; directions; showSaved; isolate(); });

  // Retour : une entrée d'historique tant qu'un panneau est ouvert, pour que « Retour » le ferme
  // au lieu de quitter l'app.
  const anyOpen = $derived(!!(place || category || directions || editChips || importOpen || listPicker || viewer != null));
  let skipPop = false;
  $effect(() => {
    if (anyOpen && !history.state?.ui) history.pushState({ ...(history.state || {}), ui: 1 }, '', location.href);
    else if (!anyOpen && history.state?.ui) { skipPop = true; history.back(); }
  });
  // Revenir en arrière dans l'historique ne doit pas ramener la carte là où elle était à l'ouverture du panneau :
  // on garde la vue actuelle dans l'adresse (avant que la carte ne relise l'adresse).
  let viewHash = '';



  // ——— Direction (boussole) ———
  // Le cap vient de la boussole du téléphone ; à défaut, du sens de la marche (GPS) quand on avance.
  // Rien n'est envoyé : tout reste sur l'appareil.
  let heading = null;            // degrés, 0 = nord
  let compassOn = false;
  let lastCompass = 0;
  let followMode = $state('none');   // 'none' | 'follow' (la carte vous suit) | 'heading' (la carte tourne avec vous)
  let posWatch = null;












  let routeCtrl;



  // ——— Guidage ———
  let navWatch = null;
  let wakeLock = null;
  let offCount = 0;
  let rerouting = false;
  let arriveCount = 0;
  let spoken = new Set();
  let navTick;
  const NAV = { walk: { far: 120, near: 25, off: 35, zoom: 17.6 }, bike: { far: 200, near: 40, off: 45, zoom: 17 },
                car: { far: 500, near: 120, off: 50, zoom: 16.3 }, transit: { far: 0, near: 0, off: 9999, zoom: 16.5 } };




  let when = $state(null);           // heure du trajet : null (maintenant) ou { t, arrive } (when.js)
  let transitPref = $state(['metro', 'rail', 'tram', 'bus']);   // familles de transports gardées (routing.js TRANSIT_KINDS)
  let lastFix = $state(null);   // dernière position reçue pendant le guidage (sans elle : étapes à la main)



  // l'écran peut se rallumer après un passage en arrière-plan : on redemande à le garder allumé
  $effect(() => {
    const again = async () => { if (nav && document.visibilityState === 'visible') { try { wakeLock = await navigator.wakeLock?.request('screen'); } catch { /* rien */ } } };
    document.addEventListener('visibilitychange', again);
    return () => document.removeEventListener('visibilitychange', again);
  });

  // Ce qu'affiche le bandeau du haut
  const navBanner = $derived.by(() => {
    if (!nav) return null;
    if (nav.arrived) return { arrived: true, text: tx('ecran.vous_etes_arrive', {  }), sub: to?.label };
    if (nav.kind === 'transit') {
      const st = nav.steps[nav.k];
      return { icon: st.type, text: st.text, sub: st.sub, then: nav.steps[nav.k + 1]?.text, line: st.leg };
    }
    const next = nav.steps[nav.k + 1];
    if (!next) return { icon: 'arrive', dist: navDistance(nav.total - nav.s), text: tx('itin.arrivee_3', { label: to.label }) };
    return { icon: next.type, dist: navDistance(next.s - nav.s), text: next.text, then: nav.steps[nav.k + 2]?.text || tx('itin.arrivee_3', { label: to.label }) };
  });
  const navRemaining = $derived.by(() => {
    if (!nav) return null;
    const left = nav.kind === 'transit' ? Math.max(0, (nav.end - now) / 1000) : nav.duration * Math.max(0, 1 - nav.s / nav.total);
    return { eta: fmtTime(new Date(now + left * 1000)), min: fmtDuration(left), km: fmtDistance(Math.max(0, nav.total - nav.s)) };
  });


  const famColor = (c) => c.color || FAMILIES[c.family].color;

  // À la descente du métro ou du RER : sortie conseillée (la plus proche de l'étape suivante, d'après OSM)
  // et place dans la rame (données RATP / IDFM). Pour une correspondance : place pour changer au plus vite.
  $effect(() => {
    const r = routes.transit;
    if (mode !== 'transit' || r?.status !== 'ok' || !r.data[picked]) return;
    const it = r.data[picked];
    it.legs.forEach((leg, i) => {
      if (!['SUBWAY', 'METRO', 'REGIONAL_RAIL', 'SUBURBAN'].includes(leg.mode) || !leg.toPos) return;
      const k = `${picked}|${i}|${leg.to}`;
      if (legExits[k] !== undefined) return;
      legExits[k] = null;
      const after = it.legs.slice(i + 1);
      let nextRide = after.find((l) => l.mode !== 'WALK');
      if (nextRide?.mode === 'STOP') nextRide = null;          // on sort pour l'arrêt intermédiaire
      const walkBetween = after.slice(0, after.indexOf(nextRide)).reduce((t, l) => t + (l.duration || 0), 0);
      const RAIL = ['SUBWAY', 'METRO', 'REGIONAL_RAIL', 'SUBURBAN'];
      if (nextRide && RAIL.includes(nextRide.mode) && walkBetween <= 600) {
        // correspondance métro/RER dans la station (ou tout près) : pas de sortie, mais la bonne voiture
        // (vers un bus ou un tram, on sort : on conseille la sortie la plus proche de l'arrêt)
        placeForTransfer(leg.toStop, nextRide.fromStop)
          .then((pl) => { legExits[k] = pl ? { place: pl, transfer: nextRide } : false; })
          .catch(() => { legExits[k] = false; });
        return;
      }
      const nextLeg = after[0];
      const goal = nextLeg?.coords?.length ? { lon: nextLeg.coords.at(-1)[0], lat: nextLeg.coords.at(-1)[1] } : to;
      // Sortie RATP la plus proche de la suite du trajet, avec la voiture où monter ; sinon, sortie OSM sans placement.
      exitForQuay(leg.toStop, goal).catch(() => null)
        .then(async (ratp) => ratp || bestExit(leg.toPos, goal).then((e) => (e ? { exit: e, place: null } : null)))
        .then(async (hit) => {
          const e = hit?.exit;
          legExits[k] = hit || false;
          // Le trajet à pied part de cette sortie, pas du centre de la station (un seul calcul, pour le trajet choisi)
          if (e && nextLeg?.mode === 'WALK' && !nextLeg.fromExit && e.lat != null && e.lon != null) {
            const w = await streetRoute({ lat: e.lat, lon: e.lon }, goal, 'walk').catch(() => null);
            const cur = routes.transit?.data?.[picked];
            if (w?.coords?.length && cur === it) {
              nextLeg.coords = w.coords;
              nextLeg.fromExit = true;
              drawRoute();
            }
          }
        })
        .catch(() => { legExits[k] = false; });
    });
  });

  // <app> État et actions partagés avec les composants et modules de l'écran (getContext('app')). Bloc généré.
  const app = {
    get aboutOpen() { return aboutOpen; }, set aboutOpen(v) { aboutOpen = v; },
    get openResult() { return openResult; }, get showAllResults() { return showAllResults; },
    get resultsFor() { return resultsFor; }, get filters() { return filters; }, set filters(v) { filters = v; }, get toggleFilter() { return toggleFilter; },
    get transitPref() { return transitPref; }, set transitPref(v) { transitPref = v; }, get setTransitPref() { return setTransitPref; },
    get themePref() { return themePref; }, set themePref(v) { themePref = v; }, get restyle() { return restyle; }, set restyle(v) { restyle = v; },
    get when() { return when; }, set when(v) { when = v; }, get setWhen() { return setWhen; }, get openDirections() { return openDirections; },
    get setListStyle() { return setListStyle; },
    get BACKUP_KEY() { return BACKUP_KEY; }, get BIKE_COLOR() { return BIKE_COLOR; }, get FAVS_KEY() { return FAVS_KEY; },
    get LISTS_KEY() { return LISTS_KEY; }, get NAV() { return NAV; }, get PINS_KEY() { return PINS_KEY; },
    get RECENTS_KEY() { return RECENTS_KEY; }, get SHORTCUTS_KEY() { return SHORTCUTS_KEY; }, get SHORT_NAMES() { return SHORT_NAMES; },
    get STATION_TYPES() { return STATION_TYPES; }, get WALK_COLOR() { return WALK_COLOR; },
    get active() { return active; }, set active(v) { active = v; }, get activeQuery() { return activeQuery; },
    get addCustomLayers() { return addCustomLayers; }, get address() { return address; },
    get allExits() { return allExits; }, set allExits(v) { allExits = v; }, get anyOpen() { return anyOpen; },
    get applyHit() { return applyHit; }, get applyIncoming() { return applyIncoming; }, get applyOpenFilter() { return applyOpenFilter; },
    get areaText() { return areaText; }, get arriveCount() { return arriveCount; }, set arriveCount(v) { arriveCount = v; },
    get assigning() { return assigning; }, set assigning(v) { assigning = v; }, get backupAge() { return backupAge; },
    get backupPassword() { return backupPassword; }, set backupPassword(v) { backupPassword = v; },
    get bearing() { return bearing; }, set bearing(v) { bearing = v; }, get catHit() { return catHit; }, get catIcon() { return catIcon; },
    get catOf() { return catOf; }, get catRequest() { return catRequest; }, set catRequest(v) { catRequest = v; },
    get category() { return category; }, set category(v) { category = v; }, get chipList() { return chipList; },
    get chipPrefs() { return chipPrefs; }, set chipPrefs(v) { chipPrefs = v; }, get clearCategory() { return clearCategory; },
    get clearPhotoPins() { return clearPhotoPins; }, get clearSearch() { return clearSearch; }, get clearSelection() { return clearSelection; },
    get closeDirections() { return closeDirections; }, get closePlace() { return closePlace; }, get closePromise() { return closePromise; },
    get compassOn() { return compassOn; }, set compassOn(v) { compassOn = v; }, get computeRoutes() { return computeRoutes; },
    get copyAddress() { return copyAddress; }, get createList() { return createList; }, get current() { return current; },
    get dark() { return dark; }, set dark(v) { dark = v; }, get deleteList() { return deleteList; },
    get deps() { return deps; }, set deps(v) { deps = v; }, get dimPlaces() { return dimPlaces; },
    get dimmed() { return dimmed; }, set dimmed(v) { dimmed = v; },
    get directions() { return directions; }, set directions(v) { directions = v; }, get displayName() { return displayName; },
    get dist() { return dist; }, get doRestore() { return doRestore; }, get dragY() { return dragY; }, set dragY(v) { dragY = v; },
    get drawRoute() { return drawRoute; }, get editChips() { return editChips; }, set editChips(v) { editChips = v; },
    get editField() { return editField; }, get editing() { return editing; }, set editing(v) { editing = v; }, get endNav() { return endNav; },
    get exits() { return exits; }, set exits(v) { exits = v; }, get famColor() { return famColor; }, get favTap() { return favTap; },
    get favorites() { return favorites; }, set favorites(v) { favorites = v; },
    get fieldEl() { return fieldEl; }, set fieldEl(v) { fieldEl = v; },
    get fieldQuery() { return fieldQuery; }, set fieldQuery(v) { fieldQuery = v; }, get fitTo() { return fitTo; },
    get focused() { return focused; }, set focused(v) { focused = v; },
    get followMode() { return followMode; }, set followMode(v) { followMode = v; }, get forgetRecents() { return forgetRecents; },
    get frame() { return frame; }, get freshness() { return freshness; }, get from() { return from; }, set from(v) { from = v; },
    get gesture() { return gesture; }, set gesture(v) { gesture = v; }, get getPosition() { return getPosition; },
    get heading() { return heading; }, set heading(v) { heading = v; }, get hubPanel() { return hubPanel; }, set hubPanel(v) { hubPanel = v; },
    get importFile() { return importFile; }, get importOpen() { return importOpen; }, set importOpen(v) { importOpen = v; },
    get importing() { return importing; }, set importing(v) { importing = v; }, get inFav() { return inFav; },
    get incoming() { return incoming; }, set incoming(v) { incoming = v; }, get info() { return info; }, set info(v) { info = v; },
    get infoStrip() { return infoStrip; }, get innerH() { return innerH; }, set innerH(v) { innerH = v; },
    get isAddress() { return isAddress; }, get isFav() { return isFav; }, get isPinned() { return isPinned; },
    get isStation() { return isStation; }, get isolate() { return isolate; }, get keepIncomingList() { return keepIncomingList; },
    get labelColor() { return labelColor; }, get lastBackup() { return lastBackup; }, set lastBackup(v) { lastBackup = v; },
    get lastCompass() { return lastCompass; }, set lastCompass(v) { lastCompass = v; },
    get lastEdit() { return lastEdit; }, set lastEdit(v) { lastEdit = v; }, get lastFix() { return lastFix; }, set lastFix(v) { lastFix = v; },
    get lastTap() { return lastTap; }, set lastTap(v) { lastTap = v; }, get legExits() { return legExits; }, set legExits(v) { legExits = v; },
    get line() { return line; }, get listEditing() { return listEditing; }, set listEditing(v) { listEditing = v; },
    get listIcon() { return listIcon; }, get listOf() { return listOf; },
    get listPicker() { return listPicker; }, set listPicker(v) { listPicker = v; }, get lists() { return lists; }, set lists(v) { lists = v; },
    get locError() { return locError; }, get locate() { return locate; },
    get locating() { return locating; }, set locating(v) { locating = v; }, get makeBackup() { return makeBackup; },
    get makeTransfer() { return makeTransfer; }, get map() { return map; }, set map(v) { map = v; },
    get mapEl() { return mapEl; }, set mapEl(v) { mapEl = v; }, get mapMode() { return mapMode; }, set mapMode(v) { mapMode = v; },
    get marker() { return marker; }, set marker(v) { marker = v; }, get me() { return me; }, set me(v) { me = v; },
    get meMarker() { return meMarker; }, set meMarker(v) { meMarker = v; }, get mode() { return mode; }, set mode(v) { mode = v; },
    get momentFrom() { return momentFrom; }, get momentPicker() { return momentPicker; }, set momentPicker(v) { momentPicker = v; },
    get moreText() { return moreText; }, set moreText(v) { moreText = v; }, get moveChip() { return moveChip; },
    get nav() { return nav; }, set nav(v) { nav = v; }, get navFollow() { return navFollow; }, set navFollow(v) { navFollow = v; },
    get navList() { return navList; }, set navList(v) { navList = v; }, get navTick() { return navTick; }, set navTick(v) { navTick = v; },
    get navWatch() { return navWatch; }, set navWatch(v) { navWatch = v; }, get nearby() { return nearby; }, set nearby(v) { nearby = v; },
    get nearbyAll() { return nearbyAll; }, set nearbyAll(v) { nearbyAll = v; },
    get nearbyDone() { return nearbyDone; }, set nearbyDone(v) { nearbyDone = v; },
    get nearbyFromMe() { return nearbyFromMe; }, set nearbyFromMe(v) { nearbyFromMe = v; },
    get newListName() { return newListName; }, set newListName(v) { newListName = v; }, get now() { return now; }, set now(v) { now = v; },
    get offCount() { return offCount; }, set offCount(v) { offCount = v; }, get onKey() { return onKey; },
    get onKeyDown() { return onKeyDown; }, get onMapClick() { return onMapClick; }, get onPopState() { return onPopState; },
    get openAt() { return openAt; }, set openAt(v) { openAt = v; }, get openCategoryFromSearch() { return openCategoryFromSearch; },
    get openCounts() { return openCounts; }, set openCounts(v) { openCounts = v; }, get openFeature() { return openFeature; },
    get openPlace() { return openPlace; }, get openPoint() { return openPoint; }, get openSavedList() { return openSavedList; },
    get osmDate() { return osmDate; }, set osmDate(v) { osmDate = v; }, get osmEditUrl() { return osmEditUrl; },
    get osmNoteUrl() { return osmNoteUrl; }, get panoScroll() { return panoScroll; }, get pickCategory() { return pickCategory; },
    get pickOnMap() { return pickOnMap; }, get pickResult() { return pickResult; }, get pickStreet() { return pickStreet; },
    get picked() { return picked; }, set picked(v) { picked = v; },
    get pickedStreet() { return pickedStreet; }, set pickedStreet(v) { pickedStreet = v; }, get pickerDay() { return pickerDay; },
    get pickerDays() { return pickerDays; }, get pickerHours() { return pickerHours; }, get pickerTime() { return pickerTime; },
    get pinnedPlaces() { return pinnedPlaces; }, get pins() { return pins; }, set pins(v) { pins = v; },
    get pitch() { return pitch; }, set pitch(v) { pitch = v; }, get place() { return place; }, set place(v) { place = v; },
    get placeKey() { return placeKey; }, get placeMarker() { return placeMarker; },
    get placeMenu() { return placeMenu; }, set placeMenu(v) { placeMenu = v; },
    get placeSheetH() { return placeSheetH; }, set placeSheetH(v) { placeSheetH = v; }, get placeShortcut() { return placeShortcut; },
    get pointOf() { return pointOf; }, get posWatch() { return posWatch; }, set posWatch(v) { posWatch = v; },
    get query() { return query; }, set query(v) { query = v; }, get quickMoment() { return quickMoment; },
    get recents() { return recents; }, set recents(v) { recents = v; }, get refreshSaved() { return refreshSaved; },
    get reloadCategoryHere() { return reloadCategoryHere; }, get reloadLater() { return reloadLater; }, set reloadLater(v) { reloadLater = v; },
    get reloadTimer() { return reloadTimer; }, set reloadTimer(v) { reloadTimer = v; }, get remember() { return remember; },
    get removeFromList() { return removeFromList; }, get removeStop() { return removeStop; }, get renameChip() { return renameChip; },
    get renameList() { return renameList; }, get rerouting() { return rerouting; }, set rerouting(v) { rerouting = v; },
    get resetChips() { return resetChips; }, get restoreFile() { return restoreFile; }, set restoreFile(v) { restoreFile = v; },
    get restoreNeedsPw() { return restoreNeedsPw; }, set restoreNeedsPw(v) { restoreNeedsPw = v; },
    get restorePassword() { return restorePassword; }, set restorePassword(v) { restorePassword = v; },
    get results() { return results; }, set results(v) { results = v; },
    get routeCtrl() { return routeCtrl; }, set routeCtrl(v) { routeCtrl = v; }, get routes() { return routes; }, set routes(v) { routes = v; },
    get sameSpot() { return sameSpot; }, get saveAll() { return saveAll; }, get saveChips() { return saveChips; },
    get saveFavorites() { return saveFavorites; }, get savedEntry() { return savedEntry; },
    get savedList() { return savedList; }, set savedList(v) { savedList = v; }, get say() { return say; },
    get searchError() { return searchError; }, set searchError(v) { searchError = v; },
    get searchH() { return searchH; }, set searchH(v) { searchH = v; },
    get searching() { return searching; }, set searching(v) { searching = v; },
    get selStates() { return selStates; }, set selStates(v) { selStates = v; }, get setMapMode() { return setMapMode; },
    get setMembership() { return setMembership; }, get setOpenAt() { return setOpenAt; }, get setPoint() { return setPoint; },
    get setShortcut() { return setShortcut; }, get shareList() { return shareList; }, get sharePlace() { return sharePlace; },
    get shareTransfer() { return shareTransfer; }, get shortcuts() { return shortcuts; }, set shortcuts(v) { shortcuts = v; },
    get showList() { return showList; }, get showMe() { return showMe; },
    get showModes() { return showModes; }, set showModes(v) { showModes = v; },
    get showPromise() { return showPromise; }, set showPromise(v) { showPromise = v; },
    get showSaved() { return showSaved; }, set showSaved(v) { showSaved = v; }, get showSelection() { return showSelection; },
    get showSteps() { return showSteps; }, set showSteps(v) { showSteps = v; },
    get showUnknown() { return showUnknown; }, set showUnknown(v) { showUnknown = v; },
    get showVia() { return showVia; }, set showVia(v) { showVia = v; }, get showWeek() { return showWeek; }, set showWeek(v) { showWeek = v; },
    get skipPop() { return skipPop; }, set skipPop(v) { skipPop = v; }, get spoken() { return spoken; }, set spoken(v) { spoken = v; },
    get startDirections() { return startDirections; }, get startWatch() { return startWatch; }, get startupLocate() { return startupLocate; },
    get stationKind() { return stationKind; }, get status() { return status; }, get stopWatch() { return stopWatch; },
    get swap() { return swap; }, get swipeStart() { return swipeStart; }, set swipeStart(v) { swipeStart = v; },
    get swiped() { return swiped; }, set swiped(v) { swiped = v; }, get title() { return title; },
    get to() { return to; }, set to(v) { to = v; }, get toast() { return toast; }, set toast(v) { toast = v; },
    get toastAction() { return toastAction; }, set toastAction(v) { toastAction = v; },
    get toastTimer() { return toastTimer; }, set toastTimer(v) { toastTimer = v; }, get toggleChip() { return toggleChip; },
    get togglePin() { return togglePin; }, get toggleZoom() { return toggleZoom; }, get topH() { return topH; }, set topH(v) { topH = v; },
    get transfer() { return transfer; }, set transfer(v) { transfer = v; }, get useMyPosition() { return useMyPosition; },
    get useShortcut() { return useShortcut; }, get userMoved() { return userMoved; }, set userMoved(v) { userMoved = v; },
    get via() { return via; }, set via(v) { via = v; }, get viewChosen() { return viewChosen; }, set viewChosen(v) { viewChosen = v; },
    get viewHash() { return viewHash; }, set viewHash(v) { viewHash = v; }, get viewer() { return viewer; }, set viewer(v) { viewer = v; },
    get viewerEl() { return viewerEl; }, set viewerEl(v) { viewerEl = v; },
    get viewerIdx() { return viewerIdx; }, set viewerIdx(v) { viewerIdx = v; }, get voice() { return voice; }, set voice(v) { voice = v; },
    get wakeLock() { return wakeLock; }, set wakeLock(v) { wakeLock = v; }, get walkEta() { return walkEta; }, get week() { return week; },
    get whenText() { return whenText; }, get wiki() { return wiki; }, set wiki(v) { wiki = v; },
    get zoom() { return zoom; }, set zoom(v) { zoom = v; }, get zoomEnd() { return zoomEnd; }, get zoomMove() { return zoomMove; },
    get zoomStart() { return zoomStart; },
  };
  setContext('app', app);
  // </app>
  const { setupMap } = createMapSetup(app);
  const { clampZoom, toggleZoom, zoomStart, zoomMove, zoomEnd } = createZoom(app);
  const { favData, addCustomLayers, drawRoute, line, shade, dimPlaces, setMapMode, fitOptions, boundsOf, fitTo, onMapClick, openPoint, openFeature, frame, placeMarker, labelColor, clearSelPhoto, clearPhotoPins, clearSelection, showSelection } = createMapDraw(app);
  const { saveFavorites, setShortcut, useShortcut } = createShortcuts(app);
  const { saveChips, moveChip, toggleChip, renameChip, resetChips, catOf } = createChips(app);
  const { sameSpot, saveAll, keepOf, saveTap, setMembership, togglePin, removeFromList, createList, renameList, setListStyle, deleteList, refreshSaved, openSavedList, shareList, keepIncomingList, makeTransfer, shareTransfer, applyIncoming, makeBackup, doRestore } = createMyPlaces(app);
  const { remember, forgetRecents, openPlace, sharePlace, loadDepartures, closePlace } = createPlace(app);
  const { clearSearch, hitFilter, catIcon, applyHit, displayName, collectCategory, applyOpenFilter, setOpenAt, momentFrom, quickMoment, nearView, reloadCategoryHere, pickCategory, clearCategory, dist, openCategoryFromSearch, onKey, pickResult, openResult, showAllResults, toggleFilter } = createSearch(app);
  const { say, isolate, closeTop, onPopState, onKeyDown, undoToast, showMe } = createScreen(app);
  const { setHeading, onOrientation, startCompass, startWatch, stopWatch, getPosition, startupLocate, locError, locDetail, locate, pickOnMap } = createLocation(app);
  const { startDirections, openDirections, closeDirections, pointOf, setPoint, addStop, removeStop, editField, useMyPosition, swap, computeRoutes, chooseMode, sheetToTop, pickStreet, pickTransit, setTransitPref, setWhen } = createDirections(app);
  const { speak, transitSteps, startNav, onFix, updateNav, stepBy, reroute, endNav } = createNav(app);
  const { importFile } = createImport(app);
</script>

<svelte:window bind:innerHeight={innerH} />
<div class="app" class:routing={directions} class:navigating={!!nav} style:--top-h={`${directions ? topH : searchH + 16}px`}>
  <div class="map" role="region" bind:this={mapEl} aria-label={tx('ecran.carte')}></div>

  <TopBar />

  <MapControls />
  {#if nav && navBanner}
    <NavView {nav} {navBanner} {navRemaining} {to} {navFollow} bind:navList bind:voice {endNav} manual={!lastFix} {stepBy}
      recenter={() => { navFollow = true; updateNav(); }} />
  {/if}
  <StreetThumb />
  <PhotoViewer />
  {#if toast}<p class="toast" role="status">{toast}{#if toastAction}<button onclick={undoToast}>{toastAction.label}</button>{/if}</p>{/if}
  <PromiseBanner />

  {#if listPicker && place && !directions}
    <ListPicker />
  {:else if incoming?.kind === 'transfer' && !directions}
    <TransferSheet />
  {:else if importOpen && !directions}
    <ImportSheet />
  {:else if editChips && !directions}
    <ChipsEditor />
  {:else if directions && !editing && !nav}
    <RouteSheet {from} {to} {mode} {routes} {picked} {pickedStreet} {showVia} {legExits}
      {chooseMode} {pickStreet} {pickTransit} {startNav} {addStop} {computeRoutes} {transitPref} {setTransitPref} {when} />
  {:else if place && !directions}
    <PlaceSheet />
  {:else if category && !directions}
    <!-- Liste d'une catégorie : ouverte en aperçu (la carte reste visible), on l'agrandit si on veut la liste ;
         la faire glisser vers le bas la réduit sans fermer la catégorie (seule la croix ou le raccourci la ferment). -->
    <CategorySheet />
  {/if}
</div>

<style>  :global(html, body) {
    margin: 0; height: 100%; overflow: hidden; background: var(--page);
    font-family: var(--ui); color: var(--ink); -webkit-font-smoothing: antialiased;
    -webkit-tap-highlight-color: transparent;
  }

  .app { position: fixed; inset: 0; }
  .map { position: absolute; inset: 0; }
  @keyframes pulse { 50% { opacity: 0.35; } }
  .toast {
    position: absolute; z-index: 4; left: 12px; right: 72px; bottom: calc(52px + env(safe-area-inset-bottom));
    margin: 0; padding: 13px 16px; background: rgb(28 29 31 / 0.92); color: #fff; border-radius: 14px; font-size: 14px; max-width: 360px;
    display: flex; align-items: center; gap: 12px;
  }
  .toast button { margin-left: auto; border: 0; background: none; color: #8fb4ff; font-weight: 700; font-size: 14px; padding: 6px 2px; min-height: 36px; cursor: pointer; }
  .navigating .toast { bottom: calc(96px + env(safe-area-inset-bottom)); right: 12px; }
  @keyframes appear-thumb { from { opacity: 0; transform: scale(0.92); } }
  @keyframes pulse { 50% { opacity: 0.35; } }
</style>
