import { useEffect, useMemo, useState } from 'react'
import { createPortal } from 'react-dom'
import {
  ChevronRight,
  CircleCheck,
  Heart,
  Leaf,
  MessageCircle,
  Moon,
  PenLine,
  Plus,
  Send,
  ShieldCheck,
  Sparkles,
  Star,
} from 'lucide-react'
import { createTreePost, fetchTreePosts, type ApiTreePost } from './api'
import './enhancements.css'

type MoodKey = 'sunny' | 'breeze' | 'cloudy' | 'rain' | 'wave'
type TreeMode = 'private' | 'square'

interface MoodEntry {
  date: string
  mood: MoodKey
  note: string
  createdAt: string
}

interface Wallet {
  points: number
  bottleCredits: number
}

interface PrivateNote {
  id: string
  content: string
  createdAt: string
}

interface BottleReply {
  id: string
  content: string
  anonymous: boolean
  createdAt: string
}

interface DriftBottle {
  id: string
  content: string
  author: string
  anonymous: boolean
  createdAt: string
  replies: BottleReply[]
}

interface StoredProfile {
  id?: string
  nickname?: string
}

const MOOD_KEY = 'mirror-isle:mood-checkins-v1'
const WALLET_KEY = 'mirror-isle:heart-shell-wallet-v1'
const PRIVATE_TREE_KEY = 'mirror-isle:private-tree-v1'
const BOTTLE_KEY = 'mirror-isle:drift-bottles-v1'

const moodOptions: Array<{ key: MoodKey; label: string; hint: string; score: number; symbol: string }> = [
  { key: 'sunny', label: '晴朗', hint: '轻松，有一点期待', score: 90, symbol: '☀' },
  { key: 'breeze', label: '微风', hint: '平静，状态还不错', score: 76, symbol: '≈' },
  { key: 'cloudy', label: '多云', hint: '有些杂乱，但能照顾自己', score: 62, symbol: '☁' },
  { key: 'rain', label: '小雨', hint: '低落，想慢一点', score: 46, symbol: '⌁' },
  { key: 'wave', label: '浪涌', hint: '情绪很满，需要空间', score: 30, symbol: '∿' },
]

const assessmentSceneCopy = [
  {
    construct: '独处心境',
    title: '如果给你一段完全属于自己的黄昏，哪幅画面最像你会自然走进去的地方？',
    subtitle: '不用选“更好的”，只选让身体先松下来的一幕。',
    options: [
      ['温馨小屋', '暖灯、沙发和安静的书页'],
      ['林间小聚', '熟悉的人在身边，也各自保留一点安静'],
      ['海边落日', '沿着海岸慢慢走，看天色一点点变化'],
      ['夜读城市', '窗外有灯火，身边只留一段认真深聊'],
    ],
  },
  {
    construct: '生活节律',
    title: '周六清晨，你们约好去山野。天刚亮，雾还挂在树梢，你更像下面哪一种状态？',
    subtitle: '想象真实的你，而不是理想中的你。',
    options: [
      ['前夜就收好背包', '路线、天气和要带的东西都心里有数'],
      ['准点在路口出现', '不必安排得很满，但会认真对待约定'],
      ['慢十分钟也没关系', '只要彼此知道，节奏松一点更舒服'],
      ['到了早上再决定', '更相信当下的感觉和临场变化'],
    ],
  },
  {
    construct: '关系修复',
    title: '一次不愉快之后，窗外已经安静下来。你更希望两个人怎样重新靠近？',
    subtitle: '没有标准答案，这只是你习惯的修复节奏。',
    options: [
      ['趁还记得，把话说开', '我更安心于及时确认彼此的想法'],
      ['先各自安静一会儿', '等情绪退潮，再认真谈发生了什么'],
      ['先让我知道你听见了', '被理解之后，我才更有力气讨论问题'],
      ['先一起找下一步', '比起反复追问，我更想知道以后怎么做'],
    ],
  },
  {
    construct: '回应需要',
    title: '夜里你发出一条对自己很重要的消息，对方暂时没有回应。你会先怎么照顾自己？',
    subtitle: '这里看的是等待中的安全感，而不是谁更成熟。',
    options: [
      ['先相信 TA 只是忙', '不给沉默立刻加上负面的解释'],
      ['回看自己有没有说清楚', '先整理表达，再决定要不要补充'],
      ['把手机放下做自己的事', '等待不需要占据整个晚上'],
      ['希望得到一个简单说明', '哪怕一句“晚点回”，都会让我更安定'],
    ],
  },
  {
    construct: '价值方向',
    title: '如果生活忽然送你一小笔没有用途限制的钱，你最想把它变成什么？',
    subtitle: '有时我们把钱花在哪里，也在悄悄表达自己最看重什么。',
    options: [
      ['一段新的旅程', '去陌生的地方，让世界重新变大一点'],
      ['更舒服的日常', '把家和生活整理得更安稳、更顺手'],
      ['一项想学很久的能力', '把它变成未来会留下来的东西'],
      ['一份可见的安全感', '先存下来，让未来多一点选择余地'],
    ],
  },
  {
    construct: '成长愿望',
    title: '想象半年后的你站在一座长得更好的花园里，你最希望哪一株植物已经扎稳了根？',
    subtitle: '选一件你真正想练习的事，不必一次改变很多。',
    options: [
      ['更清楚的边界', '知道什么时候靠近，也知道什么时候说“不”'],
      ['更真实的表达', '不再把重要的话都留在心里'],
      ['更笃定的方向', '对工作和生活有更稳定的坐标'],
      ['更舒服的亲密', '愿意依赖，也不把自己弄丢'],
    ],
  },
]

