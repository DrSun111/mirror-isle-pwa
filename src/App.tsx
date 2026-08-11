import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import type { CSSProperties, Dispatch, ReactNode, SetStateAction, TouchEvent } from 'react'
import { Browser } from '@capacitor/browser'
import type { LucideIcon } from 'lucide-react'
import {
  Award,
  BadgeCheck,
  Bookmark,
  BookOpen,
  ChevronRight,
  CircleAlert,
  CircleCheck,
  Clock3,
  Copy,
  Download,
  Heart,
  House,
  Landmark,
  Leaf,
  MessageCircle,
  Moon,
  NotebookTabs,
  PenLine,
  Plus,
  Send,
  ShieldCheck,
  Sparkles,
  Star,
  UserRound,
  Users,
} from 'lucide-react'
import './App.css'
import {
  createTreePost,
  createFriendship,
  fetchConversationMessages,
  fetchFriends,
  fetchRecommendations,
  fetchTreePosts,
  loginWithPassword,
  registerWithInvite,
  saveAssessment,
  searchFriendProfiles,
  sendConversationMessage,
  startConversation,
  submitIdentity,
  updateMe,
  type ApiProfile,
  type ApiRecommendation,
  type ApiTreePost,
  type ApiUser,
} from './api'

type Screen = 'welcome' | 'profile' | 'assessment' | 'app'
type AuthMode = 'login' | 'register'
type TabKey = 'meet' | 'tree' | 'growth' | 'messages' | 'me'
type GrowthPanel = 'home' | 'path' | 'reading' | 'practice' | 'discussion' | 'fellows'
type MePanel = 'home' | 'saved' | 'privacy' | 'theme'
type ThemeKey = 'botanical' | 'starlight' | 'sunset' | 'sky' | 'custom'
type RelationGoal = '亲密关系' | '深度朋友' | '成长伙伴'
type PrivacyLevel = 'private' | 'friends' | 'public'
type DimensionKey = 'values' | 'lifestyle' | 'relationship' | 'communication' | 'growth' | 'boundary'

const APP_VERSION = '0.12.0'
const RELEASES_API_URL = 'https://api.github.com/repos/DrSun111/mirror-isle-pwa/releases/latest'
const RELEASES_PAGE_URL = 'https://github.com/DrSun111/mirror-isle-pwa/releases/latest'

interface RegistrationDraft {
  email: string
  code: string
  inviteCode: string
  password: string
  confirmPassword: string
  avatar: string
  nickname: string
  city: string
  goal: RelationGoal
  privacy: PrivacyLevel
  ageConfirmed: boolean
  agreement: boolean
}

interface Traits extends Record<DimensionKey, number> {
  confidence: number
  anchors: string[]
}

interface Profile {
  id: string
  email: string
  avatar: string
  nickname: string
  city: string
  goal: RelationGoal
  privacy: PrivacyLevel
  identityStatus?: string
  traits: Traits
  answers: Record<string, string>
  createdAt: string
}

interface AssessmentOption {
  id: string
  title: string
  subtitle: string
  icon: LucideIcon
  tone: string
  effects: Partial<Record<DimensionKey, number>>
  anchor: string
}

interface AssessmentQuestion {
  id: string
  title: string
  subtitle: string
  construct: string
  options: AssessmentOption[]
}

interface Candidate {
  id: string
  name: string
  age: number
  city: string
  type: string
  goal: RelationGoal
  score: number
  confidence: string
  avatar: string
  mood: string
  tags: string[]
  intro: string
  dimensions: Record<DimensionKey, number>
  similar: string[]
  different: string[]
  friction: string[]
  openers: string[]
}

interface TreePost {
  id: string
  author: string
  time: string
  visibility: PrivacyLevel
  content: string
  tags: string[]
  resonance: number
  hugs: number
  experienced: number
  chats: number
}

interface ChatMessage {
  id: string
  from: 'me' | 'them'
  text: string
}

const baseUrl = import.meta.env.BASE_URL

const defaultDraft: RegistrationDraft = {
  email: '',
  code: '',
  inviteCode: '',
  password: '',
  confirmPassword: '',
  avatar: '澄',
  nickname: '',
  city: '上海',
  goal: '深度朋友',
  privacy: 'friends',
  ageConfirmed: false,
  agreement: false,
}

const dimensionMeta: Array<{
  key: DimensionKey
  label: string
  shortLabel: string
  left: string
  right: string
  color: string
}> = [
  { key: 'values', label: '价值观', shortLabel: '价值', left: '稳定', right: '探索', color: '#4277A5' },
  { key: 'lifestyle', label: '生活节律', shortLabel: '生活', left: '计划', right: '随性', color: '#6D9A87' },
  { key: 'relationship', label: '关系需求', shortLabel: '关系', left: '空间', right: '回应', color: '#8A78BE' },
  { key: 'communication', label: '沟通方式', shortLabel: '沟通', left: '理性', right: '感性', color: '#C59C5B' },
  { key: 'growth', label: '成长方向', shortLabel: '成长', left: '沉淀', right: '突破', color: '#6B9E61' },
  { key: 'boundary', label: '边界感', shortLabel: '边界', left: '开放', right: '清晰', color: '#6C86B3' },
]

const assessmentQuestions: AssessmentQuestion[] = [
  {
    id: 'friday-night',
    title: '周五晚上，你最想怎样度过？',
    subtitle: '用一个生活场景，认识你的能量恢复方式',
    construct: '社交能量',
    options: [
      {
        id: 'read-alone',
        title: '独处阅读',
        subtitle: '沉浸书中世界',
        icon: BookOpen,
        tone: 'blue',
        effects: { lifestyle: 7, boundary: 8, communication: -3 },
        anchor: '低频社交者',
      },
      {
        id: 'small-party',
        title: '好友小聚',
        subtitle: '轻松聊天放松心情',
        icon: Users,
        tone: 'sage',
        effects: { relationship: 7, communication: 5, boundary: 2 },
        anchor: '温和连接者',
      },
      {
        id: 'new-world',
        title: '看看不同世界',
        subtitle: '认识新朋友和新观点',
        icon: Sparkles,
        tone: 'violet',
        effects: { growth: 8, values: 5, communication: 4 },
        anchor: '探索驱动者',
      },
      {
        id: 'quiet-chat',
        title: '安静同频',
        subtitle: '独处，但愿意认真聊天',
        icon: Moon,
        tone: 'sand',
        effects: { relationship: 8, boundary: 6, communication: 3 },
        anchor: '深度对话者',
      },
    ],
  },
  {
    id: 'schedule',
    title: '两个人约好周六 10:00 出门，你更接近？',
    subtitle: '节奏差异常常是关系里最真实的摩擦点',
    construct: '生活秩序',
    options: [
      {
        id: 'prepare',
        title: '提前准备',
        subtitle: '前一晚就确认路线和物品',
        icon: Clock3,
        tone: 'blue',
        effects: { lifestyle: 12, boundary: 4 },
        anchor: '计划稳定型',
      },
      {
        id: 'on-time',
        title: '准时到达',
        subtitle: '保持弹性，但尊重约定',
        icon: CircleCheck,
        tone: 'sage',
        effects: { lifestyle: 8, communication: 4 },
        anchor: '可靠同步型',
      },
      {
        id: 'ten-minutes',
        title: '十分钟可接受',
        subtitle: '小延迟不影响心情',
        icon: Leaf,
        tone: 'sand',
        effects: { lifestyle: -4, relationship: 3 },
        anchor: '弹性舒适型',
      },
      {
        id: 'same-day',
        title: '当天再说',
        subtitle: '更看重现场感和灵活性',
        icon: Star,
        tone: 'violet',
        effects: { lifestyle: -9, growth: 4 },
        anchor: '即兴体验型',
      },
    ],
  },
  {
    id: 'conflict',
    title: '发生意见分歧后，你更想怎样修复？',
    subtitle: '不是判断成熟与否，而是看双方能否协商',
    construct: '冲突修复',
    options: [
      {
        id: 'talk-now',
        title: '立即谈清楚',
        subtitle: '问题不要过夜',
        icon: MessageCircle,
        tone: 'blue',
        effects: { communication: 7, relationship: 5 },
        anchor: '即时修复者',
      },
      {
        id: 'cool-down',
        title: '冷静后再谈',
        subtitle: '先让情绪降下来',
        icon: Moon,
        tone: 'sage',
        effects: { boundary: 9, communication: 2 },
        anchor: '缓冲修复者',
      },
      {
        id: 'feelings-first',
        title: '先表达感受',
        subtitle: '让我知道你理解我',
        icon: Heart,
        tone: 'violet',
        effects: { relationship: 9, communication: 8 },
        anchor: '情绪理解者',
      },
      {
        id: 'solve-first',
        title: '先解决问题',
        subtitle: '找到下一步行动',
        icon: ShieldCheck,
        tone: 'sand',
        effects: { communication: -4, lifestyle: 4, values: 3 },
        anchor: '行动修复者',
      },
    ],
  },
  {
    id: 'reply',
    title: '重要消息几个小时没回复，你通常会？',
    subtitle: '镜屿只记录偏好，不给用户贴病理标签',
    construct: '回应需求',
    options: [
      {
        id: 'assume-busy',
        title: '默认对方在忙',
        subtitle: '不急着下结论',
        icon: Leaf,
        tone: 'sage',
        effects: { relationship: -3, boundary: 7 },
        anchor: '安全空间型',
      },
      {
        id: 'check-myself',
        title: '看看是否说清楚',
        subtitle: '先复盘自己的表达',
        icon: NotebookTabs,
        tone: 'blue',
        effects: { communication: 7, growth: 4 },
        anchor: '反思沟通者',
      },
      {
        id: 'do-my-thing',
        title: '继续做自己的事',
        subtitle: '不让等待占据生活',
        icon: House,
        tone: 'sand',
        effects: { boundary: 10, lifestyle: 5 },
        anchor: '自我稳定型',
      },
      {
        id: 'need-clarity',
        title: '希望确认原因',
        subtitle: '清楚一点会更安心',
        icon: BadgeCheck,
        tone: 'violet',
        effects: { relationship: 9, communication: 4 },
        anchor: '确定感需求',
      },
    ],
  },
  {
    id: 'money',
    title: '意外得到一笔可自由支配的钱，你会优先？',
    subtitle: '价值方向决定关系里很多长期选择',
    construct: '价值方向',
    options: [
      {
        id: 'travel',
        title: '旅行体验',
        subtitle: '把钱换成新的世界',
        icon: Landmark,
        tone: 'blue',
        effects: { values: 9, growth: 5 },
        anchor: '体验探索者',
      },
      {
        id: 'stable-life',
        title: '打造稳定生活',
        subtitle: '让日常更踏实',
        icon: House,
        tone: 'sand',
        effects: { values: -6, lifestyle: 7 },
        anchor: '生活筑巢者',
      },
      {
        id: 'learning',
        title: '学习成长',
        subtitle: '投资长期能力',
        icon: Award,
        tone: 'sage',
        effects: { growth: 10, values: 4 },
        anchor: '成长驱动者',
      },
      {
        id: 'saving',
        title: '储蓄安全',
        subtitle: '先给未来留余地',
        icon: ShieldCheck,
        tone: 'violet',
        effects: { values: -8, boundary: 5, lifestyle: 5 },
        anchor: '安全优先者',
      },
    ],
  },
  {
    id: 'growth-theme',
    title: '接下来半年，你最想在哪件事上成长？',
    subtitle: '成长方向会进入推荐和内容闭环',
    construct: '成长主题',
    options: [
      {
        id: 'boundary',
        title: '边界感',
        subtitle: '更清楚地表达需要',
        icon: ShieldCheck,
        tone: 'sage',
        effects: { boundary: 10, growth: 4 },
        anchor: '边界练习者',
      },
      {
        id: 'expression',
        title: '表达',
        subtitle: '把真实想法说出来',
        icon: PenLine,
        tone: 'blue',
        effects: { communication: 9, growth: 5 },
        anchor: '表达练习者',
      },
      {
        id: 'career',
        title: '职业方向',
        subtitle: '建立更稳的自我坐标',
        icon: Landmark,
        tone: 'sand',
        effects: { values: 4, growth: 9 },
        anchor: '方向整理者',
      },
      {
        id: 'intimacy',
        title: '亲密关系',
        subtitle: '学习靠近，也学习保留自己',
        icon: Heart,
        tone: 'violet',
        effects: { relationship: 10, boundary: 4 },
        anchor: '亲密学习者',
      },
    ],
  },
]

