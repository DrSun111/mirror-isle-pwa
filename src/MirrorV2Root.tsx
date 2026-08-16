import { useEffect, useState } from 'react'
import MirrorV2Experience from './MirrorV2Experience'
import MirrorV2Polish from './MirrorV2Polish'
import PasswordRecoveryV2 from './PasswordRecoveryV2'
import { cleanSupabase, restoreV2Account } from './mirrorV2Api'

function recoveryInUrl() {
  return /(?:[?#&])type=recovery(?:[=&]|$)/.test(window.location.href)
}

export default function MirrorV2Root() {
  const [recovering, setRecovering] = useState(recoveryInUrl)

  useEffect(() => {
    const { data } = cleanSupabase.auth.onAuthStateChange((event) => {
      if (event === 'PASSWORD_RECOVERY') setRecovering(true)
    })
    return () => data.subscription.unsubscribe()
  }, [])

  if (recovering) {
    return <PasswordRecoveryV2 onDone={async () => {
      await restoreV2Account().catch(() => null)
      setRecovering(false)
      window.location.reload()
    }}/>
  }

  return <>
    <MirrorV2Polish />
    <MirrorV2Experience />
  </>
}
