import { useEffect, useMemo, useState } from 'react'
import { createPortal } from 'react-dom'
import {
  CalendarDays,
  ChevronLeft,
  ChevronRight,
  Globe2,
  Leaf,
  LockKeyhole,
  MessageCircle,
  RefreshCw,
  Send,
  Sparkles,
  Users,
  Wind,
} from 'lucide-react'
import { fetchFriends, type ApiRecommendation } from './api'
import {
  createTreeV016,
  fetchMoodHistoryV016,
  fetchTreeV016,
  fetchWalletV016,
  recordMoodV016,
  type MoodKeyV016,
  type MoodV016,
  type TreePostV016,
  type WalletV016,
} from './v016Api'
import './v017.css'

type SeenView = 'home' | 'tree' | 'world' | 'friends'

const moodMeta: Record<MoodKeyV016, { label: string; symbol: string }> = {
  sunny: { label: '晴朗', symbol: '☀' },
  breeze: { label: '微风', symbol: '≈' },
  cloudy: { label: '多云', symbol: '☁' },
  rain: { label: '小雨', symbol: '⌁' },
  wave: { label: '浪涌', symbol: '∿' },
}

const moodOrder: MoodKeyV016[] = ['sunny', 'breeze', 'cloudy', 'rain', 'wave']

