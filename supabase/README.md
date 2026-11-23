# Supabase — version d’essai LIORA

Cette intégration est destinée aux essais avec **des données fictives uniquement**.
Les migrations et tests sont versionnés ; leur présence dans GitHub ne configure
pas à elle seule un projet Supabase. Aucun secret administratif ne doit être mis
dans l’application ou dans le dépôt public.

## Préparer un projet d’essai

1. Créez un projet Supabase dédié aux essais et notez sa région. Activez la
   confirmation des adresses e-mail. N’activez pas les connexions anonymes.
2. Dans SQL Editor, relisez puis exécutez les migrations dans l’ordre de leurs
   noms. `migrations/20261116195329_liora_cloud_trial.sql` crée les snapshots, les
   politiques d’accès, le RPC de synchronisation et le bucket privé `liora-files`.
   `migrations/20261117211538_liora_emergency_keys.sql` ajoute la clé d’urgence.
   Le schéma `private` ne doit pas être ajouté aux schémas exposés dans Data API.
3. Dans Authentication → Email Templates, utilisez les fichiers
   `templates/confirmation.html` et `templates/recovery.html`. Ils contiennent
   `{{ .Token }}` : la personne saisit le code dans l’application. Aucun lien de
   retour ni route mobile de callback n’est nécessaire pour ce parcours.
4. Réglez les codes e-mail sur 6 chiffres, avec une expiration de 15 minutes, et
   le mot de passe sur 8 caractères minimum avec lettres et chiffres. Les
   confirmations d’adresse doivent rester activées. Les réglages de
   `config.toml` concernent le développement local ; ils ne modifient pas un
   projet hébergé tant qu’ils n’y sont pas appliqués.
5. Utilisez le projet avec un compte de test dont vous pouvez lire les e-mails.
   Le service mail Supabase par défaut a des restrictions d’envoi ; configurez
   un SMTP adapté avant d’inviter d’autres testeurs. Vérifiez les paramètres
   Auth et les limites du fournisseur dans le Dashboard.

L’application reçoit uniquement l’URL du projet et sa **clé publishable**
(`sb_publishable_…`). Cette version du client refuse les anciennes clés `anon`.
Les clés `secret` et `service_role` restent réservées au
serveur. Renseignez ces valeurs dans votre `.env` local ignoré par Git ; les noms
attendus par l’application figurent dans le `.env.example` à la racine.

## Synchronisation et accès

- `public.liora_snapshots` contient une ligne par utilisateur : `user_id`,
  `payload`, `revision`, `updated_at`. La lecture exige que `auth.uid()` soit le
  propriétaire et que la session `session_id` existe encore dans `auth.sessions`.
- Les écritures directes sont révoquées. L’application appelle
  `liora_save_snapshot(p_expected_revision, p_payload)` avec un objet
  `{ "v": 1, "data": { ... }, "changeId": "UUID" }`, au maximum 2 Mio.
- La révision `0` crée uniquement un snapshot absent. Pour une modification, la
  révision doit correspondre à celle déjà lue. Un autre appareil ayant écrit
  depuis provoque le code SQL `40001` ; le client doit présenter le conflit, pas
  remplacer silencieusement les informations distantes.
- Le RPC renvoie une ligne `{ revision, updated_at }`. `changeId` permet au
  client de reconnaître sa propre sauvegarde après une réponse réseau perdue.
- Les fichiers sont immuables dans `liora-files`, avec un chemin
  `user_uuid/file_uuid.bin`, un type `application/octet-stream` et une limite
  de 20 Mio. Les permissions portent sur le premier dossier, la session active
  et le bucket. `upsert` est interdit ; il faut un nouvel identifiant par fichier.
- Téléchargez les fichiers avec la session de l’utilisateur. N’utilisez pas
  d’URL publique ni de liens signés de longue durée. Les politiques restrictives
  protègent ce bucket même si d’autres buckets ont déjà des politiques permissives.

Les fichiers retirés d'un instantané sont nettoyés après confirmation de sa nouvelle
révision. Une coupure pendant un transfert ou un nettoyage peut laisser un fichier
privé orphelin. La suppression complète du compte nettoie également ces objets.
Aucun balayage global automatique n'est effectué : il risquerait d'effacer le
transfert encore en cours d'un autre téléphone. Un arrêt pendant le nettoyage
local peut aussi laisser un ancien fichier chiffré sans référence.

