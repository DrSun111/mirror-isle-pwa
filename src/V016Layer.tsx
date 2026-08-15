import { useEffect, useMemo, useState } from 'react'
import { createPortal } from 'react-dom'
import {
  ArrowLeft,
  Check,
  ChevronRight,
  Heart,
  Inbox,
  Leaf,
  LockKeyhole,
  MessageCircle,
  RefreshCw,
  Send,
  Sparkles,
  Star,
  Users,
  Waves,
} from 'lucide-react'
import AssessmentSceneArt, { type SceneKind } from './AssessmentSceneArt'
import {
  createTreeV016,
  fetchBottleRepliesV016,
  fetchDriftInboxV016,
  fetchDriftSeenAtV016,
  fetchLatestWellbeingV016,
  fetchMoodHistoryV016,
  fetchTreeV016,
  fetchWalletV016,
  markDriftSeenV016,
  pickRandomBottleV016,
  recordMoodV016,
  redeemBottleCreditV016,
  replyBottleV016,
  saveAssessmentV016,
  saveWellbeingV016,
  throwBottleV016,
  type DriftBottleV016,
  type DriftReplyV016,
  type MoodKeyV016,
  type MoodV016,
  type TreePostV016,
  type WalletV016,
} from './v016Api'
import './v016.css'

type BigFiveKey = 'extraversion' | 'agreeableness' | 'conscientiousness' | 'emotionalStability' | 'openness'

type Question = {
  id: string
  prompt: string
  scene: SceneKind
  factor: BigFiveKey
  labels: [string, string, string, string]
  sourceItem: string
}

// The scoring blueprint is grounded in the public-domain IPIP Big-Five factor markers.
// The wording/presentation is intentionally situational and visual, so this is a
// product-oriented personality tendency measure rather than a clinical diagnosis
// or a claim of norm-equivalence to the standard 50-item administration.
const questions: Question[] = [
  {
    id: 'forest-lodge',
    prompt: '你走进林间旅舍，屋里都是陌生人。你更自然会？',
    scene: 'lodge',
    factor: 'extraversion',
    labels: ['靠窗坐', '先观察', '加入聊天', '主动认识'],
    sourceItem: 'Feel comfortable around people / Start conversations',
  },
  {
    id: 'campfire-silence',
    prompt: '篝火忽然安静下来，你通常会？',
    scene: 'campfire',
    factor: 'extraversion',
    labels: ['享受安静', '等人开口', '接住话题', '主动开场'],
    sourceItem: 'Am quiet around strangers / Start conversations',
  },
  {
    id: 'companion-low',
    prompt: '同行的人突然有些低落，你会先？',
    scene: 'comfort',
    factor: 'agreeableness',
    labels: ['留点空间', '问一句', '陪一会儿', '认真听'],
    sourceItem: "Sympathize with others' feelings / Take time out for others",
  },
  {
    id: 'stranger-help',
    prompt: '路边有人把东西散了一地，你更可能？',
    scene: 'help',
    factor: 'agreeableness',
    labels: ['提醒一下', '帮捡几个', '一起收好', '再陪一程'],
    sourceItem: 'Take time out for others / Feel others emotions',
  },
  {
    id: 'morning-pack',
    prompt: '明早要进山，睡前的你更像哪一幕？',
    scene: 'packing',
    factor: 'conscientiousness',
    labels: ['随手带', '大致准备', '列好清单', '提前收好'],
    sourceItem: 'Am always prepared / Follow a schedule',
  },
  {
    id: 'leave-camp',
    prompt: '准备离开营地时，你会怎样收尾？',
    scene: 'tidy',
    factor: 'conscientiousness',
    labels: ['晚点再说', '收自己的', '分类整理', '再检查遍'],
    sourceItem: 'Leave my belongings around / Pay attention to details',
  },
  {
    id: 'sudden-rain',
    prompt: '山路突然下起大雨，你的第一反应更像？',
    scene: 'rain',
    factor: 'emotionalStability',
    labels: ['有点慌', '先躲雨', '确认方向', '稳稳处理'],
    sourceItem: 'Get stressed out easily / Am relaxed most of the time',
  },
  {
    id: 'waiting-note',
    prompt: '重要的纸条一直没有回音，你会？',
    scene: 'waiting',
    factor: 'emotionalStability',
    labels: ['反复确认', '想很多', '先做别的', '安心等'],
    sourceItem: 'Worry about things / Am relaxed most of the time',
  },
  {
    id: 'unknown-path',
    prompt: '森林出现一条从没走过的小路，你更想？',
    scene: 'path',
    factor: 'openness',
    labels: ['走熟悉路', '看看路牌', '试走一段', '走向未知'],
    sourceItem: 'Have a vivid imagination / Am full of ideas',
  },
  {
    id: 'old-map',
    prompt: '你捡到一张画满奇怪符号的旧地图，会？',
    scene: 'map',
    factor: 'openness',
    labels: ['找明确指示', '猜一猜', '联想故事', '探索规律'],
    sourceItem: 'Have difficulty understanding abstract ideas / Spend time reflecting on things',
  },
]

