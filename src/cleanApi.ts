import { createClient, type User } from '@supabase/supabase-js'

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL || 'https://mvbjhesgjwcyzqavqoyv.supabase.co'
const SUPABASE_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY || 'sb_publishable_pg7-4rkL_qLLBV0iHBK2pw_qTFYV4E_'

export const cleanSupabase = createClient(SUPABASE_URL, SUPABASE_KEY, {
  auth: { autoRefreshToken: true, detectSessionInUrl: false, persistSession: true },
})

export type Visibility = 'private' | 'friends' | 'public'
export type MoodKey = 'sunny' | 'breeze' | 'cloudy' | 'rain' | 'wave'
export type SixTraits = Record<'values' | 'lifestyle' | 'relationship' | 'communication' | 'growth' | 'boundary', number>

export interface CleanProfile {
  id: string
  nickname: string
  city: string
  goal: string
  privacy: string
  age_confirmed: boolean
  identity_status: string
  traits: SixTraits
  anchors: string[]
  intro: string
  confidence: number
  answers?: Record<string, unknown>
}

export interface Recommendation extends CleanProfile {
  score: number
  similar: string[]
  different: string[]
}

export interface TreePost {
  id: string
  author: string
  visibility: Visibility
  content: string
  tags: string[]
  images: string[]
  status: string
  createdAt: string
  mine: boolean
}

export interface MoodRow { date: string; mood: MoodKey; note: string; createdAt: string }
export interface Wallet { points: number; bottleCredits: number }
export interface DriftBottle { id: string; content: string; author: string; anonymous: boolean; createdAt: string; tags: string[] }
export interface DriftReply { id: string; bottleId: string; content: string; author: string; anonymous: boolean; createdAt: string }
export interface ChatMessage { id: string; conversationId: string; senderId: string; content: string; status: string; createdAt: string }

const DEFAULT_TRAITS: SixTraits = { values: 50, lifestyle: 50, relationship: 50, communication: 50, growth: 50, boundary: 50 }
const SAMPLE_NAMES = new Set(['山脉与海', '时与风', '晚星'])
const dimensionLabels: Record<keyof SixTraits, string> = {
  values: '价值观', lifestyle: '生活节律', relationship: '关系需求', communication: '沟通方式', growth: '成长方向', boundary: '边界感',
}
const weights: Record<keyof SixTraits, number> = { values: .25, lifestyle: .2, relationship: .2, communication: .1, growth: .1, boundary: .15 }

function profileFromRow(row: any): CleanProfile {
  return {
    id: row.id,
    nickname: row.nickname || '镜屿用户',
    city: row.city || '未设置',
    goal: row.goal || '深度朋友',
    privacy: row.privacy || 'friends',
    age_confirmed: Boolean(row.age_confirmed),
    identity_status: row.identity_status || 'unsubmitted',
    traits: { ...DEFAULT_TRAITS, ...(row.traits || {}) },
    anchors: Array.isArray(row.anchors) && row.anchors.length ? row.anchors : ['深度探索者'],
    intro: row.intro || '希望遇见真实、安静、能慢慢靠近的关系。',
    confidence: Number(row.confidence ?? 48),
    answers: row.answers || {},
  }
}

async function ensureProfile(user: User) {
  const existing = await cleanSupabase.from('mirror_profiles').select('*').eq('id', user.id).maybeSingle()
  if (existing.error) throw existing.error
  if (existing.data) return profileFromRow(existing.data)
  const nickname = (user.email?.split('@')[0] || '镜屿用户').slice(0, 18)
  const inserted = await cleanSupabase.from('mirror_profiles').insert({
    id: user.id,
    nickname,
    city: '未设置',
    goal: '深度朋友',
    privacy: 'friends',
    age_confirmed: false,
    identity_status: 'unsubmitted',
    traits: DEFAULT_TRAITS,
    answers: {},
    confidence: 48,
    anchors: ['深度探索者'],
    intro: '刚来到镜屿，正在完成自己的初见心谱。',
    last_login_at: new Date().toISOString(),
  }).select('*').single()
  if (inserted.error) throw inserted.error
  return profileFromRow(inserted.data)
}

