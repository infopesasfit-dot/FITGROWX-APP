import "fake-indexeddb/auto";

// Env vars disponibles para todos los tests
process.env.NEXT_PUBLIC_SUPABASE_URL  = "https://test.supabase.co";
process.env.SUPABASE_SERVICE_ROLE_KEY = "test-service-role-key";
process.env.NEXT_PUBLIC_APP_URL       = "https://fitgrowx.com";
process.env.MP_WEBHOOK_SECRET         = "test-webhook-secret";
process.env.MP_ACCESS_TOKEN           = "test-mp-token";
