import { useId } from 'react'

export type SceneKind =
  | 'lodge'
  | 'campfire'
  | 'comfort'
  | 'help'
  | 'packing'
  | 'tidy'
  | 'rain'
  | 'waiting'
  | 'path'
  | 'map'

interface Props {
  kind: SceneKind
  level: 0 | 1 | 2 | 3
}

function Person({ x, y, shirt = '#d99a86', flip = false }: { x: number; y: number; shirt?: string; flip?: boolean }) {
  const dir = flip ? -1 : 1
  return (
    <g transform={`translate(${x} ${y}) scale(${dir} 1)`}>
      <circle cx="0" cy="-13" r="7" fill="#f3c7a9" />
      <path d="M-6-14c2-8 13-8 14 1-2-4-7-5-14-1Z" fill="#5b4a43" />
      <rect x="-8" y="-6" width="16" height="22" rx="7" fill={shirt} />
      <path d="M-5 15l-4 15M5 15l4 15" stroke="#5c6870" strokeWidth="4" strokeLinecap="round" />
    </g>
  )
}

function Tree({ x, y, scale = 1 }: { x: number; y: number; scale?: number }) {
  return (
    <g transform={`translate(${x} ${y}) scale(${scale})`}>
      <rect x="-3" y="8" width="6" height="32" rx="3" fill="#92735d" />
      <circle cx="0" cy="4" r="18" fill="#9fbea0" />
      <circle cx="-12" cy="9" r="12" fill="#b5ceb0" />
      <circle cx="12" cy="10" r="12" fill="#8fad91" />
    </g>
  )
}

function Lodge({ level }: { level: number }) {
  return (
    <>
      <rect x="10" y="52" width="110" height="54" rx="12" fill="#f3d7b3" />
      <path d="M5 58l60-36 60 36Z" fill="#b98468" />
      <rect x="49" y="72" width="30" height="34" rx="5" fill="#8d674f" />
      <rect x="22" y="68" width="20" height="18" rx="4" fill="#ffe7a5" />
      <Tree x={145} y={42} scale={0.8} />
      <Person x={level === 0 ? 150 : level === 1 ? 130 : 108} y={112} shirt="#d99886" flip />
      {level >= 1 && <Person x={154} y={112} shirt="#84a89c" />}
      {level >= 2 && <Person x={176} y={110} shirt="#9c92bd" flip />}
      {level >= 3 && <Person x={128} y={91} shirt="#e2b36f" />}
      {level === 0 && <path d="M143 125h25" stroke="#9c806f" strokeWidth="3" strokeLinecap="round" />}
    </>
  )
}

function Campfire({ level }: { level: number }) {
  return (
    <>
      <Tree x={25} y={45} scale={0.75} /><Tree x={190} y={50} scale={0.65} />
      <ellipse cx="110" cy="118" rx="72" ry="20" fill="#d8c49f" opacity=".55" />
      <path d="M108 119c-13-13 0-28 4-38 12 12 18 24 3 38Z" fill="#e89b5c" />
      <path d="M111 114c-7-9 1-16 4-23 6 8 7 15 0 23Z" fill="#ffe0a0" />
      <Person x={58} y={109} shirt="#83a79d" />
      {level >= 1 && <Person x={165} y={109} shirt="#d99787" flip />}
      {level >= 2 && <Person x={80} y={92} shirt="#c2a378" />}
      {level >= 3 && <Person x={145} y={88} shirt="#958db9" flip />}
      <path d={level < 2 ? 'M69 83q12-10 24 0' : 'M68 80q20-18 40 0'} fill="none" stroke="#c89571" strokeWidth="2" strokeLinecap="round" opacity=".7" />
    </>
  )
}

function Comfort({ level }: { level: number }) {
  return (
    <>
      <rect x="12" y="28" width="196" height="102" rx="22" fill="#f2ddca" opacity=".7" />
      <circle cx="42" cy="48" r="15" fill="#f7e9d8" />
      <Person x={83} y={102} shirt="#a6bba2" />
      <Person x={level === 0 ? 164 : level === 1 ? 142 : 126} y={102} shirt="#d99a86" flip />
      {level >= 1 && <path d="M107 91q12-9 24 0" stroke="#bd8c73" strokeWidth="3" strokeLinecap="round" fill="none" />}
      {level >= 2 && <g><rect x="100" y="108" width="26" height="14" rx="5" fill="#fff5e7" /><path d="M106 108v-8h12v8" stroke="#c9a270" strokeWidth="2" fill="none" /></g>}
      {level >= 3 && <path d="M91 91q17-20 35 0" stroke="#d48d89" strokeWidth="4" strokeLinecap="round" fill="none" />}
    </>
  )
}

