import type { RealtimeChannel, User } from '@supabase/supabase-js'
import {
  addFriend,
  cleanSupabase,
  fetchBottleReplies,
  fetchDriftInbox,
  fetchMessages,
  fetchMoodHistory,
  fetchWallet,
  pickBottle,
  recordMood,
  redeemBottleCredit,
  replyBottle,
  sendMessage,
  startConversation,
  throwBottle,
  type ChatMessage,
  type DriftBottle,
  type DriftReply,
  type MoodKey,
  type MoodRow,
  type Wallet,
} from './cleanApi'

export { cleanSupabase, fetchBottleReplies, fetchDriftInbox, fetchMessages, fetchMoodHistory, fetchWallet, pickBottle, recordMood, redeemBottleCredit, replyBottle, sendMessage, startConversation, throwBottle }
export type { ChatMessage, DriftBottle, DriftReply, MoodKey, MoodRow, Wallet }

const WEB_URL = 'https://drsun111.github.io/mirror-isle-pwa/'

export type ThemeKey = 'green_morning' | 'sea_mist' | 'sunset_orange'
export type MbtiState = { e: number; s: number; t: number; j: number }
export type RoutineState = { chronotype?: string; sleep?: string; wake?: string; nap?: string; weekend?: string }
export type MatchProfile = {
  mbti: MbtiState
  routine: RoutineState
  diet: string[]
  hobbies: string[]
  preferences: Record<string, unknown>
}

export type MirrorV2Profile = {
  id: string
  nickname: string
  city: string
  goal: string
  avatar_url: string
  intro: string
  anchors: string[]
  age_confirmed: boolean
  profile_complete: boolean
  profession: string
  birth_date: string
  age: number | null
  theme: ThemeKey
  traits: Record<string, number>
}

export type RecommendationV2 = MirrorV2Profile & {
  score: number
  psych_score: number
  mbti_score: number
  lifestyle_score: number
  interest_score: number
}

export type FeedComment = {
  id: string
  postId: string
  userId: string
  author: string
  avatarUrl: string
  content: string
  createdAt: string
}

export type FeedPost = {
  id: string
  userId: string
  author: string
  avatarUrl: string
  city: string
  channel: 'world' | 'growth'
  kind: 'text' | 'image' | 'video' | 'review'
  visibility: 'public' | 'friends'
  title: string
  content: string
  mediaUrls: string[]
  coverUrl: string
  reviewCategory: 'book' | 'movie' | 'music' | ''
  workTitle: string
  rating: number | null
  createdAt: string
  liked: boolean
  likeCount: number
  comments: FeedComment[]
  commentCount: number
}

export type PrivateNote = {
  id: string
  content: string
  imageUrls: string[]
  createdAt: string
}

export type ConversationItem = {
  id: string
  peer: MirrorV2Profile
  lastMessage: string
  lastMessageAt: string
  unread: number
}

export type AppNotification = {
  id: string
  type: 'comment' | 'like' | 'message' | 'friend'
  actor: string
  actorAvatar: string
  text: string
  createdAt: string
  read: boolean
  postId?: string
  conversationId?: string
}

function normalizeProfile(row: any): MirrorV2Profile {
  return {
    id: row.id,
    nickname: row.nickname || '镜屿用户',
    city: row.city || '未设置',
    goal: row.goal || '深度朋友',
    avatar_url: row.avatar_url || '',
    intro: row.intro || '',
    anchors: Array.isArray(row.anchors) ? row.anchors : [],
    age_confirmed: Boolean(row.age_confirmed),
    profile_complete: Boolean(row.profile_complete),
    profession: row.profession || '',
    birth_date: row.birth_date || '',
    age: row.age == null ? null : Number(row.age),
    theme: (row.theme || 'green_morning') as ThemeKey,
    traits: row.traits || {},
  }
}

async function currentUser() {
  const { data, error } = await cleanSupabase.auth.getUser()
  if (error || !data.user) throw error ?? new Error('请先登录')
  return data.user
}

