import { NextResponse } from "next/server";
import { getSupabaseAdminClient } from "@/lib/supabase-admin";
import { assertPlatformOwner } from "@/lib/auth-platform";

const sb = getSupabaseAdminClient();

export async function GET() {
  if (!await assertPlatformOwner()) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  // 1. All platform accounts
  const { data: accounts, error: accErr } = await sb
    .from("platform_accounts")
    .select("id,company_name,owner_name,phone,email,status,subscription_plan,monthly_value,trial_starts_at,trial_ends_at,converted_at,activation_score,last_contact_at,last_seen_at,tc_accepted_at,auth_user_id")
    .order("trial_ends_at", { ascending: false, nullsFirst: false });
  if (accErr) return NextResponse.json({ error: accErr.message }, { status: 500 });

  const authUserIds = (accounts ?? []).map((a) => a.auth_user_id).filter(Boolean) as string[];
  if (!authUserIds.length) return NextResponse.json({ gyms: [], total: 0 });

  // 2. Profiles → gym_id
  const { data: profiles } = await sb
    .from("profiles")
    .select("id,gym_id")
    .in("id", authUserIds);

  const profileMap = new Map((profiles ?? []).map((p: { id: string; gym_id: string | null }) => [p.id, p.gym_id]));
  const gymIds = [...new Set((profiles ?? []).map((p: { gym_id: string | null }) => p.gym_id).filter(Boolean))] as string[];

  // 3. Gyms
  const { data: gyms } = gymIds.length
    ? await sb.from("gyms").select("id,plan_type,gym_status,is_subscription_active,trial_expires_at,subscription_type,subscription_expires_at").in("id", gymIds)
    : { data: [] };
  const gymMap = new Map((gyms ?? []).map((g: { id: string }) => [g.id, g]));

  // 4. Gym settings
  const { data: settings } = gymIds.length
    ? await sb.from("gym_settings").select("gym_id,gym_name,whatsapp,wa_status,slug").in("gym_id", gymIds)
    : { data: [] };
  const settingsMap = new Map((settings ?? []).map((s: { gym_id: string }) => [s.gym_id, s]));

  // 5. Active member counts per gym
  const { data: memberCounts } = gymIds.length
    ? await sb.from("alumnos").select("gym_id").in("gym_id", gymIds).is("deleted_at", null).eq("status", "activo")
    : { data: [] };
  const memberCountMap = new Map<string, number>();
  for (const row of memberCounts ?? []) {
    const r = row as { gym_id: string };
    memberCountMap.set(r.gym_id, (memberCountMap.get(r.gym_id) ?? 0) + 1);
  }

  // 6. Last validated payment per gym
  const { data: lastPayments } = gymIds.length
    ? await sb.from("pagos").select("gym_id,date").in("gym_id", gymIds).eq("status", "validado").order("date", { ascending: false })
    : { data: [] };
  const lastPaymentMap = new Map<string, string>();
  for (const row of lastPayments ?? []) {
    const r = row as { gym_id: string; date: string };
    if (!lastPaymentMap.has(r.gym_id)) lastPaymentMap.set(r.gym_id, r.date);
  }

  // 7. Merge
  const result = (accounts ?? []).map((acc) => {
    const gymId = profileMap.get(acc.auth_user_id ?? "") ?? null;
    const gym = gymId ? (gymMap.get(gymId) ?? null) : null;
    const gs = gymId ? (settingsMap.get(gymId) ?? null) : null;
    return {
      id:                     acc.id,
      company_name:           acc.company_name,
      owner_name:             acc.owner_name,
      phone:                  acc.phone,
      email:                  acc.email,
      crm_status:             acc.status,
      subscription_plan:      acc.subscription_plan,
      monthly_value:          acc.monthly_value,
      trial_starts_at:        acc.trial_starts_at,
      trial_ends_at:          acc.trial_ends_at,
      converted_at:           acc.converted_at,
      activation_score:       acc.activation_score,
      last_contact_at:        acc.last_contact_at,
      last_seen_at:           acc.last_seen_at,
      tc_accepted_at:         acc.tc_accepted_at,
      auth_user_id:           acc.auth_user_id,
      gym_id:                 gymId,
      plan_type:              (gym as { plan_type?: string } | null)?.plan_type ?? null,
      gym_status:             (gym as { gym_status?: string } | null)?.gym_status ?? null,
      is_subscription_active: (gym as { is_subscription_active?: boolean } | null)?.is_subscription_active ?? null,
      trial_expires_at:       (gym as { trial_expires_at?: string } | null)?.trial_expires_at ?? null,
      subscription_type:      (gym as { subscription_type?: string } | null)?.subscription_type ?? null,
      subscription_expires_at:(gym as { subscription_expires_at?: string } | null)?.subscription_expires_at ?? null,
      gym_name:               (gs as { gym_name?: string } | null)?.gym_name ?? null,
      whatsapp:               (gs as { whatsapp?: string } | null)?.whatsapp ?? null,
      wa_status:              (gs as { wa_status?: string } | null)?.wa_status ?? null,
      slug:                   (gs as { slug?: string } | null)?.slug ?? null,
      active_members:         gymId ? (memberCountMap.get(gymId) ?? 0) : 0,
      last_payment:           gymId ? (lastPaymentMap.get(gymId) ?? null) : null,
    };
  });

  return NextResponse.json({ gyms: result, total: result.length });
}
