import { useEffect, useMemo, useState } from 'react'
import { createPortal } from 'react-dom'
import {
  ChevronRight,
  CircleCheck,
  Cloud,
  Heart,
  Leaf,
  MessageCircle,
  PenLine,
  Plus,
  Send,
  ShieldCheck,
  Sparkles,
  Star,
  Waves,
} from 'lucide-react'
import { createTreePost, fetchTreePosts, type ApiTreePost } from './api'
import {
  fetchDriftBottleReplies,
  fetchExperienceState,
  fetchRandomDriftBottle,
  isDriftPost,
  mergeLocalExperienceToAccount,
  recordSyncedMood,
  redeemSyncedBottleCredit,
  sendDriftBottleReply,
  spendSyncedBottleCredit,
  throwDriftBottle,
  type DriftBottleRecord,
  type DriftReplyRecord,
  type ExperienceMoodEntry,
  type ExperienceMoodKey,
  type ExperienceState,
  type ExperienceWallet,
} from './experienceApi'
import './enhancements.css'
import './experience-v014.css'

type TreeMode = 'private' | 'square'

interface PrivateNote {
  id: string
  content: string
  createdAt: string
}

interface StoredProfile {
  id?: string
  nickname?: string
}

const LEGACY_MOOD_KEY = 'mirror-isle:mood-checkins-v1'
const LEGACY_WALLET_KEY = 'mirror-isle:heart-shell-wallet-v1'
const PRIVATE_TREE_KEY = 'mirror-isle:private-tree-v1'
const PICKED_BOTTLES_KEY = 'mirror-isle:picked-bottles-v2'

const moodOptions: Array<{
  key: ExperienceMoodKey
  label: string
  hint: string
  symbol: string
}> = [
  { key: 'sunny', label: '晴朗', hint: '轻松，有一点期待', symbol: '☀' },
  { key: 'breeze', label: '微风', hint: '平静，状态还不错', symbol: '≈' },
  { key: 'cloudy', label: '多云', hint: '有些杂乱，但仍能照顾自己', symbol: '☁' },
  { key: 'rain', label: '小雨', hint: '低落，想把脚步放慢一点', symbol: '⌁' },
  { key: 'wave', label: '浪涌', hint: '情绪很满，需要一点空间', symbol: '∿' },
]

