import { useEffect, useMemo, useState } from 'react'
import { ArrowRight, Eye, EyeOff, Leaf, Wind } from 'lucide-react'
import CleanApp from './CleanApp'
import { cleanSupabase, loginAccount, registerAccount, restoreAccount, type CleanProfile } from './cleanApi'
import './v101.css'

type AuthMode = 'login' | 'register'

const sleep = (ms: number) => new Promise((resolve) => window.setTimeout(resolve, ms))
const RECOVERY_URL = 'https://drsun111.github.io/mirror-isle-pwa/'

function friendlyAuthError(error: unknown) {
  const raw = error instanceof Error ? error.message : String(error ?? '')
  if (/invalid login credentials/i.test(raw)) return '邮箱或密码不正确'
  if (/email not confirmed/i.test(raw)) return '邮箱尚未完成验证'
  if (/email rate limit/i.test(raw)) return '操作过于频繁，请稍后再试'
  if (/network|fetch/i.test(raw)) return '网络暂时不可用，请稍后再试'
  return raw || '暂时无法进入镜屿'
}

async function retryLogin(email: string, password: string, attempts = 4) {
  let lastError: unknown = null
  for (let i = 0; i < attempts; i += 1) {
    try {
      return await loginAccount(email, password)
    } catch (error) {
      lastError = error
      if (!/invalid login credentials/i.test(error instanceof Error ? error.message : String(error))) throw error
      if (i < attempts - 1) await sleep(350 * (i + 1))
    }
  }
  throw lastError ?? new Error('登录失败')
}

function RecoveryPanel({ onDone }: { onDone: () => void }) {
  const [password, setPassword] = useState('')
  const [confirm, setConfirm] = useState('')
  const [busy, setBusy] = useState(false)
  const [message, setMessage] = useState('')

  const save = async () => {
    if (password.length < 8) { setMessage('密码至少 8 位'); return }
    if (password !== confirm) { setMessage('两次密码不一致'); return }
    setBusy(true); setMessage('')
    try {
      const { error } = await cleanSupabase.auth.updateUser({ password })
      if (error) throw error
      await cleanSupabase.auth.signOut()
      window.history.replaceState({}, document.title, window.location.pathname + window.location.search)
      onDone()
    } catch (error) {
      setMessage(friendlyAuthError(error))
    } finally {
      setBusy(false)
    }
  }

  return <main className="v101-auth">
    <section className="v101-recovery-card">
      <div className="v101-brandmark"><Leaf size={18}/><Wind size={17}/></div>
      <small>MIRROR ISLE</small>
      <h1>设置新密码</h1>
      <label>新密码<input type="password" value={password} onChange={(e)=>setPassword(e.target.value)} placeholder="至少 8 位" autoComplete="new-password"/></label>
      <label>确认密码<input type="password" value={confirm} onChange={(e)=>setConfirm(e.target.value)} placeholder="再次输入" autoComplete="new-password"/></label>
      <button className="v101-primary" disabled={busy} onClick={()=>void save()}>{busy?'保存中…':'保存新密码'}<ArrowRight size={18}/></button>
      {message && <p className="v101-message">{message}</p>}
    </section>
  </main>
}

