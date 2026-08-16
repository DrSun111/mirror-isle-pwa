import { readFile, writeFile } from 'node:fs/promises'

async function replace(path, before, after) {
  const source = await readFile(path, 'utf8')
  if (source.includes(after)) return false
  if (!source.includes(before)) throw new Error(`Missing expected fragment in ${path}: ${before.slice(0, 80)}`)
  await writeFile(path, source.replace(before, after), 'utf8')
  return true
}

let changed = false
const patch = async (...args) => { changed = (await replace(...args)) || changed }

await patch(
  'src/MirrorV2Experience.tsx',
  "if (/password should be at least/i.test(raw)) return '密码至少需要 8 位'",
  "if (/password should be at least/i.test(raw)) return '密码至少需要 6 位'",
)

await patch(
  'src/MirrorV2Experience.tsx',
  "    if(password.length<8){setMessage('密码至少 8 位');return}\n    if(mode==='register'&&password!==confirm){setMessage('两次密码不一致');return}",
  "    if(mode==='login'&&!password){setMessage('请输入密码');return}\n    if(mode==='register'&&password.length<6){setMessage('密码至少 6 位');return}\n    if(mode==='register'&&password!==confirm){setMessage('两次密码不一致');return}",
)

await patch(
  'src/MirrorV2Experience.tsx',
  '<Scenic file="welcome.png" className="hero-image"/>',
  '<Scenic file="auth-landscape.svg" className="hero-image"/>',
)

await patch(
  'src/MirrorV2Experience.tsx',
  'placeholder="至少 8 位"',
  "placeholder={mode==='login'?'请输入密码':'至少 6 位'}",
)

await patch(
  'src/mirror-v2.css',
  '.m2-auth-hero{height:min(45dvh,500px);min-height:340px;position:relative;overflow:hidden;background:#efe5d7}',
  '.m2-auth-hero{height:min(43dvh,480px);min-height:320px;position:relative;overflow:hidden;background:#e9efea}',
)

await patch(
  'src/mirror-v2.css',
  '.m2-auth-hero .hero-image{position:absolute;inset:0;filter:saturate(.8) brightness(1.04)}',
  '.m2-auth-hero .hero-image{position:absolute;inset:0;object-position:center 46%;filter:none;transform:scale(1.015)}',
)

await patch(
  'src/mirror-v2.css',
  '.m2-auth-gradient{position:absolute;inset:0;background:linear-gradient(180deg,rgba(255,250,244,.05) 0,rgba(248,242,232,.12) 42%,rgba(246,240,231,.78) 100%)}',
  '.m2-auth-gradient{position:absolute;inset:0;background:linear-gradient(180deg,rgba(255,255,255,.05) 0,rgba(250,248,241,.05) 48%,rgba(248,246,240,.74) 100%)}',
)

await patch(
  'src/mirror-v2.css',
  '.m2-auth-copy{position:absolute;left:34px;bottom:42px}',
  '.m2-auth-copy{position:absolute;left:34px;bottom:34px;text-shadow:0 1px 0 rgba(255,255,255,.45)}',
)

console.log(changed ? 'Applied v2.0.1 auth refresh.' : 'v2.0.1 auth refresh already applied.')
