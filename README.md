# Vision

Tes films, séries et animes rangés sur **Google Drive**, **MEGA**, **Dropbox**, **OneDrive**, **pCloud**, **WebDAV** (Nextcloud, Synology…), **S3** (R2, B2, Wasabi…), un **NAS** ou de simples liens, lancés en un clic sur la **télé**, l’**ordinateur**, le **téléphone** et la **tablette**. Le principe de Jellyfin ou Plex, sans serveur : le site lit directement tes fichiers depuis ton stockage.

**En ligne : https://adamfast-tech.github.io/vision/**

## Ce que fait Vision

- Classe tout seul tes vidéos en **Films, Séries, Animes, Autres** d’après les dossiers et les noms de fichiers (`S01E02`, `1x02`, `Saison 2`, `[Groupe] Titre - 12`, année, qualité, VF / VOSTFR).
- **Un clic = lecture** : reprise là où tu t’étais arrêté, épisode suivant enchaîné, bouton « Passer l’intro ».
- Lecteur maison : sous-titres `.srt` / `.ass` / `.vtt` posés à côté de la vidéo, vitesse, image dans l’image, AirPlay et Cast, plein écran, commandes de l’écran verrouillé.
- Si un format n’est pas lu par l’appareil (MKV, AVI, HEVC…), bascule automatique sur le lecteur Google Drive.
- Interface **Télé** (télécommande, gros caractères, aperçu qui suit la sélection), **Ordinateur** (souris, clavier), **Téléphone** et **Tablette** (tactile, double tap ±10 s).
- Affiches et résumés : AniList pour les animes (sans clé), TMDB pour films et séries (clé gratuite, facultative).
- Recherche instantanée, tolérante aux accents et aux fautes, recherche vocale sur Chrome.
- Installable comme une appli (hors ligne pour l’interface).
- **Appairage télé** : configure Vision sur ton téléphone, puis envoie tout à la télé avec un code à 8 chiffres.

## Démarrer avec Google Drive (5 minutes)