const candidates: Candidate[] = [
  {
    id: 'shan',
    name: '山脉与海',
    age: 26,
    city: '杭州',
    type: 'INFJ',
    goal: '深度朋友',
    score: 92,
    confidence: '中高',
    avatar: '山',
    mood: '最近在学着允许自己慢下来。',
    tags: ['阅读', '独立思考', '慢生活'],
    intro: '你们在生活态度和价值观探索上高度契合，喜欢在安静中感受世界。',
    dimensions: { values: 86, lifestyle: 78, relationship: 72, communication: 64, growth: 90, boundary: 82 },
    similar: ['都重视真诚与信任', '喜欢深度思考与成长', '对重要的人很专一'],
    different: ['你更感性，她更理性', '你更独处，她行动边界更清楚'],
    friction: ['表达方式可能误解', '情绪需求需要被看见', '节奏不同，容易有落差'],
    openers: [
      '你最近一次感到真正被理解，是什么时刻？',
      '如果给当下的自己留一句话，你会写什么？',
      '你希望朋友在你低落时怎么陪你？',
    ],
  },
  {
    id: 'feng',
    name: '时与风',
    age: 28,
    city: '上海',
    type: 'ENTJ',
    goal: '成长伙伴',
    score: 88,
    confidence: '中',
    avatar: '风',
    mood: '行动是自我认知最好的验证。',
    tags: ['咖啡', '旅行', '成长实践者'],
    intro: '你们的作息节律相似，都是高效专注的人，容易在彼此节奏中感到舒适。',
    dimensions: { values: 80, lifestyle: 84, relationship: 62, communication: 76, growth: 88, boundary: 68 },
    similar: ['对成长投入度高', '都愿意把想法落到行动', '生活节奏相对同步'],
    different: ['他更理性推进，你更重视感受', '他表达直接，你更需要缓冲'],
    friction: ['强目标感可能带来压力', '需要提前谈清空间与回应频率'],
    openers: [
      '什么样的人会让你愿意慢慢卸下防备？',
      '如果有一天可以重新选择一次人生，你会在哪些地方不同？',
      '最近哪个决定让你更相信自己？',
    ],
  },
  {
    id: 'wan',
    name: '晚星',
    age: 24,
    city: '成都',
    type: 'INFP',
    goal: '亲密关系',
    score: 85,
    confidence: '中',
    avatar: '晚',
    mood: '把生活过成一封慢慢写完的信。',
    tags: ['艺术', '心理学', '温柔表达'],
    intro: '你们的沟通风格互补，你感性细腻，她理性温暖，能彼此理解并支持成长。',
    dimensions: { values: 82, lifestyle: 66, relationship: 88, communication: 82, growth: 74, boundary: 70 },
    similar: ['都在意情绪被理解', '对关系中的细节很敏感', '喜欢温和而真诚的交流'],
    different: ['她更外显表达，你更慢热', '她更看重即时回应'],
    friction: ['消息回应慢可能被理解为疏离', '关系推进节奏需要协商'],
    openers: [
      '你最近一次想被拥抱，是因为什么？',
      '怎样的沟通会让你觉得安心？',
      '你希望亲密关系里保留怎样的自我空间？',
    ],
  },
]

const seedTreePosts: TreePost[] = [
  {
    id: 't1',
    author: '山脉与海',
    time: '1 小时前',
    visibility: 'friends',
    content: '最近在学着允许自己慢下来。生活不是一场冲刺，而是一段旅程，沿途的风景也很重要。',
    tags: ['成长', '慢生活'],
    resonance: 24,
    hugs: 18,
    experienced: 16,
    chats: 9,
  },
  {
    id: 't2',
    author: '时与风',
    time: '3 小时前',
    visibility: 'public',
    content: '有时候会突然感到迷茫，不知道下一步该往哪里走。但我相信，答案会在路上慢慢浮现。',
    tags: ['迷茫', '未来', '思考'],
    resonance: 31,
    hugs: 22,
    experienced: 19,
    chats: 12,
  },
]

const startingMessages: ChatMessage[] = []

const navItems: Array<{ key: TabKey; label: string; icon: LucideIcon }> = [
  { key: 'meet', label: '遇见', icon: Landmark },
  { key: 'tree', label: '树洞', icon: MessageCircle },
  { key: 'growth', label: '成长', icon: Leaf },
  { key: 'messages', label: '消息', icon: Send },
  { key: 'me', label: '我的', icon: UserRound },
]
const tabOrder: TabKey[] = navItems.map((item) => item.key)
const avatarOptions = ['澄', '岛', '月', '星', '林', '海']

const readingItems = [
  { title: '被讨厌的勇气', meta: '关系里的自我课', brief: '把别人的评价还给别人，把自己的选择拿回来。' },
  { title: '边界：通往个人自由', meta: '8 分钟阅读', brief: '练习说清楚需求，也允许别人拥有不同节奏。' },
  { title: '也许你该找个人聊聊', meta: '心理成长', brief: '看见防御背后的柔软，让表达慢慢变得真实。' },
]

const practiceItems = [
  { id: 'boundary-signal', title: '识别你的边界信号', detail: '记录一次让你不舒服的关系瞬间，写下身体感受和真正需求。', duration: '约 8 分钟' },
  { id: 'honest-message', title: '写一条真实表达', detail: '用“我感到 / 我需要 / 我希望”的句式，准备一次不攻击的沟通。', duration: '约 6 分钟' },
  { id: 'quiet-review', title: '关系复盘三问', detail: '今天我在哪一刻靠近了自己？哪一刻又忽略了自己？下一次想怎样做？', duration: '约 10 分钟' },
]

const themeOptions: Array<{ key: ThemeKey; label: string; hint: string; colors: string[] }> = [
  { key: 'botanical', label: '植物浅绿', hint: '安静、柔和、像一座清晨的岛', colors: ['#dce9dd', '#6d9a87', '#173b61'] },
  { key: 'starlight', label: '星空浅紫', hint: '克制、神秘、适合夜晚书写', colors: ['#e9e4f7', '#8a78be', '#2f315d'] },
  { key: 'sunset', label: '黄昏浅红', hint: '温暖、亲近、带一点夕阳感', colors: ['#f5dfd9', '#d9897b', '#6f3b36'] },
  { key: 'sky', label: '天空浅蓝', hint: '清透、开阔、像云层之后的光', colors: ['#d9effb', '#6aaed6', '#153449'] },
  { key: 'custom', label: '自定义', hint: '用你自己的颜色重塑镜屿', colors: ['#ddeaf4', '#c59c5b', '#173b61'] },
]

function formatInviteAuthError(message: string, fallback: string) {
  if (/invalid_invite_code/i.test(message)) return '邀请码无效，请确认后重试'
  if (/email_confirmation_still_enabled/i.test(message)) return 'Supabase 仍开启邮箱确认，请先关闭 Confirm email 后再注册'
  if (/Invalid login credentials/i.test(message)) return '邮箱或邀请码不正确'
  if (/User already registered|already registered|already exists/i.test(message)) return '该邮箱已注册，请切换到登录'
  if (/network_timeout/i.test(message)) return '连接超时，请换网络后重试'
  if (/network_unreachable|failed to fetch|network|fetch/i.test(message)) return '网络连接失败，请换网络后重试'
  return message ? `${fallback}：${message}` : fallback
}

function formatPasswordAuthError(message: string, fallback: string) {
  if (/Invalid login credentials/i.test(message)) return '邮箱或密码不正确'
  if (/Email not confirmed|email_confirmation/i.test(message)) return '邮箱尚未确认，请先关闭 Supabase Confirm email'
  if (/network_timeout/i.test(message)) return '连接超时，请换网络后重试'
  if (/network_unreachable|failed to fetch|network|fetch/i.test(message)) return '网络连接失败，请换网络后重试'
  return message ? `${fallback}：${message}` : fallback
}

async function openExternalUrl(url: string) {
  try {
    await Browser.open({ url })
  } catch {
    window.location.href = url
  }
}

