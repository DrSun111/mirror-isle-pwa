const API_BASE_URL = import.meta.env.VITE_API_BASE_URL ?? 'http://127.0.0.1:8008/api'

export interface LoginPayload {
  email: string
  code: string
  nickname: string
  city: string
  goal: string
  privacy: string
  age_confirmed: boolean
}

export interface ProfileUpdatePayload {
  nickname: string
  city: string
  goal: string
  privacy: string
  age_confirmed: boolean
}

export interface ApiUser {
  id: string
  email_masked: string
  nickname: string
  city: string
  goal: string
  privacy: string
  age_confirmed: boolean
  identity_status: string
}

export interface ApiRecommendation {
  id: string
  nickname: string
  city: string
  goal: string
  score: number
  traits: Record<string, number>
  anchors: string[]
  intro: string
  is_seed: boolean
  similar: string[]
  different: string[]
  friction: string[]
}

export interface ApiTreePost {
  id: string
  author: string
  visibility: string
  content: string
  tags: string[]
  status: string
  created_at: string
  mine: boolean
}

export interface ApiMessage {
  id: string
  conversation_id: string
  sender_id: string
  content: string
  status: string
  created_at: string
}

const request = async <T>(path: string, options: RequestInit = {}, token?: string | null): Promise<T> => {
  const response = await fetch(`${API_BASE_URL}${path}`, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...options.headers,
    },
  })

  if (!response.ok) {
    const detail = await response.text().catch(() => '')
    throw new Error(detail || `${response.status} ${response.statusText}`)
  }

  return response.json() as Promise<T>
}

export const sendLoginCode = (email: string) =>
  request<{ email_masked: string; expires_in_seconds: number; provider: string }>('/auth/send-code', {
    method: 'POST',
    body: JSON.stringify({ email }),
  })

export const verifyEmailCode = (email: string, code: string) =>
  request<{ token: string; user: ApiUser }>('/auth/verify-code', {
    method: 'POST',
    body: JSON.stringify({ email, code }),
  })

export const loginWithCode = (payload: LoginPayload) =>
  request<{ token: string; user: ApiUser }>('/auth/login', {
    method: 'POST',
    body: JSON.stringify(payload),
  })

export const updateMe = (token: string, payload: ProfileUpdatePayload) =>
  request<{ user: ApiUser }>(
    '/me',
    {
      method: 'PATCH',
      body: JSON.stringify(payload),
    },
    token,
  )

export const saveAssessment = (token: string, answers: Record<string, string>) =>
  request<{ traits: Record<string, number>; confidence: number; anchors: string[] }>(
    '/assessment',
    {
      method: 'POST',
      body: JSON.stringify({ answers }),
    },
    token,
  )

export const submitIdentity = (token: string, realName: string, idNumber: string) =>
  request<{ identity_status: string; provider: string }>(
    '/identity/submit',
    {
      method: 'POST',
      body: JSON.stringify({ real_name: realName, id_number: idNumber, consent: true }),
    },
    token,
  )

export const fetchRecommendations = (token: string) =>
  request<{ items: ApiRecommendation[]; score_version: string }>('/recommendations', {}, token)

export const fetchTreePosts = (token: string) =>
  request<{ items: ApiTreePost[] }>('/treehole/posts', {}, token)

export const createTreePost = (token: string, content: string, visibility: string, tags: string[]) =>
  request<{ id: string; status: string; moderation: unknown }>(
    '/treehole/posts',
    {
      method: 'POST',
      body: JSON.stringify({ content, visibility, tags }),
    },
    token,
  )

export const startConversation = (token: string, peerUserId: string) =>
  request<{ conversation_id: string }>(
    '/conversations/start',
    {
      method: 'POST',
      body: JSON.stringify({ peer_user_id: peerUserId }),
    },
    token,
  )

export const fetchConversationMessages = (token: string, conversationId: string) =>
  request<{ items: ApiMessage[] }>(`/conversations/${conversationId}/messages`, {}, token)

export const sendConversationMessage = (token: string, conversationId: string, content: string) =>
  request<{ message: { id: string; status: string; content: string }; moderation: unknown }>(
    `/conversations/${conversationId}/messages`,
    {
      method: 'POST',
      body: JSON.stringify({ content }),
    },
    token,
  )

export { API_BASE_URL }
