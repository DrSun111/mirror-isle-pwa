import { useEffect } from 'react'
import { Capacitor } from '@capacitor/core'

async function clearNativeWebCaches() {
  if (!Capacitor.isNativePlatform()) return
  try {
    if ('serviceWorker' in navigator) {
      const registrations = await navigator.serviceWorker.getRegistrations()
      await Promise.all(registrations.map((registration) => registration.unregister()))
    }
  } catch {
    // Native boot must continue even when WebView does not expose service workers.
  }
  try {
    if ('caches' in window) {
      const keys = await caches.keys()
      await Promise.all(keys.map((key) => caches.delete(key)))
    }
  } catch {
    // Cache cleanup is best-effort only.
  }
}

export default function NativeBootGuard() {
  useEffect(() => {
    const timer = window.setTimeout(() => {
      void clearNativeWebCaches()
    }, 300)
    return () => window.clearTimeout(timer)
  }, [])
  return null
}
