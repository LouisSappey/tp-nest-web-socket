import type { UserOption } from '../types/chat.types'

const API_URL = import.meta.env.VITE_API_URL ?? 'http://localhost:3000'

export async function authRequest(params: {
  mode: 'login' | 'register'
  email: string
  password: string
  username: string
}): Promise<{ token?: string }> {
  const endpoint = params.mode === 'login' ? 'login' : 'register'
  const payload =
    params.mode === 'login'
      ? { email: params.email, password: params.password }
      : { username: params.username, email: params.email, password: params.password }

  const response = await fetch(`${API_URL}/auth/${endpoint}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  })

  if (!response.ok) {
    const data = await response.json().catch(() => ({}))
    throw new Error(data?.message ?? 'Authentication failed')
  }

  return response.json()
}

export async function logoutRequest(token: string): Promise<void> {
  await fetch(`${API_URL}/auth/logout`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}` },
  }).catch(() => null)
}

export async function updateProfileRequest(params: {
  token: string
  username: string
  displayColor: string
}): Promise<{ username: string; displayColor: string }> {
  const response = await fetch(`${API_URL}/profile`, {
    method: 'PATCH',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${params.token}`,
    },
    body: JSON.stringify({
      username: params.username,
      displayColor: params.displayColor,
    }),
  })

  if (!response.ok) {
    const data = await response.json().catch(() => ({}))
    throw new Error(data?.message ?? 'Profile update failed')
  }

  return response.json()
}

export async function fetchUsersRequest(token: string): Promise<UserOption[]> {
  const response = await fetch(`${API_URL}/users`, {
    method: 'GET',
    headers: {
      Authorization: `Bearer ${token}`,
    },
  })

  if (!response.ok) {
    const data = await response.json().catch(() => ({}))
    throw new Error(data?.message ?? 'Failed to load users')
  }

  const users = await response.json()
  return users.map((user: { id: number; username: string; email: string; displayColor: string }) => ({
    userId: user.id,
    username: user.username,
    email: user.email,
    displayColor: user.displayColor,
  }))
}
