"use client";

import { useState } from "react";
import { ArrowUpRight, MessageCircleMore } from "lucide-react";

const whatsappBaseUrl = "https://wa.me/5491111111111";

export default function LeadCaptureForm() {
  const [name, setName] = useState("");
  const [gymName, setGymName] = useState("");
  const [phone, setPhone] = useState("");
  const [message, setMessage] = useState(
    "Quiero ver una demo de FitGrowX y entender como aplicar WhatsApp Automation + la Boveda en mi gimnasio.",
  );

  const handleSubmit = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    const fullMessage = [
      "Hola FitGrowX, quiero agendar una demo.",
      `Nombre: ${name || "No indicado"}`,
      `Gimnasio: ${gymName || "No indicado"}`,
      `Telefono: ${phone || "No indicado"}`,
      `Contexto: ${message || "Sin mensaje adicional"}`,
    ].join("\n");

    const url = `${whatsappBaseUrl}?text=${encodeURIComponent(fullMessage)}`;
    window.open(url, "_blank", "noopener,noreferrer");
  };

  return (
    <form
      onSubmit={handleSubmit}
      className="rounded-[2rem] border border-white/10 bg-[linear-gradient(180deg,rgba(255,255,255,0.06),rgba(255,255,255,0.03))] p-6 shadow-[0_25px_120px_rgba(0,0,0,0.35)] backdrop-blur-2xl sm:p-8"
    >
      <div className="flex items-center justify-between gap-4 border-b border-white/8 pb-5">
        <div>
          <p className="text-xs uppercase tracking-[0.26em] text-white/38">
            Solicitar demo
          </p>
          <h3 className="mt-2 text-2xl font-semibold tracking-[-0.03em] text-white">
            Hablemos de tu gimnasio
          </h3>
        </div>
        <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-[#ff6b00]/14 text-[#ff8a3d]">
          <MessageCircleMore className="h-5 w-5" />
        </div>
      </div>

      <div className="mt-6 grid gap-5">
        <label className="grid gap-2">
          <span className="text-sm font-medium text-white/74">Tu nombre</span>
          <input
            type="text"
            name="name"
            value={name}
            onChange={(event) => setName(event.target.value)}
            placeholder="Ej. Martin Lopez"
            className="h-14 rounded-2xl border border-white/10 bg-black/35 px-4 text-white outline-none transition placeholder:text-white/28 focus:border-[#ff6b00]/60"
            required
          />
        </label>

        <label className="grid gap-2">
          <span className="text-sm font-medium text-white/74">
            Nombre del gimnasio
          </span>
          <input
            type="text"
            name="gymName"
            value={gymName}
            onChange={(event) => setGymName(event.target.value)}
            placeholder="Ej. Active Lab"
            className="h-14 rounded-2xl border border-white/10 bg-black/35 px-4 text-white outline-none transition placeholder:text-white/28 focus:border-[#ff6b00]/60"
            required
          />
        </label>

        <label className="grid gap-2">
          <span className="text-sm font-medium text-white/74">
            WhatsApp o telefono
          </span>
          <input
            type="tel"
            name="phone"
            value={phone}
            onChange={(event) => setPhone(event.target.value)}
            placeholder="+54 9 11 5555 5555"
            className="h-14 rounded-2xl border border-white/10 bg-black/35 px-4 text-white outline-none transition placeholder:text-white/28 focus:border-[#ff6b00]/60"
            required
          />
        </label>

        <label className="grid gap-2">
          <span className="text-sm font-medium text-white/74">
            Que quieres resolver primero
          </span>
          <textarea
            name="message"
            value={message}
            onChange={(event) => setMessage(event.target.value)}
            rows={5}
            placeholder="Cuéntanos si tu foco principal es cobros, automatizacion, control o crecimiento."
            className="rounded-[1.5rem] border border-white/10 bg-black/35 px-4 py-4 text-white outline-none transition placeholder:text-white/28 focus:border-[#ff6b00]/60"
            required
          />
        </label>
      </div>

      <button
        type="submit"
        className="mt-6 inline-flex w-full items-center justify-center gap-2 rounded-full bg-[linear-gradient(135deg,#ff6b00,#ffa25f)] px-6 py-3.5 text-sm font-semibold text-black transition hover:scale-[1.01]"
      >
        Abrir WhatsApp con mi solicitud
        <ArrowUpRight className="h-4 w-4" />
      </button>

      <p className="mt-4 text-sm leading-7 text-white/42">
        Al enviar, abrimos una conversacion de WhatsApp con los datos de tu
        solicitud para acelerar la respuesta comercial.
      </p>
    </form>
  );
}
