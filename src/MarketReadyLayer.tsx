import { useEffect, useMemo, useState } from 'react'
import { createPortal } from 'react-dom'
import { ChevronLeft, Compass, HeartPulse, Mail, MessageCircleHeart, Sparkles, Waves } from 'lucide-react'
import './market-ready-v015.css'

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL || 'https://mvbjhesgjwcyzqavqoyv.supabase.co'
const SUPABASE_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY || 'sb_publishable_pg7-4rkL_qLLBV0iHBK2pw_qTFYV4E_'

type MeetModule = 'home' | 'match' | 'mood' | 'wellbeing' | 'drift' | 'inbox'

const nativeValueSetter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value')?.set

function setReactInputValue(input: HTMLInputElement, value: string) {
  nativeValueSetter?.call(input, value)
  input.dispatchEvent(new Event('input', { bubbles: true }))
  input.dispatchEvent(new Event('change', { bubbles: true }))
}

function fieldByLabel(container: HTMLElement, label: string) {
  return [...container.querySelectorAll('label')].find((node) => node.querySelector('span')?.textContent?.trim() === label)?.querySelector('input') as HTMLInputElement | null
}

function InviteRegistrationBridge() {
  const [status, setStatus] = useState('')
  const [busy, setBusy] = useState(false)

  useEffect(() => {
    const onClick = async (event: Event) => {
      const target = event.target as HTMLElement | null
      const submit = target?.closest<HTMLButtonElement>('.entry-submit')
      if (!submit) return
      const entry = submit.closest<HTMLElement>('.entry-login')
      if (!entry) return
      const activeTab = entry.querySelector<HTMLButtonElement>('.auth-switch button.active')
      if (activeTab?.textContent?.trim() !== '注册') return

      event.preventDefault()
      event.stopPropagation()
      event.stopImmediatePropagation()
      if (busy) return

      const email = fieldByLabel(entry, '邮箱')?.value.trim() ?? ''
      const invite = fieldByLabel(entry, '邀请码')?.value.trim().toUpperCase() ?? ''
      const password = fieldByLabel(entry, '密码')?.value ?? ''
      const confirm = fieldByLabel(entry, '确认密码')?.value ?? ''

      if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
        setStatus('请填写有效邮箱')
        return
      }
      if (!invite) {
        setStatus('请输入邀请码')
        return
      }
      if (password.length < 8) {
        setStatus('为了账户安全，密码至少需要 8 位')
        return
      }
      if (password !== confirm) {
        setStatus('两次输入的密码不一致')
        return
      }

      setBusy(true)
      setStatus('正在验证邀请并创建账户…')
      try {
        const response = await fetch(`${SUPABASE_URL}/functions/v1/invite-register`, {
          method: 'POST',
          headers: {
            apikey: SUPABASE_KEY,
            'Content-Type': 'application/json',
            'X-Client-Info': 'mirror-isle-v015',
          },
          body: JSON.stringify({ email, password, invite_code: invite }),
        })
        const payload = await response.json().catch(() => ({})) as { error?: string }
        if (!response.ok) {
          const messages: Record<string, string> = {
            invalid_invite_code: '邀请码无效，请确认后重试',
            invite_expired: '这个邀请码已经过期',
            invite_exhausted: '这个邀请码的使用次数已经用完',
            invalid_or_exhausted_invite: '邀请码无效或已经用完',
            email_already_registered: '这个邮箱已经注册，请直接登录',
            weak_password: '密码至少需要 8 位',
          }
          throw new Error(messages[payload.error ?? ''] ?? '注册暂时没有完成，请稍后重试')
        }

        setStatus('注册成功，正在为你登录…')
        const loginTab = [...entry.querySelectorAll<HTMLButtonElement>('.auth-switch button')]
          .find((button) => button.textContent?.trim() === '登录')
        loginTab?.click()
        await new Promise((resolve) => window.setTimeout(resolve, 80))

        const currentEntry = document.querySelector<HTMLElement>('.entry-login')
        const emailInput = currentEntry ? fieldByLabel(currentEntry, '邮箱') : null
        const passwordInput = currentEntry ? fieldByLabel(currentEntry, '密码') : null
        if (!currentEntry || !emailInput || !passwordInput) throw new Error('注册成功，请返回登录页使用邮箱和密码登录')
        setReactInputValue(emailInput, email)
        setReactInputValue(passwordInput, password)
        await new Promise((resolve) => window.setTimeout(resolve, 80))
        currentEntry.querySelector<HTMLButtonElement>('.entry-submit')?.click()
      } catch (error) {
        setStatus(error instanceof Error ? error.message : '注册暂时没有完成，请稍后重试')
      } finally {
        setBusy(false)
      }
    }

    document.addEventListener('click', onClick, true)
    return () => document.removeEventListener('click', onClick, true)
  }, [busy])

  const target = document.querySelector<HTMLElement>('.entry-login')
  if (!target || !status) return null
  return createPortal(
    <div className={`v015-auth-status${busy ? ' busy' : ''}`} role="status">{status}</div>,
    target,
  )
}

