import { createClient, type SupabaseClient, type User } from '@supabase/supabase-js'

const DEFAULT_SUPABASE_URL = 'https://mvbjhesgjwcyzqavqoyv.supabase.co'
const DEFAULT_SUPABASE_ANON_KEY = 'sb_publishable_pg7-4rkL_qLLBV0iHBK2pw_qTFYV4E_'
const REST_API_BASE_URL = import.meta.env.VITE_API_BASE_URL ?? 'http://127.0.0.1:8008/api'
const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL || DEFAULT_SUPABASE_URL
const SUPABASE_ANON_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY || DEFAULT_SUPABASE_ANON_KEY
const INVITE_CODE_SOURCE = import.meta.env.VITE_INVITE_CODES?.trim() || 'JINGYU2026,MIRROR2026,NEICE2026'
const INVITE_CODES = INVITE_CODE_SOURCE
  .split(',')
  .map((code: string) => code.trim().toUpperCase())
  .filter(Boolean)

const supabase: SupabaseClient | null =
  SUPABASE_URL && SUPABASE_ANON_KEY
    ? createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
        auth: {
          autoRefreshToken: true,
          detectSessionInUrl: false,
          persistSession: true,
        },
      })
    : null

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
  public_profile?: Record<string, unknown>
  intro?: string
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

export interface ApiProfile extends ApiUser {
  traits: Record<string, number>
  answers: Record<string, unknown>
  confidence: number
  anchors: string[]
  created_at: string
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
  public_profile?: Record<string, unknown>
}

export interface ApiFriendResult {
  friend: ApiRecommendation
  conversation_id: string
  friendship_id?: string
}

export interface ApiTreePost {
  id: string
  author: string
  visibility: string
  content: string
  images?: string[]
  tags: string[]
  status: string
  created_at: string
  mine: boolean
}

export interface ApiAppRelease {
  version: string
  apk_url: string
  page_url: string
  notes: string
  mandatory: boolean
  source: 'supabase'
}

export interface ApiMessage {
  id: string
  conversation_id: string
  sender_id: string
  content: string
  status: string
  created_at: string
}

interface MirrorProfileRow {
  id: string
  email: string | null
  nickname: string
  city: string
  goal: string
  privacy: string
  age_confirmed: boolean
  identity_status: string
  traits: Record<string, number> | null
  answers: Record<string, string> | null
  confidence: number | null
  anchors: string[] | null
  intro: string | null
  created_at: string
  updated_at: string
  last_login_at?: string | null
}

interface MirrorTreePostRow {
  id: string
  user_id: string
  author: string
  visibility: string
  content: string
  images: string[] | null
  tags: string[] | null
  status: string
  moderation: Record<string, unknown> | null
  created_at: string
}

interface MirrorAppReleaseRow {
  version: string
  apk_url: string
  page_url: string
  notes: string | null
  mandatory: boolean | null
  is_active: boolean
  created_at: string
}

const MEDIA_BUCKET = 'mirror-media'

interface MirrorMessageRow {
  id: string
  conversation_id: string
  sender_id: string
  content: string
  status: string
  moderation: Record<string, unknown> | null
  created_at: string
}

const dimensions = ['values', 'lifestyle', 'relationship', 'communication', 'growth', 'boundary'] as const
type DimensionKey = (typeof dimensions)[number]

const defaultTraits: Record<DimensionKey, number> = {
  values: 50,
  lifestyle: 50,
  relationship: 50,
  communication: 50,
  growth: 50,
  boundary: 50,
}

