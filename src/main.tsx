import { Component, lazy, Suspense, useEffect, useState } from 'react'
import type { ErrorInfo, ReactNode } from 'react'
import { createRoot } from 'react-dom/client'
import { Capacitor } from '@capacitor/core'
import './index.css'
import NativeBootGuard from './NativeBootGuard.tsx'

const bootWindow = window as Window & {
  __mirrorBootComplete?: () => void
}

const App = lazy(async () => {
  const module = await import('./App.tsx')
  document.documentElement.dataset.mirrorReady = '1'
  bootWindow.__mirrorBootComplete?.()
  return module
})

const V017Layer = lazy(() => import('./V017Layer.tsx'))

async function clearRecoverableLocalState() {
  try {
    if ('serviceWorker' in navigator) {
      const registrations = await navigator.serviceWorker.getRegistrations()
      await Promise.all(registrations.map((registration) => registration.unregister()))
    }
    if ('caches' in window) {
      const keys = await caches.keys()
      await Promise.all(keys.map((key) => caches.delete(key)))
    }
  } catch {
    // Recovery must continue even if one WebView cache API is unavailable.
  }

  try {
    Object.keys(window.localStorage)
      .filter((key) => key.startsWith('mirror-isle:'))
      .forEach((key) => window.localStorage.removeItem(key))
  } catch {
    // localStorage may be unavailable on a damaged WebView profile.
  }
}

function RecoveryScreen({ automatic = false }: { automatic?: boolean }) {
  const [busy, setBusy] = useState(false)

  const recover = async () => {
    if (busy) return
    setBusy(true)
    await clearRecoverableLocalState()
    window.location.reload()
  }

  return (
    <main style={{ minHeight: '100dvh', display: 'grid', placeItems: 'center', padding: 24, background: '#fffaf4', color: '#4b4038' }}>
      <section style={{ width: 'min(100%, 420px)', textAlign: 'center' }}>
        <h1 style={{ fontFamily: 'serif', marginBottom: 12 }}>镜屿</h1>
        <p style={{ lineHeight: 1.7, color: '#7c7068' }}>
          {automatic ? '正在修复本机启动数据并重新进入…' : '本机启动数据出现异常。修复后会重新进入，云端账号资料不会被删除。'}
        </p>
        {!automatic && (
          <button
            type="button"
            style={{ marginTop: 20, minHeight: 48, padding: '0 22px', border: 0, borderRadius: 14, background: '#c98066', color: '#fff', fontWeight: 700 }}
            onClick={() => void recover()}
            disabled={busy}
          >
            {busy ? '正在修复…' : '修复本机数据并重启'}
          </button>
        )}
      </section>
    </main>
  )
}

function BootLoading() {
  const [slow, setSlow] = useState(false)

  useEffect(() => {
    const timer = window.setTimeout(() => setSlow(true), 8000)
    return () => window.clearTimeout(timer)
  }, [])

  return (
    <main style={{ minHeight: '100dvh', display: 'grid', placeItems: 'center', padding: 24, background: '#fffaf4', color: '#4b4038' }}>
      <section style={{ width: 'min(100%, 420px)', textAlign: 'center' }}>
        <h1 style={{ fontFamily: 'serif', marginBottom: 12 }}>镜屿</h1>
        <p style={{ lineHeight: 1.7, color: '#7c7068' }}>{slow ? '启动时间较长，可以清理旧缓存后重新进入。' : '正在进入镜屿…'}</p>
        {slow && (
          <button
            type="button"
            style={{ marginTop: 20, minHeight: 48, padding: '0 22px', border: 0, borderRadius: 14, background: '#c98066', color: '#fff', fontWeight: 700 }}
            onClick={async () => {
              await clearRecoverableLocalState()
              window.location.reload()
            }}
          >
            自动修复并重启
          </button>
        )}
      </section>
    </main>
  )
}

class LayerBoundary extends Component<{ children: ReactNode }, { failed: boolean }> {
  state = { failed: false }
  static getDerivedStateFromError() {
    return { failed: true }
  }
  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error('optional layer failed', error, info)
  }
  render() {
    return this.state.failed ? null : this.props.children
  }
}

class BootBoundary extends Component<{ children: ReactNode }, { failed: boolean; autoRecovering: boolean }> {
  state = { failed: false, autoRecovering: false }

  static getDerivedStateFromError() {
    return { failed: true }
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error('mirror isle boot failed', error, info)
    document.documentElement.dataset.mirrorReady = 'error'

    if (!Capacitor.isNativePlatform()) return

    try {
      const recoveryKey = 'mirror-isle:native-auto-recovery-attempted'
      if (window.sessionStorage.getItem(recoveryKey) === '1') return
      window.sessionStorage.setItem(recoveryKey, '1')
      this.setState({ autoRecovering: true })
      void clearRecoverableLocalState().then(() => window.location.reload())
    } catch {
      // If sessionStorage is unavailable, show manual recovery instead of looping.
    }
  }

  render() {
    if (!this.state.failed) return this.props.children
    return <RecoveryScreen automatic={this.state.autoRecovering} />
  }
}

function DeferredEnhancements() {
  const [enabled, setEnabled] = useState(false)

  useEffect(() => {
    let attempts = 0
    const check = () => {
      attempts += 1
      const appIsOpen = Boolean(document.querySelector('.bottom-tabs'))
      if (appIsOpen) {
        window.setTimeout(() => setEnabled(true), 1500)
        return true
      }
      return attempts >= 60
    }

    if (check()) return
    const timer = window.setInterval(() => {
      if (check()) window.clearInterval(timer)
    }, 500)
    return () => window.clearInterval(timer)
  }, [])

  if (!enabled) return null
  return (
    <LayerBoundary>
      <Suspense fallback={null}>
        <V017Layer />
      </Suspense>
    </LayerBoundary>
  )
}

const root = document.getElementById('root')
if (root) {
  createRoot(root).render(
    <BootBoundary>
      <NativeBootGuard />
      <Suspense fallback={<BootLoading />}>
        <App />
      </Suspense>
      <DeferredEnhancements />
    </BootBoundary>,
  )
}

if (!Capacitor.isNativePlatform() && 'serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register(`${import.meta.env.BASE_URL}sw.js`).catch(() => {
      // The web app still works without offline caching.
    })
  })
}
