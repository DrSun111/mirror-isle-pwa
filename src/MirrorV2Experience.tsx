import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import {
  ArrowLeft, Bell, BookOpen, CalendarDays, Camera, Check, ChevronLeft, ChevronRight, Eye, EyeOff,
  Globe2, Heart, Image as ImageIcon, Leaf, LockKeyhole, LogOut, MessageCircle, Palette, PenLine, Play,
  Plus, RefreshCw, Save, Search, Send, SlidersHorizontal, Sparkles, Star, UserRound, Users, Video,
  Waves, Wind, X,
} from 'lucide-react'
import AssessmentSceneArt, { type SceneKind } from './AssessmentSceneArt'
import { assessments, scoreAssessment, type AssessmentDefinition } from './psychAssessments'
import {
  addPostComment, applyIpipScores, cleanSupabase, connectWithUser, createFeedPost, createPrivateNote,
  fetchAssessmentRuns, fetchConversationList, fetchFeed, fetchMatchProfile, fetchMessages, fetchMoodHistory,
  fetchNotifications, fetchPrivateNotes, fetchRecommendationsV2, fetchWallet, loginEmail, logoutV2,
  markAllNotificationsRead, markConversationRead, pickBottle, recordMood, registerEmail, restoreV2Account,
  saveAssessmentRun, saveMatchProfile, saveStoryAssessment, sendMessage, sendPasswordReset, subscribeConversation,
  throwBottle, togglePostLike, updateV2Profile, uploadPublicMedia,
  type AppNotification, type ChatMessage, type ConversationItem, type FeedPost, type MatchProfile,
  type MirrorV2Profile, type MoodKey, type MoodRow, type PrivateNote, type RecommendationV2, type ThemeKey,
  type Wallet,
} from './mirrorV2Api'
import './mirror-v2.css'

type MainTab = 'meet' | 'record' | 'messages' | 'growth' | 'mine'
type AuthMode = 'login' | 'register'

type StoryQuestion = {
  id: string
  prompt: string
  scene: SceneKind
  factor: 'E' | 'A' | 'C' | 'S' | 'O'
  labels: [string, string, string, string]
}

const storyQuestions: StoryQuestion[] = [
  { id:'forest-lodge', prompt:'你走进一间林间旅舍，屋里都是陌生人。你会更自然地？', scene:'lodge', factor:'E', labels:['靠窗坐下','先观察一会','加入聊天','主动认识大家'] },
  { id:'campfire-silence', prompt:'篝火边忽然安静下来，你通常会？', scene:'campfire', factor:'E', labels:['享受安静','等别人开口','接住一个话题','主动开启话题'] },
  { id:'companion-low', prompt:'同行的人突然有些低落，你会先？', scene:'comfort', factor:'A', labels:['留一点空间','轻声问一句','安静陪一会','认真听对方说'] },
  { id:'stranger-help', prompt:'路边有人把东西散了一地，你更可能？', scene:'help', factor:'A', labels:['提醒一下','顺手帮几个','一起收拾好','再陪对方一程'] },
  { id:'morning-pack', prompt:'明早要进山，睡前的你更像哪一幕？', scene:'packing', factor:'C', labels:['随手带上','大致准备','列好清单','提前全部收好'] },
  { id:'leave-camp', prompt:'准备离开营地时，你会怎样收尾？', scene:'tidy', factor:'C', labels:['晚点再说','收好自己的','分类整理','离开前再检查'] },
  { id:'sudden-rain', prompt:'山路突然下起大雨，你的第一反应更像？', scene:'rain', factor:'S', labels:['有点慌','先找地方躲雨','确认方向和物品','稳定处理再继续'] },
  { id:'waiting-note', prompt:'一张重要的纸条迟迟没有回音，你会？', scene:'waiting', factor:'S', labels:['反复确认','忍不住想很多','先去做别的事','安心等待'] },
  { id:'unknown-path', prompt:'森林里出现一条从没走过的小路，你更想？', scene:'path', factor:'O', labels:['走熟悉的路','看看路牌','试走一小段','走向未知'] },
  { id:'old-map', prompt:'你捡到一张画满奇怪符号的旧地图，会？', scene:'map', factor:'O', labels:['找明确指示','先猜一猜','联想背后的故事','探索其中规律'] },
]

const moodOptions: Array<{key:MoodKey; label:string; emoji:string}> = [
  { key:'sunny', label:'明亮', emoji:'☺' },
  { key:'breeze', label:'平静', emoji:'◡' },
  { key:'cloudy', label:'一般', emoji:'—' },
  { key:'rain', label:'低落', emoji:'⌢' },
  { key:'wave', label:'波动', emoji:'≈' },
]

const themeOptions: Array<{key:ThemeKey; label:string; image:string}> = [
  { key:'green_morning', label:'绿野晨光', image:'meet.png' },
  { key:'sea_mist', label:'海雾蓝调', image:'relationship-map.png' },
  { key:'sunset_orange', label:'落日暖橙', image:'welcome.png' },
]

const hobbyOptions = ['阅读','摄影','徒步','电影','音乐','旅行','烹饪','展览','写作','运动','咖啡','自然']
const dietOptions = ['清淡','少糖','素食友好','爱甜品','咖啡适量','规律三餐','不吃香菜','爱做饭']

function formatDateTime(value: string) {
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return ''
  return new Intl.DateTimeFormat('zh-CN', { month:'numeric', day:'numeric', hour:'2-digit', minute:'2-digit', hour12:false }).format(date)
}

function formatDay(value: string) {
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return ''
  return new Intl.DateTimeFormat('zh-CN', { month:'numeric', day:'numeric' }).format(date)
}

function dateKey(date = new Date()) {
  return `${date.getFullYear()}-${String(date.getMonth()+1).padStart(2,'0')}-${String(date.getDate()).padStart(2,'0')}`
}

function clamp(value:number) { return Math.max(0, Math.min(100, Math.round(value))) }

function storyScores(responses: Record<string,number>) {
  const factors: Record<'E'|'A'|'C'|'S'|'O', number[]> = { E:[], A:[], C:[], S:[], O:[] }
  storyQuestions.forEach((q) => { if (responses[q.id]) factors[q.factor].push(responses[q.id]) })
  const factor = (key:keyof typeof factors) => {
    const values = factors[key]
    const avg = values.length ? values.reduce((a,b)=>a+b,0)/values.length : 2.5
    return clamp(((avg-1)/3)*100)
  }
  return { extraversion:factor('E'), agreeableness:factor('A'), conscientiousness:factor('C'), emotionalStability:factor('S'), openness:factor('O') }
}

function Avatar({ profile, size='md' }: { profile: Pick<MirrorV2Profile,'nickname'|'avatar_url'>; size?:'sm'|'md'|'lg'|'xl' }) {
  return <div className={`m2-avatar ${size}`}>{profile.avatar_url ? <img src={profile.avatar_url} alt="" loading="lazy"/> : <span>{profile.nickname.slice(0,1)}</span>}</div>
}

function Scenic({ file, className='' }: { file:string; className?:string }) {
  return <img className={`m2-scenic ${className}`} src={`${import.meta.env.BASE_URL}assets/mirror/${file}`} alt="" loading="lazy"/>
}

function IconButton({ children, onClick, title }: { children:ReactNode; onClick?:()=>void; title?:string }) {
  return <button className="m2-icon-button" onClick={onClick} aria-label={title}>{children}</button>
}

function Sheet({ open, title, onClose, children, wide=false }: { open:boolean; title:string; onClose:()=>void; children:ReactNode; wide?:boolean }) {
  if (!open) return null
  return <div className="m2-overlay" onMouseDown={(e)=>{ if(e.currentTarget===e.target) onClose() }}>
    <section className={`m2-sheet ${wide?'wide':''}`}>
      <header><h2>{title}</h2><IconButton onClick={onClose} title="关闭"><X size={20}/></IconButton></header>
      <div className="m2-sheet-body">{children}</div>
    </section>
  </div>
}

