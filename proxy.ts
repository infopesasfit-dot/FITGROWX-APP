import { createServerClient } from '@supabase/ssr'
import { NextResponse, type NextRequest } from 'next/server'
import { getGymSummary } from '@/lib/supabase-relations'
import { enforceApiPayloadLimit } from '@/lib/payload-limit'

// ── CSP Nonce ───────────────────────────────────────────────────────────────
function buildCsp(nonce: string, allowUnsafeInline = false): string {
  const scriptSrc = allowUnsafeInline
    ? `script-src 'self' 'unsafe-inline' https://challenges.cloudflare.com https://vercel.live`
    : `script-src 'self' 'nonce-${nonce}' https://challenges.cloudflare.com https://vercel.live`;

  return [
    "default-src 'self'",
    scriptSrc,
    "style-src 'self' 'unsafe-inline'",
    "img-src 'self' data: blob: https:",
    "font-src 'self' data:",
    "connect-src 'self' https://*.supabase.co wss://*.supabase.co https://vitals.vercel-insights.com https://va.vercel-scripts.com https://challenges.cloudflare.com https://vercel.live",
    "frame-src https://challenges.cloudflare.com",
    "object-src 'none'",
    "base-uri 'self'",
    "frame-ancestors 'none'",
  ].join('; ');
}

function buildHeadersWithNonce(
  request: NextRequest,
  nonce: string,
  cookieUpdates?: Array<{ name: string; value: string }>,
): Headers {
  const headers = new Headers(request.headers);
  headers.set('x-nonce', nonce);

  if (cookieUpdates?.length) {
    const cookieMap = new Map<string, string>();
    const rawCookie = request.headers.get('cookie') ?? '';
    rawCookie.split(';').forEach(part => {
      const trimmed = part.trim();
      const eq = trimmed.indexOf('=');
      if (eq > 0) cookieMap.set(trimmed.slice(0, eq).trim(), trimmed.slice(eq + 1));
    });
    cookieUpdates.forEach(({ name, value }) => cookieMap.set(name, value));
    headers.set('cookie', Array.from(cookieMap.entries()).map(([k, v]) => `${k}=${v}`).join('; '));
  }

  return headers;
}

// ── Rutas por rol ──────────────────────────────────────────────────────────
const ADMIN_ONLY   = ['/dashboard/ajustes', '/dashboard/pagos', '/dashboard/automatizaciones', '/dashboard/prospectos']
const STUDENT_ONLY = ['/dashboard/mi-progreso']

function matchesAny(pathname: string, routes: string[]) {
  return routes.some(r => pathname === r || pathname.startsWith(r + '/'))
}

export async function proxy(request: NextRequest) {
  // ── Payload limit check (applies to /api/* only) ────────────────────────────
  const payloadError = enforceApiPayloadLimit(request);
  if (payloadError) {
    return payloadError;
  }

  const nonce = Buffer.from(crypto.randomUUID()).toString('base64');
  const csp = buildCsp(nonce, request.nextUrl.pathname === '/start');

  let response = NextResponse.next({ request: { headers: buildHeadersWithNonce(request, nonce) } })

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll()
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) => {
            request.cookies.set(name, value)
          })
          response = NextResponse.next({ request: { headers: buildHeadersWithNonce(request, nonce, cookiesToSet) } })
          cookiesToSet.forEach(({ name, value, options }) => {
            response.cookies.set(name, value, options)
          })
        },
      },
    }
  )

  const { data: { user } } = await supabase.auth.getUser()
  const pathname = request.nextUrl.pathname
  const searchParams = request.nextUrl.searchParams

  // Error de Supabase auth (ej: otp_expired) → redirigir a /start con el error
  if (pathname === '/' && searchParams.get('error_code')) {
    const errorCode = searchParams.get('error_code')!
    return NextResponse.redirect(new URL(`/start?error_code=${errorCode}`, request.url))
  }

  // Sin sesión → login
  if (!user && (pathname.startsWith('/dashboard') || pathname.startsWith('/platform') || pathname.startsWith('/onboarding'))) {
    return NextResponse.redirect(new URL('/start?login=1', request.url))
  }

  // Con sesión en auth pages → dashboard (but not onboarding — let it handle itself)
  if (user && (pathname === '/login' || pathname === '/register' || pathname === '/start')) {
    const { data: authProfile } = await supabase
      .from('profiles')
      .select('role')
      .eq('id', user.id)
      .limit(1)
      .maybeSingle()

    const destination = authProfile?.role === 'platform_owner' ? '/platform' : '/dashboard'
    return NextResponse.redirect(new URL(destination, request.url))
  }

  // Protección por rol + trial (solo rutas de dashboard con sesión activa)
  if (user && (pathname.startsWith('/dashboard') || pathname.startsWith('/platform'))) {
    const { data: profile } = await supabase
      .from('profiles')
      .select('role, gym_id, gyms(trial_expires_at, is_subscription_active, gym_status, plan_type, trial_start_date)')
      .eq('id', user.id)
      .limit(1)
      .maybeSingle()

    const role = profile?.role ?? 'admin'

    if (role === 'platform_owner' && pathname.startsWith('/dashboard')) {
      const impersonationToken = request.cookies.get('impersonation_token')?.value ?? null
      if (impersonationToken) {
        const { data: impersonation } = await supabase
          .from('platform_impersonation_tokens')
          .select('id')
          .eq('token', impersonationToken)
          .eq('platform_user_id', user.id)
          .eq('used', true)
          .gt('expires_at', new Date().toISOString())
          .maybeSingle()

        if (impersonation) {
          response.headers.set('Content-Security-Policy', csp);
          return response
        }
      }

      const redirect = NextResponse.redirect(new URL('/platform', request.url))
      redirect.cookies.delete('impersonation_token')
      return redirect
    }

    if (role !== 'platform_owner' && pathname.startsWith('/platform')) {
      return NextResponse.redirect(new URL('/dashboard', request.url))
    }

    // ── Trial / subscription gate ────────────────────────────────────────────
    const gym = getGymSummary(profile?.gyms)

    // Calcular período de gracia (días 0-2 = 3 días totales)
    let enGracia = false
    if (gym?.trial_expires_at) {
      const trialExpireTime = new Date(gym.trial_expires_at).getTime()
      const nowTime = Date.now()
      const diasDesdeVencimiento = Math.floor((nowTime - trialExpireTime) / 86_400_000)
      enGracia = diasDesdeVencimiento >= 0 && diasDesdeVencimiento <= 2
    }

    // Solo bloquear si trial expiró Y NO estamos en gracia Y NO subscrito
    const blocked =
      (gym?.trial_expires_at ? new Date(gym.trial_expires_at) < new Date() : false) &&
      !(gym?.is_subscription_active ?? false) &&
      !enGracia

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

    // ── Onboarding gate ─────────────────────────────────────────────────────
    if (role !== 'platform_owner' && profile?.gym_id && pathname.startsWith('/dashboard')) {
      const { data: gymSettings } = await supabase
        .from('gym_settings')
        .select('onboarding_completed')
        .eq('gym_id', profile.gym_id)
        .maybeSingle()

      if (gymSettings?.onboarding_completed === false) {
        return NextResponse.redirect(new URL('/onboarding', request.url))
      }
    }
  }

  response.headers.set('Content-Security-Policy', csp);
  return response
}

export const config = {
  matcher: ['/api/:path*', '/dashboard/:path*', '/platform/:path*', '/platform', '/onboarding/:path*', '/onboarding', '/login', '/register', '/start', '/checkout-pro'],
}
