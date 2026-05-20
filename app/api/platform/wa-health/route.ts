import { NextRequest, NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase-server";
import { getWaHealthMetrics } from "@/lib/wa-dashboard";

export async function GET(req: NextRequest) {
  try {
    const sb = await createSupabaseServerClient();
    const { data: { user } } = await sb.auth.getUser();

    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    // Verify platform_owner role
    const { data: profile } = await sb
      .from("profiles")
      .select("role")
      .eq("id", user.id)
      .maybeSingle();

    if (profile?.role !== "platform_owner") {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const metrics = await getWaHealthMetrics(sb);
    return NextResponse.json(metrics);
  } catch (err) {
    console.error("[WA Health API]", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