function Help({ level }: { level: number }) {
  return (
    <>
      <path d="M0 124q55-46 108-8t112-4v48H0Z" fill="#c8d9bd" />
      <Tree x={185} y={50} scale={0.75} />
      <Person x={76} y={108} shirt="#ddb077" />
      <Person x={level === 0 ? 165 : level === 1 ? 145 : 125} y={108} shirt="#8ea9a0" flip />
      <rect x="68" y="109" width="20" height="18" rx="4" fill="#9b765e" />
      {level === 1 && <path d="M120 84l20-10" stroke="#7c8e83" strokeWidth="3" strokeLinecap="round" />}
      {level >= 2 && <path d="M96 99q14-10 25 0" stroke="#c38d72" strokeWidth="4" strokeLinecap="round" fill="none" />}
      {level >= 3 && <rect x="102" y="105" width="18" height="16" rx="4" fill="#9b765e" />}
    </>
  )
}

function Packing({ level }: { level: number }) {
  const items = level + 1
  return (
    <>
      <rect x="18" y="30" width="184" height="98" rx="18" fill="#f5e7d5" />
      <rect x="78" y="66" width="62" height="55" rx="13" fill="#8ea89d" />
      <path d="M90 68q18-30 36 0" fill="none" stroke="#718f82" strokeWidth="6" strokeLinecap="round" />
      {Array.from({ length: items }).map((_, i) => (
        <g key={i} transform={`translate(${45 + i * 34} ${45 + (i % 2) * 12})`}>
          <rect width="22" height="16" rx="5" fill={['#d99a86','#deb56f','#9aa4c2','#b8caaa'][i]} />
          <path d="M5 5h12" stroke="#fff" strokeWidth="2" strokeLinecap="round" opacity=".75" />
        </g>
      ))}
      {level >= 2 && <g><rect x="150" y="70" width="34" height="42" rx="6" fill="#fffaf0" /><path d="M157 80h20M157 89h16M157 98h18" stroke="#b59d86" strokeWidth="2" strokeLinecap="round" /></g>}
    </>
  )
}

function Tidy({ level }: { level: number }) {
  const mess = 3 - level
  return (
    <>
      <rect x="12" y="26" width="196" height="110" rx="20" fill="#eadfce" />
      <rect x="28" y="44" width="64" height="55" rx="10" fill="#d7b18f" />
      <rect x="126" y="42" width="54" height="72" rx="9" fill="#f5eee4" />
      {Array.from({ length: mess + 1 }).map((_, i) => (
        <g key={i} transform={`translate(${55 + i * 30} ${112 + (i % 2) * 10}) rotate(${i % 2 ? 12 : -8})`}>
          <rect width="24" height="10" rx="4" fill={['#9baac5','#d89a84','#99b497','#dfb66f'][i]} />
        </g>
      ))}
      {level >= 2 && <path d="M142 58h22M142 70h22M142 82h22" stroke="#a49a90" strokeWidth="5" strokeLinecap="round" />}
      {level === 3 && <circle cx="106" cy="117" r="9" fill="#d7c899" />}
    </>
  )
}

function Rain({ level }: { level: number }) {
  return (
    <>
      <path d="M0 120q45-35 88-5t132-8v53H0Z" fill="#a9c1a8" />
      <path d="M20 40q30-28 60 0M95 32q28-25 58 0" fill="none" stroke="#a7b8c0" strokeWidth="15" strokeLinecap="round" opacity=".75" />
      {Array.from({ length: 7 }).map((_, i) => <path key={i} d={`M${25+i*28} 52l-8 17`} stroke="#8aa9ba" strokeWidth="3" strokeLinecap="round" />)}
      <Person x={110} y={113} shirt={level <= 1 ? '#d49384' : '#84a49b'} />
      {level === 0 && <path d="M86 82q24-27 48 0" fill="none" stroke="#e5b277" strokeWidth="3" strokeDasharray="4 5" />}
      {level === 1 && <path d="M82 82q28-32 56 0" fill="#e2c48d" opacity=".85" />}
      {level >= 2 && <path d="M75 84q35-40 70 0" fill="#d5ad7c" opacity=".92" />}
      {level === 3 && <circle cx="110" cy="72" r="30" fill="#fff6d9" opacity=".35" />}
    </>
  )
}