function MeetLauncher() {
  const [target, setTarget] = useState<HTMLElement | null>(null)
  const [module, setModule] = useState<MeetModule>('home')

  useEffect(() => {
    const refresh = () => {
      const next = [...document.querySelectorAll<HTMLElement>('.swipe-pane')][0] ?? null
      setTarget((current) => current === next ? current : next)
    }
    refresh()
    const observer = new MutationObserver(refresh)
    observer.observe(document.body, { childList: true, subtree: true })
    return () => observer.disconnect()
  }, [])

  useEffect(() => {
    if (!target) return
    const classes = ['v015-meet-home', 'v015-meet-match', 'v015-meet-mood', 'v015-meet-wellbeing', 'v015-meet-drift', 'v015-meet-inbox']
    target.classList.remove(...classes)
    target.classList.add(`v015-meet-${module}`)
    target.classList.add('v015-meet-router')
    target.closest<HTMLElement>('.device-content')?.scrollTo({ top: 0, behavior: 'auto' })
    return () => target.classList.remove(...classes, 'v015-meet-router')
  }, [module, target])

  const title = useMemo(() => ({
    match: '匹配遇见',
    mood: '每日心情',
    wellbeing: '心理状态',
    drift: '漂流海',
    inbox: '远方来信',
  } as const), [])

  if (!target) return null
  return createPortal(
    <>
      {module === 'home' ? (
        <section className="v015-launcher-root">
          <div className="v015-launcher-head">
            <span>遇见 · MIRROR ISLE</span>
            <h1>今天，想从哪里开始？</h1>
            <p>每件事都有自己的房间。打开它，再专心待一会儿。</p>
          </div>
          <div className="v015-module-grid">
            <button onClick={() => setModule('match')}><Compass /><strong>匹配遇见</strong><span>看看今天与你靠近的人</span></button>
            <button onClick={() => setModule('mood')}><MessageCircleHeart /><strong>每日心情</strong><span>记录今天，也积累心贝</span></button>
            <button onClick={() => setModule('wellbeing')}><HeartPulse /><strong>心理状态</strong><span>温和观察最近的自己</span></button>
            <button onClick={() => setModule('drift')}><Waves /><strong>漂流海</strong><span>捡起一封真实陌生人的信</span></button>
            <button onClick={() => setModule('inbox')}><Mail /><strong>远方来信</strong><span>看看你的瓶子收到什么回音</span></button>
            <button onClick={() => setModule('match')}><Sparkles /><strong>今日推荐</strong><span>从关系报告开始一次对话</span></button>
          </div>
        </section>
      ) : (
        <div className="v015-subpage-bar">
          <button onClick={() => setModule('home')} aria-label="返回遇见首页"><ChevronLeft size={20} /></button>
          <div><strong>{title[module]}</strong><span>镜屿</span></div>
        </div>
      )}
    </>,
    target,
  )
}

function MarketReadyLayer() {
  useEffect(() => {
    document.documentElement.classList.add('v015-market-ready')
    return () => document.documentElement.classList.remove('v015-market-ready')
  }, [])

  return (
    <>
      <InviteRegistrationBridge />
      <MeetLauncher />
    </>
  )
}

export default MarketReadyLayer
