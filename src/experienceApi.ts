import { createClient } from '@supabase/supabase-js'

const DEFAULT_SUPABASE_URL = 'https://mvbjhesgjwcyzqavqoyv.supabase.co'
const DEFAULT_SUPABASE_ANON_KEY = 'sb_publishable_pg7-4rkL_qLLBV0iHBK2pw_qTFYV4E_'
const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL || DEFAULT_SUPABASE_URL
const SUPABASE_ANON_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY || DEFAULT_SUPABASE_ANON_KEY

const experienceClient = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
  auth: {
    autoRefreshToken: true,
    detectSessionInUrl: false,
    persistSession: true,
  },
})

export type ExperienceMoodKey = 'sunny' | 'breeze' | 'cloudy' | 'rain' | 'wave'

export interface ExperienceMoodEntry {
  date: string
  mood: ExperienceMoodKey
  note: string
  createdAt: string
}

export interface ExperienceWallet {
  points: number
  bottleCredits: number
}

export interface ExperienceState {
  wallet: ExperienceWallet
  moods: ExperienceMoodEntry[]
}

export interface DriftBottleRecord {
  id: string
  content: string
  author: string
  anonymous: boolean
  createdAt: string
  mine: boolean
}

export interface DriftReplyRecord {
  id: string
  content: string
  author: string
  anonymous: boolean
  createdAt: string
  mine: boolean
}

interface ExperienceProfileRow {
  answers: Record<string, unknown> | null
  updated_at: string
}

interface DriftPostRow {
  id: string
  user_id: string
  author: string
  content: string
  tags: string[] | null
  status: string
  created_at: string
}

const EXPERIENCE_KEY = 'mirror_experience_v2'
const DRIFT_BOTTLE_TAG = '漂流瓶'
const DRIFT_REPLY_TAG = '漂流回信'
const DRIFT_VERSION_TAG = 'v014'
const DEFAULT_STATE: ExperienceState = {
  wallet: { points: 0, bottleCredits: 0 },
  moods: [],
}

const asRecord = (value: unknown): Record<string, unknown> =>
  value && typeof value === 'object' && !Array.isArray(value) ? (value as Record<string, unknown>) : {}

const asNonNegativeInt = (value: unknown, fallback = 0) => {
  const number = Number(value)
  if (!Number.isFinite(number)) return fallback
  return Math.max(0, Math.floor(number))
}

const isMoodKey = (value: unknown): value is ExperienceMoodKey =>
  value === 'sunny' || value === 'breeze' || value === 'cloudy' || value === 'rain' || value === 'wave'

const normalizeMoodEntry = (value: unknown): ExperienceMoodEntry | null => {
  const row = asRecord(value)
  if (typeof row.date !== 'string' || !isMoodKey(row.mood)) return null
  return {
    date: row.date,
    mood: row.mood,
    note: typeof row.note === 'string' ? row.note.slice(0, 240) : '',
    createdAt: typeof row.createdAt === 'string' ? row.createdAt : new Date().toISOString(),
  }
}

const parseState = (answers: Record<string, unknown> | null | undefined): ExperienceState => {
  const source = asRecord(answers?.[EXPERIENCE_KEY])
  const wallet = asRecord(source.wallet)
  const moods = Array.isArray(source.moods)
    ? source.moods.map(normalizeMoodEntry).filter((item): item is ExperienceMoodEntry => Boolean(item)).slice(0, 365)
    : []

  return {
    wallet: {
      points: asNonNegativeInt(wallet.points),
      bottleCredits: asNonNegativeInt(wallet.bottleCredits),
    },
    moods,
  }
}

const serializeState = (state: ExperienceState) => ({
  wallet: {
    points: asNonNegativeInt(state.wallet.points),
    bottleCredits: asNonNegativeInt(state.wallet.bottleCredits),
  },
  moods: state.moods.slice(0, 365),
})

const getCurrentUser = async () => {
  const { data, error } = await experienceClient.auth.getUser()
  if (error || !data.user) throw error ?? new Error('missing_supabase_user')
  return data.user
}

