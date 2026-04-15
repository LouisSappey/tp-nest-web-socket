# TP Nest Chat WebSocket

Backend NestJS pour un chat temps reel avec authentification JWT, chat general, salons prives, reactions emojis et indicateur de saisie.

## Lancement rapide

```bash
npm install
cp .env.example .env
docker compose up -d
npm run start:dev
```

API HTTP: `http://localhost:3000`  
Socket.IO: `ws://localhost:3000`

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
