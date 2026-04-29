import { NextRequest, NextResponse } from "next/server";
import { getSupabaseAdminClient } from "@/lib/supabase-admin";

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

function getDaysUntil(value: string) {
  const diff = new Date(value).getTime() - Date.now();
  return Math.ceil(diff / (1000 * 60 * 60 * 24));
}

export async function POST(req: NextRequest) {
  try {
    const authHeader = req.headers.get("authorization");
    const token = authHeader?.startsWith("Bearer ") ? authHeader.slice(7) : null;

    if (!token) {
      return NextResponse.json({ error: "Missing bearer token" }, { status: 401 });
    }

    const {
      fullName,
      whatsApp,
    }: { fullName?: string; whatsApp?: string } = await req.json();

    const { data: authData, error: authError } = await supabase.auth.getUser(token);
    if (authError || !authData.user) {
      return NextResponse.json({ error: authError?.message ?? "Unauthorized" }, { status: 401 });
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
          .select("gym_id, gym_name, owner_name, whatsapp, email")
          .eq("gym_id", user.id)
          .maybeSingle(),
        supabase
          .from("gyms")
          .select("id, name, gym_name, owner_name, whatsapp, email, trial_start_date, trial_expires_at, gym_status, plan_type, is_subscription_active")
          .eq("id", user.id)
          .maybeSingle(),
        supabase
          .from("platform_accounts")
          .select("id, status, trial_starts_at, trial_ends_at, converted_at, onboarding_stage")
          .eq("auth_user_id", user.id)
          .maybeSingle(),
      ]);

    const companyName = buildCompanyName(
      normalizedName || existingProfile?.full_name || gymSettings?.owner_name || existingGym?.owner_name || "",
      gymSettings?.gym_name ?? existingGym?.gym_name ?? existingGym?.name ?? null,
    );

    if (existingProfile?.role === "platform_owner") {
      return NextResponse.json({ ok: true, skipped: "platform_owner" });
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
      return NextResponse.json({ error: profileUpsertError.message }, { status: 500 });
    }

    const { error: gymSettingsUpsertError } = await supabase.from("gym_settings").upsert(
      {
        gym_id: user.id,
        gym_name: gymSettings?.gym_name ?? existingGym?.gym_name ?? existingGym?.name ?? companyName,
        owner_name: valueOrNull(normalizedName) ?? gymSettings?.owner_name ?? existingGym?.owner_name ?? null,
        whatsapp: valueOrNull(normalizedPhone) ?? gymSettings?.whatsapp ?? existingGym?.whatsapp ?? null,
        email: valueOrNull(normalizedEmail) ?? gymSettings?.email ?? existingGym?.email ?? null,
      },
      { onConflict: "gym_id" },
    );
    if (gymSettingsUpsertError) {
      return NextResponse.json({ error: gymSettingsUpsertError.message }, { status: 500 });
    }

    const now = new Date();
    const defaultTrialEnd = new Date(now.getTime() + 15 * 24 * 60 * 60 * 1000).toISOString();

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
        plan_type: existingGym?.plan_type ?? null,
        is_subscription_active: existingGym?.is_subscription_active ?? false,
      },
      { onConflict: "id" },
    );
    if (gymUpsertError) {
      return NextResponse.json({ error: gymUpsertError.message }, { status: 500 });
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
        return NextResponse.json({ error: leadUpdateError.message }, { status: 500 });
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
        return NextResponse.json({ error: leadError.message }, { status: 500 });
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
      supabase.from("alumnos").select("id", { count: "exact", head: true }).eq("gym_id", user.id),
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
        },
        { onConflict: "auth_user_id" },
      );

    if (accountError) {
      return NextResponse.json({ error: accountError.message }, { status: 500 });
    }

    return NextResponse.json({ ok: true, platformLeadId });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Unexpected sync error" },
      { status: 500 },
    );
  }
}
