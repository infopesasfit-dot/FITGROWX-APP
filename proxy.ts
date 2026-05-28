import { createServerClient } from '@supabase/ssr'
import { NextResponse, type NextRequest } from 'next/server'
import { getGymSummary } from '@/lib/supabase-relations'

// ── Payload Limiting ────────────────────────────────────────────────────────
const PAYLOAD_LIMITS: Record<string, number> = {
  "/api/admin/email-blast": 5_000_000,      // 5MB
  "/api/alumno/fotos": 10_000_000,          // 10MB
  "/api/mp/webhook": 500_000,               // 500KB
  "/api/mp/gym-webhook": 500_000,           // 500KB
  "/api/webhooks/wa-motor": 500_000,        // 500KB
  "/api/whatsapp/webhook": 500_000,         // 500KB
};

const WEBHOOK_PATHS = [
  "/api/mp/webhook",
  "/api/mp/gym-webhook",
  "/api/webhooks/wa-motor",
  "/api/whatsapp/webhook",
];

function formatSize(bytes: number): string {
  return bytes >= 1_000_000
    ? `${(bytes / 1_000_000).toFixed(1)}MB`
    : `${Math.round(bytes / 1000)}KB`;
}

function getPayloadLimit(pathname: string): number {
  for (const [prefix, limit] of Object.entries(PAYLOAD_LIMITS)) {
    if (pathname === prefix || pathname.startsWith(prefix + "/")) {
      return limit;
    }
  }
  return 100_000; // Default 100KB
}

function isWebhookPath(pathname: string): boolean {
  return WEBHOOK_PATHS.some(
    (webhook) => pathname === webhook || pathname.startsWith(webhook + "/")
  );
}

function validatePayloadLimit(req: NextRequest): NextResponse | null {
  const method = req.method.toUpperCase();
  const pathname = req.nextUrl.pathname;

  // Apply only to /api/* with body methods
  if (!pathname.startsWith("/api/") || !["POST", "PUT", "PATCH", "DELETE"].includes(method)) {
    return null;
  }

  const maxBytes = getPayloadLimit(pathname);
  const contentLength = req.headers.get("content-length");

  if (!contentLength) {
    if (isWebhookPath(pathname)) {
      return null;
    }
    return NextResponse.json(
      { error: "Content-Length header requerido." },
      { status: 411 }
    );
  }

  const bytes = parseInt(contentLength, 10);
  if (isNaN(bytes)) {
    return NextResponse.json(
      { error: "Content-Length inválido." },
      { status: 411 }
    );
  }

  if (bytes > maxBytes) {
    return NextResponse.json(
      { error: `Payload demasiado grande. Máximo permitido: ${formatSize(maxBytes)}.` },
      { status: 413 }
    );
  }

  return null;
}

// ── Rutas por rol ──────────────────────────────────────────────────────────
const ADMIN_ONLY   = ['/dashboard/ajustes', '/dashboard/pagos', '/dashboard/automatizaciones', '/dashboard/prospectos']
const STUDENT_ONLY = ['/dashboard/mi-progreso']

function matchesAny(pathname: string, routes: string[]) {
  return routes.some(r => pathname === r || pathname.startsWith(r + '/'))
}

export async function proxy(request: NextRequest) {
  // ── Payload limit check (applies to /api/* only) ────────────────────────────
  const payloadError = validatePayloadLimit(request);
  if (payloadError) {
    return payloadError;
  }

  let response = NextResponse.next({ request: { headers: request.headers } })

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
          response = NextResponse.next({ request })
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
      return NextResponse.redirect(new URL('/platform', request.url))
    }

    if (role !== 'platform_owner' && pathname.startsWith('/platform')) {
      return NextResponse.redirect(new URL('/dashboard', request.url))
    }

    // ── Trial / subscription gate ────────────────────────────────────────────
    const gym = getGymSummary(profile?.gyms)
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
  matcher: ['/dashboard/:path*', '/onboarding/:path*', '/onboarding', '/login', '/register', '/start', '/checkout-pro'],
}
