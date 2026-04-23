"use client";

import { useState } from "react";
import { ArrowUpRight, MessageCircleMore } from "lucide-react";

const whatsappBaseUrl = "https://wa.me/5491111111111";

export default function HomeLeadForm() {
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");

  const handleSubmit = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    const message = [
      "Hola, quiero agendar mi clase gratis.",
      `Nombre: ${name || "No indicado"}`,
      `WhatsApp: ${phone || "No indicado"}`,
    ].join("\n");

    const url = `${whatsappBaseUrl}?text=${encodeURIComponent(message)}`;
    window.open(url, "_blank", "noopener,noreferrer");
  };

  return (
    <form
      onSubmit={handleSubmit}
      className="rounded-[1.9rem] border border-black/8 bg-[#111111] p-6 text-white shadow-[0_24px_70px_rgba(15,23,42,0.14)]"
    >
      <div className="flex items-center justify-between gap-4 border-b border-white/8 pb-5">
        <div>
          <p className="text-xs uppercase tracking-[0.24em] text-white/38">
            CTA principal
          </p>
          <h3 className="mt-2 text-2xl font-semibold tracking-[-0.03em] text-white">
            Reservá tu lugar
          </h3>
        </div>
        <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-[#f06418]/16 text-[#ff9c63]">
          <MessageCircleMore className="h-5 w-5" />
        </div>
      </div>

      <p className="mt-5 text-sm leading-7 text-white/54">
        Dejanos tus datos y te escribimos por WhatsApp para coordinar tu
        primera visita sin vueltas.
      </p>

      <div className="mt-6 grid gap-4">
        <label className="grid gap-2">
          <span className="text-sm font-medium text-white/72">Nombre</span>
          <input
            type="text"
            name="name"
            value={name}
            onChange={(event) => setName(event.target.value)}
            placeholder="Ej. Sofía Pérez"
            className="h-14 rounded-2xl border border-white/10 bg-white/[0.06] px-4 text-white outline-none transition placeholder:text-white/24 focus:border-[#f06418]/60"
            required
          />
        </label>

        <label className="grid gap-2">
          <span className="text-sm font-medium text-white/72">WhatsApp</span>
          <input
            type="tel"
            name="phone"
            value={phone}
            onChange={(event) => setPhone(event.target.value)}
            placeholder="+54 9 11 5555 5555"
            className="h-14 rounded-2xl border border-white/10 bg-white/[0.06] px-4 text-white outline-none transition placeholder:text-white/24 focus:border-[#f06418]/60"
            required
          />
        </label>
      </div>

      <button
        type="submit"
        className="mt-6 inline-flex w-full items-center justify-center gap-2 rounded-full bg-[#f06418] px-6 py-3.5 text-sm font-semibold text-white transition hover:translate-y-[-1px]"
      >
        Quiero mi clase gratis
        <ArrowUpRight className="h-4 w-4" />
      </button>

      <p className="mt-4 text-sm leading-7 text-white/38">
        Más de 240 personas entrenando hoy. La respuesta llega por WhatsApp.
      </p>
    </form>
  );
}
