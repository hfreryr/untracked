<script>
  import { tx } from '#lib/i18n/index.js';
  import { CONTACT_EMAIL } from '#lib/config.js';
  // Page « Qui voit quoi » : ce que l'app envoie, à qui, et ce que chaque service en fait (vérifié le 13/10/2026).
  const rows = [
    [tx('confidentialite.fond_de_carte'), tx('confidentialite.openfreemap_projet_independant'), tx('confidentialite.votre_adresse_ip_et_la_zone_de_carte'), tx('confidentialite.journaux_anonymises_sans_ip_effaces'), 'https://openfreemap.org/privacy/'],
    [tx('confidentialite.details_des_lieux_listes_horaires'), tx('confidentialite.nos_propres_fichiers_prepares_chaque'), tx('confidentialite.rien_ce_sont_des_fichiers_servis'), tx('confidentialite.heberges_par_github_pages_pour'), 'https://docs.github.com/en/pages'],
    [tx('confidentialite.photos_de_devanture'), tx('confidentialite.panoramax_ville_de_paris_ign_osm'), tx('confidentialite.votre_ip_et_la_photo_demandee'), tx('confidentialite.service_public_images_servies_depuis'), 'https://panoramax.fr'],
    [tx('confidentialite.vue_satellite'), tx('confidentialite.geoplateforme_ign_service_public'), tx('confidentialite.votre_ip_et_la_zone_satellite'), tx('confidentialite.service_public_francais'), 'https://geoservices.ign.fr/bdortho'],
    [tx('confidentialite.adresses'), tx('confidentialite.geoplateforme_ign_service_public'), tx('confidentialite.votre_ip_et_adresse_tapee'), tx('confidentialite.service_public_francais'), 'https://www.data.gouv.fr/dataservices/api-geoplateforme-geocodage'],
    [tx('confidentialite.noms_de_lieux'), tx('confidentialite.photon_instance_publique_de_komoot'), tx('confidentialite.votre_ip_et_le_texte_tape'), tx('confidentialite.aucune_politique_publiee_a_remplacer'), 'https://photon.komoot.io'],
    [tx('confidentialite.itineraires_a_pied_velo_voiture'), tx('confidentialite.valhalla_serveur_public_fossgis'), tx('confidentialite.votre_ip_le_depart_souvent_votre'), tx('confidentialite.fossgis_conditions'), 'https://www.fossgis.de/arbeitsgruppen/osm-server/nutzungsbedingungen/'],
    [tx('confidentialite.transports_en_commun'), tx('confidentialite.transitous_projet_libre'), tx('confidentialite.votre_ip_le_depart_et_arrivee_la'), tx('confidentialite.aucune_politique_publiee_a_remplacer'), 'https://transitous.org'],
    [tx('confidentialite.avis_publies'), tx('confidentialite.mangrove_association'), tx('confidentialite.mangrove_recoit'), tx('confidentialite.mangrove_politique'), 'https://mangrove.reviews/terms'],
    [tx('confidentialite.photos_et_textes_des_monuments'), tx('confidentialite.wikimedia_wikidata_wikipedia_commons'), tx('confidentialite.votre_ip_et_le_lieu_consulte'), tx('confidentialite.fondation_a_but_non_lucratif_sans'), 'https://foundation.wikimedia.org/wiki/Policy:Privacy_policy']
  ];
</script>

<svelte:head><title>{tx('confidentialite.qui_voit_quoi_untracked_maps')}</title></svelte:head>

