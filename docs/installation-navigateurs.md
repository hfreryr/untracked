# Installer l'app : ce que permet chaque navigateur

Relevé en ligne le 29/10/2026 (pas d'essai sur de vrais téléphones). Code : `app/src/lib/install.js` (`browserOf`),
fenêtre : `app/src/lib/ui/InstallCard.svelte`.

## Android

| Navigateur | Installation | Dans l'app |
|---|---|---|
| Chrome | vraie app (WebAPK), fenêtre d'installation du navigateur | bouton → fenêtre du navigateur |
| Samsung Internet | vraie app sur un Samsung, raccourci ailleurs | idem |
| Edge, Opera | raccourci, fenêtre d'installation du navigateur | idem |
| Brave | propose d'installer, mais crée un raccourci qui s'ouvre dans Brave ([bug 2026](https://github.com/brave/brave-browser/issues/56133)) | idem ; rien à faire de notre côté |
| Firefox | menu → « Installer » (ou « Ajouter l'app à l'écran d'accueil ») ; ne prévient pas le site ; ne force pas le plein écran ([Mozilla, mars 2026](https://support.mozilla.org/zu/questions/1567788)) | bouton → les deux gestes |
| DuckDuckGo | pas de source ; un utilisateur rapporte un simple raccourci qui rouvre le navigateur (28/10) | bouton → « ouvrez cette page dans Chrome ou Firefox » + copier le lien |

Sources : [web.dev](https://web.dev/learn/pwa/installation), [firt.dev](https://firt.dev/notes/pwa/),
[whatpwacando.today](https://whatpwacando.today/installation/).

## iPhone

| Navigateur | Installation | Dans l'app |
|---|---|---|
| Safari | Partager → En voir plus → Sur l'écran d'accueil ; depuis iOS 26, s'ouvre comme une app ([iDownloadBlog](https://www.idownloadblog.com/2025/06/17/apple-ios-26-safari-web-apps-home-screen-bookmarks/)) | les trois gestes |
| Chrome, Firefox, Edge, DuckDuckGo, Orion | Partager (parfois dans leur menu) → Sur l'écran d'accueil ; l'app s'ouvre avec le moteur de Safari ([Gadget Hacks, 2024](https://ios.gadgethacks.com/how-to/you-dont-need-safari-add-web-apps-your-iphones-home-screen-try-these-browsers-instead-0385351/)) | deux gestes, « dans le menu ⋯ ou ≡ » |
| Brave | pas encore ([équipe Brave, mars 2026](https://community.brave.app/t/add-to-home-screen-as-pwa-standalone-web-app-on-ios/650126)) | « ouvrez cette page dans Safari » + copier le lien ; Brave se présente comme Safari, on le reconnaît à `navigator.brave` |

## Limites connues

- Reconnaissance par le nom annoncé par le navigateur : à revoir si un navigateur change de nom ou de comportement.
- Safari ne voit pas l'app installée sur l'écran d'accueil (stockages séparés) : le bouton y reste affiché (choix du 28/10).
- Activités en direct (Dynamic Island) et notification de guidage : impossibles pour une app web (voir `magasins-applications.md`).
