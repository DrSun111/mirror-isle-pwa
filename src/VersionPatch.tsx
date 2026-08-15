import { useEffect } from 'react'

const CURRENT_VERSION = '0.17.1'

export default function VersionPatch() {
  useEffect(() => {
    const patch = () => {
      document.querySelectorAll<HTMLElement>('button, p, span, div').forEach((node) => {
        if (node.childElementCount > 0) return
        if (/^当前版本\s+0\.(12\.4|16|17)$/.test(node.textContent?.trim() ?? '')) {
          node.textContent = `当前版本 ${CURRENT_VERSION}`
        }
      })
    }

    const onClick = (event: MouseEvent) => {
      const button = (event.target as HTMLElement | null)?.closest('button')
      if (!button || !button.textContent?.includes('检查更新')) return
      event.preventDefault()
      event.stopPropagation()
      window.location.href = `${import.meta.env.BASE_URL}install/`
    }

    patch()
    const observer = new MutationObserver(patch)
    observer.observe(document.body, { childList: true, subtree: true, characterData: true })
    document.addEventListener('click', onClick, true)
    return () => {
      observer.disconnect()
      document.removeEventListener('click', onClick, true)
    }
  }, [])
  return null
}
