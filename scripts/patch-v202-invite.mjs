import { readFile, writeFile } from 'node:fs/promises'

async function replaceOnce(path, before, after) {
  const source = await readFile(path, 'utf8')
  if (source.includes(after)) return false
  if (!source.includes(before)) throw new Error(`Expected source fragment not found in ${path}: ${before.slice(0, 120)}`)
  await writeFile(path, source.replace(before, after), 'utf8')
  return true
}

let changed = false
const patch = async (...args) => { changed = (await replaceOnce(...args)) || changed }

await patch(
  'src/mirrorV2Api.ts',
  `export async function registerEmail(email: string, password: string) {
  const normalized = email.trim().toLowerCase()
  const { data, error } = await cleanSupabase.auth.signUp({
    email: normalized,
    password,
    options: { emailRedirectTo: WEB_URL },
  })
  if (error) throw error
  if (data.session?.user) return { needsVerification: false, profile: await ensureV2Profile(data.session.user) }
  return { needsVerification: true, profile: null }
}`,
  `export async function registerEmail(email: string, password: string, inviteCode: string) {
  const normalized = email.trim().toLowerCase()
  const code = inviteCode.trim().toUpperCase()
  const { data, error } = await cleanSupabase.functions.invoke('invite-register', {
    body: { email: normalized, password, invite_code: code },
  })
  if (error) {
    let codeFromResponse = ''
    try {
      const response = (error as any)?.context as Response | undefined
      if (response) codeFromResponse = String((await response.clone().json())?.error || '')
    } catch { /* response body unavailable */ }
    throw new Error(codeFromResponse || error.message || 'registration_failed')
  }
  if (!data?.ok) throw new Error(String(data?.error || 'registration_failed'))

  const signedIn = await cleanSupabase.auth.signInWithPassword({ email: normalized, password })
  if (signedIn.error || !signedIn.data.user) throw signedIn.error ?? new Error('registration_login_failed')
  return { profile: await ensureV2Profile(signedIn.data.user) }
}`,
)

await patch(
  'src/MirrorV2Experience.tsx',
  `  if (/user already registered/i.test(raw)) return '该邮箱已有账号，请直接登录'
  if (/password should be at least/i.test(raw)) return '密码至少需要 6 位'`,
  `  if (/user already registered|email_already_registered/i.test(raw)) return '该邮箱已有账号，请直接登录'
  if (/invite_required/i.test(raw)) return '请输入推荐码'
  if (/invalid_invite_code|invalid_or_exhausted_invite/i.test(raw)) return '推荐码不正确'
  if (/invite_expired/i.test(raw)) return '推荐码已过期'
  if (/invite_exhausted/i.test(raw)) return '推荐码使用次数已达上限'
  if (/weak_password|password should be at least/i.test(raw)) return '密码至少需要 6 位'`,
)

await patch(
  'src/MirrorV2Experience.tsx',
  `  const [confirm,setConfirm]=useState('')
  const [showPassword,setShowPassword]=useState(false)`,
  `  const [confirm,setConfirm]=useState('')
  const [inviteCode,setInviteCode]=useState('')
  const [showPassword,setShowPassword]=useState(false)`,
)

await patch(
  'src/MirrorV2Experience.tsx',
  `  const [message,setMessage]=useState('')
  const [verification,setVerification]=useState(false)

  const submit=async()=>{`,
  `  const [message,setMessage]=useState('')

  const submit=async()=>{`,
)

await patch(
  'src/MirrorV2Experience.tsx',
  `    if(mode==='register'&&password.length<6){setMessage('密码至少 6 位');return}
    if(mode==='register'&&password!==confirm){setMessage('两次密码不一致');return}
    setBusy(true);setMessage('');setVerification(false)`,
  `    if(mode==='register'&&password.length<6){setMessage('密码至少 6 位');return}
    if(mode==='register'&&password!==confirm){setMessage('两次密码不一致');return}
    if(mode==='register'&&!inviteCode.trim()){setMessage('请输入推荐码');return}
    setBusy(true);setMessage('')`,
)

await patch(
  'src/MirrorV2Experience.tsx',
  `      }else{
        const result=await registerEmail(normalized,password)
        if(result.profile) onReady(result.profile)
        else { setVerification(true); setMessage('验证邮件已发送，请完成邮箱验证后登录') }
      }`,
  `      }else{
        const result=await registerEmail(normalized,password,inviteCode)
        onReady(result.profile)
      }`,
)

await patch(
  'src/MirrorV2Experience.tsx',
  `<div className="m2-auth-switch"><button className={mode==='login'?'active':''} onClick={()=>{setMode('login');setMessage('')}}>登录</button><button className={mode==='register'?'active':''} onClick={()=>{setMode('register');setMessage('')}}>邮箱注册</button></div>`,
  `<div className="m2-auth-switch"><button className={mode==='login'?'active':''} onClick={()=>{setMode('login');setMessage('')}}>登录</button><button className={mode==='register'?'active':''} onClick={()=>{setMode('register');setMessage('')}}>注册</button></div>`,
)

await patch(
  'src/MirrorV2Experience.tsx',
  `{mode==='register'&&<label><span>确认密码</span><input type="password" value={confirm} onChange={e=>setConfirm(e.target.value)} autoComplete="new-password" placeholder="再次输入密码"/></label>}
      <button className="m2-primary" disabled={busy} onClick={()=>void submit()}>{busy?'请稍候…':mode==='login'?'进入镜屿':'创建账号'}</button>
      {message&&<p className={\`m2-form-message \${verification?'success':''}\`}>{message}</p>}`,
  `{mode==='register'&&<><label><span>确认密码</span><input type="password" value={confirm} onChange={e=>setConfirm(e.target.value)} autoComplete="new-password" placeholder="再次输入密码"/></label><label><span>推荐码</span><input value={inviteCode} onChange={e=>setInviteCode(e.target.value.toUpperCase())} autoCapitalize="characters" autoComplete="off" maxLength={24} placeholder="请输入推荐码"/></label></>}
      <button className="m2-primary" disabled={busy} onClick={()=>void submit()}>{busy?'请稍候…':mode==='login'?'进入镜屿':'创建账号'}</button>
      {message&&<p className="m2-form-message">{message}</p>}`,
)

await writeFile('public/install/VERSION', 'v2.0.2-beta\n', 'utf8')

const swPath = 'public/sw.js'
const sw = await readFile(swPath, 'utf8')
await writeFile(swPath, sw.replace(/const CACHE_NAME = '[^']+'/u, "const CACHE_NAME = 'mirror-isle-v202-beta'"), 'utf8')

await patch(
  '.github/workflows/build-android.yml',
  `          NOTES="镜屿 Clean v1.0.1：修复注册后登录链路，增加登录错误本地化与密码找回入口；登录与主要页面升级为更高级、简约、治愈的真实场景视觉，并移除面向开发或解释性的文案。"`,
  `          NOTES="镜屿 v2.0.2-beta：注册流程改为邮箱 + 密码 + 推荐码，无需邮箱验证码；当前有效推荐码为 JY888。同步优化注册错误提示、登录衔接与缓存版本。"`,
)

console.log(changed ? 'v2.0.2 invite registration patch applied.' : 'v2.0.2 invite registration patch already applied.')