Le téléphone conserve sa copie chiffrée. La protection cloud repose ici sur
HTTPS, les politiques RLS et le stockage privé. Les administrateurs du projet
peuvent lire les données : cette version ne prétend pas fournir un chiffrement
de bout en bout. L’utilisation avec de vraies données de santé exige une revue
distincte des traitements, des prestataires et de la configuration.

## Suppression du compte

## Clé d’urgence 48 heures

Le propriétaire choisit un proche, son adresse e-mail et les documents déjà
synchronisés à autoriser. Son accord explicite active l’accès automatique après
un délai de refus de 48 heures. Le code est généré aléatoirement dans
l’application et seule son empreinte SHA-256 est conservée par le serveur.
Le destinataire utilise un compte avec cette adresse confirmée. Une clé permet
une seule demande, avec cinq essais au maximum par minute et par compte.

Le serveur calcule les échéances. Après 48 heures, l’accès dure 24 heures.
Une approbation anticipée démarre immédiatement cette fenêtre de 24 heures.
Un refus ou une révocation bloque les téléchargements suivants. Le retrait du
proche ou d’un document autorisé révoque définitivement la clé. Les suppressions
des comptes concernés suppriment également leurs clés et demandes.

Les demandes apparaissent dans Liora et sont actualisées toutes les 20 secondes
quand l’application est au premier plan. Les notifications hors application,
par e-mail ou notification système, restent à intégrer avant une utilisation
réelle qui dépendrait de la réception immédiate d’une alerte.

