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
les relire, et seule la fonction `payments` les lit. Sans réglage, la fonction refuse tout paiement.

Le prestataire `mock` valide les paiements sans argent réel. Il n'est proposé que sur une base
où le réglage serveur `allow_mock_payments` vaut `true` (dev uniquement, jamais en prod).
