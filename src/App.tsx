import { useCallback, useEffect, useMemo, useState } from 'react'
import type { Dispatch, ReactNode, SetStateAction } from 'react'
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
  Heart,
  House,
  Landmark,
  Leaf,
  MessageCircle,
  Moon,
  NotebookTabs,
  PackageOpen,
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
  fetchConversationMessages,
  fetchRecommendations,
  fetchTreePosts,
  loginWithCode,
  saveAssessment,
  sendConversationMessage,
  sendLoginCode,
  startConversation,
  submitIdentity,
  type ApiRecommendation,
  type ApiTreePost,
  type ApiUser,
} from './api'

type BeforeInstallPrompt = Event & {
  prompt: () => Promise<void>
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>
}

type Screen = 'welcome' | 'assessment' | 'app'
type TabKey = 'meet' | 'tree' | 'growth' | 'messages' | 'me'
type RelationGoal = '亲密关系' | '深度朋友' | '成长伙伴'
type PrivacyLevel = 'private' | 'friends' | 'public'
type DimensionKey = 'values' | 'lifestyle' | 'relationship' | 'communication' | 'growth' | 'boundary'

interface RegistrationDraft {
  email: string
  code: string
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

function App() {
  const [screen, setScreen] = useState<Screen>('welcome')
  const [activeTab, setActiveTab] = useStoredState<TabKey>('mirror-isle:tab', 'meet')
  const [draft, setDraft] = useStoredState<RegistrationDraft>('mirror-isle:draft', defaultDraft)
  const [answers, setAnswers] = useStoredState<Record<string, string>>('mirror-isle:answers', {})
  const [profile, setProfile] = useStoredState<Profile | null>('mirror-isle:profile', null)
  const [authToken, setAuthToken] = useStoredState<string | null>('mirror-isle:auth-token', null)
  const [treePosts, setTreePosts] = useStoredState<TreePost[]>('mirror-isle:tree-posts', seedTreePosts)
  const [chatMessages, setChatMessages] = useStoredState<ChatMessage[]>('mirror-isle:messages', startingMessages)
  const [selectedCandidateId, setSelectedCandidateId] = useStoredState('mirror-isle:selected', candidates[0].id)
  const [questionIndex, setQuestionIndex] = useStoredState('mirror-isle:question-index', 0)
  const [remoteCandidates, setRemoteCandidates] = useState<Array<Candidate & { liveScore: number }> | null>(null)
  const [conversationIds, setConversationIds] = useStoredState<Record<string, string>>('mirror-isle:conversation-ids', {})
  const [backendState, setBackendState] = useState<'online' | 'offline'>(authToken ? 'online' : 'offline')
  const [apiUser, setApiUser] = useState<ApiUser | null>(null)
  const [installPrompt, setInstallPrompt] = useState<BeforeInstallPrompt | null>(null)
  const [toast, setToast] = useState('')

  useEffect(() => {
    if (profile && !authToken) {
      setProfile(null)
      setScreen('welcome')
      return
    }
    setScreen(profile ? 'app' : 'welcome')
  }, [authToken, profile, setProfile])

  useEffect(() => {
    window.scrollTo({ top: 0, behavior: 'auto' })
  }, [screen])

  useEffect(() => {
    const handleBeforeInstall = (event: Event) => {
      event.preventDefault()
      setInstallPrompt(event as BeforeInstallPrompt)
    }
    window.addEventListener('beforeinstallprompt', handleBeforeInstall)
    return () => window.removeEventListener('beforeinstallprompt', handleBeforeInstall)
  }, [])

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

  const selectedCandidate =
    rankedCandidates.find((candidate) => candidate.id === selectedCandidateId) ?? rankedCandidates[0]

  const showToast = useCallback((message: string) => setToast(message), [])

  const installApp = async () => {
    if (installPrompt) {
      await installPrompt.prompt()
      const choice = await installPrompt.userChoice
      if (choice.outcome === 'accepted') {
        setInstallPrompt(null)
        showToast('镜屿正在安装到你的设备')
      }
      return
    }
    showToast('可在浏览器菜单中选择“安装应用”或“添加到主屏幕”')
  }

  const syncBackendData = async (token: string) => {
    try {
      const [recommendationResult, treeResult] = await Promise.all([
        fetchRecommendations(token).catch(() => ({ items: [], score_version: 'offline' })),
        fetchTreePosts(token).catch(() => ({ items: [] })),
      ])
      if (recommendationResult.items.length) {
        setRemoteCandidates(recommendationResult.items.map(mapApiRecommendation))
      }
      if (treeResult.items.length) {
        setTreePosts(treeResult.items.map(mapApiTreePost))
      }
      setBackendState('online')
    } catch {
      setBackendState('offline')
    }
  }

  const requestLoginCode = async () => {
    if (!isValidEmail(draft.email)) {
      showToast('请先填写有效邮箱')
      return
    }
    try {
      await sendLoginCode(draft.email)
      showToast('验证码已发送到邮箱')
      setBackendState('online')
    } catch {
      setBackendState('offline')
      showToast('邮箱验证码发送失败，请检查后端邮件配置')
    }
  }

  const beginAssessment = async () => {
    if (!isValidEmail(draft.email) || !draft.nickname.trim() || !draft.code.trim()) {
      showToast('请补全邮箱、验证码和昵称')
      return
    }
    if (!draft.ageConfirmed || !draft.agreement) {
      showToast('请确认年龄与协议后继续')
      return
    }
    try {
      const login = await loginWithCode({
        email: draft.email,
        code: draft.code,
        nickname: draft.nickname.trim(),
        city: draft.city.trim() || '上海',
        goal: draft.goal,
        privacy: draft.privacy,
        age_confirmed: draft.ageConfirmed,
      })
      setAuthToken(login.token)
      setApiUser(login.user)
      setBackendState('online')
      setProfile((current) =>
        current
          ? { ...current, id: login.user.id, identityStatus: login.user.identity_status }
          : current,
      )
    } catch {
      setAuthToken(null)
      setApiUser(null)
      setBackendState('offline')
      showToast('邮箱登录失败，请确认验证码或邮件服务')
      return
    }
    setQuestionIndex(0)
    setAnswers({})
    setScreen('assessment')
  }

  const finishAssessment = async (nextAnswers: Record<string, string>) => {
    let remoteTraits: Traits | null = null
    if (!authToken) {
      showToast('请先完成邮箱登录')
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
      nickname: draft.nickname.trim(),
      city: draft.city.trim() || '上海',
      goal: draft.goal,
      privacy: draft.privacy,
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
    window.localStorage.removeItem('mirror-isle:tree-posts')
    window.localStorage.removeItem('mirror-isle:conversation-ids')
    setProfile(null)
    setAuthToken(null)
    setDraft(defaultDraft)
    setAnswers({})
    setQuestionIndex(0)
    setChatMessages(startingMessages)
    setTreePosts(seedTreePosts)
    setRemoteCandidates(null)
    setConversationIds({})
    setApiUser(null)
    setBackendState('offline')
    setScreen('welcome')
    showToast('体验数据已重置')
  }

  const publishTreePost = async (content: string, visibility: PrivacyLevel, tags: string[]) => {
    if (!authToken) {
      showToast('请先完成邮箱登录')
      return
    }
    const result = await createTreePost(authToken, content, visibility, tags)
    await syncBackendData(authToken)
    showToast(result.status === 'approved' ? '树洞已发布' : '树洞已进入审核')
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
        setChatMessages([])
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
    [authToken, getConversationId, profile, setChatMessages, showToast],
  )

  const sendRemoteMessage = async (candidateId: string, content: string) => {
    if (!authToken) {
      showToast('请先完成邮箱登录')
      return
    }
    if (isSampleCandidateId(candidateId)) {
      showToast('样例用户仅用于展示，真实内测用户加入后即可发消息')
      return
    }
    const conversationId = await getConversationId(candidateId)
    const result = await sendConversationMessage(authToken, conversationId, content)
    await syncConversationMessages(candidateId)
    if (result.message.status !== 'approved') {
      showToast('消息已进入安全审核')
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
    <div className="mirror-app">
      <header className="site-bar">
        <button className="brand" onClick={() => setScreen(profile ? 'app' : 'welcome')} aria-label="回到镜屿首页">
          <span className="brand-mark">屿</span>
          <span>
            <strong>镜屿</strong>
            <small>心理成长型深度关系产品</small>
          </span>
        </button>
        <div className="site-actions">
          <span className={backendState === 'online' ? 'backend-badge online' : 'backend-badge'}>
            {backendState === 'online' ? '多人后端在线' : '等待邮箱登录'}
          </span>
          <button className="ghost-button" onClick={installApp}>
            <PackageOpen size={17} />
            下载 / 安装
          </button>
          {profile && (
            <button className="ghost-button" onClick={resetDemo}>
              <RefreshText />
              重置体验
            </button>
          )}
        </div>
      </header>

      {screen === 'welcome' && (
          <WelcomeScreen
            draft={draft}
            setDraft={setDraft}
            onSendCode={requestLoginCode}
            onBegin={beginAssessment}
            onInstall={installApp}
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
          onBack={() => setScreen(profile ? 'app' : 'welcome')}
        />
      )}

      {screen === 'app' && profile && (
        <AppShell
          activeTab={activeTab}
          profile={profile}
          selectedCandidate={selectedCandidate}
          rankedCandidates={rankedCandidates}
          treePosts={treePosts}
          chatMessages={chatMessages}
          setActiveTab={setActiveTab}
          setSelectedCandidateId={setSelectedCandidateId}
          setTreePosts={setTreePosts}
          onCreateTreePost={publishTreePost}
          onSendMessage={sendRemoteMessage}
          onSubmitIdentity={submitRealIdentity}
          onInstall={installApp}
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
  draft,
  setDraft,
  onSendCode,
  onBegin,
  onInstall,
}: {
  draft: RegistrationDraft
  setDraft: Dispatch<SetStateAction<RegistrationDraft>>
  onSendCode: () => Promise<void>
  onBegin: () => void
  onInstall: () => void
}) {
  return (
    <main className="welcome-layout">
      <section className="welcome-copy">
        <span className="eyebrow">
          <Sparkles size={16} />
          MIRROR ISLE · 镜屿
        </span>
        <h1>找到真正理解你的人</h1>
        <p>先认识自己，再遇见真正合适的人。镜屿用心谱、每日有限推荐和关系图谱，帮助你减少无效认识。</p>

        <div className="promise-grid">
          <FeaturePill icon={UserRound} title="认识自己" text="初见心谱形成五层画像" />
          <FeaturePill icon={Users} title="遇见同频" text="每天 3 位可解释推荐" />
          <FeaturePill icon={Leaf} title="共同成长" text="内容与关系形成闭环" />
        </div>

        <div className="download-strip">
          <div>
            <strong>已支持下载式使用</strong>
            <span>通过 PWA 安装到手机主屏或桌面，连接同一内测后端后即可多人使用。</span>
          </div>
          <button className="secondary-button" onClick={onInstall}>
            <PackageOpen size={17} />
            安装镜屿
          </button>
        </div>
      </section>

      <section className="auth-card" aria-label="镜屿注册">
        <div className="auth-art">
          <img src={assetUrl('assets/mirror/welcome.png')} alt="镜屿欢迎页预览" />
        </div>
        <div className="auth-form">
          <h2>注册 / 登录</h2>
          <div className="form-row two">
            <label>
              邮箱
              <input
                value={draft.email ?? ''}
                onChange={(event) => setDraft((current) => ({ ...current, email: event.target.value }))}
                placeholder="you@example.com"
                type="email"
                autoComplete="email"
              />
            </label>
            <label>
              验证码
              <div className="inline-field">
                <input
                  value={draft.code}
                  onChange={(event) => setDraft((current) => ({ ...current, code: event.target.value }))}
                  placeholder="验证码"
                  inputMode="numeric"
                />
                <button
                  type="button"
                  onClick={onSendCode}
                >
                  发送
                </button>
              </div>
            </label>
          </div>

          <div className="form-row two">
            <label>
              前台昵称
              <input
                value={draft.nickname}
                onChange={(event) => setDraft((current) => ({ ...current, nickname: event.target.value }))}
                placeholder="例如：山海"
              />
            </label>
            <label>
              城市
              <input
                value={draft.city}
                onChange={(event) => setDraft((current) => ({ ...current, city: event.target.value }))}
                placeholder="上海"
              />
            </label>
          </div>

          <FieldGroup label="当前关系目的">
            <SegmentedControl
              value={draft.goal}
              options={['亲密关系', '深度朋友', '成长伙伴']}
              onChange={(value) => setDraft((current) => ({ ...current, goal: value as RelationGoal }))}
            />
          </FieldGroup>

          <FieldGroup label="默认可见范围">
            <SegmentedControl
              value={draft.privacy}
              options={[
                { label: '仅自己', value: 'private' },
                { label: '好友', value: 'friends' },
                { label: '广场', value: 'public' },
              ]}
              onChange={(value) => setDraft((current) => ({ ...current, privacy: value as PrivacyLevel }))}
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

          <button className="primary-button full" onClick={onBegin}>
            <ShieldCheck size={18} />
            邮箱注册 / 登录
          </button>
        </div>
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

  return (
    <main className="assessment-layout">
      <section className="device-panel assessment-panel">
        <div className="screen-head">
          <button className="icon-button" onClick={onBack} aria-label="返回">
            <ChevronRight className="back-icon" size={22} />
          </button>
          <AvatarMark label={draft.nickname || '你'} />
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
  treePosts,
  chatMessages,
  setActiveTab,
  setSelectedCandidateId,
  setTreePosts,
  onCreateTreePost,
  onSendMessage,
  onSubmitIdentity,
  onInstall,
  onRetake,
  onToast,
}: {
  activeTab: TabKey
  profile: Profile
  selectedCandidate: Candidate & { liveScore: number }
  rankedCandidates: Array<Candidate & { liveScore: number }>
  treePosts: TreePost[]
  chatMessages: ChatMessage[]
  setActiveTab: Dispatch<SetStateAction<TabKey>>
  setSelectedCandidateId: Dispatch<SetStateAction<string>>
  setTreePosts: Dispatch<SetStateAction<TreePost[]>>
  onCreateTreePost: (content: string, visibility: PrivacyLevel, tags: string[]) => Promise<void>
  onSendMessage: (candidateId: string, content: string) => Promise<void>
  onSubmitIdentity: (realName: string, idNumber: string) => Promise<void>
  onInstall: () => void
  onRetake: () => void
  onToast: (message: string) => void
}) {
  const [showGraph, setShowGraph] = useState(false)

  useEffect(() => {
    setShowGraph(false)
  }, [activeTab])

  return (
    <main className="product-layout">
      <aside className="product-brief">
        <span className="eyebrow">
          <CircleCheck size={16} />
          可运行 MVP
        </span>
        <h2>邮箱登录、心谱、树洞和消息已接入后端</h2>
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
          <AvatarMark label={profile.nickname} />
        </div>

        <div className="device-content">
          {showGraph && (
            <RelationshipGraph
              profile={profile}
              candidate={selectedCandidate}
              onBack={() => setShowGraph(false)}
              onChat={() => {
                setShowGraph(false)
                setActiveTab('messages')
              }}
              onToast={onToast}
            />
          )}

          {!showGraph && activeTab === 'meet' && (
            <MeetPage
              profile={profile}
              candidates={rankedCandidates}
              selectedCandidateId={selectedCandidate.id}
              onSelect={(candidateId) => {
                setSelectedCandidateId(candidateId)
                setShowGraph(true)
              }}
            />
          )}

          {!showGraph && activeTab === 'tree' && (
            <TreePage profile={profile} posts={treePosts} setPosts={setTreePosts} onCreatePost={onCreateTreePost} onToast={onToast} />
          )}

          {!showGraph && activeTab === 'growth' && (
            <GrowthPage profile={profile} candidates={rankedCandidates} onToast={onToast} />
          )}

          {!showGraph && activeTab === 'messages' && (
            <MessagesPage
              candidate={selectedCandidate}
              messages={chatMessages}
              onSendMessage={onSendMessage}
              onOpenGraph={() => setShowGraph(true)}
              onToast={onToast}
            />
          )}

          {!showGraph && activeTab === 'me' && (
            <MePage profile={profile} onInstall={onInstall} onRetake={onRetake} onSubmitIdentity={onSubmitIdentity} onToast={onToast} />
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
  onSelect,
}: {
  profile: Profile
  candidates: Array<Candidate & { liveScore: number }>
  selectedCandidateId: string
  onSelect: (candidateId: string) => void
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
        {candidates.map((candidate) => (
          <button
            key={candidate.id}
            className={candidate.id === selectedCandidateId ? 'candidate-card active' : 'candidate-card'}
            onClick={() => onSelect(candidate.id)}
          >
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
        ))}
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
  onBack,
  onChat,
  onToast,
}: {
  profile: Profile
  candidate: Candidate & { liveScore: number }
  onBack: () => void
  onChat: () => void
  onToast: (message: string) => void
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
        <button className="icon-button" onClick={() => onToast('关系报告已收藏')} aria-label="收藏关系报告">
          <Bookmark size={20} />
        </button>
      </div>

      <div className="pair-row">
        <PersonBadge label={profile.nickname} sub={`${profile.city} · ${profile.goal}`} />
        <PersonBadge label={candidate.name} sub={`${candidate.type} · ${candidate.city}`} />
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
        <button className="primary-button full" onClick={onChat}>
          <MessageCircle size={18} />
          开始对话
        </button>
        <button className="ghost-button full" onClick={() => onToast('关系报告已收藏')}>
          <Star size={18} />
          收藏关系报告
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
  onToast,
}: {
  profile: Profile
  candidates: Array<Candidate & { liveScore: number }>
  onToast: (message: string) => void
}) {
  const topAnchor = profile.traits.anchors[0] ?? '边界练习者'

  return (
    <div className="page-stack">
      <section className="growth-hero">
        <span>本周成长主题：{topAnchor.includes('边界') ? '边界感' : '真实表达'}</span>
        <h1>今天，继续成为更好的自己</h1>
        <div className="progress-line">
          <i style={{ width: `${profile.traits.confidence}%` }} />
        </div>
        <button className="ghost-button" onClick={() => onToast('成长路径已打开')}>
          查看成长路径
          <ChevronRight size={17} />
        </button>
      </section>

      <SectionTitle title="推荐阅读" icon={BookOpen} action="查看全部" />
      <div className="reading-row">
        {['被讨厌的勇气', '界限：通往个人自由', '也许你该找个人聊聊'].map((title, index) => (
          <article key={title} className={`reading-card tone-${index + 1}`}>
            <strong>{title}</strong>
            <span>心理学</span>
          </article>
        ))}
      </div>

      <SectionTitle title="认知练习" icon={Leaf} />
      <button className="practice-card" onClick={() => onToast('练习已加入今日计划')}>
        <Leaf size={24} />
        <div>
          <strong>识别你的边界信号</strong>
          <span>觉察你在关系中感到不适的时刻</span>
        </div>
        <small>约 8 分钟</small>
      </button>

      <SectionTitle title="同题讨论" icon={MessageCircle} />
      <button className="discussion-card" onClick={() => onToast('已进入同题讨论')}>
        <span>“拒绝别人时，你最担心失去什么？”</span>
        <small>1,284 人参与讨论</small>
      </button>

      <SectionTitle title="与你同路的人" icon={Users} action="换一批" />
      <div className="fellow-row">
        {candidates.slice(0, 2).map((candidate) => (
          <article key={candidate.id} className="fellow-card">
            <AvatarMark label={candidate.avatar} />
            <strong>{candidate.name}</strong>
            <span>{candidate.tags[0]}</span>
          </article>
        ))}
      </div>
    </div>
  )
}

function MessagesPage({
  candidate,
  messages,
  onSendMessage,
  onOpenGraph,
  onToast,
}: {
  candidate: Candidate & { liveScore: number }
  messages: ChatMessage[]
  onSendMessage: (candidateId: string, content: string) => Promise<void>
  onOpenGraph: () => void
  onToast: (message: string) => void
}) {
  const [draft, setDraft] = useState('')
  const sampleCandidate = isSampleCandidateId(candidate.id)

  const sendMessage = async () => {
    if (!draft.trim()) return
    const content = draft.trim()
    await onSendMessage(candidate.id, content)
    if (!sampleCandidate) setDraft('')
  }

  return (
    <div className="chat-page">
      <header className="chat-head">
        <AvatarMark label={candidate.avatar} />
        <div>
          <strong>{candidate.name}</strong>
          <small>{sampleCandidate ? '样例关系图谱' : '真实内测用户'} · {candidate.liveScore}% 契合</small>
        </div>
        <button className="ghost-button" onClick={onOpenGraph}>
          查看关系图谱
        </button>
      </header>

      <section className="first-meet">
        <span>第一次相遇</span>
        {candidate.openers.map((opener, index) => (
          <button
            key={`${opener}-${index}`}
            onClick={() => {
              if (sampleCandidate) {
                onToast('样例用户仅用于展示，真实内测用户加入后即可发消息')
                return
              }
              setDraft(opener)
            }}
          >
            {opener}
          </button>
        ))}
      </section>

      <div className="message-list">
        {messages.length ? (
          messages.map((message) => (
            <div key={message.id} className={message.from === 'me' ? 'message mine' : 'message'}>
              {message.text}
            </div>
          ))
        ) : (
          <div className="empty-state">
            {sampleCandidate ? '这是样例对象，只展示匹配逻辑。邀请真实内测用户完成心谱后即可互发消息。' : '还没有消息，发出第一句真诚的问候。'}
          </div>
        )}
      </div>

      <label className="chat-input">
        <input
          value={draft}
          onChange={(event) => setDraft(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === 'Enter') sendMessage()
          }}
          disabled={sampleCandidate}
          placeholder={sampleCandidate ? '等待真实内测用户' : '写点真诚的话...'}
        />
        <button onClick={sendMessage} aria-label="发送消息" disabled={sampleCandidate}>
          <Send size={18} />
        </button>
      </label>
    </div>
  )
}

function MePage({
  profile,
  onInstall,
  onRetake,
  onSubmitIdentity,
  onToast,
}: {
  profile: Profile
  onInstall: () => void
  onRetake: () => void
  onSubmitIdentity: (realName: string, idNumber: string) => Promise<void>
  onToast: (message: string) => void
}) {
  const [realName, setRealName] = useState('')
  const [idNumber, setIdNumber] = useState('')

  return (
    <div className="page-stack">
      <section className="profile-hero">
        <AvatarMark label={profile.nickname} size="large" />
        <div>
          <h1>{profile.nickname}</h1>
          <p>{profile.city} · {profile.goal}</p>
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
        <MenuButton icon={Users} title="我的关系报告" text="洞察你的人际模式与关系质量" onClick={() => onToast('关系报告已打开')} />
        <MenuButton icon={MessageCircle} title="我的树洞" text="记录心事，收藏温暖的回应" onClick={() => onToast('树洞记录已打开')} />
        <MenuButton icon={Leaf} title="成长记录" text="回顾你的变化与每一次突破" onClick={() => onToast('成长记录已打开')} />
        <MenuButton icon={Bookmark} title="收藏" text="收藏的问答、文章与心动时刻" onClick={() => onToast('收藏已打开')} />
      </section>

      <section className="menu-card">
        <MenuButton icon={ShieldCheck} title="隐私与安全" text="管理你的数据与隐私设置" onClick={() => onToast('隐私设置已打开')} />
        <MenuButton icon={PackageOpen} title="下载 / 安装镜屿" text="添加到手机主屏或桌面" onClick={onInstall} />
        <MenuButton icon={NotebookTabs} title="重新完成心谱" text="更新你的画像与推荐权重" onClick={onRetake} />
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

function SectionTitle({ title, icon: Icon, action }: { title: string; icon: LucideIcon; action?: string }) {
  return (
    <div className="section-title">
      <div>
        <Icon size={18} />
        <h2>{title}</h2>
      </div>
      {action && <span>{action}</span>}
    </div>
  )
}

function FeaturePill({ icon: Icon, title, text }: { icon: LucideIcon; title: string; text: string }) {
  return (
    <article className="feature-pill">
      <Icon size={24} />
      <strong>{title}</strong>
      <span>{text}</span>
    </article>
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

function RefreshText() {
  return <span className="refresh-symbol">↻</span>
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

function isValidEmail(value: string | undefined) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value?.trim() ?? '')
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