export async function ensureV2Profile(user: User) {
  const existing = await cleanSupabase.from('mirror_profiles').select('*').eq('id', user.id).maybeSingle()
  if (existing.error) throw existing.error
  if (existing.data) {
    await cleanSupabase.from('mirror_match_profiles').upsert({ user_id: user.id }, { onConflict: 'user_id', ignoreDuplicates: true })
    return normalizeProfile(existing.data)
  }
  const nickname = (user.email?.split('@')[0] || '镜屿用户').slice(0, 18)
  const inserted = await cleanSupabase.from('mirror_profiles').insert({
    id: user.id,
    nickname,
    city: '未设置',
    goal: '深度朋友',
    privacy: 'friends',
    age_confirmed: false,
    identity_status: 'unsubmitted',
    traits: { values: 50, lifestyle: 50, relationship: 50, communication: 50, growth: 50, boundary: 50 },
    answers: {},
    confidence: 48,
    anchors: ['深度探索者'],
    intro: '刚来到镜屿。',
    profile_complete: false,
    theme: 'green_morning',
    last_login_at: new Date().toISOString(),
  }).select('*').single()
  if (inserted.error) throw inserted.error
  await cleanSupabase.from('mirror_match_profiles').upsert({ user_id: user.id }, { onConflict: 'user_id' })
  return normalizeProfile(inserted.data)
}

export async function restoreV2Account() {
  const { data, error } = await cleanSupabase.auth.getSession()
  if (error || !data.session?.user) return null
  return { user: data.session.user, profile: await ensureV2Profile(data.session.user) }
}

export async function loginEmail(email: string, password: string) {
  const { data, error } = await cleanSupabase.auth.signInWithPassword({ email: email.trim().toLowerCase(), password })
  if (error || !data.user) throw error ?? new Error('登录失败')
  return { user: data.user, profile: await ensureV2Profile(data.user) }
}

export async function registerEmail(email: string, password: string, inviteCode: string) {
  const normalized = email.trim().toLowerCase()
  const code = inviteCode.trim().toUpperCase()
  const { data, error } = await cleanSupabase.functions.invoke('invite-register', {
    body: { email: normalized, password, invite_code: code },
  })
  if (error) {
    let codeFromResponse = ''
    try {
      const response = (error as any)?.context as Response | undefined
      if (response) codeFromResponse = String((await response.clone().json())?.error || '')
    } catch { /* response body unavailable */ }
    throw new Error(codeFromResponse || error.message || 'registration_failed')
  }
  if (!data?.ok) throw new Error(String(data?.error || 'registration_failed'))

  const signedIn = await cleanSupabase.auth.signInWithPassword({ email: normalized, password })
  if (signedIn.error || !signedIn.data.user) throw signedIn.error ?? new Error('registration_login_failed')
  return { profile: await ensureV2Profile(signedIn.data.user) }
}

export async function sendPasswordReset(email: string) {
  const { error } = await cleanSupabase.auth.resetPasswordForEmail(email.trim().toLowerCase(), { redirectTo: WEB_URL })
  if (error) throw error
}

export async function logoutV2() {
  await cleanSupabase.auth.signOut()
}

export async function updateV2Profile(patch: Partial<Pick<MirrorV2Profile, 'nickname' | 'city' | 'goal' | 'avatar_url' | 'intro' | 'age_confirmed' | 'profession' | 'birth_date' | 'theme' | 'profile_complete'>>) {
  const user = await currentUser()
  const { data, error } = await cleanSupabase.from('mirror_profiles').update({ ...patch, updated_at: new Date().toISOString() }).eq('id', user.id).select('*').single()
  if (error) throw error
  return normalizeProfile(data)
}

function extFromFile(file: File) {
  const fromName = file.name.split('.').pop()?.toLowerCase().replace(/[^a-z0-9]/g, '')
  if (fromName) return fromName
  if (file.type.includes('png')) return 'png'
  if (file.type.includes('webp')) return 'webp'
  if (file.type.includes('gif')) return 'gif'
  if (file.type.includes('mp4')) return 'mp4'
  if (file.type.includes('webm')) return 'webm'
  return 'jpg'
}