const seedBottles: DriftBottle[] = [
  {
    id: 'sea-seed-1',
    content: '最近开始接受：有些关系不需要立刻有答案。只是偶尔还是会想，慢慢靠近是不是也算一种勇敢。',
    author: '海岸线',
    anonymous: true,
    createdAt: '2026-08-12T21:20:00+08:00',
    replies: [],
  },
  {
    id: 'sea-seed-2',
    content: '如果你也正在经历一个不确定的阶段，希望今晚的风能替我告诉你：先把今天过完，也很好。',
    author: '晚风',
    anonymous: false,
    createdAt: '2026-08-13T23:08:00+08:00',
    replies: [],
  },
  {
    id: 'sea-seed-3',
    content: '我发现真正喜欢自己的时候，不是觉得自己很厉害，而是难过的时候也愿意陪自己待一会儿。',
    author: '岛屿来信',
    anonymous: true,
    createdAt: '2026-08-14T18:42:00+08:00',
    replies: [],
  },
]

function readStored<T>(key: string, fallback: T): T {
  try {
    const raw = window.localStorage.getItem(key)
    return raw ? (JSON.parse(raw) as T) : fallback
  } catch {
    return fallback
  }
}

function usePersistentState<T>(key: string, fallback: T) {
  const [value, setValue] = useState<T>(() => readStored(key, fallback))
  useEffect(() => {
    window.localStorage.setItem(key, JSON.stringify(value))
  }, [key, value])
  return [value, setValue] as const
}

function todayKey() {
  const now = new Date()
  const year = now.getFullYear()
  const month = String(now.getMonth() + 1).padStart(2, '0')
  const day = String(now.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}

function formatExactDate(value: string) {
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return value
  return new Intl.DateTimeFormat('zh-CN', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  }).format(date)
}