export async function restoreAccount() {
  const session = await cleanSupabase.auth.getSession()
  if (session.error || !session.data.session?.user) return null
  return { user: session.data.session.user, profile: await ensureProfile(session.data.session.user) }
}

export async function loginAccount(email: string, password: string) {
  const { data, error } = await cleanSupabase.auth.signInWithPassword({ email: email.trim().toLowerCase(), password })
  if (error || !data.user) throw error ?? new Error('登录失败')
  return { user: data.user, profile: await ensureProfile(data.user) }
}

export async function registerAccount(email: string, password: string, inviteCode: string) {
  const response = await fetch(`${SUPABASE_URL}/functions/v1/invite-register`, {
    method: 'POST',
    headers: { apikey: SUPABASE_KEY, 'Content-Type': 'application/json', 'X-Client-Info': 'mirror-isle-clean-v1' },
    body: JSON.stringify({ email: email.trim().toLowerCase(), password, invite_code: inviteCode.trim().toUpperCase() }),
  })
  const payload = await response.json().catch(() => ({})) as { error?: string }
  if (!response.ok) {
    const map: Record<string, string> = {
      invalid_invite_code: '邀请码无效', invite_expired: '邀请码已过期', invite_exhausted: '邀请码使用次数已满',
      invalid_or_exhausted_invite: '邀请码无效或已用完', email_already_registered: '邮箱已注册，请直接登录', weak_password: '密码至少需要 8 位',
    }
    throw new Error(map[payload.error || ''] || '注册暂时没有完成')
  }
  return loginAccount(email, password)
}

export async function logoutAccount() {
  await cleanSupabase.auth.signOut()
}

export async function updateProfile(profile: Partial<Pick<CleanProfile, 'nickname' | 'city' | 'goal' | 'privacy' | 'age_confirmed' | 'intro'>>) {
  const user = (await cleanSupabase.auth.getUser()).data.user
  if (!user) throw new Error('未登录')
  const { data, error } = await cleanSupabase.from('mirror_profiles').update({ ...profile, updated_at: new Date().toISOString() }).eq('id', user.id).select('*').single()
  if (error) throw error
  return profileFromRow(data)
}

export async function saveAssessment(bigFive: Record<string, number>, responses: Record<string, number>, traits: SixTraits) {
  const user = (await cleanSupabase.auth.getUser()).data.user
  if (!user) throw new Error('未登录')
  const saved = await cleanSupabase.rpc('mirror_save_assessment', { p_scores: bigFive, p_responses: responses })
  if (saved.error) throw saved.error
  const anchors = [
    traits.relationship >= 62 ? '深聊型人格' : '独处友好者',
    traits.growth >= 62 ? '成长追寻者' : '稳定生活者',
    traits.boundary >= 62 ? '边界清晰者' : '高连接需求者',
  ]
  const { error } = await cleanSupabase.from('mirror_profiles').update({
    traits, anchors, confidence: 82, intro: `${anchors.slice(0, 2).join(' · ')}，希望在镜屿遇见能认真理解彼此的人。`, updated_at: new Date().toISOString(),
  }).eq('id', user.id)
  if (error) throw error
}

function matchScore(mine: SixTraits, peer: SixTraits) {
  return Math.round((Object.keys(weights) as Array<keyof SixTraits>).reduce((sum, key) => sum + (100 - Math.abs((mine[key] ?? 50) - (peer[key] ?? 50))) * weights[key], 0))
}

function explain(mine: SixTraits, peer: SixTraits) {
  const keys = Object.keys(weights) as Array<keyof SixTraits>
  const ordered = [...keys].sort((a, b) => Math.abs(mine[a] - peer[a]) - Math.abs(mine[b] - peer[b]))
  return {
    similar: ordered.slice(0, 2).map((k) => `${dimensionLabels[k]}很接近`),
    different: ordered.slice(-2).reverse().map((k) => `${dimensionLabels[k]}存在差异`),
  }
}

