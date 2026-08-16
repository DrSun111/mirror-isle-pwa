import { useEffect } from 'react'
import { getScenicWebp, type ScenicKind } from './scenicWebp'
import './mirror-v2-product-polish.css'

function findPage(title:string){
  return Array.from(document.querySelectorAll<HTMLElement>('.m2-page')).find(page=>page.querySelector('.m2-main-header h1')?.textContent?.trim()===title) || null
}

function clickText(root:ParentNode, selector:string, text:string){
  const target=Array.from(root.querySelectorAll<HTMLElement>(selector)).find(el=>el.textContent?.trim().includes(text))
  target?.click()
  return Boolean(target)
}

function openComposer(page:HTMLElement, mode:'text'|'image'|'video'|'review'='text'){
  const trigger=(page.querySelector('button[aria-label="发动态"]') || page.querySelector('.m2-pill-button')) as HTMLElement | null
  if(trigger) trigger.click()
  else clickText(page,'button','发布')
  window.setTimeout(()=>{
    const sheet=document.querySelector('.m2-sheet')
    if(!sheet) return
    const label=mode==='text'?'图文':mode==='image'?'图片':mode==='video'?'视频':'点评'
    clickText(sheet,'.m2-segment button',label)
  },70)
}

function art(kind:ScenicKind){
  try{return getScenicWebp(kind)}catch{return ''}
}

function makeCreateButton(kind:ScenicKind,title:string,sub:string,action:string){
  const button=document.createElement('button')
  button.type='button'
  button.className='m2-product-create-card'
  button.dataset.action=action
  const image=document.createElement('span')
  image.className='m2-product-create-art'
  image.style.backgroundImage=`url("${art(kind)}")`
  const copy=document.createElement('span')
  copy.className='m2-product-create-copy'
  copy.innerHTML=`<strong>${title}</strong><small>${sub}</small>`
  button.append(image,copy)
  return button
}

function applyMeet(){
  const page=findPage('遇见')
  if(!page)return
  page.querySelectorAll('.m2-ice').forEach(node=>node.remove())
  page.classList.add('m2-product-page')
}

function applyRecord(){
  const page=findPage('记录')
  if(!page)return
  page.classList.add('m2-product-page')
  const scroll=page.querySelector<HTMLElement>('.m2-page-scroll')
  if(!scroll||scroll.querySelector('.m2-product-create-hub'))return
  const hub=document.createElement('section')
  hub.className='m2-product-create-hub'
  hub.innerHTML='<header><div><small>CREATE</small><h2>记录此刻</h2></div><span>文字 · 图片 · 视频</span></header>'
  const grid=document.createElement('div')
  grid.className='m2-product-create-grid'
  grid.append(
    makeCreateButton('record','写树洞','私密记录','note'),
    makeCreateButton('recommend','发动态','图文与图片','post'),
    makeCreateButton('world','发视频','分享生活片段','video'),
  )
  hub.append(grid)
  hub.addEventListener('click',event=>{
    const button=(event.target as HTMLElement).closest<HTMLButtonElement>('button[data-action]')
    if(!button)return
    if(button.dataset.action==='note'){
      const note=page.querySelector<HTMLElement>('button[aria-label="写树洞"]')
      if(note)note.click(); else clickText(page,'button','写树洞')
    }else if(button.dataset.action==='video') openComposer(page,'video')
    else openComposer(page,'text')
  })
  const anchor=scroll.querySelector('.m2-record-mode') || scroll.querySelector('.m2-record-intro')
  if(anchor)anchor.insertAdjacentElement('afterend',hub); else scroll.prepend(hub)
}

function applyGrowth(){
  const page=findPage('成长')
  if(!page)return
  page.classList.add('m2-product-page')
  const scroll=page.querySelector<HTMLElement>('.m2-page-scroll')
  if(!scroll||scroll.querySelector('.m2-growth-create-hub'))return
  const hub=document.createElement('section')
  hub.className='m2-product-create-hub m2-growth-create-hub'
  hub.innerHTML='<header><div><small>PUBLISH</small><h2>分享与创作</h2></div><span>让发布入口更直接</span></header>'
  const grid=document.createElement('div')
  grid.className='m2-product-create-grid'
  grid.append(
    makeCreateButton('growth','发帖子','文字与观点','text'),
    makeCreateButton('recommend','发图片','照片与作品','image'),
    makeCreateButton('world','发视频','短视频内容','video'),
  )
  hub.append(grid)
  hub.addEventListener('click',event=>{
    const button=(event.target as HTMLElement).closest<HTMLButtonElement>('button[data-action]')
    if(!button)return
    openComposer(page,(button.dataset.action||'text') as 'text'|'image'|'video')
  })
  const hero=scroll.querySelector('.m2-growth-hero')
  if(hero)hero.insertAdjacentElement('afterend',hub); else scroll.prepend(hub)
}

function applyMine(){
  const page=findPage('我的')
  if(!page)return
  page.classList.add('m2-product-page')
  const themeArts:ScenicKind[]=['meet','drift','recommend']
  page.querySelectorAll<HTMLImageElement>('.m2-theme-grid .m2-scenic').forEach((img,index)=>{
    const src=art(themeArts[index%themeArts.length])
    if(src&&img.src!==src)img.src=src
  })
  const assessmentArts:ScenicKind[]=['meet','growth','record','world']
  page.querySelectorAll<HTMLElement>('.m2-assessment-cards button').forEach((button,index)=>{
    button.classList.add('m2-product-assessment-card')
    button.style.setProperty('--m2-product-art',`url("${art(assessmentArts[index%assessmentArts.length])}")`)
  })
}

function applyIllustratedEmptyStates(){
  const kinds:ScenicKind[]=['recommend','record','world','growth']
  document.querySelectorAll<HTMLElement>('.m2-empty').forEach((empty,index)=>{
    empty.classList.add('m2-product-empty')
    if(!empty.style.backgroundImage)empty.style.backgroundImage=`linear-gradient(90deg,rgba(255,255,255,.96),rgba(255,255,255,.76)),url("${art(kinds[index%kinds.length])}")`
  })
}

function applySheets(){
  document.querySelectorAll<HTMLElement>('.m2-sheet').forEach(sheet=>{
    if(sheet.querySelector('.m2-person-sheet'))sheet.classList.add('m2-product-person-modal')
    if(sheet.querySelector('.m2-composer'))sheet.classList.add('m2-product-composer-modal')
  })
}

function applyAll(){
  applyMeet();applyRecord();applyGrowth();applyMine();applyIllustratedEmptyStates();applySheets()
  document.documentElement.dataset.productPolish='212'
}

export default function MirrorV2ProductPolish(){
  useEffect(()=>{
    let raf=0
    const schedule=()=>{cancelAnimationFrame(raf);raf=requestAnimationFrame(applyAll)}
    schedule()
    const observer=new MutationObserver(schedule)
    observer.observe(document.body,{childList:true,subtree:true})
    window.addEventListener('resize',schedule)
    return()=>{observer.disconnect();window.removeEventListener('resize',schedule);cancelAnimationFrame(raf)}
  },[])
  return null
}
