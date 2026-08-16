import { useEffect, useMemo, useState } from 'react'
import {
  ArrowLeft, CalendarDays, ChevronLeft, ChevronRight, Compass, Heart, HeartPulse, Leaf, LockKeyhole,
  LogOut, MessageCircle, MessageCircleHeart, RefreshCw, Send, Sparkles, UserRound, Users, Waves, Wind,
} from 'lucide-react'
import AssessmentSceneArt, { type SceneKind } from './AssessmentSceneArt'
import {
  addFriend, createTreePost, fetchBottleReplies, fetchDriftInbox, fetchFriends, fetchLatestWellbeing,
  fetchMessages, fetchMoodHistory, fetchRecommendations, fetchTreePosts, fetchWallet, loginAccount, logoutAccount,
  pickBottle, recordMood, redeemBottleCredit, registerAccount, replyBottle, restoreAccount, saveAssessment,
  saveWellbeing, sendMessage, startConversation, throwBottle, updateProfile,
  type ChatMessage, type CleanProfile, type DriftBottle, type DriftReply, type MoodKey, type MoodRow,
  type Recommendation, type SixTraits, type TreePost, type Visibility, type Wallet,
} from './cleanApi'
import './clean.css'

type MainTab = 'meet' | 'seen' | 'messages' | 'mine'
type MeetPage = 'home' | 'match' | 'mood' | 'wellbeing' | 'drift' | 'inbox' | 'assessment'
type SeenPage = 'home' | Visibility

const moodMeta: Record<MoodKey, { label: string; symbol: string }> = {
  sunny: { label: '晴朗', symbol: '☀' }, breeze: { label: '微风', symbol: '≈' }, cloudy: { label: '多云', symbol: '☁' }, rain: { label: '小雨', symbol: '⌁' }, wave: { label: '浪涌', symbol: '∿' },
}
const moodOrder: MoodKey[] = ['sunny', 'breeze', 'cloudy', 'rain', 'wave']

const assessmentQuestions: Array<{ id: string; prompt: string; scene: SceneKind; factor: 'E'|'A'|'C'|'S'|'O'; labels: [string,string,string,string] }> = [
  { id:'forest-lodge', prompt:'你走进林间旅舍，屋里都是陌生人。你更自然会？', scene:'lodge', factor:'E', labels:['靠窗坐','先观察','加入聊天','主动认识'] },
  { id:'campfire-silence', prompt:'篝火忽然安静下来，你通常会？', scene:'campfire', factor:'E', labels:['享受安静','等人开口','接住话题','主动开场'] },
  { id:'companion-low', prompt:'同行的人突然有些低落，你会先？', scene:'comfort', factor:'A', labels:['留点空间','问一句','陪一会儿','认真听'] },
  { id:'stranger-help', prompt:'路边有人把东西散了一地，你更可能？', scene:'help', factor:'A', labels:['提醒一下','帮捡几个','一起收好','再陪一程'] },
  { id:'morning-pack', prompt:'明早要进山，睡前的你更像哪一幕？', scene:'packing', factor:'C', labels:['随手带','大致准备','列好清单','提前收好'] },
  { id:'leave-camp', prompt:'准备离开营地时，你会怎样收尾？', scene:'tidy', factor:'C', labels:['晚点再说','收自己的','分类整理','再检查遍'] },
  { id:'sudden-rain', prompt:'山路突然下起大雨，你的第一反应更像？', scene:'rain', factor:'S', labels:['有点慌','先躲雨','确认方向','稳稳处理'] },
  { id:'waiting-note', prompt:'重要的纸条一直没有回音，你会？', scene:'waiting', factor:'S', labels:['反复确认','想很多','先做别的','安心等'] },
  { id:'unknown-path', prompt:'森林出现一条从没走过的小路，你更想？', scene:'path', factor:'O', labels:['走熟悉路','看看路牌','试走一段','走向未知'] },
  { id:'old-map', prompt:'你捡到一张画满奇怪符号的旧地图，会？', scene:'map', factor:'O', labels:['找明确指示','猜一猜','联想故事','探索规律'] },
]

function localDateKey(date = new Date()) {
  return `${date.getFullYear()}-${String(date.getMonth()+1).padStart(2,'0')}-${String(date.getDate()).padStart(2,'0')}`
}
function parseDate(key: string) { const [y,m,d] = key.split('-').map(Number); return new Date(y, m-1, d) }
function formatDateTime(value: string) { const d = new Date(value); return Number.isNaN(d.getTime()) ? '' : new Intl.DateTimeFormat('zh-CN',{month:'numeric',day:'numeric',hour:'2-digit',minute:'2-digit',hour12:false}).format(d) }
function clamp(n: number) { return Math.max(0, Math.min(100, Math.round(n))) }

