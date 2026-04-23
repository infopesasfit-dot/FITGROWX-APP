import { createServerClient, type CookieOptions } from '@supabase/ssr'
import { NextResponse, type NextRequest } from 'next/server'

// Rutas por rol
const ADMIN_ONLY   = ['/dashboard/ajustes', '/dashboard/pagos', '/dashboard/automatizaciones', '/dashboard/prospectos']
const STAFF_UP     = ['/dashboard/alumnos', '/dashboard/asistencia', '/dashboard/membresias']
const STUDENT_ONLY = ['/dashboard/mi-progreso']

function matchesAny(pathname: string, routes: string[]) {
  return routes.some(r => pathname === r || pathname.startsWith(r + '/'))
}

export async function proxy(request: NextRequest) {
  let response = NextResponse.next({ request: { headers: request.headers } })

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        get(name: string) {
          return request.cookies.get(name)?.value
        },
        set(name: string, value: string, options: CookieOptions) {
          request.cookies.set({ name, value, ...options })
          response = NextResponse.next({ request: { headers: request.headers } })
          response.cookies.set({ name, value, ...options })
        },
        remove(name: string, options: CookieOptions) {
          request.cookies.set({ name, value: '', ...options })
          response = NextResponse.next({ request: { headers: request.headers } })
          response.cookies.set({ name, value: '', ...options })
        },
      },
    }
  )

  const { data: { session } } = await supabase.auth.getSession()
  const pathname = request.nextUrl.pathname

  // Sin sesión → login
  if (!session && (pathname.startsWith('/dashboard') || pathname.startsWith('/platform'))) {
    return NextResponse.redirect(new URL('/login', request.url))
  }

  // Con sesión en auth pages → dashboard
  if (session && (pathname === '/login' || pathname === '/register')) {
    const { data: authProfile } = await supabase
      .from('profiles')
      .select('role')
      .eq('id', session.user.id)
      .limit(1)
      .maybeSingle()

    const destination = authProfile?.role === 'platform_owner' ? '/platform' : '/dashboard'
    return NextResponse.redirect(new URL(destination, request.url))
  }

  // Protección por rol + trial (solo rutas de dashboard con sesión activa)
  if (session && (pathname.startsWith('/dashboard') || pathname.startsWith('/platform'))) {
    const { data: profile } = await supabase
      .from('profiles')
      .select('role, gym_id, gyms(trial_expires_at, is_subscription_active, gym_status, plan_type, trial_start_date)')
      .eq('id', session.user.id)
      .limit(1)
      .maybeSingle()

    const role = profile?.role ?? 'admin'

    if (role === 'platform_owner' && pathname.startsWith('/dashboard')) {
      return NextResponse.redirect(new URL('/platform', request.url))
    }

    if (role !== 'platform_owner' && pathname.startsWith('/platform')) {
      return NextResponse.redirect(new URL('/dashboard', request.url))
    }

    // ── Trial / subscription gate ────────────────────────────────────────────
    const gym = profile?.gyms as {
      trial_expires_at: string | null
      is_subscription_active: boolean
      gym_status: string | null
      plan_type: string | null
      trial_start_date: string | null
    } | null
    const blocked =
      (gym?.gym_status === 'trial_expired' ||
        (gym?.trial_expires_at ? new Date(gym.trial_expires_at) < new Date() : false)) &&
      !(gym?.is_subscription_active ?? false)

    const SUBSCRIPTION_PATHS = ['/dashboard/suscripcion', '/dashboard/planes']
    if (blocked && !SUBSCRIPTION_PATHS.some(p => pathname.startsWith(p))) {
      return NextResponse.redirect(new URL('/dashboard/suscripcion', request.url))
    }

    // ── Role guards ──────────────────────────────────────────────────────────

    // Alumno intenta entrar a rutas que no son suyas
    if (role === 'student' && !matchesAny(pathname, STUDENT_ONLY) && pathname !== '/dashboard') {
      return NextResponse.redirect(new URL('/dashboard/mi-progreso', request.url))
    }

    // Staff intenta entrar a rutas solo-admin
    if (role === 'staff' && matchesAny(pathname, ADMIN_ONLY)) {
      return NextResponse.redirect(new URL('/dashboard', request.url))
    }

    // Admin/staff intentan entrar a ruta solo-alumno
    if ((role === 'admin' || role === 'staff') && matchesAny(pathname, STUDENT_ONLY)) {
      return NextResponse.redirect(new URL('/dashboard', request.url))
    }
  }

  return response
}

export const config = {
  matcher: ['/dashboard/:path*', '/login', '/register', '/checkout-pro'],
}