const forestStory = [
  {
    chapter: '第一幕 · 林缘',
    title: '想象你独自走进一片很安静的森林。阳光从树叶间落下来，前方出现四种不同的相遇。你最希望先走向哪一种？',
    subtitle: '不用分析哪一个更好。只选那个让你心里先松一点、愿意自然靠近的画面。',
    options: [
      ['一间亮着灯的小木屋', '里面很安静，有书、有热茶，也允许你先和自己待一会儿'],
      ['一处熟悉的小小营地', '几位让你安心的人围在一起，聊天不必很热闹'],
      ['一条从未走过的岔路', '路牌写着陌生地名，你有一点好奇，也愿意看看新的世界'],
      ['一位坐在溪边的人', '不需要寒暄太久，只想慢慢聊一些真正重要的事'],
    ],
  },
  {
    chapter: '第二幕 · 晨雾',
    title: '那天傍晚，你遇见了一位愿意同行的人。你们约好第二天清晨去看森林深处的湖。夜色落下来时，你会怎样等待明天？',
    subtitle: '这里没有“自律”与“随性”的高低，只是在看你最舒服的生活节奏。',
    options: [
      ['睡前把背包收好', '路线、天气和要带的东西都确认好，明早会更安心'],
      ['记住时间，准时出发', '不必准备得很满，但我会认真对待已经说好的约定'],
      ['允许彼此慢一点', '晚十分钟也没关系，只要彼此知道，心情不会被打乱'],
      ['等清晨到了再决定', '也许会换一条路，我喜欢把一点空间留给当下的感觉'],
    ],
  },
  {
    chapter: '第三幕 · 阵雨',
    title: '走到半山时，森林突然下起一阵雨。你和同行的人因为该往哪边走有了分歧，彼此都有一点不舒服。雨声里，你更希望接下来发生什么？',
    subtitle: '想象真实的自己。关系里的修复节奏，比“正确答案”更值得被看见。',
    options: [
      ['先把刚才的话说清楚', '趁彼此还记得发生了什么，认真确认对方真正想表达的意思'],
      ['先在树下安静一会儿', '让情绪慢慢退下来，再重新讨论刚才的分歧'],
      ['先听见彼此的感受', '如果知道自己的难过被理解了，我会更容易重新靠近'],
      ['先一起找到下一步', '先离开雨里、找到路，等安全下来再慢慢谈感受'],
    ],
  },
  {
    chapter: '第四幕 · 回声',
    title: '雨停后，你们暂时分开去找不同的路。你在一棵老树下留了一张很重要的纸条，却很久没有收到回应。等待的时候，你更像怎样的自己？',
    subtitle: '这不是在测“敏感不敏感”，而是在认识你在不确定里通常怎样寻找安全感。',
    options: [
      ['相信对方只是还没看见', '先不给沉默加上负面的解释，让事情自己再走一会儿'],
      ['回想纸条有没有写清楚', '我会先整理自己的表达，再决定是否需要补充一句'],
      ['继续去看森林里的风景', '等待可以存在，但不需要占据我整个下午'],
      ['希望收到一个简单信号', '哪怕只是告诉我“看到了，晚一点回应”，心里都会安稳很多'],
    ],
  },
  {
    chapter: '第五幕 · 礼物',
    title: '傍晚，你找到了一棵会发光的树。树下放着一只小盒子，它可以替你实现一件不奢侈、但对你很重要的事。你最希望它变成什么？',
    subtitle: '我们真正珍惜的东西，常常藏在这些不经意的选择里。',
    options: [
      ['一张通往远方的车票', '去一个没去过的地方，让生活重新出现一些新鲜感'],
      ['一间更舒服的小房间', '把日常安顿好，让回到自己的生活里变得踏实'],
      ['一本能教会我新能力的书', '把礼物变成未来仍会留在自己身上的东西'],
      ['一枚可以留到以后再用的种子', '先把选择权保存下来，让未来多一点余地和安全感'],
    ],
  },
  {
    chapter: '第六幕 · 出林',
    title: '天快黑了，你走到森林出口。临别前，森林允许你带走一枚种子。半年以后，它会长成一种你最想拥有的力量。你希望它是什么？',
    subtitle: '最后一幕不需要许很大的愿望。只选一种你真的愿意慢慢练习的能力。',
    options: [
      ['更清楚地守住自己的边界', '知道什么时候靠近，也知道什么时候可以温柔而坚定地说“不”'],
      ['更自然地说出真实的想法', '重要的话不再总留在心里，也允许别人真正认识我'],
      ['更笃定地知道自己往哪里走', '对工作、生活和未来，有一个更稳定的内在坐标'],
      ['更舒服地进入一段亲密关系', '愿意依赖、愿意靠近，同时也不把自己弄丢'],
    ],
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

function applyForestStoryCopy() {
  const panel = document.querySelector<HTMLElement>('.assessment-panel')
  const card = panel?.querySelector<HTMLElement>('.question-card') ?? null
  const titleNode = panel?.querySelector<HTMLElement>('.assessment-title h1') ?? null
  if (!panel || !card || !titleNode) return

  const match = titleNode.textContent?.match(/(\d+)/)
  const index = Math.max(0, Math.min(forestStory.length - 1, Number(match?.[1] ?? 1) - 1))
  const copy = forestStory[index]
  panel.classList.add('v014-forest-assessment')

  const construct = card.querySelector<HTMLElement>('.question-construct')
  const question = card.querySelector<HTMLElement>('h2')
  const subtitle = panel.querySelector<HTMLElement>('.assessment-title p')
  const nextTitle = `心林漫游 · ${index + 1} / ${forestStory.length}`
  if (titleNode.textContent !== nextTitle) titleNode.textContent = nextTitle
  if (construct && construct.textContent !== copy.chapter) construct.textContent = copy.chapter
  if (question && question.textContent !== copy.title) question.textContent = copy.title
  if (subtitle && subtitle.textContent !== copy.subtitle) subtitle.textContent = copy.subtitle

  const buttons = [...card.querySelectorAll<HTMLButtonElement>('.option-card')]
  buttons.forEach((button, optionIndex) => {
    const option = copy.options[optionIndex]
    if (!option) return
    const strong = button.querySelector<HTMLElement>('strong')
    const span = button.querySelector<HTMLElement>('span')
    if (strong && strong.textContent !== option[0]) strong.textContent = option[0]
    if (span && span.textContent !== option[1]) span.textContent = option[1]
  })

  let trail = panel.querySelector<HTMLElement>('.v014-forest-trail')
  if (!trail) {
    trail = document.createElement('div')
    trail.className = 'v014-forest-trail'
    const questionCard = panel.querySelector('.question-card')
    questionCard?.parentElement?.insertBefore(trail, questionCard)
  }
  const nextTrail = `你正在沿着同一段故事继续向前 · ${copy.chapter}`
  if (trail.textContent !== nextTrail) trail.textContent = nextTrail
}

function ExperienceV014() {
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
      nextMeet?.classList.add('enhanced-v013-meet', 'enhanced-v014-meet')
      nextTree?.classList.add('enhanced-v013-tree', 'enhanced-v014-tree')
      applyForestStoryCopy()

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
      meetTarget?.classList.remove('enhanced-v013-meet', 'enhanced-v014-meet')
      treeTarget?.classList.remove('enhanced-v013-tree', 'enhanced-v014-tree')
    }
  }, [meetTarget, session.profile, session.token, treeTarget])

  return (
    <>
      {meetTarget && session.profile ? (
        createPortal(
          <MeetExperience
            token={session.token}
            profileId={session.profile.id ?? 'local'}
            nickname={session.profile.nickname ?? '你'}
          />,
          meetTarget,
        )
      ) : null}
      {treeTarget && session.profile ? (
        createPortal(
          <TreeUpgrade token={session.token} nickname={session.profile.nickname ?? '你'} />,
          treeTarget,
        )
      ) : null}
    </>
  )
}