export async function fetchRecommendations() {
  const user = (await cleanSupabase.auth.getUser()).data.user
  if (!user) throw new Error('未登录')
  const mine = await cleanSupabase.from('mirror_profiles').select('*').eq('id', user.id).single()
  if (mine.error) throw mine.error
  const peers = await cleanSupabase.from('mirror_profiles').select('*').eq('age_confirmed', true).neq('id', user.id).limit(40)
  if (peers.error) throw peers.error
  const me = profileFromRow(mine.data)
  return (peers.data || [])
    .map(profileFromRow)
    .filter((p) => !SAMPLE_NAMES.has(p.nickname))
    .map((p) => ({ ...p, score: matchScore(me.traits, p.traits), ...explain(me.traits, p.traits) }))
    .sort((a, b) => b.score - a.score)
    .slice(0, 12) as Recommendation[]
}

export async function fetchFriends() {
  const user = (await cleanSupabase.auth.getUser()).data.user
  if (!user) throw new Error('未登录')
  const rows = await cleanSupabase.from('mirror_friends').select('*').or(`requester_id.eq.${user.id},addressee_id.eq.${user.id}`).eq('status', 'accepted').order('updated_at', { ascending: false })
  if (rows.error) throw rows.error
  const ids = [...new Set((rows.data || []).map((r: any) => r.requester_id === user.id ? r.addressee_id : r.requester_id))]
  if (!ids.length) return [] as Recommendation[]
  const mine = await cleanSupabase.from('mirror_profiles').select('*').eq('id', user.id).single()
  const profiles = await cleanSupabase.from('mirror_profiles').select('*').in('id', ids)
  if (mine.error) throw mine.error
  if (profiles.error) throw profiles.error
  const me = profileFromRow(mine.data)
  return (profiles.data || []).map(profileFromRow).map((p) => ({ ...p, score: matchScore(me.traits, p.traits), ...explain(me.traits, p.traits) })) as Recommendation[]
}

export async function addFriend(peerId: string) {
  const user = (await cleanSupabase.auth.getUser()).data.user
  if (!user) throw new Error('未登录')
  if (user.id === peerId) throw new Error('不能添加自己')
  const first = await cleanSupabase.from('mirror_friends').select('*').eq('requester_id', user.id).eq('addressee_id', peerId).maybeSingle()
  if (first.error) throw first.error
  let row = first.data
  if (!row) {
    const reverse = await cleanSupabase.from('mirror_friends').select('*').eq('requester_id', peerId).eq('addressee_id', user.id).maybeSingle()
    if (reverse.error) throw reverse.error
    row = reverse.data
  }
  if (!row) {
    const inserted = await cleanSupabase.from('mirror_friends').insert({ requester_id: user.id, addressee_id: peerId, status: 'accepted' }).select('*').single()
    if (inserted.error) throw inserted.error
    row = inserted.data
  }
  return { friendshipId: row.id, conversationId: await startConversation(peerId) }
}

export async function startConversation(peerId: string) {
  const user = (await cleanSupabase.auth.getUser()).data.user
  if (!user) throw new Error('未登录')
  const [a, b] = [user.id, peerId].sort()
  const existing = await cleanSupabase.from('mirror_conversations').select('id').eq('user_a', a).eq('user_b', b).maybeSingle()
  if (existing.error) throw existing.error
  if (existing.data?.id) return existing.data.id as string
  const created = await cleanSupabase.from('mirror_conversations').insert({ user_a: a, user_b: b, status: 'active' }).select('id').single()
  if (created.error) throw created.error
  return created.data.id as string
}

export async function fetchMessages(conversationId: string) {
  const { data, error } = await cleanSupabase.from('mirror_messages').select('*').eq('conversation_id', conversationId).neq('status', 'rejected').order('created_at', { ascending: true })
  if (error) throw error
  return (data || []).map((m: any) => ({ id: m.id, conversationId: m.conversation_id, senderId: m.sender_id, content: m.content, status: m.status, createdAt: m.created_at })) as ChatMessage[]
}

