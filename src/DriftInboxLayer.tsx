import { useEffect, useMemo, useState } from 'react'
import { createPortal } from 'react-dom'
import { ChevronDown, ChevronUp, Mail, RefreshCw } from 'lucide-react'
import { fetchTreePosts, type ApiTreePost } from './api'
import './drift-inbox.css'

interface StoredProfile {
  id?: string
  nickname?: string
}

interface InboxItem {
  bottle: ApiTreePost
  replies: ApiTreePost[]
}

function readStored<T>(key: string, fallback: T): T {
  try {
    const raw = window.localStorage.getItem(key)
    return raw ? (JSON.parse(raw) as T) : fallback
  } catch {
    return fallback
  }
}

function formatExactDate(value: string) {
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return value
  return new Intl.DateTimeFormat('zh-CN', {
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  }).format(date)
}

function DriftInboxLayer() {
  const [target, setTarget] = useState<HTMLElement | null>(null)
  const [session, setSession] = useState(() => ({
    token: readStored<string | null>('mirror-isle:auth-token', null),
    profile: readStored<StoredProfile | null>('mirror-isle:profile', null),
  }))

  useEffect(() => {
    const refresh = () => {
      const panes = [...document.querySelectorAll<HTMLElement>('.swipe-pane')]
      const nextTarget = panes[0] ?? null
      setTarget((current) => (current === nextTarget ? current : nextTarget))
      const token = readStored<string | null>('mirror-isle:auth-token', null)
      const profile = readStored<StoredProfile | null>('mirror-isle:profile', null)
      setSession((current) => {
        if (current.token === token && JSON.stringify(current.profile) === JSON.stringify(profile)) return current
        return { token, profile }
      })
    }
    refresh()
    const timer = window.setInterval(refresh, 1200)
    return () => window.clearInterval(timer)
  }, [])

  if (!target || !session.token || !session.profile) return null
  return createPortal(
    <DriftInboxCard token={session.token} profileId={session.profile.id ?? 'local'} />,
    target,
  )
}

function DriftInboxCard({ token, profileId }: { token: string; profileId: string }) {
  const [open, setOpen] = useState(false)
  const [loading, setLoading] = useState(false)
  const [items, setItems] = useState<InboxItem[]>([])
  const [message, setMessage] = useState('查看别人写给你漂流瓶的回信')
  const seenKey = `mirror-isle:drift-inbox-seen:${profileId}`
  const [lastSeen, setLastSeen] = useState(() => readStored<string | null>(seenKey, null))

  const totalReplies = useMemo(() => items.reduce((sum, item) => sum + item.replies.length, 0), [items])
  const newReplies = useMemo(() => {
    if (!lastSeen) return totalReplies
    const threshold = new Date(lastSeen).getTime()
    return items.reduce(
      (sum, item) => sum + item.replies.filter((reply) => new Date(reply.created_at).getTime() > threshold).length,
      0,
    )
  }, [items, lastSeen, totalReplies])

  const loadInbox = async (markSeen = false) => {
    setLoading(true)
    try {
      const result = await fetchTreePosts(token)
      const bottles = result.items.filter((item) => item.mine && item.tags?.includes('漂流瓶'))
      const replies = result.items.filter((item) => item.tags?.includes('漂流回信'))
      const nextItems = bottles
        .map((bottle) => ({
          bottle,
          replies: replies
            .filter((reply) => reply.tags?.includes(`bottle:${bottle.id}`))
            .sort((a, b) => a.created_at.localeCompare(b.created_at)),
        }))
        .sort((a, b) => b.bottle.created_at.localeCompare(a.bottle.created_at))
      setItems(nextItems)
      setMessage(nextItems.length ? '这些回音只展示在你的漂流信箱里。' : '你还没有投出过漂流瓶。')
      if (markSeen) {
        const now = new Date().toISOString()
        window.localStorage.setItem(seenKey, JSON.stringify(now))
        setLastSeen(now)
      }
    } catch {
      setMessage('远方来信暂时没有连上，请稍后再试。')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    void loadInbox(false)
  }, [token])

  const toggle = async () => {
    const nextOpen = !open
    setOpen(nextOpen)
    if (nextOpen) await loadInbox(true)
  }

  return (
    <section className="v014-inbox-layer">
      <button className="v014-inbox-summary" onClick={() => void toggle()}>
        <span className="v014-inbox-icon"><Mail size={17} /></span>
        <div>
          <strong>远方来信</strong>
          <small>{message}</small>
        </div>
        <span className={newReplies > 0 ? 'v014-inbox-count active' : 'v014-inbox-count'}>
          {newReplies > 0 ? `${newReplies} 新` : `${totalReplies} 封`}
        </span>
        {open ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
      </button>

      {open ? (
        <div className="v014-inbox-body">
          <div className="v014-inbox-head">
            <span>我的漂流瓶与收到的回音</span>
            <button onClick={() => void loadInbox(true)} disabled={loading}>
              <RefreshCw size={13} /> 刷新
            </button>
          </div>
          {items.length ? items.map((item) => (
            <article key={item.bottle.id} className="v014-inbox-item">
              <header>
                <strong>你在 {formatExactDate(item.bottle.created_at)} 投出的瓶子</strong>
                <span>{item.replies.length} 封回信</span>
              </header>
              <p>{item.bottle.content}</p>
              {item.replies.length ? (
                <div className="v014-inbox-replies">
                  {item.replies.map((reply) => (
                    <div key={reply.id}>
                      <strong>{reply.tags?.includes('匿名') ? '匿名小岛' : reply.author}</strong>
                      <span>{reply.content}</span>
                      <small>{formatExactDate(reply.created_at)}</small>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="v014-inbox-empty">它还在海上漂着，暂时没有收到回音。</div>
              )}
            </article>
          )) : (
            <div className="v014-inbox-empty">{loading ? '正在寻找远方的回音……' : message}</div>
          )}
        </div>
      ) : null}
    </section>
  )
}

export default DriftInboxLayer