function App() {
  const [screen, setScreen] = useState<Screen>('welcome')
  const [authMode, setAuthMode] = useState<AuthMode>('login')
  const [activeTab, setActiveTab] = useStoredState<TabKey>('mirror-isle:tab', 'meet')
  const [draft, setDraft] = useStoredState<RegistrationDraft>('mirror-isle:draft', defaultDraft)
  const [answers, setAnswers] = useStoredState<Record<string, string>>('mirror-isle:answers', {})
  const [profile, setProfile] = useStoredState<Profile | null>('mirror-isle:profile', null)
  const [authToken, setAuthToken] = useStoredState<string | null>('mirror-isle:auth-token', null)
  const [treePosts, setTreePosts] = useStoredState<TreePost[]>('mirror-isle:tree-posts', seedTreePosts)
  const [chatMessages, setChatMessages] = useStoredState<ChatMessage[]>('mirror-isle:messages', startingMessages)
  const [localConversations, setLocalConversations] = useStoredState<Record<string, ChatMessage[]>>('mirror-isle:local-conversations', {})
  const [selectedCandidateId, setSelectedCandidateId] = useStoredState('mirror-isle:selected', candidates[0].id)
  const [questionIndex, setQuestionIndex] = useStoredState('mirror-isle:question-index', 0)
  const [friendIds, setFriendIds] = useStoredState<string[]>('mirror-isle:friends', [])
  const [themeKey, setThemeKey] = useStoredState<ThemeKey>('mirror-isle:theme', 'botanical')
  const [customAccent, setCustomAccent] = useStoredState('mirror-isle:custom-accent', '#6d9a87')
  const [remoteCandidates, setRemoteCandidates] = useState<Array<Candidate & { liveScore: number }> | null>(null)
  const [remoteFriends, setRemoteFriends] = useState<Array<Candidate & { liveScore: number }>>([])
  const [conversationIds, setConversationIds] = useStoredState<Record<string, string>>('mirror-isle:conversation-ids', {})
  const [, setBackendState] = useState<'online' | 'offline'>(authToken ? 'online' : 'offline')
  const [apiUser, setApiUser] = useState<ApiUser | null>(null)
  const [toast, setToast] = useState('')

  useEffect(() => {
    if (profile && !authToken) {
      setProfile(null)
      setScreen('welcome')
      return
    }
    if (profile) setScreen('app')
  }, [authToken, profile, setProfile])

  useEffect(() => {
    window.scrollTo({ top: 0, behavior: 'auto' })
  }, [screen])

  useEffect(() => {
    if (!toast) return
    const timer = window.setTimeout(() => setToast(''), 2400)
    return () => window.clearTimeout(timer)
  }, [toast])

  const rankedCandidates = useMemo(() => {
    if (remoteCandidates?.length) return remoteCandidates
    return candidates
      .map((candidate) => ({
        ...candidate,
        liveScore: profile ? scoreCandidate(profile.traits, candidate) : candidate.score,
      }))
      .sort((a, b) => b.liveScore - a.liveScore)
  }, [profile, remoteCandidates])

  const knownCandidates = useMemo(
    () => mergeCandidates([...remoteFriends, ...rankedCandidates]),
    [rankedCandidates, remoteFriends],
  )

  const selectedCandidate =
    knownCandidates.find((candidate) => candidate.id === selectedCandidateId) ?? knownCandidates[0]

  const showToast = useCallback((message: string) => setToast(message), [])

  const syncBackendData = async (token: string) => {
    try {
      const [recommendationResult, treeResult, friendResult] = await Promise.all([
        fetchRecommendations(token).catch(() => ({ items: [], score_version: 'offline' })),
        fetchTreePosts(token).catch(() => ({ items: [] })),
        fetchFriends(token).catch(() => ({ items: [] })),
      ])
      if (recommendationResult.items.length) {
        setRemoteCandidates(recommendationResult.items.map(mapApiRecommendation))
      }
      if (treeResult.items.length) {
        setTreePosts(treeResult.items.map(mapApiTreePost))
      }
      const nextFriends = friendResult.items.map(mapApiRecommendation)
      setRemoteFriends(nextFriends)
      if (nextFriends.length) {
        setFriendIds((current) => [...new Set([...current, ...nextFriends.map((friend) => friend.id)])])
      }
      setBackendState('online')
    } catch {
      setBackendState('offline')
    }
  }

  const enterAccount = async () => {
    if (!isValidQqEmail(draft.email)) {
      showToast('请填写 QQ 邮箱')
      return
    }
    if (draft.password.trim().length < 6) {
      showToast('请填写至少 6 位密码')
      return
    }
    if (authMode === 'register' && !draft.inviteCode.trim()) {
      showToast('请填写邀请码')
      return
    }
    if (authMode === 'register' && draft.password !== draft.confirmPassword) {
      showToast('两次输入的密码不一致')
      return
    }
    try {
      const login =
        authMode === 'register'
          ? await registerWithInvite(draft.email, draft.inviteCode, draft.password)
          : await loginWithPassword(draft.email, draft.password)
      const nextProfile = mapApiProfile(login.profile, profile?.avatar ?? draft.avatar)
      setAuthToken(login.token)
      setApiUser(login.user)
      setProfile(nextProfile)
      setDraft((current) => ({
        ...current,
        email: draft.email,
        inviteCode: draft.inviteCode,
        password: '',
        confirmPassword: '',
        avatar: nextProfile.avatar,
        nickname: nextProfile.nickname,
        city: nextProfile.city,
        goal: nextProfile.goal,
        privacy: nextProfile.privacy,
      }))
      setBackendState('online')
      void syncBackendData(login.token)
      if (authMode === 'register' || !login.user.age_confirmed) {
        setScreen('profile')
      } else {
        setActiveTab('meet')
        setScreen('app')
      }
      showToast(authMode === 'register' ? '邀请通过，请设定资料' : '登录成功')
    } catch (error) {
      console.error('account auth failed', error)
      setAuthToken(null)
      setApiUser(null)
      setBackendState('offline')
      const message = error instanceof Error ? error.message : ''
      showToast(authMode === 'register' ? formatInviteAuthError(message, '注册失败') : formatPasswordAuthError(message, '登录失败'))
    }
  }

  const completeProfileSetup = async () => {
    if (!authToken) {
      showToast('请先完成邮箱登录')
      setScreen('welcome')
      return
    }
    if (!draft.nickname.trim() || !draft.city.trim()) {
      showToast('请填写昵称和城市')
      return
    }
    if (!draft.ageConfirmed || !draft.agreement) {
      showToast('请确认年龄与协议后继续')
      return
    }
    try {
      const result = await updateMe(authToken, {
        nickname: draft.nickname.trim(),
        city: draft.city.trim(),
        goal: draft.goal,
        privacy: 'friends',
        age_confirmed: true,
      })
      setApiUser(result.user)
      setBackendState('online')
    } catch {
      setBackendState('offline')
      showToast('个人信息保存失败')
      return
    }
    setQuestionIndex(0)
    setAnswers({})
    setScreen('assessment')
  }

  const finishAssessment = async (nextAnswers: Record<string, string>) => {
    let remoteTraits: Traits | null = null
    if (!authToken) {
      showToast('请先完成内测登录')
      setScreen('welcome')
      return
    }
    try {
      const result = await saveAssessment(authToken, nextAnswers)
      remoteTraits = {
        values: result.traits.values,
        lifestyle: result.traits.lifestyle,
        relationship: result.traits.relationship,
        communication: result.traits.communication,
        growth: result.traits.growth,
        boundary: result.traits.boundary,
        confidence: result.confidence,
        anchors: result.anchors,
      }
      await syncBackendData(authToken)
    } catch {
      setBackendState('offline')
      showToast('心谱保存失败，请稍后重试')
      return
    }
    const nextProfile: Profile = {
      id: apiUser?.id ?? profile?.id ?? `mirror-${Date.now()}`,
      email: draft.email,
      avatar: draft.avatar,
      nickname: draft.nickname.trim(),
      city: draft.city.trim() || '上海',
      goal: draft.goal,
      privacy: 'friends',
      identityStatus: apiUser?.identity_status ?? profile?.identityStatus ?? 'unsubmitted',
      traits: remoteTraits,
      answers: nextAnswers,
      createdAt: profile?.createdAt ?? new Date().toISOString(),
    }
    setProfile(nextProfile)
    setActiveTab('meet')
    setScreen('app')
    showToast('初见心谱已生成')
  }

  const resetDemo = () => {
    window.localStorage.removeItem('mirror-isle:profile')
    window.localStorage.removeItem('mirror-isle:answers')
    window.localStorage.removeItem('mirror-isle:auth-token')
    window.localStorage.removeItem('mirror-isle:draft')
    window.localStorage.removeItem('mirror-isle:question-index')
    window.localStorage.removeItem('mirror-isle:messages')
    window.localStorage.removeItem('mirror-isle:local-conversations')
    window.localStorage.removeItem('mirror-isle:tree-posts')
    window.localStorage.removeItem('mirror-isle:conversation-ids')
    window.localStorage.removeItem('mirror-isle:saved-reports')
    window.localStorage.removeItem('mirror-isle:planned-practices')
    window.localStorage.removeItem('mirror-isle:growth-discussion')
    window.localStorage.removeItem('mirror-isle:fellow-offset')
    window.localStorage.removeItem('mirror-isle:privacy-settings')
    window.localStorage.removeItem('mirror-isle:friends')
    setProfile(null)
    setAuthToken(null)
    setDraft(defaultDraft)
    setAnswers({})
    setQuestionIndex(0)
    setChatMessages(startingMessages)
    setLocalConversations({})
    setTreePosts(seedTreePosts)
    setRemoteCandidates(null)
    setRemoteFriends([])
    setConversationIds({})
    setFriendIds([])
    setApiUser(null)
    setBackendState('offline')
    setScreen('welcome')
    showToast('体验数据已重置')
  }

  const publishTreePost = async (content: string, visibility: PrivacyLevel, tags: string[]) => {
    if (!authToken) {
      showToast('请先完成内测登录')
      return
    }
    const result = await createTreePost(authToken, content, visibility, tags)
    await syncBackendData(authToken)
    showToast(result.status === 'approved' ? '树洞已发布' : '树洞已进入审核')
  }

  const publishArticle = async (title: string, content: string) => {
    if (!authToken) {
      showToast('请先完成内测登录')
      return
    }
    const safeTitle = title.trim()
    const safeContent = content.trim()
    if (!safeTitle || !safeContent) {
      showToast('请填写文章标题和正文')
      return
    }
    const result = await createTreePost(authToken, `《${safeTitle}》\n${safeContent}`, 'public', ['文章', '阅读'])
    await syncBackendData(authToken)
    showToast(result.status === 'approved' ? '文章已发布' : '文章已进入审核')
  }

  const getConversationId = useCallback(
    async (candidateId: string) => {
      const existingConversationId = conversationIds[candidateId]
      if (existingConversationId) return existingConversationId
      if (!authToken) throw new Error('missing_token')
      const conversationId = (await startConversation(authToken, candidateId)).conversation_id
      setConversationIds((current) => ({ ...current, [candidateId]: conversationId }))
      return conversationId
    },
    [authToken, conversationIds, setConversationIds],
  )

  const syncConversationMessages = useCallback(
    async (candidateId: string) => {
      if (!authToken || !profile) return
      if (isSampleCandidateId(candidateId)) {
        setChatMessages(localConversations[candidateId] ?? [])
        return
      }
      try {
        const conversationId = await getConversationId(candidateId)
        const result = await fetchConversationMessages(authToken, conversationId)
        setChatMessages(
          result.items.map((message) => ({
            id: message.id,
            from: message.sender_id === profile.id ? 'me' : 'them',
            text: message.content,
          })),
        )
        setBackendState('online')
      } catch {
        setBackendState('offline')
        showToast('消息同步失败，请稍后重试')
      }
    },
    [authToken, getConversationId, localConversations, profile, setChatMessages, showToast],
  )

  const sendRemoteMessage = async (candidateId: string, content: string) => {
    if (!authToken) {
      showToast('请先完成内测登录')
      return
    }
    if (isSampleCandidateId(candidateId)) {
      const candidate = knownCandidates.find((item) => item.id === candidateId)
      const currentThread = localConversations[candidateId] ?? []
      const nextThread = [
        ...currentThread,
        { id: `local-${Date.now()}`, from: 'me' as const, text: content },
        {
          id: `local-reply-${Date.now()}`,
          from: 'them' as const,
          text: buildSampleReply(candidate, content),
        },
      ]
      setLocalConversations({ ...localConversations, [candidateId]: nextThread })
      setChatMessages(nextThread)
      showToast('本地样例会话已发送')
      return
    }
    const conversationId = await getConversationId(candidateId)
    const result = await sendConversationMessage(authToken, conversationId, content)
    await syncConversationMessages(candidateId)
    if (result.message.status !== 'approved') {
      showToast('消息已进入安全审核')
    }
  }

  const addFriend = async (candidateId: string) => {
    if (!authToken) {
      showToast('请先完成内测登录')
      return
    }
    if (isSampleCandidateId(candidateId)) {
      if (!friendIds.includes(candidateId)) setFriendIds([...new Set([...friendIds, candidateId])])
    } else {
      const result = await createFriendship(authToken, candidateId)
      const nextFriend = mapApiRecommendation(result.friend)
      setRemoteFriends((current) => mergeCandidates([nextFriend, ...current]))
      setConversationIds((current) => ({ ...current, [candidateId]: result.conversation_id }))
      setFriendIds([...new Set([...friendIds, candidateId])])
    }
    setSelectedCandidateId(candidateId)
    setActiveTab('messages')
    showToast(friendIds.includes(candidateId) ? '已进入朋友对话' : '已添加朋友')
  }

  const searchFriends = async (query: string) => {
    if (!authToken) {
      showToast('请先完成内测登录')
      return []
    }
    try {
      const result = await searchFriendProfiles(authToken, query)
      return result.items.map(mapApiRecommendation)
    } catch (error) {
      console.error('search friends failed', error)
      showToast('没有找到可添加的用户')
      return []
    }
  }

  const checkForUpdate = async () => {
    try {
      const response = await fetch(RELEASES_API_URL, {
        headers: { Accept: 'application/vnd.github+json' },
      })
      if (!response.ok) throw new Error(`${response.status} ${response.statusText}`)
      const latest = (await response.json()) as {
        tag_name?: string
        html_url?: string
        assets?: Array<{ name?: string; browser_download_url?: string }>
      }
      const latestVersion = (latest.tag_name ?? '').replace(/^v/i, '')
      const apkUrl = latest.assets?.find((asset) => asset.name?.endsWith('.apk'))?.browser_download_url
      if (latestVersion && isVersionNewer(latestVersion, APP_VERSION) && apkUrl) {
        showToast(`发现新版 v${latestVersion}，正在打开下载`)
        await openExternalUrl(apkUrl)
        return
      }
      showToast(`已是最新版本 v${APP_VERSION}`)
    } catch {
      showToast('正在打开更新页面')
      await openExternalUrl(RELEASES_PAGE_URL)
    }
  }

  useEffect(() => {
    if (screen !== 'app' || activeTab !== 'messages' || !selectedCandidate || !authToken) return
    void syncConversationMessages(selectedCandidate.id)
    const timer = window.setInterval(() => {
      void syncConversationMessages(selectedCandidate.id)
    }, 8000)
    return () => window.clearInterval(timer)
  }, [activeTab, authToken, screen, selectedCandidate, syncConversationMessages])

  const submitRealIdentity = async (realName: string, idNumber: string) => {
    if (!authToken || !profile) {
      showToast('请先完成真实登录')
      return
    }
    const result = await submitIdentity(authToken, realName, idNumber)
    setProfile({ ...profile, identityStatus: result.identity_status })
    showToast(result.provider === 'external' ? '实名校验已完成' : '实名信息已提交人工审核')
  }

  return (
    <div className={`mirror-app screen-${screen} theme-${themeKey}`} style={themeStyle(themeKey, customAccent)}>
      {screen === 'welcome' && (
        <WelcomeScreen
            authMode={authMode}
            draft={draft}
            setAuthMode={setAuthMode}
            setDraft={setDraft}
            onEnter={enterAccount}
          />
      )}

      {screen === 'profile' && (
        <ProfileSetupScreen
          draft={draft}
          setDraft={setDraft}
          onBack={() => setScreen('welcome')}
          onContinue={completeProfileSetup}
        />
      )}

      {screen === 'assessment' && (
        <AssessmentScreen
          answers={answers}
          draft={draft}
          questionIndex={questionIndex}
          setAnswers={setAnswers}
          setQuestionIndex={setQuestionIndex}
          onFinish={finishAssessment}
          onBack={() => setScreen(profile ? 'app' : 'profile')}
        />
      )}

      {screen === 'app' && profile && (
        <AppShell
          activeTab={activeTab}
          profile={profile}
          selectedCandidate={selectedCandidate}
          rankedCandidates={rankedCandidates}
          friendCandidates={knownCandidates.filter((candidate) => friendIds.includes(candidate.id))}
          treePosts={treePosts}
          chatMessages={chatMessages}
          friendIds={friendIds}
          themeKey={themeKey}
          customAccent={customAccent}
          setActiveTab={setActiveTab}
          setSelectedCandidateId={setSelectedCandidateId}
          setTreePosts={setTreePosts}
          setThemeKey={setThemeKey}
          setCustomAccent={setCustomAccent}
          onCreateTreePost={publishTreePost}
          onCreateArticle={publishArticle}
          onSendMessage={sendRemoteMessage}
          onAddFriend={addFriend}
          onSearchFriends={searchFriends}
          onCheckUpdate={checkForUpdate}
          onSubmitIdentity={submitRealIdentity}
          onReset={resetDemo}
          onRetake={() => {
            setQuestionIndex(0)
            setAnswers({})
            setScreen('assessment')
          }}
          onToast={showToast}
        />
      )}

      {toast && <div className="toast">{toast}</div>}
    </div>
  )
}