function applyAssessmentSceneCopy() {
  const card = document.querySelector<HTMLElement>('.assessment-panel .question-card')
  const titleNode = document.querySelector<HTMLElement>('.assessment-panel .assessment-title h1')
  if (!card || !titleNode) return
  const match = titleNode.textContent?.match(/(\d+)/)
  const index = Math.max(0, Math.min(assessmentSceneCopy.length - 1, Number(match?.[1] ?? 1) - 1))
  const copy = assessmentSceneCopy[index]
  const construct = card.querySelector<HTMLElement>('.question-construct')
  const question = card.querySelector<HTMLElement>('h2')
  const subtitle = document.querySelector<HTMLElement>('.assessment-panel .assessment-title p')
  if (construct && construct.textContent !== copy.construct) construct.textContent = copy.construct
  if (question && question.textContent !== copy.title) question.textContent = copy.title
  if (subtitle && subtitle.textContent !== copy.subtitle) subtitle.textContent = copy.subtitle
  const buttons = [...card.querySelectorAll<HTMLButtonElement>('.option-card')]
  buttons.forEach((button, optionIndex) => {
    const optionCopy = copy.options[optionIndex]
    if (!optionCopy) return
    const strong = button.querySelector<HTMLElement>('strong')
    const span = button.querySelector<HTMLElement>('span')
    if (strong && strong.textContent !== optionCopy[0]) strong.textContent = optionCopy[0]
    if (span && span.textContent !== optionCopy[1]) span.textContent = optionCopy[1]
  })
}

function EnhancementLayer() {
  const [meetTarget, setMeetTarget] = useState<HTMLElement | null>(null)
  const [treeTarget, setTreeTarget] = useState<HTMLElement | null>(null)
  const [session, setSession] = useState(() => ({
    token: readStored<string | null>('mirror-isle:auth-token', null),
    profile: readStored<StoredProfile | null>('mirror-isle:profile', null),
  }))

  useEffect(() => {
    let lastToken = JSON.stringify(session.token)
    let lastProfile = JSON.stringify(session.profile)
    const refresh = () => {
      const panes = [...document.querySelectorAll<HTMLElement>('.swipe-pane')]
      const nextMeet = panes[0] ?? null
      const nextTree = panes[1] ?? null
      if (nextMeet !== meetTarget) setMeetTarget(nextMeet)
      if (nextTree !== treeTarget) setTreeTarget(nextTree)
      nextMeet?.classList.add('enhanced-v013-meet')
      nextTree?.classList.add('enhanced-v013-tree')
      applyAssessmentSceneCopy()

      const token = readStored<string | null>('mirror-isle:auth-token', null)
      const profile = readStored<StoredProfile | null>('mirror-isle:profile', null)
      const tokenJson = JSON.stringify(token)
      const profileJson = JSON.stringify(profile)
      if (tokenJson !== lastToken || profileJson !== lastProfile) {
        lastToken = tokenJson
        lastProfile = profileJson
        setSession({ token, profile })
      }
    }

    refresh()
    const observer = new MutationObserver(refresh)
    observer.observe(document.body, { childList: true, subtree: true, characterData: true })
    const timer = window.setInterval(refresh, 1200)
    return () => {
      observer.disconnect()
      window.clearInterval(timer)
      meetTarget?.classList.remove('enhanced-v013-meet')
      treeTarget?.classList.remove('enhanced-v013-tree')
    }
  }, [meetTarget, session.profile, session.token, treeTarget])

  return (
    <>
      {meetTarget && session.profile
        ? createPortal(<MeetEnhancements nickname={session.profile.nickname ?? '你'} />, meetTarget)
        : null}
      {treeTarget && session.profile
        ? createPortal(
            <TreeUpgrade token={session.token} nickname={session.profile.nickname ?? '你'} />,
            treeTarget,
          )
        : null}
    </>
  )
}

