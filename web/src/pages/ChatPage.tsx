import type { FormEvent } from 'react'
import { EMOJIS, getInviteCandidates, getRoomById } from '../functions/chat.function'
import type {
  ChatViewState,
  InviteFormState,
  ProfileFormState,
  RoomFormState,
} from '../types/state.types'

interface ChatPageProps {
  state: ChatViewState
  roomForm: RoomFormState
  inviteForm: InviteFormState
  profileForm: ProfileFormState
  onLogout: () => void
  onSelectRoom: (roomId: string) => void
  onSendMessage: (event: FormEvent) => void
  onDraftChange: (value: string) => void
  onToggleReaction: (messageId: string, emoji: string) => void
  onCreateRoom: (event: FormEvent) => void
  onUpdateRoomForm: (patch: Partial<RoomFormState>) => void
  onInviteToRoom: (event: FormEvent) => void
  onUpdateInviteForm: (patch: Partial<InviteFormState>) => void
  onUpdateProfile: (event: FormEvent) => void
  onUpdateProfileForm: (patch: Partial<ProfileFormState>) => void
}

export function ChatPage({
  state,
  roomForm,
  inviteForm,
  profileForm,
  onLogout,
  onSelectRoom,
  onSendMessage,
  onDraftChange,
  onToggleReaction,
  onCreateRoom,
  onUpdateRoomForm,
  onInviteToRoom,
  onUpdateInviteForm,
  onUpdateProfile,
  onUpdateProfileForm,
}: ChatPageProps) {
  const activeMessages = state.messagesByRoom[state.activeRoomId] ?? []
  const activeRoom = getRoomById(state.rooms, state.activeRoomId)
  const inviteCandidates = getInviteCandidates({
    room: activeRoom,
    allUsers: state.allUsers,
    currentUserId: state.currentUserId,
  })

  return (
    <div className="app">
      <aside className="sidebar">
        <h2>Rooms</h2>
        <div className="rooms">
          {state.rooms.map((room) => (
            <button
              key={room.id}
              className={state.activeRoomId === room.id ? 'room active' : 'room'}
              onClick={() => onSelectRoom(room.id)}
            >
              #{room.name}
            </button>
          ))}
        </div>
        <form className="card" onSubmit={onCreateRoom}>
          <h3>Nouveau salon</h3>
          <input
            value={roomForm.name}
            onChange={(event) => onUpdateRoomForm({ name: event.target.value })}
            placeholder="Nom du salon"
          />
          <select
            value={roomForm.selectedUserId}
            onChange={(event) => onUpdateRoomForm({ selectedUserId: event.target.value })}
          >
            <option value="">Inviter un utilisateur</option>
            {inviteCandidates.map((user) => (
              <option key={user.userId} value={String(user.userId)}>
                {user.username}
              </option>
            ))}
          </select>
          <label className="row">
            <input
              type="checkbox"
              checked={roomForm.invitedCanReadHistory}
              onChange={(event) => onUpdateRoomForm({ invitedCanReadHistory: event.target.checked })}
            />
            Invité voit l’historique
          </label>
          <button type="submit">Créer</button>
        </form>
        {activeRoom && activeRoom.id !== 'general' && (
          <form className="card" onSubmit={onInviteToRoom}>
            <h3>Inviter au salon</h3>
            <select
              value={inviteForm.selectedUserId}
              onChange={(event) => onUpdateInviteForm({ selectedUserId: event.target.value })}
            >
              <option value="">Choisir un utilisateur</option>
              {inviteCandidates.map((user) => (
                <option key={user.userId} value={String(user.userId)}>
                  {user.username}
                </option>
              ))}
            </select>
            <label className="row">
              <input
                type="checkbox"
                checked={inviteForm.canReadHistory}
                onChange={(event) => onUpdateInviteForm({ canReadHistory: event.target.checked })}
              />
              Accès historique
            </label>
            <button type="submit">Inviter</button>
          </form>
        )}
      </aside>

      <main className="chat">
        <header className="chat-header">
          <div>
            <h1>Chat</h1>
            <p>{state.status}</p>
          </div>
          <button className="secondary" onClick={onLogout}>
            Logout
          </button>
        </header>

        <div className="messages">
          {activeMessages.map((message) => (
            <article key={message.id} className="message">
              <div className="message-top">
                <strong style={{ color: message.author.displayColor }}>{message.author.username}</strong>
                <small>{new Date(message.sentAt).toLocaleTimeString()}</small>
              </div>
              <p>{message.content}</p>
              <div className="reactions">
                {message.reactions.map((reaction) => (
                  <div key={reaction.emoji} className="reaction-group">
                    <button
                      className="reaction"
                      onClick={() => onToggleReaction(message.id, reaction.emoji)}
                      title=""
                    >
                      {reaction.emoji} {reaction.users.length}
                    </button>
                    <span className="reaction-tooltip">
                      {reaction.users.map((user) => user.username).join(', ')}
                    </span>
                  </div>
                ))}
                {EMOJIS.filter(
                  (emoji) =>
                    !message.reactions.some(
                      (reaction) =>
                        reaction.emoji === emoji &&
                        reaction.users.some((user) => user.userId === state.currentUserId),
                    ),
                ).map((emoji) => (
                  <button key={emoji} className="reaction add" onClick={() => onToggleReaction(message.id, emoji)}>
                    {emoji}
                  </button>
                ))}
              </div>
            </article>
          ))}
        </div>

        <div className="typing">
          {state.typingUsers.length > 0 && (
            <span>{state.typingUsers.map((user) => user.username).join(', ')} est en train d'écrire...</span>
          )}
        </div>

        <form className="send" onSubmit={onSendMessage}>
          <input
            value={state.draft}
            onChange={(event) => onDraftChange(event.target.value)}
            placeholder="Ton message..."
          />
          <button type="submit">Envoyer</button>
        </form>
      </main>

      <aside className="rightbar">
        <div className="card">
          <h3>Profil</h3>
          <form onSubmit={onUpdateProfile}>
            <input
              value={profileForm.username}
              onChange={(event) => onUpdateProfileForm({ username: event.target.value })}
              placeholder="Username"
            />
            <input
              value={profileForm.displayColor}
              onChange={(event) => onUpdateProfileForm({ displayColor: event.target.value })}
              placeholder="#2563eb"
            />
            <button type="submit">Mettre à jour</button>
          </form>
        </div>
        <div className="card">
          <h3>En ligne ({state.onlineUsers.length})</h3>
          <ul>
            {state.onlineUsers.map((user) => (
              <li key={user.userId} style={{ color: user.displayColor }}>
                {user.username}
              </li>
            ))}
          </ul>
        </div>
        {state.error && <p className="error">{state.error}</p>}
      </aside>
    </div>
  )
}
