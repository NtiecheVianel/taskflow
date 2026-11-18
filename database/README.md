# Base PostgreSQL TaskFlow

Ce dossier contient les migrations SQL. Elles sont exécutées **sur le PC local**, à côté de PostgreSQL, jamais depuis Render.

La table `schema_migrations` est créée par le script de migration. Elle n'est pas dans `001_initial_schema.sql`.

## Prérequis

- PostgreSQL 13 ou plus récent (les installations locales 17 et 18 conviennent).
- Un rôle et une base dédiés à l'application. Ne pas utiliser le superuser `postgres` pour la passerelle.

## Créer le rôle et la base

Dans `psql`, connecté en tant qu'administrateur local :

```sql
CREATE USER taskflow_app WITH PASSWORD 'choisir_un_mot_de_passe_long';
CREATE DATABASE taskflow OWNER taskflow_app;
```

Puis, dans `.env` de `local-gateway` :

```text
DB_HOST=127.0.0.1
DB_PORT=5432
DB_NAME=taskflow
DB_USER=taskflow_app
DB_PASSWORD=choisir_un_mot_de_passe_long
DB_SSL=false
```

## Appliquer les migrations

Depuis `local-gateway` :

```powershell
npm run db:migrate
```

Le script n'applique que les fichiers encore absents de `schema_migrations`. Il ne supprime aucune donnée.

Relancer la commande est sans effet si rien de nouveau n'a été ajouté.