export const fetchExperienceState = async (): Promise<ExperienceState> => {
  const user = await getCurrentUser()
  const { data, error } = await experienceClient
    .from('mirror_profiles')
    .select('answers,updated_at')
    .eq('id', user.id)
    .single<ExperienceProfileRow>()
  if (error) throw error
  return parseState(data.answers)
}

async function mutateExperience<T>(
  mutator: (state: ExperienceState) => { state: ExperienceState; result: T },
): Promise<{ state: ExperienceState; result: T }> {
  const user = await getCurrentUser()

  for (let attempt = 0; attempt < 4; attempt += 1) {
    const current = await experienceClient
      .from('mirror_profiles')
      .select('answers,updated_at')
      .eq('id', user.id)
      .single<ExperienceProfileRow>()
    if (current.error) throw current.error

    const answers = asRecord(current.data.answers)
    const { state: nextState, result } = mutator(parseState(answers))
    const updatedAt = new Date().toISOString()
    const updated = await experienceClient
      .from('mirror_profiles')
      .update({
        answers: {
          ...answers,
          [EXPERIENCE_KEY]: serializeState(nextState),
        },
        updated_at: updatedAt,
      })
      .eq('id', user.id)
      .eq('updated_at', current.data.updated_at)
      .select('answers,updated_at')
      .maybeSingle<ExperienceProfileRow>()

    if (updated.error) throw updated.error
    if (updated.data) return { state: parseState(updated.data.answers), result }
  }

  throw new Error('experience_update_conflict')
}

export const mergeLocalExperienceToAccount = async (
  localWallet: ExperienceWallet,
  localMoods: ExperienceMoodEntry[],
): Promise<ExperienceState> => {
  const merged = await mutateExperience((state) => {
    const byDate = new Map(state.moods.map((entry) => [entry.date, entry]))
    localMoods.forEach((entry) => {
      if (!byDate.has(entry.date)) byDate.set(entry.date, entry)
    })
    const moods = [...byDate.values()].sort((a, b) => b.date.localeCompare(a.date)).slice(0, 365)
    return {
      state: {
        wallet: {
          points: Math.max(state.wallet.points, asNonNegativeInt(localWallet.points)),
          bottleCredits: Math.max(state.wallet.bottleCredits, asNonNegativeInt(localWallet.bottleCredits)),
        },
        moods,
      },
      result: true,
    }
  })
  return merged.state
}

export const recordSyncedMood = async (
  date: string,
  mood: ExperienceMoodKey,
  note: string,
): Promise<{ state: ExperienceState; awardedPoints: number }> => {
  return mutateExperience((state) => {
    const now = new Date().toISOString()
    const existing = state.moods.find((entry) => entry.date === date)
    const moods = existing
      ? state.moods.map((entry) =>
          entry.date === date ? { ...entry, mood, note: note.trim().slice(0, 240), createdAt: now } : entry,
        )
      : [{ date, mood, note: note.trim().slice(0, 240), createdAt: now }, ...state.moods].slice(0, 365)
    const awardedPoints = existing ? 0 : 10
    return {
      state: {
        wallet: { ...state.wallet, points: state.wallet.points + awardedPoints },
        moods,
      },
      result: awardedPoints,
    }
  }).then(({ state, result }) => ({ state, awardedPoints: result }))
}

export const redeemSyncedBottleCredit = async (): Promise<ExperienceState> => {
  const result = await mutateExperience((state) => {
    if (state.wallet.points < 10) throw new Error('not_enough_points')
    return {
      state: {
        ...state,
        wallet: {
          points: state.wallet.points - 10,
          bottleCredits: state.wallet.bottleCredits + 1,
        },
      },
      result: true,
    }
  })
  return result.state
}