function LoadingCard({ text='正在加载…' }: {text?:string}) { return <div className="m2-loading"><Leaf size={20}/><span>{text}</span></div> }
function EmptyCard({ children }: {children:ReactNode}) { return <div className="m2-empty"><Wind size={20}/><p>{children}</p></div> }

function friendlyAuthError(error:unknown) {
  const raw = error instanceof Error ? error.message : String(error ?? '')
  if (/invalid login credentials/i.test(raw)) return '邮箱或密码不正确'
  if (/email not confirmed/i.test(raw)) return '请先在邮箱中完成验证'
  if (/user already registered|email_already_registered/i.test(raw)) return '该邮箱已有账号，请直接登录'
  if (/invite_required/i.test(raw)) return '请输入推荐码'
  if (/invalid_invite_code|invalid_or_exhausted_invite/i.test(raw)) return '推荐码不正确'
  if (/invite_expired/i.test(raw)) return '推荐码已过期'
  if (/invite_exhausted/i.test(raw)) return '推荐码使用次数已达上限'
  if (/weak_password|password should be at least/i.test(raw)) return '密码至少需要 6 位'
  if (/rate limit/i.test(raw)) return '操作过于频繁，请稍后再试'
  if (/network|fetch/i.test(raw)) return '网络暂时不可用'
  return raw || '暂时无法完成操作'
}

function AuthScreen({ onReady }: {onReady:(profile:MirrorV2Profile)=>void}) {
  const [mode,setMode]=useState<AuthMode>('login')
  const [email,setEmail]=useState('')
  const [password,setPassword]=useState('')
  const [confirm,setConfirm]=useState('')
  const [inviteCode,setInviteCode]=useState('')
  const [showPassword,setShowPassword]=useState(false)
  const [busy,setBusy]=useState(false)
  const [message,setMessage]=useState('')

  const submit=async()=>{
    const normalized=email.trim().toLowerCase()
    if(!/^\S+@\S+\.\S+$/.test(normalized)){setMessage('请输入有效邮箱');return}
    if(mode==='login'&&!password){setMessage('请输入密码');return}
    if(mode==='register'&&password.length<6){setMessage('密码至少 6 位');return}
    if(mode==='register'&&password!==confirm){setMessage('两次密码不一致');return}
    if(mode==='register'&&!inviteCode.trim()){setMessage('请输入推荐码');return}
    setBusy(true);setMessage('')
    try{
      if(mode==='login'){
        const result=await loginEmail(normalized,password)
        onReady(result.profile)
      }else{
        const result=await registerEmail(normalized,password,inviteCode)
        onReady(result.profile)
      }
    }catch(error){setMessage(friendlyAuthError(error))}
    finally{setBusy(false)}
  }

  const reset=async()=>{
    if(!/^\S+@\S+\.\S+$/.test(email.trim())){setMessage('先填写邮箱');return}
    setBusy(true);setMessage('')
    try{await sendPasswordReset(email);setMessage('密码重置邮件已发送')}
    catch(error){setMessage(friendlyAuthError(error))}
    finally{setBusy(false)}
  }

  return <main className="m2-auth">
    <section className="m2-auth-hero">
      <Scenic file="auth-landscape.svg" className="hero-image"/>
      <div className="m2-auth-gradient"/>
      <div className="m2-auth-brand"><span>MIRROR ISLE</span><div><Leaf size={17}/><Wind size={17}/></div></div>
      <div className="m2-auth-copy"><h1>镜屿</h1><p>寻找世界上另一个自己</p></div>
    </section>
    <section className="m2-auth-panel">
      <div className="m2-auth-switch"><button className={mode==='login'?'active':''} onClick={()=>{setMode('login');setMessage('')}}>登录</button><button className={mode==='register'?'active':''} onClick={()=>{setMode('register');setMessage('')}}>注册</button></div>
      <label><span>邮箱</span><input value={email} onChange={e=>setEmail(e.target.value)} autoCapitalize="none" inputMode="email" autoComplete="email" placeholder="name@example.com"/></label>
      <label><span>密码</span><div className="m2-password"><input type={showPassword?'text':'password'} value={password} onChange={e=>setPassword(e.target.value)} autoComplete={mode==='login'?'current-password':'new-password'} placeholder={mode==='login'?'请输入密码':'至少 6 位'}/><button type="button" onClick={()=>setShowPassword(v=>!v)}>{showPassword?<EyeOff size={18}/>:<Eye size={18}/>}</button></div></label>
      {mode==='register'&&<><label><span>确认密码</span><input type="password" value={confirm} onChange={e=>setConfirm(e.target.value)} autoComplete="new-password" placeholder="再次输入密码"/></label><label><span>推荐码</span><input value={inviteCode} onChange={e=>setInviteCode(e.target.value.toUpperCase())} autoCapitalize="characters" autoComplete="off" maxLength={24} placeholder="请输入推荐码"/></label></>}
      <button className="m2-primary" disabled={busy} onClick={()=>void submit()}>{busy?'请稍候…':mode==='login'?'进入镜屿':'创建账号'}</button>
      {message&&<p className="m2-form-message">{message}</p>}
      {mode==='login'&&<button className="m2-text-button" disabled={busy} onClick={()=>void reset()}>忘记密码</button>}
    </section>
  </main>
}

function StoryAssessment({ onDone, allowExit=false, onExit }: {onDone:()=>void;allowExit?:boolean;onExit?:()=>void}) {
  const [index,setIndex]=useState(0)
  const [responses,setResponses]=useState<Record<string,number>>({})
  const [busy,setBusy]=useState(false)
  const [message,setMessage]=useState('')
  const q=storyQuestions[index]
  const selected=responses[q.id]
  const next=async()=>{
    if(!selected)return
    if(index<storyQuestions.length-1){setIndex(v=>v+1);return}
    setBusy(true);setMessage('')
    try{await saveStoryAssessment(storyScores(responses),responses);onDone()}
    catch(error){setMessage(error instanceof Error?error.message:'保存失败')}
    finally{setBusy(false)}
  }
  return <main className="m2-story">
    <header><button disabled={!allowExit} className={!allowExit?'ghosted':''} onClick={onExit}><ArrowLeft size={20}/></button><div className="m2-progress"><span style={{width:`${((index+1)/storyQuestions.length)*100}%`}}/></div><small>{index+1}/{storyQuestions.length}</small></header>
    <section className="m2-story-copy"><small>初见心谱</small><h1>{q.prompt}</h1></section>
    <section className="m2-story-grid">{q.labels.map((label,i)=>{const value=i+1;return <button key={label} className={selected===value?'active':''} onClick={()=>setResponses(r=>({...r,[q.id]:value}))}><AssessmentSceneArt kind={q.scene} level={i as 0|1|2|3}/><span>{label}</span></button>})}</section>
    {message&&<p className="m2-form-message">{message}</p>}
    <footer><button className="m2-primary" disabled={!selected||busy} onClick={()=>void next()}>{busy?'保存中…':index===storyQuestions.length-1?'完成心谱':'下一题'}</button></footer>
  </main>
}