const questionEffects: Record<string, Record<string, Partial<Record<DimensionKey, number>> & { anchor: string }>> = {
  'friday-night': {
    'read-alone': { lifestyle: 7, boundary: 8, communication: -3, anchor: '低频社交者' },
    'small-party': { relationship: 7, communication: 5, boundary: 2, anchor: '温和连接者' },
    'new-world': { growth: 8, values: 5, communication: 4, anchor: '探索者' },
    'quiet-chat': { relationship: 8, boundary: 6, communication: 3, anchor: '深聊型人格' },
  },
  schedule: {
    prepare: { lifestyle: 12, boundary: 4, anchor: '计划型生活者' },
    'on-time': { lifestyle: 8, communication: 4, anchor: '稳定同行者' },
    'ten-minutes': { lifestyle: -4, relationship: 3, anchor: '弹性节奏者' },
    'same-day': { lifestyle: -9, growth: 4, anchor: '即兴探索者' },
  },
  conflict: {
    'talk-now': { communication: 7, relationship: 5, anchor: '即时修复者' },
    'cool-down': { boundary: 9, communication: 2, anchor: '反思修复者' },
    'feelings-first': { relationship: 9, communication: 8, anchor: '情绪读懂者' },
    'solve-first': { communication: -4, lifestyle: 4, values: 3, anchor: '行动修复者' },
  },
  reply: {
    'assume-busy': { relationship: -3, boundary: 7, anchor: '安全空间感' },
    'check-myself': { communication: 7, growth: 4, anchor: '反思型沟通者' },
    'do-my-thing': { boundary: 10, lifestyle: 5, anchor: '自我稳定者' },
    'need-clarity': { relationship: 9, communication: 4, anchor: '清晰感需要者' },
  },
  money: {
    travel: { values: 9, growth: 5, anchor: '体验追寻者' },
    'stable-life': { values: -6, lifestyle: 7, anchor: '生活建造者' },
    learning: { growth: 10, values: 4, anchor: '成长追寻者' },
    saving: { values: -8, boundary: 5, lifestyle: 5, anchor: '安全优先者' },
  },
  'growth-theme': {
    boundary: { boundary: 10, growth: 4, anchor: '边界练习者' },
    expression: { communication: 9, growth: 5, anchor: '表达练习者' },
    career: { values: 4, growth: 9, anchor: '方向寻找者' },
    intimacy: { relationship: 10, boundary: 4, anchor: '亲密学习者' },
  },
}

