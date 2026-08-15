import { createClient } from '@supabase/supabase-js'

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL || 'https://mvbjhesgjwcyzqavqoyv.supabase.co'
const SUPABASE_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY || 'sb_publishable_pg7-4rkL_qLLBV0iHBK2pw_qTFYV4E_'

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY, {
  auth: {
    autoRefreshToken: true,
    detectSessionInUrl: false,
    persistSession: true,
  },
})

export type MoodKeyV016 = 'sunny' | 'breeze' | 'cloudy' | 'rain' | 'wave'

export interface WalletV016 {
  points: number
  bottleCredits: number
}

export interface MoodV016 {
  date: string
  mood: MoodKeyV016
  note: string
  createdAt: string
}

export interface DriftBottleV016 {
  id: string
  content: string
  author: string
  anonymous: boolean
  createdAt: string
  tags: string[]
}

export interface DriftReplyV016 {
  id: string
  bottleId: string
  content: string
  author: string
  anonymous: boolean
  createdAt: string
}

export interface TreePostV016 {
  id: string
  author: string
  visibility: 'private' | 'friends' | 'public'
  content: string
  tags: string[]
  status: string
  createdAt: string
  mine: boolean
}

async function currentUser() {
  const { data, error } = await supabase.auth.getUser()
  if (error || !data.user) throw error ?? new Error('not_authenticated')
  return data.user
}