function Onboarding({ profile, onDone }: {profile:MirrorV2Profile;onDone:(profile:MirrorV2Profile)=>void}) {
  const [stage,setStage]=useState<'profile'|'story'>(profile.age_confirmed?'story':'profile')
  const [nickname,setNickname]=useState(profile.nickname)
  const [age,setAge]=useState('')
  const [city,setCity]=useState(profile.city==='未设置'?'':profile.city)
  const [profession,setProfession]=useState(profile.profession)
  const [goal,setGoal]=useState(profile.goal||'深度朋友')
  const [busy,setBusy]=useState(false)
  const [message,setMessage]=useState('')
  const save=async()=>{
    const ageValue=Number(age)
    if(!nickname.trim()){setMessage('请填写昵称');return}
    if(!Number.isFinite(ageValue)||ageValue<18||ageValue>99){setMessage('镜屿当前仅面向 18 岁以上用户');return}
    setBusy(true);setMessage('')
    try{
      await cleanSupabase.from('mirror_profiles').update({age:ageValue}).eq('id',profile.id)
      const next=await updateV2Profile({nickname:nickname.trim(),city:city.trim()||'未设置',profession:profession.trim(),goal,age_confirmed:true,intro:'很高兴在镜屿遇见你。'})
      onDone(next);setStage('story')
    }catch(error){setMessage(error instanceof Error?error.message:'保存失败')}
    finally{setBusy(false)}
  }
  if(stage==='story') return <StoryAssessment onDone={()=>void restoreV2Account().then(a=>a&&onDone(a.profile))}/>
  return <main className="m2-onboarding"><section className="m2-onboarding-card"><div className="m2-small-brand"><Leaf size={18}/><Wind size={17}/></div><small>WELCOME TO MIRROR ISLE</small><h1>先让镜屿认识你</h1><div className="m2-form-grid"><label><span>昵称</span><input value={nickname} onChange={e=>setNickname(e.target.value)} maxLength={18}/></label><label><span>年龄</span><input value={age} onChange={e=>setAge(e.target.value.replace(/\D/g,''))} inputMode="numeric" placeholder="18+"/></label><label><span>所在城市</span><input value={city} onChange={e=>setCity(e.target.value)} placeholder="例如：杭州"/></label><label><span>职业 / 身份</span><input value={profession} onChange={e=>setProfession(e.target.value)} placeholder="例如：产品设计师"/></label><label className="span-2"><span>希望遇见</span><select value={goal} onChange={e=>setGoal(e.target.value)}><option>深度朋友</option><option>兴趣同伴</option><option>共同成长</option><option>长期关系</option></select></label></div><button className="m2-primary" disabled={busy} onClick={()=>void save()}>{busy?'保存中…':'开始初见心谱'}</button>{message&&<p className="m2-form-message">{message}</p>}</section></main>
}

function MainHeader({ title, action }: {title:string;action?:ReactNode}) {
  return <header className="m2-main-header"><div><h1>{title}</h1><span/></div>{action}</header>
}

function BottomNav({ tab, onChange, unread=0 }: {tab:MainTab;onChange:(tab:MainTab)=>void;unread?:number}) {
  const items:Array<{key:MainTab;label:string;icon:ReactNode}>=[
    {key:'meet',label:'遇见',icon:<Leaf/>},{key:'record',label:'记录',icon:<PenLine/>},{key:'messages',label:'消息',icon:<MessageCircle/>},{key:'growth',label:'成长',icon:<BookOpen/>},{key:'mine',label:'我的',icon:<UserRound/>},
  ]
  return <nav className="m2-bottom-nav">{items.map(item=><button key={item.key} className={tab===item.key?'active':''} onClick={()=>onChange(item.key)}><span className="m2-nav-icon">{item.icon}{item.key==='messages'&&unread>0&&<i>{unread>9?'9+':unread}</i>}</span><small>{item.label}</small></button>)}</nav>
}

function PersonSheet({ person, open, onClose, onChat }: {person:RecommendationV2|null;open:boolean;onClose:()=>void;onChat:(p:RecommendationV2,conversationId:string)=>void}) {
  const [busy,setBusy]=useState(false)
  const [message,setMessage]=useState('')
  if(!person)return null
  const connect=async()=>{setBusy(true);setMessage('');try{const result=await connectWithUser(person.id);onChat(person,result.conversationId)}catch(error){setMessage(error instanceof Error?error.message:'暂时无法连接')}finally{setBusy(false)}}
  return <Sheet open={open} title="遇见" onClose={onClose}><div className="m2-person-sheet"><Avatar profile={person} size="xl"/><h2>{person.nickname}</h2><p className="muted">{[person.age?`${person.age}岁`:'',person.city,person.profession].filter(Boolean).join(' · ')}</p><p>{person.intro||'愿我们在彼此的生活里，留下真实而温柔的回应。'}</p><div className="m2-score-ring"><b>{person.score}%</b><span>契合度</span></div><div className="m2-score-grid"><div><b>{person.psych_score}%</b><span>心理特质</span></div><div><b>{person.mbti_score}%</b><span>MBTI 偏好</span></div><div><b>{person.lifestyle_score}%</b><span>作息接近</span></div><div><b>{person.interest_score}%</b><span>兴趣共鸣</span></div></div><div className="m2-chips">{person.anchors.map(a=><span key={a}>{a}</span>)}</div><button className="m2-primary" disabled={busy} onClick={()=>void connect()}><Heart size={18}/>{busy?'连接中…':'认识一下'}</button>{message&&<p className="m2-form-message">{message}</p>}</div></Sheet>
}

function DriftSheet({ open, onClose }: {open:boolean;onClose:()=>void}) {
  const [wallet,setWallet]=useState<Wallet|null>(null)
  const [picked,setPicked]=useState<{content:string;author:string}|null>(null)
  const [content,setContent]=useState('')
  const [busy,setBusy]=useState(false)
  const [message,setMessage]=useState('')
  const load=async()=>{try{setWallet(await fetchWallet())}catch{/* ignore */}}
  useEffect(()=>{if(open)void load()},[open])
  const pick=async()=>{setBusy(true);setMessage('');try{let current=wallet;if(!current||current.bottleCredits<1){const { redeemBottleCredit }=await import('./mirrorV2Api');current=await redeemBottleCredit();setWallet(current)}const result=await pickBottle();setWallet(result.wallet);setPicked(result.bottle?{content:result.bottle.content,author:result.bottle.author}:null);if(!result.bottle)setMessage('暂时没有新的瓶子漂到这里')}catch(error){setMessage(error instanceof Error?error.message:'暂时捡不到瓶子')}finally{setBusy(false)}}
  const send=async()=>{if(!content.trim())return;setBusy(true);setMessage('');try{await throwBottle(content,true);setContent('');setMessage('瓶子已经漂向远方');await load()}catch(error){setMessage(error instanceof Error?error.message:'发送失败')}finally{setBusy(false)}}
  return <Sheet open={open} title="漂流瓶" onClose={onClose}><div className="m2-drift"><div className="m2-drift-visual"><Scenic file="meet.png"/><Waves size={36}/><span>{wallet?`${wallet.points} 贝壳 · ${wallet.bottleCredits} 次捡瓶机会`:''}</span></div>{picked&&<blockquote><small>{picked.author}</small><p>{picked.content}</p></blockquote>}<button className="m2-secondary" disabled={busy} onClick={()=>void pick()}><Waves size={18}/>捡一个</button><label><span>写给远方</span><textarea value={content} onChange={e=>setContent(e.target.value)} maxLength={500} placeholder="写下一段想被陌生人看见的话…"/></label><button className="m2-primary" disabled={busy||!content.trim()} onClick={()=>void send()}><Send size={18}/>让它漂走</button>{message&&<p className="m2-form-message success">{message}</p>}</div></Sheet>
}

