import { NextRequest, NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase-server";
import { assertPlatformOwner } from "@/lib/auth-platform";
import { getWaHealthMetrics } from "@/lib/wa-dashboard";

export async function GET(req: NextRequest) {
  try {
    if (!await assertPlatformOwner()) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const sb = await createSupabaseServerClient();
    const metrics = await getWaHealthMetrics(sb);
    return NextResponse.json(metrics);
  } catch (err) {
    console.error("[WA Health API]", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
