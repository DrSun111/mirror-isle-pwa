import { readFile, writeFile } from 'node:fs/promises'

async function replaceOnce(path, before, after) {
  const source = await readFile(path, 'utf8')
  if (source.includes(after)) return false
  if (!source.includes(before)) throw new Error(`Expected source fragment not found in ${path}`)
  await writeFile(path, source.replace(before, after), 'utf8')
  return true
}

let changed = false
changed = await replaceOnce(
  'src/MirrorV2Experience.tsx',
  "const filtered=useMemo(()=>posts.filter(p=>filter==='all'||filter==='video'?p.kind==='video':p.reviewCategory===filter),[posts,filter])",
  "const filtered=useMemo(()=>posts.filter(p=>filter==='all'?true:filter==='video'?p.kind==='video':p.reviewCategory===filter),[posts,filter])",
) || changed

changed = await replaceOnce(
  'src/mirrorV2Api.ts',
  "    profession: '',\n    birth_date: '',",
  "    profession: row.profession || '',\n    birth_date: '',",
) || changed

console.log(changed ? 'Mirror V2 source normalized.' : 'Mirror V2 source already normalized.')