function MeetExperience({
  token,
  profileId,
  nickname,
}: {
  token: string | null
  profileId: string
  nickname: string
}) {
  const legacyWallet = readStored<ExperienceWallet>(LEGACY_WALLET_KEY, { points: 0, bottleCredits: 0 })
  const legacyMoods = readStored<ExperienceMoodEntry[]>(LEGACY_MOOD_KEY, [])
  const [experience, setExperience] = useState<ExperienceState>(() => ({
    wallet: legacyWallet,
    moods: legacyMoods,
  }))
  const [syncing, setSyncing] = useState(false)
  const [syncMessage, setSyncMessage] = useState('正在连接你的账户记录…')
  const today = todayKey()
  const existing = experience.moods.find((entry) => entry.date === today)
  const [selectedMood, setSelectedMood] = useState<ExperienceMoodKey>(existing?.mood ?? 'breeze')
  const [moodNote, setMoodNote] = useState(existing?.note ?? '')
  const [showMoodEditor, setShowMoodEditor] = useState(!existing)
  const [wellbeingAnswers, setWellbeingAnswers] = usePersistentState<number[]>(
    'mirror-isle:wellbeing-index-v1',
    [3, 3, 3, 3, 3],
  )
  const wellbeingIndex = Math.round((wellbeingAnswers.reduce((sum, item) => sum + item, 0) / 20) * 100)
  const streak = useMemo(() => computeStreak(experience.moods), [experience.moods])

  useEffect(() => {
    if (!token) return
    let cancelled = false
    const load = async () => {
      setSyncing(true)
      const migrationKey = `mirror-isle:experience-v2-migrated:${profileId}`
      try {
        const hasLegacy = legacyWallet.points > 0 || legacyWallet.bottleCredits > 0 || legacyMoods.length > 0
        const migrated = window.localStorage.getItem(migrationKey) === '1'
        const state = !migrated && hasLegacy
          ? await mergeLocalExperienceToAccount(legacyWallet, legacyMoods)
          : await fetchExperienceState()
        if (cancelled) return
        setExperience(state)
        window.localStorage.setItem(LEGACY_WALLET_KEY, JSON.stringify(state.wallet))
        window.localStorage.setItem(LEGACY_MOOD_KEY, JSON.stringify(state.moods))
        window.localStorage.setItem(migrationKey, '1')
        setSyncMessage('已与账户同步')
      } catch {
        if (!cancelled) setSyncMessage('账户同步暂时不可用')
      } finally {
        if (!cancelled) setSyncing(false)
      }
    }
    void load()
    return () => {
      cancelled = true
    }
  }, [profileId, token])

  useEffect(() => {
    const current = experience.moods.find((entry) => entry.date === today)
    if (!current) return
    setSelectedMood(current.mood)
    setMoodNote(current.note)
  }, [experience.moods, today])

  const saveMood = async () => {
    if (!token || syncing) return
    setSyncing(true)
    try {
      const result = await recordSyncedMood(today, selectedMood, moodNote)
      setExperience(result.state)
      window.localStorage.setItem(LEGACY_WALLET_KEY, JSON.stringify(result.state.wallet))
      window.localStorage.setItem(LEGACY_MOOD_KEY, JSON.stringify(result.state.moods))
      setShowMoodEditor(false)
      setSyncMessage(result.awardedPoints ? '今日打卡已同步 · +10 心贝' : '今日记录已更新并同步')
    } catch {
      setSyncMessage('没有保存成功，请联网后再试')
    } finally {
      setSyncing(false)
    }
  }

  return (
    <div className="v013-meet-shell v014-meet-shell">
      <section className="v013-mood-card v014-mood-card">
        <div className="v013-card-head">
          <div>
            <span className="v013-kicker"><Leaf size={14} /> 每日心情</span>
            <h2>今天的你，是什么天气？</h2>
          </div>
          <span className="v013-points"><Star size={14} /> {experience.wallet.points} 心贝</span>
        </div>

        <div className={`v014-sync-line ${syncing ? 'syncing' : ''}`}>
          <CircleCheck size={13} />
          <span>{syncMessage}</span>
          <small>换设备登录同一账号也会保留</small>
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
            <button className="v013-primary" onClick={() => void saveMood()} disabled={syncing || !token}>
              <CircleCheck size={16} />
              {existing ? '更新今天的记录' : '记录今天 · +10 心贝'}
            </button>
          </>
        )}
        <div className="v013-meta-row">
          <span>连续记录 {streak} 天</span>
          <span>10 心贝 = 1 次捡瓶机会</span>
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
          <button onClick={() => openLink('https://www.who.int/publications/m/item/WHO-UCN-MSD-MHE-2024.01')}>
            WHO-5 幸福感指数资料 <ChevronRight size={15} />
          </button>
          <button onClick={() => openLink('https://www.who.int/tools/whoqol')}>
            WHO 生活质量评估资料 <ChevronRight size={15} />
          </button>
        </div>
      </section>

      <DriftSea
        token={token}
        nickname={nickname}
        experience={experience}
        setExperience={setExperience}
        syncing={syncing}
        setSyncing={setSyncing}
        setSyncMessage={setSyncMessage}
      />
    </div>
  )
}

