import Link from "next/link";
import Image from "next/image";
import { LandingHeader } from "@/components/landing-header";

export const metadata = {
  title: "Términos y Condiciones — FitGrowX",
  description: "Términos y condiciones de uso de la plataforma FitGrowX.",
};

export default function TerminosPage() {
  return (
    <main className="min-h-screen bg-[#050505] text-white antialiased font-sans">
      <LandingHeader actionType="link" actionLabel="Prueba gratis" actionHref="/start" />

      <div className="mx-auto max-w-3xl px-6 py-20 lg:px-8 lg:py-28">

        {/* Header */}
        <div className="mb-12 border-b border-white/[0.06] pb-10">
          <p className="mb-3 text-[10px] font-bold uppercase tracking-[0.26em] text-[#FF6A00]">
            Documento legal
          </p>
          <h1 className="text-3xl font-semibold tracking-tight sm:text-4xl">
            Términos y Condiciones
          </h1>
          <p className="mt-4 text-sm text-white/38">
            Última actualización: abril de 2025 · Vigente desde la fecha de publicación
          </p>
        </div>

        <div className="space-y-10 text-[15px] leading-relaxed text-white/65">

          {/* 1 */}
          <section>
            <h2 className="mb-3 text-base font-semibold text-white">1. Identificación del prestador</h2>
            <p>
              FitGrowX es una plataforma de software como servicio (SaaS) operada por{" "}
              <strong className="text-white/80">FitGrowX</strong>, CUIT{" "}
              <strong className="text-white/80">27-39517020-7</strong>, con domicilio en la República Argentina.
              Todo contacto puede canalizarse a través del correo electrónico indicado en la plataforma.
            </p>
          </section>

          {/* 2 */}
          <section>
            <h2 className="mb-3 text-base font-semibold text-white">2. Naturaleza del servicio — Plataforma intermediaria</h2>
            <p>
              FitGrowX actúa exclusivamente como <strong className="text-white/80">intermediario tecnológico</strong> entre
              el gimnasio o box (en adelante, "el Establecimiento") y sus alumnos o socios (en adelante, "los Usuarios").
              FitGrowX <strong className="text-white/80">no presta servicios de actividad física</strong>, no es empleador
              de instructores, ni tiene control operativo sobre las instalaciones de los Establecimientos.
            </p>
            <p className="mt-3">
              El Establecimiento es el único responsable de la prestación del servicio de entrenamiento, del estado de sus
              instalaciones, del equipo utilizado y de la capacitación de su personal.
            </p>
          </section>

          {/* 3 */}
          <section>
            <h2 className="mb-3 text-base font-semibold text-white">3. Procesamiento de pagos — Mercado Pago</h2>
            <p>
              Los pagos realizados a través de la plataforma son procesados íntegramente por{" "}
              <strong className="text-white/80">Mercado Pago S.R.L.</strong>, entidad regulada por el Banco Central de la
              República Argentina. FitGrowX{" "}
              <strong className="text-white/80">no almacena, no procesa ni tiene acceso a los datos de tarjetas de crédito,
              débito o cualquier otro instrumento de pago</strong> ingresados por el Usuario. Toda la información
              financiera es gestionada de forma exclusiva por Mercado Pago bajo sus propias políticas de seguridad y
              privacidad, las cuales el Usuario puede consultar en{" "}
              <span className="text-[#FF8040]">mercadopago.com.ar</span>.
            </p>
          </section>

          {/* 4 */}
          <section>
            <h2 className="mb-3 text-base font-semibold text-white">4. Registro y acceso</h2>
            <p>
              Para utilizar la plataforma, el Establecimiento debe registrarse con datos verídicos y mantenerlos
              actualizados. El acceso es personal e intransferible. El usuario es responsable de la confidencialidad de sus
              credenciales y de cualquier actividad que se realice bajo su cuenta.
            </p>
          </section>

          {/* 5 */}
          <section>
            <h2 className="mb-3 text-base font-semibold text-white">5. Planes, facturación y cancelación</h2>
            <ul className="list-none space-y-2.5">
              <li className="flex gap-3">
                <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-[#FF6A00]" />
                <span>Los planes de suscripción se facturan mensualmente de forma anticipada en pesos argentinos (ARS), conforme a los precios vigentes al momento de la renovación.</span>
              </li>
              <li className="flex gap-3">
                <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-[#FF6A00]" />
                <span>El período de prueba gratuita (cuando aplique) no requiere tarjeta de crédito y expira automáticamente al finalizar el plazo indicado.</span>
              </li>
              <li className="flex gap-3">
                <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-[#FF6A00]" />
                <span><strong className="text-white/80">Cancelación:</strong> el Establecimiento puede cancelar su suscripción en cualquier momento desde el panel de administración. La cancelación tendrá efecto al término del período ya abonado, sin reintegros proporcionales por los días no utilizados, salvo disposición legal en contrario.</span>
              </li>
              <li className="flex gap-3">
                <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-[#FF6A00]" />
                <span>FitGrowX se reserva el derecho de modificar los precios con un preaviso mínimo de 30 días corridos, notificado por correo electrónico al titular de la cuenta.</span>
              </li>
            </ul>
          </section>

          {/* 6 */}
          <section>
            <h2 className="mb-3 text-base font-semibold text-white">6. Salud física y responsabilidad del alumno</h2>
            <p>
              FitGrowX, en su carácter de plataforma tecnológica, <strong className="text-white/80">no asume ninguna
              responsabilidad</strong> respecto de lesiones, accidentes, problemas de salud o daños físicos que pudieran
              sufrir los alumnos o terceros durante la práctica de actividades físicas en los Establecimientos.
            </p>
            <p className="mt-3">
              Es responsabilidad exclusiva del Establecimiento:
            </p>
            <ul className="mt-2.5 list-none space-y-2">
              <li className="flex gap-3">
                <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-white/20" />
                <span>Exigir a sus alumnos la presentación de apto médico cuando lo considere necesario.</span>
              </li>
              <li className="flex gap-3">
                <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-white/20" />
                <span>Contar con seguros de accidentes personales según la normativa vigente.</span>
              </li>
              <li className="flex gap-3">
                <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-white/20" />
                <span>Informar a sus alumnos de los riesgos inherentes a la actividad física practicada.</span>
              </li>
            </ul>
          </section>

          {/* 7 */}
          <section>
            <h2 className="mb-3 text-base font-semibold text-white">7. Propiedad intelectual</h2>
            <p>
              Todo el software, diseño, marca, logotipos y contenidos de la plataforma FitGrowX son propiedad exclusiva
              del prestador o de sus licenciantes. Queda prohibida su reproducción, distribución o uso comercial sin
              autorización expresa y por escrito.
            </p>
          </section>

          {/* 8 */}
          <section>
            <h2 className="mb-3 text-base font-semibold text-white">8. Limitación de responsabilidad</h2>
            <p>
              En la máxima medida permitida por la legislación argentina aplicable, FitGrowX no será responsable por
              daños indirectos, incidentales, especiales o consecuentes derivados del uso o la imposibilidad de uso de la
              plataforma. La responsabilidad total de FitGrowX frente a un Establecimiento no podrá superar el monto
              abonado por dicho Establecimiento durante los tres (3) meses anteriores al evento generador del daño.
            </p>
          </section>

          {/* 9 */}
          <section>
            <h2 className="mb-3 text-base font-semibold text-white">9. Modificaciones</h2>
            <p>
              FitGrowX podrá modificar estos Términos y Condiciones en cualquier momento. Los cambios serán notificados
              con al menos 15 días de anticipación por correo electrónico. El uso continuado de la plataforma luego de
              dicho plazo implicará la aceptación tácita de las modificaciones.
            </p>
          </section>

          {/* 10 */}
          <section>
            <h2 className="mb-3 text-base font-semibold text-white">10. Jurisdicción y ley aplicable</h2>
            <p>
              Estos Términos y Condiciones se rigen por las leyes de la{" "}
              <strong className="text-white/80">República Argentina</strong>. Ante cualquier controversia o reclamo, las
              partes se someten a la jurisdicción exclusiva de los{" "}
              <strong className="text-white/80">Tribunales Ordinarios de la Ciudad Autónoma de Buenos Aires</strong>,
              renunciando expresamente a cualquier otro fuero o jurisdicción que pudiere corresponderles.
            </p>
          </section>

        </div>

        {/* Footer links */}
        <div className="mt-16 flex flex-wrap gap-4 border-t border-white/[0.06] pt-8 text-[12px] text-white/28">
          <Link href="/" className="hover:text-white/60 transition-colors">← Volver al inicio</Link>
          <span className="text-white/10">·</span>
          <Link href="/privacidad" className="hover:text-white/60 transition-colors">Política de Privacidad</Link>
        </div>
      </div>
    </main>
  );
}
