import { io } from 'socket.io-client'

const API_URL = import.meta.env.VITE_API_URL ?? 'http://localhost:3000'

export function createChatSocket(token: string) {
  return io(API_URL, {
    transports: ['websocket'],
    auth: { token },
  })
}