function MeetEnhancements({ nickname }: { nickname: string }) {
  const [moods, setMoods] = usePersistentState<MoodEntry[]>(MOOD_KEY, [])
  const [wallet, setWallet] = usePersistentState<Wallet>(WALLET_KEY, { points: 0, bottleCredits: 0 })
  const today = todayKey()
  const existing = moods.find((entry) => entry.date === today)
  const [selectedMood, setSelectedMood] = useState<MoodKey>(existing?.mood ?? 'breeze')
  const [moodNote, setMoodNote] = useState(existing?.note ?? '')
  const [showMoodEditor, setShowMoodEditor] = useState(!existing)
  const [wellbeingAnswers, setWellbeingAnswers] = usePersistentState<number[]>('mirror-isle:wellbeing-index-v1', [3, 3, 3, 3, 3])
  const wellbeingIndex = Math.round((wellbeingAnswers.reduce((sum, item) => sum + item, 0) / 20) * 100)
  const streak = useMemo(() => computeStreak(moods), [moods])

  const saveMood = () => {
    const now = new Date().toISOString()
    if (existing) {
      setMoods(moods.map((entry) => (entry.date === today ? { ...entry, mood: selectedMood, note: moodNote, createdAt: now } : entry)))
    } else {
      setMoods([{ date: today, mood: selectedMood, note: moodNote.trim(), createdAt: now }, ...moods].slice(0, 180))
      setWallet({ ...wallet, points: wallet.points + 10 })
    }
    setShowMoodEditor(false)
  }

  return (
    <div className="v013-meet-shell">
      <section className="v013-mood-card">
        <div className="v013-card-head">
          <div>
            <span className="v013-kicker"><Leaf size={14} /> 每日心情</span>
            <h2>今天的你，是什么天气？</h2>
          </div>
          <span className="v013-points"><Star size={14} /> {wallet.points} 心贝</span>
        </div>

        {!showMoodEditor && existing ? (
          <button className="v013-mood-summary" onClick={() => setShowMoodEditor(true)}>
            <span>{moodOptions.find((item) => item.key === existing.mood)?.symbol}</span>
            <div>
              <strong>{moodOptions.find((item) => item.key === existing.mood)?.label}</strong>
              <small>{existing.note || '今天没有写文字，也是一种记录。'}</small>
            </div>
            <ChevronRight size={17} />
          </button>
        ) : (
          <>
            <div className="v013-mood-grid">
              {moodOptions.map((item) => (
                <button
                  key={item.key}
                  className={selectedMood === item.key ? 'active' : ''}
                  onClick={() => setSelectedMood(item.key)}
                >
                  <span>{item.symbol}</span>
                  <strong>{item.label}</strong>
                  <small>{item.hint}</small>
                </button>
              ))}
            </div>
            <textarea
              value={moodNote}
              onChange={(event) => setMoodNote(event.target.value)}
              placeholder="如果愿意，再给今天留一句话……"
              maxLength={240}
            />
            <button className="v013-primary" onClick={saveMood}>
              <CircleCheck size={16} />
              {existing ? '更新今天的记录' : '记录今天 · +10 心贝'}
            </button>
          </>
        )}
        <div className="v013-meta-row">
          <span>连续记录 {streak} 天</span>
          <span>10 心贝可兑换 1 次捡瓶机会</span>
        </div>
      </section>

      <section className="v013-wellbeing-card">
        <div className="v013-card-head">
          <div>
            <span className="v013-kicker"><ShieldCheck size={14} /> 心理状态</span>
            <h2>给最近的自己做一次温和体检</h2>
          </div>
          <div className="v013-index-ring" style={{ '--index': `${wellbeingIndex * 3.6}deg` } as React.CSSProperties}>
            <strong>{wellbeingIndex}</strong>
            <small>心境指数</small>
          </div>
        </div>
        <p className="v013-copy">根据你对最近两周精力、睡眠、平静感、兴趣与连接感的自评生成，仅用于自我观察，不作为心理诊断。</p>
        <div className="v013-index-questions">
          {['我仍能感到一些精力', '睡眠大体能让我恢复', '情绪有机会慢慢平静下来', '我还能对一些事感兴趣', '我仍能感到与人或生活有连接'].map((label, index) => (
            <label key={label}>
              <span>{label}</span>
              <input
                type="range"
                min="0"
                max="4"
                step="1"
                value={wellbeingAnswers[index]}
                onChange={(event) => {
                  const next = [...wellbeingAnswers]
                  next[index] = Number(event.target.value)
                  setWellbeingAnswers(next)
                }}
              />
            </label>
          ))}
        </div>
        <div className="v013-link-row">
          <button onClick={() => openLink('https://www.who.int/zh/publications/m/item/WHO-UCN-MSD-MHE-2024.01')}>
            WHO-5 幸福感指数资料 <ChevronRight size={15} />
          </button>
          <button onClick={() => openLink('https://www.who.int/tools/whoqol')}>
            WHO 生活质量评估资料 <ChevronRight size={15} />
          </button>
        </div>
      </section>

      <DriftSea nickname={nickname} wallet={wallet} setWallet={setWallet} />
    </div>
  )
}