const factorKeys: BigFiveKey[] = ['extraversion', 'agreeableness', 'conscientiousness', 'emotionalStability', 'openness']
const moodOptions: Array<{ key: MoodKeyV016; label: string; symbol: string }> = [
  { key: 'sunny', label: '晴朗', symbol: '☀' },
  { key: 'breeze', label: '微风', symbol: '≈' },
  { key: 'cloudy', label: '多云', symbol: '☁' },
  { key: 'rain', label: '小雨', symbol: '⌁' },
  { key: 'wave', label: '浪涌', symbol: '∿' },
]

const wellbeingItems = ['心情轻松', '平静放松', '精力充足', '醒来有恢复感', '生活有兴趣']
const wellbeingScale = ['没有', '很少', '有时', '一半', '多数', '一直']

function sleep(ms: number) {
  return new Promise((resolve) => window.setTimeout(resolve, ms))
}

function computeBigFive(responses: Record<string, number>) {
  const scores = {} as Record<BigFiveKey, number>
  factorKeys.forEach((factor) => {
    const values = questions
      .filter((q) => q.factor === factor)
      .map((q) => responses[q.id])
      .filter((value) => Number.isFinite(value))
    const average = values.length ? values.reduce((sum, value) => sum + value, 0) / values.length : 2.5
    scores[factor] = Math.round(((average - 1) / 3) * 100)
  })
  return scores
}

function legacyOptionIndexes(scores: Record<BigFiveKey, number>) {
  const band = (score: number) => (score < 30 ? 0 : score < 50 ? 1 : score < 70 ? 2 : 3)
  const e = band(scores.extraversion)
  const a = band(scores.agreeableness)
  const c = band(scores.conscientiousness)
  const s = band(scores.emotionalStability)
  const o = band(scores.openness)
  return [
    [0, 3, 1, 2][e],
    [3, 2, 1, 0][c],
    a >= 3 ? 2 : s <= 1 ? 1 : e >= 2 ? 0 : 3,
    s >= 3 ? 2 : s === 2 ? 0 : a >= 2 ? 1 : 3,
    o >= 3 ? 0 : o >= 2 ? 2 : c >= 2 ? 1 : 3,
    a >= 3 ? 3 : e >= 3 ? 1 : c >= 3 ? 2 : 0,
  ]
}

async function completeLegacyAssessment(indexes: number[]) {
  for (let guard = 0; guard < 8; guard += 1) {
    const panel = document.querySelector<HTMLElement>('.assessment-panel')
    if (!panel) return
    const title = panel.querySelector<HTMLElement>('.assessment-title h1')?.textContent ?? ''
    const parsed = title.match(/(\d+)\s*\/\s*6/) ?? title.match(/(\d+)/)
    const qIndex = Math.max(0, Math.min(5, Number(parsed?.[1] ?? guard + 1) - 1))
    const buttons = [...panel.querySelectorAll<HTMLButtonElement>('.question-card .option-card')]
    if (!buttons.length) return
    buttons[Math.max(0, Math.min(3, indexes[qIndex] ?? 1))]?.click()
    await sleep(180)
    if (!document.querySelector('.assessment-panel')) return
  }
}

