import { redirect } from 'next/navigation'

/**
 * Root-level alias — Supabase email templates and the brief both reference
 * /forgot-password, while the implementation lives at /auth/forgot-password.
 * This keeps both paths working without duplicating UI.
 */
export default function ForgotPasswordRoot() {
  redirect('/auth/forgot-password')
}
