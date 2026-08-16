import { useState } from 'react'
import { Eye, EyeOff, Leaf, LockKeyhole, Wind } from 'lucide-react'
import { cleanSupabase } from './mirrorV2Api'

export default function PasswordRecoveryV2({ onDone }: { onDone: () => void | Promise<void> }) {
  const [password, setPassword] = useState('')
  const [confirm, setConfirm] = useState('')
  const [show, setShow] = useState(false)
  const [busy, setBusy] = useState(false)
  const [message, setMessage] = useState('')

  const submit = async () => {
    if (password.length < 8) {
      setMessage('新密码至少需要 8 位')
      return
    }
    if (password !== confirm) {
      setMessage('两次密码不一致')
      return
    }
    setBusy(true)
    setMessage('')
    try {
      const { error } = await cleanSupabase.auth.updateUser({ password })
      if (error) throw error
      window.history.replaceState({}, document.title, window.location.pathname + window.location.search.replace(/([?&])type=recovery(&|$)/, '$1').replace(/[?&]$/, ''))
      await onDone()
    } catch (error) {
      setMessage(error instanceof Error ? error.message : '暂时无法更新密码')
    } finally {
      setBusy(false)
    }
  }

  return <main className="m2-onboarding">
    <section className="m2-onboarding-card">
      <div className="m2-small-brand"><Leaf size={18}/><Wind size={17}/></div>
      <small>MIRROR ISLE</small>
      <h1>设置新密码</h1>
      <p className="muted">完成后即可使用新密码登录镜屿。</p>
      <label><span>新密码</span><div className="m2-password"><input type={show ? 'text' : 'password'} value={password} onChange={e=>setPassword(e.target.value)} autoComplete="new-password"/><button type="button" onClick={()=>setShow(v=>!v)}>{show?<EyeOff size={18}/>:<Eye size={18}/>}</button></div></label>
      <label><span>确认新密码</span><input type="password" value={confirm} onChange={e=>setConfirm(e.target.value)} autoComplete="new-password"/></label>
      <button className="m2-primary" disabled={busy} onClick={()=>void submit()}><LockKeyhole size={18}/>{busy?'更新中…':'保存新密码'}</button>
      {message&&<p className="m2-form-message">{message}</p>}
    </section>
  </main>
}