export async function sendMessage(conversationId: string, content: string) {
  const user = (await cleanSupabase.auth.getUser()).data.user
  if (!user) throw new Error('未登录')
  const { error } = await cleanSupabase.from('mirror_messages').insert({ conversation_id: conversationId, sender_id: user.id, content: content.trim(), status: 'approved', moderation: { provider: 'client-basic' } })
  if (error) throw error
}

export async function fetchTreePosts() {
  const user = (await cleanSupabase.auth.getUser()).data.user
  if (!user) throw new Error('未登录')
  const { data, error } = await cleanSupabase.from('mirror_tree_posts').select('id,user_id,author,visibility,content,tags,images,status,created_at').order('created_at', { ascending: false }).limit(140)
  if (error) throw error
  return (data || []).filter((r: any) => !(r.tags || []).some((t: string) => t === '漂流瓶' || t === '漂流回信')).map((r: any) => ({
    id: r.id, author: r.author, visibility: r.visibility, content: r.content, tags: r.tags || [], images: r.images || [], status: r.status, createdAt: r.created_at, mine: r.user_id === user.id,
  })) as TreePost[]
}

export async function createTreePost(content: string, visibility: Visibility) {
  const user = (await cleanSupabase.auth.getUser()).data.user
  if (!user) throw new Error('未登录')
  const profile = await ensureProfile(user)
  const tags = [visibility === 'private' ? '私密树洞' : visibility === 'friends' ? '好友树洞' : '广场', 'clean-v1']
  const status = visibility === 'public' ? 'approved' : 'approved'
  const { error } = await cleanSupabase.from('mirror_tree_posts').insert({ user_id: user.id, author: profile.nickname, visibility, content: content.trim(), tags, status, moderation: { provider: 'clean-v1' } })
  if (error) throw error
}

export async function fetchMoodHistory(limit = 400) {
  const user = (await cleanSupabase.auth.getUser()).data.user
  if (!user) throw new Error('未登录')
  const { data, error } = await cleanSupabase.from('mirror_mood_checkins').select('checkin_date,mood,note,created_at').eq('user_id', user.id).order('checkin_date', { ascending: false }).limit(limit)
  if (error) throw error
  return (data || []).map((r: any) => ({ date: r.checkin_date, mood: r.mood, note: r.note || '', createdAt: r.created_at })) as MoodRow[]
}

export async function fetchWallet() {
  const user = (await cleanSupabase.auth.getUser()).data.user
  if (!user) throw new Error('未登录')
  const { data, error } = await cleanSupabase.from('mirror_wallets').select('points,bottle_credits').eq('user_id', user.id).maybeSingle()
  if (error) throw error
  return { points: data?.points ?? 0, bottleCredits: data?.bottle_credits ?? 0 } as Wallet
}

