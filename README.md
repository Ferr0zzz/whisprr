# 🔥 Whisprr

Partage de secrets **zero-knowledge**, éphémère et auto-destructible.

Whisprr te permet d'envoyer un texte confidentiel (mot de passe, note, message) via un lien à usage unique. Le contenu est chiffré **dans ton navigateur** avant d'être envoyé au serveur : à aucun moment le serveur ne voit, ne stocke, ni ne peut techniquement déchiffrer le contenu en clair — même en cas de piratage du serveur, personne ne peut retrouver le contenu d'un secret déjà créé.

🔗 **Essayer Whisprr : [[whisprr](https://whisprr-chi.vercel.app/)]**

## Comment l'utiliser

### Envoyer un secret

1. Va sur la page d'accueil et écris ton message dans le champ de texte.
2. Choisis une durée d'expiration (en minutes, jusqu'à 7 jours).
3. Laisse "Auto-destruction après lecture" activé si tu veux que le lien ne fonctionne qu'une seule fois (recommandé pour un vrai secret).
4. Clique sur **Créer le lien**. Il est automatiquement copié dans ton presse-papiers — colle-le où tu veux l'envoyer (email, message, etc.).
5. Tu peux suivre en direct sur la page si le lien a déjà été lu, s'il a expiré, ou s'il est toujours en attente.

### Recevoir un secret

1. Ouvre le lien que tu as reçu.
2. Clique sur **Révéler le secret** — le contenu s'affiche, déchiffré directement dans ton navigateur.
3. Une fois révélé, le lien ne fonctionne plus : le secret est détruit du serveur à cet instant.

⚠️ **Un conseil** : n'ouvre le lien que quand tu es prêt à le lire. Certaines apps de messagerie (Discord, WhatsApp...) génèrent un aperçu automatique dès que le lien est collé, mais comme la lecture nécessite un clic explicite sur "Révéler", ça ne consomme pas le secret par erreur.

## Pourquoi c'est sûr

- Le chiffrement (AES-GCM 256 bits) se fait entièrement dans ton navigateur via la Web Crypto API — aucune bibliothèque tierce.
- Le serveur ne reçoit et ne stocke que du texte déjà chiffré, illisible sans la bonne clé.
- La clé de déchiffrement voyage dans le **fragment de l'URL** (après le `#`), une partie qu'un navigateur n'envoie jamais au serveur — donc même les logs du serveur ne peuvent pas la capturer.
- Le secret est physiquement supprimé du stockage après lecture (pas juste marqué comme "lu").

## Stack technique

- **Next.js** 16 (App Router) — framework et hébergement
- **React** 19 / **TypeScript**
- **Web Crypto API** — chiffrement natif du navigateur
- **Upstash Redis** — stockage des secrets chiffrés et rate limiting, avec expiration native

## Structure du projet

    app/
     ├─ page.tsx              → création d'un secret (formulaire + suivi de statut)
     ├─ s/[id]/page.tsx        → révélation d'un secret (bouton "Révéler")
     ├─ api/secrets/
     │   ├─ route.ts           → POST : créer un secret (avec rate limiting)
     │   └─ [id]/route.ts      → GET : consommer un secret, ou consulter son statut (?status=1)
    lib/
     ├─ crypto.ts              → chiffrement/déchiffrement (Web Crypto API)
     ├─ store.ts               → stockage (Upstash Redis en prod, Map en mémoire en dev)
     └─ rate-limit.ts          → limitation de débit (Upstash Redis en prod, Map en mémoire en dev)
    types.ts                   → types partagés

## Faire tourner le projet en local

    npm install
    npm run dev

Puis ouvrir [http://localhost:3000](http://localhost:3000). Sans variables d'environnement Redis, le projet fonctionne directement avec un stockage en mémoire — pratique pour développer, mais les données ne survivent pas à un redémarrage du serveur.

## Déployer sa propre instance sur Vercel

1. Fork ou clone ce repo, pousse-le sur ton propre GitHub.
2. Sur [vercel.com](https://vercel.com), connecte le repo — Vercel détecte Next.js automatiquement.
3. Crée une base **Upstash Redis** (via l'intégration Vercel, ou sur upstash.com), puis ajoute ces variables d'environnement au projet :

       KV_REST_API_URL
       KV_REST_API_TOKEN

   (`UPSTASH_REDIS_REST_URL` / `UPSTASH_REDIS_REST_TOKEN` sont aussi acceptées.)
4. Déploie. Chaque `git push` sur `main` redéploie automatiquement.

## Limites connues

- Le rate limiting est basé sur l'IP (`x-forwarded-for`) ; à affiner si le projet passe derrière un proxy qui ne la transmet pas correctement.
- Pas d'interface d'administration ni de logs applicatifs pour l'instant.