1. Dans Google Drive, crée un dossier principal (par exemple `Vision`) avec des sous-dossiers `Films`, `Séries`, `Animes`.
2. Clic droit sur le dossier principal › **Partager** › Accès général : **Tous les utilisateurs disposant du lien** (Lecteur). Copie le lien.
3. Sur [console.cloud.google.com](https://console.cloud.google.com) : crée un projet › **API et services** › Bibliothèque › **Google Drive API** › Activer.
4. **Identifiants** › Créer des identifiants › **Clé API**. Restreins-la : *Sites Web* = `https://adamfast-tech.github.io/*`, *API* = Google Drive API.
5. Dans Vision : **Ajouter un stockage** › Google Drive › colle le lien et la clé › **Tester et ajouter**.

Mode privé (dossier non partagé) : même projet, écran de consentement OAuth (type Externe, ton adresse en utilisateur test), puis **ID client OAuth** › Application Web › origine `https://adamfast-tech.github.io`. Il faut se reconnecter à Google environ toutes les heures ; ce mode n’est pas pratique sur une télé.

## Rangement conseillé

```
Vision/
├── Films/
│   ├── Inception (2010)/Inception.2010.1080p.mkv
│   └── Le Fabuleux Destin d'Amélie Poulain (2001).mp4
├── Séries/
│   └── Dark/
│       ├── Saison 1/Dark.S01E01.mkv
│       └── Saison 2/Dark.S02E01.mkv
└── Animes/
    └── One Piece/[SubsPlease] One Piece - 1071 (1080p).mkv
```

Un sous-titre `Dark.S01E01.fr.srt` à côté de `Dark.S01E01.mkv` est trouvé et activé tout seul.

## Autres stockages

- **MEGA** : lien public de dossier ou de fichier, clé comprise (`https://mega.nz/folder/…#…`). Déchiffrement dans le navigateur (le service worker sert les vidéos par plages). Sans compte payant, MEGA limite le transfert.
- **Dropbox** : ton Dropbox via une connexion (OAuth PKCE, clé d’appli publique créée sur dropbox.com/developers, redirection `oauth.html`). Lecture par lien temporaire Dropbox.
- **OneDrive** : perso ou pro, chemin ou lien de dossier partagé, via une connexion Microsoft (ID client d’une appli « SPA » sur entra.microsoft.com, redirection `oauth.html`). Microsoft limite la connexion d’un site à 24 h sans usage.
- **pCloud** : lien public de dossier, sans compte ni clé (serveurs US et Europe).
- **WebDAV** : Nextcloud, ownCloud (lien de partage `…/s/…` converti), Synology, QNAP, kDrive, Koofr, `rclone serve webdav`. Avec identifiant, la lecture passe par le service worker. Le serveur doit autoriser ce site (CORS).
- **S3 et compatibles** : Amazon S3, Cloudflare R2, Backblaze B2, Wasabi, Scaleway, OVHcloud, MinIO. URL pré-signées (SigV4) dans le navigateur ; règle CORS sur le compartiment ; clé en lecture seule conseillée.
- **iCloud, Proton Drive, Box…** : pas d’accès possible depuis un navigateur. Passer par rclone (`iclouddrive`, `protondrive`, `box`) puis `rclone serve webdav`, et l’ajouter en WebDAV.
- **NAS ou serveur** : n’importe quelle adresse HTTPS qui liste des fichiers (Nginx/Apache autoindex, Caddy, rclone). Avec [rclone](https://rclone.org), tout cloud devient lisible :
  `rclone serve http moncloud:Videos --addr :8080 --allow-origin "https://adamfast-tech.github.io"`, derrière un accès HTTPS (Tailscale Funnel, Cloudflare Tunnel, reverse proxy du NAS).
- **Liens et listes** : une vidéo par ligne (`Titre | https://…`), liste M3U, fichier JSON. Dropbox, OneDrive (expérimental), Google Drive et MEGA convertis automatiquement.
- **Démo** : quatre courts métrages libres de la Blender Foundation (licence CC BY).

## Sur la télé

1. Ouvre le navigateur de la télé (Samsung Internet, LG, navigateur Android TV) sur `adamfast-tech.github.io/vision`.
2. Vision passe en mode Télé tout seul (sinon : Réglages › Interface › Télé).
3. Choisis **Recevoir la config d’un autre appareil** : un code à 8 chiffres et un QR code s’affichent.
4. Sur le téléphone : Réglages › Appareils › **Envoyer à un appareil**, saisis le code (ou scanne le QR code). Valide l’import sur la télé.

Télécommande : flèches pour se déplacer, **OK** pour lancer, **Retour** pour revenir. OK maintenu sur une carte = options (début, marquer vu, fiche). Dans le lecteur : ← → = ±10 s (maintenir accélère), ↑ = commandes, OK = pause.

## Installer comme une appli

- **iPhone / iPad** : Safari › Partager › **Sur l’écran d’accueil**.
- **Android** : Chrome › menu ⋮ › **Installer l’application**.
- **Ordinateur** : icône d’installation dans la barre d’adresse de Chrome ou Edge.

## Raccourcis clavier (lecteur)

| Touche | Action |
|---|---|
| Espace, K | Lecture / pause |
| ← → ou J L | −10 s / +10 s |
| 0 à 9 | Aller à 0 %… 90 % |
| F | Plein écran |
| M | Couper le son |
| C | Sous-titres suivants |
| N | Épisode suivant |
| P | Image dans l’image |
| Échap | Fermer |

## Confidentialité

- Les vidéos vont directement de ton stockage à ton écran : aucun serveur intermédiaire.
- Clés API, liens et historique restent dans le navigateur (localStorage / IndexedDB). Le fichier exporté contient tes clés : garde-le pour toi.
- L’appairage passe par le relais public ntfy.sh, mais le contenu est chiffré dans le navigateur (AES-GCM, clé dérivée du code) : le relais ne voit qu’un texte illisible.
- Les titres de tes vidéos sont envoyés à AniList (animes) et à TMDB (si tu ajoutes une clé) pour trouver les affiches. Désactivable dans les réglages.

## Limites connues

- Les navigateurs ne lisent pas tous les formats : MP4 (H.264/AAC) et WebM passent partout ; MKV dépend du navigateur ; AVI, HEVC sur certains appareils et le son AC3/DTS passent par le lecteur Google Drive (fichiers Drive) ou « Ouvrir dans MEGA ».
- Avec le lecteur Google Drive, la reprise automatique n’est pas possible (lecteur externe).
- Une clé API restreinte au site ne fonctionne pas depuis un Chromecast (diffusion) : lance la lecture sur le téléphone ou l’ordinateur.

## Structure

```
index.html            coque, icônes, écran d'ouverture
sw.js                 service worker : hors ligne + flux MEGA / Drive privé / WebDAV authentifié
css/                  base, app, player, tv
js/core/              état, routes, navigation télécommande, appairage
js/library/           analyse des noms, bibliothèque, synchronisation, affiches
js/providers/         Google Drive, MEGA, Dropbox, OneDrive, pCloud, WebDAV, S3, NAS/HTTP, liens, démo
oauth.html            retour de connexion OAuth (Dropbox, Microsoft)
js/ui/                composants, animations, vues
js/player/            lecteur, sous-titres
lib/                  Brio, Noctis et le kit d'animations
vendor/               anime.js, megajs, qrcode-generator (licences : LICENSES.md)
```

HTML, CSS et JavaScript vanilla, sans build. Mise à jour : pousser sur `main` et `gh-pages`, puis incrémenter `VERSION` dans `sw.js`.