function localDate() {
  const d = new Date(); return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`
}

export async function recordMood(mood: MoodKey, note: string) {
  const { data, error } = await cleanSupabase.rpc('mirror_record_mood', { p_date: localDate(), p_mood: mood, p_note: note })
  if (error) throw error
  const row = Array.isArray(data) ? data[0] : data
  return { points: row?.points ?? 0, bottleCredits: row?.bottle_credits ?? 0, awarded: Boolean(row?.awarded) }
}

export async function fetchLatestWellbeing() {
  const user = (await cleanSupabase.auth.getUser()).data.user
  if (!user) throw new Error('未登录')
  const { data, error } = await cleanSupabase.from('mirror_wellbeing_checkins').select('*').eq('user_id', user.id).order('checkin_date', { ascending: false }).limit(1).maybeSingle()
  if (error) throw error
  return data
}

export async function saveWellbeing(responses: number[]) {
  const { data, error } = await cleanSupabase.rpc('mirror_save_wellbeing', { p_date: localDate(), p_responses: responses })
  if (error) throw error
  const row = Array.isArray(data) ? data[0] : data
  return { rawScore: row?.raw_score ?? 0, percentage: row?.percentage ?? 0 }
}

export async function redeemBottleCredit() {
  const { data, error } = await cleanSupabase.rpc('mirror_redeem_bottle_credit')
  if (error) throw error
  const row = Array.isArray(data) ? data[0] : data
  return { points: row?.points ?? 0, bottleCredits: row?.bottle_credits ?? 0 } as Wallet
}

export async function pickBottle() {
  const { data, error } = await cleanSupabase.rpc('mirror_pick_drift_bottle')
  if (error) throw error
  const row = Array.isArray(data) ? data[0] : data
  if (!row?.id) return { bottle: null as DriftBottle | null, wallet: await fetchWallet() }
  const tags = (row.tags || []) as string[]
  return {
    bottle: { id: row.id, content: row.content, author: tags.includes('匿名') ? '匿名岛民' : row.author, anonymous: tags.includes('匿名'), createdAt: row.created_at, tags } as DriftBottle,
    wallet: { points: row.points ?? 0, bottleCredits: row.bottle_credits ?? 0 } as Wallet,
  }
}

export async function throwBottle(content: string, anonymous = true) {
  const user = (await cleanSupabase.auth.getUser()).data.user
  if (!user) throw new Error('未登录')
  const profile = await ensureProfile(user)
  const tags = ['漂流瓶', 'clean-v1', anonymous ? '匿名' : '署名']
  const { data, error } = await cleanSupabase.from('mirror_tree_posts').insert({ user_id: user.id, author: profile.nickname, content: content.trim(), visibility: 'public', tags, status: 'approved', moderation: { provider: 'clean-v1' } }).select('id,status,created_at').single()
  if (error) throw error
  return data
}

export async function fetchBottleReplies(bottleId: string) {
  const tag = `bottle:${bottleId}`
  const { data, error } = await cleanSupabase.from('mirror_tree_posts').select('id,content,author,tags,created_at,status').contains('tags', ['漂流回信', tag]).eq('status', 'approved').order('created_at', { ascending: true }).limit(80)
  if (error) throw error
  return (data || []).map((r: any) => {
    const tags = r.tags || []; return { id: r.id, bottleId, content: r.content, author: tags.includes('匿名') ? '匿名岛民' : r.author, anonymous: tags.includes('匿名'), createdAt: r.created_at }
  }) as DriftReply[]
}

export async function replyBottle(bottleId: string, content: string, anonymous = true) {
  const user = (await cleanSupabase.auth.getUser()).data.user
  if (!user) throw new Error('未登录')
  const profile = await ensureProfile(user)
  const tags = ['漂流回信', 'clean-v1', `bottle:${bottleId}`, anonymous ? '匿名' : '署名']
  const { error } = await cleanSupabase.from('mirror_tree_posts').insert({ user_id: user.id, author: profile.nickname, content: content.trim(), visibility: 'public', tags, status: 'approved', moderation: { provider: 'clean-v1' } })
  if (error) throw error
}

export async function fetchDriftInbox() {
  const user = (await cleanSupabase.auth.getUser()).data.user
  if (!user) throw new Error('未登录')
  const own = await cleanSupabase.from('mirror_tree_posts').select('id,content,created_at,status').eq('user_id', user.id).contains('tags', ['漂流瓶']).order('created_at', { ascending: false }).limit(40)
  if (own.error) throw own.error
  if (!own.data?.length) return [] as Array<{ id: string; content: string; createdAt: string; replies: DriftReply[] }>
  const replies = await cleanSupabase.from('mirror_tree_posts').select('id,content,author,tags,created_at,status').contains('tags', ['漂流回信']).eq('status', 'approved').order('created_at', { ascending: false }).limit(200)
  if (replies.error) throw replies.error
  return own.data.map((b: any) => ({
    id: b.id, content: b.content, createdAt: b.created_at,
    replies: (replies.data || []).filter((r: any) => (r.tags || []).includes(`bottle:${b.id}`)).map((r: any) => ({ id: r.id, bottleId: b.id, content: r.content, author: (r.tags || []).includes('匿名') ? '匿名岛民' : r.author, anonymous: (r.tags || []).includes('匿名'), createdAt: r.created_at })) as DriftReply[],
  }))
}