function computeAssessment(responses: Record<string, number>) {
  const factors: Record<'E'|'A'|'C'|'S'|'O', number[]> = { E:[], A:[], C:[], S:[], O:[] }
  assessmentQuestions.forEach((q) => { const value = responses[q.id]; if (value) factors[q.factor].push(value) })
  const avg = (key: keyof typeof factors) => factors[key].length ? factors[key].reduce((a,b)=>a+b,0)/factors[key].length : 2.5
  const score = (key: keyof typeof factors) => clamp(((avg(key)-1)/3)*100)
  const E=score('E'), A=score('A'), C=score('C'), S=score('S'), O=score('O')
  const bigFive = { extraversion:E, agreeableness:A, conscientiousness:C, emotionalStability:S, openness:O }
  const traits: SixTraits = {
    values: clamp(O*.55 + A*.45), lifestyle: clamp(C*.65 + S*.35), relationship: clamp(A*.55 + E*.45),
    communication: clamp(E*.55 + S*.45), growth: clamp(O*.7 + C*.3), boundary: clamp(S*.65 + C*.35),
  }
  return { bigFive, traits }
}

function NatureMark() { return <div className="nature-mark"><Leaf size={18}/><Wind size={16}/></div> }
function Empty({ children }: { children: React.ReactNode }) { return <div className="empty-state"><Leaf size={22}/><p>{children}</p></div> }
function BackBar({ title, onBack }: { title:string; onBack:()=>void }) { return <header className="subbar"><button onClick={onBack}><ChevronLeft size={22}/></button><strong>{title}</strong><span/></header> }

function AuthScreen({ onReady }: { onReady:(profile:CleanProfile)=>void }) {
  const [mode,setMode]=useState<'login'|'register'>('login')
  const [email,setEmail]=useState(''); const [password,setPassword]=useState(''); const [confirm,setConfirm]=useState(''); const [invite,setInvite]=useState('')
  const [busy,setBusy]=useState(false); const [message,setMessage]=useState('')
  const submit=async()=>{
    if(!/^\S+@\S+\.\S+$/.test(email)){setMessage('请输入有效邮箱');return}
    if(password.length<8){setMessage('密码至少 8 位');return}
    if(mode==='register'&&password!==confirm){setMessage('两次密码不一致');return}
    if(mode==='register'&&!invite.trim()){setMessage('请输入邀请码');return}
    setBusy(true); setMessage('')
    try{ const result=mode==='login'?await loginAccount(email,password):await registerAccount(email,password,invite); onReady(result.profile) }
    catch(e){ setMessage(e instanceof Error?e.message:'暂时无法进入') } finally{setBusy(false)}
  }
  return <main className="auth-screen">
    <section className="auth-visual"><div className="sun-disc"/><div className="hill hill-a"/><div className="hill hill-b"/><div className="tree-silhouette"/><NatureMark/><small>MIRROR ISLE</small><h1>镜屿</h1><p>寻找世界上另一个自己</p></section>
    <section className="auth-card">
      <div className="auth-switch"><button className={mode==='login'?'active':''} onClick={()=>{setMode('login');setMessage('')}}>登录</button><button className={mode==='register'?'active':''} onClick={()=>{setMode('register');setMessage('')}}>注册</button></div>
      <label>邮箱<input value={email} onChange={e=>setEmail(e.target.value)} inputMode="email" placeholder="name@example.com"/></label>
      {mode==='register'&&<label>邀请码<input value={invite} onChange={e=>setInvite(e.target.value)} placeholder="输入邀请码"/></label>}
      <label>密码<input type="password" value={password} onChange={e=>setPassword(e.target.value)} placeholder="至少 8 位"/></label>
      {mode==='register'&&<label>确认密码<input type="password" value={confirm} onChange={e=>setConfirm(e.target.value)} placeholder="再次输入密码"/></label>}
      <button className="primary" disabled={busy} onClick={()=>void submit()}>{busy?'正在进入…':mode==='login'?'进入镜屿':'创建账号'}</button>
      {message&&<p className="form-message">{message}</p>}
      <small className="auth-note">真实账号 · 云端同步 · 私密内容按账号隔离</small>
    </section>
  </main>
}

