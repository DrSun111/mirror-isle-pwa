import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.tsx'
import ExperienceV014 from './ExperienceV014.tsx'
import DriftInboxLayer from './DriftInboxLayer.tsx'
import MarketReadyLayer from './MarketReadyLayer.tsx'
import V016Layer from './V016Layer.tsx'
import V017Layer from './V017Layer.tsx'
import AuthStabilityLayer from './AuthStabilityLayer.tsx'
import VersionPatch from './VersionPatch.tsx'

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <>
      <App />
      <ExperienceV014 />
      <DriftInboxLayer />
      <MarketReadyLayer />
      <V016Layer />
      <V017Layer />
      <AuthStabilityLayer />
      <VersionPatch />
    </>
  </StrictMode>,
)

if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register(`${import.meta.env.BASE_URL}sw.js`).catch(() => {
      // The app still works without offline caching.
    })
  })
}
