import { createRoot } from 'react-dom/client'
import { Capacitor } from '@capacitor/core'
import './index.css'
import CleanExperience from './CleanExperience'

const assetBase = import.meta.env.BASE_URL
const rootStyle = document.documentElement.style
rootStyle.setProperty('--mirror-meet', `url("${assetBase}assets/mirror/meet.png")`)
rootStyle.setProperty('--mirror-treehole', `url("${assetBase}assets/mirror/treehole.png")`)
rootStyle.setProperty('--mirror-chat', `url("${assetBase}assets/mirror/chat.png")`)
rootStyle.setProperty('--mirror-mine', `url("${assetBase}assets/mirror/mine.png")`)

const root = document.getElementById('root')
if (root) createRoot(root).render(<CleanExperience />)

if (!Capacitor.isNativePlatform() && 'serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register(`${import.meta.env.BASE_URL}sw.js`).catch(() => undefined)
  })
}
