# LIORA

Bien-être, santé et assistance au quotidien — application Expo (React Native + TypeScript) pour iOS, Android et le web.

Dépôt public : [aminajarraya284/liora-expo](https://github.com/aminajarraya284/liora-expo).
Les interventions sur ce projet sont enregistrées et envoyées sur `main` après
validation ; la consigne de synchronisation est conservée dans `AGENTS.md`.

## Lancer l'application

```bash
npm install
npm start
```

Vérifications : `npm run typecheck`, `npm run lint`, `npm test`.

La version web est un aperçu temporaire : utilisez uniquement des données fictives.
Les comptes, clés et données de cet aperçu restent en mémoire et sont oubliés au
rechargement de la page. Les anciennes données d'aperçu éventuellement présentes
dans le stockage du navigateur ne sont ni relues ni effacées automatiquement.

Les fichiers `src/App.tsx`, `src/main.tsx`, les anciens composants web nommés en
PascalCase, `server.ts` et `vite.config.ts` appartiennent au prototype Vite. Ils ne
sont pas utilisés par Expo ; les vérifications ciblent l'application Expo active
et les tests, ainsi que le serveur relais via ses propres commandes.

## Organisation

- `src/app/(auth)` : Connexion, Créer un compte, Mot de passe oublié
- `src/app/(app)` : un fichier par écran (accueil, traitements, agenda, humeur, radio, démarches, coffre-fort, assistant…)
- `src/sections.ts` et `src/theme.ts` : une couleur, une icône et un libellé par rubrique
- `src/components` : composants d'interface et animations
- `src/features` : humeur, radio, navigateur privé, assistant
- `src/security` : chiffrement AES-256-GCM, mots de passe, verrou du coffre-fort
- `src/state` : comptes, données chiffrées, réglages
- `shared/assistant-contract.ts` : outils de l'assistant, communs à l'application et au serveur
- `server/` : serveur relais de l'assistant (la clé de l'API n'est jamais dans l'application)

## Le serveur (dossier `server/`)

L'application enregistre les comptes et leurs données sur le téléphone. Le relais
ne conserve ni les conversations ni les photos. Redis garde uniquement les
compteurs quotidiens associés à une empreinte de l'identifiant aléatoire de
l'appareil, jusqu'à minuit UTC.

| Adresse | Rôle |
|---|---|
| `POST /v1/session` | Ouvre la session d'un appareil |
| `POST /v1/assistant` | Un tour de conversation avec l'assistant |
| `POST /v1/humeur` | Proposition d'humeur à partir d'une photo |
| `GET /v1/actualites` | Titres du jour (franceinfo, Yahoo Actualités) |
| `GET /health` | État du serveur |

Pour l'essayer sur votre ordinateur :

```bash
cd server
npm install
```

Copiez `server/.env.example` en `server/.env`, renseignez `ANTHROPIC_API_KEY`, `LIORA_APP_TOKEN` et `LIORA_SESSION_SECRET`, puis :

```bash
npm start
```

Dans l'application, copiez `.env.example` en `.env` et renseignez l'adresse du serveur et la même valeur de `LIORA_APP_TOKEN`, puis relancez `npm start`.

### Comment le serveur est protégé

- **Une session par appareil.** Le jeton contenu dans l'application ne sert qu'à ouvrir une session. Chaque téléphone reçoit ensuite son propre jeton, signé avec un secret que seul le serveur connaît. L'identifiant de l'appareil est tiré au hasard : il n'est lié ni à la personne ni à son compte.
- **Des plafonds de dépense.** Par appareil et par minute, par appareil et par jour, et pour tous les appareils réunis par jour (`LIORA_GLOBAL_PER_DAY`), qui sert de coupe-circuit pour la facture.
- **Des compteurs quotidiens partagés.** En production, Redis conserve les plafonds quotidiens lors d'un redémarrage et les partage entre les instances. La réservation des quotas de l'appareil et du total se fait en une opération atomique. Si Redis est indisponible, aucun nouvel appel au modèle n'est autorisé. Les limites par minute restent locales à chaque instance.
- **Un appareil peut être bloqué** avec `LIORA_BLOCKED_DEVICES`, sans toucher aux autres.
- **Les actualités** sont lues par le serveur, nettoyées et gardées dix minutes. Les sites d'actualités ne voient pas les téléphones. Le serveur n'appelle que les adresses écrites dans `shared/news.ts`.
- **Rien de personnel dans les journaux** : ni conversation, ni photo, ni identifiant d'appareil.

Limite connue : le jeton de l'application peut être extrait du paquet publié. Les plafonds bornent ce qu'un fraudeur peut en faire. Pour aller plus loin, il faudrait vérifier l'authenticité de l'application avec App Attest (Apple) et Play Integrity (Google).

