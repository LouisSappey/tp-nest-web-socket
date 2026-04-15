import { useEffect, useRef, useState } from 'react'
import type { FormEvent } from 'react'
import type { Socket } from 'socket.io-client'
import './App.css'
import {
  authRequest,
  fetchUsersRequest,
  logoutRequest,
  updateProfileRequest,
} from './functions/auth.function'
import {
  ensureRoom,
  parseMemberIds,
  updateReactionsByRoom,
  upsertMessageByRoom,
} from './functions/chat.function'
import { createChatSocket } from './functions/socket.function'
import { AuthPage } from './pages/AuthPage'
import { ChatPage } from './pages/ChatPage'
import type {
  ChatAckMessages,
  ChatConnectedPayload,
  Message,
  ChatNewMessagePayload,
  ChatReactionsUpdatedPayload,
  ChatRoomPayload,
  ChatTypingUsersPayload,
  Room,
} from './types/chat.types'
import type {
  AuthFormState,
  ChatViewState,
  InviteFormState,
  ProfileFormState,
  RoomFormState,
} from './types/state.types'

function App() {
  const [token, setToken] = useState<string>(localStorage.getItem('token') ?? '')
  const [authForm, setAuthForm] = useState<AuthFormState>({
    mode: 'login',
    email: '',
    password: '',
    username: '',
  })
  const [profileForm, setProfileForm] = useState<ProfileFormState>({
    username: '',
    displayColor: '#2563eb',
  })
  const [roomForm, setRoomForm] = useState<RoomFormState>({
    name: '',
    selectedUserId: '',
    invitedCanReadHistory: false,
  })
  const [inviteForm, setInviteForm] = useState<InviteFormState>({
    selectedUserId: '',
    canReadHistory: false,
  })
  const [chatState, setChatState] = useState<ChatViewState>({
    status: 'Disconnected',
    error: '',
    currentUserId: null,
    onlineUsers: [],
    allUsers: [],
    rooms: [],
    activeRoomId: 'general',
    messagesByRoom: {},
    typingUsers: [],
    draft: '',
  })

  const socketRef = useRef<Socket | null>(null)
  const typingTimeoutRef = useRef<number | null>(null)

  const connectSocket = (jwt: string) => {
    if (socketRef.current) {
      socketRef.current.disconnect()
    }

    const socket = createChatSocket(jwt)

    socketRef.current = socket
    setChatState((prev) => ({ ...prev, status: 'Connecting...' }))

    socket.on('connect', () => {
      setChatState((prev) => ({ ...prev, status: 'Connected', error: '' }))
    })

    socket.on('disconnect', () => {
      setChatState((prev) => ({ ...prev, status: 'Disconnected' }))
    })

    socket.on('chat:connected', (payload: ChatConnectedPayload) => {
      setProfileForm({
        username: payload.currentUser.username,
        displayColor: payload.currentUser.displayColor,
      })
      setChatState((prev) => ({
        ...prev,
        currentUserId: payload.currentUser.userId,
        onlineUsers: payload.onlineUsers ?? [],
        rooms:
          payload.rooms?.length > 0
            ? payload.rooms
            : [{ id: 'general', name: 'General', canReadHistory: true, memberIds: [] }],
        messagesByRoom: { ...prev.messagesByRoom, general: payload.messages ?? [] },
        activeRoomId: 'general',
      }))
    })

    socket.on('chat:online_users', (payload) => {
      setChatState((prev) => ({ ...prev, onlineUsers: payload ?? [] }))
    })

    socket.on('chat:new_message', (payload: ChatNewMessagePayload) => {
      if (!payload?.roomId || !payload?.message) return
      setChatState((prev) => ({
        ...prev,
        messagesByRoom: upsertMessageByRoom(prev.messagesByRoom, payload.roomId, payload.message),
      }))
    })

    socket.on('chat:typing_users', (payload: ChatTypingUsersPayload) => {
      setChatState((prev) => ({ ...prev, typingUsers: payload?.users ?? [] }))
    })

    socket.on('chat:message_reactions_updated', (payload: ChatReactionsUpdatedPayload) => {
      const roomId = payload?.roomId
      const messageId = payload?.messageId
      const reactions = payload?.reactions ?? []
      if (!roomId || !messageId) return
      setChatState((prev) => ({
        ...prev,
        messagesByRoom: updateReactionsByRoom(prev.messagesByRoom, { roomId, messageId, reactions }),
      }))
    })

    socket.on('chat:room_created', (payload: ChatRoomPayload) => {
      if (!payload?.room) return
      setChatState((prev) => ({ ...prev, rooms: ensureRoom(prev.rooms, payload.room) }))
    })

    socket.on('chat:room_invited', (payload: ChatRoomPayload) => {
      if (!payload?.room) return
      setChatState((prev) => ({
        ...prev,
        rooms: ensureRoom(prev.rooms, payload.room),
        messagesByRoom: { ...prev.messagesByRoom, [payload.room.id]: payload.messages ?? [] },
      }))
    })
  }

  useEffect(() => {
    if (!token) return
    connectSocket(token)
    fetchUsersRequest(token)
      .then((users) => {
        setChatState((prev) => ({
          ...prev,
          allUsers: users,
        }))
      })
      .catch(() => null)
    return () => {
      socketRef.current?.disconnect()
      socketRef.current = null
    }
  }, [token])

  useEffect(() => {
    const socket = socketRef.current
    if (!socket || !chatState.activeRoomId) return
    socket.emit('chat:get_messages', { roomId: chatState.activeRoomId }, (ack: ChatAckMessages) => {
      if (ack?.ok) {
        setChatState((prev) => ({
          ...prev,
          messagesByRoom: { ...prev.messagesByRoom, [prev.activeRoomId]: ack.messages ?? [] },
        }))
      }
    })
  }, [chatState.activeRoomId])

  const authSubmit = async (event: FormEvent) => {
    event.preventDefault()
    setChatState((prev) => ({ ...prev, error: '' }))
    try {
      const data = await authRequest(authForm)
      if (authForm.mode === 'register') {
        setAuthForm({ mode: 'login', email: '', password: '', username: '' })
        return
      }
      if (data.token) {
        localStorage.setItem('token', data.token)
        setToken(data.token)
        setAuthForm((prev) => ({ ...prev, email: '', password: '' }))
      }
    } catch (error) {
      setChatState((prev) => ({
        ...prev,
        error: error instanceof Error ? error.message : 'Authentication failed',
      }))
    }
  }

  const logout = async () => {
    if (token) {
      await logoutRequest(token)
    }
    socketRef.current?.disconnect()
    socketRef.current = null
    localStorage.removeItem('token')
    setToken('')
    setChatState((prev) => ({
      ...prev,
      status: 'Disconnected',
      currentUserId: null,
      onlineUsers: [],
      allUsers: [],
      rooms: [],
      messagesByRoom: {},
      typingUsers: [],
      draft: '',
      activeRoomId: 'general',
    }))
  }

  const sendMessage = (event: FormEvent) => {
    event.preventDefault()
    const content = chatState.draft.trim()
    if (!content || !socketRef.current) return
    socketRef.current.emit(
      'chat:send_message',
      { roomId: chatState.activeRoomId, content },
      (ack: { ok: boolean; message?: Message }) => {
        if (ack?.ok && ack.message) {
          setChatState((prev) => ({
            ...prev,
            messagesByRoom: upsertMessageByRoom(
              prev.messagesByRoom,
              prev.activeRoomId,
              ack.message as Message,
            ),
          }))
        }
      },
    )
    setChatState((prev) => ({ ...prev, draft: '' }))
    socketRef.current.emit('chat:typing_stop')
  }

  const emitTyping = (value: string) => {
    setChatState((prev) => ({ ...prev, draft: value }))
    if (!socketRef.current) return
    socketRef.current.emit('chat:typing_start')
    if (typingTimeoutRef.current) {
      window.clearTimeout(typingTimeoutRef.current)
    }
    typingTimeoutRef.current = window.setTimeout(() => {
      socketRef.current?.emit('chat:typing_stop')
    }, 900)
  }

  const toggleReaction = (messageId: string, emoji: string) => {
    socketRef.current?.emit('chat:toggle_reaction', {
      roomId: chatState.activeRoomId,
      messageId,
      emoji,
    })
  }

  const createRoom = (event: FormEvent) => {
    event.preventDefault()
    if (!roomForm.name.trim()) return
    const memberIds = roomForm.selectedUserId ? parseMemberIds(roomForm.selectedUserId) : []
    socketRef.current?.emit(
      'chat:create_room',
      {
        name: roomForm.name.trim(),
        memberIds,
        invitedCanReadHistory: roomForm.invitedCanReadHistory,
      },
      (ack: { ok: boolean; room?: Room }) => {
        if (ack?.ok && ack.room) {
          setChatState((prev) => ({
            ...prev,
            rooms: ensureRoom(prev.rooms, ack.room as Room),
            activeRoomId: ack.room?.id ?? prev.activeRoomId,
          }))
          setRoomForm({ name: '', selectedUserId: '', invitedCanReadHistory: false })
        }
      },
    )
  }

  const inviteToRoom = (event: FormEvent) => {
    event.preventDefault()
    if (!inviteForm.selectedUserId || !socketRef.current) return
    socketRef.current.emit(
      'chat:invite_to_room',
      {
        roomId: chatState.activeRoomId,
        userId: Number(inviteForm.selectedUserId),
        canReadHistory: inviteForm.canReadHistory,
      },
      (ack: { ok: boolean; room?: Room }) => {
        if (ack?.ok && ack.room) {
          setChatState((prev) => ({
            ...prev,
            rooms: ensureRoom(prev.rooms, ack.room as Room),
          }))
          setInviteForm({ selectedUserId: '', canReadHistory: false })
        }
      },
    )
  }

  const updateProfile = async (event: FormEvent) => {
    event.preventDefault()
    if (!token) return
    try {
      const data = await updateProfileRequest({
        token,
        username: profileForm.username,
        displayColor: profileForm.displayColor,
      })
      setProfileForm((prev) => ({ ...prev, username: data.username, displayColor: data.displayColor }))
    } catch (error) {
      setChatState((prev) => ({
        ...prev,
        error: error instanceof Error ? error.message : 'Profile update failed',
      }))
    }
  }

  if (!token) {
    return (
      <AuthPage
        form={authForm}
        error={chatState.error}
        onSubmit={authSubmit}
        onToggleMode={() =>
          setAuthForm((prev) => ({
            ...prev,
            mode: prev.mode === 'login' ? 'register' : 'login',
          }))
        }
        onChange={(patch) => setAuthForm((prev) => ({ ...prev, ...patch }))}
      />
    )
  }

  return (
    <ChatPage
      state={chatState}
      roomForm={roomForm}
      inviteForm={inviteForm}
      profileForm={profileForm}
      onLogout={logout}
      onSelectRoom={(roomId) => setChatState((prev) => ({ ...prev, activeRoomId: roomId }))}
      onSendMessage={sendMessage}
      onDraftChange={emitTyping}
      onToggleReaction={toggleReaction}
      onCreateRoom={createRoom}
      onUpdateRoomForm={(patch) => setRoomForm((prev) => ({ ...prev, ...patch }))}
      onInviteToRoom={inviteToRoom}
      onUpdateInviteForm={(patch) => setInviteForm((prev) => ({ ...prev, ...patch }))}
      onUpdateProfile={updateProfile}
      onUpdateProfileForm={(patch) => setProfileForm((prev) => ({ ...prev, ...patch }))}
    />
  )
}

export default App