function WelcomeScreen({
  authMode,
  draft,
  setAuthMode,
  setDraft,
  onEnter,
}: {
  authMode: AuthMode
  draft: RegistrationDraft
  setAuthMode: Dispatch<SetStateAction<AuthMode>>
  setDraft: Dispatch<SetStateAction<RegistrationDraft>>
  onEnter: () => Promise<void>
}) {
  return (
    <main className="entry-screen">
      <section className="entry-panel" aria-label="镜屿邮箱登录">
        <div className="entry-mark">
          <span>镜屿</span>
        </div>
        <div className="entry-lines" aria-hidden="true">
          <i />
          <i />
          <i />
        </div>
        <h1>寻找世界上另一个自己</h1>

        <div className="entry-login">
          <div className="auth-switch" role="tablist" aria-label="登录方式">
            <button className={authMode === 'login' ? 'active' : ''} onClick={() => setAuthMode('login')}>
              登录
            </button>
            <button className={authMode === 'register' ? 'active' : ''} onClick={() => setAuthMode('register')}>
              注册
            </button>
          </div>
          <label>
            <span>邮箱</span>
            <input
              value={draft.email ?? ''}
              onChange={(event) => setDraft((current) => ({ ...current, email: event.target.value }))}
              placeholder="2805051912@qq.com"
              type="email"
              autoComplete="email"
            />
          </label>

          {authMode === 'register' && (
            <label>
              <span>邀请码</span>
              <input
                value={draft.inviteCode}
                onChange={(event) => setDraft((current) => ({ ...current, inviteCode: event.target.value.toUpperCase() }))}
                placeholder="JINGYU2026"
                autoComplete="one-time-code"
              />
            </label>
          )}
          <label>
            <span>密码</span>
            <input
              value={draft.password}
              onChange={(event) => setDraft((current) => ({ ...current, password: event.target.value }))}
              placeholder={authMode === 'register' ? '设置登录密码' : '输入登录密码'}
              type="password"
              autoComplete={authMode === 'register' ? 'new-password' : 'current-password'}
            />
          </label>
          {authMode === 'register' && (
            <label>
              <span>确认密码</span>
              <input
                value={draft.confirmPassword}
                onChange={(event) => setDraft((current) => ({ ...current, confirmPassword: event.target.value }))}
                placeholder="再输入一次"
                type="password"
                autoComplete="new-password"
              />
            </label>
          )}
          <button className="primary-button full entry-submit" onClick={onEnter}>
            {authMode === 'register' ? '注册并设定资料' : '进入镜屿'}
          </button>
        </div>
      </section>
    </main>
  )
}

function ProfileSetupScreen({
  draft,
  setDraft,
  onBack,
  onContinue,
}: {
  draft: RegistrationDraft
  setDraft: Dispatch<SetStateAction<RegistrationDraft>>
  onBack: () => void
  onContinue: () => Promise<void>
}) {
  return (
    <main className="setup-screen">
      <section className="setup-panel" aria-label="个人信息设定">
        <header className="setup-head">
          <button className="icon-button" onClick={onBack} aria-label="返回邮箱登录">
            <ChevronRight className="back-icon" size={20} />
          </button>
          <span>01 / 02</span>
        </header>

        <div className="setup-title">
          <small>建立你的岛屿坐标</small>
          <h1>先让镜屿认识你</h1>
        </div>

        <div className="setup-form">
          <FieldGroup label="头像">
            <div className="avatar-picker">
              {avatarOptions.map((avatar) => (
                <button
                  key={avatar}
                  type="button"
                  className={draft.avatar === avatar ? 'avatar-choice active' : 'avatar-choice'}
                  onClick={() => setDraft((current) => ({ ...current, avatar }))}
                  aria-label={`选择头像 ${avatar}`}
                >
                  {avatar}
                </button>
              ))}
            </div>
          </FieldGroup>

          <label>
            <span>昵称</span>
            <input
              value={draft.nickname}
              onChange={(event) => setDraft((current) => ({ ...current, nickname: event.target.value }))}
              placeholder="例如：山海"
            />
          </label>
          <label>
            <span>城市</span>
            <input
              value={draft.city}
              onChange={(event) => setDraft((current) => ({ ...current, city: event.target.value }))}
              placeholder="上海"
            />
          </label>
          <FieldGroup label="当前关系目的">
            <SegmentedControl
              value={draft.goal}
              options={['亲密关系', '深度朋友', '成长伙伴']}
              onChange={(value) => setDraft((current) => ({ ...current, goal: value as RelationGoal }))}
            />
          </FieldGroup>

          <label className="check-line">
            <input
              type="checkbox"
              checked={draft.ageConfirmed}
              onChange={(event) => setDraft((current) => ({ ...current, ageConfirmed: event.target.checked }))}
            />
            我已年满 18 周岁
          </label>
          <label className="check-line">
            <input
              type="checkbox"
              checked={draft.agreement}
              onChange={(event) => setDraft((current) => ({ ...current, agreement: event.target.checked }))}
            />
            已阅读并同意《用户协议》《隐私政策》
          </label>
        </div>

        <button className="primary-button full setup-submit" onClick={onContinue}>
          开始心理测评
        </button>
      </section>
    </main>
  )
}

function AssessmentScreen({
  answers,
  draft,
  questionIndex,
  setAnswers,
  setQuestionIndex,
  onFinish,
  onBack,
}: {
  answers: Record<string, string>
  draft: RegistrationDraft
  questionIndex: number
  setAnswers: Dispatch<SetStateAction<Record<string, string>>>
  setQuestionIndex: Dispatch<SetStateAction<number>>
  onFinish: (answers: Record<string, string>) => void
  onBack: () => void
}) {
  const question = assessmentQuestions[Math.min(questionIndex, assessmentQuestions.length - 1)]
  const answeredCount = Object.keys(answers).length
  const progress = Math.round((answeredCount / assessmentQuestions.length) * 100)
  const swipeStart = useRef<{ x: number; y: number } | null>(null)

  const chooseOption = (optionId: string) => {
    const nextAnswers = { ...answers, [question.id]: optionId }
    setAnswers(nextAnswers)
    if (questionIndex >= assessmentQuestions.length - 1) {
      onFinish(nextAnswers)
      return
    }
    setQuestionIndex((current) => current + 1)
  }

  const skipQuestion = () => {
    if (questionIndex >= assessmentQuestions.length - 1) {
      onFinish(answers)
      return
    }
    setQuestionIndex((current) => current + 1)
  }

  const goPreviousQuestion = () => {
    if (questionIndex <= 0) {
      onBack()
      return
    }
    setQuestionIndex((current) => Math.max(0, current - 1))
  }

  const handleTouchStart = (event: TouchEvent<HTMLElement>) => {
    const touch = event.changedTouches[0]
    swipeStart.current = { x: touch.clientX, y: touch.clientY }
  }

  const handleTouchMove = (event: TouchEvent<HTMLElement>) => {
    const start = swipeStart.current
    if (!start) return
    const touch = event.changedTouches[0]
    const deltaX = touch.clientX - start.x
    const deltaY = touch.clientY - start.y
    if (Math.abs(deltaX) > 18 && Math.abs(deltaX) > Math.abs(deltaY)) event.preventDefault()
  }

  const handleTouchEnd = (event: TouchEvent<HTMLElement>) => {
    const start = swipeStart.current
    swipeStart.current = null
    if (!start) return
    const touch = event.changedTouches[0]
    const deltaX = touch.clientX - start.x
    const deltaY = touch.clientY - start.y
    if (Math.abs(deltaX) < 34 || Math.abs(deltaX) < Math.abs(deltaY) * 0.8) return
    if (deltaX < 0) skipQuestion()
    else goPreviousQuestion()
  }

  return (
    <main className="assessment-layout">
      <section
        className="device-panel assessment-panel"
        onTouchStart={handleTouchStart}
        onTouchMove={handleTouchMove}
        onTouchEnd={handleTouchEnd}
      >
        <div className="screen-head">
          <button className="icon-button" onClick={onBack} aria-label="返回">
            <ChevronRight className="back-icon" size={22} />
          </button>
          <AvatarMark label={draft.avatar || draft.nickname || '你'} />
        </div>

        <div className="assessment-title">
          <span className="eyebrow">
            <ShieldCheck size={16} />
            初见心谱
          </span>
          <h1>
            {String(questionIndex + 1).padStart(2, '0')} <span>/ {assessmentQuestions.length}</span>
          </h1>
          <p>{question.subtitle}</p>
        </div>

        <div className="question-card">
          <span className="question-construct">{question.construct}</span>
          <h2>{question.title}</h2>
          <div className="option-grid">
            {question.options.map((option) => (
              <button key={option.id} className={`option-card ${option.tone}`} onClick={() => chooseOption(option.id)}>
                <option.icon size={25} />
                <strong>{option.title}</strong>
                <span>{option.subtitle}</span>
              </button>
            ))}
          </div>
        </div>

        <div className="assessment-actions">
          <button className="ghost-button" onClick={skipQuestion}>
            跳过
          </button>
          <button className="primary-button" onClick={skipQuestion}>
            {questionIndex >= assessmentQuestions.length - 1 ? '生成心谱' : '下一题'}
          </button>
        </div>

        <div className="progress-note">
          <Leaf size={17} />
          <span>画像正在建立 · {progress}%</span>
        </div>
      </section>
    </main>
  )
}