const request = async <T>(path: string, options: RequestInit = {}, token?: string | null): Promise<T> => {
  const response = await fetch(`${REST_API_BASE_URL}${path}`, {
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

interface MirrorFriendRow {
  id: string
  requester_id: string
  addressee_id: string
  status: string
  created_at: string
  updated_at: string
}

const supabaseAuthRequest = async <T>(path: string, body: Record<string, unknown>): Promise<T> => {
  if (!SUPABASE_URL || !SUPABASE_ANON_KEY) throw new Error('supabase_not_configured')

  const controller = new AbortController()
  const timeout = window.setTimeout(() => controller.abort(), 18000)
  const authUrl = `${SUPABASE_URL.replace(/\/$/, '')}/auth/v1${path}`

  try {
    const response = await fetch(authUrl, {
      method: 'POST',
      headers: {
        apikey: SUPABASE_ANON_KEY,
        Authorization: `Bearer ${SUPABASE_ANON_KEY}`,
        'Content-Type': 'application/json',
        'X-Client-Info': 'mirror-isle-beta',
      },
      body: JSON.stringify(body),
      signal: controller.signal,
    })

    const text = await response.text().catch(() => '')
    let data: Record<string, unknown> = {}
    if (text) {
      try {
        data = JSON.parse(text) as Record<string, unknown>
      } catch {
        data = { message: text }
      }
    }

    if (!response.ok) {
      const code = data?.error_code ?? data?.code
      const detail =
        data?.msg ??
        data?.message ??
        data?.error_description ??
        data?.error ??
        `${response.status} ${response.statusText}`
      throw new Error(code ? `${String(code)}: ${String(detail)}` : String(detail))
    }

    return data as T
  } catch (error) {
    if (error instanceof DOMException && error.name === 'AbortError') {
      throw new Error('network_timeout')
    }
    if (error instanceof TypeError) {
      throw new Error('network_unreachable')
    }
    throw error
  } finally {
    window.clearTimeout(timeout)
  }
}

const client = () => {
  if (!supabase) throw new Error('supabase_not_configured')
  return supabase
}

const hasSupabase = () => Boolean(supabase)

export const uploadMediaImage = async (token: string, dataUrl: string, category: 'avatars' | 'posts') => {
  if (!hasSupabase() || !dataUrl.startsWith('data:image')) return dataUrl

  void token
  const user = await getCurrentUser()
  const image = dataUrlToImageBlob(dataUrl)
  const objectPath = `${user.id}/${category}/${Date.now()}-${randomObjectId()}.${image.extension}`
  const { error } = await client().storage.from(MEDIA_BUCKET).upload(objectPath, image.blob, {
    contentType: image.contentType,
    upsert: false,
  })
  if (error) throw error

  const { data } = client().storage.from(MEDIA_BUCKET).getPublicUrl(objectPath)
  return data.publicUrl
}

export const fetchLatestAppRelease = async () => {
  if (!hasSupabase()) return null

  const { data, error } = await client()
    .from('mirror_app_releases')
    .select('*')
    .eq('is_active', true)
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle<MirrorAppReleaseRow>()
  if (error) throw error
  if (!data) return null
  return {
    version: data.version,
    apk_url: data.apk_url,
    page_url: data.page_url,
    notes: data.notes ?? '',
    mandatory: Boolean(data.mandatory),
    source: 'supabase' as const,
  } satisfies ApiAppRelease
}

const normalizeEmail = (email: string) => email.trim().toLowerCase()

const normalizeInviteCode = (inviteCode: string) => inviteCode.trim().toUpperCase()

const assertInviteCode = (inviteCode: string) => {
  const normalized = normalizeInviteCode(inviteCode)
  if (!normalized || !INVITE_CODES.includes(normalized)) throw new Error('invalid_invite_code')
  return normalized
}

const maskEmail = (email: string) => {
  const [local, domain] = email.split('@')
  if (!domain) return email
  const visible = local.length > 2 ? local.slice(0, 2) : local.slice(0, 1)
  return `${visible}***@${domain}`
}

const rowToUser = (row: MirrorProfileRow, user?: User | null): ApiUser => ({
  id: row.id,
  email_masked: maskEmail(user?.email ?? ''),
  nickname: row.nickname,
  city: row.city,
  goal: row.goal,
  privacy: row.privacy,
  age_confirmed: Boolean(row.age_confirmed),
  identity_status: row.identity_status,
})

const rowToProfile = (row: MirrorProfileRow, user?: User | null): ApiProfile => ({
  ...rowToUser(row, user),
  traits: row.traits ?? defaultTraits,
  answers: (row.answers ?? {}) as Record<string, string>,
  confidence: row.confidence ?? 48,
  anchors: row.anchors?.length ? row.anchors : ['深度探索者'],
  created_at: row.created_at,
})

const getCurrentUser = async () => {
  const { data, error } = await client().auth.getUser()
  if (error || !data.user) throw error ?? new Error('missing_supabase_user')
  return data.user
}

const ensureProfile = async (user: User) => {
  const now = new Date().toISOString()
  const email = normalizeEmail(user.email ?? '') || null
  const existing = await client()
    .from('mirror_profiles')
    .select('*')
    .eq('id', user.id)
    .maybeSingle<MirrorProfileRow>()
  if (existing.error) throw existing.error
  if (existing.data) {
    const updated = await client()
      .from('mirror_profiles')
      .update({ email, last_login_at: now, updated_at: now })
      .eq('id', user.id)
      .select('*')
      .single<MirrorProfileRow>()
    if (updated.error) throw updated.error
    return updated.data
  }

  const nickname = (user.email?.split('@')[0] || '镜屿用户').slice(0, 18)
  const inserted = await client()
    .from('mirror_profiles')
    .insert({
      id: user.id,
      email,
      nickname,
      city: '未设置',
      goal: '深度朋友',
      privacy: 'friends',
      age_confirmed: false,
      identity_status: 'unsubmitted',
      traits: defaultTraits,
      answers: {},
      confidence: 48,
      anchors: ['深度探索者'],
      intro: '刚来到镜屿，正在完成自己的初见心谱。',
      last_login_at: now,
    })
    .select('*')
    .single<MirrorProfileRow>()
  if (inserted.error) throw inserted.error
  return inserted.data
}

const buildTraits = (answers: Record<string, string>) => {
  const traits: Record<DimensionKey, number> = { ...defaultTraits }
  const anchors: string[] = []

  Object.entries(answers).forEach(([questionId, optionId]) => {
    const effect = questionEffects[questionId]?.[optionId]
    if (!effect) return
    dimensions.forEach((key) => {
      if (effect[key] === undefined) return
      traits[key] = clamp(traits[key] + Number(effect[key]), 12, 92)
    })
    if (effect.anchor && !anchors.includes(effect.anchor)) anchors.push(effect.anchor)
  })

  return {
    traits,
    confidence: clamp(48 + Object.keys(answers).length * 8, 48, 88),
    anchors: anchors.length ? anchors : ['深度探索者', '成长追寻者'],
  }
}

const scoreMatch = (mine: Record<string, number>, peer: Record<string, number>) => {
  const weights: Record<DimensionKey, number> = {
    values: 0.25,
    lifestyle: 0.2,
    relationship: 0.2,
    communication: 0.1,
    growth: 0.1,
    boundary: 0.15,
  }
  const score = dimensions.reduce((sum, key) => {
    const myValue = mine[key] ?? 50
    const peerValue = peer[key] ?? 50
    return sum + (100 - Math.abs(myValue - peerValue)) * weights[key]
  }, 0)
  return Math.round(clamp(score, 62, 96))
}

const explainMatch = (mine: Record<string, number>, peer: Record<string, number>) => {
  const labels: Record<DimensionKey, string> = {
    values: '价值观',
    lifestyle: '生活节律',
    relationship: '关系需求',
    communication: '沟通方式',
    growth: '成长方向',
    boundary: '边界感',
  }
  const close = [...dimensions]
    .sort((a, b) => Math.abs((mine[a] ?? 50) - (peer[a] ?? 50)) - Math.abs((mine[b] ?? 50) - (peer[b] ?? 50)))
    .slice(0, 2)
  const far = [...dimensions]
    .sort((a, b) => Math.abs((mine[b] ?? 50) - (peer[b] ?? 50)) - Math.abs((mine[a] ?? 50) - (peer[a] ?? 50)))
    .slice(0, 2)
  return {
    similar: close.map((key) => `${labels[key]}接近，交流会更自然。`),
    different: far.map((key) => `${labels[key]}存在差异，适合早点说清偏好。`),
    friction: far.slice(0, 1).map((key) => `${labels[key]}可能带来节奏落差，需要温和确认。`),
  }
}

const localModeration = (content: string) => {
  const labels: string[] = []
  const riskyWords = /(?:\u5fae\u4fe1|VX|QQ|\u624b\u673a\u53f7|\u7535\u8bdd|\u8f6c\u8d26|\u6295\u8d44|\u8d37\u6b3e|\u88f8\u804a|\u7ea6\u70ae|\u81ea\u6740|\u8f7b\u751f)/i
  if (riskyWords.test(content)) labels.push('risk_keyword')
  if (/\b1[3-9]\d{9}\b/.test(content)) labels.push('phone_number')
  if (/[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}/.test(content)) labels.push('email')
  return {
    status: labels.length ? 'pending' : 'approved',
    labels,
    score: 100 - labels.length * 25,
    provider: 'supabase_local_rules',
  }
}

export const sendLoginCode = async (email: string) => {
  if (!hasSupabase()) {
    return request<{ email_masked: string; expires_in_seconds: number; provider: string }>('/auth/send-code', {
      method: 'POST',
      body: JSON.stringify({ email }),
    })
  }

  await supabaseAuthRequest('/otp', {
    email: email.trim().toLowerCase(),
    create_user: true,
  })
  return { email_masked: maskEmail(email), expires_in_seconds: 300, provider: 'supabase_auth' }
}

export const verifyEmailCode = async (email: string, code: string) => {
  if (!hasSupabase()) {
    return request<{ token: string; user: ApiUser }>('/auth/verify-code', {
      method: 'POST',
      body: JSON.stringify({ email, code }),
    })
  }

  const normalizedEmail = email.trim().toLowerCase()
  const normalizedCode = code.trim()
  const verifyTypes = ['email', 'signup', 'magiclink']
  let lastError: unknown = null
  let data:
    | {
        access_token?: string
        refresh_token?: string
        user?: User
      }
    | null = null

  for (const type of verifyTypes) {
    try {
      data = await supabaseAuthRequest('/verify', {
        email: normalizedEmail,
        token: normalizedCode,
        type,
      })
      break
    } catch (error) {
      lastError = error
    }
  }

  if (!data) throw lastError instanceof Error ? lastError : new Error('otp_verify_failed')
  if (!data.access_token || !data.refresh_token || !data.user) throw new Error('missing_supabase_session')
  const session = await client().auth.setSession({
    access_token: data.access_token,
    refresh_token: data.refresh_token,
  })
  if (session.error) throw session.error
  const profile = await ensureProfile(data.user)
  return { token: data.access_token, user: rowToUser(profile, data.user) }
}

export const loginWithPassword = async (email: string, password: string) => {
  if (!hasSupabase()) {
    return request<{ token: string; user: ApiUser; profile: ApiProfile }>('/auth/password-login', {
      method: 'POST',
      body: JSON.stringify({ email, password }),
    })
  }

  const { data, error } = await client().auth.signInWithPassword({
    email: email.trim().toLowerCase(),
    password,
  })
  if (error || !data.session || !data.user) throw error ?? new Error('missing_supabase_session')
  const profile = await ensureProfile(data.user)
  return {
    token: data.session.access_token,
    user: rowToUser(profile, data.user),
    profile: rowToProfile(profile, data.user),
  }
}

const profileToRecommendation = (row: MirrorProfileRow, myTraits: Record<string, number>, isSeed = false): ApiRecommendation => {
  const peerTraits = row.traits ?? defaultTraits
  const explanation = explainMatch(myTraits, peerTraits)
  const answers = (row.answers ?? {}) as Record<string, unknown>
  return {
    id: row.id,
    nickname: row.nickname,
    city: row.city,
    goal: row.goal,
    score: scoreMatch(myTraits, peerTraits),
    traits: peerTraits,
    anchors: row.anchors?.length ? row.anchors : ['深度探索者'],
    intro: row.intro || '希望遇见真实、安静、能慢慢靠近的关系。',
    is_seed: isSeed,
    public_profile: answers.public_profile as Record<string, unknown> | undefined,
    ...explanation,
  }
}

export const registerWithInvite = async (email: string, inviteCode: string, password: string) => {
  const normalizedEmail = normalizeEmail(email)
  const normalizedInvite = assertInviteCode(inviteCode)

  if (!hasSupabase()) {
    return request<{ token: string; user: ApiUser; profile: ApiProfile }>('/auth/invite-register', {
      method: 'POST',
      body: JSON.stringify({ email: normalizedEmail, invite_code: normalizedInvite, password }),
    })
  }

  const { data, error } = await client().auth.signUp({
    email: normalizedEmail,
    password,
    options: {
      data: {
        invite_code: normalizedInvite,
        app: 'mirror-isle-beta',
      },
    },
  })
  if (error || !data.user) throw error ?? new Error('missing_supabase_user')

  if (!data.session) {
    throw new Error('email_confirmation_still_enabled')
  }

  const profile = await ensureProfile(data.user)
  return {
    token: data.session.access_token,
    user: rowToUser(profile, data.user),
    profile: rowToProfile(profile, data.user),
  }
}

export const setAccountPassword = async (password: string) => {
  if (!hasSupabase()) return { ok: true }

  const { error } = await client().auth.updateUser({ password })
  if (error) throw error
  return { ok: true }
}

export const loginWithCode = async (payload: LoginPayload) =>
  request<{ token: string; user: ApiUser }>('/auth/login', {
    method: 'POST',
    body: JSON.stringify(payload),
  })

export const updateMe = async (token: string, payload: ProfileUpdatePayload) => {
  if (!hasSupabase()) {
    return request<{ user: ApiUser }>(
      '/me',
      {
        method: 'PATCH',
        body: JSON.stringify(payload),
      },
      token,
    )
  }

  void token
  const user = await getCurrentUser()
  let mergedAnswers: Record<string, unknown> | undefined
  if (payload.public_profile) {
    const existing = await client()
      .from('mirror_profiles')
      .select('answers')
      .eq('id', user.id)
      .single<{ answers: Record<string, unknown> | null }>()
    if (existing.error) throw existing.error
    mergedAnswers = { ...(existing.data.answers ?? {}), public_profile: payload.public_profile }
  }
  const { data, error } = await client()
    .from('mirror_profiles')
    .update({
      nickname: payload.nickname,
      city: payload.city,
      goal: payload.goal,
      privacy: payload.privacy,
      age_confirmed: payload.age_confirmed,
      ...(mergedAnswers ? { answers: mergedAnswers } : {}),
      ...(payload.intro ? { intro: payload.intro } : {}),
      updated_at: new Date().toISOString(),
    })
    .eq('id', user.id)
    .select('*')
    .single<MirrorProfileRow>()
  if (error) throw error
  return { user: rowToUser(data, user) }
}

export const saveAssessment = async (token: string, answers: Record<string, string>) => {
  if (!hasSupabase()) {
    return request<{ traits: Record<string, number>; confidence: number; anchors: string[] }>(
      '/assessment',
      {
        method: 'POST',
        body: JSON.stringify({ answers }),
      },
      token,
    )
  }

  void token
  const user = await getCurrentUser()
  const result = buildTraits(answers)
  const existing = await client()
    .from('mirror_profiles')
    .select('answers')
    .eq('id', user.id)
    .single<{ answers: Record<string, unknown> | null }>()
  if (existing.error) throw existing.error
  const intro = `${result.anchors.slice(0, 2).join(' · ')}，正在镜屿里练习更真实地表达自己。`
  const { error } = await client()
    .from('mirror_profiles')
    .update({
      traits: result.traits,
      answers: { ...(existing.data.answers ?? {}), ...answers },
      confidence: result.confidence,
      anchors: result.anchors,
      intro,
      updated_at: new Date().toISOString(),
    })
    .eq('id', user.id)
  if (error) throw error
  return result
}

export const submitIdentity = async (token: string, realName: string, idNumber: string) => {
  if (!hasSupabase()) {
    return request<{ identity_status: string; provider: string }>(
      '/identity/submit',
      {
        method: 'POST',
        body: JSON.stringify({ real_name: realName, id_number: idNumber, consent: true }),
      },
      token,
    )
  }

  void token
  void realName
  void idNumber
  const user = await getCurrentUser()
  const { error } = await client()
    .from('mirror_profiles')
    .update({ identity_status: 'pending_manual_review', updated_at: new Date().toISOString() })
    .eq('id', user.id)
  if (error) throw error
  return { identity_status: 'pending_manual_review', provider: 'manual_review' }
}

export const fetchRecommendations = async (token: string) => {
  if (!hasSupabase()) {
    return request<{ items: ApiRecommendation[]; score_version: string }>('/recommendations', {}, token)
  }

  void token
  const user = await getCurrentUser()
  const mineResult = await client().from('mirror_profiles').select('*').eq('id', user.id).single<MirrorProfileRow>()
  if (mineResult.error) throw mineResult.error
  const peerResult = await client()
    .from('mirror_profiles')
    .select('*')
    .eq('age_confirmed', true)
    .neq('id', user.id)
    .limit(30)
    .returns<MirrorProfileRow[]>()
  if (peerResult.error) throw peerResult.error

  const myTraits = mineResult.data.traits ?? defaultTraits
  const items = (peerResult.data ?? []).map<ApiRecommendation>((row) => profileToRecommendation(row, myTraits))
  return { items, score_version: 'supabase-v1' }
}

export const fetchTreePosts = async (token: string) => {
  if (!hasSupabase()) {
    return request<{ items: ApiTreePost[] }>('/treehole/posts', {}, token)
  }

  void token
  const user = await getCurrentUser()
  const { data, error } = await client()
    .from('mirror_tree_posts')
    .select('*')
    .order('created_at', { ascending: false })
    .limit(100)
    .returns<MirrorTreePostRow[]>()
  if (error) throw error
  return {
    items: (data ?? []).map<ApiTreePost>((row) => ({
      id: row.id,
      author: row.author,
      visibility: row.visibility,
      content: row.content,
      images: row.images ?? [],
      tags: row.tags ?? [],
      status: row.status,
      created_at: row.created_at,
      mine: row.user_id === user.id,
    })),
  }
}

export const createTreePost = async (token: string, content: string, visibility: string, tags: string[], images: string[] = []) => {
  if (!hasSupabase()) {
    return request<{ id: string; status: string; moderation: unknown }>(
      '/treehole/posts',
      {
        method: 'POST',
        body: JSON.stringify({ content, visibility, tags, images }),
      },
      token,
    )
  }

  void token
  const user = await getCurrentUser()
  const profile = await ensureProfile(user)
  const moderation = localModeration(content)
  const { data, error } = await client()
    .from('mirror_tree_posts')
    .insert({
      user_id: user.id,
      author: profile.nickname,
      visibility,
      content,
      images,
      tags,
      status: moderation.status,
      moderation,
    })
    .select('*')
    .single<MirrorTreePostRow>()
  if (error) throw error
  return { id: data.id, status: data.status, moderation: data.moderation }
}

export const startConversation = async (token: string, peerUserId: string) => {
  if (!hasSupabase()) {
    return request<{ conversation_id: string }>(
      '/conversations/start',
      {
        method: 'POST',
        body: JSON.stringify({ peer_user_id: peerUserId }),
      },
      token,
    )
  }

  void token
  const user = await getCurrentUser()
  const [userA, userB] = [user.id, peerUserId].sort()
  const existing = await client()
    .from('mirror_conversations')
    .select('id')
    .eq('user_a', userA)
    .eq('user_b', userB)
    .maybeSingle<{ id: string }>()
  if (existing.error) throw existing.error
  if (existing.data) return { conversation_id: existing.data.id }

  const inserted = await client()
    .from('mirror_conversations')
    .insert({ user_a: userA, user_b: userB, status: 'active' })
    .select('id')
    .single<{ id: string }>()
  if (inserted.error) throw inserted.error
  return { conversation_id: inserted.data.id }
}

export const fetchFriends = async (token: string) => {
  if (!hasSupabase()) {
    return request<{ items: ApiRecommendation[] }>('/friends', {}, token)
  }

  void token
  const user = await getCurrentUser()
  const mineResult = await client().from('mirror_profiles').select('*').eq('id', user.id).single<MirrorProfileRow>()
  if (mineResult.error) throw mineResult.error
  const friendsResult = await client()
    .from('mirror_friends')
    .select('*')
    .or(`requester_id.eq.${user.id},addressee_id.eq.${user.id}`)
    .eq('status', 'accepted')
    .order('updated_at', { ascending: false })
    .returns<MirrorFriendRow[]>()
  if (friendsResult.error) throw friendsResult.error

  const peerIds = [
    ...new Set(
      (friendsResult.data ?? []).map((row) => (row.requester_id === user.id ? row.addressee_id : row.requester_id)),
    ),
  ]
  if (!peerIds.length) return { items: [] }

  const profilesResult = await client().from('mirror_profiles').select('*').in('id', peerIds).returns<MirrorProfileRow[]>()
  if (profilesResult.error) throw profilesResult.error
  const myTraits = mineResult.data.traits ?? defaultTraits
  return { items: (profilesResult.data ?? []).map((row) => profileToRecommendation(row, myTraits)) }
}

export const searchFriendProfiles = async (token: string, query: string) => {
  if (!hasSupabase()) {
    return request<{ items: ApiRecommendation[] }>(`/friends/search?q=${encodeURIComponent(query)}`, {}, token)
  }

  void token
  const user = await getCurrentUser()
  const normalized = query.trim()
  if (!normalized) return { items: [] }
  const mineResult = await client().from('mirror_profiles').select('*').eq('id', user.id).single<MirrorProfileRow>()
  if (mineResult.error) throw mineResult.error

  const profileQuery = client().from('mirror_profiles').select('*').neq('id', user.id).eq('age_confirmed', true).limit(8)
  const result = isUuid(normalized)
    ? await profileQuery.eq('id', normalized).returns<MirrorProfileRow[]>()
    : await profileQuery.eq('email', normalizeEmail(normalized)).returns<MirrorProfileRow[]>()
  if (result.error) throw result.error

  const myTraits = mineResult.data.traits ?? defaultTraits
  return { items: (result.data ?? []).map((row) => profileToRecommendation(row, myTraits)) }
}

export const createFriendship = async (token: string, peerUserId: string) => {
  if (!hasSupabase()) {
    return request<ApiFriendResult>(
      '/friends',
      {
        method: 'POST',
        body: JSON.stringify({ peer_user_id: peerUserId }),
      },
      token,
    )
  }

  void token
  const user = await getCurrentUser()
  if (peerUserId === user.id) throw new Error('cannot_add_self')

  const mineResult = await client().from('mirror_profiles').select('*').eq('id', user.id).single<MirrorProfileRow>()
  if (mineResult.error) throw mineResult.error
  const peerResult = await client()
    .from('mirror_profiles')
    .select('*')
    .eq('id', peerUserId)
    .eq('age_confirmed', true)
    .single<MirrorProfileRow>()
  if (peerResult.error) throw peerResult.error

  const existingResult = await client()
    .from('mirror_friends')
    .select('*')
    .in('requester_id', [user.id, peerUserId])
    .in('addressee_id', [user.id, peerUserId])
    .maybeSingle<MirrorFriendRow>()
  if (existingResult.error) throw existingResult.error

  let friendship = existingResult.data
  if (!friendship) {
    const inserted = await client()
      .from('mirror_friends')
      .insert({ requester_id: user.id, addressee_id: peerUserId, status: 'accepted' })
      .select('*')
      .single<MirrorFriendRow>()
    if (inserted.error) throw inserted.error
    friendship = inserted.data
  }

  const conversation = await startConversation(token, peerUserId)
  return {
    friend: profileToRecommendation(peerResult.data, mineResult.data.traits ?? defaultTraits),
    conversation_id: conversation.conversation_id,
    friendship_id: friendship.id,
  }
}

export const fetchConversationMessages = async (token: string, conversationId: string) => {
  if (!hasSupabase()) {
    return request<{ items: ApiMessage[] }>(`/conversations/${conversationId}/messages`, {}, token)
  }

  void token
  const { data, error } = await client()
    .from('mirror_messages')
    .select('*')
    .eq('conversation_id', conversationId)
    .neq('status', 'rejected')
    .order('created_at', { ascending: true })
    .returns<MirrorMessageRow[]>()
  if (error) throw error
  return { items: (data ?? []) as ApiMessage[] }
}

export const sendConversationMessage = async (token: string, conversationId: string, content: string) => {
  if (!hasSupabase()) {
    return request<{ message: { id: string; status: string; content: string }; moderation: unknown }>(
      `/conversations/${conversationId}/messages`,
      {
        method: 'POST',
        body: JSON.stringify({ content }),
      },
      token,
    )
  }

  void token
  const user = await getCurrentUser()
  const moderation = localModeration(content)
  const { data, error } = await client()
    .from('mirror_messages')
    .insert({
      conversation_id: conversationId,
      sender_id: user.id,
      content,
      status: moderation.status,
      moderation,
    })
    .select('*')
    .single<MirrorMessageRow>()
  if (error) throw error
  return {
    message: { id: data.id, status: data.status, content: data.content },
    moderation: data.moderation,
  }
}

const clamp = (value: number, min: number, max: number) => Math.max(min, Math.min(max, value))

const dataUrlToImageBlob = (dataUrl: string) => {
  const match = dataUrl.match(/^data:(image\/[a-z0-9.+-]+);base64,(.+)$/i)
  if (!match) throw new Error('invalid_image_data')
  const contentType = match[1]
  const extension =
    contentType === 'image/jpeg'
      ? 'jpg'
      : contentType === 'image/png'
        ? 'png'
        : contentType === 'image/webp'
          ? 'webp'
          : contentType === 'image/gif'
            ? 'gif'
            : 'img'
  const binary = atob(match[2])
  const bytes = new Uint8Array(binary.length)
  for (let index = 0; index < binary.length; index += 1) {
    bytes[index] = binary.charCodeAt(index)
  }
  return { blob: new Blob([bytes], { type: contentType }), contentType, extension }
}

const randomObjectId = () => {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') return crypto.randomUUID()
  return Math.random().toString(36).slice(2, 12)
}

const isUuid = (value: string) =>
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value)

export const API_BASE_URL = hasSupabase() ? `${SUPABASE_URL}/rest/v1` : REST_API_BASE_URL