export async function uploadPublicMedia(file: File, folder: 'avatar' | 'world' | 'growth') {
  const user = await currentUser()
  const path = `${user.id}/${folder}/${Date.now()}-${crypto.randomUUID()}.${extFromFile(file)}`
  const { error } = await cleanSupabase.storage.from('mirror-media').upload(path, file, { upsert: false, contentType: file.type || undefined, cacheControl: '31536000' })
  if (error) throw error
  return cleanSupabase.storage.from('mirror-media').getPublicUrl(path).data.publicUrl
}

export async function uploadPrivateImage(file: File) {
  const user = await currentUser()
  const path = `${user.id}/tree/${Date.now()}-${crypto.randomUUID()}.${extFromFile(file)}`
  const { error } = await cleanSupabase.storage.from('mirror-private-media').upload(path, file, { upsert: false, contentType: file.type || undefined })
  if (error) throw error
  return path
}

async function privateUrl(path: string) {
  const { data, error } = await cleanSupabase.storage.from('mirror-private-media').createSignedUrl(path, 60 * 60)
  if (error) throw error
  return data.signedUrl
}

export async function fetchMatchProfile(): Promise<MatchProfile> {
  const user = await currentUser()
  const { data, error } = await cleanSupabase.from('mirror_match_profiles').select('*').eq('user_id', user.id).maybeSingle()
  if (error) throw error
  return {
    mbti: { e: Number(data?.mbti?.e ?? 50), s: Number(data?.mbti?.s ?? 50), t: Number(data?.mbti?.t ?? 50), j: Number(data?.mbti?.j ?? 50) },
    routine: data?.routine || {},
    diet: Array.isArray(data?.diet) ? data.diet : [],
    hobbies: Array.isArray(data?.hobbies) ? data.hobbies : [],
    preferences: data?.preferences || {},
  }
}

export async function saveMatchProfile(profile: MatchProfile) {
  const { error } = await cleanSupabase.rpc('mirror_upsert_match_profile', {
    p_mbti: profile.mbti,
    p_routine: profile.routine,
    p_diet: profile.diet,
    p_hobbies: profile.hobbies,
    p_preferences: profile.preferences,
  })
  if (error) throw error
}

export async function fetchRecommendationsV2(limit = 12) {
  const { data, error } = await cleanSupabase.rpc('mirror_match_recommendations', { p_limit: limit })
  if (error) throw error
  return (data || []).map((row: any) => ({
    id: row.id,
    nickname: row.nickname || '镜屿用户',
    city: row.city || '未设置',
    goal: row.goal || '深度朋友',
    avatar_url: row.avatar_url || '',
    intro: row.intro || '',
    anchors: row.anchors || [],
    age_confirmed: true,
    profile_complete: true,
    profession: row.profession || '',
    birth_date: '',
    age: row.age == null ? null : Number(row.age),
    theme: 'green_morning' as ThemeKey,
    traits: {},
    score: Number(row.score || 0),
    psych_score: Number(row.psych_score || 0),
    mbti_score: Number(row.mbti_score || 0),
    lifestyle_score: Number(row.lifestyle_score || 0),
    interest_score: Number(row.interest_score || 0),
  })) as RecommendationV2[]
}

export async function connectWithUser(peerId: string) {
  return addFriend(peerId)
}

async function profileMap(ids: string[]) {
  if (!ids.length) return new Map<string, MirrorV2Profile>()
  const { data, error } = await cleanSupabase.from('mirror_profiles').select('*').in('id', [...new Set(ids)])
  if (error) throw error
  return new Map((data || []).map((row: any) => [row.id, normalizeProfile(row)]))
}