function DriftSea({
  token,
  nickname,
  experience,
  setExperience,
  syncing,
  setSyncing,
  setSyncMessage,
}: {
  token: string | null
  nickname: string
  experience: ExperienceState
  setExperience: (state: ExperienceState) => void
  syncing: boolean
  setSyncing: (value: boolean) => void
  setSyncMessage: (value: string) => void
}) {
  const [activeBottle, setActiveBottle] = useState<DriftBottleRecord | null>(null)
  const [replies, setReplies] = useState<DriftReplyRecord[]>([])
  const [pickedIds, setPickedIds] = usePersistentState<string[]>(PICKED_BOTTLES_KEY, [])
  const [composeOpen, setComposeOpen] = useState(false)
  const [composeText, setComposeText] = useState('')
  const [composeAnonymous, setComposeAnonymous] = useState(true)
  const [replyText, setReplyText] = useState('')
  const [replyAnonymous, setReplyAnonymous] = useState(true)
  const [seaMessage, setSeaMessage] = useState('海面会从其他已登录用户的公开漂流瓶中随机捡取。')

  const cacheState = (state: ExperienceState) => {
    setExperience(state)
    window.localStorage.setItem(LEGACY_WALLET_KEY, JSON.stringify(state.wallet))
    window.localStorage.setItem(LEGACY_MOOD_KEY, JSON.stringify(state.moods))
  }

  const redeem = async () => {
    if (!token || syncing || experience.wallet.points < 10) return
    setSyncing(true)
    try {
      const state = await redeemSyncedBottleCredit()
      cacheState(state)
      setSyncMessage('兑换已同步到账户')
      setSeaMessage('你获得了一次捡瓶机会。海面上有一封真实用户留下的信在等你。')
    } catch {
      setSeaMessage('兑换没有成功，可能是积分刚刚在另一台设备发生了变化。')
    } finally {
      setSyncing(false)
    }
  }

  const pickBottle = async () => {
    if (!token || syncing || experience.wallet.bottleCredits < 1) return
    setSyncing(true)
    try {
      const bottle = await fetchRandomDriftBottle(pickedIds.slice(-40))
      if (!bottle) {
        setSeaMessage('现在还没有可以捡到的其他用户漂流瓶。等海里多一些声音再来看看。')
        return
      }
      const state = await spendSyncedBottleCredit()
      cacheState(state)
      setActiveBottle(bottle)
      setPickedIds([...pickedIds, bottle.id].slice(-80))
      const nextReplies = await fetchDriftBottleReplies(bottle.id)
      setReplies(nextReplies)
      setReplyText('')
      setSeaMessage('你捡到了一封来自真实用户的漂流信。')
    } catch {
      setSeaMessage('这次没有捡到，账户状态可能刚刚变化了，请再试一次。')
    } finally {
      setSyncing(false)
    }
  }

  const throwBottle = async () => {
    if (!token || syncing || !composeText.trim()) return
    setSyncing(true)
    try {
      const result = await throwDriftBottle(composeText, composeAnonymous)
      setComposeText('')
      setComposeOpen(false)
      setSeaMessage(
        result.status === 'approved'
          ? '你的瓶子已经进入真实海域，之后可能会被另一位用户随机捡到。'
          : '瓶子已经提交，完成安全审核后会进入真实海域。',
      )
    } catch {
      setSeaMessage('这封信暂时没有投出去，请稍后再试。')
    } finally {
      setSyncing(false)
    }
  }

  const reply = async () => {
    if (!token || syncing || !activeBottle || !replyText.trim()) return
    setSyncing(true)
    try {
      const result = await sendDriftBottleReply(activeBottle.id, replyText, replyAnonymous)
      setReplyText('')
      const nextReplies = await fetchDriftBottleReplies(activeBottle.id)
      setReplies(nextReplies)
      setSeaMessage(result.status === 'approved' ? '回信已经送到这只漂流瓶旁。' : '回信正在安全审核中。')
    } catch {
      setSeaMessage('回信没有送出，请稍后再试。')
    } finally {
      setSyncing(false)
    }
  }

  return (
    <section className="v013-drift-card v014-drift-card">
      <div className="v013-card-head drift-head">
        <div>
          <span className="v013-kicker"><Waves size={14} /> 漂流海 · 真实海域</span>
          <h2>有些话，会真正漂到另一个人身边</h2>
        </div>
        <span className="v013-credit">可捡 {experience.wallet.bottleCredits} 次</span>
      </div>

      <div className="v014-real-sea-note">
        <Cloud size={15} />
        <span>{seaMessage}</span>
      </div>

      <div className="v013-ocean v014-ocean" aria-label="动态真实用户漂流海">
        <i className="wave wave-one" />
        <i className="wave wave-two" />
        <button className="floating-bottle bottle-a" onClick={() => void pickBottle()} aria-label="捡起真实用户漂流瓶">✉</button>
        <button className="floating-bottle bottle-b" onClick={() => void pickBottle()} aria-label="捡起真实用户漂流瓶">✉</button>
        <button className="floating-bottle bottle-c" onClick={() => void pickBottle()} aria-label="捡起真实用户漂流瓶">✉</button>
        <div className="ocean-copy">
          <strong>海面连接着所有已登录的内测用户</strong>
          <span>每次捡瓶都会随机选择一封不是自己投出的公开漂流信</span>
        </div>
      </div>

      <div className="v013-drift-actions">
        <button className="v013-secondary" onClick={() => void redeem()} disabled={experience.wallet.points < 10 || syncing || !token}>
          <Star size={15} /> 10 心贝兑换 1 次
        </button>
        <button className="v013-primary" onClick={() => void pickBottle()} disabled={experience.wallet.bottleCredits < 1 || syncing || !token}>
          <Sparkles size={15} /> 随机捡一个
        </button>
        <button className="v013-ghost" onClick={() => setComposeOpen((value) => !value)}>
          <Plus size={15} /> 投一封自己的信
        </button>
      </div>

      {composeOpen ? (
        <div className="v013-compose">
          <textarea
            value={composeText}
            onChange={(event) => setComposeText(event.target.value)}
            placeholder="写给一个你还不认识、也许刚好需要看到这些话的人……"
            maxLength={1600}
          />
          <div className="v013-reply-actions">
            <label className="v013-check">
              <input
                type="checkbox"
                checked={composeAnonymous}
                onChange={(event) => setComposeAnonymous(event.target.checked)}
              />
              匿名投递
            </label>
            <button className="v013-primary" onClick={() => void throwBottle()} disabled={syncing || !composeText.trim()}>
              <Send size={15} /> 投向海里
            </button>
          </div>
        </div>
      ) : null}

      {activeBottle ? (
        <article className="v013-bottle-letter v014-bottle-letter">
          <header>
            <span>{activeBottle.anonymous ? '来自一座匿名小岛' : activeBottle.author}</span>
            <small>{formatExactDate(activeBottle.createdAt)}</small>
          </header>
          <p>{activeBottle.content}</p>

          {replies.length ? (
            <div className="v013-replies">
              {replies.map((item) => (
                <div key={item.id}>
                  <strong>{item.anonymous ? '匿名回信' : item.mine ? nickname : item.author}</strong>
                  <span>{item.content}</span>
                  <small>{formatExactDate(item.createdAt)}</small>
                </div>
              ))}
            </div>
          ) : (
            <div className="v014-no-reply">还没有人回过这封信。你可以成为第一封温柔的回音。</div>
          )}

          <textarea
            value={replyText}
            onChange={(event) => setReplyText(event.target.value)}
            placeholder="回一封不急着得到答案的信……"
            maxLength={800}
          />
          <div className="v013-reply-actions">
            <label className="v013-check">
              <input
                type="checkbox"
                checked={replyAnonymous}
                onChange={(event) => setReplyAnonymous(event.target.checked)}
              />
              匿名回信
            </label>
            <button className="v013-primary" onClick={() => void reply()} disabled={syncing || !replyText.trim()}>
              <MessageCircle size={15} /> 回信
            </button>
          </div>
        </article>
      ) : null}

      <p className="v013-safety-note">匿名模式会在产品界面隐藏昵称；账号关系仍保留在后台用于内容安全和滥用处理。漂流瓶与回信来自真实登录用户，但不会进入普通广场信息流。</p>
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
      setPublicPosts(
        result.items.filter((item) => item.visibility === 'public' && !isDriftPost(item.tags)),
      )
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
            <textarea
              value={privateDraft}
              onChange={(event) => setPrivateDraft(event.target.value)}
              placeholder="可以写完整，也可以只写一句没有整理好的心情……"
              maxLength={2000}
            />
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
              <span>广场与漂流海已经分流；这里展示愿意公开给所有内测用户的普通帖子。</span>
            </div>
            <textarea
              value={publicDraft}
              onChange={(event) => setPublicDraft(event.target.value)}
              placeholder="写一段愿意被别人看到的话……"
              maxLength={1800}
            />
            <button className="v013-primary" onClick={() => void publishPublic()} disabled={loading || !token}>
              <Plus size={16} /> 发布到广场
            </button>
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

function computeStreak(entries: ExperienceMoodEntry[]) {
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

export default ExperienceV014
