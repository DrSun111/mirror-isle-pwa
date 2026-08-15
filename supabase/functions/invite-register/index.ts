import { createClient } from 'npm:@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
}

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { ...corsHeaders, 'Content-Type': 'application/json' } })

const getSecretKey = () => {
  const legacy = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')
  if (legacy) return legacy
  const raw = Deno.env.get('SUPABASE_SECRET_KEYS')
  if (!raw) return ''
  try {
    const parsed = JSON.parse(raw) as Record<string, string>
    return parsed.default || Object.values(parsed)[0] || ''
  } catch {
    return ''
  }
}

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })
  if (req.method !== 'POST') return json({ error: 'method_not_allowed' }, 405)

  try {
    const { email, password, invite_code } = await req.json()
    const normalizedEmail = String(email ?? '').trim().toLowerCase()
    const normalizedInvite = String(invite_code ?? '').trim().toUpperCase()
    const cleanPassword = String(password ?? '')

    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normalizedEmail)) return json({ error: 'invalid_email' }, 400)
    if (cleanPassword.length < 8 || cleanPassword.length > 128) return json({ error: 'weak_password' }, 400)
    if (!normalizedInvite) return json({ error: 'invalid_invite_code' }, 400)

    const supabaseUrl = Deno.env.get('SUPABASE_URL') ?? ''
    const secretKey = getSecretKey()
    if (!supabaseUrl || !secretKey) return json({ error: 'server_not_configured' }, 500)

    const admin = createClient(supabaseUrl, secretKey, { auth: { autoRefreshToken: false, persistSession: false } })
    const invite = await admin.from('mirror_invite_codes').select('code,active,max_uses,used_count,expires_at').eq('code', normalizedInvite).maybeSingle()
    if (invite.error) return json({ error: 'invite_lookup_failed' }, 500)
    if (!invite.data || !invite.data.active) return json({ error: 'invalid_invite_code' }, 403)
    if (invite.data.expires_at && new Date(invite.data.expires_at).getTime() <= Date.now()) return json({ error: 'invite_expired' }, 403)
    if (Number(invite.data.used_count) >= Number(invite.data.max_uses)) return json({ error: 'invite_exhausted' }, 403)

    const created = await admin.auth.admin.createUser({
      email: normalizedEmail,
      password: cleanPassword,
      email_confirm: true,
      user_metadata: { invite_code: normalizedInvite, app: 'mirror-isle' },
      app_metadata: { invite_code: normalizedInvite, registration_channel: 'invite' },
    })
    if (created.error || !created.data.user) {
      const message = created.error?.message ?? 'create_user_failed'
      return json({ error: /already|registered|exists/i.test(message) ? 'email_already_registered' : 'create_user_failed' }, /already|registered|exists/i.test(message) ? 409 : 400)
    }

    const userId = created.data.user.id
    const redemption = await admin.rpc('mirror_redeem_invite', { p_code: normalizedInvite, p_user_id: userId, p_email: normalizedEmail })
    if (redemption.error || redemption.data !== true) {
      await admin.auth.admin.deleteUser(userId).catch(() => undefined)
      return json({ error: 'invalid_or_exhausted_invite' }, 409)
    }

    return json({ ok: true, email: normalizedEmail, user_id: userId })
  } catch (error) {
    console.error('invite-register failed', error)
    return json({ error: 'registration_failed' }, 500)
  }
})
