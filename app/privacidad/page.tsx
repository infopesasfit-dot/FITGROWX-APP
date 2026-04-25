import Link from "next/link";
import { LandingHeader } from "@/components/landing-header";

export const metadata = {
  title: "Política de Privacidad — FitGrowX",
  description: "Política de privacidad y tratamiento de datos personales de FitGrowX, conforme a la Ley 25.326.",
};

export default function PrivacidadPage() {
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
            Política de Privacidad
          </h1>
          <p className="mt-4 text-sm text-white/38">
            Última actualización: abril de 2025 · Cumplimiento Ley N.° 25.326 de Protección de Datos Personales
          </p>
        </div>

        <div className="space-y-10 text-[15px] leading-relaxed text-white/65">

          {/* 1 */}
          <section>
            <h2 className="mb-3 text-base font-semibold text-white">1. Responsable del tratamiento</h2>
            <p>
              El responsable del archivo de datos personales es{" "}
              <strong className="text-white/80">FitGrowX</strong>, CUIT{" "}
              <strong className="text-white/80">27-39517020-7</strong>, con domicilio en la República Argentina.
              Para consultas relacionadas con el tratamiento de sus datos personales puede contactarnos a través
              del correo electrónico disponible en la plataforma.
            </p>
            <p className="mt-3">
              La base de datos de FitGrowX se encuentra registrada ante la{" "}
              <strong className="text-white/80">Dirección Nacional de Protección de Datos Personales (DNPDP)</strong>,
              conforme a lo requerido por la Ley N.° 25.326 y sus normas reglamentarias.
            </p>
          </section>

          {/* 2 */}
          <section>
            <h2 className="mb-3 text-base font-semibold text-white">2. Datos que recopilamos</h2>
            <p>Recopilamos los siguientes datos personales según el rol del usuario:</p>

            <div className="mt-4 space-y-4">
              <div
                className="rounded-xl p-4"
                style={{ background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.06)" }}
              >
                <p className="mb-2 text-[12px] font-bold uppercase tracking-wider text-[#FF8040]">Establecimientos (Gimnasios / Boxes)</p>
                <ul className="list-none space-y-1.5 text-sm">
                  {["Nombre completo del titular y del establecimiento", "CUIT / CUIL", "Correo electrónico y número de WhatsApp", "Datos de facturación y suscripción (gestionados por Mercado Pago)"].map(item => (
                    <li key={item} className="flex gap-2">
                      <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-[#FF6A00]/60" />
                      <span>{item}</span>
                    </li>
                  ))}
                </ul>
              </div>

              <div
                className="rounded-xl p-4"
                style={{ background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.06)" }}
              >
                <p className="mb-2 text-[12px] font-bold uppercase tracking-wider text-[#60A5FA]">Alumnos / Socios</p>
                <ul className="list-none space-y-1.5 text-sm">
                  {["Nombre completo", "Número de contacto (WhatsApp)", "Fecha de inscripción y estado de membresía", "Registro de asistencia (presentismo)", "Historial de pagos y vencimientos", "Datos de progreso físico (peso, medidas) cuando el alumno los carga voluntariamente"].map(item => (
                    <li key={item} className="flex gap-2">
                      <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-[#60A5FA]/60" />
                      <span>{item}</span>
                    </li>
                  ))}
                </ul>
              </div>
            </div>
          </section>

          {/* 3 */}
          <section>
            <h2 className="mb-3 text-base font-semibold text-white">3. Finalidad del tratamiento</h2>
            <p>Los datos personales son utilizados exclusivamente para:</p>
            <ul className="mt-3 list-none space-y-2.5">
              {[
                "Gestionar la relación contractual con el Establecimiento (facturación, soporte, comunicaciones operativas).",
                "Permitir al Establecimiento administrar su gymansio: control de asistencia, cobro de membresías, gestión de alumnos y prospectos.",
                "Facilitar la comunicación entre el Establecimiento y sus alumnos a través de WhatsApp.",
                "Registrar y mostrar el progreso físico del alumno, únicamente al propio alumno y al personal autorizado del Establecimiento.",
                "Enviar recordatorios de vencimiento de membresía y notificaciones operativas.",
                "Mejorar el funcionamiento y la seguridad de la plataforma.",
              ].map((item) => (
                <li key={item} className="flex gap-3">
                  <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-[#FF6A00]" />
                  <span>{item}</span>
                </li>
              ))}
            </ul>
            <p className="mt-4">
              FitGrowX <strong className="text-white/80">no vende, no cede ni comercializa</strong> datos personales a
              terceros. Los datos no serán utilizados con fines publicitarios propios o de terceros sin consentimiento
              expreso del titular.
            </p>
          </section>

          {/* 4 */}
          <section>
            <h2 className="mb-3 text-base font-semibold text-white">4. Datos de pago</h2>
            <p>
              FitGrowX <strong className="text-white/80">no almacena ni procesa datos de tarjetas de crédito, débito
              o cualquier instrumento de pago</strong>. Todas las transacciones son procesadas directamente por{" "}
              <strong className="text-white/80">Mercado Pago S.R.L.</strong>, quien actúa como responsable exclusivo
              del tratamiento de dicha información. FitGrowX únicamente recibe confirmación del estado de la
              transacción (aprobada / rechazada / pendiente).
            </p>
          </section>

          {/* 5 */}
          <section>
            <h2 className="mb-3 text-base font-semibold text-white">5. Plazo de conservación</h2>
            <p>
              Los datos personales se conservan mientras la cuenta del Establecimiento esté activa. Una vez
              solicitada la baja, los datos serán eliminados en un plazo máximo de{" "}
              <strong className="text-white/80">30 días hábiles</strong>, salvo que exista una obligación legal de
              conservarlos por mayor tiempo (por ejemplo, datos de facturación exigidos por AFIP).
            </p>
          </section>

          {/* 6 */}
          <section>
            <h2 className="mb-3 text-base font-semibold text-white">6. Derechos del titular — Acceso, Rectificación, Supresión y Oposición</h2>
            <p>
              Conforme a los artículos 14 a 19 de la{" "}
              <strong className="text-white/80">Ley N.° 25.326</strong>, todo titular de datos personales tiene
              derecho a:
            </p>
            <ul className="mt-3 list-none space-y-2.5">
              {[
                "Acceder gratuitamente a sus datos personales almacenados en la plataforma.",
                "Rectificar datos inexactos, desactualizados o incompletos.",
                "Solicitar la supresión (eliminación) de su cuenta y los datos asociados.",
                "Oponerse al tratamiento de sus datos en los casos previstos por la ley.",
              ].map((item) => (
                <li key={item} className="flex gap-3">
                  <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-[#FF6A00]" />
                  <span>{item}</span>
                </li>
              ))}
            </ul>

            <div
              className="mt-5 rounded-xl p-5"
              style={{ background: "rgba(255,106,0,0.06)", border: "1px solid rgba(255,106,0,0.15)" }}
            >
              <p className="text-sm font-semibold text-white mb-1">¿Cómo solicitar la eliminación de tu cuenta?</p>
              <p className="text-sm text-white/60">
                Podés solicitar la baja y eliminación de tus datos desde el panel de administración en{" "}
                <strong className="text-white/80">Ajustes → Cuenta → Eliminar cuenta</strong>, o enviando un
                correo electrónico a la dirección de soporte indicada en la plataforma. Tu solicitud será
                procesada dentro de los 5 días hábiles siguientes.
              </p>
            </div>

            <p className="mt-4 text-sm">
              La DNPDP, Órgano de Control de la Ley N.° 25.326, tiene la atribución de atender las denuncias y
              reclamos que se interpongan con relación al incumplimiento de las normas sobre protección de datos
              personales. Sitio web:{" "}
              <span className="text-[#FF8040]">www.argentina.gob.ar/aaip/datospersonales</span>
            </p>
          </section>

          {/* 7 */}
          <section>
            <h2 className="mb-3 text-base font-semibold text-white">7. Seguridad de la información</h2>
            <p>
              FitGrowX implementa medidas técnicas y organizativas para proteger los datos personales contra
              accesos no autorizados, pérdida, alteración o divulgación. Los datos se almacenan en servidores
              con cifrado en tránsito (TLS) y en reposo. El acceso a los datos de producción está restringido
              al personal estrictamente necesario.
            </p>
          </section>

          {/* 8 */}
          <section>
            <h2 className="mb-3 text-base font-semibold text-white">8. Cookies y datos de navegación</h2>
            <p>
              La plataforma puede utilizar cookies de sesión estrictamente necesarias para el funcionamiento del
              sistema (autenticación, preferencias de idioma). No se utilizan cookies de rastreo publicitario de
              terceros. El Usuario puede configurar su navegador para rechazar cookies, aunque esto puede afectar
              el funcionamiento de la plataforma.
            </p>
          </section>

          {/* 9 */}
          <section>
            <h2 className="mb-3 text-base font-semibold text-white">9. Modificaciones a esta política</h2>
            <p>
              FitGrowX podrá actualizar esta Política de Privacidad para reflejar cambios en la legislación o en
              el funcionamiento del servicio. Los cambios significativos serán notificados por correo electrónico
              con al menos 15 días de anticipación. La versión vigente estará siempre disponible en{" "}
              <span className="text-[#FF8040]">fitgrowx.com/privacidad</span>.
            </p>
          </section>

          {/* 10 */}
          <section>
            <h2 className="mb-3 text-base font-semibold text-white">10. Ley aplicable y jurisdicción</h2>
            <p>
              Esta Política se rige por la{" "}
              <strong className="text-white/80">Ley N.° 25.326 de Protección de Datos Personales</strong> y su
              decreto reglamentario N.° 1558/01, y demás normativa aplicable de la República Argentina.
              Cualquier controversia será sometida a la jurisdicción de los{" "}
              <strong className="text-white/80">Tribunales Ordinarios de la Ciudad Autónoma de Buenos Aires</strong>.
            </p>
          </section>

        </div>

        {/* Footer links */}
        <div className="mt-16 flex flex-wrap gap-4 border-t border-white/[0.06] pt-8 text-[12px] text-white/28">
          <Link href="/" className="hover:text-white/60 transition-colors">← Volver al inicio</Link>
          <span className="text-white/10">·</span>
          <Link href="/terminos" className="hover:text-white/60 transition-colors">Términos y Condiciones</Link>
        </div>
      </div>
    </main>
  );
}
