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
cp .env.example apps/client/.env   # puis renseigner les clés Supabase
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