function DriftSea({
  nickname,
  wallet,
  setWallet,
}: {
  nickname: string
  wallet: Wallet
  setWallet: (value: Wallet) => void
}) {
  const [bottles, setBottles] = usePersistentState<DriftBottle[]>(BOTTLE_KEY, seedBottles)
  const [activeBottle, setActiveBottle] = useState<DriftBottle | null>(null)
  const [composeOpen, setComposeOpen] = useState(false)
  const [composeText, setComposeText] = useState('')
  const [composeAnonymous, setComposeAnonymous] = useState(true)
  const [replyText, setReplyText] = useState('')
  const [replyAnonymous, setReplyAnonymous] = useState(true)

  const redeem = () => {
    if (wallet.points < 10) return
    setWallet({ points: wallet.points - 10, bottleCredits: wallet.bottleCredits + 1 })
  }

  const pickBottle = () => {
    if (wallet.bottleCredits < 1) return
    const pool = bottles.filter((item) => item.id !== activeBottle?.id)
    const bottle = pool[Math.floor(Math.random() * pool.length)] ?? bottles[0]
    if (!bottle) return
    setWallet({ ...wallet, bottleCredits: wallet.bottleCredits - 1 })
    setActiveBottle(bottle)
    setReplyText('')
  }

  const throwBottle = () => {
    if (!composeText.trim()) return
    const next: DriftBottle = {
      id: `bottle-${Date.now()}`,
      content: composeText.trim(),
      author: nickname,
      anonymous: composeAnonymous,
      createdAt: new Date().toISOString(),
      replies: [],
    }
    setBottles([next, ...bottles])
    setComposeText('')
    setComposeOpen(false)
  }

  const reply = () => {
    if (!activeBottle || !replyText.trim()) return
    const nextReply: BottleReply = {
      id: `reply-${Date.now()}`,
      content: replyText.trim(),
      anonymous: replyAnonymous,
      createdAt: new Date().toISOString(),
    }
    const nextBottles = bottles.map((item) =>
      item.id === activeBottle.id ? { ...item, replies: [...item.replies, nextReply] } : item,
    )
    setBottles(nextBottles)
    setActiveBottle({ ...activeBottle, replies: [...activeBottle.replies, nextReply] })
    setReplyText('')
  }

  return (
    <section className="v013-drift-card">
      <div className="v013-card-head drift-head">
        <div>
          <span className="v013-kicker"><Moon size={14} /> 漂流海</span>
          <h2>有些话，不必知道会漂到谁身边</h2>
        </div>
        <span className="v013-credit">可捡 {wallet.bottleCredits} 次</span>
      </div>

      <div className="v013-ocean" aria-label="动态漂流海">
        <i className="wave wave-one" />
        <i className="wave wave-two" />
        <button className="floating-bottle bottle-a" onClick={pickBottle} aria-label="捡起漂流瓶">✉</button>
        <button className="floating-bottle bottle-b" onClick={pickBottle} aria-label="捡起漂流瓶">✉</button>
        <button className="floating-bottle bottle-c" onClick={pickBottle} aria-label="捡起漂流瓶">✉</button>
        <div className="ocean-copy">
          <strong>海面正在缓慢流动</strong>
          <span>兑换一次机会，再从海里随机捡起一封陌生来信</span>
        </div>
      </div>

      <div className="v013-drift-actions">
        <button className="v013-secondary" onClick={redeem} disabled={wallet.points < 10}>
          <Star size={15} /> 10 心贝兑换 1 次
        </button>
        <button className="v013-primary" onClick={pickBottle} disabled={wallet.bottleCredits < 1}>
          <Sparkles size={15} /> 捡一个漂流瓶
        </button>
        <button className="v013-ghost" onClick={() => setComposeOpen((value) => !value)}>
          <Plus size={15} /> 投一封自己的信
        </button>
      </div>

      {composeOpen && (
        <div className="v013-compose">
          <textarea value={composeText} onChange={(event) => setComposeText(event.target.value)} placeholder="把想让海带走的话写在这里……" maxLength={600} />
          <label className="v013-check">
            <input type="checkbox" checked={composeAnonymous} onChange={(event) => setComposeAnonymous(event.target.checked)} />
            匿名投递
          </label>
          <button className="v013-primary" onClick={throwBottle}><Send size={15} /> 放进海里</button>
        </div>
      )}

      {activeBottle && (
        <article className="v013-bottle-letter">
          <header>
            <span>{activeBottle.anonymous ? '来自一座匿名小岛' : activeBottle.author}</span>
            <small>{formatExactDate(activeBottle.createdAt)}</small>
          </header>
          <p>{activeBottle.content}</p>
          {activeBottle.replies.length > 0 && (
            <div className="v013-replies">
              {activeBottle.replies.map((item) => (
                <div key={item.id}>
                  <strong>{item.anonymous ? '匿名回信' : nickname}</strong>
                  <span>{item.content}</span>
                </div>
              ))}
            </div>
          )}
          <textarea value={replyText} onChange={(event) => setReplyText(event.target.value)} placeholder="回一封不急着得到答案的信……" maxLength={400} />
          <div className="v013-reply-actions">
            <label className="v013-check">
              <input type="checkbox" checked={replyAnonymous} onChange={(event) => setReplyAnonymous(event.target.checked)} />
              匿名回信
            </label>
            <button className="v013-primary" onClick={reply}><MessageCircle size={15} /> 回信</button>
          </div>
        </article>
      )}
      <p className="v013-safety-note">匿名只隐藏前台昵称；涉及骚扰、联系方式或高风险内容仍应保留安全审核能力。当前为内测漂流海，记录保存在本设备。</p>
    </section>
  )
}