export async function fetchFeed(channel: 'world' | 'growth', limit = 30): Promise<FeedPost[]> {
  const user = await currentUser()
  const { data: posts, error } = await cleanSupabase.from('mirror_posts').select('*').eq('channel', channel).eq('status', 'approved').order('created_at', { ascending: false }).limit(limit)
  if (error) throw error
  const rows = posts || []
  if (!rows.length) return []
  const ids = rows.map((r: any) => r.id)
  const users = await profileMap(rows.map((r: any) => r.user_id))
  const [likesRes, commentsRes] = await Promise.all([
    cleanSupabase.from('mirror_post_likes').select('post_id,user_id').in('post_id', ids),
    cleanSupabase.from('mirror_post_comments').select('*').in('post_id', ids).eq('status', 'approved').order('created_at', { ascending: true }).limit(300),
  ])
  if (likesRes.error) throw likesRes.error
  if (commentsRes.error) throw commentsRes.error
  const commentRows = commentsRes.data || []
  const commentUsers = await profileMap(commentRows.map((c: any) => c.user_id))
  const likes = likesRes.data || []
  return rows.map((r: any) => {
    const profile = users.get(r.user_id)
    const postComments = commentRows.filter((c: any) => c.post_id === r.id)
    return {
      id: r.id,
      userId: r.user_id,
      author: profile?.nickname || '镜屿用户',
      avatarUrl: profile?.avatar_url || '',
      city: profile?.city || '',
      channel: r.channel,
      kind: r.kind,
      visibility: r.visibility,
      title: r.title || '',
      content: r.content || '',
      mediaUrls: r.media_urls || [],
      coverUrl: r.cover_url || '',
      reviewCategory: r.review_category || '',
      workTitle: r.work_title || '',
      rating: r.rating == null ? null : Number(r.rating),
      createdAt: r.created_at,
      liked: likes.some((l: any) => l.post_id === r.id && l.user_id === user.id),
      likeCount: likes.filter((l: any) => l.post_id === r.id).length,
      comments: postComments.slice(-3).map((c: any) => ({
        id: c.id,
        postId: c.post_id,
        userId: c.user_id,
        author: commentUsers.get(c.user_id)?.nickname || '镜屿用户',
        avatarUrl: commentUsers.get(c.user_id)?.avatar_url || '',
        content: c.content,
        createdAt: c.created_at,
      })),
      commentCount: postComments.length,
    }
  })
}

export async function createFeedPost(input: {
  channel: 'world' | 'growth'
  kind: 'text' | 'image' | 'video' | 'review'
  visibility?: 'public' | 'friends'
  title?: string
  content: string
  mediaUrls?: string[]
  coverUrl?: string
  reviewCategory?: 'book' | 'movie' | 'music'
  workTitle?: string
  rating?: number
}) {
  const user = await currentUser()
  const { error } = await cleanSupabase.from('mirror_posts').insert({
    user_id: user.id,
    channel: input.channel,
    kind: input.kind,
    visibility: input.visibility || 'public',
    title: input.title?.trim() || '',
    content: input.content.trim(),
    media_urls: input.mediaUrls || [],
    cover_url: input.coverUrl || null,
    review_category: input.reviewCategory || null,
    work_title: input.workTitle?.trim() || null,
    rating: input.rating || null,
    status: 'approved',
    moderation: { source: 'mirror-v2' },
  })
  if (error) throw error
}

export async function togglePostLike(postId: string, liked: boolean) {
  const user = await currentUser()
  if (liked) {
    const { error } = await cleanSupabase.from('mirror_post_likes').delete().eq('post_id', postId).eq('user_id', user.id)
    if (error) throw error
  } else {
    const { error } = await cleanSupabase.from('mirror_post_likes').insert({ post_id: postId, user_id: user.id })
    if (error) throw error
  }
}

export async function addPostComment(postId: string, content: string) {
  const user = await currentUser()
  const { error } = await cleanSupabase.from('mirror_post_comments').insert({ post_id: postId, user_id: user.id, content: content.trim(), status: 'approved' })
  if (error) throw error
}

