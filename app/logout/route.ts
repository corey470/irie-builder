import { NextResponse, type NextRequest } from 'next/server'
import { createClient } from '@/lib/supabase/server'

/**
 * /logout — sign the user out (clears Supabase cookies) and redirect home.
 * POST-only: a GET handler would be CSRF-able by any third-party site
 * embedding `<img src="https://iriebuilder.com/logout">`, force-signing-out
 * visitors just for opening an email or document.
 */
export async function POST(request: NextRequest) {
  const supabase = await createClient()
  await supabase.auth.signOut()
  return NextResponse.redirect(new URL('/', request.url), { status: 303 })
}