function AppShell({
  activeTab,
  profile,
  selectedCandidate,
  rankedCandidates,
  friendCandidates,
  treePosts,
  chatMessages,
  friendIds,
  themeKey,
  customAccent,
  setActiveTab,
  setSelectedCandidateId,
  setTreePosts,
  setThemeKey,
  setCustomAccent,
  onCreateTreePost,
  onCreateArticle,
  onSendMessage,
  onAddFriend,
  onSearchFriends,
  onCheckUpdate,
  onSubmitIdentity,
  onReset,
  onRetake,
  onToast,
}: {
  activeTab: TabKey
  profile: Profile
  selectedCandidate: Candidate & { liveScore: number }
  rankedCandidates: Array<Candidate & { liveScore: number }>
  friendCandidates: Array<Candidate & { liveScore: number }>
  treePosts: TreePost[]
  chatMessages: ChatMessage[]
  friendIds: string[]
  themeKey: ThemeKey
  customAccent: string
  setActiveTab: Dispatch<SetStateAction<TabKey>>
  setSelectedCandidateId: Dispatch<SetStateAction<string>>
  setTreePosts: Dispatch<SetStateAction<TreePost[]>>
  setThemeKey: Dispatch<SetStateAction<ThemeKey>>
  setCustomAccent: Dispatch<SetStateAction<string>>
  onCreateTreePost: (content: string, visibility: PrivacyLevel, tags: string[]) => Promise<void>
  onCreateArticle: (title: string, content: string) => Promise<void>
  onSendMessage: (candidateId: string, content: string) => Promise<void>
  onAddFriend: (candidateId: string) => Promise<void>
  onSearchFriends: (query: string) => Promise<Array<Candidate & { liveScore: number }>>
  onCheckUpdate: () => Promise<void>
  onSubmitIdentity: (realName: string, idNumber: string) => Promise<void>
  onReset: () => void
  onRetake: () => void
  onToast: (message: string) => void
}) {
  const [showGraph, setShowGraph] = useState(false)
  const [growthPanel, setGrowthPanel] = useState<GrowthPanel>('home')
  const [savedReportIds, setSavedReportIds] = useStoredState<string[]>('mirror-isle:saved-reports', [])
  const [plannedPracticeIds, setPlannedPracticeIds] = useStoredState<string[]>('mirror-isle:planned-practices', [])
  const swipeStart = useRef<{ x: number; y: number } | null>(null)
  const activeIndex = Math.max(0, tabOrder.indexOf(activeTab))

  useEffect(() => {
    setShowGraph(false)
  }, [activeTab])

  const toggleSavedReport = (candidateId: string) => {
    const isSaved = savedReportIds.includes(candidateId)
    setSavedReportIds(isSaved ? savedReportIds.filter((id) => id !== candidateId) : [...savedReportIds, candidateId])
    onToast(isSaved ? '已取消收藏' : '关系报告已收藏')
  }

  const togglePractice = (practiceId: string) => {
    const isPlanned = plannedPracticeIds.includes(practiceId)
    setPlannedPracticeIds(
      isPlanned ? plannedPracticeIds.filter((id) => id !== practiceId) : [...plannedPracticeIds, practiceId],
    )
    onToast(isPlanned ? '已从今日计划移除' : '已加入今日计划')
  }

  const goToTabOffset = (offset: number) => {
    const nextIndex = clamp(activeIndex + offset, 0, tabOrder.length - 1)
    if (nextIndex !== activeIndex) {
      setActiveTab(tabOrder[nextIndex])
    }
  }

  const handleTouchStart = (event: TouchEvent<HTMLDivElement>) => {
    const touch = event.changedTouches[0]
    swipeStart.current = { x: touch.clientX, y: touch.clientY }
  }

  const handleTouchMove = (event: TouchEvent<HTMLDivElement>) => {
    const start = swipeStart.current
    if (!start || showGraph) return
    const touch = event.changedTouches[0]
    const deltaX = touch.clientX - start.x
    const deltaY = touch.clientY - start.y
    if (Math.abs(deltaX) > 18 && Math.abs(deltaX) > Math.abs(deltaY)) event.preventDefault()
  }

  const handleTouchEnd = (event: TouchEvent<HTMLDivElement>) => {
    const start = swipeStart.current
    swipeStart.current = null
    if (!start || showGraph) return
    const touch = event.changedTouches[0]
    const deltaX = touch.clientX - start.x
    const deltaY = touch.clientY - start.y
    if (Math.abs(deltaX) < 34 || Math.abs(deltaX) < Math.abs(deltaY) * 0.8) return
    goToTabOffset(deltaX < 0 ? 1 : -1)
  }

  return (
    <main className="product-layout">
      <aside className="product-brief">
        <span className="eyebrow">
          <CircleCheck size={16} />
          可运行 MVP
        </span>
        <h2>内测登录、心谱、树洞和消息已接入后端</h2>
        <p>
          当前版本不再使用手机验证码和离线假登录，内测用户登录同一后端后即可发帖、收消息和更新成长记录。
        </p>
        <div className="brief-preview">
          <img src={assetUrl('assets/mirror/relationship-map.png')} alt="关系图谱预览" />
        </div>
      </aside>

      <section className="device-panel app-panel">
        <div className="screen-head">
          <div>
            <strong>镜屿</strong>
            <small>{profile.goal} · {profile.city}</small>
          </div>
          <AvatarMark label={profile.avatar || profile.nickname} />
        </div>

        <div className="device-content" onTouchStart={handleTouchStart} onTouchMove={handleTouchMove} onTouchEnd={handleTouchEnd}>
          {showGraph && (
            <RelationshipGraph
              profile={profile}
              candidate={selectedCandidate}
              isSaved={savedReportIds.includes(selectedCandidate.id)}
              isFriend={friendIds.includes(selectedCandidate.id)}
              onBack={() => setShowGraph(false)}
              onChat={() => {
                setShowGraph(false)
                setActiveTab('messages')
              }}
              onAddFriend={() => {
                setShowGraph(false)
                void onAddFriend(selectedCandidate.id)
              }}
              onToggleSave={() => toggleSavedReport(selectedCandidate.id)}
            />
          )}

          {!showGraph && (
            <div className="swipe-track" style={{ transform: `translateX(-${activeIndex * 100}%)` }}>
              <section className="swipe-pane" aria-hidden={activeTab !== 'meet'}>
                <MeetPage
                  profile={profile}
                  candidates={rankedCandidates}
                  selectedCandidateId={selectedCandidate.id}
                  friendIds={friendIds}
                  onSelect={(candidateId) => {
                    setSelectedCandidateId(candidateId)
                    setShowGraph(true)
                  }}
                  onAddFriend={onAddFriend}
                  onChat={(candidateId) => {
                    setSelectedCandidateId(candidateId)
                    setActiveTab('messages')
                  }}
                />
              </section>
              <section className="swipe-pane" aria-hidden={activeTab !== 'tree'}>
                <TreePage profile={profile} posts={treePosts} setPosts={setTreePosts} onCreatePost={onCreateTreePost} onToast={onToast} />
              </section>
              <section className="swipe-pane" aria-hidden={activeTab !== 'growth'}>
                <GrowthPage
                  profile={profile}
                  candidates={rankedCandidates}
                  posts={treePosts}
                  activePanel={growthPanel}
                  plannedPracticeIds={plannedPracticeIds}
                  onOpenPanel={setGrowthPanel}
                  onTogglePractice={togglePractice}
                  onCreateArticle={onCreateArticle}
                  onOpenCandidate={(candidateId) => {
                    setSelectedCandidateId(candidateId)
                    setShowGraph(true)
                  }}
                  onToast={onToast}
                />
              </section>
              <section className="swipe-pane" aria-hidden={activeTab !== 'messages'}>
                <MessagesPage
                  candidate={selectedCandidate}
                  friends={friendCandidates}
                  messages={chatMessages}
                  onSelectFriend={(candidateId) => setSelectedCandidateId(candidateId)}
                  onAddFriend={onAddFriend}
                  onSearchFriends={onSearchFriends}
                  onSendMessage={onSendMessage}
                  onOpenGraph={() => setShowGraph(true)}
                />
              </section>
              <section className="swipe-pane" aria-hidden={activeTab !== 'me'}>
                <MePage
                  profile={profile}
                  savedCandidates={rankedCandidates.filter((candidate) => savedReportIds.includes(candidate.id))}
                  friendCandidates={friendCandidates}
                  plannedPracticeCount={plannedPracticeIds.length}
                  themeKey={themeKey}
                  customAccent={customAccent}
                  onOpenTab={setActiveTab}
                  onThemeChange={setThemeKey}
                  onCustomAccentChange={setCustomAccent}
                  onReset={onReset}
                  onRetake={onRetake}
                  onCheckUpdate={onCheckUpdate}
                  onSubmitIdentity={onSubmitIdentity}
                  onToast={onToast}
                />
              </section>
            </div>
          )}
        </div>

        {!showGraph && (
          <nav className="bottom-tabs" aria-label="镜屿导航">
            {navItems.map(({ key, label, icon: Icon }) => (
              <button
                key={key}
                className={activeTab === key ? 'active' : ''}
                onClick={() => setActiveTab(key)}
              >
                <Icon size={21} />
                <span>{label}</span>
              </button>
            ))}
          </nav>
        )}
      </section>
    </main>
  )
}

function MeetPage({
  profile,
  candidates,
  selectedCandidateId,
  friendIds,
  onSelect,
  onAddFriend,
  onChat,
}: {
  profile: Profile
  candidates: Array<Candidate & { liveScore: number }>
  selectedCandidateId: string
  friendIds: string[]
  onSelect: (candidateId: string) => void
  onAddFriend: (candidateId: string) => Promise<void>
  onChat: (candidateId: string) => void
}) {
  return (
    <div className="page-stack">
      <section className="hero-card compact">
        <span className="eyebrow">今晚，想认识怎样的人？</span>
        <h1>基于心谱的 3 位推荐</h1>
        <div className="intent-row">
          <span>安静同频</span>
          <span>深度交流</span>
          <span>和我很像</span>
          <span>不同世界</span>
        </div>
      </section>

      <SectionTitle title="今日 3 位推荐" icon={Sparkles} action="有限推荐" />
      <div className="candidate-list">
        {candidates.map((candidate) => {
          const isFriend = friendIds.includes(candidate.id)
          return (
            <article
              key={candidate.id}
              className={candidate.id === selectedCandidateId ? 'candidate-card active' : 'candidate-card'}
            >
              <button className="candidate-card-main" onClick={() => onSelect(candidate.id)}>
                <AvatarMark label={candidate.avatar} size="large" />
                <div className="candidate-main">
                  <div className="candidate-title">
                    <strong>
                      {candidate.name} · {candidate.age} · {candidate.city}
                    </strong>
                    <span>{candidate.liveScore}%</span>
                  </div>
                  <div className="tag-row">
                    <span>{candidate.type}</span>
                    {candidate.tags.slice(0, 2).map((tag, index) => (
                      <span key={`${tag}-${index}`}>{tag}</span>
                    ))}
                  </div>
                  <p>{candidate.intro}</p>
                  <small>查看关系图谱</small>
                </div>
              </button>
              <div className="candidate-actions">
                <button className="secondary-button" onClick={() => void onAddFriend(candidate.id)}>
                  <Users size={16} />
                  {isFriend ? '已是好友' : '添加好友'}
                </button>
                <button
                  className="primary-button"
                  onClick={() => {
                    if (isFriend) {
                      onChat(candidate.id)
                    } else {
                      void onAddFriend(candidate.id)
                    }
                  }}
                >
                  <MessageCircle size={16} />
                  {isFriend ? '发消息' : '添加并聊天'}
                </button>
              </div>
            </article>
          )
        })}
      </div>

      <section className="life-question">
        <span>今日人生问题</span>
        <h2>如果有一天你不再害怕失败，你最想尝试什么？</h2>
        <p>你对自己的好奇，就是成长的开始。</p>
      </section>

      <section className="trust-note">
        <CircleAlert size={18} />
        <p>
          兼容指数是镜屿根据当前资料计算的排序指标，不代表关系成功概率，也不构成心理诊断或专业咨询建议。
        </p>
      </section>

      <ProfileSnapshot profile={profile} />
    </div>
  )
}