function TreeUpgrade({ token, nickname }: { token: string | null; nickname: string }) {
  const [mode, setMode] = useState<TreeMode>('private')
  const [privateNotes, setPrivateNotes] = usePersistentState<PrivateNote[]>(PRIVATE_TREE_KEY, [])
  const [privateDraft, setPrivateDraft] = useState('')
  const [publicDraft, setPublicDraft] = useState('')
  const [publicPosts, setPublicPosts] = useState<ApiTreePost[]>([])
  const [loading, setLoading] = useState(false)
  const [message, setMessage] = useState('')

  const loadSquare = async () => {
    if (!token) return
    setLoading(true)
    try {
      const result = await fetchTreePosts(token)
      setPublicPosts(result.items.filter((item) => item.visibility === 'public'))
    } catch {
      setMessage('广场暂时没有连上，稍后再试。')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    if (mode === 'square') void loadSquare()
  }, [mode, token])

  const savePrivate = () => {
    if (!privateDraft.trim()) return
    setPrivateNotes([
      { id: `private-${Date.now()}`, content: privateDraft.trim(), createdAt: new Date().toISOString() },
      ...privateNotes,
    ])
    setPrivateDraft('')
    setMessage('已经替你收好，只留在这台设备里。')
  }

  const publishPublic = async () => {
    if (!token || !publicDraft.trim()) return
    setLoading(true)
    try {
      await createTreePost(token, publicDraft.trim(), 'public', ['广场'])
      setPublicDraft('')
      await loadSquare()
      setMessage('已送到广场。')
    } catch {
      setMessage('发布失败，请稍后重试。')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="v013-tree-shell">
      <section className="v013-tree-intro">
        <span className="v013-kicker"><Heart size={14} /> 一处安放情绪的地方</span>
        <h1>{mode === 'private' ? '树洞只属于你' : '去广场看看别人的此刻'}</h1>
        <div className="v013-tree-tabs">
          <button className={mode === 'private' ? 'active' : ''} onClick={() => setMode('private')}>
            <ShieldCheck size={16} /> 私密树洞
          </button>
          <button className={mode === 'square' ? 'active' : ''} onClick={() => setMode('square')}>
            <MessageCircle size={16} /> 广场
          </button>
        </div>
      </section>

      {mode === 'private' ? (
        <>
          <section className="v013-tree-compose private">
            <div>
              <strong>写给此刻的自己</strong>
              <span>这里的内容不上传到广场，也不会展示给其他用户。</span>
            </div>
            <textarea value={privateDraft} onChange={(event) => setPrivateDraft(event.target.value)} placeholder="可以写完整，也可以只写一句没有整理好的心情……" maxLength={2000} />
            <button className="v013-primary" onClick={savePrivate}><PenLine size={16} /> 收进树洞</button>
          </section>
          <div className="v013-private-list">
            {privateNotes.length ? privateNotes.map((note) => (
              <article key={note.id}>
                <header><strong>{nickname} 的树洞</strong><time>{formatExactDate(note.createdAt)}</time></header>
                <p>{note.content}</p>
              </article>
            )) : (
              <div className="v013-empty">还没有记录。第一句话不需要写得漂亮。</div>
            )}
          </div>
        </>
      ) : (
        <>
          <section className="v013-tree-compose square">
            <div>
              <strong>发布到广场</strong>
              <span>广场内容会被其他内测用户看到，请避免留下联系方式和敏感隐私。</span>
            </div>
            <textarea value={publicDraft} onChange={(event) => setPublicDraft(event.target.value)} placeholder="写一段愿意被别人看到的话……" maxLength={1800} />
            <button className="v013-primary" onClick={publishPublic} disabled={loading || !token}><Plus size={16} /> 发布到广场</button>
          </section>
          <div className="v013-square-list">
            {loading && !publicPosts.length ? <div className="v013-empty">正在听见广场里的声音……</div> : null}
            {publicPosts.map((post) => (
              <article key={post.id}>
                <header>
                  <div><strong>{post.author}</strong><time>{formatExactDate(post.created_at)}</time></div>
                  <span>{post.status === 'approved' ? '广场' : '审核中'}</span>
                </header>
                <p>{post.content}</p>
                {post.tags?.length ? <div className="v013-tags">{post.tags.map((tag) => <span key={tag}>{tag}</span>)}</div> : null}
              </article>
            ))}
            {!loading && !publicPosts.length ? <div className="v013-empty">广场现在很安静。你可以留下第一句话。</div> : null}
          </div>
        </>
      )}

      {message ? <div className="v013-inline-message">{message}</div> : null}
    </div>
  )
}

function computeStreak(entries: MoodEntry[]) {
  if (!entries.length) return 0
  const dates = new Set(entries.map((entry) => entry.date))
  let streak = 0
  const cursor = new Date()
  for (let index = 0; index < 365; index += 1) {
    const key = `${cursor.getFullYear()}-${String(cursor.getMonth() + 1).padStart(2, '0')}-${String(cursor.getDate()).padStart(2, '0')}`
    if (!dates.has(key)) break
    streak += 1
    cursor.setDate(cursor.getDate() - 1)
  }
  return streak
}

function openLink(url: string) {
  window.open(url, '_blank', 'noopener,noreferrer')
}

export default EnhancementLayer
