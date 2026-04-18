import { NextResponse, type NextRequest } from 'next/server'
import { createClient } from '@/lib/supabase/server'

/**
 * /logout — sign the user out (clears Supabase cookies) and redirect home.
 * Supports both GET (for "Sign out" links) and POST (for forms).
 */
async function handle(request: NextRequest) {
  const supabase = await createClient()
  await supabase.auth.signOut()
  return NextResponse.redirect(new URL('/', request.url))
}

export const GET = handle
export const POST = handle