La deuxième migration utilise `storage.allow_only_operation('object.get_authenticated')`.
Cette fonction doit être disponible dans la version Storage du projet.
La permission du destinataire couvre uniquement le téléchargement authentifié
du document autorisé. La signature d’URL, la liste des objets, leur copie et
leur modification sont refusées. Vérifiez la présence de cette fonction avant
d’appliquer la migration sur une ancienne installation Storage. Les noms des
opérations sont confirmés par la [documentation des fonctions Storage](https://supabase.com/docs/guides/storage/schema/helper-functions)
et le [code officiel des opérations](https://github.com/supabase/storage/blob/master/src/http/routes/operations.ts).

Les tests PostgreSQL locaux couvrent les délais, la séparation des comptes,
la limitation des essais, les révocations et les politiques Storage. Les appels
Auth et Storage réels restent à vérifier avec deux comptes fictifs sur le
projet Supabase d’essai, notamment le refus des URL signées. Un document déjà
enregistré par le destinataire reste une copie qu’une révocation ne peut effacer.

## Suppression du compte

La fonction `delete-account` doit être déployée pour que la suppression du compte
en ligne fonctionne. Elle exige un JWT utilisateur valide et le mot de passe
actuel, obtenu par une nouvelle authentification auprès de Supabase Auth.
Elle bloque d’abord la synchronisation, révoque les sessions globalement,
supprime les fichiers via **l’API Storage**, puis supprime l’utilisateur Auth.
Le snapshot et le marqueur de suppression sont supprimés par cascade SQL.

Si le nettoyage échoue, le compte n’est pas annoncé comme supprimé. Le marqueur
empêche de nouvelles écritures pendant l’incident. Après une révocation globale,
il peut être nécessaire de se reconnecter pour réessayer la suppression. Pour un
compte dépassant 10 000 fichiers, plusieurs tentatives peuvent être nécessaires.
Un administrateur peut terminer le nettoyage par l’API Storage et supprimer
ensuite le compte Auth ; ne supprimez jamais les lignes `storage.objects` à la main.

Déploiement explicite sur le projet d’essai choisi (CLI 3.2.0, commandes vérifiées
avec `--help`) :

```sh
npx supabase@3.2.0 login
npx supabase@3.2.0 functions deploy delete-account --remote=VOTRE_PROJECT_REF --use-api
```

Conservez `verify_jwt = true`. Supabase injecte l’URL, les clés publishable et
secrètes dans l’environnement de la fonction ; l’implémentation prend aussi en
charge les noms historiques `SUPABASE_ANON_KEY` / `SUPABASE_SERVICE_ROLE_KEY`.
Ne copiez aucune de ces clés administratives dans une variable `EXPO_PUBLIC_*`.

Le client envoie le JWT de l’utilisateur dans `Authorization` et la clé publique
dans `apikey`. La vérification de la plateforme accepte les JWT HS256 et les
nouvelles clés de signature asymétriques ; le handler vérifie ensuite aussi le
compte auprès de Supabase Auth et exige le mot de passe actuel. Voir la
[documentation des en-têtes d’authentification](https://supabase.com/docs/guides/functions/auth-headers).

## Vérifier avant les premiers essais

Les tests locaux sans Docker utilisent un vrai moteur PostgreSQL WASM avec les
tables Auth et Storage simulées. Ils valident les politiques SQL, la séparation
des comptes, les conflits de révision et la révocation des sessions, mais ne
remplacent pas l’intégration sur un projet Supabase réel :

```sh
cd supabase
npm ci
npm test
```

Les tests pgTAP de `tests/liora_cloud_trial_test.sql` sont réservés au projet
d’essai. Ils créent deux comptes fictifs dans une transaction finalement annulée.
Avec Docker installé, le CLI peut démarrer une pile locale puis exécuter :

```sh
npx supabase@3.2.0 start
npx supabase@3.2.0 test db
```

Pour le projet d’essai hébergé, sélectionnez explicitement la cible :

```sh
npx supabase@3.2.0 test db --remote=VOTRE_PROJECT_REF
npx supabase@3.2.0 db advisors --remote=VOTRE_PROJECT_REF
```

Après application, testez deux comptes réels d’essai : création et confirmation,
lecture croisée refusée, fichier privé, modification hors ligne puis reprise,
nouveau téléphone, conflit de deux appareils, déconnexion globale et suppression.
Le code de suppression se teste avec `npm test`, sans vrai appel administratif.

### Premier essai de fichiers sur le projet hébergé

Depuis la racine du dépôt, après `npm ci`, préparez deux comptes d’essai
distincts dont l’e-mail est confirmé. Dans un fichier local `.env.trial`
(ignoré par Git), définissez `EXPO_PUBLIC_SUPABASE_URL`,
`EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY`, `LIORA_TEST_OWNER_EMAIL`,
`LIORA_TEST_OWNER_PASSWORD`, `LIORA_TEST_OTHER_EMAIL` et
`LIORA_TEST_OTHER_PASSWORD`. Utilisez uniquement le projet et les comptes
fictifs réservés aux essais.

```sh
node --env-file=.env.trial --test supabase/tests/hosted-storage.mjs
```

Le contrôle ouvre deux sessions indépendantes du propriétaire et une session
de l’autre compte. Il dépose un petit fichier fictif par compte, compare les
octets relus, vérifie le refus de lecture dans les deux sens, puis nettoie les
fichiers créés et ferme ses sessions. Complétez-le sur les deux téléphones
avec l’import depuis le coffre-fort, la synchronisation et l’ouverture du
document après reconnexion.

Avant toute utilisation réelle, définissez aussi la sauvegarde **de la base et
des fichiers**, puis testez une restauration. La synchronisation de deux appareils
ne constitue pas une sauvegarde indépendante contre une suppression accidentelle.

## Suivre les demandes des familles pilotes

La [démo publique](https://aminajarraya284.github.io/liora-expo/) reçoit les demandes
via le bouton **Participer au pilote**. Les adresses sont conservées dans
`private.liora_pilot_requests`. Elles sont accessibles depuis la session
d’administration du projet et restent hors de l’API publique.

Ouvrez la [requête enregistrée dans Supabase](https://supabase.com/dashboard/project/eyxkfzdjkyftgdnsqalh/sql/8d0a1df3-6ca9-4436-9862-a2058260e2ac)
et cliquez sur **Run** pour afficher les demandes les plus récentes en premier.
Vous pouvez aussi copier le texte ci-dessous dans l’éditeur SQL du projet.
Un résultat vide signifie qu’aucune demande n’est enregistrée.

```sql
select email, requested_at
from private.liora_pilot_requests
order by requested_at desc;
```

Le formulaire confirme l’enregistrement dans le navigateur. La prise de contact
avec les familles se fait manuellement à partir de cette liste.

## Sources utilisées

- [Changelog Supabase et rupture CLI v3](https://supabase.com/changelog/supabase-cli-v3)
- [Row Level Security](https://supabase.com/docs/guides/database/postgres/row-level-security)
- [Fonctions Postgres](https://supabase.com/docs/guides/database/functions)
- [Accès Storage](https://supabase.com/docs/guides/storage/security/access-control)
- [Suppression de fichiers via l’API](https://supabase.com/docs/guides/storage/management/delete-objects)
- [Authentification des Edge Functions](https://supabase.com/docs/guides/functions/auth-headers)
- [Clés injectées dans les Edge Functions](https://supabase.com/docs/guides/functions/secrets)