function RelationshipGraph({
  profile,
  candidate,
  isSaved,
  isFriend,
  onBack,
  onChat,
  onAddFriend,
  onToggleSave,
}: {
  profile: Profile
  candidate: Candidate & { liveScore: number }
  isSaved: boolean
  isFriend: boolean
  onBack: () => void
  onChat: () => void
  onAddFriend: () => void
  onToggleSave: () => void
}) {
  return (
    <div className="graph-page">
      <div className="screen-head graph-head">
        <button className="icon-button" onClick={onBack} aria-label="返回遇见">
          <ChevronRight className="back-icon" size={22} />
        </button>
        <div>
          <strong>关系图谱</strong>
          <small>你 × {candidate.name}</small>
        </div>
        <button className={isSaved ? 'icon-button active' : 'icon-button'} onClick={onToggleSave} aria-label="收藏关系报告">
          <Bookmark size={20} fill={isSaved ? 'currentColor' : 'none'} />
        </button>
      </div>

      <div className="pair-row">
        <PersonBadge label={profile.nickname} sub={`${profile.city} · ${profile.goal}`} />
        <PersonBadge label={candidate.name} sub={`${candidate.type} · ${candidate.city}`} />
      </div>

      <div className="graph-actions graph-actions-top">
        <button className="secondary-button full" onClick={onAddFriend}>
          <Users size={18} />
          {isFriend ? '已是朋友' : '加为朋友'}
        </button>
        <button className="primary-button full" onClick={onChat}>
          <MessageCircle size={18} />
          开始对话
        </button>
      </div>

      <RelationRadar profile={profile} candidate={candidate} />

      <div className="graph-columns">
        <InsightCard title="你们相似的地方" icon={Leaf} items={candidate.similar} tone="sage" />
        <InsightCard title="有趣的不同" icon={Sparkles} items={candidate.different} tone="blue" />
        <InsightCard title="可能的摩擦" icon={CircleAlert} items={candidate.friction} tone="violet" />
      </div>

      <section className="opener-card">
        <span>第一次相遇</span>
        {candidate.openers.map((opener, index) => (
          <button key={`${opener}-${index}`} onClick={onChat}>
            <MessageCircle size={16} />
            {opener}
          </button>
        ))}
      </section>

      <div className="graph-actions">
        <button className="secondary-button full" onClick={onAddFriend}>
          <Users size={18} />
          {isFriend ? '已是朋友' : '加为朋友'}
        </button>
        <button className="primary-button full" onClick={onChat}>
          <MessageCircle size={18} />
          开始对话
        </button>
        <button className="ghost-button full" onClick={onToggleSave}>
          <Star size={18} fill={isSaved ? 'currentColor' : 'none'} />
          {isSaved ? '取消收藏' : '收藏关系报告'}
        </button>
      </div>
    </div>
  )
}

function TreePage({
  profile,
  posts,
  setPosts,
  onCreatePost,
  onToast,
}: {
  profile: Profile
  posts: TreePost[]
  setPosts: Dispatch<SetStateAction<TreePost[]>>
  onCreatePost: (content: string, visibility: PrivacyLevel, tags: string[]) => Promise<void>
  onToast: (message: string) => void
}) {
  const [visibility, setVisibility] = useState<PrivacyLevel>(profile.privacy)
  const [draft, setDraft] = useState('')

  const publishPost = async () => {
    if (!draft.trim()) return
    await onCreatePost(draft.trim(), visibility, ['此刻', visibilityLabel(visibility)])
    setDraft('')
    onToast('树洞已记录')
  }

  const react = (postId: string, key: 'resonance' | 'hugs' | 'experienced' | 'chats') => {
    setPosts((current) => current.map((post) => (post.id === postId ? { ...post, [key]: post[key] + 1 } : post)))
  }

  return (
    <div className="page-stack">
      <section className="hero-card compact">
        <span className="eyebrow">树洞</span>
        <h1>写下这一刻的心情</h1>
        <SegmentedControl
          value={visibility}
          options={[
            { label: '私密', value: 'private' },
            { label: '好友', value: 'friends' },
            { label: '广场', value: 'public' },
          ]}
          onChange={(value) => setVisibility(value as PrivacyLevel)}
        />
        <textarea
          className="tree-input"
          value={draft}
          onChange={(event) => setDraft(event.target.value)}
          placeholder="写下这一刻的心情..."
        />
        <button className="primary-button full" onClick={publishPost}>
          <Plus size={18} />
          写一写
        </button>
      </section>

      {posts.map((post) => (
        <article key={post.id} className="tree-post">
          <header>
            <AvatarMark label={post.author} />
            <div>
              <strong>{post.author}</strong>
              <small>{post.time} · {visibilityLabel(post.visibility)}</small>
            </div>
          </header>
          <p>{post.content}</p>
          <div className="tag-row">
            {post.tags.map((tag, index) => (
              <span key={`${tag}-${index}`}>{tag}</span>
            ))}
          </div>
          <div className="reaction-row">
            <button onClick={() => react(post.id, 'resonance')}>共鸣 {post.resonance}</button>
            <button onClick={() => react(post.id, 'hugs')}>抱抱 {post.hugs}</button>
            <button onClick={() => react(post.id, 'experienced')}>我也经历过 {post.experienced}</button>
            <button onClick={() => react(post.id, 'chats')}>想聊聊 {post.chats}</button>
          </div>
        </article>
      ))}
    </div>
  )
}

function GrowthPage({
  profile,
  candidates,
  posts,
  activePanel,
  plannedPracticeIds,
  onOpenPanel,
  onTogglePractice,
  onCreateArticle,
  onOpenCandidate,
  onToast,
}: {
  profile: Profile
  candidates: Array<Candidate & { liveScore: number }>
  posts: TreePost[]
  activePanel: GrowthPanel
  plannedPracticeIds: string[]
  onOpenPanel: (panel: GrowthPanel) => void
  onTogglePractice: (practiceId: string) => void
  onCreateArticle: (title: string, content: string) => Promise<void>
  onOpenCandidate: (candidateId: string) => void
  onToast: (message: string) => void
}) {
  const topAnchor = profile.traits.anchors[0] ?? '边界练习者'
  const [fellowOffset, setFellowOffset] = useStoredState('mirror-isle:fellow-offset', 0)
  const [discussionDraft, setDiscussionDraft] = useState('')
  const [discussionReplies, setDiscussionReplies] = useStoredState<string[]>('mirror-isle:growth-discussion', [])
  const [articleTitleDraft, setArticleTitleDraft] = useState('')
  const [articleBodyDraft, setArticleBodyDraft] = useState('')
  const articlePosts = posts.filter(isArticlePost)
  const readingCards = articlePosts.length
    ? articlePosts.slice(0, 3).map((post) => ({ title: articleTitle(post), meta: `${post.author} · ${post.time}`, brief: articlePreview(post) }))
    : readingItems
  const visibleFellows = candidates.length
    ? [...candidates.slice(fellowOffset), ...candidates.slice(0, fellowOffset)].slice(0, 2)
    : []

  const rotateFellows = () => {
    setFellowOffset(candidates.length ? (fellowOffset + 2) % candidates.length : 0)
    onToast('已换一批同路人')
  }

  const publishDiscussion = () => {
    if (!discussionDraft.trim()) return
    setDiscussionReplies([discussionDraft.trim(), ...discussionReplies].slice(0, 12))
    setDiscussionDraft('')
    onToast('讨论已发布')
  }

  const publishArticle = async () => {
    await onCreateArticle(articleTitleDraft, articleBodyDraft)
    setArticleTitleDraft('')
    setArticleBodyDraft('')
  }

  if (activePanel !== 'home') {
    return (
      <div className="page-stack growth-detail">
        <div className="subpage-head">
          <button className="icon-button" onClick={() => onOpenPanel('home')} aria-label="返回成长">
            <ChevronRight className="back-icon" size={22} />
          </button>
          <div>
            <strong>{growthPanelTitle(activePanel)}</strong>
            <small>把成长落到今天能做的一步</small>
          </div>
        </div>

        {activePanel === 'path' && (
          <>
            <section className="detail-card">
              <span className="eyebrow">本周路径</span>
              <h2>{topAnchor.includes('边界') ? '先照顾边界，再靠近关系' : '先真实表达，再等待回应'}</h2>
              <p>你的心谱置信度为 {profile.traits.confidence}%，适合从小而清楚的表达开始。</p>
            </section>
            <ProfileSnapshot profile={profile} />
          </>
        )}

        {activePanel === 'reading' && (
          <>
            <section className="detail-card article-composer">
              <span className="eyebrow">创作文章</span>
              <input
                value={articleTitleDraft}
                onChange={(event) => setArticleTitleDraft(event.target.value)}
                placeholder="标题"
              />
              <textarea
                value={articleBodyDraft}
                onChange={(event) => setArticleBodyDraft(event.target.value)}
                placeholder="写一段你真正想留下的话..."
              />
              <button className="primary-button full" onClick={publishArticle}>
                发布文章
              </button>
            </section>
            <div className="detail-list">
              {readingCards.map((item) => (
                <article className="detail-item" key={`${item.title}-${item.meta}`}>
                  <BookOpen size={18} />
                  <div>
                    <strong>{item.title}</strong>
                    <small>{item.meta}</small>
                    <p>{item.brief}</p>
                  </div>
                </article>
              ))}
            </div>
          </>
        )}

        {activePanel === 'practice' && (
          <div className="detail-list">
            {practiceItems.map((item) => {
              const planned = plannedPracticeIds.includes(item.id)
              return (
                <button
                  className={planned ? 'detail-item active' : 'detail-item'}
                  key={item.id}
                  onClick={() => onTogglePractice(item.id)}
                >
                  <Leaf size={18} />
                  <div>
                    <strong>{item.title}</strong>
                    <small>{planned ? '已在今日计划' : item.duration}</small>
                    <p>{item.detail}</p>
                  </div>
                  <CircleCheck size={18} />
                </button>
              )
            })}
          </div>
        )}

        {activePanel === 'discussion' && (
          <>
            <section className="detail-card">
              <span className="eyebrow">同题讨论</span>
              <h2>拒绝别人时，你最担心失去什么？</h2>
              <label className="inline-compose">
                <textarea
                  value={discussionDraft}
                  onChange={(event) => setDiscussionDraft(event.target.value)}
                  placeholder="写下你的真实想法..."
                />
                <button className="primary-button" onClick={publishDiscussion}>
                  发布
                </button>
              </label>
            </section>
            <div className="mini-feed">
              {discussionReplies.length ? (
                discussionReplies.map((reply, index) => <p key={`${reply}-${index}`}>{reply}</p>)
              ) : (
                <p>还没有本机讨论记录，写下第一条想法。</p>
              )}
            </div>
          </>
        )}

        {activePanel === 'fellows' && (
          <div className="candidate-list compact-list">
            {candidates.map((candidate) => (
              <button className="candidate-card" key={candidate.id} onClick={() => onOpenCandidate(candidate.id)}>
                <AvatarMark label={candidate.avatar} />
                <div className="candidate-main">
                  <div className="candidate-title">
                    <strong>{candidate.name}</strong>
                    <span>{candidate.liveScore}%</span>
                  </div>
                  <p>{candidate.intro}</p>
                </div>
              </button>
            ))}
          </div>
        )}
      </div>
    )
  }

  return (
    <div className="page-stack">
      <section className="growth-hero">
        <span>本周成长主题：{topAnchor.includes('边界') ? '边界感' : '真实表达'}</span>
        <h1>今天，继续成为更好的自己</h1>
        <div className="progress-line">
          <i style={{ width: `${profile.traits.confidence}%` }} />
        </div>
        <button className="ghost-button" onClick={() => onOpenPanel('path')}>
          查看成长路径
          <ChevronRight size={17} />
        </button>
      </section>

      <SectionTitle title="推荐阅读" icon={BookOpen} action="查看全部" onAction={() => onOpenPanel('reading')} />
      <div className="reading-row">
        {readingCards.map((item, index) => (
          <article key={item.title} className={`reading-card tone-${index + 1}`} onClick={() => onOpenPanel('reading')}>
            <strong>{item.title}</strong>
            <span>{item.meta}</span>
          </article>
        ))}
      </div>

      <SectionTitle title="认知练习" icon={Leaf} />
      <button className="practice-card" onClick={() => onOpenPanel('practice')}>
        <Leaf size={24} />
        <div>
          <strong>{practiceItems[0].title}</strong>
          <span>{plannedPracticeIds.length ? `今日已加入 ${plannedPracticeIds.length} 个练习` : practiceItems[0].detail}</span>
        </div>
        <small>{practiceItems[0].duration}</small>
      </button>

      <SectionTitle title="同题讨论" icon={MessageCircle} />
      <button className="discussion-card" onClick={() => onOpenPanel('discussion')}>
        <span>“拒绝别人时，你最担心失去什么？”</span>
        <small>{discussionReplies.length ? `${discussionReplies.length} 条本机讨论` : '进入讨论'}</small>
      </button>

      <SectionTitle title="与你同路的人" icon={Users} action="换一批" onAction={rotateFellows} />
      <div className="fellow-row">
        {visibleFellows.map((candidate) => (
          <button key={candidate.id} className="fellow-card" onClick={() => onOpenCandidate(candidate.id)}>
            <AvatarMark label={candidate.avatar} />
            <strong>{candidate.name}</strong>
            <span>{candidate.tags[0]}</span>
          </button>
        ))}
      </div>
    </div>
  )
}