function AuthV101({ onReady }: { onReady: (profile: CleanProfile) => void }) {
  const [mode, setMode] = useState<AuthMode>('login')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [confirm, setConfirm] = useState('')
  const [invite, setInvite] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [busy, setBusy] = useState(false)
  const [message, setMessage] = useState('')
  const [showRecovery, setShowRecovery] = useState(false)
  const hero = `${import.meta.env.BASE_URL}assets/mirror/welcome.png`

  const normalizedEmail = useMemo(() => email.trim().toLowerCase(), [email])

  const submit = async () => {
    if (!/^\S+@\S+\.\S+$/.test(normalizedEmail)) { setMessage('请输入有效邮箱'); return }
    if (password.length < 8) { setMessage('密码至少 8 位'); return }
    if (mode === 'register' && password !== confirm) { setMessage('两次密码不一致'); return }
    if (mode === 'register' && !invite.trim()) { setMessage('请输入邀请码'); return }
    setBusy(true); setMessage(''); setShowRecovery(false)
    try {
      if (mode === 'login') {
        const result = await loginAccount(normalizedEmail, password)
        onReady(result.profile)
        return
      }
      try {
        const result = await registerAccount(normalizedEmail, password, invite)
        onReady(result.profile)
      } catch (error) {
        const raw = error instanceof Error ? error.message : String(error)
        if (/invalid login credentials/i.test(raw)) {
          try {
            const result = await retryLogin(normalizedEmail, password)
            onReady(result.profile)
          } catch {
            setMode('login')
            setShowRecovery(true)
            setMessage('账号已创建，请直接登录')
          }
          return
        }
        if (/邮箱已注册/.test(raw)) {
          setMode('login')
          setShowRecovery(true)
          setMessage('该邮箱已有账号，请直接登录')
          return
        }
        throw error
      }
    } catch (error) {
      const text = friendlyAuthError(error)
      setMessage(text)
      if (mode === 'login' && /邮箱或密码不正确/.test(text)) setShowRecovery(true)
    } finally {
      setBusy(false)
    }
  }

  const sendRecovery = async () => {
    if (!/^\S+@\S+\.\S+$/.test(normalizedEmail)) { setMessage('先填写邮箱'); return }
    setBusy(true); setMessage('')
    try {
      const { error } = await cleanSupabase.auth.resetPasswordForEmail(normalizedEmail, { redirectTo: RECOVERY_URL })
      if (error) throw error
      setMessage('重置邮件已发送')
    } catch (error) {
      setMessage(friendlyAuthError(error))
    } finally {
      setBusy(false)
    }
  }

  return <main className="v101-auth">
    <section className="v101-hero">
      <img src={hero} alt="" loading="eager"/>
      <div className="v101-hero-shade"/>
      <div className="v101-brandmark"><Leaf size={18}/><Wind size={17}/></div>
      <div className="v101-hero-copy"><small>MIRROR ISLE</small><h1>镜屿</h1><p>寻找世界上另一个自己</p></div>
    </section>
    <section className="v101-auth-card">
      <div className="v101-switch">
        <button className={mode==='login'?'active':''} onClick={()=>{setMode('login');setMessage('');setShowRecovery(false)}}>登录</button>
        <button className={mode==='register'?'active':''} onClick={()=>{setMode('register');setMessage('');setShowRecovery(false)}}>注册</button>
      </div>
      <label>邮箱<input value={email} onChange={(e)=>setEmail(e.target.value)} inputMode="email" autoCapitalize="none" autoComplete="email" placeholder="name@example.com"/></label>
      {mode==='register' && <label>邀请码<input value={invite} onChange={(e)=>setInvite(e.target.value.toUpperCase())} autoCapitalize="characters" placeholder="输入邀请码"/></label>}
      <label>密码<div className="v101-password"><input type={showPassword?'text':'password'} value={password} onChange={(e)=>setPassword(e.target.value)} autoComplete={mode==='login'?'current-password':'new-password'} placeholder="至少 8 位"/><button type="button" aria-label={showPassword?'隐藏密码':'显示密码'} onClick={()=>setShowPassword(v=>!v)}>{showPassword?<EyeOff size={18}/>:<Eye size={18}/>}</button></div></label>
      {mode==='register' && <label>确认密码<input type="password" value={confirm} onChange={(e)=>setConfirm(e.target.value)} autoComplete="new-password" placeholder="再次输入密码"/></label>}
      <button className="v101-primary" disabled={busy} onClick={()=>void submit()}>{busy?'正在进入…':mode==='login'?'进入镜屿':'创建账号'}<ArrowRight size={18}/></button>
      {message && <p className="v101-message">{message}</p>}
      {mode==='login' && showRecovery && <button className="v101-link" disabled={busy} onClick={()=>void sendRecovery()}>忘记密码</button>}
    </section>
  </main>
}

export default function CleanExperience() {
  const [checking, setChecking] = useState(true)
  const [authenticated, setAuthenticated] = useState(false)
  const [recovery, setRecovery] = useState(false)

  useEffect(() => {
    let active = true
    const parseRecovery = async () => {
      const hash = new URLSearchParams(window.location.hash.replace(/^#/, ''))
      if (hash.get('type') !== 'recovery') return false
      const accessToken = hash.get('access_token')
      const refreshToken = hash.get('refresh_token')
      if (!accessToken || !refreshToken) return false
      const { error } = await cleanSupabase.auth.setSession({ access_token: accessToken, refresh_token: refreshToken })
      if (error) return false
      if (active) { setRecovery(true); setChecking(false) }
      return true
    }
    void parseRecovery().then(async (handled) => {
      if (handled || !active) return
      try {
        const account = await restoreAccount()
        if (active) setAuthenticated(Boolean(account))
      } catch {
        if (active) setAuthenticated(false)
      } finally {
        if (active) setChecking(false)
      }
    })
    const { data } = cleanSupabase.auth.onAuthStateChange((event) => {
      if (!active || recovery) return
      if (event === 'SIGNED_OUT') setAuthenticated(false)
    })
    return () => { active = false; data.subscription.unsubscribe() }
  }, [recovery])

  if (recovery) return <RecoveryPanel onDone={()=>{setRecovery(false);setAuthenticated(false)}}/>
  if (checking) return <main className="v101-splash"><div className="v101-brandmark"><Leaf/><Wind/></div><h1>镜屿</h1></main>
  if (!authenticated) return <AuthV101 onReady={()=>setAuthenticated(true)}/>
  return <CleanApp/>
}