export const spendSyncedBottleCredit = async (): Promise<ExperienceState> => {
  const result = await mutateExperience((state) => {
    if (state.wallet.bottleCredits < 1) throw new Error('no_bottle_credit')
    return {
      state: {
        ...state,
        wallet: {
          ...state.wallet,
          bottleCredits: state.wallet.bottleCredits - 1,
        },
      },
      result: true,
    }
  })
  return result.state
}

export const throwDriftBottle = async (
  content: string,
  anonymous: boolean,
): Promise<{ id: string; status: string }> => {
  const user = await getCurrentUser()
  const { data, error } = await experienceClient
    .from('mirror_tree_posts')
    .insert({
      user_id: user.id,
      author: '镜屿用户',
      visibility: 'public',
      content: content.trim().slice(0, 1600),
      images: [],
      tags: [DRIFT_BOTTLE_TAG, DRIFT_VERSION_TAG, anonymous ? '匿名' : '署名'],
      status: 'approved',
      moderation: {},
    })
    .select('id,status')
    .single<{ id: string; status: string }>()
  if (error) throw error
  return data
}

export const fetchRandomDriftBottle = async (excludeIds: string[] = []): Promise<DriftBottleRecord | null> => {
  const user = await getCurrentUser()
  const { data, error } = await experienceClient
    .from('mirror_tree_posts')
    .select('id,user_id,author,content,tags,status,created_at')
    .eq('visibility', 'public')
    .eq('status', 'approved')
    .contains('tags', [DRIFT_BOTTLE_TAG])
    .order('created_at', { ascending: false })
    .limit(240)
    .returns<DriftPostRow[]>()
  if (error) throw error

  const excluded = new Set(excludeIds)
  const pool = (data ?? []).filter((row) => row.user_id !== user.id && !excluded.has(row.id))
  const fallbackPool = (data ?? []).filter((row) => row.user_id !== user.id)
  const candidates = pool.length ? pool : fallbackPool
  if (!candidates.length) return null
  const row = candidates[Math.floor(Math.random() * candidates.length)]
  const tags = row.tags ?? []
  return {
    id: row.id,
    content: row.content,
    author: row.author,
    anonymous: tags.includes('匿名'),
    createdAt: row.created_at,
    mine: row.user_id === user.id,
  }
}

export const fetchDriftBottleReplies = async (bottleId: string): Promise<DriftReplyRecord[]> => {
  const user = await getCurrentUser()
  const { data, error } = await experienceClient
    .from('mirror_tree_posts')
    .select('id,user_id,author,content,tags,status,created_at')
    .eq('visibility', 'public')
    .eq('status', 'approved')
    .contains('tags', [DRIFT_REPLY_TAG, `bottle:${bottleId}`])
    .order('created_at', { ascending: true })
    .limit(100)
    .returns<DriftPostRow[]>()
  if (error) throw error

  return (data ?? []).map((row) => ({
    id: row.id,
    content: row.content,
    author: row.author,
    anonymous: (row.tags ?? []).includes('匿名'),
    createdAt: row.created_at,
    mine: row.user_id === user.id,
  }))
}

export const sendDriftBottleReply = async (
  bottleId: string,
  content: string,
  anonymous: boolean,
): Promise<{ id: string; status: string }> => {
  const user = await getCurrentUser()
  const { data, error } = await experienceClient
    .from('mirror_tree_posts')
    .insert({
      user_id: user.id,
      author: '镜屿用户',
      visibility: 'public',
      content: content.trim().slice(0, 800),
      images: [],
      tags: [DRIFT_REPLY_TAG, DRIFT_VERSION_TAG, `bottle:${bottleId}`, anonymous ? '匿名' : '署名'],
      status: 'approved',
      moderation: {},
    })
    .select('id,status')
    .single<{ id: string; status: string }>()
  if (error) throw error
  return data
}

export const isDriftPost = (tags: string[] | undefined | null) =>
  Boolean(tags?.includes(DRIFT_BOTTLE_TAG) || tags?.includes(DRIFT_REPLY_TAG))

export const emptyExperienceState = (): ExperienceState => ({
  wallet: { ...DEFAULT_STATE.wallet },
  moods: [],
})