function MeetTab({ onOpenChat }: {onOpenChat:(peer:RecommendationV2,conversationId:string)=>void}) {
  const [items,setItems]=useState<RecommendationV2[]>([])
  const [loading,setLoading]=useState(true)
  const [selected,setSelected]=useState<RecommendationV2|null>(null)
  const [drift,setDrift]=useState(false)
  const load=async()=>{setLoading(true);try{setItems(await fetchRecommendationsV2(12))}finally{setLoading(false)}}
  useEffect(()=>{void load()},[])
  const featured=items[0]
  return <section className="m2-page m2-meet-page"><MainHeader title="遇见" action={<IconButton onClick={()=>void load()} title="换一批"><RefreshCw size={19}/></IconButton>}/><div className="m2-page-scroll">
    {featured?<article className="m2-featured-match" onClick={()=>setSelected(featured)}><div className="m2-featured-image">{featured.avatar_url?<img src={featured.avatar_url} alt=""/>:<Scenic file="meet.png"/>}<div className="shade"/></div><div className="m2-featured-copy"><span className="m2-badge"><Sparkles size={15}/>匹配度 {featured.score}%</span><h2>{featured.nickname}{featured.age?` · ${featured.age}岁`:''}</h2><p>{featured.intro||'愿你我在彼此的生活里，看见新的光。'}</p><div className="m2-match-metrics"><span>心理 {featured.psych_score}%</span><span>作息 {featured.lifestyle_score}%</span><span>兴趣 {featured.interest_score}%</span></div><button>查看主页 <ChevronRight size={18}/></button></div></article>:loading?<LoadingCard text="正在寻找合适的人…"/>:<EmptyCard>岛上还很安静，新的真实用户出现后会在这里推荐。</EmptyCard>}
    <section className="m2-section"><header><div><small>DAILY</small><h2>今日推荐</h2></div><button onClick={()=>void load()}>换一换 <RefreshCw size={15}/></button></header><div className="m2-recommend-grid">{items.slice(1,5).map(p=><button className="m2-mini-person" key={p.id} onClick={()=>setSelected(p)}><div className="m2-mini-photo">{p.avatar_url?<img src={p.avatar_url} alt=""/>:<Scenic file="chat.png"/>}<span>{p.score}%</span></div><strong>{p.nickname}</strong><small>{p.age?`${p.age}岁 · `:''}{p.city}{p.profession?` · ${p.profession}`:''}</small></button>)}</div></section>
    <button className="m2-drift-card" onClick={()=>setDrift(true)}><Scenic file="relationship-map.png"/><div><small>漂流瓶</small><h2>总有一份温暖在路上</h2><span>捡一个 · 写瓶子</span></div><Waves/></button>
    <section className="m2-section m2-ice"><header><div><small>BREAK THE ICE</small><h2>破冰灵感</h2></div></header><div><button>最近一次让你开心的小事是什么？</button><button>如果周末完全属于你，你会怎么过？</button></div></section>
  </div><PersonSheet person={selected} open={Boolean(selected)} onClose={()=>setSelected(null)} onChat={onOpenChat}/><DriftSheet open={drift} onClose={()=>setDrift(false)}/></section>
}

function buildMonth(month:Date){const first=new Date(month.getFullYear(),month.getMonth(),1);const start=new Date(first);start.setDate(1-first.getDay());return Array.from({length:42},(_,i)=>{const d=new Date(start);d.setDate(start.getDate()+i);return d})}

function MoodCalendar({ rows, onSaved }: {rows:MoodRow[];onSaved:()=>void}) {
  const [month,setMonth]=useState(new Date())
  const [selected,setSelected]=useState(dateKey())
  const [mood,setMood]=useState<MoodKey>('breeze')
  const [note,setNote]=useState('')
  const [busy,setBusy]=useState(false)
  const map=useMemo(()=>new Map(rows.map(r=>[r.date,r])),[rows])
  const cells=useMemo(()=>buildMonth(month),[month])
  const save=async()=>{setBusy(true);try{await recordMood(mood,note);setSelected(dateKey());setNote('');onSaved()}finally{setBusy(false)}}
  const selectedRow=map.get(selected)
  return <section className="m2-calendar-card"><header><button onClick={()=>setMonth(new Date(month.getFullYear(),month.getMonth()-1,1))}><ChevronLeft/></button><h2>{month.getFullYear()}年{month.getMonth()+1}月</h2><button onClick={()=>setMonth(new Date(month.getFullYear(),month.getMonth()+1,1))}><ChevronRight/></button></header><div className="m2-week"><span>日</span><span>一</span><span>二</span><span>三</span><span>四</span><span>五</span><span>六</span></div><div className="m2-calendar-grid">{cells.map(d=>{const key=dateKey(d);const row=map.get(key);const outside=d.getMonth()!==month.getMonth();return <button key={key} className={`${selected===key?'selected':''} ${outside?'outside':''}`} onClick={()=>setSelected(key)}><span>{d.getDate()}</span>{row&&<i className={`mood-${row.mood}`}>{moodOptions.find(m=>m.key===row.mood)?.emoji}</i>}</button>})}</div><div className="m2-mood-detail">{selected===dateKey()?<><div className="m2-mood-pick">{moodOptions.map(m=><button key={m.key} className={mood===m.key?'active':''} onClick={()=>setMood(m.key)}><i>{m.emoji}</i><small>{m.label}</small></button>)}</div><textarea value={note} onChange={e=>setNote(e.target.value)} placeholder="今天想记住什么？" maxLength={240}/><button className="m2-primary small" onClick={()=>void save()} disabled={busy}>{busy?'记录中…':'记录今天'}</button></>:selectedRow?<div className="m2-past-mood"><i>{moodOptions.find(m=>m.key===selectedRow.mood)?.emoji}</i><div><strong>{moodOptions.find(m=>m.key===selectedRow.mood)?.label}</strong><p>{selectedRow.note||'这一天只留下了一个心情。'}</p></div></div>:<p className="muted">这一天还没有记录。</p>}</div></section>
}

function PrivateNoteSheet({ open,onClose,onCreated }: {open:boolean;onClose:()=>void;onCreated:()=>void}) {
  const [content,setContent]=useState('')
  const [files,setFiles]=useState<File[]>([])
  const [busy,setBusy]=useState(false)
  const submit=async()=>{if(!content.trim()&&!files.length)return;setBusy(true);try{await createPrivateNote(content||'一张只给自己看的照片。',files);setContent('');setFiles([]);onCreated();onClose()}finally{setBusy(false)}}
  return <Sheet open={open} title="写树洞" onClose={onClose}><div className="m2-composer"><textarea value={content} onChange={e=>setContent(e.target.value)} maxLength={2000} placeholder="只写给自己。无需修饰，也无需回应。"/><label className="m2-file-button"><ImageIcon size={18}/>添加图片<input type="file" accept="image/*" multiple onChange={e=>setFiles(Array.from(e.target.files||[]).slice(0,4))}/></label>{files.length>0&&<small>已选择 {files.length} 张图片</small>}<button className="m2-primary" disabled={busy||(!content.trim()&&!files.length)} onClick={()=>void submit()}>{busy?'保存中…':'收进树洞'}</button></div></Sheet>
}