function MessagesPage({
  candidate,
  friends,
  messages,
  onSelectFriend,
  onAddFriend,
  onSearchFriends,
  onSendMessage,
  onOpenGraph,
}: {
  candidate: Candidate & { liveScore: number }
  friends: Array<Candidate & { liveScore: number }>
  messages: ChatMessage[]
  onSelectFriend: (candidateId: string) => void
  onAddFriend: (candidateId: string) => Promise<void>
  onSearchFriends: (query: string) => Promise<Array<Candidate & { liveScore: number }>>
  onSendMessage: (candidateId: string, content: string) => Promise<void>
  onOpenGraph: () => void
}) {
  const [draft, setDraft] = useState('')
  const [query, setQuery] = useState('')
  const [results, setResults] = useState<Array<Candidate & { liveScore: number }>>([])
  const [isSearching, setIsSearching] = useState(false)

  const sendMessage = async () => {
    if (!draft.trim()) return
    const content = draft.trim()
    await onSendMessage(candidate.id, content)
    setDraft('')
  }

  const search = async () => {
    if (!query.trim()) {
      setResults([])
      return
    }
    setIsSearching(true)
    try {
      const found = await onSearchFriends(query.trim())
      setResults(found)
    } finally {
      setIsSearching(false)
    }
  }

  return (
    <div className="messages-page">
      <section className="conversation-panel">
        <div className="conversation-title">
          <strong>好友 / 会话</strong>
          <span>{friends.length} 位</span>
        </div>
        <label className="friend-search">
          <input
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === 'Enter') void search()
            }}
            placeholder="QQ邮箱或用户ID"
          />
          <button onClick={() => void search()} disabled={isSearching}>
            {isSearching ? '搜索中' : '搜索'}
          </button>
        </label>

        {results.length > 0 && (
          <div className="search-result-list">
            {results.map((item) => (
              <article className="friend-row" key={item.id}>
                <AvatarMark label={item.avatar} />
                <button type="button" onClick={() => onSelectFriend(item.id)}>
                  <strong>{item.name}</strong>
                  <small>{item.city} · {item.liveScore}%</small>
                </button>
                <button className="mini-action" onClick={() => void onAddFriend(item.id)}>
                  添加
                </button>
              </article>
            ))}
          </div>
        )}

        <div className="friend-list">
          {friends.length ? (
            friends.map((friend) => (
              <button
                key={friend.id}
                className={friend.id === candidate.id ? 'friend-row active' : 'friend-row'}
                onClick={() => onSelectFriend(friend.id)}
              >
                <AvatarMark label={friend.avatar} />
                <span>
                  <strong>{friend.name}</strong>
                  <small>{friend.city} · {friend.liveScore}%</small>
                </span>
              </button>
            ))
          ) : (
            <div className="compact-empty">搜索 QQ 邮箱或用户 ID 添加好友</div>
          )}
        </div>
      </section>

      <section className="chat-page">
        <header className="chat-head">
          <AvatarMark label={candidate.avatar} />
          <div>
            <strong>{candidate.name}</strong>
            <small>{candidate.liveScore}% 契合</small>
          </div>
          <button className="ghost-button" onClick={onOpenGraph}>
            图谱
          </button>
        </header>

        <div className="message-list">
          {messages.map((message) => (
            <div key={message.id} className={message.from === 'me' ? 'message mine' : 'message'}>
              {message.text}
            </div>
          ))}
        </div>

        <label className="chat-input">
          <input
            value={draft}
            onChange={(event) => setDraft(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === 'Enter') sendMessage()
            }}
            placeholder="输入消息"
          />
          <button onClick={sendMessage} aria-label="发送消息">
            <Send size={18} />
          </button>
        </label>
      </section>
    </div>
  )
}

function MePage({
  profile,
  savedCandidates,
  friendCandidates,
  plannedPracticeCount,
  themeKey,
  customAccent,
  onOpenTab,
  onThemeChange,
  onCustomAccentChange,
  onReset,
  onRetake,
  onCheckUpdate,
  onSubmitIdentity,
  onToast,
}: {
  profile: Profile
  savedCandidates: Array<Candidate & { liveScore: number }>
  friendCandidates: Array<Candidate & { liveScore: number }>
  plannedPracticeCount: number
  themeKey: ThemeKey
  customAccent: string
  onOpenTab: Dispatch<SetStateAction<TabKey>>
  onThemeChange: Dispatch<SetStateAction<ThemeKey>>
  onCustomAccentChange: Dispatch<SetStateAction<string>>
  onReset: () => void
  onRetake: () => void
  onCheckUpdate: () => Promise<void>
  onSubmitIdentity: (realName: string, idNumber: string) => Promise<void>
  onToast: (message: string) => void
}) {
  const [realName, setRealName] = useState('')
  const [idNumber, setIdNumber] = useState('')
  const [panel, setPanel] = useState<MePanel>('home')
  const [privacySettings, setPrivacySettings] = useStoredState('mirror-isle:privacy-settings', {
    profileVisible: true,
    messageNotice: true,
    safeMode: true,
  })
  const copyProfileId = async () => {
    try {
      await navigator.clipboard.writeText(profile.id)
      onToast('用户ID已复制')
    } catch {
      onToast(profile.id)
    }
  }

  if (panel !== 'home') {
    const title = panel === 'saved' ? '我的收藏' : panel === 'privacy' ? '隐私与安全' : '主题外观'
    const subtitle =
      panel === 'saved'
        ? `${savedCandidates.length} 份关系报告 · ${friendCandidates.length} 位朋友`
        : panel === 'privacy'
          ? '本机设置即时生效'
          : '选择镜屿的颜色气质'

    return (
      <div className="page-stack me-detail">
        <div className="subpage-head">
          <button className="icon-button" onClick={() => setPanel('home')} aria-label="返回我的">
            <ChevronRight className="back-icon" size={22} />
          </button>
          <div>
            <strong>{title}</strong>
            <small>{subtitle}</small>
          </div>
        </div>

        {panel === 'saved' && (
          <div className="detail-list">
            {friendCandidates.length > 0 && (
              <section className="detail-card">
                <span className="eyebrow">朋友</span>
                <div className="friend-mini-list">
                  {friendCandidates.map((candidate) => (
                    <span key={candidate.id}>
                      <AvatarMark label={candidate.avatar} />
                      {candidate.name}
                    </span>
                  ))}
                </div>
              </section>
            )}
            {savedCandidates.length ? (
              savedCandidates.map((candidate) => (
                <article className="detail-item" key={candidate.id}>
                  <Bookmark size={18} />
                  <div>
                    <strong>{candidate.name} · {candidate.liveScore}%</strong>
                    <small>{candidate.type} · {candidate.city}</small>
                    <p>{candidate.intro}</p>
                  </div>
                </article>
              ))
            ) : (
              <section className="detail-card">
                <h2>还没有收藏</h2>
                <p>在关系图谱里点击星标，就会保存到这里。</p>
              </section>
            )}
          </div>
        )}

        {panel === 'privacy' && (
          <section className="settings-card">
            <ToggleRow
              title="公开我的基础画像"
              text="关闭后，本机将标记为更低曝光。"
              checked={privacySettings.profileVisible}
              onChange={() => setPrivacySettings({ ...privacySettings, profileVisible: !privacySettings.profileVisible })}
            />
            <ToggleRow
              title="消息提醒"
              text="保留新消息提醒入口。"
              checked={privacySettings.messageNotice}
              onChange={() => setPrivacySettings({ ...privacySettings, messageNotice: !privacySettings.messageNotice })}
            />
            <ToggleRow
              title="安全模式"
              text="敏感内容会进入审核状态。"
              checked={privacySettings.safeMode}
              onChange={() => setPrivacySettings({ ...privacySettings, safeMode: !privacySettings.safeMode })}
            />
          </section>
        )}

        {panel === 'theme' && (
          <section className="theme-card">
            <div className="theme-grid">
              {themeOptions.map((item) => (
                <button
                  key={item.key}
                  className={themeKey === item.key ? 'theme-choice active' : 'theme-choice'}
                  onClick={() => onThemeChange(item.key)}
                >
                  <span className="theme-dots">
                    {item.colors.map((color) => (
                      <i key={color} style={{ background: color }} />
                    ))}
                  </span>
                  <strong>{item.label}</strong>
                  <small>{item.hint}</small>
                </button>
              ))}
            </div>
            <label className="color-picker-line">
              <span>自定义主色</span>
              <input
                type="color"
                value={customAccent}
                onChange={(event) => {
                  onCustomAccentChange(event.target.value)
                  onThemeChange('custom')
                }}
              />
            </label>
          </section>
        )}
      </div>
    )
  }

  return (
    <div className="page-stack">
      <section className="profile-hero">
        <AvatarMark label={profile.avatar || profile.nickname} size="large" />
        <div>
          <h1>{profile.nickname}</h1>
          <p>{profile.city} · {profile.goal}</p>
          <button className="profile-id-button" onClick={() => void copyProfileId()}>
            <Copy size={14} />
            ID {profile.id.slice(0, 8)}
          </button>
          <span>持续探索真实的自己，温柔而坚定地成长。</span>
        </div>
      </section>

      <ProfileSnapshot profile={profile} />

      <section className="identity-card">
        <div>
          <strong>实名认证</strong>
          <span>{identityStatusText(profile.identityStatus)}</span>
        </div>
        <input value={realName} onChange={(event) => setRealName(event.target.value)} placeholder="真实姓名" />
        <input value={idNumber} onChange={(event) => setIdNumber(event.target.value)} placeholder="证件号码" />
        <button
          className="ghost-button full"
          onClick={async () => {
            if (!realName.trim() || !idNumber.trim()) {
              onToast('请填写实名信息')
              return
            }
            await onSubmitIdentity(realName.trim(), idNumber.trim())
            setRealName('')
            setIdNumber('')
          }}
        >
          <ShieldCheck size={18} />
          提交实名审核
        </button>
      </section>

      <section className="menu-card">
        <MenuButton icon={Users} title="我的关系报告" text={`${savedCandidates.length} 份已收藏报告`} onClick={() => onOpenTab('meet')} />
        <MenuButton icon={MessageCircle} title="我的树洞" text="记录心事，收藏温暖的回应" onClick={() => onOpenTab('tree')} />
        <MenuButton icon={Leaf} title="成长记录" text={`今日计划 ${plannedPracticeCount} 项`} onClick={() => onOpenTab('growth')} />
        <MenuButton icon={Bookmark} title="收藏与朋友" text={`${savedCandidates.length} 份收藏 · ${friendCandidates.length} 位朋友`} onClick={() => setPanel('saved')} />
      </section>

      <section className="menu-card">
        <MenuButton icon={Sparkles} title="主题外观" text={themeOptions.find((item) => item.key === themeKey)?.label ?? '自定义'} onClick={() => setPanel('theme')} />
        <MenuButton icon={Download} title="检查更新" text={`当前版本 v${APP_VERSION}`} onClick={() => void onCheckUpdate()} />
        <MenuButton icon={ShieldCheck} title="隐私与安全" text="管理你的数据与隐私设置" onClick={() => setPanel('privacy')} />
        <MenuButton icon={NotebookTabs} title="重新完成心谱" text="更新你的画像与推荐权重" onClick={onRetake} />
        <MenuButton icon={CircleAlert} title="退出并重新登录" text="清除本机登录状态" onClick={onReset} />
      </section>
    </div>
  )
}

function ProfileSnapshot({ profile }: { profile: Profile }) {
  return (
    <section className="spectrum-card">
      <div className="section-title inline">
        <div>
          <NotebookTabs size={18} />
          <h2>我的心谱</h2>
        </div>
        <span>置信度 {profile.traits.confidence}%</span>
      </div>
      <div className="spectrum-bars">
        {dimensionMeta.slice(0, 4).map((dimension) => (
          <div key={dimension.key} className="spectrum-row">
            <span>{dimension.left}</span>
            <div>
              <i style={{ left: `${profile.traits[dimension.key]}%`, background: dimension.color }} />
            </div>
            <span>{dimension.right}</span>
          </div>
        ))}
      </div>
      <div className="anchor-row">
        {profile.traits.anchors.slice(0, 3).map((anchor, index) => (
          <span key={`${anchor}-${index}`}>{anchor}</span>
        ))}
      </div>
    </section>
  )
}