export async function createPrivateNote(content: string, files: File[]) {
  const user = await currentUser()
  const paths = [] as string[]
  for (const file of files.slice(0, 4)) paths.push(`private:${await uploadPrivateImage(file)}`)
  const { error } = await cleanSupabase.from('mirror_tree_posts').insert({
    user_id: user.id,
    author: '自己',
    visibility: 'private',
    content: content.trim(),
    images: paths,
    tags: ['私密树洞', 'mirror-v2'],
    status: 'approved',
    moderation: { source: 'mirror-v2' },
  })
  if (error) throw error
}

export async function fetchPrivateNotes(): Promise<PrivateNote[]> {
  const user = await currentUser()
  const { data, error } = await cleanSupabase.from('mirror_tree_posts').select('id,content,images,created_at').eq('user_id', user.id).eq('visibility', 'private').order('created_at', { ascending: false }).limit(60)
  if (error) throw error
  const result: PrivateNote[] = []
  for (const row of data || []) {
    const urls: string[] = []
    for (const raw of row.images || []) {
      if (raw.startsWith('private:')) urls.push(await privateUrl(raw.slice(8)))
      else urls.push(raw)
    }
    result.push({ id: row.id, content: row.content, imageUrls: urls, createdAt: row.created_at })
  }
  return result
}

export async function fetchConversationList(): Promise<ConversationItem[]> {
  const user = await currentUser()
  const { data: conversations, error } = await cleanSupabase.from('mirror_conversations').select('*').or(`user_a.eq.${user.id},user_b.eq.${user.id}`).eq('status', 'active').order('last_message_at', { ascending: false, nullsFirst: false })
  if (error) throw error
  const rows = conversations || []
  if (!rows.length) return []
  const peerIds = rows.map((c: any) => c.user_a === user.id ? c.user_b : c.user_a)
  const peers = await profileMap(peerIds)
  const ids = rows.map((c: any) => c.id)
  const [messagesRes, readsRes] = await Promise.all([
    cleanSupabase.from('mirror_messages').select('*').in('conversation_id', ids).neq('status', 'rejected').order('created_at', { ascending: false }).limit(500),
    cleanSupabase.from('mirror_conversation_reads').select('*').eq('user_id', user.id).in('conversation_id', ids),
  ])
  if (messagesRes.error) throw messagesRes.error
  if (readsRes.error) throw readsRes.error
  const messages = messagesRes.data || []
  const reads = new Map((readsRes.data || []).map((r: any) => [r.conversation_id, new Date(r.last_read_at).getTime()]))
  return rows.map((c: any) => {
    const peerId = c.user_a === user.id ? c.user_b : c.user_a
    const list = messages.filter((m: any) => m.conversation_id === c.id)
    const last = list[0]
    const cutoff = reads.get(c.id) || 0
    return {
      id: c.id,
      peer: peers.get(peerId) || normalizeProfile({ id: peerId }),
      lastMessage: last?.content || '还没有消息',
      lastMessageAt: last?.created_at || c.created_at,
      unread: list.filter((m: any) => m.sender_id !== user.id && new Date(m.created_at).getTime() > cutoff).length,
    }
  })
}

export async function markConversationRead(conversationId: string) {
  const user = await currentUser()
  const { error } = await cleanSupabase.from('mirror_conversation_reads').upsert({ conversation_id: conversationId, user_id: user.id, last_read_at: new Date().toISOString() }, { onConflict: 'conversation_id,user_id' })
  if (error) throw error
  await cleanSupabase.from('mirror_notifications').update({ read_at: new Date().toISOString() }).eq('user_id', user.id).eq('conversation_id', conversationId).is('read_at', null)
}

export function subscribeConversation(conversationId: string, onInsert: (message: ChatMessage) => void) {
  const channel: RealtimeChannel = cleanSupabase.channel(`mirror-chat-${conversationId}-${crypto.randomUUID()}`)
    .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'mirror_messages', filter: `conversation_id=eq.${conversationId}` }, (payload: any) => {
      const m = payload.new
      onInsert({ id: m.id, conversationId: m.conversation_id, senderId: m.sender_id, content: m.content, status: m.status, createdAt: m.created_at })
    })
    .subscribe()
  return () => { void cleanSupabase.removeChannel(channel) }
}

