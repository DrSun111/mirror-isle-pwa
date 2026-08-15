import { useEffect, useState } from 'react'
import { createPortal } from 'react-dom'
import { createClient } from '@supabase/supabase-js'
import { RadioTower } from 'lucide-react'
import './real-data-guard.css'

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL || 'https://mvbjhesgjwcyzqavqoyv.supabase.co'
const SUPABASE_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY || 'sb_publishable_pg7-4rkL_qLLBV0iHBK2pw_qTFYV4E_'
const supabase = createClient(SUPABASE_URL, SUPABASE_KEY, { auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: false } })
const demoIds = new Set(['shan', 'feng', 'wan'])
const demoNames = ['山脉与海', '时与风', '晚星']

function cleanMapKey(key: string) {
  try {
    const raw = localStorage.getItem(key)
    if (!raw) return
    const parsed = JSON.parse(raw)
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) return
    const next = Object.fromEntries(Object.entries(parsed).filter(([id]) => !demoIds.has(id)))
    localStorage.setItem(key, JSON.stringify(next))
  } catch { /* ignore malformed legacy cache */ }
}

function cleanDemoCacheOnce() {
  if (localStorage.getItem('mirror-isle:v016-demo-cache-cleaned') === '1') return
  try {
    const friends = JSON.parse(localStorage.getItem('mirror-isle:friends') || '[]')
    if (Array.isArray(friends)) localStorage.setItem('mirror-isle:friends', JSON.stringify(friends.filter((id) => !demoIds.has(String(id)))))
    cleanMapKey('mirror-isle:local-conversations')
    cleanMapKey('mirror-isle:conversation-previews')
    cleanMapKey('mirror-isle:conversation-ids')
    cleanMapKey('mirror-isle:read-message-ids')
    const selected = JSON.parse(localStorage.getItem('mirror-isle:selected') || 'null')
    if (demoIds.has(String(selected))) localStorage.removeItem('mirror-isle:selected')
    const active = JSON.parse(localStorage.getItem('mirror-isle:active-message-peer') || 'null')
    if (demoIds.has(String(active))) localStorage.removeItem('mirror-isle:active-message-peer')
    localStorage.setItem('mirror-isle:v016-demo-cache-cleaned', '1')
  } catch {
    localStorage.setItem('mirror-isle:v016-demo-cache-cleaned', '1')
  }
}

export default function RealDataGuard() {
  const [target, setTarget] = useState<HTMLElement | null>(null)
  const [state, setState] = useState<'checking' | 'real' | 'empty' | 'offline'>('checking')

  useEffect(() => {
    cleanDemoCacheOnce()
    let cancelled = false

    const inspect = async () => {
      const pane = document.querySelector<HTMLElement>('.swipe-pane')
      setTarget((current) => current === pane ? current : pane)
      if (!pane) return

      pane.classList.add('v016-real-data-guard')
      const stackText = pane.querySelector<HTMLElement>('.page-stack')?.innerText ?? ''
      const hasDemoFallback = demoNames.some((name) => stackText.includes(name))
      pane.classList.toggle('v016-demo-fallback-visible', hasDemoFallback)

      try {
        const { data: auth } = await supabase.auth.getUser()
        if (!auth.user) {
          if (!cancelled) setState('checking')
          return
        }
        const { count, error } = await supabase
          .from('mirror_profiles')
          .select('id', { count: 'exact', head: true })
          .neq('id', auth.user.id)
          .eq('age_confirmed', true)
        if (error) throw error
        if (!cancelled) setState((count ?? 0) > 0 ? 'real' : 'empty')
      } catch {
        if (!cancelled) setState('offline')
      }
    }

    void inspect()
    const timer = window.setInterval(() => void inspect(), 3500)
    return () => {
      cancelled = true
      window.clearInterval(timer)
      target?.classList.remove('v016-real-data-guard', 'v016-demo-fallback-visible')
    }
  }, [])

  if (!target || (state === 'real' && !target.classList.contains('v016-demo-fallback-visible'))) return null
  return createPortal(
    <section className={`v016-real-match-state ${state}`}>
      <RadioTower size={22} />
      <strong>{state === 'empty' ? '还没有新的岛民' : state === 'offline' ? '正在重新连接' : '正在寻找真实岛民'}</strong>
      <span>{state === 'empty' ? '有新用户加入后会出现在这里' : '不会展示虚拟示例用户'}</span>
    </section>,
    target,
  )
}
