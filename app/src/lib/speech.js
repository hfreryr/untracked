// Voix du guidage (synthèse vocale du téléphone, rien n'est envoyé à un serveur).
// iPhone (Safari) : 1) la toute première phrase doit partir pendant un toucher (« Aller », bouton Voix), sinon iOS
// la bloque, et les suivantes aussi ; 2) annuler puis parler dans la foulée fait parfois taire la phrase ;
// 3) sans voix française choisie explicitement, iOS peut lire avec l'accent anglais. (Retour du porteur, 22/10.)

/** La voix française à utiliser : fr-FR installée sur le téléphone d'abord, sinon une autre voix française. */
export function pickVoice(voices) {
  const fr = (voices || []).filter((v) => /^fr\b/i.test(v.lang || ''));
  return fr.find((v) => /^fr[-_]FR$/i.test(v.lang) && v.localService) || fr.find((v) => /^fr[-_]FR$/i.test(v.lang)) || fr[0] || null;
}

const synth = () => (typeof window !== 'undefined' && 'speechSynthesis' in window ? window.speechSynthesis : null);

/** Dire `text` en français. À appeler directement dans le toucher pour la première phrase (pas après un await). */
export function speakFr(text) {
  const s = synth();
  if (!s || !text) return;
  const u = new SpeechSynthesisUtterance(text);
  u.lang = 'fr-FR';
  const v = pickVoice(s.getVoices());
  if (v) u.voice = v;
  // une phrase en cours ou en attente : on l'interrompt, mais on ne parle qu'au tour suivant (sinon iOS se tait)
  if (s.speaking || s.pending) { s.cancel(); setTimeout(() => s.speak(u), 60); }
  else { s.resume(); s.speak(u); }
}
export function hush() { synth()?.cancel(); }