function ProfileGate({ profile, onSaved }: { profile:CleanProfile; onSaved:(p:CleanProfile)=>void }) {
  const [nickname,setNickname]=useState(profile.nickname); const [city,setCity]=useState(profile.city==='未设置'?'':profile.city); const [goal,setGoal]=useState(profile.goal||'深度朋友')
  const [adult,setAdult]=useState(profile.age_confirmed); const [busy,setBusy]=useState(false); const [message,setMessage]=useState('')
  const save=async()=>{ if(!nickname.trim()){setMessage('请填写昵称');return} if(!adult){setMessage('镜屿当前仅面向成年人');return} setBusy(true); try{onSaved(await updateProfile({nickname:nickname.trim(),city:city.trim()||'未设置',goal,age_confirmed:true}))}catch(e){setMessage(e instanceof Error?e.message:'保存失败')}finally{setBusy(false)} }
  return <main className="gate-screen"><section className="gate-card"><NatureMark/><small>WELCOME</small><h1>先让镜屿认识你</h1><p>只需要几个基础信息。心理作答不会公开给其他用户。</p><label>昵称<input value={nickname} onChange={e=>setNickname(e.target.value)} maxLength={18}/></label><label>所在城市<input value={city} onChange={e=>setCity(e.target.value)} placeholder="例如：北京"/></label><label>希望遇见<select value={goal} onChange={e=>setGoal(e.target.value)}><option>深度朋友</option><option>共同成长</option><option>兴趣同伴</option><option>长期关系</option></select></label><label className="check-row"><input type="checkbox" checked={adult} onChange={e=>setAdult(e.target.checked)}/><span>我已满 18 周岁</span></label><button className="primary" onClick={()=>void save()} disabled={busy}>{busy?'保存中…':'进入镜屿'}</button>{message&&<p className="form-message">{message}</p>}</section></main>
}

function AssessmentView({ onDone, onBack }: { onDone:()=>void; onBack:()=>void }) {
  const [index,setIndex]=useState(0); const [responses,setResponses]=useState<Record<string,number>>({}); const [busy,setBusy]=useState(false); const [message,setMessage]=useState('')
  const q=assessmentQuestions[index]; const selected=responses[q.id]
  const next=async()=>{ if(!selected)return; if(index<assessmentQuestions.length-1){setIndex(v=>v+1);return} setBusy(true); try{const result=computeAssessment(responses); await saveAssessment(result.bigFive,responses,result.traits); onDone()}catch(e){setMessage(e instanceof Error?e.message:'保存失败')}finally{setBusy(false)} }
  return <section className="assessment-screen"><header className="assessment-top"><button onClick={onBack}><ArrowLeft size={20}/></button><div><span style={{width:`${((index+1)/assessmentQuestions.length)*100}%`}}/></div><small>{index+1}/{assessmentQuestions.length}</small></header><div className="assessment-scroll"><small>心林漫游</small><h1>{q.prompt}</h1><div className="assessment-grid">{q.labels.map((label,i)=>{const value=i+1;return <button key={label} className={selected===value?'active':''} onClick={()=>setResponses(r=>({...r,[q.id]:value}))}><AssessmentSceneArt kind={q.scene} level={i as 0|1|2|3}/><strong>{label}</strong></button>})}</div>{message&&<p className="form-message">{message}</p>}</div><footer><button className="primary" disabled={!selected||busy} onClick={()=>void next()}>{busy?'保存中…':index===assessmentQuestions.length-1?'完成心谱':'下一题'}</button></footer></section>
}

function MatchView({ onBack, onOpenChat }: { onBack:()=>void; onOpenChat:(peer:Recommendation)=>void }) {
  const [items,setItems]=useState<Recommendation[]>([]); const [busy,setBusy]=useState(true); const [message,setMessage]=useState('')
  const load=async()=>{setBusy(true);try{setItems(await fetchRecommendations());setMessage('')}catch(e){setMessage(e instanceof Error?e.message:'加载失败')}finally{setBusy(false)}}
  useEffect(()=>{void load()},[])
  return <section className="page"><BackBar title="匹配遇见" onBack={onBack}/><div className="match-hero"><NatureMark/><small>TODAY</small><h1>今天，和谁更靠近？</h1><p>匹配只提供相似度线索，不替代真实交流。</p></div><div className="recommend-list">{items.map(p=><article key={p.id} className="person-card"><div className="avatar">{p.nickname.slice(0,1)}</div><div className="person-main"><header><div><h2>{p.nickname}</h2><span>{p.city} · {p.goal}</span></div><b>{p.score}%</b></header><p>{p.intro}</p><div className="chips">{p.anchors.slice(0,3).map(a=><span key={a}>{a}</span>)}</div><div className="match-reason"><span>{p.similar.join(' · ')}</span><small>{p.different[0]}</small></div><div className="row-actions"><button onClick={async()=>{try{await addFriend(p.id);onOpenChat(p)}catch(e){setMessage(e instanceof Error?e.message:'添加失败')}}}><Heart size={15}/>认识一下</button><button onClick={()=>onOpenChat(p)}><MessageCircle size={15}/>聊聊</button></div></div></article>)}</div>{busy&&<Empty>正在寻找真实岛民…</Empty>}{!busy&&!items.length&&<Empty>暂时没有新的真实用户。等岛上再热闹一点。</Empty>}{message&&<p className="form-message">{message}</p>}</section>
}