function formatDateTime(value: string) {
  const d = new Date(value)
  if (Number.isNaN(d.getTime())) return value
  return new Intl.DateTimeFormat('zh-CN', { month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', hour12: false }).format(d)
}

function AssessmentV016({ target }: { target: HTMLElement }) {
  const [index, setIndex] = useState(0)
  const [responses, setResponses] = useState<Record<string, number>>({})
  const [selected, setSelected] = useState<number | null>(null)
  const [busy, setBusy] = useState(false)
  const [message, setMessage] = useState('')
  const question = questions[index]

  useEffect(() => {
    target.classList.add('v016-assessment-host')
    return () => target.classList.remove('v016-assessment-host')
  }, [target])

  useEffect(() => {
    setSelected(responses[question.id] ?? null)
  }, [index, question.id, responses])

  const goNext = async (skip = false) => {
    if (busy) return
    const nextResponses = { ...responses }
    if (!skip && selected != null) nextResponses[question.id] = selected
    setResponses(nextResponses)
    if (index < questions.length - 1) {
      setIndex((value) => value + 1)
      setMessage('')
      return
    }

    setBusy(true)
    setMessage('正在保存…')
    try {
      const scores = computeBigFive(nextResponses)
      await saveAssessmentV016(scores, nextResponses)
      await completeLegacyAssessment(legacyOptionIndexes(scores))
    } catch (error) {
      console.error('v016 assessment save failed', error)
      setMessage('网络没有连上，请再试一次')
      setBusy(false)
    }
  }

  return createPortal(
    <section className="v016-assessment-root">
      <header className="v016-assessment-top">
        <div className="v016-progress"><span style={{ width: `${((index + 1) / questions.length) * 100}%` }} /></div>
        <span>{index + 1}/{questions.length}</span>
      </header>
      <div className="v016-assessment-scroll">
        <div className="v016-assessment-copy">
          <small>心林漫游</small>
          <h1>{question.prompt}</h1>
        </div>
        <div className="v016-option-grid">
          {question.labels.map((label, optionIndex) => {
            const value = optionIndex + 1
            const active = selected === value
            return (
              <button
                key={label}
                className={`v016-option${active ? ' active' : ''}`}
                onClick={() => setSelected(value)}
                aria-pressed={active}
              >
                <AssessmentSceneArt kind={question.scene} level={optionIndex as 0 | 1 | 2 | 3} />
                <span>{label}</span>
                {active ? <i><Check size={14} /></i> : null}
              </button>
            )
          })}
        </div>
        {message ? <div className="v016-assessment-message">{message}</div> : null}
      </div>
      <footer className="v016-assessment-actions">
        <button className="v016-skip" disabled={busy} onClick={() => void goNext(true)}>跳过</button>
        <button className="v016-next" disabled={busy || selected == null} onClick={() => void goNext(false)}>
          {index === questions.length - 1 ? '完成' : '下一题'} <ChevronRight size={17} />
        </button>
      </footer>
    </section>,
    target,
  )
}

function MoodV016() {
  const [moods, setMoods] = useState<MoodV016[]>([])
  const [wallet, setWallet] = useState<WalletV016>({ points: 0, bottleCredits: 0 })
  const [mood, setMood] = useState<MoodKeyV016>('breeze')
  const [note, setNote] = useState('')
  const [busy, setBusy] = useState(false)
  const [message, setMessage] = useState('')

  const load = async () => {
    try {
      const [history, nextWallet] = await Promise.all([fetchMoodHistoryV016(), fetchWalletV016()])
      setMoods(history)
      setWallet(nextWallet)
      const today = new Date().toLocaleDateString('en-CA')
      const existing = history.find((item) => item.date === today)
      if (existing) {
        setMood(existing.mood)
        setNote(existing.note)
      }
    } catch {
      setMessage('网络暂时不可用')
    }
  }

  useEffect(() => { void load() }, [])

  const save = async () => {
    setBusy(true)
    try {
      const result = await recordMoodV016(mood, note)
      setWallet(result.wallet)
      setMessage(result.awarded ? '+10 心贝' : '已更新')
      await load()
    } catch {
      setMessage('保存失败，请重试')
    } finally {
      setBusy(false)
    }
  }

  return (
    <section className="v016-meet-module v016-mood">
      <div className="v016-card-head"><div><small>每日心情</small><h2>今天像什么天气？</h2></div><b>{wallet.points} 心贝</b></div>
      <div className="v016-mood-row">
        {moodOptions.map((item) => (
          <button key={item.key} className={mood === item.key ? 'active' : ''} onClick={() => setMood(item.key)}>
            <strong>{item.symbol}</strong><span>{item.label}</span>
          </button>
        ))}
      </div>
      <textarea value={note} onChange={(e) => setNote(e.target.value)} maxLength={240} placeholder="想留一句话吗？（可不写）" />
      <button className="v016-main-action" onClick={() => void save()} disabled={busy}>{busy ? '保存中…' : '保存今天'}</button>
      <div className="v016-inline-status"><span>{message}</span><span>{moods.length ? `已记录 ${moods.length} 天` : ''}</span></div>
    </section>
  )
}

function WellbeingV016() {
  const [answers, setAnswers] = useState([3, 3, 3, 3, 3])
  const [score, setScore] = useState<number | null>(null)
  const [busy, setBusy] = useState(false)
  const [message, setMessage] = useState('')

  useEffect(() => {
    void fetchLatestWellbeingV016().then((row: any) => {
      if (row?.responses?.length === 5) setAnswers(row.responses.map(Number))
      if (typeof row?.percentage === 'number') setScore(row.percentage)
    }).catch(() => undefined)
  }, [])

  const save = async () => {
    setBusy(true)
    try {
      const result = await saveWellbeingV016(answers)
      setScore(result.percentage)
      setMessage('已同步')
    } catch {
      setMessage('保存失败，请重试')
    } finally {
      setBusy(false)
    }
  }

  return (
    <section className="v016-meet-module v016-wellbeing">
      <div className="v016-card-head"><div><small>最近两周</small><h2>此刻的状态</h2></div>{score != null ? <b>{score}/100</b> : null}</div>
      <div className="v016-wellbeing-list">
        {wellbeingItems.map((item, itemIndex) => (
          <div key={item} className="v016-wellbeing-item">
            <strong>{item}</strong>
            <div>{wellbeingScale.map((label, value) => (
              <button key={label} aria-label={`${item}：${label}`} className={answers[itemIndex] === value ? 'active' : ''} onClick={() => setAnswers((current) => current.map((v, i) => i === itemIndex ? value : v))}>{value}</button>
            ))}</div>
          </div>
        ))}
      </div>
      <div className="v016-scale-hint"><span>0 没有</span><span>5 一直</span></div>
      <button className="v016-main-action" onClick={() => void save()} disabled={busy}>{busy ? '保存中…' : '保存'}</button>
      <div className="v016-inline-status"><span>{message}</span><span>仅用于自我记录</span></div>
    </section>
  )
}

function DriftV016() {
  const [wallet, setWallet] = useState<WalletV016>({ points: 0, bottleCredits: 0 })
  const [bottle, setBottle] = useState<DriftBottleV016 | null>(null)
  const [replies, setReplies] = useState<DriftReplyV016[]>([])
  const [throwText, setThrowText] = useState('')
  const [replyText, setReplyText] = useState('')
  const [anonymous, setAnonymous] = useState(true)
  const [busy, setBusy] = useState(false)
  const [message, setMessage] = useState('')

  const refreshWallet = async () => {
    try { setWallet(await fetchWalletV016()) } catch { /* keep last synced state */ }
  }
  useEffect(() => { void refreshWallet() }, [])

  const pick = async () => {
    setBusy(true)
    setMessage('')
    try {
      let current = wallet
      if (current.bottleCredits < 1) {
        if (current.points < 10) throw new Error('not_enough_points')
        current = await redeemBottleCreditV016()
        setWallet(current)
      }
      const result = await pickRandomBottleV016()
      setWallet(result.wallet)
      setBottle(result.bottle)
      setReplies(result.bottle ? await fetchBottleRepliesV016(result.bottle.id) : [])
      if (!result.bottle) setMessage('海面暂时没有新的瓶子')
    } catch (error) {
      setMessage(error instanceof Error && error.message.includes('not_enough_points') ? '还需要 10 心贝' : '暂时没能捡到，请稍后再试')
    } finally {
      setBusy(false)
    }
  }

  const throwOne = async () => {
    if (!throwText.trim()) return
    setBusy(true)
    try {
      const row = await throwBottleV016(throwText, anonymous)
      setThrowText('')
      setMessage(row.status === 'approved' ? '已经漂向海面' : '已提交，正在安全审核')
    } catch { setMessage('投递失败，请重试') }
    finally { setBusy(false) }
  }

  const reply = async () => {
    if (!bottle || !replyText.trim()) return
    setBusy(true)
    try {
      await replyBottleV016(bottle.id, replyText, anonymous)
      setReplyText('')
      setReplies(await fetchBottleRepliesV016(bottle.id))
      setMessage('回信已送出')
    } catch { setMessage('回信失败，请重试') }
    finally { setBusy(false) }
  }

  return (
    <section className="v016-meet-module v016-drift">
      <div className="v016-card-head"><div><small>漂流海</small><h2>捡一封远方的信</h2></div><b>{wallet.points} 心贝</b></div>
      <div className="v016-sea-visual"><Waves size={40}/><span>{wallet.bottleCredits} 次机会</span></div>
      <button className="v016-main-action" onClick={() => void pick()} disabled={busy}><Sparkles size={16}/> {wallet.bottleCredits > 0 ? '随机捡一封' : '10 心贝 · 捡一封'}</button>
      {bottle ? (
        <article className="v016-bottle">
          <header><strong>{bottle.author}</strong><span>{formatDateTime(bottle.createdAt)}</span></header>
          <p>{bottle.content}</p>
          {replies.length ? <div className="v016-replies">{replies.map((r) => <div key={r.id}><b>{r.author}</b><span>{r.content}</span></div>)}</div> : null}
          <div className="v016-reply-row"><input value={replyText} onChange={(e) => setReplyText(e.target.value)} maxLength={500} placeholder="写一封回信"/><button onClick={() => void reply()} disabled={busy || !replyText.trim()}><Send size={16}/></button></div>
        </article>
      ) : null}
      <details className="v016-throw-box"><summary>投一个瓶子</summary><textarea value={throwText} onChange={(e) => setThrowText(e.target.value)} maxLength={800} placeholder="写下想让远方看见的话"/><div><label><input type="checkbox" checked={anonymous} onChange={(e) => setAnonymous(e.target.checked)}/> 匿名</label><button onClick={() => void throwOne()} disabled={busy || !throwText.trim()}>投向海面</button></div></details>
      <div className="v016-inline-status"><span>{message}</span><span>真实用户互捡</span></div>
    </section>
  )
}

function InboxV016() {
  const [items, setItems] = useState<any[]>([])
  const [seenAt, setSeenAt] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const [message, setMessage] = useState('')

  const load = async (mark = false) => {
    setBusy(true)
    try {
      const [nextItems, nextSeen] = await Promise.all([fetchDriftInboxV016(), fetchDriftSeenAtV016()])
      setItems(nextItems)
      setSeenAt(nextSeen)
      if (mark) setSeenAt(await markDriftSeenV016())
    } catch { setMessage('暂时没有连上信箱') }
    finally { setBusy(false) }
  }
  useEffect(() => { void load(true) }, [])

  const newCount = useMemo(() => {
    const threshold = seenAt ? new Date(seenAt).getTime() : 0
    return items.reduce((sum, item) => sum + item.replies.filter((r: DriftReplyV016) => new Date(r.createdAt).getTime() > threshold).length, 0)
  }, [items, seenAt])

  return (
    <section className="v016-meet-module v016-inbox">
      <div className="v016-card-head"><div><small>远方来信</small><h2>你的瓶子有回音吗？</h2></div><button className="v016-icon-action" onClick={() => void load(true)} disabled={busy}><RefreshCw size={16}/></button></div>
      {newCount ? <div className="v016-new-pill">{newCount} 封新回信</div> : null}
      <div className="v016-inbox-list">
        {items.length ? items.map((item) => <article key={item.id}><p>{item.content}</p><span>{formatDateTime(item.createdAt)}</span>{item.replies.map((r: DriftReplyV016) => <div key={r.id}><b>{r.author}</b><p>{r.content}</p><small>{formatDateTime(r.createdAt)}</small></div>)}</article>) : <div className="v016-empty">{busy ? '正在找回音…' : '还没有回信'}</div>}
      </div>
      {message ? <div className="v016-inline-status">{message}</div> : null}
    </section>
  )
}

function TreeV016() {
  const [mode, setMode] = useState<'private' | 'friends' | 'public'>('private')
  const [posts, setPosts] = useState<TreePostV016[]>([])
  const [draft, setDraft] = useState('')
  const [busy, setBusy] = useState(false)
  const [message, setMessage] = useState('')

  const load = async () => {
    setBusy(true)
    try { setPosts(await fetchTreeV016()); setMessage('') }
    catch { setMessage('暂时没有连上树洞') }
    finally { setBusy(false) }
  }
  useEffect(() => { void load() }, [])

  const visible = useMemo(() => posts.filter((post) => {
    if (mode === 'private') return post.mine && post.visibility === 'private'
    if (mode === 'friends') return post.visibility === 'friends'
    return post.visibility === 'public' && post.status === 'approved'
  }), [mode, posts])

  const publish = async () => {
    if (!draft.trim()) return
    setBusy(true)
    try {
      const row = await createTreeV016(draft, mode)
      setDraft('')
      setMessage(row.status === 'approved' || mode === 'private' ? '已保存' : '已提交审核')
      await load()
    } catch { setMessage('保存失败，请重试') }
    finally { setBusy(false) }
  }

  return (
    <section className="v016-tree-root">
      <header><div><small>树洞</small><h1>{mode === 'private' ? '写给自己的角落' : mode === 'friends' ? '只和朋友分享' : '岛屿广场'}</h1></div><button onClick={() => void load()}><RefreshCw size={16}/></button></header>
      <div className="v016-tree-tabs">
        <button className={mode === 'private' ? 'active' : ''} onClick={() => setMode('private')}><LockKeyhole size={15}/>私密</button>
        <button className={mode === 'friends' ? 'active' : ''} onClick={() => setMode('friends')}><Users size={15}/>好友</button>
        <button className={mode === 'public' ? 'active' : ''} onClick={() => setMode('public')}><MessageCircle size={15}/>广场</button>
      </div>
      <div className="v016-tree-compose"><textarea value={draft} onChange={(e) => setDraft(e.target.value)} maxLength={1200} placeholder={mode === 'private' ? '这里的内容只对你的账号可见' : '写下此刻…'}/><button onClick={() => void publish()} disabled={busy || !draft.trim()}><Send size={16}/></button></div>
      {message ? <div className="v016-inline-status">{message}</div> : null}
      <div className="v016-tree-list">
        {visible.length ? visible.map((post) => <article key={post.id}><header><b>{mode === 'private' ? '我' : post.author}</b><span>{formatDateTime(post.createdAt)}</span></header><p>{post.content}</p>{post.status !== 'approved' && mode !== 'private' ? <small>审核中</small> : null}</article>) : <div className="v016-empty">{busy ? '正在同步…' : '这里还很安静'}</div>}
      </div>
    </section>
  )
}

function MeetModulesV016({ target }: { target: HTMLElement }) {
  return createPortal(<><MoodV016/><WellbeingV016/><DriftV016/><InboxV016/></>, target)
}

export default function V016Layer() {
  const [assessment, setAssessment] = useState<HTMLElement | null>(null)
  const [meet, setMeet] = useState<HTMLElement | null>(null)
  const [tree, setTree] = useState<HTMLElement | null>(null)

  useEffect(() => {
    document.documentElement.classList.add('v016-warm-online')
    const refresh = () => {
      setAssessment((current) => {
        const next = document.querySelector<HTMLElement>('.assessment-panel')
        return current === next ? current : next
      })
      const panes = [...document.querySelectorAll<HTMLElement>('.swipe-pane')]
      setMeet((current) => current === (panes[0] ?? null) ? current : (panes[0] ?? null))
      setTree((current) => current === (panes[1] ?? null) ? current : (panes[1] ?? null))
    }
    refresh()
    const observer = new MutationObserver(refresh)
    observer.observe(document.body, { childList: true, subtree: true })
    const timer = window.setInterval(refresh, 1200)
    return () => {
      observer.disconnect()
      window.clearInterval(timer)
      document.documentElement.classList.remove('v016-warm-online')
    }
  }, [])

  return <>{assessment ? <AssessmentV016 target={assessment}/> : null}{meet ? <MeetModulesV016 target={meet}/> : null}{tree ? createPortal(<TreeV016/>, tree) : null}</>
}