function todayLocal() {
  const d = new Date()
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${y}-${m}-${day}`
}

export async function fetchWalletV016(): Promise<WalletV016> {
  const user = await currentUser()
  const { data, error } = await supabase
    .from('mirror_wallets')
    .select('points,bottle_credits')
    .eq('user_id', user.id)
    .maybeSingle<{ points: number; bottle_credits: number }>()
  if (error) throw error
  return { points: data?.points ?? 0, bottleCredits: data?.bottle_credits ?? 0 }
}

export async function fetchMoodHistoryV016(limit = 45): Promise<MoodV016[]> {
  const user = await currentUser()
  const { data, error } = await supabase
    .from('mirror_mood_checkins')
    .select('checkin_date,mood,note,created_at')
    .eq('user_id', user.id)
    .order('checkin_date', { ascending: false })
    .limit(limit)
  if (error) throw error
  return (data ?? []).map((row: any) => ({
    date: row.checkin_date,
    mood: row.mood as MoodKeyV016,
    note: row.note ?? '',
    createdAt: row.created_at,
  }))
}

export async function recordMoodV016(mood: MoodKeyV016, note: string) {
  const { data, error } = await supabase.rpc('mirror_record_mood', {
    p_date: todayLocal(),
    p_mood: mood,
    p_note: note,
  })
  if (error) throw error
  const row = Array.isArray(data) ? data[0] : data
  return {
    wallet: { points: row?.points ?? 0, bottleCredits: row?.bottle_credits ?? 0 } as WalletV016,
    awarded: Boolean(row?.awarded),
  }
}

export async function redeemBottleCreditV016() {
  const { data, error } = await supabase.rpc('mirror_redeem_bottle_credit')
  if (error) throw error
  const row = Array.isArray(data) ? data[0] : data
  return { points: row?.points ?? 0, bottleCredits: row?.bottle_credits ?? 0 } as WalletV016
}

export async function pickRandomBottleV016(): Promise<{ bottle: DriftBottleV016 | null; wallet: WalletV016 }> {
  const { data, error } = await supabase.rpc('mirror_pick_drift_bottle')
  if (error) throw error
  const row = Array.isArray(data) ? data[0] : data
  if (!row?.id) return { bottle: null, wallet: await fetchWalletV016() }
  const tags = (row.tags ?? []) as string[]
  return {
    bottle: {
      id: row.id,
      content: row.content,
      author: tags.includes('匿名') ? '匿名岛民' : row.author,
      anonymous: tags.includes('匿名'),
      createdAt: row.created_at,
      tags,
    },
    wallet: { points: row.points ?? 0, bottleCredits: row.bottle_credits ?? 0 },
  }
}

export async function throwBottleV016(content: string, anonymous: boolean) {
  const tags = ['漂流瓶', 'v016', anonymous ? '匿名' : '署名']
  const { data, error } = await supabase
    .from('mirror_tree_posts')
    .insert({ content: content.trim(), visibility: 'public', tags })
    .select('id,status,created_at')
    .single()
  if (error) throw error
  return data
}

export async function fetchBottleRepliesV016(bottleId: string): Promise<DriftReplyV016[]> {
  const tag = `bottle:${bottleId}`
  const { data, error } = await supabase
    .from('mirror_tree_posts')
    .select('id,content,author,tags,created_at,status')
    .contains('tags', ['漂流回信', tag])
    .eq('status', 'approved')
    .order('created_at', { ascending: true })
    .limit(80)
  if (error) throw error
  return (data ?? []).map((row: any) => {
    const tags = (row.tags ?? []) as string[]
    return {
      id: row.id,
      bottleId,
      content: row.content,
      author: tags.includes('匿名') ? '匿名岛民' : row.author,
      anonymous: tags.includes('匿名'),
      createdAt: row.created_at,
    }
  })
}

export async function replyBottleV016(bottleId: string, content: string, anonymous: boolean) {
  const tags = ['漂流回信', 'v016', `bottle:${bottleId}`, anonymous ? '匿名' : '署名']
  const { data, error } = await supabase
    .from('mirror_tree_posts')
    .insert({ content: content.trim(), visibility: 'public', tags })
    .select('id,status,created_at')
    .single()
  if (error) throw error
  return data
}

export async function fetchDriftInboxV016() {
  const user = await currentUser()
  const own = await supabase
    .from('mirror_tree_posts')
    .select('id,content,created_at,status')
    .eq('user_id', user.id)
    .contains('tags', ['漂流瓶'])
    .order('created_at', { ascending: false })
    .limit(40)
  if (own.error) throw own.error
  const bottleIds = (own.data ?? []).map((row: any) => row.id as string)
  if (!bottleIds.length) return []

  const replies = await supabase
    .from('mirror_tree_posts')
    .select('id,content,author,tags,created_at,status')
    .contains('tags', ['漂流回信'])
    .eq('status', 'approved')
    .order('created_at', { ascending: false })
    .limit(160)
  if (replies.error) throw replies.error

  return (own.data ?? []).map((bottle: any) => ({
    id: bottle.id as string,
    content: bottle.content as string,
    createdAt: bottle.created_at as string,
    replies: (replies.data ?? [])
      .filter((row: any) => (row.tags ?? []).some((tag: string) => tag === `bottle:${bottle.id}`))
      .map((row: any) => {
        const tags = (row.tags ?? []) as string[]
        return {
          id: row.id,
          bottleId: bottle.id,
          content: row.content,
          author: tags.includes('匿名') ? '匿名岛民' : row.author,
          anonymous: tags.includes('匿名'),
          createdAt: row.created_at,
        } as DriftReplyV016
      }),
  }))
}

export async function fetchDriftSeenAtV016() {
  const user = await currentUser()
  const { data, error } = await supabase
    .from('mirror_user_sync_state')
    .select('drift_seen_at')
    .eq('user_id', user.id)
    .maybeSingle<{ drift_seen_at: string | null }>()
  if (error) throw error
  return data?.drift_seen_at ?? null
}

export async function markDriftSeenV016() {
  const user = await currentUser()
  const now = new Date().toISOString()
  const { error } = await supabase
    .from('mirror_user_sync_state')
    .upsert({ user_id: user.id, drift_seen_at: now, updated_at: now }, { onConflict: 'user_id' })
  if (error) throw error
  return now
}

export async function fetchTreeV016(): Promise<TreePostV016[]> {
  const user = await currentUser()
  const { data, error } = await supabase
    .from('mirror_tree_posts')
    .select('id,user_id,author,visibility,content,tags,status,created_at')
    .order('created_at', { ascending: false })
    .limit(120)
  if (error) throw error
  return (data ?? [])
    .filter((row: any) => !((row.tags ?? []) as string[]).some((tag) => tag === '漂流瓶' || tag === '漂流回信'))
    .map((row: any) => ({
      id: row.id,
      author: row.author,
      visibility: row.visibility,
      content: row.content,
      tags: row.tags ?? [],
      status: row.status,
      createdAt: row.created_at,
      mine: row.user_id === user.id,
    }))
}

export async function createTreeV016(content: string, visibility: 'private' | 'friends' | 'public') {
  const tags = [visibility === 'private' ? '私密树洞' : visibility === 'friends' ? '好友树洞' : '广场', 'v016']
  const { data, error } = await supabase
    .from('mirror_tree_posts')
    .insert({ content: content.trim(), visibility, tags })
    .select('id,status,created_at')
    .single()
  if (error) throw error
  return data
}

export async function fetchLatestWellbeingV016() {
  const user = await currentUser()
  const { data, error } = await supabase
    .from('mirror_wellbeing_checkins')
    .select('checkin_date,responses,raw_score,percentage,updated_at')
    .eq('user_id', user.id)
    .order('checkin_date', { ascending: false })
    .limit(1)
    .maybeSingle()
  if (error) throw error
  return data
}

export async function saveWellbeingV016(responses: number[]) {
  const { data, error } = await supabase.rpc('mirror_save_wellbeing', {
    p_date: todayLocal(),
    p_responses: responses,
  })
  if (error) throw error
  const row = Array.isArray(data) ? data[0] : data
  return { rawScore: row?.raw_score ?? 0, percentage: row?.percentage ?? 0 }
}

export async function saveAssessmentV016(scores: Record<string, number>, responses: Record<string, number>) {
  const { error } = await supabase.rpc('mirror_save_assessment', {
    p_scores: scores,
    p_responses: responses,
  })
  if (error) throw error
}

export async function isAuthenticatedV016() {
  try {
    await currentUser()
    return true
  } catch {
    return false
  }
}
