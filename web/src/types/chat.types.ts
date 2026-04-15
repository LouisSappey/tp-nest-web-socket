export interface User {
  userId: number
  username: string
  email?: string
  displayColor: string
}

export interface Reaction {
  emoji: string
  users: User[]
}

export interface Message {
  id: string
  content: string
  sentAt: string
  author: User
  reactions: Reaction[]
}

export interface Room {
  id: string
  name: string
  canReadHistory: boolean
  memberIds: number[]
}

export interface ChatConnectedPayload {
  currentUser: User
  onlineUsers: User[]
  messages: Message[]
  rooms: Room[]
}

export interface ChatNewMessagePayload {
  roomId: string
  message: Message
}

export interface ChatTypingUsersPayload {
  users: User[]
}

export interface ChatReactionsUpdatedPayload {
  roomId: string
  messageId: string
  reactions: Reaction[]
}

export interface ChatRoomPayload {
  room: Room
  messages?: Message[]
}

export interface ChatAckMessages {
  ok: boolean
  messages: Message[]
}

export interface UserOption {
  userId: number
  username: string
  email: string
  displayColor: string
}