function buildMonthCells(month:Date){ const first=new Date(month.getFullYear(),month.getMonth(),1); const start=new Date(first); start.setDate(1-first.getDay()); return Array.from({length:42},(_,i)=>{const d=new Date(start);d.setDate(start.getDate()+i);return{date:d,key:localDateKey(d),current:d.getMonth()===month.getMonth()}}) }
function currentStreak(rows:MoodRow[]){const set=new Set(rows.map(r=>r.date));let d=new Date(),n=0;while(set.has(localDateKey(d))){n++;d.setDate(d.getDate()-1)}return n}

function MoodView({ onBack }: { onBack:()=>void }) {
  const [rows,setRows]=useState<MoodRow[]>([]); const [wallet,setWallet]=useState<Wallet>({points:0,bottleCredits:0}); const [month,setMonth]=useState(new Date(new Date().getFullYear(),new Date().getMonth(),1)); const [selectedDate,setSelectedDate]=useState(localDateKey()); const [mood,setMood]=useState<MoodKey>('breeze'); const [note,setNote]=useState(''); const [busy,setBusy]=useState(false); const [message,setMessage]=useState('')
  const today=localDateKey(); const load=async()=>{try{const [h,w]=await Promise.all([fetchMoodHistory(),fetchWallet()]);setRows(h);setWallet(w);const t=h.find(r=>r.date===today);if(t){setMood(t.mood);setNote(t.note)}}catch(e){setMessage(e instanceof Error?e.message:'同步失败')}}
  useEffect(()=>{void load()},[])
  const map=useMemo(()=>new Map(rows.map(r=>[r.date,r])),[rows]); const cells=useMemo(()=>buildMonthCells(month),[month]); const selected=map.get(selectedDate)
  const save=async()=>{setBusy(true);try{const r=await recordMood(mood,note);setWallet({points:r.points,bottleCredits:r.bottleCredits});setMessage(r.awarded?'+10 心贝':'已更新今天');await load()}catch(e){setMessage(e instanceof Error?e.message:'保存失败')}finally{setBusy(false)}}
  return <section className="page"><BackBar title="每日心情" onBack={onBack}/><div className="mood-hero"><NatureMark/><small>MOOD CALENDAR</small><h1>把每天的心绪，轻轻放回时间里</h1><span>{wallet.points} 心贝</span></div><section className="calendar-card"><header><button onClick={()=>setMonth(new Date(month.getFullYear(),month.getMonth()-1,1))}><ChevronLeft/></button><strong>{month.getFullYear()}年{month.getMonth()+1}月</strong><button onClick={()=>setMonth(new Date(month.getFullYear(),month.getMonth()+1,1))}><ChevronRight/></button></header><div className="week">{['日','一','二','三','四','五','六'].map(x=><span key={x}>{x}</span>)}</div><div className="calendar-grid">{cells.map(c=>{const row=map.get(c.key);return <button key={c.key} className={`${c.current?'':'outside'} ${selectedDate===c.key?'active':''}`} onClick={()=>setSelectedDate(c.key)}><b>{c.date.getDate()}</b>{row?<i>{moodMeta[row.mood].symbol}</i>:<i className="none">·</i>}</button>})}</div><div className="month-stats"><span><b>{rows.filter(r=>{const d=parseDate(r.date);return d.getFullYear()===month.getFullYear()&&d.getMonth()===month.getMonth()}).length}</b>本月</span><span><b>{currentStreak(rows)}</b>连续</span><span><b>{rows.length}</b>累计</span></div></section>{selectedDate===today?<section className="paper-card"><div className="card-title"><div><small>今天</small><h2>此刻像什么天气？</h2></div><Sparkles size={18}/></div><div className="mood-options">{moodOrder.map(k=><button key={k} className={mood===k?'active':''} onClick={()=>setMood(k)}><b>{moodMeta[k].symbol}</b><span>{moodMeta[k].label}</span></button>)}</div><textarea value={note} onChange={e=>setNote(e.target.value)} placeholder="想留一句话吗？（可不写）"/><button className="primary" disabled={busy} onClick={()=>void save()}>{busy?'保存中…':'记录今日心情'}</button></section>:<section className="paper-card day-detail"><CalendarDays/><div><small>{parseDate(selectedDate).getMonth()+1}月{parseDate(selectedDate).getDate()}日</small><h2>{selected?moodMeta[selected.mood].label:'没有记录'}</h2><p>{selected?.note||'留白也属于时间的一部分。'}</p></div><button onClick={()=>setSelectedDate(today)}>回到今天</button></section>}{message&&<p className="form-message">{message}</p>}</section>
}

