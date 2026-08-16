import { readFile, writeFile } from 'node:fs/promises'
import { resolve } from 'node:path'

const file = resolve(
  'node_modules/@capacitor/android/capacitor/src/main/java/com/getcapacitor/plugin/SystemBars.java',
)

const source = await readFile(file, 'utf8')
const marker = 'if (document.documentElement) {'

if (source.includes(marker)) {
  console.log('Capacitor SystemBars safe-area guard already present.')
  process.exit(0)
}

const original = `                    try {
                      document.documentElement.style.setProperty("--safe-area-inset-top", "%dpx");
                      document.documentElement.style.setProperty("--safe-area-inset-right", "%dpx");
                      document.documentElement.style.setProperty("--safe-area-inset-bottom", "%dpx");
                      document.documentElement.style.setProperty("--safe-area-inset-left", "%dpx");
                    } catch(e) { console.error('Error injecting safe area CSS:', e); }`

const patched = `                    try {
                      if (document.documentElement) {
                        document.documentElement.style.setProperty("--safe-area-inset-top", "%dpx");
                        document.documentElement.style.setProperty("--safe-area-inset-right", "%dpx");
                        document.documentElement.style.setProperty("--safe-area-inset-bottom", "%dpx");
                        document.documentElement.style.setProperty("--safe-area-inset-left", "%dpx");
                      }
                    } catch(e) { console.error('Error injecting safe area CSS:', e); }`

if (!source.includes(original)) {
  throw new Error('Capacitor SystemBars source changed; refusing to apply an unsafe patch.')
}

await writeFile(file, source.replace(original, patched), 'utf8')
console.log('Patched Capacitor SystemBars safe-area DOM race.')
