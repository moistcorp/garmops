import { createClient } from '@supabase/supabase-js'

const required = [
  'NEXT_PUBLIC_SUPABASE_URL',
  'SUPABASE_SERVICE_ROLE_KEY',
  'FOUNDER_EMAIL',
  'FOUNDER_PASSWORD',
  'FOUNDER_FIRST_NAME',
  'FOUNDER_LAST_NAME',
]

for (const name of required) {
  if (!process.env[name]) throw new Error(`${name} is required`)
}

const email = process.env.FOUNDER_EMAIL.trim().toLowerCase()
const admin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY,
  { auth: { autoRefreshToken: false, persistSession: false } },
)

const { data: existing, error: existingError } = await admin
  .from('account_principals')
  .select('user_id,account_type')
  .eq('normalized_email', email)
  .maybeSingle()

if (existingError) throw existingError
if (existing) {
  throw new Error(
    `Email is already reserved as ${existing.account_type}; account types cannot be converted`,
  )
}

const created = await admin.auth.admin.createUser({
  email,
  password: process.env.FOUNDER_PASSWORD,
  email_confirm: true,
  user_metadata: {
    first_name: process.env.FOUNDER_FIRST_NAME,
    last_name: process.env.FOUNDER_LAST_NAME,
    account_type: 'staff',
  },
})

if (created.error || !created.data.user) {
  throw created.error ?? new Error('Founder auth user was not created')
}

const user = created.data.user

try {
  // These inserts must be sequential because staff_members references profiles(id).
  const profileResult = await admin.from('profiles').insert({
    id: user.id,
    first_name: process.env.FOUNDER_FIRST_NAME,
    last_name: process.env.FOUNDER_LAST_NAME,
  })
  if (profileResult.error) throw profileResult.error

  const principalResult = await admin.from('account_principals').insert({
    user_id: user.id,
    normalized_email: email,
    account_type: 'staff',
    active: true,
  })
  if (principalResult.error) throw principalResult.error

  const staffResult = await admin.from('staff_members').insert({
    user_id: user.id,
    email,
    role: 'founder',
    active: true,
    must_use_mfa: true,
    activated_at: new Date().toISOString(),
  })
  if (staffResult.error) throw staffResult.error

  console.log(
    `Founder created: ${email}. Sign in at https://foundry.garmops.com and enrol TOTP before using Foundry.`,
  )
} catch (error) {
  await admin.auth.admin.deleteUser(user.id)
  throw error
}