export async function fetchNotifications(): Promise<AppNotification[]> {
  const user = await currentUser()
  const { data, error } = await cleanSupabase.from('mirror_notifications').select('*').eq('user_id', user.id).order('created_at', { ascending: false }).limit(60)
  if (error) throw error
  const rows = data || []
  const actors = await profileMap(rows.map((r: any) => r.actor_id).filter(Boolean))
  return rows.map((r: any) => ({
    id: r.id,
    type: r.type,
    actor: actors.get(r.actor_id)?.nickname || '镜屿用户',
    actorAvatar: actors.get(r.actor_id)?.avatar_url || '',
    text: r.text || '',
    createdAt: r.created_at,
    read: Boolean(r.read_at),
    postId: r.post_id || undefined,
    conversationId: r.conversation_id || undefined,
  }))
}

export async function markAllNotificationsRead() {
  const user = await currentUser()
  const { error } = await cleanSupabase.from('mirror_notifications').update({ read_at: new Date().toISOString() }).eq('user_id', user.id).is('read_at', null)
  if (error) throw error
}

export async function saveAssessmentRun(instrument: string, scores: Record<string, unknown>, responses: Record<string, number>) {
  const user = await currentUser()
  const { error } = await cleanSupabase.from('mirror_assessment_runs').insert({ user_id: user.id, instrument, version: '1.0', scores, responses })
  if (error) throw error
}

export async function fetchAssessmentRuns() {
  const user = await currentUser()
  const { data, error } = await cleanSupabase.from('mirror_assessment_runs').select('*').eq('user_id', user.id).order('completed_at', { ascending: false }).limit(30)
  if (error) throw error
  return data || []
}

export async function saveStoryAssessment(scores: { extraversion: number; agreeableness: number; conscientiousness: number; emotionalStability: number; openness: number }, responses: Record<string, number>) {
  const user = await currentUser()
  const traits = {
    values: Math.round(scores.openness * .55 + scores.agreeableness * .45),
    lifestyle: Math.round(scores.conscientiousness * .65 + scores.emotionalStability * .35),
    relationship: Math.round(scores.agreeableness * .55 + scores.extraversion * .45),
    communication: Math.round(scores.extraversion * .55 + scores.emotionalStability * .45),
    growth: Math.round(scores.openness * .7 + scores.conscientiousness * .3),
    boundary: Math.round(scores.emotionalStability * .65 + scores.conscientiousness * .35),
  }
  const anchors = [
    traits.relationship >= 62 ? '深聊型' : '独处友好',
    traits.growth >= 62 ? '探索成长' : '稳定生活',
    traits.boundary >= 62 ? '边界清晰' : '高连接感',
  ]
  const { error: runError } = await cleanSupabase.from('mirror_assessment_runs').insert({ user_id: user.id, instrument: 'story-big-five', version: '2.0', scores, responses })
  if (runError) throw runError
  const { error } = await cleanSupabase.from('mirror_profiles').update({ traits, anchors, confidence: 82, profile_complete: true, updated_at: new Date().toISOString() }).eq('id', user.id)
  if (error) throw error
}

export async function applyIpipScores(scores: Record<string, number>) {
  const user = await currentUser()
  const e = Number(scores.extraversion ?? 50)
  const a = Number(scores.agreeableness ?? 50)
  const c = Number(scores.conscientiousness ?? 50)
  const s = Number(scores.emotionalStability ?? 50)
  const o = Number(scores.openness ?? 50)
  const traits = {
    values: Math.round(o * .55 + a * .45),
    lifestyle: Math.round(c * .65 + s * .35),
    relationship: Math.round(a * .55 + e * .45),
    communication: Math.round(e * .55 + s * .45),
    growth: Math.round(o * .7 + c * .3),
    boundary: Math.round(s * .65 + c * .35),
  }
  const { error } = await cleanSupabase.from('mirror_profiles').update({ traits, confidence: 94, updated_at: new Date().toISOString() }).eq('id', user.id)
  if (error) throw error
}
