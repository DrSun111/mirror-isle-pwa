import { useEffect } from 'react'
import './auth-stability.css'

const FAILURE_HINT = /(登录失败|邮箱或密码不正确|连接超时|网络连接失败|换网络|注册失败)/

export default function AuthStabilityLayer() {
  useEffect(() => {
    let locked = false
    let timer = 0
    let activeButton: HTMLButtonElement | null = null

    const unlock = () => {
      locked = false
      window.clearTimeout(timer)
      if (activeButton && document.contains(activeButton)) {
        activeButton.disabled = false
        activeButton.removeAttribute('aria-busy')
        activeButton.classList.remove('auth-request-pending')
        activeButton.textContent = '进入镜屿'
      }
      activeButton = null
    }

    const lock = (button: HTMLButtonElement) => {
      locked = true
      activeButton = button
      button.setAttribute('aria-busy', 'true')
      button.classList.add('auth-request-pending')

      // Let the first React click handler run, then block accidental second taps.
      window.requestAnimationFrame(() => {
        if (!document.contains(button)) return
        button.disabled = true
        button.textContent = '正在进入…'
      })

      window.clearTimeout(timer)
      timer = window.setTimeout(unlock, 12000)
    }

    const onClick = (event: MouseEvent) => {
      const button = (event.target as HTMLElement | null)?.closest<HTMLButtonElement>('.entry-submit')
      if (!button) return
      const login = button.closest<HTMLElement>('.entry-login')
      const activeTab = login?.querySelector<HTMLButtonElement>('.auth-switch button.active')
      if (activeTab?.textContent?.trim() !== '登录') return

      if (locked) {
        event.preventDefault()
        event.stopPropagation()
        event.stopImmediatePropagation()
        return
      }
      lock(button)
    }

    const observer = new MutationObserver(() => {
      if (!locked) return
      // Success removes the login screen. A visible auth error should unlock immediately.
      if (!document.querySelector('.entry-login')) {
        locked = false
        window.clearTimeout(timer)
        activeButton = null
        return
      }
      const toast = document.querySelector<HTMLElement>('.toast')?.textContent ?? ''
      if (FAILURE_HINT.test(toast)) unlock()
    })

    document.addEventListener('click', onClick, true)
    observer.observe(document.body, { childList: true, subtree: true, characterData: true })
    return () => {
      document.removeEventListener('click', onClick, true)
      observer.disconnect()
      window.clearTimeout(timer)
    }
  }, [])

  return null
}