function PostComposer({ open, channel, onClose, onCreated }: {open:boolean;channel:'world'|'growth';onClose:()=>void;onCreated:()=>void}) {
  const [mode,setMode]=useState<'text'|'image'|'video'|'review'>('text')
  const [title,setTitle]=useState('')
  const [content,setContent]=useState('')
  const [files,setFiles]=useState<File[]>([])
  const [reviewCategory,setReviewCategory]=useState<'book'|'movie'|'music'>('book')
  const [workTitle,setWorkTitle]=useState('')
  const [rating,setRating]=useState(5)
  const [busy,setBusy]=useState(false)
  const [message,setMessage]=useState('')
  const reset=()=>{setTitle('');setContent('');setFiles([]);setWorkTitle('');setRating(5);setMessage('')}
  const submit=async()=>{
    if(mode==='review'&&!workTitle.trim()){setMessage('请填写作品名称');return}
    if(!content.trim()&&mode!=='image'&&mode!=='video'){setMessage('写下一点内容再发布');return}
    if((mode==='image'||mode==='video')&&!files.length){setMessage('请选择要发布的媒体');return}
    setBusy(true);setMessage('')
    try{
      const urls:string[]=[]
      for(const file of files.slice(0,mode==='video'?1:6)){
        if(file.size>90*1024*1024) throw new Error('单个文件请控制在 90MB 以内')
        urls.push(await uploadPublicMedia(file,channel))
      }
      await createFeedPost({channel,kind:mode,visibility:'public',title,content:content||`${workTitle} · 我的点评`,mediaUrls:urls,coverUrl:mode==='review'?urls[0]:undefined,reviewCategory:mode==='review'?reviewCategory:undefined,workTitle:mode==='review'?workTitle:undefined,rating:mode==='review'?rating:undefined})
      reset();onCreated();onClose()
    }catch(error){setMessage(error instanceof Error?error.message:'发布失败')}
    finally{setBusy(false)}
  }
  return <Sheet open={open} title={channel==='world'?'发布动态':'发布成长内容'} onClose={onClose} wide><div className="m2-composer"><div className="m2-segment">{(['text','image','video','review'] as const).map(k=><button key={k} className={mode===k?'active':''} onClick={()=>{setMode(k);setFiles([])}}>{k==='text'?'图文':k==='image'?'图片':k==='video'?'视频':'点评'}</button>)}</div>{channel==='growth'&&mode!=='review'&&<input value={title} onChange={e=>setTitle(e.target.value)} maxLength={80} placeholder="标题（可选）"/>}{mode==='review'&&<><div className="m2-segment compact">{(['book','movie','music'] as const).map(k=><button key={k} className={reviewCategory===k?'active':''} onClick={()=>setReviewCategory(k)}>{k==='book'?'书籍':k==='movie'?'电影':'音乐'}</button>)}</div><input value={workTitle} onChange={e=>setWorkTitle(e.target.value)} maxLength={100} placeholder="作品名称"/><div className="m2-rating">{[1,2,3,4,5].map(n=><button key={n} onClick={()=>setRating(n)} className={n<=rating?'active':''}><Star size={21}/></button>)}</div></>}<textarea value={content} onChange={e=>setContent(e.target.value)} maxLength={8000} placeholder={mode==='review'?'只写你的点评与推荐，不上传或复制原著内容。':'分享此刻的想法…'}/>{(mode==='image'||mode==='video')&&<label className="m2-file-button">{mode==='video'?<Video size={18}/>:<ImageIcon size={18}/>}选择{mode==='video'?'视频':'图片'}<input type="file" accept={mode==='video'?'video/mp4,video/webm,video/quicktime':'image/*'} multiple={mode!=='video'} onChange={e=>setFiles(Array.from(e.target.files||[]))}/></label>}{files.length>0&&<small>已选择 {files.length} 个文件</small>}<button className="m2-primary" disabled={busy} onClick={()=>void submit()}>{busy?'发布中…':'发布'}</button>{message&&<p className="m2-form-message">{message}</p>}</div></Sheet>
}

function FeedCard({ post,onRefresh }: {post:FeedPost;onRefresh:()=>void}) {
  const [comment,setComment]=useState('')
  const [busy,setBusy]=useState(false)
  const like=async()=>{setBusy(true);try{await togglePostLike(post.id,post.liked);onRefresh()}finally{setBusy(false)}}
  const send=async()=>{if(!comment.trim())return;setBusy(true);try{await addPostComment(post.id,comment);setComment('');onRefresh()}finally{setBusy(false)}}
  return <article className="m2-feed-card"><header><Avatar profile={{nickname:post.author,avatar_url:post.avatarUrl}} size="sm"/><div><strong>{post.author}</strong><small>{formatDateTime(post.createdAt)}{post.city?` · ${post.city}`:''}</small></div></header>{post.title&&<h3>{post.title}</h3>}{post.kind==='review'&&<div className="m2-review-head"><span>{post.reviewCategory==='book'?'书籍':post.reviewCategory==='movie'?'电影':'音乐'}点评</span><strong>{post.workTitle}</strong><div>{Array.from({length:5},(_,i)=><Star key={i} size={15} className={i<(post.rating||0)?'filled':''}/>)}</div></div>}<p className="m2-feed-content">{post.content}</p>{post.mediaUrls.length>0&&(post.kind==='video'?<video controls preload="metadata" src={post.mediaUrls[0]}/>:<div className={`m2-media-grid count-${Math.min(post.mediaUrls.length,4)}`}>{post.mediaUrls.slice(0,6).map(url=><img key={url} src={url} alt="" loading="lazy"/>)}</div>)}<div className="m2-feed-actions"><button className={post.liked?'active':''} disabled={busy} onClick={()=>void like()}><Heart size={18}/><span>{post.likeCount||''}</span></button><button><MessageCircle size={18}/><span>{post.commentCount||''}</span></button><span className="spacer"/><small>{formatDay(post.createdAt)}</small></div>{post.comments.length>0&&<div className="m2-comments">{post.comments.map(c=><div key={c.id}><Avatar profile={{nickname:c.author,avatar_url:c.avatarUrl}} size="sm"/><p><strong>{c.author}</strong>{c.content}<small>{formatDateTime(c.createdAt)}</small></p></div>)}</div>}<div className="m2-comment-box"><input value={comment} onChange={e=>setComment(e.target.value)} maxLength={500} placeholder="写下回应…"/><button disabled={busy||!comment.trim()} onClick={()=>void send()}><Send size={17}/></button></div></article>
}

function RecordTab() {
  const [moods,setMoods]=useState<MoodRow[]>([])
  const [notes,setNotes]=useState<PrivateNote[]>([])
  const [world,setWorld]=useState<FeedPost[]>([])
  const [noteComposer,setNoteComposer]=useState(false)
  const [postComposer,setPostComposer]=useState(false)
  const [loading,setLoading]=useState(true)
  const load=async()=>{setLoading(true);try{const [m,n,w]=await Promise.all([fetchMoodHistory(400),fetchPrivateNotes(),fetchFeed('world',30)]);setMoods(m);setNotes(n);setWorld(w)}finally{setLoading(false)}}
  useEffect(()=>{void load()},[])
  return <section className="m2-page"><MainHeader title="记录" action={<div className="m2-header-actions"><IconButton onClick={()=>setNoteComposer(true)} title="写树洞"><LockKeyhole size={18}/></IconButton><IconButton onClick={()=>setPostComposer(true)} title="发动态"><Plus size={20}/></IconButton></div>}/><div className="m2-page-scroll"><div className="m2-record-intro"><Scenic file="treehole.png"/><div><small>慢慢记录</small><p>把心情留在日历，把不想解释的话留给自己，也把愿意分享的瞬间送到世界。</p></div></div>{loading&&<LoadingCard/>}<MoodCalendar rows={moods} onSaved={()=>void load()}/><section className="m2-section"><header><div><small>PRIVATE</small><h2>树洞</h2></div><button onClick={()=>setNoteComposer(true)}>写树洞 <ChevronRight size={15}/></button></header>{notes.length?<div className="m2-private-notes">{notes.slice(0,3).map(n=><article key={n.id}><small>{formatDateTime(n.createdAt)}</small><p>{n.content}</p>{n.imageUrls[0]&&<img src={n.imageUrls[0]} alt=""/>}</article>)}</div>:<EmptyCard>这里还没有记录。只有你能看到自己的树洞。</EmptyCard>}</section><section className="m2-section"><header><div><small>WORLD</small><h2>世界</h2></div><button onClick={()=>setPostComposer(true)}>发布 <Plus size={15}/></button></header><div className="m2-feed-list">{world.map(p=><FeedCard key={p.id} post={p} onRefresh={()=>void load()}/>)}</div>{!world.length&&!loading&&<EmptyCard>还没有新的公开动态。</EmptyCard>}</section></div><PrivateNoteSheet open={noteComposer} onClose={()=>setNoteComposer(false)} onCreated={()=>void load()}/><PostComposer open={postComposer} channel="world" onClose={()=>setPostComposer(false)} onCreated={()=>void load()}/></section>
}