function localDateKey(date: Date) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`
}

function parseLocalDate(value: string) {
  const [year, month, day] = value.split('-').map(Number)
  return new Date(year, Math.max(0, month - 1), day || 1)
}

function formatShortDate(value: string) {
  const date = parseLocalDate(value)
  return `${date.getMonth() + 1}月${date.getDate()}日`
}

function formatPostDate(value: string) {
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return ''
  return new Intl.DateTimeFormat('zh-CN', { month: 'numeric', day: 'numeric', hour: '2-digit', minute: '2-digit', hour12: false }).format(date)
}

function buildMonthCells(month: Date) {
  const year = month.getFullYear()
  const m = month.getMonth()
  const first = new Date(year, m, 1)
  const start = new Date(year, m, 1 - first.getDay())
  return Array.from({ length: 42 }, (_, index) => {
    const date = new Date(start)
    date.setDate(start.getDate() + index)
    return { date, key: localDateKey(date), current: date.getMonth() === m }
  })
}

function currentStreak(moods: MoodV016[]) {
  const dates = new Set(moods.map((item) => item.date))
  let cursor = new Date()
  let streak = 0
  while (dates.has(localDateKey(cursor))) {
    streak += 1
    cursor.setDate(cursor.getDate() - 1)
  }
  return streak
}

function MoodCalendarV017() {
  const [moods, setMoods] = useState<MoodV016[]>([])
  const [wallet, setWallet] = useState<WalletV016>({ points: 0, bottleCredits: 0 })
  const [month, setMonth] = useState(() => new Date(new Date().getFullYear(), new Date().getMonth(), 1))
  const [selectedDate, setSelectedDate] = useState(() => localDateKey(new Date()))
  const [mood, setMood] = useState<MoodKeyV016>('breeze')
  const [note, setNote] = useState('')
  const [busy, setBusy] = useState(false)
  const [message, setMessage] = useState('')

  const today = localDateKey(new Date())

  const load = async () => {
    try {
      const [history, nextWallet] = await Promise.all([fetchMoodHistoryV016(370), fetchWalletV016()])
      setMoods(history)
      setWallet(nextWallet)
      const todayRow = history.find((item) => item.date === today)
      if (todayRow) {
        setMood(todayRow.mood)
        setNote(todayRow.note)
      }
    } catch {
      setMessage('暂时没有连上记录')
    }
  }

  useEffect(() => { void load() }, [])

  const monthCells = useMemo(() => buildMonthCells(month), [month])
  const moodByDate = useMemo(() => new Map(moods.map((item) => [item.date, item])), [moods])
  const selected = moodByDate.get(selectedDate)
  const monthRows = moods.filter((item) => {
    const date = parseLocalDate(item.date)
    return date.getFullYear() === month.getFullYear() && date.getMonth() === month.getMonth()
  })
  const streak = currentStreak(moods)

  const save = async () => {
    setBusy(true)
    setMessage('')
    try {
      const result = await recordMoodV016(mood, note)
      setWallet(result.wallet)
      setMessage(result.awarded ? '+10 心贝' : '已更新今天')
      await load()
      setSelectedDate(today)
    } catch {
      setMessage('保存失败，请重试')
    } finally {
      setBusy(false)
    }
  }

  return (
    <section className="v017-mood-root">
      <div className="v017-mood-hero">
        <div className="v017-nature-mark"><Leaf size={17}/><Wind size={16}/></div>
        <small>每日心情</small>
        <h1>把每天的心绪，轻轻放回时间里</h1>
        <span>{wallet.points} 心贝</span>
      </div>

      <section className="v017-calendar-card">
        <header className="v017-calendar-head">
          <button onClick={() => setMonth(new Date(month.getFullYear(), month.getMonth() - 1, 1))} aria-label="上个月"><ChevronLeft size={19}/></button>
          <strong>{month.getFullYear()}年{month.getMonth() + 1}月</strong>
          <button onClick={() => setMonth(new Date(month.getFullYear(), month.getMonth() + 1, 1))} aria-label="下个月"><ChevronRight size={19}/></button>
        </header>
        <div className="v017-week-row">{['日','一','二','三','四','五','六'].map((day) => <span key={day}>{day}</span>)}</div>
        <div className="v017-calendar-grid">
          {monthCells.map((cell) => {
            const row = moodByDate.get(cell.key)
            const active = selectedDate === cell.key
            return (
              <button key={cell.key} className={`${cell.current ? '' : 'outside'}${active ? ' active' : ''}`} onClick={() => setSelectedDate(cell.key)}>
                <b>{cell.date.getDate()}</b>
                {row ? <i className={`mood-${row.mood}`}>{moodMeta[row.mood].symbol}</i> : <i className="empty" />}
              </button>
            )
          })}
        </div>
        <div className="v017-month-summary">
          <span><b>{monthRows.length}</b> 本月记录</span>
          <span><b>{streak}</b> 连续天数</span>
          <span><b>{moods.length}</b> 累计记录</span>
        </div>
      </section>

      {selectedDate !== today ? (
        <section className="v017-day-detail">
          <div className="v017-detail-art"><CalendarDays size={20}/></div>
          <div>
            <small>{formatShortDate(selectedDate)}</small>
            <h2>{selected ? moodMeta[selected.mood].label : '这一天还没有记录'}</h2>
            <p>{selected?.note || '留白也属于时间的一部分。'}</p>
          </div>
          <button onClick={() => { setSelectedDate(today); setMonth(new Date(new Date().getFullYear(), new Date().getMonth(), 1)) }}>回到今天</button>
        </section>
      ) : (
        <section className="v017-today-card">
          <div className="v017-card-title"><div><small>今天</small><h2>此刻像什么天气？</h2></div><Sparkles size={18}/></div>
          <div className="v017-mood-options">
            {moodOrder.map((key) => <button key={key} className={mood === key ? 'active' : ''} onClick={() => setMood(key)}><b>{moodMeta[key].symbol}</b><span>{moodMeta[key].label}</span></button>)}
          </div>
          <textarea value={note} onChange={(event) => setNote(event.target.value)} maxLength={240} placeholder="想留一句话吗？（可不写）" />
          <button className="v017-primary" onClick={() => void save()} disabled={busy}>{busy ? '保存中…' : '记录今日心情'}</button>
          {message ? <p className="v017-status">{message}</p> : null}
        </section>
      )}
    </section>
  )
}

function SeenV017() {
  const [view, setView] = useState<SeenView>('home')
  const [posts, setPosts] = useState<TreePostV016[]>([])
  const [friends, setFriends] = useState<ApiRecommendation[]>([])
  const [draft, setDraft] = useState('')
  const [busy, setBusy] = useState(false)
  const [message, setMessage] = useState('')

  const load = async () => {
    setBusy(true)
    try {
      const [nextPosts, nextFriends] = await Promise.all([fetchTreeV016(), fetchFriends('')])
      setPosts(nextPosts)
      setFriends(nextFriends.items)
      setMessage('')
    } catch {
      setMessage('网络暂时没有连上')
    } finally {
      setBusy(false)
    }
  }

  useEffect(() => { void load() }, [])

  const privatePosts = posts.filter((post) => post.mine && post.visibility === 'private')
  const worldPosts = posts.filter((post) => post.visibility === 'public' && post.status === 'approved')
  const friendPosts = posts.filter((post) => post.visibility === 'friends')

  const publish = async (visibility: 'private' | 'friends' | 'public') => {
    if (!draft.trim()) return
    setBusy(true)
    try {
      const row = await createTreeV016(draft, visibility)
      setDraft('')
      setMessage(visibility === 'private' || row.status === 'approved' ? '已保存' : '已提交审核')
      await load()
    } catch {
      setMessage('保存失败，请重试')
    } finally {
      setBusy(false)
    }
  }

  const goMessages = () => {
    const messageButton = [...document.querySelectorAll<HTMLButtonElement>('.bottom-tabs button')].find((button) => button.textContent?.includes('消息'))
    messageButton?.click()
  }

  const art = (file: string) => ({ backgroundImage: `linear-gradient(90deg, rgba(255,249,242,.98) 0%, rgba(255,249,242,.86) 43%, rgba(255,249,242,.06) 74%), url(${import.meta.env.BASE_URL}assets/mirror/${file})` })

  if (view === 'home') {
    return (
      <section className="v017-seen-root v017-seen-home">
        <header className="v017-seen-head">
          <div><small>SEE · MIRROR ISLE</small><h1>看见</h1><p>温柔连接，彼此看见</p></div>
          <div className="v017-seen-symbol"><Leaf size={20}/><Wind size={15}/></div>
        </header>
        <div className="v017-seen-stack">
          <button className="v017-seen-card tree" style={art('treehole.png')} onClick={() => setView('tree')}>
            <div><small><LockKeyhole size={13}/> 仅自己可见</small><h2>树洞</h2><p>私密记录，只给自己看</p><i><ChevronRight size={20}/></i></div>
          </button>
          <button className="v017-seen-card world" style={art('meet.png')} onClick={() => setView('world')}>
            <div><small><Globe2 size={13}/> 真实岛民</small><h2>世界</h2><p>看看世界正在发生的柔软瞬间</p><i><ChevronRight size={20}/></i></div>
          </button>
          <button className="v017-seen-card friends" style={art('chat.png')} onClick={() => setView('friends')}>
            <div><small><Users size={13}/> 只在好友之间</small><h2>好友</h2><p>走近熟悉的人，读懂彼此</p><i><ChevronRight size={20}/></i></div>
          </button>
        </div>
        {message ? <p className="v017-status">{message}</p> : null}
      </section>
    )
  }

  const title = view === 'tree' ? '树洞' : view === 'world' ? '世界' : '好友'
  const subtitle = view === 'tree' ? '这里只属于你' : view === 'world' ? '看见真实的人，也被世界看见' : '熟悉的人，在这里慢慢靠近'
  const visibility = view === 'tree' ? 'private' : view === 'world' ? 'public' : 'friends'
  const visiblePosts = view === 'tree' ? privatePosts : view === 'world' ? worldPosts : friendPosts

  return (
    <section className={`v017-seen-root v017-seen-subpage ${view}`}>
      <header className="v017-sub-head">
        <button onClick={() => { setView('home'); setDraft(''); setMessage('') }} aria-label="返回看见"><ChevronLeft size={22}/></button>
        <div><small>{subtitle}</small><h1>{title}</h1></div>
        <button onClick={() => void load()} aria-label="刷新"><RefreshCw size={17}/></button>
      </header>

      <div className={`v017-sub-hero ${view}`}>
        {view === 'tree' ? <LockKeyhole size={23}/> : view === 'world' ? <Globe2 size={24}/> : <Users size={24}/>} 
        <span>{view === 'tree' ? '无需修饰，也无需回应' : view === 'world' ? '公开内容会经过安全审核' : `${friends.length} 位好友`}</span>
        <Leaf size={18} className="leaf"/><Wind size={17} className="wind"/>
      </div>

      <section className="v017-compose-card">
        <textarea value={draft} onChange={(event) => setDraft(event.target.value)} maxLength={1200} placeholder={view === 'tree' ? '写下此刻真实的你…' : view === 'world' ? '分享一个想被世界看见的瞬间…' : '写给好友们看…'} />
        <button onClick={() => void publish(visibility)} disabled={busy || !draft.trim()}><Send size={16}/>{view === 'tree' ? '记录' : '发布'}</button>
      </section>

      {view === 'friends' ? (
        <section className="v017-friend-strip">
          <header><strong>我的好友</strong><button onClick={goMessages}>去消息</button></header>
          <div>
            {friends.length ? friends.map((friend) => <article key={friend.id}><span>{friend.nickname.slice(0, 1)}</span><div><b>{friend.nickname}</b><small>{friend.city} · {friend.goal}</small></div><button onClick={goMessages}><MessageCircle size={15}/></button></article>) : <p>{busy ? '正在同步好友…' : '还没有好友，先从“遇见”认识一个人。'}</p>}
          </div>
        </section>
      ) : null}

      <div className="v017-post-list">
        {visiblePosts.length ? visiblePosts.map((post) => (
          <article key={post.id}>
            <header><b>{view === 'tree' ? '我' : post.author}</b><span>{formatPostDate(post.createdAt)}</span></header>
            <p>{post.content}</p>
            {post.status !== 'approved' && view !== 'tree' ? <small>审核中</small> : null}
          </article>
        )) : <div className="v017-empty">{busy ? '正在同步…' : view === 'tree' ? '树洞还很安静' : view === 'world' ? '此刻世界很安静' : '好友之间还没有新的分享'}</div>}
      </div>
      {message ? <p className="v017-status">{message}</p> : null}
    </section>
  )
}

function V017Layer() {
  const [meet, setMeet] = useState<HTMLElement | null>(null)
  const [seen, setSeen] = useState<HTMLElement | null>(null)

  useEffect(() => {
    document.documentElement.classList.add('v017-warm-seen')
    const refresh = () => {
      const panes = [...document.querySelectorAll<HTMLElement>('.swipe-pane')]
      const nextMeet = panes[0] ?? null
      const nextSeen = panes[1] ?? null
      setMeet((current) => current === nextMeet ? current : nextMeet)
      setSeen((current) => current === nextSeen ? current : nextSeen)
      nextSeen?.classList.add('v017-seen-pane')

      const treeButton = [...document.querySelectorAll<HTMLButtonElement>('.bottom-tabs button')].find((button) => button.textContent?.includes('树洞') || button.textContent?.includes('看见'))
      if (treeButton) {
        const label = [...treeButton.querySelectorAll<HTMLElement>('span')].at(-1)
        if (label) label.textContent = '看见'
        else if (treeButton.textContent?.trim() === '树洞') treeButton.textContent = '看见'
      }
    }
    refresh()
    const observer = new MutationObserver(refresh)
    observer.observe(document.body, { childList: true, subtree: true })
    return () => {
      observer.disconnect()
      seen?.classList.remove('v017-seen-pane')
      document.documentElement.classList.remove('v017-warm-seen')
    }
  }, [seen])

  return <>{meet ? createPortal(<MoodCalendarV017/>, meet) : null}{seen ? createPortal(<SeenV017/>, seen) : null}</>
}

export default V017Layer
