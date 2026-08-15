import { Component, lazy, Suspense } from 'react'
import type { ErrorInfo, ReactNode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.tsx'
import AuthStabilityLayer from './AuthStabilityLayer.tsx'
import VersionPatch from './VersionPatch.tsx'

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
  }
  render() {
    if (!this.state.failed) return this.props.children
    return (
      <main style={{ minHeight: '100dvh', display: 'grid', placeItems: 'center', padding: 24, background: '#fffaf4', color: '#4b4038' }}>
        <section style={{ width: 'min(100%, 420px)', textAlign: 'center' }}>
          <h1 style={{ fontFamily: 'serif', marginBottom: 12 }}>镜屿</h1>
          <p style={{ lineHeight: 1.7, color: '#7c7068' }}>检测到本机缓存或组件启动异常。可以清理镜屿本地缓存后重新启动，不会删除云端账号数据。</p>
          <button
            style={{ marginTop: 20, minHeight: 48, padding: '0 22px', border: 0, borderRadius: 14, background: '#c98066', color: '#fff', fontWeight: 700 }}
            onClick={() => {
              Object.keys(window.localStorage).filter((key) => key.startsWith('mirror-isle:')).forEach((key) => window.localStorage.removeItem(key))
              window.location.reload()
            }}
          >
            清理本机缓存并重启
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
      <App />
      <AuthStabilityLayer />
      <VersionPatch />
      <LayerBoundary>
        <Suspense fallback={null}>
          <V017Layer />
        </Suspense>
      </LayerBoundary>
    </BootBoundary>,
  )
}

if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register(`${import.meta.env.BASE_URL}sw.js`).catch(() => {
      // The app still works without offline caching.
    })
  })
}
