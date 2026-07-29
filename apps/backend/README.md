## api endpoints

1. `POST /api/repo` - takes github repo link
2. `GET /api/repo/:repoId/issues` — fetches and syncs GitHub issues into the Issue table (including mapping to relevant files if possible)
3. `GET /api/repo/:repoId/issues/:issueId` — single issue detail
4. `POST /api/repo/:repoId/chats` — create chat
5. `GET /api/repo/:repoId/chats` — list chats
6. `GET /api/chats/:chatId/messages` — get messages
7. `POST /api/chats/:chatId/messages` — send message + get AI response