function Waiting({ level }: { level: number }) {
  return (
    <>
      <rect x="15" y="30" width="190" height="102" rx="22" fill="#f2dfd0" />
      <rect x="38" y="44" width="22" height="40" rx="6" fill="#5e6c78" />
      <circle cx="49" cy="77" r="2" fill="#fff" />
      <Person x={105} y={111} shirt="#a4b79f" />
      {level === 0 && <g><circle cx="146" cy="64" r="22" fill="#f3b2a8" opacity=".55" /><path d="M136 64h20" stroke="#9a6a66" strokeWidth="3" /></g>}
      {level === 1 && <path d="M132 60h42M132 70h30" stroke="#b19481" strokeWidth="4" strokeLinecap="round" />}
      {level === 2 && <g><rect x="137" y="88" width="34" height="22" rx="7" fill="#fff7e8" /><path d="M145 88v-8h16v8" stroke="#bf9b70" strokeWidth="2" /></g>}
      {level === 3 && <g><rect x="134" y="54" width="42" height="58" rx="5" fill="#d9c7a4" /><path d="M141 64h28M141 74h25M141 84h26" stroke="#fff8e8" strokeWidth="3" strokeLinecap="round" /></g>}
    </>
  )
}

function PathScene({ level }: { level: number }) {
  const shift = level * 12
  return (
    <>
      <Tree x={25} y={42} scale={0.85} /><Tree x={192} y={43} scale={0.78} /><Tree x={55} y={28} scale={0.62} />
      <path d={`M${95-shift/3} 160C${85-shift} 122 ${122+shift} 93 ${112+shift} 55`} fill="none" stroke="#e6c592" strokeWidth="23" strokeLinecap="round" />
      {level >= 1 && <path d="M112 99l44-42" stroke="#d9a06c" strokeWidth="4" strokeLinecap="round" />}
      {level >= 2 && <circle cx="159" cy="55" r="12" fill="#ffe0a1" opacity=".9" />}
      {level === 3 && <g opacity=".9"><circle cx="178" cy="36" r="3" fill="#fff4b3"/><circle cx="151" cy="25" r="2" fill="#fff4b3"/><circle cx="193" cy="65" r="2" fill="#fff4b3"/></g>}
      <Person x={94} y={118} shirt="#d79885" />
    </>
  )
}

function MapScene({ level }: { level: number }) {
  return (
    <>
      <rect x="18" y="26" width="184" height="110" rx="20" fill="#efe3d0" />
      <path d="M48 105V55l42 10 42-18 40 12v50l-40-12-42 18Z" fill="#f9f1df" stroke="#cbb596" strokeWidth="2" />
      {level === 0 && <path d="M64 93l25-16 24 9 32-18" fill="none" stroke="#9bae8d" strokeWidth="5" strokeLinecap="round" />}
      {level === 1 && <g><path d="M63 95q25-45 50-8t45-22" fill="none" stroke="#88a798" strokeWidth="4" /><circle cx="112" cy="84" r="6" fill="#d49a84" /></g>}
      {level === 2 && <g><circle cx="80" cy="72" r="13" fill="#b8c6a7" /><path d="M104 94l22-31 24 35" fill="none" stroke="#9c8db4" strokeWidth="4" /><circle cx="150" cy="61" r="5" fill="#e0b56f" /></g>}
      {level === 3 && <g><path d="M66 92l18-30 15 20 19-36 34 45" fill="none" stroke="#998bb4" strokeWidth="4" /><circle cx="82" cy="53" r="3" fill="#d99a86"/><circle cx="150" cy="49" r="4" fill="#e0b56f"/><path d="M131 70q14-20 28 0" fill="none" stroke="#7ca499" strokeWidth="3" /></g>}
    </>
  )
}

export default function AssessmentSceneArt({ kind, level }: Props) {
  const id = useId().replace(/:/g, '')
  const sky = `${id}-sky`
  return (
    <svg className="v016-scene-art" viewBox="0 0 220 160" role="img" aria-hidden="true" preserveAspectRatio="xMidYMid slice">
      <defs>
        <linearGradient id={sky} x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="#fff5e9" />
          <stop offset=".55" stopColor="#f2dfcf" />
          <stop offset="1" stopColor="#dce7dc" />
        </linearGradient>
      </defs>
      <rect width="220" height="160" rx="20" fill={`url(#${sky})`} />
      <circle cx="184" cy="27" r="22" fill="#fff8cf" opacity=".52" />
      {kind === 'lodge' && <Lodge level={level} />}
      {kind === 'campfire' && <Campfire level={level} />}
      {kind === 'comfort' && <Comfort level={level} />}
      {kind === 'help' && <Help level={level} />}
      {kind === 'packing' && <Packing level={level} />}
      {kind === 'tidy' && <Tidy level={level} />}
      {kind === 'rain' && <Rain level={level} />}
      {kind === 'waiting' && <Waiting level={level} />}
      {kind === 'path' && <PathScene level={level} />}
      {kind === 'map' && <MapScene level={level} />}
      <rect x=".75" y=".75" width="218.5" height="158.5" rx="19.25" fill="none" stroke="#ffffff" strokeOpacity=".55" strokeWidth="1.5" />
    </svg>
  )
}
