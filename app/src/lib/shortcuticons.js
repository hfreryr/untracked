// Icônes des raccourcis personnels (maquette validée le 27/10/2026) : une seule par grande famille, au trait de
// Maison et Travail (PinnedRow.svelte). Dessins maison. Deux raccourcis peuvent partager une icône : le nom les distingue.
// Chaque entrée : le contenu d'un <svg viewBox="0 0 24 24">, tracé sans remplissage.

export const SHORTCUT_ICONS = {
  sport: '<rect x="5" y="7" width="3.5" height="10" rx="1.2"/><rect x="15.5" y="7" width="3.5" height="10" rx="1.2"/><path d="M8.5 12h7M2.5 12H5M19 12h2.5"/>',
  nature: '<path d="M12 20.5v-5M9 18.5l3-3 3 3"/><path d="M12 3.5 5.5 12.5h13z"/><path d="M12 3.5 7 10M12 3.5l5 6.5"/>',
  loisirs: '<path d="M9 17.5V6.5l10-2v11"/><circle cx="6.5" cy="17.5" r="2.5"/><circle cx="16.5" cy="15.5" r="2.5"/>',
  proches: '<circle cx="9" cy="8" r="3"/><path d="M3.5 19.5v-1a5.5 5.5 0 0 1 11 0v1"/><circle cx="16.5" cy="9" r="2.4"/><path d="M15.8 13.6a4.5 4.5 0 0 1 4.7 4.4v1.5"/>',
  etudes: '<path d="M2.5 9.5 12 5l9.5 4.5L12 14z"/><path d="M6.5 11.7v4.3c0 1.4 2.5 2.5 5.5 2.5s5.5-1.1 5.5-2.5v-4.3M21.5 9.5v5"/>',
  courses: '<path d="M3.5 5.5h2.2l2 10h10.3l2-7H7"/><circle cx="9" cy="19" r="1.3"/><circle cx="16.5" cy="19" r="1.3"/>',
  manger: '<path d="M7 3.5v17M4.5 3.5V8a2.5 2.5 0 0 0 5 0V3.5M16.5 20.5v-17c-2 1-3 3.5-3 6.5v3h3"/>',
  sante: '<rect x="3.5" y="3.5" width="17" height="17" rx="4.5"/><path d="M12 8v8M8 12h8"/>',
  transport: '<rect x="6" y="3.5" width="12" height="13" rx="3"/><path d="M6 10.5h12M9 20.5l1.5-4M15 20.5l-1.5-4M9.5 13.5h.01M14.5 13.5h.01"/>',
  voyage: '<rect x="6" y="6.5" width="12" height="12.5" rx="2.5"/><path d="M10 6.5V4h4v2.5M10 10v5.5M14 10v5.5M8.5 19v1.5M15.5 19v1.5"/>',
  demarches: '<path d="M3.5 9.5 12 4.5l8.5 5zM5.5 9.5v8M9.5 9.5v8M14.5 9.5v8M18.5 9.5v8M3.5 19.5h17"/>',
  autre: '<path d="M12 4.2l2.4 4.9 5.4.7-3.9 3.8.9 5.3L12 16.4l-4.8 2.5.9-5.3-3.9-3.8 5.4-.7z"/>'
};
export const ICON_IDS = Object.keys(SHORTCUT_ICONS);

// type de lieu (sous-classe OSM ou libellé) → famille d'icône, pour pré-choisir l'icône depuis une fiche
const RULES = [
  ['sport', /stadium|sports?_c|fitness|pitch|swimming|piscine|stade|gymnase|sport|dojo|climbing|tennis|golf/i],
  ['nature', /park|garden|forest|wood|nature|beach|parc|jardin|bois|plage|playground/i],
  ['loisirs', /cinema|theatre|museum|music|concert|arts_centre|gallery|library|nightclub|cinéma|théâtre|musée|bibliothèque/i],
  ['etudes', /school|college|universit|kindergarten|childcare|école|lycée|collège|crèche/i],
  ['courses', /supermarket|convenience|marketplace|mall|department_store|greengrocer|bakery|butcher|supermarché|marché|boulangerie/i],
  ['manger', /restaurant|cafe|bar|pub|fast_food|food_court|biergarten|ice_cream|café|brasserie/i],
  ['sante', /hospital|clinic|doctor|dentist|pharmacy|health|physio|hôpital|médecin|pharmacie|clinique/i],
  ['transport', /station|halt|parking|bus_stop|subway|tram|ferry|gare|bicycle_rental|car_rental/i],
  ['voyage', /hotel|hostel|guest_house|aerodrome|airport|camp_site|hôtel|aéroport/i],
  ['demarches', /townhall|post_office|bank|police|courthouse|embassy|government|mairie|poste|banque|préfecture/i]
];
/** Icône proposée pour un lieu (« Sport » pour un stade) ; « autre » si rien ne correspond. */
export function suggestIcon(place) {
  const s = `${place?.subclass || ''} ${place?.type || ''} ${place?.category || ''}`;
  return RULES.find(([, re]) => re.test(s))?.[0] || 'autre';
}
