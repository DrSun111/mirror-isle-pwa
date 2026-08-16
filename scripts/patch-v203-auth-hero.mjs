import { readFile, writeFile, appendFile } from 'node:fs/promises'

async function replaceOnce(path, before, after) {
  const source = await readFile(path, 'utf8')
  if (source.includes(after)) return false
  if (!source.includes(before)) throw new Error(`Expected fragment missing in ${path}: ${before.slice(0, 100)}`)
  await writeFile(path, source.replace(before, after), 'utf8')
  return true
}

let changed = false
const patch = async (...args) => { changed = (await replaceOnce(...args)) || changed }

await patch(
  'src/MirrorV2Experience.tsx',
  `import AssessmentSceneArt, { type SceneKind } from './AssessmentSceneArt'`,
  `import AssessmentSceneArt, { type SceneKind } from './AssessmentSceneArt'\nimport { AUTH_HERO_IMAGE } from './authHeroImage'`,
)

await patch(
  'src/MirrorV2Experience.tsx',
  `<Scenic file="auth-landscape.svg" className="hero-image"/>`,
  `<img className="m2-scenic hero-image" src={AUTH_HERO_IMAGE} alt="" decoding="async"/>`,
)

await patch(
  'src/MirrorV2Experience.tsx',
  `>注册</button></div>\n      <label><span>邮箱</span>`,
  `>推荐码注册</button></div>\n      <label><span>邮箱</span>`,
)

await patch(
  'src/MirrorV2Experience.tsx',
  `<label><span>推荐码</span><input value={inviteCode} onChange={e=>setInviteCode(e.target.value.toUpperCase())} autoCapitalize="characters" autoComplete="off" maxLength={24} placeholder="请输入推荐码"/></label>`,
  `<label className="m2-invite-field"><span>推荐码</span><input value={inviteCode} onChange={e=>setInviteCode(e.target.value.toUpperCase())} autoCapitalize="characters" autoComplete="off" maxLength={24} placeholder="请输入推荐码，如 JY888"/></label>`,
)

const cssPath = 'src/mirror-v2.css'
const css = await readFile(cssPath, 'utf8')
if (!css.includes('/* v2.0.3 auth visual */')) {
  await appendFile(cssPath, `\n\n/* v2.0.3 auth visual */\n.m2-auth{background:#f7f3eb}\n.m2-auth-hero{height:min(46dvh,520px);min-height:360px;background:#eee9dd}\n.m2-auth-hero .hero-image{position:absolute;inset:0;width:100%;height:100%;object-fit:cover;object-position:center 54%;transform:scale(1.025);filter:saturate(.92) contrast(.97) brightness(1.02)}\n.m2-auth-gradient{background:linear-gradient(180deg,rgba(255,252,244,.03) 0,rgba(255,250,239,.02) 42%,rgba(247,243,235,.30) 72%,rgba(247,243,235,.92) 100%)}\n.m2-auth-brand{top:max(32px,calc(env(safe-area-inset-top) + 16px));left:28px;right:28px;color:#5f5047;text-shadow:0 1px 12px rgba(255,255,255,.58);font-size:12px;letter-spacing:.23em}\n.m2-auth-copy{left:30px;bottom:32px;text-shadow:0 2px 18px rgba(255,255,255,.72)}\n.m2-auth-copy h1{font-size:clamp(64px,15vw,96px);color:#352f2a;margin-bottom:12px}\n.m2-auth-copy p{font-size:20px;color:#75665f;letter-spacing:.05em}\n.m2-auth-panel{margin:-28px auto 0;border-radius:34px 34px 0 0;padding-top:24px;background:rgba(255,254,250,.985);box-shadow:0 -12px 40px rgba(77,66,54,.07)}\n.m2-auth-switch{background:#f4efe7;border:1px solid rgba(221,214,203,.62)}\n.m2-auth-switch button{font-size:17px}\n.m2-auth-switch button.active{background:#fffdf9}\n.m2-auth-panel input,.m2-password{background:#fffdf9;border-color:#e4ddd2}\n.m2-invite-field input{border-color:color-mix(in srgb,var(--m2-accent) 38%,#e4ddd2);box-shadow:0 0 0 3px color-mix(in srgb,var(--m2-accent-soft) 40%,transparent)}\n@media (max-height:760px){.m2-auth-hero{height:38dvh;min-height:285px}.m2-auth-copy h1{font-size:58px}.m2-auth-copy p{font-size:17px}.m2-auth-panel{padding-top:20px}.m2-auth-panel label{margin:10px 0}}\n`)
  changed = true
}

await writeFile('public/install/VERSION', 'v2.0.3-beta\n', 'utf8')

const swPath = 'public/sw.js'
const sw = await readFile(swPath, 'utf8')
const nextSw = sw.replace(/const CACHE_NAME = '[^']+'/u, "const CACHE_NAME = 'mirror-isle-v203-beta'")
if (nextSw !== sw) { await writeFile(swPath, nextSw, 'utf8'); changed = true }

await patch(
  'android/app/build.gradle',
  `        versionCode 1\n        versionName "1.0"`,
  `        versionCode 3\n        versionName "2.0.3-beta"`,
)

console.log(changed ? 'v2.0.3 auth patch applied.' : 'v2.0.3 auth patch already applied.')