<div class="scroller">
<main>
  <a class="back" href="/">{tx('confidentialite.retour_a_la_carte')}</a>
  <h1>{tx('confidentialite.qui_voit_quoi')}</h1>
  <p class="lead">{tx('confidentialite.untracked_maps_ne_collecte_rien_sur')}</p>
  <p>{tx('confidentialite.mais_une_carte_a_besoin_de_services')} <strong>{tx('confidentialite.ces_services_recoivent_votre_adresse')}</strong>{tx('confidentialite.comme_importe_quel_site_que_vous')}</p>
  <table>
    <thead><tr><th>{tx('confidentialite.pour')}</th><th>{tx('confidentialite.service')}</th><th>{tx('confidentialite.ce_il_recoit')}</th><th>{tx('confidentialite.ce_il_en_fait')}</th></tr></thead>
    <tbody>
      {#each rows as [what, who, gets, does, url]}
        <tr><td>{what}</td><td><a href={url} target="_blank" rel="noopener">{who}</a></td><td>{gets}</td><td>{does}</td></tr>
      {/each}
    </tbody>
  </table>
  <h2>{tx('confidentialite.ce_qui_ne_quitte_jamais_votre')}</h2>
  <ul>
    <li>{tx('confidentialite.vos_lieux_enregistres_vos_listes')}</li>
    <li>{tx('confidentialite.votre_position_sauf_pour_calculer_un')}</li>
    <li>{tx('confidentialite.historique_de_vos_recherches')}</li>
  </ul>
  <h2 id="verifier">{tx('confidentialite.verifiez_vous_meme')}</h2>
  <ul>
    <li>{tx('confidentialite.verif_traceurs')}</li>
    <li>{tx('confidentialite.verif_cookies')}</li>
    <li>{tx('confidentialite.verif_code')} <a href="https://github.com/hfreryr/untracked" target="_blank" rel="noopener">{tx('confidentialite.github_com_hfreryr_untracked')}</a>.</li>
    <li>{tx('confidentialite.verif_tests')}</li>
  </ul>
  <h2>{tx('confidentialite.ce_que_nous_changerons_avant_tout')}</h2>
  <p>{tx('confidentialite.la_recherche_les_itineraires_et_les')} <strong>{tx('confidentialite.nos_propres_serveurs_sans_journaux')}</strong>{tx('confidentialite.cette_page_sera_mise_a_jour_a_chaque')}</p>
  <h2>{tx('confidentialite.securite')}</h2>
  <ul>
    <li>{tx('confidentialite.app_est_un_site_sans_serveur_ni')}</li>
    <li>{tx('confidentialite.votre_navigateur_execute_que_notre')}</li>
    <li>{tx('confidentialite.les_liens_de_partage_les_sauvegardes')}</li>
    <li>{tx('confidentialite.une_faille_signalez_la_sans_la')} <a href="https://github.com/hfreryr/untracked/security" target="_blank" rel="noopener">{tx('confidentialite.page_securite_du_code_source')}</a>.</li>
  </ul>
  <h2 id="contact">{tx('confidentialite.contact')}</h2>
  <p>{tx('confidentialite.nous_ecrire')} <a href={`mailto:${CONTACT_EMAIL}`}>{CONTACT_EMAIL}</a></p>
  <p class="foot">{tx('confidentialite.code_source_libre_agpl_3_0')} <a href="https://github.com/hfreryr/untracked" target="_blank" rel="noopener">{tx('confidentialite.github_com_hfreryr_untracked')}</a>{tx('confidentialite.donnees_contributeurs_openstreetmap')}</p>
</main>
</div>

<style>
  :global(body) { margin: 0; background: #fff; color: #1c1d1f; font: 16px/1.5 system-ui, -apple-system, 'Segoe UI', Roboto, sans-serif; }
  @media (prefers-color-scheme: dark) { :global(body) { background: #1c1f24; color: #e8e9ec; } table { border-color: #3a3f47; } th, td { border-color: #3a3f47; } }
  /* La carte bloque le défilement de la page entière (html, body { overflow: hidden }) et ce style reste chargé
     quand on arrive ici depuis la carte : la page défile donc dans son propre conteneur. */
  .scroller { position: fixed; inset: 0; overflow-y: auto; -webkit-overflow-scrolling: touch; overscroll-behavior: contain; }
  main { max-width: 760px; margin: 0 auto; padding: 24px 20px calc(48px + env(safe-area-inset-bottom)); }
  h1 { font-size: 28px; letter-spacing: -0.02em; margin: 12px 0 8px; }
  h2 { font-size: 19px; margin: 28px 0 8px; }
  .lead { font-size: 18px; }
  .back, a { color: #2a5bd7; text-decoration: none; }
  @media (prefers-color-scheme: dark) { .back, a { color: #7ea2ff; } }   /* après la règle claire, sinon elle l'écrase */
  table { border-collapse: collapse; width: 100%; font-size: 14.5px; margin-top: 12px; }
  th, td { text-align: left; vertical-align: top; padding: 8px 8px 8px 0; border-bottom: 1px solid #e3e5e8; }
  th { font-weight: 600; }
  @media (max-width: 600px) { thead { display: none; } tr { display: block; padding: 10px 0; } td { display: block; border: 0; padding: 2px 0; } td:first-child { font-weight: 700; } }
  .foot { margin-top: 32px; font-size: 13.5px; color: #6c7077; }
</style>