function WellbeingView({ onBack }: { onBack:()=>void }) {
  const items=['心情轻松','平静放松','精力充足','醒来有恢复感','生活有兴趣']; const [answers,setAnswers]=useState([3,3,3,3,3]); const [score,setScore]=useState<number|null>(null); const [busy,setBusy]=useState(false); const [message,setMessage]=useState('')
  useEffect(()=>{void fetchLatestWellbeing().then((r:any)=>{if(Array.isArray(r?.responses)&&r.responses.length===5)setAnswers(r.responses.map(Number));if(typeof r?.percentage==='number')setScore(r.percentage)}).catch(()=>undefined)},[])
  const save=async()=>{setBusy(true);try{const r=await saveWellbeing(answers);setScore(r.percentage);setMessage('已同步')}catch(e){setMessage(e instanceof Error?e.message:'保存失败')}finally{setBusy(false)}}
  return <section className="page"><BackBar title="心理状态" onBack={onBack}/><div className="wellbeing-hero"><NatureMark/><small>CHECK IN</small><h1>只是观察，不给自己下结论</h1>{score!==null&&<b>{score}/100</b>}</div><section className="paper-card wellbeing-list">{items.map((item,i)=><div key={item}><strong>{item}</strong><div>{[0,1,2,3,4,5].map(v=><button key={v} className={answers[i]===v?'active':''} onClick={()=>setAnswers(a=>a.map((x,j)=>j===i?v:x))}>{v}</button>)}</div></div>)}<div className="scale-hint"><span>0 没有</span><span>5 一直</span></div><button className="primary" disabled={busy} onClick={()=>void save()}>{busy?'保存中…':'保存记录'}</button><small className="privacy-note">仅用于个人自我记录，不作为医疗诊断。</small></section>{message&&<p className="form-message">{message}</p>}</section>
}