function RelationRadar({ profile, candidate }: { profile: Profile; candidate: Candidate & { liveScore: number } }) {
  const grid = [25, 50, 75, 100]
  const profilePoints = polygonPoints(dimensionMeta.map((dimension) => profile.traits[dimension.key]))
  const candidatePoints = polygonPoints(dimensionMeta.map((dimension) => candidate.dimensions[dimension.key]))

  return (
    <section className="radar-card">
      <svg viewBox="0 0 260 260" role="img" aria-label="六维关系图谱">
        {grid.map((value) => (
          <circle key={value} cx="130" cy="130" r={value} className="radar-grid" />
        ))}
        {dimensionMeta.map((dimension, index) => {
          const point = polarPoint(index, 108)
          const label = polarPoint(index, 124)
          return (
            <g key={dimension.key}>
              <line x1="130" y1="130" x2={point.x} y2={point.y} className="radar-axis" />
              <text x={label.x} y={label.y} textAnchor="middle">
                {dimension.shortLabel}
              </text>
            </g>
          )
        })}
        <polygon points={profilePoints} className="radar-profile" />
        <polygon points={candidatePoints} className="radar-candidate" />
        <circle cx="130" cy="130" r="42" className="radar-center" />
        <text x="130" y="124" textAnchor="middle" className="radar-score">
          {candidate.liveScore}%
        </text>
        <text x="130" y="148" textAnchor="middle" className="radar-sub">
          兼容指数
        </text>
      </svg>
      <div className="radar-legend">
        <span><i /> 你的心谱</span>
        <span><i /> TA 的画像</span>
      </div>
    </section>
  )
}

function InsightCard({
  title,
  icon: Icon,
  items,
  tone,
}: {
  title: string
  icon: LucideIcon
  items: string[]
  tone: string
}) {
  return (
    <article className={`insight-card ${tone}`}>
      <div>
        <Icon size={18} />
        <strong>{title}</strong>
      </div>
      <ul>
        {items.map((item, index) => (
          <li key={`${item}-${index}`}>{item}</li>
        ))}
      </ul>
    </article>
  )
}

function SectionTitle({
  title,
  icon: Icon,
  action,
  onAction,
}: {
  title: string
  icon: LucideIcon
  action?: string
  onAction?: () => void
}) {
  return (
    <div className="section-title">
      <div>
        <Icon size={18} />
        <h2>{title}</h2>
      </div>
      {action && (
        <button type="button" onClick={onAction} disabled={!onAction}>
          {action}
        </button>
      )}
    </div>
  )
}

function FieldGroup({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="field-group">
      <span>{label}</span>
      {children}
    </div>
  )
}

function SegmentedControl({
  value,
  options,
  onChange,
}: {
  value: string
  options: Array<string | { label: string; value: string }>
  onChange: (value: string) => void
}) {
  return (
    <div className="segmented-control">
      {options.map((option) => {
        const item = typeof option === 'string' ? { label: option, value: option } : option
        return (
          <button key={item.value} className={value === item.value ? 'active' : ''} onClick={() => onChange(item.value)}>
            {item.label}
          </button>
        )
      })}
    </div>
  )
}

function AvatarMark({ label, size = 'normal' }: { label: string; size?: 'normal' | 'large' }) {
  return <span className={`avatar-mark ${size}`}>{label.slice(0, 1)}</span>
}

function PersonBadge({ label, sub }: { label: string; sub: string }) {
  return (
    <div className="person-badge">
      <AvatarMark label={label} />
      <strong>{label}</strong>
      <span>{sub}</span>
    </div>
  )
}

function MenuButton({
  icon: Icon,
  title,
  text,
  onClick,
}: {
  icon: LucideIcon
  title: string
  text: string
  onClick: () => void
}) {
  return (
    <button className="menu-button" onClick={onClick}>
      <Icon size={22} />
      <span>
        <strong>{title}</strong>
        <small>{text}</small>
      </span>
      <ChevronRight size={18} />
    </button>
  )
}

function ToggleRow({
  title,
  text,
  checked,
  onChange,
}: {
  title: string
  text: string
  checked: boolean
  onChange: () => void
}) {
  return (
    <button className={checked ? 'toggle-row active' : 'toggle-row'} type="button" onClick={onChange}>
      <span>
        <strong>{title}</strong>
        <small>{text}</small>
      </span>
      <i aria-hidden="true" />
    </button>
  )
}

function scoreCandidate(traits: Traits, candidate: Candidate) {
  const weights: Record<DimensionKey, number> = {
    values: 0.25,
    lifestyle: 0.2,
    relationship: 0.2,
    communication: 0.1,
    growth: 0.1,
    boundary: 0.15,
  }
  const fit = dimensionMeta.reduce((sum, dimension) => {
    const gap = Math.abs(traits[dimension.key] - candidate.dimensions[dimension.key])
    return sum + (100 - gap) * weights[dimension.key]
  }, 0)
  return Math.round(clamp(fit, 72, 96))
}

function polygonPoints(values: number[]) {
  return values
    .map((value, index) => {
      const point = polarPoint(index, (value / 100) * 104)
      return `${point.x},${point.y}`
    })
    .join(' ')
}

function polarPoint(index: number, radius: number) {
  const angle = (Math.PI * 2 * index) / dimensionMeta.length - Math.PI / 2
  return {
    x: 130 + Math.cos(angle) * radius,
    y: 130 + Math.sin(angle) * radius,
  }
}

function visibilityLabel(value: PrivacyLevel) {
  if (value === 'private') return '仅自己可见'
  if (value === 'friends') return '好友可见'
  return '发布广场'
}

function identityStatusText(status?: string) {
  if (status === 'verified') return '已通过实名校验'
  if (status === 'pending_manual_review') return '已提交，等待人工审核'
  if (status === 'rejected') return '实名未通过，请重新提交'
  return '未提交实名信息'
}

function isValidQqEmail(value: string | undefined) {
  return /^[1-9]\d{4,11}@qq\.com$/i.test(value?.trim() ?? '')
}

function growthPanelTitle(panel: GrowthPanel) {
  if (panel === 'path') return '成长路径'
  if (panel === 'reading') return '推荐阅读'
  if (panel === 'practice') return '认知练习'
  if (panel === 'discussion') return '同题讨论'
  if (panel === 'fellows') return '同路的人'
  return '成长'
}

function buildSampleReply(candidate: (Candidate & { liveScore: number }) | undefined, content: string) {
  const name = candidate?.name ?? '镜屿'
  const tag = candidate?.tags[0] ?? '真实表达'
  if (content.length < 12) return `${name}：我收到了。也许可以多说一点，关于“${tag}”的那部分。`
  return `${name}：这句话很真实。我会先记住你的感受，再慢慢回应，不急着给答案。`
}

function mergeCandidates(items: Array<Candidate & { liveScore: number }>) {
  const seen = new Set<string>()
  return items.filter((item) => {
    if (seen.has(item.id)) return false
    seen.add(item.id)
    return true
  })
}

function isVersionNewer(latest: string, current: string) {
  const latestParts = latest.split('.').map((part) => Number.parseInt(part, 10) || 0)
  const currentParts = current.split('.').map((part) => Number.parseInt(part, 10) || 0)
  const length = Math.max(latestParts.length, currentParts.length)
  for (let index = 0; index < length; index += 1) {
    const latestPart = latestParts[index] ?? 0
    const currentPart = currentParts[index] ?? 0
    if (latestPart > currentPart) return true
    if (latestPart < currentPart) return false
  }
  return false
}

function isArticlePost(post: TreePost) {
  return post.tags.some((tag) => tag.includes('文章') || tag.includes('阅读'))
}

function articleTitle(post: TreePost) {
  const match = post.content.match(/^《(.+?)》/)
  return match?.[1] ?? post.content.split(/\n/)[0].slice(0, 16)
}

function articlePreview(post: TreePost) {
  return post.content.replace(/^《.+?》\s*/, '').replace(/\s+/g, ' ').trim().slice(0, 68) || '作者留下了一段安静的文字。'
}

function themeStyle(theme: ThemeKey, customAccent: string): CSSProperties | undefined {
  if (theme !== 'custom') return undefined
  return {
    '--app-accent': customAccent,
    '--app-soft': `${customAccent}24`,
    '--app-soft-strong': `${customAccent}42`,
    '--entry-a': '#f9fcff',
    '--entry-b': `${customAccent}26`,
  } as CSSProperties
}

function mapApiProfile(item: ApiProfile, avatar = '澄'): Profile {
  return {
    id: item.id,
    email: item.email_masked,
    avatar,
    nickname: item.nickname,
    city: item.city,
    goal: item.goal as RelationGoal,
    privacy: item.privacy as PrivacyLevel,
    identityStatus: item.identity_status,
    traits: {
      values: item.traits.values ?? 50,
      lifestyle: item.traits.lifestyle ?? 50,
      relationship: item.traits.relationship ?? 50,
      communication: item.traits.communication ?? 50,
      growth: item.traits.growth ?? 50,
      boundary: item.traits.boundary ?? 50,
      confidence: item.confidence ?? 48,
      anchors: item.anchors?.length ? item.anchors : ['Deep explorer'],
    },
    answers: item.answers ?? {},
    createdAt: item.created_at,
  }
}

function mapApiRecommendation(item: ApiRecommendation): Candidate & { liveScore: number } {
  return {
    id: item.id,
    name: item.nickname,
    age: item.is_seed ? 26 : 25,
    city: item.city,
    type: item.is_seed ? 'Beta' : '内测用户',
    goal: item.goal as RelationGoal,
    score: item.score,
    liveScore: item.score,
    confidence: item.is_seed ? '样例' : '真实用户',
    avatar: item.nickname.slice(0, 1),
    mood: item.intro,
    tags: item.anchors.slice(0, 3),
    intro: item.intro,
    dimensions: {
      values: item.traits.values ?? 50,
      lifestyle: item.traits.lifestyle ?? 50,
      relationship: item.traits.relationship ?? 50,
      communication: item.traits.communication ?? 50,
      growth: item.traits.growth ?? 50,
      boundary: item.traits.boundary ?? 50,
    },
    similar: item.similar,
    different: item.different,
    friction: item.friction,
    openers: [
      '你最近一次感到真正被理解，是什么时刻？',
      '如果给当下的自己留一句话，你会写什么？',
      '你希望关系里保留怎样的自我空间？',
    ],
  }
}

function mapApiTreePost(item: ApiTreePost): TreePost {
  return {
    id: item.id,
    author: item.author,
    time: formatTime(item.created_at),
    visibility: item.visibility as PrivacyLevel,
    content: item.status === 'approved' ? item.content : `${item.content}（审核中）`,
    tags: item.tags,
    resonance: 0,
    hugs: 0,
    experienced: 0,
    chats: 0,
  }
}

function formatTime(value: string) {
  const timestamp = new Date(value).getTime()
  if (Number.isNaN(timestamp)) return '刚刚'
  const minutes = Math.max(0, Math.round((Date.now() - timestamp) / 60000))
  if (minutes < 1) return '刚刚'
  if (minutes < 60) return `${minutes} 分钟前`
  if (minutes < 1440) return `${Math.round(minutes / 60)} 小时前`
  return `${Math.round(minutes / 1440)} 天前`
}

function isSampleCandidateId(id: string) {
  return id.startsWith('seed_') || ['shan', 'feng', 'wan'].includes(id)
}

function assetUrl(path: string) {
  if (path.startsWith('http') || path.startsWith('data:')) return path
  return `${baseUrl}${path}`.replace(/\/{2,}/g, '/')
}

function clamp(value: number, min: number, max: number) {
  return Math.max(min, Math.min(max, value))
}

function useStoredState<T>(key: string, fallback: T) {
  const [value, setValue] = useState<T>(() => {
    try {
      const raw = window.localStorage.getItem(key)
      return raw ? (JSON.parse(raw) as T) : fallback
    } catch {
      return fallback
    }
  })

  useEffect(() => {
    window.localStorage.setItem(key, JSON.stringify(value))
  }, [key, value])

  return [value, setValue] as const
}

export default App
