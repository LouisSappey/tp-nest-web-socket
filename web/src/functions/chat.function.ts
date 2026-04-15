import type { Message, Reaction, Room, UserOption } from '../types/chat.types'

export const EMOJIS = ['🔥', '❤️', '😂', '👍', '🎉']

export function upsertMessageByRoom(
  state: Record<string, Message[]>,
  roomId: string,
  message: Message,
): Record<string, Message[]> {
  const current = state[roomId] ?? []
  const index = current.findIndex((item) => item.id === message.id)
  if (index === -1) {
    return { ...state, [roomId]: [...current, message] }
  }
  const next = [...current]
  next[index] = message
  return { ...state, [roomId]: next }
}

export function updateReactionsByRoom(
  state: Record<string, Message[]>,
  params: { roomId: string; messageId: string; reactions: Reaction[] },
): Record<string, Message[]> {
  const roomMessages = state[params.roomId] ?? []
  return {
    ...state,
    [params.roomId]: roomMessages.map((message) =>
      message.id === params.messageId ? { ...message, reactions: params.reactions } : message,
    ),
  }
}

export function ensureRoom(rooms: Room[], room: Room): Room[] {
  return rooms.some((item) => item.id === room.id) ? rooms : [...rooms, room]
}

export function parseMemberIds(value: string): number[] {
  return value
    .split(',')
    .map((item) => Number(item.trim()))
    .filter((item) => Number.isInteger(item) && item > 0)
}

export function getRoomById(rooms: Room[], roomId: string): Room | undefined {
  return rooms.find((room) => room.id === roomId)
}

export function getInviteCandidates(params: {
  room?: Room
  allUsers: UserOption[]
  currentUserId: number | null
}): UserOption[] {
  const memberIds = new Set(params.room?.memberIds ?? [])
  return params.allUsers.filter((user) => {
    if (params.currentUserId && user.userId === params.currentUserId) {
      return false
    }
    return !memberIds.has(user.userId)
  })
}
