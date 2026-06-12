// Auth: bearer de Supabase del usuario recién registrado. No es endpoint de platform owner.
import { NextRequest, NextResponse } from "next/server";
import { getSupabaseAdminClient } from "@/lib/supabase-admin";
import { generateUniqueSlug } from "@/lib/slug-utils";
import { sendWa } from "@/lib/wa";
import { logger } from "@/lib/logger";
import { withApiHandler } from "@/lib/api-error";

const supabase = getSupabaseAdminClient();

function buildCompanyName(fullName: string, gymName?: string | null) {
  if (gymName?.trim()) return gymName.trim();
  if (fullName.trim()) return `Espacio de ${fullName.trim()}`;
  return "Nuevo espacio FitGrowX";
}

function valueOrNull(value: string) {
  const trimmed = value.trim();
  return trimmed ? trimmed : null;
}

function generateRefCode(): string {
  return Math.random().toString(36).slice(2, 8).toUpperCase();
}

function getDaysUntil(value: string) {
  const diff = new Date(value).getTime() - Date.now();
  return Math.ceil(diff / (1000 * 60 * 60 * 24));
}

async function handlePost(req: NextRequest): Promise<NextResponse> {
  try {
    const authHeader = req.headers.get("authorization");
    const token = authHeader?.startsWith("Bearer ") ? authHeader.slice(7) : null;

    if (!token) {
      return NextResponse.json({ error: "Missing bearer token" }, { status: 401 });
    }

    const {
      fullName,
      whatsApp,
      refCode,
    }: { fullName?: string; whatsApp?: string; refCode?: string } = await req.json();

    const resellerSlug = req.cookies.get("fitgrowx_ref")?.value ?? null;

    const { data: authData, error: authError } = await supabase.auth.getUser(token);
    if (authError || !authData.user) {
      return NextResponse.json({ error: "No autorizado." }, { status: 401 });
    }

    const user = authData.user;
    const normalizedEmail = (user.email ?? "").trim().toLowerCase();
    const normalizedName = (fullName ?? "").trim();
    const normalizedPhone = (whatsApp ?? "").trim();

    if (!normalizedEmail) {
      return NextResponse.json({ error: "El usuario autenticado no tiene email válido." }, { status: 400 });
    }

    const [{ data: existingProfile }, { data: gymSettings }, { data: existingGym }, { data: existingAccount }] =
      await Promise.all([
        supabase
          .from("profiles")
          .select("id, gym_id, full_name, role")
          .eq("id", user.id)
          .maybeSingle(),
        supabase
          .from("gym_settings")
          .select("gym_id, gym_name, owner_name, whatsapp, email, slug")
          .eq("gym_id", user.id)
          .maybeSingle(),
        supabase
          .from("gyms")
          .select("id, name, gym_name, owner_name, whatsapp, email, trial_start_date, trial_expires_at, gym_status, plan_type, is_subscription_active")
          .eq("id", user.id)
          .maybeSingle(),
        supabase
          .from("platform_accounts")
          .select("id, status, trial_starts_at, trial_ends_at, converted_at, onboarding_stage, ref_code")
          .eq("auth_user_id", user.id)
          .maybeSingle(),
      ]);

    const companyName = buildCompanyName(
      normalizedName || existingProfile?.full_name || gymSettings?.owner_name || existingGym?.owner_name || "",
      gymSettings?.gym_name ?? existingGym?.gym_name ?? existingGym?.name ?? null,
    );

    if (existingProfile?.role === "platform_owner" || existingProfile?.role === "staff") {
      return NextResponse.json({ ok: true, skipped: existingProfile.role });
    }

    const { error: profileUpsertError } = await supabase.from("profiles").upsert(
      {
        id: user.id,
        gym_id: existingProfile?.gym_id ?? user.id,
        full_name: valueOrNull(normalizedName) ?? existingProfile?.full_name ?? null,
        role: existingProfile?.role ?? "admin",
      },
      { onConflict: "id" },
    );
    if (profileUpsertError) {
      void logger.error("db error upserting profile", { route: "/api/platform/sync-signup", meta: { profileUpsertError } });
      return NextResponse.json({ error: "Error interno. Intente nuevamente." }, { status: 500 });
    }

    const resolvedGymName = gymSettings?.gym_name ?? existingGym?.gym_name ?? existingGym?.name ?? companyName;
    const autoSlug = gymSettings?.slug
      ? gymSettings.slug
      : await generateUniqueSlug(supabase, resolvedGymName, user.id);

    const { error: gymSettingsUpsertError } = await supabase.from("gym_settings").upsert(
      {
        gym_id: user.id,
        gym_name: resolvedGymName,
        owner_name: valueOrNull(normalizedName) ?? gymSettings?.owner_name ?? existingGym?.owner_name ?? null,
        whatsapp: valueOrNull(normalizedPhone) ?? gymSettings?.whatsapp ?? existingGym?.whatsapp ?? null,
        email: valueOrNull(normalizedEmail) ?? gymSettings?.email ?? existingGym?.email ?? null,
        slug: autoSlug,
      },
      { onConflict: "gym_id" },
    );
    if (gymSettingsUpsertError) {
      void logger.error("db error upserting gym_settings", { route: "/api/platform/sync-signup", meta: { gymSettingsUpsertError } });
      return NextResponse.json({ error: "Error interno. Intente nuevamente." }, { status: 500 });
    }

    const now = new Date();
    const defaultTrialEnd = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000).toISOString();

    // Resolve reseller_id from slug if provided and gym doesn't have one yet
    let resellerId: string | null = null;
    let selfReferral = false;
    if (resellerSlug && !existingGym) {
      const { data: reseller } = await supabase
        .from("resellers")
        .select("id, user_id")
        .eq("slug", resellerSlug)
        .eq("status", "active")
        .maybeSingle();
      resellerId = reseller?.id ?? null;
      selfReferral = Boolean(reseller?.user_id && reseller.user_id === user.id);
      if (selfReferral) {
        console.warn(`sync-signup: self-referral detected for gym ${user.id} and reseller ${resellerId}`);
      }
    }

    const { error: gymUpsertError } = await supabase.from("gyms").upsert(
      {
        id: user.id,
        user_id: user.id,
        name: existingGym?.name ?? companyName,
        gym_name: existingGym?.gym_name ?? gymSettings?.gym_name ?? companyName,
        owner_name: valueOrNull(normalizedName) ?? existingGym?.owner_name ?? gymSettings?.owner_name ?? null,
        whatsapp: valueOrNull(normalizedPhone) ?? existingGym?.whatsapp ?? gymSettings?.whatsapp ?? null,
        email: valueOrNull(normalizedEmail) ?? existingGym?.email ?? gymSettings?.email ?? null,
        trial_start_date: existingGym?.trial_start_date ?? now.toISOString().slice(0, 10),
        trial_expires_at: existingGym?.trial_expires_at ?? defaultTrialEnd,
        gym_status: existingGym?.gym_status ?? "trial",
        plan_type: existingGym?.plan_type ?? "crecimiento",
        is_subscription_active: existingGym?.is_subscription_active ?? false,
        ...(resellerId ? { reseller_id: resellerId, self_referral: selfReferral } : {}),
      },
      { onConflict: "id" },
    );
    if (gymUpsertError) {
      void logger.error("db error upserting gym", { route: "/api/platform/sync-signup", meta: { gymUpsertError } });
      return NextResponse.json({ error: "Error interno. Intente nuevamente." }, { status: 500 });
    }

    // Sync company_name in CRM to match the resolved gym name (non-critical)
    const resolvedDisplayName = existingGym?.name ?? companyName;
    const { error: paSyncErr } = await supabase
      .from("platform_accounts")
      .update({ company_name: resolvedDisplayName })
      .eq("auth_user_id", user.id);
    if (paSyncErr) {
      void logger.error("company_name sync failed", { route: "/api/platform/sync-signup", meta: { paSyncErr } });
    }

    const { data: existingLead } = await supabase
      .from("platform_leads")
      .select("id")
      .eq("email", normalizedEmail)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    let platformLeadId = existingLead?.id ?? null;

    if (platformLeadId) {
      const { error: leadUpdateError } = await supabase
        .from("platform_leads")
        .update({
          full_name: valueOrNull(normalizedName),
          business_name: companyName,
          email: valueOrNull(normalizedEmail),
          phone: valueOrNull(normalizedPhone),
          source: "landing",
          status: "registered",
          last_contact_at: now.toISOString(),
        })
        .eq("id", platformLeadId);
      if (leadUpdateError) {
        void logger.error("db error updating lead", { route: "/api/platform/sync-signup", meta: { leadUpdateError } });
        return NextResponse.json({ error: "Error interno. Intente nuevamente." }, { status: 500 });
      }
    } else {
      const { data: insertedLead, error: leadError } = await supabase
        .from("platform_leads")
        .insert({
          full_name: valueOrNull(normalizedName),
          business_name: companyName,
          email: valueOrNull(normalizedEmail),
          phone: valueOrNull(normalizedPhone),
          source: "landing",
          status: "registered",
          last_contact_at: now.toISOString(),
        })
        .select("id")
        .single();

      if (leadError) {
        void logger.error("db error inserting lead", { route: "/api/platform/sync-signup", meta: { leadError } });
        return NextResponse.json({ error: "Error interno. Intente nuevamente." }, { status: 500 });
      }

      platformLeadId = insertedLead.id;
    }

    const trialStartsAt = existingAccount?.trial_starts_at ?? now.toISOString();
    const trialEndsAt = existingAccount?.trial_ends_at ?? defaultTrialEnd;

    const [
      { count: alumnosCount },
      { count: planesCount },
      { count: clasesCount },
      { count: prospectosCount },
    ] = await Promise.all([
      supabase.from("alumnos").select("id", { count: "exact", head: true }).eq("gym_id", user.id).eq("is_demo", false).is("deleted_at", null),
      supabase.from("planes").select("id", { count: "exact", head: true }).eq("gym_id", user.id),
      supabase.from("gym_classes").select("id", { count: "exact", head: true }).eq("gym_id", user.id),
      supabase.from("prospectos").select("id", { count: "exact", head: true }).eq("gym_id", user.id),
    ]);

    let activationScore = 0;
    if ((gymSettings?.gym_name ?? existingGym?.gym_name ?? existingGym?.name ?? "").trim()) activationScore += 20;
    if ((gymSettings?.whatsapp ?? existingGym?.whatsapp ?? "").trim()) activationScore += 10;
    if ((planesCount ?? 0) > 0) activationScore += 25;
    if ((clasesCount ?? 0) > 0) activationScore += 15;
    if ((alumnosCount ?? 0) > 0) activationScore += 20;
    if ((prospectosCount ?? 0) > 0) activationScore += 10;

    let lifecycleStatus: "trial_setup" | "trial_active" | "trial_risk" | "converted" | "churned" =
      existingAccount?.status ?? "trial_setup";

    if (!["converted", "churned"].includes(lifecycleStatus)) {
      const daysLeft = getDaysUntil(trialEndsAt);
      if (daysLeft <= 3 && activationScore < 60) {
        lifecycleStatus = "trial_risk";
      } else if (activationScore >= 40) {
        lifecycleStatus = "trial_active";
      } else {
        lifecycleStatus = "trial_setup";
      }
    }

    const { error: accountError } = await supabase
      .from("platform_accounts")
      .upsert(
        {
          auth_user_id: user.id,
          gym_id: user.id,
          platform_lead_id: platformLeadId,
          company_name: companyName,
          owner_name: valueOrNull(normalizedName) ?? existingProfile?.full_name ?? null,
          email: valueOrNull(normalizedEmail),
          phone: valueOrNull(normalizedPhone),
          source: "landing",
          status: lifecycleStatus,
          onboarding_stage: existingAccount?.onboarding_stage ?? "signup",
          trial_starts_at: trialStartsAt,
          trial_ends_at: trialEndsAt,
          next_follow_up_at: trialEndsAt,
          converted_at: existingAccount?.converted_at ?? null,
          activation_score: activationScore,
          last_seen_at: now.toISOString(),
          // Genera ref_code solo en el primer registro; no sobreescribir uno existente
          ...(existingAccount?.ref_code ? {} : { ref_code: generateRefCode() }),
          // Registra fecha de aceptación de T&C solo en el primer registro
          ...(!existingAccount ? { tc_accepted_at: now.toISOString() } : {}),
        },
        { onConflict: "auth_user_id" },
      );

    if (accountError) {
      void logger.error("db error upserting account", { route: "/api/platform/sync-signup", meta: { accountError } });
      return NextResponse.json({ error: "Error interno. Intente nuevamente." }, { status: 500 });
    }

    // Registrar referido: si vino con ?ref=, buscar el referente y crear la fila
    if (!existingAccount && refCode?.trim()) {
      (async () => {
        try {
          const { data: referrer } = await supabase
            .from("platform_accounts")
            .select("gym_id")
            .eq("ref_code", refCode.trim().toUpperCase())
            .maybeSingle();
          if (referrer?.gym_id) {
            await supabase
              .from("referrals")
              .upsert(
                {
                  referrer_gym_id: referrer.gym_id,
                  referred_gym_id: user.id,
                  referred_email:  normalizedEmail,
                  code:            refCode.trim().toUpperCase(),
                  status:          "registered",
                },
                { onConflict: "referred_gym_id", ignoreDuplicates: true },
              );
          }
        } catch { /* non-fatal */ }
      })();
    }

    if (!existingAccount) {
      // Mensaje de bienvenida WA desde el número de soporte (fire-and-forget)
      if (normalizedPhone) {
        (async () => {
          const { data: tplRow } = await supabase
            .from("platform_wa_templates")
            .select("body")
            .eq("key", "bienvenida")
            .maybeSingle();

          const nombre = normalizedName?.split(" ")[0] ?? companyName.split(" ")[0];
          const body = (tplRow?.body ?? "¡Hola {nombre}! 🎉 Bienvenido a FitGrowX. Cualquier duda, respondé este mensaje.")
            .replace(/\{nombre\}/gi, nombre);

          const digits = normalizedPhone.replace(/\D/g, "");
          const phone = digits.startsWith("549") ? digits : digits.startsWith("54") ? "549" + digits.slice(2) : "549" + digits;

          // sendWa retorna { ok: boolean, ... } — usar .ok, NO el objeto.
          const ok = await sendWa("fitgrowx-platform", phone, body, { route: "sync-signup/bienvenida" });
          if (ok.ok) {
            await supabase
              .from("platform_accounts")
              .update({ wa_bienvenida_sent_at: new Date().toISOString() })
              .eq("auth_user_id", user.id);
          }
        })();
      }
    }

    return NextResponse.json({ ok: true, platformLeadId });
  } catch (error) {
    void logger.error("sync-signup unhandled error", {
      route: "/api/platform/sync-signup",
      meta: { error: String(error) },
    });
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Unexpected sync error" },
      { status: 500 },
    );
  }
}

export const POST = withApiHandler(handlePost);
