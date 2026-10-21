// Inviter à installer l'app sur l'écran d'accueil (maquette validée le 21/10).
// Quand : après le premier lieu enregistré, jamais si l'app est déjà installée ; « Plus tard » la fait revenir
// une seule fois, deux semaines après. Comment : Android (Chrome) ouvre la fenêtre d'installation du téléphone ;
// iPhone n'en a pas (Apple ne le permet pas) : on montre les deux gestes à faire dans Safari.

const KEY = 'installer-plus-tard';     // { n: nombre de « Plus tard », at: date du dernier }
const WAIT = 14 * 864e5;               // deux semaines

/** La carte d'invitation peut-elle s'afficher ? Pure, donc testable. */
export function canOffer({ standalone, saved, dismissed, now, installable }) {
  if (standalone || !installable || !saved) return false;
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
