import { Component, lazy, Suspense } from 'react'
import type { ErrorInfo, ReactNode } from 'react'
import { createRoot } from 'react-dom/client'
import { Capacitor } from '@capacitor/core'
import './index.css'
import App from './App.tsx'
import NativeBootGuard from './NativeBootGuard.tsx'

const V017Layer = lazy(() => import('./V017Layer.tsx'))

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

class BootBoundary extends Component<{ children: ReactNode }, { failed: boolean }> {
  state = { failed: false }
  static getDerivedStateFromError() {
    return { failed: true }
  }
  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error('mirror isle boot failed', error, info)
    document.documentElement.dataset.mirrorReady = 'error'
  }
  render() {
    if (!this.state.failed) return this.props.children
    return (
      <main style={{ minHeight: '100dvh', display: 'grid', placeItems: 'center', padding: 24, background: '#fffaf4', color: '#4b4038' }}>
        <section style={{ width: 'min(100%, 420px)', textAlign: 'center' }}>
          <h1 style={{ fontFamily: 'serif', marginBottom: 12 }}>镜屿</h1>
          <p style={{ lineHeight: 1.7, color: '#7c7068' }}>本机启动数据出现异常。清理本机数据后可以重新进入，云端账号资料不会被删除。</p>
          <button
            style={{ marginTop: 20, minHeight: 48, padding: '0 22px', border: 0, borderRadius: 14, background: '#c98066', color: '#fff', fontWeight: 700 }}
            onClick={async () => {
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
                // Continue with local reset even when WebView cache APIs are unavailable.
              }
              Object.keys(window.localStorage).filter((key) => key.startsWith('mirror-isle:')).forEach((key) => window.localStorage.removeItem(key))
              window.location.reload()
            }}
          >
            修复本机数据并重启
          </button>
        </section>
      </main>
    )
  }
}

const root = document.getElementById('root')
if (root) {
  createRoot(root).render(
    <BootBoundary>
      <NativeBootGuard />
      <App />
      <LayerBoundary>
        <Suspense fallback={null}>
          <V017Layer />
        </Suspense>
      </LayerBoundary>
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
