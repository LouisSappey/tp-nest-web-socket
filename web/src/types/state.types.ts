import type { Message, Room, User } from './chat.types'

export interface AuthFormState {
  mode: 'login' | 'register'
  email: string
  password: string
  username: string
}

export interface ProfileFormState {
  username: string
  displayColor: string
}

export interface RoomFormState {
  name: string
  selectedUserId: string
  invitedCanReadHistory: boolean
}

export interface InviteFormState {
  selectedUserId: string
  canReadHistory: boolean
}

export interface ChatViewState {
  status: string
  error: string
  currentUserId: number | null
  onlineUsers: User[]
  rooms: Room[]
  activeRoomId: string
  messagesByRoom: Record<string, Message[]>
  typingUsers: User[]
  draft: string
}