function ChatPage({ conversation, onBack }: {conversation:ConversationItem;onBack:()=>void}) {
  const [messages,setMessages]=useState<ChatMessage[]>([])
  const [text,setText]=useState('')
  const [busy,setBusy]=useState(false)
  const endRef=useRef<HTMLDivElement|null>(null)
  const load=async()=>{const list=await fetchMessages(conversation.id);setMessages(list);await markConversationRead(conversation.id);setTimeout(()=>endRef.current?.scrollIntoView({behavior:'smooth'}),50)}
  useEffect(()=>{void load();const stop=subscribeConversation(conversation.id,(m)=>{setMessages(v=>v.some(x=>x.id===m.id)?v:[...v,m]);void markConversationRead(conversation.id);setTimeout(()=>endRef.current?.scrollIntoView({behavior:'smooth'}),30)});return stop},[conversation.id])
  const send=async()=>{if(!text.trim())return;setBusy(true);try{await sendMessage(conversation.id,text);setText('')}finally{setBusy(false)}}
  const myId=cleanSupabase.auth.getUser
  return <section className="m2-chat-page"><header><IconButton onClick={onBack}><ChevronLeft/></IconButton><Avatar profile={conversation.peer} size="sm"/><div><strong>{conversation.peer.nickname}</strong><small>{conversation.peer.city}</small></div></header><div className="m2-chat-scroll">{messages.map(m=><MessageBubble key={m.id} message={m}/>) }<div ref={endRef}/></div><footer><input value={text} onChange={e=>setText(e.target.value)} onKeyDown={e=>{if(e.key==='Enter'&&!e.shiftKey){e.preventDefault();void send()}}} placeholder="发一条消息…"/><button disabled={busy||!text.trim()} onClick={()=>void send()}><Send size={19}/></button></footer></section>
}

function MessageBubble({ message }: {message:ChatMessage}) {
  const [mine,setMine]=useState(false)
  useEffect(()=>{void cleanSupabase.auth.getUser().then(({data})=>setMine(data.user?.id===message.senderId))},[message.senderId])
  return <div className={`m2-bubble-row ${mine?'mine':''}`}><div className="m2-bubble"><p>{message.content}</p><small>{formatDateTime(message.createdAt)}</small></div></div>
}

function MessagesTab({ openConversation }: {openConversation:(c:ConversationItem)=>void}) {
  const [conversations,setConversations]=useState<ConversationItem[]>([])
  const [notifications,setNotifications]=useState<AppNotification[]>([])
  const [loading,setLoading]=useState(true)
  const load=async()=>{setLoading(true);try{const [c,n]=await Promise.all([fetchConversationList(),fetchNotifications()]);setConversations(c);setNotifications(n)}finally{setLoading(false)}}
  useEffect(()=>{void load();const channel=cleanSupabase.channel(`mirror-message-tab-${crypto.randomUUID()}`).on('postgres_changes',{event:'INSERT',schema:'public',table:'mirror_notifications'},()=>void load()).subscribe();return()=>{void cleanSupabase.removeChannel(channel)}},[])
  const unreadMessages=conversations.reduce((a,b)=>a+b.unread,0)
  const unreadNotice=notifications.filter(n=>!n.read&&n.type!=='message').length
  return <section className="m2-page"><MainHeader title="消息" action={<IconButton onClick={()=>void markAllNotificationsRead().then(load)} title="全部已读"><Check size={19}/></IconButton>}/><div className="m2-page-scroll"><div className="m2-message-stats"><div><MessageCircle/><b>{unreadMessages}</b><span>未读</span></div><div><Bell/><b>{unreadNotice}</b><span>互动</span></div><div><Users/><b>{conversations.length}</b><span>好友会话</span></div></div><section className="m2-section"><header><div><small>FRIENDS</small><h2>好友列表</h2></div><Search size={18}/></header>{loading?<LoadingCard/>:<div className="m2-conversation-list">{conversations.map(c=><button key={c.id} onClick={()=>openConversation(c)}><Avatar profile={c.peer}/><div><strong>{c.peer.nickname}</strong><p>{c.lastMessage}</p></div><aside><small>{formatDay(c.lastMessageAt)}</small>{c.unread>0&&<i>{c.unread}</i>}</aside></button>)}</div>}{!loading&&!conversations.length&&<EmptyCard>遇见并连接好友后，会话会出现在这里。</EmptyCard>}</section><section className="m2-section"><header><div><small>ACTIVITY</small><h2>最新互动</h2></div></header><div className="m2-notification-list">{notifications.filter(n=>n.type!=='message').slice(0,12).map(n=><article key={n.id} className={n.read?'':'unread'}><div className="m2-avatar sm">{n.actorAvatar?<img src={n.actorAvatar} alt=""/>:<span>{n.actor.slice(0,1)}</span>}</div><p><strong>{n.actor}</strong>{n.type==='like'?'赞了你的内容':'评论了你的内容'}<span>{n.text}</span></p><small>{formatDateTime(n.createdAt)}</small></article>)}</div></section></div></section>
}

function GrowthTab() {
  const [posts,setPosts]=useState<FeedPost[]>([])
  const [filter,setFilter]=useState<'all'|'book'|'movie'|'music'|'video'>('all')
  const [composer,setComposer]=useState(false)
  const [loading,setLoading]=useState(true)
  const load=async()=>{setLoading(true);try{setPosts(await fetchFeed('growth',40))}finally{setLoading(false)}}
  useEffect(()=>{void load()},[])
  const high=useMemo(()=>[...posts].filter(p=>p.kind!=='video').sort((a,b)=>b.likeCount-a.likeCount).slice(0,3),[posts])
  const filtered=useMemo(()=>posts.filter(p=>filter==='all'?true:filter==='video'?p.kind==='video':p.reviewCategory===filter),[posts,filter])
  return <section className="m2-page"><MainHeader title="成长" action={<button className="m2-pill-button" onClick={()=>setComposer(true)}><PenLine size={16}/>发布</button>}/><div className="m2-page-scroll"><section className="m2-growth-hero"><Scenic file="growth.png"/><div><small>READ · THINK · SHARE</small><h2>在阅读与思考中，遇见更辽阔的世界。</h2></div></section>{loading&&<LoadingCard/>}{high.length>0&&<section className="m2-section"><header><div><small>POPULAR</small><h2>高赞推文</h2></div></header><div className="m2-high-grid">{high.map(p=><article key={p.id}><div>{p.mediaUrls[0]?<img src={p.mediaUrls[0]} alt=""/>:<Scenic file="growth.png"/>}</div><strong>{p.title||p.content.slice(0,26)}</strong><p>{p.content.slice(0,58)}</p><small><Heart size={13}/>{p.likeCount} · {formatDay(p.createdAt)}</small></article>)}</div></section>}<section className="m2-section"><header><div><small>REVIEWS & VIDEO</small><h2>点评与学习</h2></div></header><div className="m2-filter-tabs">{([['all','全部'],['book','书籍'],['movie','电影'],['music','音乐'],['video','视频']] as const).map(([k,l])=><button key={k} className={filter===k?'active':''} onClick={()=>setFilter(k)}>{l}</button>)}</div><div className="m2-feed-list">{filtered.map(p=><FeedCard key={p.id} post={p} onRefresh={()=>void load()}/>)}</div>{!filtered.length&&!loading&&<EmptyCard>这里还没有内容。你可以成为第一位分享者。</EmptyCard>}</section></div><PostComposer open={composer} channel="growth" onClose={()=>setComposer(false)} onCreated={()=>void load()}/></section>
}