function DriftView({ onBack }: { onBack:()=>void }) {
  const [wallet,setWallet]=useState<Wallet>({points:0,bottleCredits:0}); const [bottle,setBottle]=useState<DriftBottle|null>(null); const [replies,setReplies]=useState<DriftReply[]>([]); const [throwText,setThrowText]=useState(''); const [replyText,setReplyText]=useState(''); const [anonymous,setAnonymous]=useState(true); const [busy,setBusy]=useState(false); const [message,setMessage]=useState('')
  useEffect(()=>{void fetchWallet().then(setWallet).catch(()=>undefined)},[])
  const pick=async()=>{setBusy(true);setMessage('');try{let w=wallet;if(w.bottleCredits<1){if(w.points<10){setMessage('还需要 10 心贝');return}w=await redeemBottleCredit();setWallet(w)}const result=await pickBottle();setWallet(result.wallet);setBottle(result.bottle);setReplies(result.bottle?await fetchBottleReplies(result.bottle.id):[]);if(!result.bottle)setMessage('海面暂时没有新的瓶子')}catch(e){setMessage(e instanceof Error?e.message:'暂时没捡到')}finally{setBusy(false)}}
  return <section className="page"><BackBar title="漂流海" onBack={onBack}/><div className="sea-hero"><Waves size={42}/><div><small>DRIFT SEA</small><h1>捡一封远方的信</h1><p>{wallet.points} 心贝 · {wallet.bottleCredits} 次机会</p></div></div><button className="primary" disabled={busy} onClick={()=>void pick()}>{wallet.bottleCredits>0?'随机捡一封':'10 心贝 · 捡一封'}</button>{bottle&&<article className="letter-card"><header><strong>{bottle.author}</strong><span>{formatDateTime(bottle.createdAt)}</span></header><p>{bottle.content}</p>{replies.map(r=><div className="reply" key={r.id}><b>{r.author}</b><span>{r.content}</span></div>)}<div className="inline-input"><input value={replyText} onChange={e=>setReplyText(e.target.value)} placeholder="写一封回信"/><button onClick={async()=>{if(!replyText.trim())return;setBusy(true);try{await replyBottle(bottle.id,replyText,anonymous);setReplyText('');setReplies(await fetchBottleReplies(bottle.id))}finally{setBusy(false)}}><Send size={16}/></button></div></article>}<section className="paper-card"><div className="card-title"><div><small>投一个瓶子</small><h2>把一句话交给海面</h2></div><Wind size={18}/></div><textarea value={throwText} onChange={e=>setThrowText(e.target.value)} placeholder="写下想让远方看见的话"/><label className="check-row"><input type="checkbox" checked={anonymous} onChange={e=>setAnonymous(e.target.checked)}/><span>匿名投递</span></label><button className="secondary" disabled={busy||!throwText.trim()} onClick={async()=>{setBusy(true);try{await throwBottle(throwText,anonymous);setThrowText('');setMessage('已经漂向海面')}catch(e){setMessage(e instanceof Error?e.message:'投递失败')}finally{setBusy(false)}}>投向海面</button></section>{message&&<p className="form-message">{message}</p>}</section>
}

function InboxView({ onBack }: { onBack:()=>void }) {
  const [items,setItems]=useState<Array<{id:string;content:string;createdAt:string;replies:DriftReply[]}>>([]); const [busy,setBusy]=useState(true); const [message,setMessage]=useState('')
  const load=async()=>{setBusy(true);try{setItems(await fetchDriftInbox());setMessage('')}catch(e){setMessage(e instanceof Error?e.message:'加载失败')}finally{setBusy(false)}}; useEffect(()=>{void load()},[])
  return <section className="page"><BackBar title="远方来信" onBack={onBack}/><div className="inbox-hero"><NatureMark/><small>RESONANCE</small><h1>你投出的瓶子，有回音吗？</h1></div><div className="inbox-list">{items.map(item=><article key={item.id}><header><span>{formatDateTime(item.createdAt)}</span><b>{item.replies.length} 封回信</b></header><p>{item.content}</p>{item.replies.map(r=><div className="reply" key={r.id}><strong>{r.author}</strong><span>{r.content}</span><small>{formatDateTime(r.createdAt)}</small></div>)}</article>)}</div>{busy&&<Empty>正在找回音…</Empty>}{!busy&&!items.length&&<Empty>还没有回信。</Empty>}{message&&<p className="form-message">{message}</p>}</section>
}

function MeetHome({ profile, onOpen }: { profile:CleanProfile; onOpen:(p:MeetPage)=>void }) {
  const modules=[
    ['match','匹配遇见','看看今天与你靠近的人',Compass],['mood','每日心情','月历记录，跨设备同步',MessageCircleHeart],['wellbeing','心理状态','温和观察最近的自己',HeartPulse],['drift','漂流海','捡起一封真实陌生人的信',Waves],['inbox','远方来信','看看你的瓶子收到什么回音',MessageCircle],['assessment','心谱','重新认识自己，也优化匹配',Sparkles],
  ] as const
  return <section className="page meet-home"><div className="home-hero"><NatureMark/><small>HELLO · {profile.nickname}</small><h1>今天，想从哪里开始？</h1><p>每件事都有自己的房间。打开它，再专心待一会儿。</p></div><div className="module-grid">{modules.map(([key,title,desc,Icon])=><button key={key} onClick={()=>onOpen(key)}><Icon/><strong>{title}</strong><span>{desc}</span><i><ChevronRight size={16}/></i></button>)}</div><section className="quiet-card"><Leaf/><div><strong>镜屿不是效率工具</strong><p>不追求刷不完的信息流，只保留值得慢慢靠近的人与内容。</p></div></section></section>
}

function SeenView() {
  const [page,setPage]=useState<SeenPage>('home'); const [posts,setPosts]=useState<TreePost[]>([]); const [draft,setDraft]=useState(''); const [busy,setBusy]=useState(false); const [message,setMessage]=useState('')
  const load=async()=>{setBusy(true);try{setPosts(await fetchTreePosts());setMessage('')}catch(e){setMessage(e instanceof Error?e.message:'同步失败')}finally{setBusy(false)}}
  useEffect(()=>{if(page!=='home')void load()},[page])
  if(page==='home') return <section className="page seen-home"><div className="seen-title"><NatureMark/><small>SEE · MIRROR ISLE</small><h1>看见</h1><p>温柔连接，彼此看见</p></div><div className="seen-stack"><button className="seen-card tree" onClick={()=>setPage('private')}><div><LockKeyhole/><small>仅自己可见</small><h2>树洞</h2><p>私密记录，只给自己看</p></div><div className="scene tree-scene"/></button><button className="seen-card world" onClick={()=>setPage('public')}><div><Compass/><small>真实岛民</small><h2>世界</h2><p>看看世界正在发生的柔软瞬间</p></div><div className="scene world-scene"/></button><button className="seen-card friends" onClick={()=>setPage('friends')}><div><Users/><small>只在好友之间</small><h2>好友</h2><p>走近熟悉的人，读懂彼此</p></div><div className="scene friend-scene"/></button></div></section>
  const title=page==='private'?'树洞':page==='public'?'世界':'好友'; const visible=posts.filter(p=>page==='private'?p.mine&&p.visibility==='private':page==='public'?p.visibility==='public'&&p.status==='approved':p.visibility==='friends')
  const publish=async()=>{if(!draft.trim())return;setBusy(true);try{await createTreePost(draft,page);setDraft('');setMessage(page==='private'?'已保存，只对你可见':'已发布');await load()}catch(e){setMessage(e instanceof Error?e.message:'保存失败')}finally{setBusy(false)}}
  return <section className="page"><BackBar title={title} onBack={()=>{setPage('home');setMessage('')}}/><div className={`seen-subhero ${page}`}><div>{page==='private'?<LockKeyhole/>:page==='public'?<Compass/>:<Users/>}<span>{page==='private'?'这里只属于你':page==='public'?'公开内容会被真实岛民看见':'只在好友关系中可见'}</span></div><NatureMark/></div><section className="paper-card composer"><textarea value={draft} onChange={e=>setDraft(e.target.value)} placeholder={page==='private'?'写下此刻真实的你…':page==='public'?'分享一个想被世界看见的瞬间…':'写给好友们看…'}/><button className="primary" disabled={busy||!draft.trim()} onClick={()=>void publish()}><Send size={16}/>{page==='private'?'记录':'发布'}</button></section><div className="post-list">{visible.map(p=><article key={p.id}><header><b>{page==='private'?'我':p.author}</b><span>{formatDateTime(p.createdAt)}</span></header><p>{p.content}</p></article>)}</div>{busy&&!visible.length&&<Empty>正在同步…</Empty>}{!busy&&!visible.length&&<Empty>{page==='private'?'树洞还很安静':page==='public'?'此刻世界很安静':'好友之间还没有新的分享'}</Empty>}{message&&<p className="form-message">{message}</p>}</section>
}

function MessagesView({ externalPeer, clearExternal }: { externalPeer:Recommendation|null; clearExternal:()=>void }) {
  const [friends,setFriends]=useState<Recommendation[]>([]); const [peer,setPeer]=useState<Recommendation|null>(externalPeer); const [conversation,setConversation]=useState(''); const [messages,setMessages]=useState<ChatMessage[]>([]); const [text,setText]=useState(''); const [myId,setMyId]=useState(''); const [busy,setBusy]=useState(false); const [message,setMessage]=useState('')
  useEffect(()=>{void restoreAccount().then(a=>{if(a)setMyId(a.user.id)});void fetchFriends().then(setFriends).catch(()=>undefined)},[])
  useEffect(()=>{if(externalPeer){setPeer(externalPeer);clearExternal()}},[externalPeer,clearExternal])
  useEffect(()=>{if(!peer)return;setBusy(true);void startConversation(peer.id).then(async id=>{setConversation(id);setMessages(await fetchMessages(id))}).catch(e=>setMessage(e instanceof Error?e.message:'打开对话失败')).finally(()=>setBusy(false))},[peer])
  if(peer) return <section className="page chat-page"><BackBar title={peer.nickname} onBack={()=>{setPeer(null);setMessages([]);setConversation('')}}/><div className="chat-intro"><div className="avatar">{peer.nickname.slice(0,1)}</div><div><strong>{peer.nickname}</strong><span>{peer.city} · 匹配 {peer.score}%</span></div></div><div className="chat-messages">{messages.map(m=><div key={m.id} className={m.senderId===myId?'mine':'theirs'}><p>{m.content}</p><span>{formatDateTime(m.createdAt)}</span></div>)}{busy&&<Empty>正在打开对话…</Empty>}</div><div className="chat-input"><input value={text} onChange={e=>setText(e.target.value)} placeholder="写下想说的话"/><button disabled={!text.trim()||busy} onClick={async()=>{if(!conversation)return;setBusy(true);try{await sendMessage(conversation,text);setText('');setMessages(await fetchMessages(conversation))}catch(e){setMessage(e instanceof Error?e.message:'发送失败')}finally{setBusy(false)}}><Send size={18}/></button></div>{message&&<p className="form-message">{message}</p>}</section>
  return <section className="page"><div className="page-title"><div><small>CONNECTIONS</small><h1>消息</h1><p>只保留真正建立过连接的人。</p></div><NatureMark/></div><div className="friend-list">{friends.map(f=><button key={f.id} onClick={()=>setPeer(f)}><div className="avatar">{f.nickname.slice(0,1)}</div><div><strong>{f.nickname}</strong><span>{f.city} · {f.goal}</span></div><i>{f.score}%</i><ChevronRight size={18}/></button>)}</div>{!friends.length&&<Empty>还没有好友。可以先去“遇见”认识一个人。</Empty>}</section>
}

function MineView({ profile, onProfile, onLogout, onAssessment }: { profile:CleanProfile; onProfile:(p:CleanProfile)=>void; onLogout:()=>void; onAssessment:()=>void }) {
  const [editing,setEditing]=useState(false); const [nickname,setNickname]=useState(profile.nickname); const [city,setCity]=useState(profile.city); const [goal,setGoal]=useState(profile.goal); const [intro,setIntro]=useState(profile.intro); const [message,setMessage]=useState('')
  const dims=Object.entries(profile.traits)
  return <section className="page"><div className="profile-hero"><NatureMark/><div className="large-avatar">{profile.nickname.slice(0,1)}</div><h1>{profile.nickname}</h1><p>{profile.city} · {profile.goal}</p><div className="chips">{profile.anchors.map(a=><span key={a}>{a}</span>)}</div></div><section className="paper-card"><div className="card-title"><div><small>RELATIONSHIP MAP</small><h2>我的关系倾向</h2></div><Sparkles/></div><div className="trait-bars">{dims.map(([k,v])=><div key={k}><span>{{values:'价值观',lifestyle:'生活节律',relationship:'关系需求',communication:'沟通方式',growth:'成长方向',boundary:'边界感'}[k as keyof SixTraits]}</span><i><b style={{width:`${v}%`}}/></i><strong>{v}</strong></div>)}</div><button className="secondary" onClick={onAssessment}>重新完成心谱</button></section><section className="paper-card profile-card"><div className="card-title"><div><small>PROFILE</small><h2>个人资料</h2></div><button className="text-btn" onClick={()=>setEditing(!editing)}>{editing?'取消':'编辑'}</button></div>{editing?<><label>昵称<input value={nickname} onChange={e=>setNickname(e.target.value)}/></label><label>城市<input value={city} onChange={e=>setCity(e.target.value)}/></label><label>目标<select value={goal} onChange={e=>setGoal(e.target.value)}><option>深度朋友</option><option>共同成长</option><option>兴趣同伴</option><option>长期关系</option></select></label><label>自我介绍<textarea value={intro} onChange={e=>setIntro(e.target.value)}/></label><button className="primary" onClick={async()=>{try{const p=await updateProfile({nickname,city,goal,intro});onProfile(p);setEditing(false);setMessage('已保存')}catch(e){setMessage(e instanceof Error?e.message:'保存失败')}}}>保存资料</button></>:<p className="profile-intro">{profile.intro}</p>}</section><button className="logout-btn" onClick={onLogout}><LogOut size={17}/>退出登录</button>{message&&<p className="form-message">{message}</p>}<p className="version">镜屿 Clean · v1.0.0</p></section>
}

export default function CleanApp() {
  const [booting,setBooting]=useState(true); const [profile,setProfile]=useState<CleanProfile|null>(null); const [tab,setTab]=useState<MainTab>('meet'); const [meetPage,setMeetPage]=useState<MeetPage>('home'); const [chatPeer,setChatPeer]=useState<Recommendation|null>(null)
  useEffect(()=>{void restoreAccount().then(a=>setProfile(a?.profile||null)).finally(()=>setBooting(false))},[])
  if(booting) return <main className="boot-screen"><NatureMark/><h1>镜屿</h1><p>正在进入一座安静的岛…</p></main>
  if(!profile) return <AuthScreen onReady={setProfile}/>
  if(!profile.age_confirmed) return <ProfileGate profile={profile} onSaved={setProfile}/>
  const openChat=(peer:Recommendation)=>{setChatPeer(peer);setTab('messages')}
  const meetContent=meetPage==='home'?<MeetHome profile={profile} onOpen={setMeetPage}/>:meetPage==='match'?<MatchView onBack={()=>setMeetPage('home')} onOpenChat={openChat}/>:meetPage==='mood'?<MoodView onBack={()=>setMeetPage('home')}/>:meetPage==='wellbeing'?<WellbeingView onBack={()=>setMeetPage('home')}/>:meetPage==='drift'?<DriftView onBack={()=>setMeetPage('home')}/>:meetPage==='inbox'?<InboxView onBack={()=>setMeetPage('home')}/>:<AssessmentView onBack={()=>setMeetPage('home')} onDone={async()=>{const account=await restoreAccount();if(account)setProfile(account.profile);setMeetPage('home')}}/>
  return <main className="app-shell"><div className="app-content">{tab==='meet'?meetContent:tab==='seen'?<SeenView/>:tab==='messages'?<MessagesView externalPeer={chatPeer} clearExternal={()=>setChatPeer(null)}/>:<MineView profile={profile} onProfile={setProfile} onAssessment={()=>{setTab('meet');setMeetPage('assessment')}} onLogout={async()=>{await logoutAccount();setProfile(null);setTab('meet');setMeetPage('home')}}/>}</div><nav className="bottom-nav"><button className={tab==='meet'?'active':''} onClick={()=>{setTab('meet');setMeetPage('home')}}><Compass/><span>遇见</span></button><button className={tab==='seen'?'active':''} onClick={()=>setTab('seen')}><Leaf/><span>看见</span></button><button className={tab==='messages'?'active':''} onClick={()=>setTab('messages')}><MessageCircle/><span>消息</span></button><button className={tab==='mine'?'active':''} onClick={()=>setTab('mine')}><UserRound/><span>我的</span></button></nav></main>
}
