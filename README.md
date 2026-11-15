# Amara

La place de marché des artisans de la décoration intérieure au Cameroun : commander des pièces,
réserver des services, découvrir les savoir-faire.

## Organisation

| Dossier             | Contenu                                                                          |
| ------------------- | -------------------------------------------------------------------------------- |
| `apps/client`       | Amara, l'application client (iOS, Android) et le site web, avec les mêmes routes |
| `apps/pro`          | Amara Pro, l'application des marchands                                           |
| `apps/admin`        | Amara Admin, la console web de l'équipe                                          |
| `packages/ui`       | Design system : couleurs, typographies, arches, composants                       |
| `packages/core`     | Modèles de données, validation, montants en FCFA, numéros camerounais            |
| `packages/api`      | Accès aux données (Supabase) et connexion par SMS                                |
| `packages/i18n`     | Traductions français et anglais                                                  |
| `packages/payments` | Interface de paiement, prestataire de test, adaptateur Honelia Pay               |
| `packages/features` | Écrans et briques partagés entre les applications                                |

Règle : une application n'assemble que ses écrans propres. Tout ce qui sert à deux applications vit
dans un paquet.

## Démarrer

```sh
corepack enable
pnpm install
cp .env.example apps/client/.env.development   # clés du projet Supabase de dev
pnpm --filter @amara/app-client web
```

## Vérifier

```sh
pnpm format:check
pnpm typecheck
pnpm test
pnpm build:web
```

Ces vérifications tournent aussi sur chaque pull request (GitHub Actions).

## Environnements

Deux projets Supabase : **dev** (« amara-dev ») et **prod** (nnqnrrsgqxzzesdwvigh).
Chaque migration de `supabase/migrations` est appliquée d'abord en dev, vérifiée, puis en prod.
Les apps lisent `.env.development` en local et `.env.production` pour les builds (voir `.env.example`).

## Paiement

Le paiement passe par la fonction Supabase `payments` (`supabase/functions/payments`), qui utilise
l'interface de `packages/payments`.

Le prestataire et ses accès se règlent dans **Amara Admin, onglet « Paiement »** : prestataire,
mode (essai ou réel), URL de l'API, clé publique, clé secrète et secret des notifications.
Les clés secrètes sont chiffrées dans Supabase Vault ; l'écran peut les remplacer mais jamais
les relire, et seules les fonctions de paiement les lisent. Sans réglage, la fonction refuse tout paiement.

**Honelia Pay** : Amara ouvre une page de paiement hébergée (`POST /checkout/sessions`) où le
client choisit Orange Money, MTN MoMo… L'issue est confirmée par la fonction `payments-webhook`
(notifications signées HMAC-SHA256, vérifiées avec le secret des notifications), qui redemande
toujours l'état de la session à Honelia avant de l'enregistrer. Le retour du client sur le site
(`?session_id=…`) déclenche aussi une vérification, jamais une validation directe.
L'écran « Paiement » affiche l'adresse du webhook et les événements à déclarer chez Honelia.
`payments-webhook` se déploie **sans vérification de jeton** (`verify_jwt = false`) : Honelia
l'appelle sans compte Amara, seule la signature fait foi.

Le prestataire `mock` valide les paiements sans argent réel. Il n'est proposé que sur une base
où le réglage serveur `allow_mock_payments` vaut `true` (dev uniquement, jamais en prod).

## Ateliers

Photos, vidéos et statuts de 24 h des artisans (`packages/api/src/ateliers.ts`,
`packages/features/src/ateliers`). Les fichiers sont dans le stockage Supabase `ateliers`
(privé, 50 Mo par fichier, JPEG, PNG, WebP, MP4, MOV), rangés par boutique. Rien n'est visible
avant la validation de la super admin (Amara Admin, onglet « Contenus ») ; les applications
reçoivent des liens signés valables une heure. Un statut reste en ligne 24 h après sa validation.