function AssessmentRunner({ definition, open, onClose, onSaved }: {definition:AssessmentDefinition|null;open:boolean;onClose:()=>void;onSaved:()=>void}) {
  const [index,setIndex]=useState(0)
  const [responses,setResponses]=useState<Record<string,number>>({})
  const [result,setResult]=useState<Record<string,unknown>|null>(null)
  const [busy,setBusy]=useState(false)
  useEffect(()=>{if(open){setIndex(0);setResponses({});setResult(null)}},[open,definition?.id])
  if(!definition)return null
  const item=definition.items[index]
  const selected=responses[item.id]
  const finish=async()=>{if(selected===undefined)return;if(index<definition.items.length-1){setIndex(v=>v+1);return}setBusy(true);try{const scores=scoreAssessment(definition,responses);await saveAssessmentRun(definition.id,scores,responses);if(definition.id==='ipip20')await applyIpipScores(scores as Record<string,number>);setResult(scores);onSaved()}finally{setBusy(false)}}
  return <Sheet open={open} title={definition.title} onClose={onClose}><div className="m2-assessment-runner">{result?<AssessmentResult definition={definition} result={result} responses={responses}/>:<><div className="m2-assessment-meta"><small>{definition.period||definition.subtitle}</small><span>{index+1}/{definition.items.length}</span></div><div className="m2-progress"><span style={{width:`${((index+1)/definition.items.length)*100}%`}}/></div><h3>{item.prompt}</h3><div className="m2-answer-list">{definition.choices.map(choice=><button key={choice.value} className={selected===choice.value?'active':''} onClick={()=>setResponses(r=>({...r,[item.id]:choice.value}))}>{choice.label}</button>)}</div><button className="m2-primary" disabled={selected===undefined||busy} onClick={()=>void finish()}>{busy?'保存中…':index===definition.items.length-1?'查看结果':'下一题'}</button></>}</div></Sheet>
}

function AssessmentResult({ definition,result,responses }: {definition:AssessmentDefinition;result:Record<string,unknown>;responses:Record<string,number>}) {
  if(definition.id==='ipip20') return <div className="m2-result"><Sparkles size={28}/><h3>你的大五人格画像</h3>{Object.entries(result).map(([k,v])=><div className="m2-result-bar" key={k}><span>{{extraversion:'外向性',agreeableness:'宜人性',conscientiousness:'尽责性',emotionalStability:'情绪稳定',openness:'开放性'}[k as keyof typeof result]||k}</span><i><b style={{width:`${Number(v)}%`}}/></i><strong>{String(v)}</strong></div>)}</div>
  const total=Number(result.total||0)
  const band=String(result.band||'')
  const selfHarm=definition.id==='phq9'&&(responses.p9||0)>0
  return <div className="m2-result"><Sparkles size={28}/><h3>{definition.title} · {total} 分</h3><p className="m2-result-band">当前区间：{band}</p><p className="muted">这是筛查结果，不等同于医学诊断。</p>{selfHarm&&<div className="m2-safety-card"><strong>请优先照顾当下的安全</strong><p>如果你此刻有伤害自己的冲动或已处于危险中，请立即联系当地急救服务，或请可信任的人陪在你身边并寻求专业帮助。</p></div>}</div>
}

function MineTab({ profile,onProfileChange,onLogout }: {profile:MirrorV2Profile;onProfileChange:(p:MirrorV2Profile)=>void;onLogout:()=>void}) {
  const [match,setMatch]=useState<MatchProfile|null>(null)
  const [assessment,setAssessment]=useState<AssessmentDefinition|null>(null)
  const [story,setStory]=useState(false)
  const [runs,setRuns]=useState<any[]>([])
  const [profileEditor,setProfileEditor]=useState(false)
  const [busy,setBusy]=useState(false)
  const [message,setMessage]=useState('')
  const load=async()=>{const [m,r]=await Promise.all([fetchMatchProfile(),fetchAssessmentRuns()]);setMatch(m);setRuns(r)}
  useEffect(()=>{void load()},[])
  const setMbti=(key:keyof MatchProfile['mbti'],value:number)=>setMatch(m=>m?({...m,mbti:{...m.mbti,[key]:value}}):m)
  const saveMatch=async()=>{if(!match)return;setBusy(true);setMessage('');try{await saveMatchProfile(match);setMessage('已保存')}catch(error){setMessage(error instanceof Error?error.message:'保存失败')}finally{setBusy(false)}}
  const uploadAvatar=async(file?:File)=>{if(!file)return;setBusy(true);try{const url=await uploadPublicMedia(file,'avatar');onProfileChange(await updateV2Profile({avatar_url:url}))}finally{setBusy(false)}}
  const setTheme=async(theme:ThemeKey)=>{onProfileChange(await updateV2Profile({theme}))}
  if(!match)return <section className="m2-page"><MainHeader title="我的"/><div className="m2-page-scroll"><LoadingCard/></div></section>
  return <section className="m2-page"><MainHeader title="我的" action={<IconButton onClick={()=>setProfileEditor(true)}><PenLine size={18}/></IconButton>}/><div className="m2-page-scroll"><section className="m2-profile-card"><div className="m2-profile-avatar"><Avatar profile={profile} size="xl"/><label><Camera size={16}/><input type="file" accept="image/*" onChange={e=>void uploadAvatar(e.target.files?.[0])}/></label></div><div><h2>{profile.nickname}</h2><p>{[profile.age?`${profile.age}岁`:'',profile.city,profile.profession].filter(Boolean).join(' · ')||'完善资料，让合适的人更容易遇见你'}</p><span>{profile.goal}</span></div></section><section className="m2-section m2-mbti"><header><div><small>FOR MATCHING</small><h2>MBTI 偏好</h2></div><button onClick={()=>void saveMatch()}><Save size={15}/>保存</button></header>{([['e','E 外向','I 内向'],['s','S 感觉','N 直觉'],['t','T 思考','F 情感'],['j','J 判断','P 知觉']] as const).map(([key,left,right])=><div className="m2-slider-row" key={key}><span>{left}</span><input type="range" min="0" max="100" value={match.mbti[key]} onChange={e=>setMbti(key,Number(e.target.value))}/><span>{right}</span><b>{match.mbti[key]}%</b></div>)}</section><section className="m2-preference-grid"><PreferenceEditor title="我的作息" icon={<Wind size={18}/>}><select value={match.routine.chronotype||''} onChange={e=>setMatch({...match,routine:{...match.routine,chronotype:e.target.value}})}><option value="">选择作息类型</option><option>早睡早起</option><option>规律作息</option><option>夜猫子</option><option>弹性作息</option></select><div className="m2-time-row"><input type="time" value={match.routine.sleep||''} onChange={e=>setMatch({...match,routine:{...match.routine,sleep:e.target.value}})}/><span>—</span><input type="time" value={match.routine.wake||''} onChange={e=>setMatch({...match,routine:{...match.routine,wake:e.target.value}})}/></div></PreferenceEditor><PreferenceEditor title="我的饮食" icon={<Leaf size={18}/>}><ChipPicker options={dietOptions} values={match.diet} onChange={diet=>setMatch({...match,diet})}/></PreferenceEditor><PreferenceEditor title="我的爱好" icon={<Sparkles size={18}/>}><ChipPicker options={hobbyOptions} values={match.hobbies} onChange={hobbies=>setMatch({...match,hobbies})}/></PreferenceEditor><PreferenceEditor title="想遇见的人" icon={<Heart size={18}/>}><ChipPicker options={['稳定温柔','有表达欲','尊重边界','喜欢成长','作息接近','兴趣共鸣']} values={(match.preferences.tags as string[])||[]} onChange={tags=>setMatch({...match,preferences:{...match.preferences,tags}})}/></PreferenceEditor></section><button className="m2-primary small" disabled={busy} onClick={()=>void saveMatch()}>{busy?'保存中…':'保存匹配偏好'}</button>{message&&<p className="m2-form-message success">{message}</p>}<section className="m2-section"><header><div><small>THEME</small><h2>主题切换</h2></div></header><div className="m2-theme-grid">{themeOptions.map(t=><button key={t.key} className={profile.theme===t.key?'active':''} onClick={()=>void setTheme(t.key)}><Scenic file={t.image}/><span>{t.label}</span>{profile.theme===t.key&&<Check/>}</button>)}</div></section><section className="m2-section"><header><div><small>ASSESSMENT</small><h2>心理测评</h2></div></header><div className="m2-assessment-cards"><button onClick={()=>setStory(true)}><div><Leaf/></div><strong>初见心谱</strong><small>场景化人格探索</small></button><button onClick={()=>setAssessment(assessments.ipip20)}><div><Sparkles/></div><strong>大五人格</strong><small>IPIP · 20项</small></button><button onClick={()=>setAssessment(assessments.phq9)}><div><Wind/></div><strong>PHQ-9</strong><small>抑郁症状筛查</small></button><button onClick={()=>setAssessment(assessments.gad7)}><div><Waves/></div><strong>GAD-7</strong><small>焦虑症状筛查</small></button></div>{runs.length>0&&<div className="m2-run-history"><strong>最近测评</strong>{runs.slice(0,4).map(r=><span key={r.id}>{r.instrument}<small>{formatDay(r.completed_at)}</small></span>)}</div>}</section><button className="m2-logout" onClick={onLogout}><LogOut size={17}/>退出登录</button></div><ProfileEditSheet open={profileEditor} profile={profile} onClose={()=>setProfileEditor(false)} onSaved={p=>{onProfileChange(p);setProfileEditor(false)}}/><AssessmentRunner definition={assessment} open={Boolean(assessment)} onClose={()=>setAssessment(null)} onSaved={()=>void load()}/>{story&&<div className="m2-fullscreen-modal"><StoryAssessment allowExit onExit={()=>setStory(false)} onDone={()=>{setStory(false);void load()}}/></div>}</section>
}

