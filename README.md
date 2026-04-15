# TP Nest Chat WebSocket

Backend NestJS pour un chat temps reel avec authentification JWT, chat general, salons prives, reactions emojis et indicateur de saisie.

## Premier lancement (recommande)

```bash
make first_launch
```

Frontend (React): `http://localhost:5173`  
Backend API HTTP: `http://localhost:3000`  
Backend Socket.IO: `ws://localhost:3000`

## Comptes de test

Tu peux te connecter directement avec:

- `alice@example.com` / `password123`
- `bob@example.com` / `password123`
- `charlie@example.com` / `password123`

## Lancement manuel (sans Makefile)

```bash
npm install
npm --prefix web install
cp .env.example .env
cp web/.env.example web/.env
docker compose up -d
```

Lancer le backend:

```bash
npm run start:dev
```

Lancer le frontend (dans un 2eme terminal):

```bash
npm --prefix web run dev
```

## Makefile

Le projet inclut un `Makefile` pour lancer rapidement backend + frontend.

```bash
make help
```

Commandes principales:

- `make first_launch` prepare tout pour un premier lancement (install, env, db, fixtures, build)
- `make install` installe toutes les dependances (backend + frontend)
- `make env` cree `.env` et `web/.env` s'ils n'existent pas
- `make db-up` demarre PostgreSQL
- `make back` lance le backend NestJS
- `make front` lance le frontend React
- `make dev` lance backend + frontend ensemble
- `make build` build backend + frontend
- `make fixtures` ajoute des utilisateurs de test

## Documentation API

- HTTP (OpenAPI): `swagger.yml`
- WebSocket (AsyncAPI): `asyncapi.yml`

Tu peux ouvrir les specs dans :
- [Swagger Editor](https://editor.swagger.io/) pour `swagger.yml`
- [AsyncAPI Studio](https://studio.asyncapi.com/) pour `asyncapi.yml`

## Auth

1. Creer un compte: `POST /auth/register`
2. Se connecter: `POST /auth/login`
3. Recuperer `token`
4. Socket.IO: transmettre le JWT dans `handshake.auth.token`

Exemple client Socket.IO:

```ts
import { io } from 'socket.io-client';

const socket = io('http://localhost:3000', {
  auth: {
    token: '<JWT_TOKEN>',
  },
});
```

## Events WebSocket principaux

- `chat:send_message`
- `chat:new_message`
- `chat:typing_start`
- `chat:typing_stop`
- `chat:typing_users`
- `chat:toggle_reaction`
- `chat:message_reactions_updated`
- `chat:create_room`
- `chat:room_created`
- `chat:room_invited`
- `chat:get_rooms`
- `chat:get_messages`

Les payloads exacts sont documentes dans `asyncapi.yml`.

## Fixtures rapides

Pour injecter des utilisateurs de test:

```bash
make fixtures
```

ou

```bash
npm run fixtures:seed
```

Utilisateurs crees si absents: voir la section `Comptes de test`.
