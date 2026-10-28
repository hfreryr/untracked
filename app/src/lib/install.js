// Inviter à installer l'app sur l'écran d'accueil (maquettes du 21/10 et du 28/10).
// Porteur, 28/10 : « ah mais c'est seulement sur internet ? » est la première remarque de beaucoup d'utilisateurs.
// Donc : dès la première ouverture (bandeau d'accueil, PromiseBanner), un bouton rond permanent tant qu'elle n'est
// pas installée (MapControls), et une carte de rappel après un signe d'usage : lieu enregistré, raccourci défini,
// catégories personnalisées, import, fin d'un guidage, 3e jour d'utilisation (compté sur le téléphone seulement).
// Jamais si l'app est déjà installée ; « Plus tard » sur la carte la fait revenir une seule fois, deux semaines après. Comment : Android (Chrome) ouvre la fenêtre d'installation du téléphone ;
// iPhone n'en a pas (Apple ne le permet pas) : on montre les deux gestes à faire dans Safari.

const KEY = 'installer-plus-tard';     // { n: nombre de « Plus tard », at: date du dernier }
const WAIT = 14 * 864e5;               // deux semaines

/** La carte d'invitation peut-elle s'afficher ? Pure, donc testable. */
export function canOffer({ standalone, saved, dismissed, now, installable }) {
  if (standalone || !installable || !saved) return false;   // saved : un signe d'usage (engaged)
  if (!dismissed) return true;
  return dismissed.n < 2 && now - dismissed.at > WAIT;
}

export const isStandalone = () => matchMedia('(display-mode: standalone)').matches || navigator.standalone === true;
/** iPhone ou iPad (y compris un iPad qui se présente comme un Mac) */
export const isIos = () => /iPhone|iPad|iPod/.test(navigator.userAgent) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);

// Android (Chrome, Edge, Samsung…) : le navigateur propose l'installation ; on garde sa fenêtre pour notre bouton.
let deferred = null;
const listeners = new Set();
if (typeof window !== 'undefined') {
  window.addEventListener('beforeinstallprompt', (e) => { e.preventDefault(); deferred = e; listeners.forEach((f) => f()); });
  window.addEventListener('appinstalled', () => { deferred = null; listeners.forEach((f) => f()); });
}
export const onInstallChange = (f) => { listeners.add(f); return () => listeners.delete(f); };
/** Comment installer ici : 'prompt' (fenêtre du téléphone), 'ios' (deux gestes à montrer) ou null (rien à proposer). */
export const installWay = () => (isStandalone() ? null : deferred ? 'prompt' : isIos() ? 'ios' : null);
/** Ouvre la fenêtre d'installation du navigateur (Android). Renvoie true si la personne a accepté. */
export async function promptInstall() {
  if (!deferred) return false;
  const e = deferred;
  deferred = null;
  e.prompt();
  const r = await e.userChoice.catch(() => null);
  listeners.forEach((f) => f());
  return r?.outcome === 'accepted';
}

export function readDismissed() { try { return JSON.parse(localStorage.getItem(KEY) || 'null'); } catch { return null; } }
export function laterTapped(now = Date.now()) {
  const d = readDismissed();
  try { localStorage.setItem(KEY, JSON.stringify({ n: (d?.n || 0) + 1, at: now })); } catch { /* navigation privée */ }
}

// ——— Signes d'usage (gardés sur le téléphone, jamais envoyés) ———
const SIGNS = 'installer-signes';      // { acts: true si un geste d'usage a eu lieu, days: ['2026-10-28', …] (3 au plus) }
export const readSigns = () => { try { return JSON.parse(localStorage.getItem(SIGNS) || 'null') || {}; } catch { return {}; } };
const writeSigns = (o) => { try { localStorage.setItem(SIGNS, JSON.stringify(o)); } catch { /* navigation privée */ } };
/** Un geste qui montre qu'on compte revenir : catégories personnalisées, import, guidage terminé. */
export function noteEngaged() { writeSigns({ ...readSigns(), acts: true }); listeners.forEach((f) => f()); }
/** Ce jour d'utilisation (on garde les 3 derniers jours distincts). */
export function noteDay(now = new Date()) {
  const s = readSigns(), d = now.toISOString().slice(0, 10), days = s.days || [];
  if (!days.includes(d)) writeSigns({ ...s, days: [...days, d].slice(-3) });
}
/** Assez de signes d'usage pour proposer l'installation ? Pure, donc testable. */
export function isEngaged({ saved = 0, shortcuts = 0, signs = readSigns() } = {}) {
  return saved > 0 || shortcuts > 0 || !!signs.acts || (signs.days || []).length >= 3;
}