function PreferenceEditor({title,icon,children}:{title:string;icon:ReactNode;children:ReactNode}){return <section className="m2-pref-card"><header>{icon}<strong>{title}</strong></header>{children}</section>}
function ChipPicker({options,values,onChange}:{options:string[];values:string[];onChange:(v:string[])=>void}){return <div className="m2-chip-picker">{options.map(x=><button key={x} className={values.includes(x)?'active':''} onClick={()=>onChange(values.includes(x)?values.filter(v=>v!==x):[...values,x])}>{x}</button>)}</div>}

function ProfileEditSheet({open,profile,onClose,onSaved}:{open:boolean;profile:MirrorV2Profile;onClose:()=>void;onSaved:(p:MirrorV2Profile)=>void}){
  const [nickname,setNickname]=useState(profile.nickname);const[city,setCity]=useState(profile.city);const[profession,setProfession]=useState(profile.profession);const[intro,setIntro]=useState(profile.intro);const[goal,setGoal]=useState(profile.goal);const[busy,setBusy]=useState(false)
  useEffect(()=>{if(open){setNickname(profile.nickname);setCity(profile.city);setProfession(profile.profession);setIntro(profile.intro);setGoal(profile.goal)}},[open,profile])
  const save=async()=>{setBusy(true);try{onSaved(await updateV2Profile({nickname:nickname.trim(),city:city.trim(),profession:profession.trim(),intro:intro.trim(),goal}))}finally{setBusy(false)}}
  return <Sheet open={open} title="编辑资料" onClose={onClose}><div className="m2-composer"><label><span>昵称</span><input value={nickname} onChange={e=>setNickname(e.target.value)}/></label><label><span>城市</span><input value={city} onChange={e=>setCity(e.target.value)}/></label><label><span>职业 / 身份</span><input value={profession} onChange={e=>setProfession(e.target.value)}/></label><label><span>希望遇见</span><select value={goal} onChange={e=>setGoal(e.target.value)}><option>深度朋友</option><option>兴趣同伴</option><option>共同成长</option><option>长期关系</option></select></label><label><span>一句话介绍</span><textarea value={intro} onChange={e=>setIntro(e.target.value)} maxLength={240}/></label><button className="m2-primary" disabled={busy} onClick={()=>void save()}>{busy?'保存中…':'保存'}</button></div></Sheet>
}

function AppShell({ profile:initialProfile,onLogout }: {profile:MirrorV2Profile;onLogout:()=>void}) {
  const [profile,setProfile]=useState(initialProfile)
  const [tab,setTab]=useState<MainTab>('meet')
  const [conversation,setConversation]=useState<ConversationItem|null>(null)
  const [unread,setUnread]=useState(0)
  useEffect(()=>{document.documentElement.dataset.mirrorTheme=profile.theme},[profile.theme])
  useEffect(()=>{const load=async()=>{try{const list=await fetchConversationList();setUnread(list.reduce((a,b)=>a+b.unread,0))}catch{/* ignore */}};void load();const channel=cleanSupabase.channel(`mirror-shell-${crypto.randomUUID()}`).on('postgres_changes',{event:'INSERT',schema:'public',table:'mirror_messages'},()=>void load()).subscribe();return()=>{void cleanSupabase.removeChannel(channel)}},[])
  const openChatByRecommendation=async(peer:RecommendationV2,conversationId:string)=>{const c:ConversationItem={id:conversationId,peer,lastMessage:'',lastMessageAt:new Date().toISOString(),unread:0};setConversation(c)}
  if(conversation)return <ChatPage conversation={conversation} onBack={()=>{setConversation(null);setTab('messages')}}/>
  return <main className="m2-app"><div className="m2-app-backdrop"/><div className="m2-app-content">{tab==='meet'&&<MeetTab onOpenChat={openChatByRecommendation}/>} {tab==='record'&&<RecordTab/>} {tab==='messages'&&<MessagesTab openConversation={setConversation}/>} {tab==='growth'&&<GrowthTab/>} {tab==='mine'&&<MineTab profile={profile} onProfileChange={setProfile} onLogout={onLogout}/>}</div><BottomNav tab={tab} onChange={setTab} unread={unread}/></main>
}

export default function MirrorV2Experience() {
  const [checking,setChecking]=useState(true)
  const [profile,setProfile]=useState<MirrorV2Profile|null>(null)
  useEffect(()=>{let active=true;void restoreV2Account().then(account=>{if(active)setProfile(account?.profile||null)}).catch(()=>{if(active)setProfile(null)}).finally(()=>{if(active)setChecking(false)});const {data}=cleanSupabase.auth.onAuthStateChange((event)=>{if(event==='SIGNED_OUT')setProfile(null)});return()=>{active=false;data.subscription.unsubscribe()}},[])
  if(checking)return <main className="m2-splash"><Leaf/><h1>镜屿</h1></main>
  if(!profile)return <AuthScreen onReady={setProfile}/>
  if(!profile.age_confirmed||!profile.profile_complete)return <Onboarding profile={profile} onDone={setProfile}/>
  return <AppShell profile={profile} onLogout={()=>void logoutV2().then(()=>setProfile(null))}/>
}
