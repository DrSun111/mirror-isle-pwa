import { useEffect } from 'react'
import { POLISH_SCENIC_ATLAS, POLISH_SCENE_POSITIONS, type PolishScene } from './polishScenicAtlas'
import './mirror-v2-polish.css'

function setSceneArt(target: Element | null, scene: PolishScene, extraClass = '') {
  if (!(target instanceof HTMLElement)) return
  target.classList.add('m2-polished-visual')
  let art = target.querySelector(':scope > .m2-polish-art') as HTMLElement | null
  if (!art) {
    art = document.createElement('div')
    art.className = `m2-polish-art ${extraClass}`.trim()
    target.prepend(art)
  }
  art.dataset.scene = scene
  art.style.backgroundImage = `url("${POLISH_SCENIC_ATLAS}")`
  art.style.backgroundSize = '200% 300%'
  art.style.backgroundPosition = POLISH_SCENE_POSITIONS[scene]
  art.style.backgroundRepeat = 'no-repeat'
  const oldScenic = target.querySelector(':scope > .m2-scenic')
  if (oldScenic instanceof HTMLElement) oldScenic.classList.add('m2-polish-hidden-scenic')
}

function setPageBackdrop(page: HTMLElement, scene: PolishScene) {
  let backdrop = page.querySelector(':scope > .m2-polish-page-scene') as HTMLElement | null
  if (!backdrop) {
    backdrop = document.createElement('div')
    backdrop.className = 'm2-polish-page-scene'
    page.prepend(backdrop)
  }
  backdrop.style.backgroundImage = `url("${POLISH_SCENIC_ATLAS}")`
  backdrop.style.backgroundSize = '200% 300%'
  backdrop.style.backgroundPosition = POLISH_SCENE_POSITIONS[scene]
  backdrop.style.backgroundRepeat = 'no-repeat'
}

function sectionByLabel(scroll: HTMLElement, label: string) {
  return Array.from(scroll.querySelectorAll(':scope > .m2-section')).find((section) => {
    const small = section.querySelector(':scope > header small')?.textContent?.trim().toUpperCase()
    return small === label
  }) as HTMLElement | undefined
}

function applyRecordNavigation(page: HTMLElement) {
  const scroll = page.querySelector('.m2-page-scroll') as HTMLElement | null
  if (!scroll) return
  const calendar = scroll.querySelector(':scope > .m2-calendar-card') as HTMLElement | null
  const tree = sectionByLabel(scroll, 'PRIVATE')
  const world = sectionByLabel(scroll, 'WORLD')
  if (!calendar || !tree || !world) return

  calendar.classList.add('m2-record-mood-panel')
  tree.classList.add('m2-record-tree-section')
  world.classList.add('m2-record-world-section')

  const intro = scroll.querySelector(':scope > .m2-record-intro')
  setSceneArt(intro, 'record')

  let nav = scroll.querySelector(':scope > .m2-record-mode') as HTMLElement | null
  if (!nav) {
    nav = document.createElement('div')
    nav.className = 'm2-record-mode'
    nav.setAttribute('role', 'tablist')
    nav.innerHTML = `
      <button type="button" data-view="mood" class="active"><span>心情打卡</span><small>日历与此刻</small></button>
      <button type="button" data-view="tree"><span>树洞</span><small>只给自己</small></button>
      <button type="button" data-view="world"><span>世界</span><small>公开分享</small></button>
    `
    if (intro?.parentElement === scroll) intro.insertAdjacentElement('afterend', nav)
    else scroll.prepend(nav)

    nav.addEventListener('click', (event) => {
      const button = (event.target as HTMLElement).closest('button[data-view]') as HTMLButtonElement | null
      if (!button) return
      const view = button.dataset.view || 'mood'
      scroll.dataset.recordView = view
      nav?.querySelectorAll('button').forEach((item) => item.classList.toggle('active', item === button))
      window.scrollTo({ top: 0, behavior: 'smooth' })
    })
  }
  if (!scroll.dataset.recordView) scroll.dataset.recordView = 'mood'
}

function applyPolish() {
  const pages = Array.from(document.querySelectorAll('.m2-page')) as HTMLElement[]
  pages.forEach((page) => {
    const title = page.querySelector('.m2-main-header h1')?.textContent?.trim()
    if (!title) return
    const mapping: Record<string, { key: string; scene: PolishScene }> = {
      '遇见': { key: 'meet', scene: 'meet' },
      '记录': { key: 'record', scene: 'record' },
      '消息': { key: 'messages', scene: 'world' },
      '成长': { key: 'growth', scene: 'growth' },
      '我的': { key: 'mine', scene: 'mine' },
    }
    const config = mapping[title]
    if (!config) return
    page.dataset.polishPage = config.key
    setPageBackdrop(page, config.scene)

    if (title === '记录') applyRecordNavigation(page)
    if (title === '成长') setSceneArt(page.querySelector('.m2-growth-hero'), 'growth')
    if (title === '我的') setSceneArt(page.querySelector('.m2-profile-card'), 'mine', 'm2-polish-profile-art')
    if (title === '遇见') {
      setSceneArt(page.querySelector('.m2-drift-card'), 'drift')
      const fallbackFeatured = page.querySelector('.m2-featured-image > .m2-scenic')
      if (fallbackFeatured) setSceneArt(fallbackFeatured.parentElement, 'meet')
    }
  })

  document.querySelectorAll('.m2-drift-visual').forEach((target) => setSceneArt(target, 'drift'))
}

export default function MirrorV2Polish() {
  useEffect(() => {
    let raf = 0
    const schedule = () => {
      window.cancelAnimationFrame(raf)
      raf = window.requestAnimationFrame(applyPolish)
    }
    schedule()
    const observer = new MutationObserver(schedule)
    observer.observe(document.body, { childList: true, subtree: true })
    window.addEventListener('resize', schedule)
    return () => {
      observer.disconnect()
      window.removeEventListener('resize', schedule)
      window.cancelAnimationFrame(raf)
    }
  }, [])
  return null
}
