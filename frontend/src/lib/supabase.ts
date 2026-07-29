import { createClient, type SupabaseClient } from '@supabase/supabase-js'

let client: SupabaseClient | undefined

export function getSupabaseClient(): SupabaseClient {
  if (client) return client

  const url = import.meta.env.VITE_SUPABASE_URL
  const publishableKey = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY

  if (!url || !publishableKey) {
    throw new Error(
      'VITE_SUPABASE_URL and VITE_SUPABASE_PUBLISHABLE_KEY are required.',
    )
  }

  client = createClient(url, publishableKey, {
    auth: {
      autoRefreshToken: true,
      // The callback view exchanges the PKCE code explicitly. Enabling automatic
      // detection as well can race and consume the same verifier twice.
      detectSessionInUrl: false,
      persistSession: true,
      flowType: 'pkce',
    },
  })

  return client
}
