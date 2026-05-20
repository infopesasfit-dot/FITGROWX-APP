"use client";

import { useEffect, useState } from "react";
import type { WaHealthMetrics } from "@/lib/wa-dashboard";

export function WaHealthDashboard() {
  const [metrics, setMetrics] = useState<WaHealthMetrics | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchMetrics = async () => {
      try {
        const res = await fetch("/api/platform/wa-health");
        if (res.ok) {
          setMetrics(await res.json());
        }
      } catch {
        // Silently fail
      } finally {
        setLoading(false);
      }
    };

    fetchMetrics();
    const interval = setInterval(fetchMetrics, 30000); // Refresh every 30s
    return () => clearInterval(interval);
  }, []);

  if (loading) return <div className="p-4 text-gray-500">Cargando WhatsApp health...</div>;
  if (!metrics) return null;

  const statusColor = {
    connected: "bg-green-100 text-green-800",
    limited: "bg-yellow-100 text-yellow-800",
    blocked: "bg-red-100 text-red-800",
  };

  const statusLabel = {
    connected: "🟢 CONECTADO",
    limited: "🟡 LIMITADO",
    blocked: "🔴 BLOQUEADO",
  };

  return (
    <div className="bg-white rounded-lg border border-gray-200 p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-semibold">WhatsApp Motor Health</h3>
        <span className={`px-3 py-1 rounded-full text-sm font-medium ${statusColor[metrics.status]}`}>
          {statusLabel[metrics.status]}
        </span>
      </div>

      {/* Metrics Grid */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
        <div className="bg-gray-50 p-4 rounded">
          <div className="text-gray-600 text-sm">Enviados</div>
          <div className="text-2xl font-bold">{metrics.last24h.sent}</div>
        </div>
        <div className="bg-red-50 p-4 rounded">
          <div className="text-gray-600 text-sm">Bloqueados</div>
          <div className="text-2xl font-bold text-red-600">{metrics.last24h.blocked}</div>
          <div className="text-xs text-red-600">{metrics.last24h.blockRatio.toFixed(2)}%</div>
        </div>
        <div className="bg-orange-50 p-4 rounded">
          <div className="text-gray-600 text-sm">Bounces</div>
          <div className="text-2xl font-bold text-orange-600">{metrics.last24h.bounces}</div>
        </div>
        <div className="bg-gray-50 p-4 rounded">
          <div className="text-gray-600 text-sm">Fallos</div>
          <div className="text-2xl font-bold">{metrics.last24h.failed}</div>
        </div>
        <div className="bg-blue-50 p-4 rounded">
          <div className="text-gray-600 text-sm">Latencia</div>
          <div className="text-2xl font-bold text-blue-600">{metrics.last24h.avgLatency}ms</div>
        </div>
      </div>

      {/* Alerts */}
      {metrics.alerts.length > 0 && (
        <div className="space-y-2 border-t pt-4">
          <h4 className="font-semibold text-sm">🚨 Alertas</h4>
          {metrics.alerts.map((alert, i) => (
            <div
              key={i}
              className={`p-3 rounded text-sm ${
                alert.level === "critical"
                  ? "bg-red-100 text-red-800 border border-red-300"
                  : "bg-yellow-100 text-yellow-800 border border-yellow-300"
              }`}
            >
              {alert.message}
            </div>
          ))}
        </div>
      )}

      {/* Recent Events */}
      {metrics.recentEvents.length > 0 && (
        <div className="border-t pt-4 space-y-2">
          <h4 className="font-semibold text-sm">📋 Últimos Eventos (24h)</h4>
          <div className="space-y-2 max-h-64 overflow-y-auto">
            {metrics.recentEvents.map((event) => (
              <div key={event.id} className="text-sm p-2 bg-gray-50 rounded flex justify-between">
                <div>
                  <span className="font-medium">
                    {event.type === "block_detected" && "❌ Bloqueado"}
                    {event.type === "invalid_phone" && "⚠️ Número inválido"}
                    {event.type === "rate_limited" && "🚫 Rate limit"}
                    {event.type === "delivery_failed" && "📨 Error envío"}
                  </span>
                  {event.reason && <span className="text-gray-600 ml-2">({event.reason})</span>}
                  <div className="text-xs text-gray-500">...{event.phone}</div>
                </div>
                <span className="text-xs text-gray-500">
                  {new Date(event.createdAt).toLocaleTimeString()}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