## Mise en production

### 1. Mettre le serveur en ligne

Le fichier `Dockerfile` (à la racine) construit le serveur ; il fonctionne chez tout hébergeur qui accepte Docker. Le fichier `render.yaml` prépare le déploiement chez Render, région de Francfort :

1. Poussez le projet sur GitHub.
2. Dans Render : **New > Blueprint**, puis choisissez le dépôt.
3. Renseignez `ANTHROPIC_API_KEY`, `LIORA_APP_TOKEN`, `LIORA_REDIS_REST_URL` et `LIORA_REDIS_REST_TOKEN` quand Render les demande. `LIORA_SESSION_SECRET` est tiré au hasard par Render. Les deux dernières valeurs viennent d'une base Redis Upstash (URL HTTPS et jeton REST d'écriture), commune à toutes les instances. Désactivez l'éviction des clés de cette base et conservez ses données : les effacer réinitialise les quotas.
4. Notez l'adresse `https://…onrender.com` et vérifiez que `/health` répond `{"ok":true}`.

Chez un autre hébergeur, donnez les mêmes variables et réglez `LIORA_TRUST_PROXY` sur le nombre de serveurs intermédiaires placés devant le relais (1 le plus souvent).

Avec `NODE_ENV=production`, le serveur refuse de démarrer sans Redis configuré.
En développement seulement, les compteurs peuvent rester en mémoire. Les
requêtes valides réservent un quota avant l'appel au modèle ; un échec de cet
appel conserve la réservation pour éviter qu'une panne ne contourne les plafonds.

### 2. Relier l'application au serveur

Enregistrez l'adresse et le jeton comme variables du projet Expo, pour que la construction en ligne les reçoive :

```bash
npx eas-cli@latest env:create --environment production --name EXPO_PUBLIC_ASSISTANT_URL --value https://votre-serveur.example --visibility plaintext
```

```bash
npx eas-cli@latest env:create --environment production --name EXPO_PUBLIC_ASSISTANT_TOKEN --value LE_MEME_JETON --visibility sensitive
```

L'adresse doit commencer par `https://` : l'application refuse toute autre adresse hors du réseau local.

### 3. Construire et publier l'application

```bash
npx eas-cli@latest build --profile production --platform all
```

```bash
npx eas-cli@latest submit --profile production --platform all
```

Le profil `production` désactive le contenu d'exemple : les personnes démarrent avec un compte vide. Le profil `preview` le garde, pour les essais.

### 4. À régler avant la publication

- **Comptes nécessaires** : Anthropic (clé de l'API), un hébergeur, Expo, Apple Developer et Google Play Console.
- **Politique de confidentialité** : obligatoire sur les deux magasins. Elle doit dire que les données restent sur le téléphone, et que les messages envoyés à l'assistant et la photo du scan transitent par le serveur vers Anthropic.
- **Données de santé** : tant qu'elles restent sur le téléphone, aucun hébergement certifié n'est requis. Les stocker sur un serveur imposerait en France un hébergeur certifié HDS.
- **Mot de passe oublié** : les comptes sont locaux, il n'existe donc pas de réinitialisation par e-mail. À expliquer aux personnes, ou à construire avec des comptes en ligne.
- **Radio** : vérifier les conditions de reprise des flux auprès de chaque station.
- **Actualités** : les flux de franceinfo et de Yahoo sont prévus pour un usage personnel ; vérifier leurs conditions avant une diffusion publique. Les adresses des flux sont dans `shared/news.ts`.

## Sécurité

- Données chiffrées sur l'appareil (AES-256-GCM), clé dans le trousseau du système.
- Si le chiffrement est indisponible, l'ouverture du compte et l'import de documents sont bloqués : aucune nouvelle sauvegarde sensible en clair.
- Une lecture en échec ou un compte illisible bloque son chargement sans le remplacer par un compte vide.
- Une sauvegarde en échec reste en attente, avec un message et un bouton pour réessayer. La déconnexion attend la sauvegarde et reste bloquée si celle-ci échoue. Une fermeture forcée de l'application peut néanmoins perdre les modifications qui ne sont pas encore écrites.
- Mots de passe : empreinte PBKDF2-HMAC-SHA256, tentatives limitées.
- Coffre-fort : verrou (Face ID, empreinte, code ou mot de passe), documents chiffrés, captures d'écran bloquées.
- Navigateur privé : https uniquement, aucune trace conservée, sites de la liste ou liens enregistrés seulement.
- `npm audit` : 0 vulnérabilité connue à la date de livraison.
