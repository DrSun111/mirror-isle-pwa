import { readFile, writeFile } from 'node:fs/promises'

async function replaceOnce(path, before, after) {
  const source = await readFile(path, 'utf8')
  if (source.includes(after)) return false
  if (!source.includes(before)) throw new Error(`Expected source fragment not found in ${path}: ${before.slice(0, 80)}`)
  await writeFile(path, source.replace(before, after), 'utf8')
  return true
}

let changed = false
const patch = async (...args) => { changed = await replaceOnce(...args) || changed }

await patch(
  'src/mirrorV2Api.ts',
  "  birth_date: string\n  theme: ThemeKey",
  "  birth_date: string\n  age: number | null\n  theme: ThemeKey",
)
await patch(
  'src/mirrorV2Api.ts',
  "    birth_date: row.birth_date || '',\n    theme:",
  "    birth_date: row.birth_date || '',\n    age: row.age == null ? null : Number(row.age),\n    theme:",
)
await patch(
  'src/mirrorV2Api.ts',
  "    profession: row.profession || '',\n    birth_date: '',\n    theme:",
  "    profession: row.profession || '',\n    birth_date: '',\n    age: row.age == null ? null : Number(row.age),\n    theme:",
)
await patch(
  'src/MirrorV2Experience.tsx',
  "<h2>{person.nickname}</h2><p className=\"muted\">{[person.city,person.profession].filter(Boolean).join(' · ')}</p>",
  "<h2>{person.nickname}</h2><p className=\"muted\">{[person.age?`${person.age}岁`:'',person.city,person.profession].filter(Boolean).join(' · ')}</p>",
)
await patch(
  'src/MirrorV2Experience.tsx',
  "<span className=\"m2-badge\"><Sparkles size={15}/>匹配度 {featured.score}%</span><h2>{featured.nickname}</h2>",
  "<span className=\"m2-badge\"><Sparkles size={15}/>匹配度 {featured.score}%</span><h2>{featured.nickname}{featured.age?` · ${featured.age}岁`:''}</h2>",
)
await patch(
  'src/MirrorV2Experience.tsx',
  "<strong>{p.nickname}</strong><small>{p.city}{p.profession?` · ${p.profession}`:''}</small>",
  "<strong>{p.nickname}</strong><small>{p.age?`${p.age}岁 · `:''}{p.city}{p.profession?` · ${p.profession}`:''}</small>",
)
await patch(
  'src/MirrorV2Experience.tsx',
  "<p>{[profile.city,profile.profession].filter(Boolean).join(' · ')||'完善资料，让合适的人更容易遇见你'}</p>",
  "<p>{[profile.age?`${profile.age}岁`:'',profile.city,profile.profession].filter(Boolean).join(' · ')||'完善资料，让合适的人更容易遇见你'}</p>",
)
await patch(
  'src/MirrorV2Experience.tsx',
  "{(mode==='image'||mode==='video'||mode==='review')&&<label className=\"m2-file-button\">",
  "{(mode==='image'||mode==='video')&&<label className=\"m2-file-button\">",
)

console.log(changed ? 'Mirror V2 fidelity polish applied.' : 'Mirror V2 fidelity polish already applied.')
