import {
  BookOpen,
  ClipboardList,
  Download,
  MonitorSmartphone,
  PlayCircle,
  TrendingUp,
  Users,
  type LucideIcon,
} from "lucide-react";

export type VaultCategory = {
  slug: string;
  title: string;
  description: string;
  badge: string;
  icon: LucideIcon;
};

export type VaultResource = {
  slug: string;
  category: string;
  title: string;
  description: string;
  tags: string[];
  cta: string;
  format: string;
  readTime: string;
  objective: string;
  outcome: string;
  icon: LucideIcon;
  intro: string;
  steps: string[];
  bullets: string[];
};

export const vaultCategories: VaultCategory[] = [
  {
    slug: "ventas-captacion",
    title: "Ventas y captación",
    description: "Scripts, campañas, ofertas y procesos para convertir más leads en alumnos.",
    badge: "Alta demanda",
    icon: TrendingUp,
  },
  {
    slug: "operacion-gimnasio",
    title: "Operación del gimnasio",
    description: "Checklists, SOPs y guías prácticas para ordenar el día a día del negocio.",
    badge: "Base operativa",
    icon: ClipboardList,
  },
  {
    slug: "experiencia-alumno",
    title: "Experiencia del alumno",
    description: "Material para mejorar onboarding, retención, seguimiento y comunidad.",
    badge: "Retención",
    icon: Users,
  },
  {
    slug: "tutoriales-fitgrowx",
    title: "Tutoriales FitGrowX",
    description: "Guías para usar mejor la plataforma en alumnos, clases, membresías y automatizaciones.",
    badge: "Biblioteca",
    icon: MonitorSmartphone,
  },
];

export const vaultResources: VaultResource[] = [
  {
    slug: "onboarding-nuevos-alumnos-box",
    category: "experiencia-alumno",
    title: "Onboarding de nuevos alumnos para box y gimnasio",
    description:
      "Tutorial simple para recibir alumnos nuevos, activar asistencia y marcar seguimiento durante los primeros 7 días.",
    tags: ["video", "retención", "proceso"],
    cta: "Ver guía",
    format: "Tutorial operativo",
    readTime: "8 min",
    objective: "Que cada alumno nuevo entienda qué hacer, se sienta acompañado y vuelva durante su primera semana.",
    outcome: "Más asistencia en los primeros 7 días y menos abandono después de la clase de prueba.",
    icon: PlayCircle,
    intro:
      "Cuando un gimnasio pierde alumnos en la primera semana, casi siempre no es por entrenamiento: es por falta de claridad, seguimiento y experiencia. Este tutorial te deja una secuencia simple para resolverlo.",
    steps: [
      "Recibí al alumno con nombre, recorrida corta del espacio y una explicación de cómo funciona el sistema de clases o turnos.",
      "Asigná un coach responsable del primer seguimiento. No hace falta una reunión larga: basta con que exista un referente claro.",
      "Enviá un mensaje dentro de las primeras 2 horas con bienvenida, horario recomendado y próximo paso concreto.",
      "Chequeá asistencia en 48 horas. Si no volvió, activá un mensaje de reenganche corto y personalizado.",
      "Al día 7, pedí feedback y ofrecé la mejor opción de continuidad según objetivo, frecuencia y presupuesto.",
    ],
    bullets: [
      "Mensaje recomendado: 'Hola, Juan. Hoy te vimos muy bien en tu primera clase. Te recomiendo volver el miércoles a las 19:00 para sostener ritmo y adaptación.'",
      "Métrica a mirar: porcentaje de alumnos nuevos que vuelven al menos 2 veces en su primera semana.",
      "Error común: dejar todo el seguimiento al azar o esperar a que el alumno escriba primero.",
    ],
  },
  {
    slug: "campanas-clase-gratis-fitness",
    category: "ventas-captacion",
    title: "Plantilla de campaña para clase gratis",
    description:
      "Estructura base para anuncios, WhatsApp y seguimiento de prospectos interesados en probar el gimnasio.",
    tags: ["marketing", "ads", "captación"],
    cta: "Abrir recurso",
    format: "Playbook comercial",
    readTime: "6 min",
    objective: "Convertir leads fríos en visitas reales con una oferta simple y un seguimiento sin fricción.",
    outcome: "Más reservas a clase de prueba y menor tiempo de respuesta comercial.",
    icon: BookOpen,
    intro:
      "La mayoría de las campañas fallan por exceso de información. En fitness, suele funcionar mejor una oferta clara, prueba simple y respuesta rápida por WhatsApp.",
    steps: [
      "Usá un mensaje principal con beneficio directo: prueba gratis, evaluación inicial o semana de adaptación.",
      "En la creatividad, mostrà personas reales entrenando y evitá sobrecargar con demasiados textos.",
      "Respondé cada lead en menos de 5 minutos si es posible, con solo dos opciones horarias para reducir fricción.",
      "Confirmá asistencia el mismo día con un mensaje corto y humano.",
      "Si el lead no asiste, reactivá en 24 horas con una nueva invitación concreta.",
    ],
    bullets: [
      "Copy sugerido: 'Probá tu primera clase gratis y conocé cómo entrenamos en FitGrowX.'",
      "Canal ideal para cierre: WhatsApp con respuesta humana o semi automatizada.",
      "Error común: pedir demasiados datos antes de confirmar la visita.",
    ],
  },
  {
    slug: "checklist-operativo-mensual-gym",
    category: "operacion-gimnasio",
    title: "Checklist operativo mensual del gimnasio",
    description:
      "Documento guía para revisar cobros, clases, staff, limpieza, equipamiento y experiencia del cliente.",
    tags: ["archivo", "operación", "descarga"],
    cta: "Descargar",
    format: "Checklist de control",
    readTime: "5 min",
    objective: "Tener una revisión mensual simple para detectar fugas operativas antes de que afecten al negocio.",
    outcome: "Más orden interno y menos errores repetidos en administración y servicio.",
    icon: Download,
    intro:
      "La operación de un gimnasio se rompe en pequeños detalles. Una revisión mensual corta suele evitar problemas de cobro, asistencia, mantenimiento y servicio.",
    steps: [
      "Revisá pagos vencidos, rechazos y alumnos que no renovaron.",
      "Chequeá asistencia promedio por clase y horarios con baja ocupación.",
      "Auditá limpieza, mantenimiento y estado del equipamiento principal.",
      "Confirmá horarios, descansos y responsabilidades del staff.",
      "Anotá tres mejoras para el siguiente mes con responsable asignado.",
    ],
    bullets: [
      "Frecuencia ideal: una vez por mes, siempre el mismo día.",
      "Responsable sugerido: dueño o encargado operativo.",
      "Error común: revisar todo solo cuando ya hubo quejas o baja de alumnos.",
    ],
  },
  {
    slug: "script-whatsapp-clase-prueba",
    category: "ventas-captacion",
    title: "Script de WhatsApp para cerrar una clase de prueba",
    description:
      "Guion corto para responder rápido, detectar interés real y convertir consultas en visitas agendadas.",
    tags: ["whatsapp", "ventas", "conversión"],
    cta: "Abrir recurso",
    format: "Script comercial",
    readTime: "4 min",
    objective: "Reducir la fricción en la conversación comercial y aumentar la tasa de reservas efectivas.",
    outcome: "Más visitas confirmadas y menos leads perdidos por demoras o mensajes largos.",
    icon: TrendingUp,
    intro:
      "En fitness, muchas ventas se pierden por respuestas lentas o mensajes demasiado cargados. Este script busca que el prospecto avance rápido hacia una visita concreta.",
    steps: [
      "Respondé con saludo corto, nombre del espacio y una pregunta simple sobre objetivo o disponibilidad.",
      "Ofrecé dos horarios cerrados en vez de preguntar '¿cuándo puedes?'.",
      "Aclarà qué incluye la prueba: clase, recorrido o evaluación breve.",
      "Pedí confirmación con nombre y horario elegido, sin pedir información innecesaria.",
      "Enviá recordatorio el mismo día con ubicación y qué traer.",
    ],
    bullets: [
      "Mensaje base: 'Hola, soy Ana de FitGrowX. ¿Buscas bajar grasa, ganar fuerza o volver a entrenar?'",
      "Mientras menos fricción tenga la reserva, mayor será la asistencia real.",
      "No intentes vender el plan completo antes de lograr la visita.",
    ],
  },
  {
    slug: "oferta-planes-sin-descuentar-demasiado",
    category: "ventas-captacion",
    title: "Cómo vender planes sin regalar demasiado descuento",
    description:
      "Guía para presentar valor, frecuencia y acompañamiento sin caer en promociones que destruyen margen.",
    tags: ["pricing", "ventas", "margen"],
    cta: "Ver guía",
    format: "Guía comercial",
    readTime: "7 min",
    objective: "Mejorar cierres mostrando valor real antes de entrar en negociación de precio.",
    outcome: "Mayor ticket promedio y menos dependencia de descuentos agresivos.",
    icon: BookOpen,
    intro:
      "Cuando todo se vende con descuento, el cliente aprende a comparar solo precio. Esta guía ayuda a estructurar la conversación alrededor del resultado, la experiencia y la frecuencia ideal.",
    steps: [
      "Preguntá objetivo, experiencia previa y cuántos días reales puede entrenar.",
      "Recomendá el plan adecuado primero por adherencia, no por precio.",
      "Explicá qué incluye el servicio: seguimiento, comunidad, coaches, estructura o acceso.",
      "Si hace falta incentivo, ofrecé un beneficio acotado en vez de bajar fuerte el valor mensual.",
      "Cerrá con una próxima acción concreta y fecha de inicio.",
    ],
    bullets: [
      "Beneficios útiles: matrícula bonificada, evaluación inicial o kit de bienvenida.",
      "Descuento sin contexto suele atraer clientes menos comprometidos.",
      "El mejor argumento comercial en fitness suele ser claridad y acompañamiento.",
    ],
  },
  {
    slug: "reunion-semanal-staff-fitness",
    category: "operacion-gimnasio",
    title: "Reunión semanal de staff en 20 minutos",
    description:
      "Formato breve para alinear coaches, recepción y operación sin cortar demasiado tiempo del día.",
    tags: ["staff", "operación", "equipo"],
    cta: "Abrir recurso",
    format: "Ritual operativo",
    readTime: "5 min",
    objective: "Tener una reunión corta, útil y repetible que ordene prioridades y responsables.",
    outcome: "Menos desorden interno, mejor coordinación y más claridad sobre qué corregir esa semana.",
    icon: ClipboardList,
    intro:
      "Las reuniones largas cansan al equipo. Una reunión semanal breve y bien estructurada suele ser suficiente para mejorar ejecución, servicio y comunicación interna.",
    steps: [
      "Empezá con tres números: asistencia, ventas nuevas y bajas.",
      "Detectá un problema principal de operación y un responsable claro.",
      "Revisá próximos eventos, horarios sensibles o ausencias del staff.",
      "Definí una mejora para experiencia del alumno durante esa semana.",
      "Cerrá con resumen de tareas y fecha de próxima revisión.",
    ],
    bullets: [
      "Duración recomendada: 15 a 20 minutos máximo.",
      "Si no hay responsable por acción, la reunión no produce cambio.",
      "Conviene hacerla siempre el mismo día y horario.",
    ],
  },
  {
    slug: "seguimiento-ausentes-7-dias",
    category: "experiencia-alumno",
    title: "Seguimiento de alumnos ausentes por 7 días",
    description:
      "Secuencia simple para detectar inactividad, reactivar conversaciones y recuperar asistencia antes de que llegue la baja.",
    tags: ["retención", "seguimiento", "ausentes"],
    cta: "Ver guía",
    format: "Protocolo de retención",
    readTime: "6 min",
    objective: "Evitar que un alumno desaparezca sin contacto ni seguimiento.",
    outcome: "Más recuperaciones tempranas y mejor percepción de acompañamiento.",
    icon: Users,
    intro:
      "Cuando un alumno deja de venir, cada día sin contacto reduce la probabilidad de retorno. Este protocolo está pensado para activar seguimiento rápido sin sonar invasivo.",
    steps: [
      "Marcá automáticamente a quien no asiste durante 7 días corridos.",
      "Enviá un mensaje humano y corto preguntando cómo está y ofreciendo ayuda.",
      "Si responde, proponé un regreso concreto con día y horario sugerido.",
      "Si no responde, reenviá un segundo toque dos días después con tono cercano.",
      "Si sigue ausente, derivá el caso a un coach o encargado para contacto más personal.",
    ],
    bullets: [
      "Mensaje sugerido: 'Hola, te extrañamos por acá. ¿Todo bien? Si quieres, te recomiendo volver esta semana en este horario.'",
      "No uses mensajes culpabilizantes ni demasiado automáticos.",
      "La clave es intervenir antes de que el alumno ya decida irse.",
    ],
  },
  {
    slug: "reducir-bajas-primeros-30-dias",
    category: "experiencia-alumno",
    title: "Cómo reducir bajas durante los primeros 30 días",
    description:
      "Playbook para sostener motivación, asistencia y relación con alumnos nuevos en su primer mes.",
    tags: ["onboarding", "retención", "primer mes"],
    cta: "Abrir recurso",
    format: "Playbook de retención",
    readTime: "9 min",
    objective: "Aumentar la permanencia inicial mediante un acompañamiento más estructurado.",
    outcome: "Mejor retención en el primer mes y más alumnos que llegan a su segunda renovación.",
    icon: PlayCircle,
    intro:
      "El primer mes define la continuidad. Si el alumno no entiende el sistema, no genera hábito o no siente vínculo con el espacio, la baja llega muy rápido.",
    steps: [
      "Definí una meta simple con el alumno durante la primera semana.",
      "Programá al menos dos puntos de contacto antes del día 15.",
      "Mostrá progreso visible: técnica, asistencia, energía o confianza.",
      "Invitalo a una clase o bloque donde pueda integrarse con otras personas.",
      "Al día 25, revisá continuidad y planteá la renovación sin esperar al vencimiento.",
    ],
    bullets: [
      "En el primer mes importa más la adherencia que el resultado físico.",
      "La sensación de acompañamiento pesa tanto como el entrenamiento.",
      "Un alumno nuevo que nadie nombra ni sigue es un alumno en riesgo.",
    ],
  },
  {
    slug: "configurar-membresias-y-vencimientos",
    category: "tutoriales-fitgrowx",
    title: "Cómo configurar membresías y vencimientos en FitGrowX",
    description:
      "Tutorial para dejar listas las membresías, el precio, la duración y el control de vencimientos dentro de la plataforma.",
    tags: ["membresías", "vencimientos", "configuración"],
    cta: "Abrir tutorial",
    format: "Tutorial de plataforma",
    readTime: "7 min",
    objective: "Configurar correctamente las membresías para cobrar con orden y evitar confusiones con renovaciones.",
    outcome: "Más claridad administrativa y mejor control de altas, renovaciones y estados de alumnos.",
    icon: MonitorSmartphone,
    intro:
      "Las membresías son una de las bases operativas del sistema. Si están bien configuradas, todo el flujo de alumnos, cobros y vencimientos se vuelve mucho más simple.",
    steps: [
      "Definí qué tipos de planes vas a vender: libre, por cantidad de clases o duración fija.",
      "Configurá nombre, precio, vigencia y cualquier condición especial de cada membresía.",
      "Revisá cómo se asigna la membresía al alumno desde el módulo de alumnos.",
      "Chequeá cómo impactan los vencimientos y qué estado toma el alumno cuando la membresía termina.",
      "Hacé una prueba rápida con un alumno de ejemplo para validar que todo el flujo quede claro.",
    ],
    bullets: [
      "Conviene empezar con pocos planes bien definidos antes de agregar variantes.",
      "Si el nombre del plan es confuso, también se vuelve confuso para el staff.",
      "Revisar vencimientos desde el inicio evita mucho trabajo manual más adelante.",
    ],
  },
  {
    slug: "organizar-clases-y-reservas-fitgrowx",
    category: "tutoriales-fitgrowx",
    title: "Cómo organizar clases y reservas en FitGrowX",
    description:
      "Guía práctica para crear clases, definir cupos y ordenar el flujo de reservas desde el sistema.",
    tags: ["clases", "reservas", "cupos"],
    cta: "Ver guía",
    format: "Tutorial de operación",
    readTime: "6 min",
    objective: "Dejar el calendario ordenado y fácil de usar tanto para el staff como para los alumnos.",
    outcome: "Menos desorden con horarios, mejor control de cupos y una experiencia más clara de reserva.",
    icon: MonitorSmartphone,
    intro:
      "Cuando las clases están bien estructuradas en el sistema, la operación diaria mejora muchísimo. Esta guía está pensada para ordenar horarios, cupos y reservas sin fricción.",
    steps: [
      "Cargá cada clase con nombre claro, horario, coach y capacidad máxima.",
      "Definí qué clases requieren reserva previa y cuáles no.",
      "Revisá que el cupo refleje la capacidad real del espacio y del staff disponible.",
      "Probá una reserva desde la vista del alumno para entender la experiencia completa.",
      "Ajustá horarios o cupos según demanda real de asistencia durante la semana.",
    ],
    bullets: [
      "Nombres simples como 'Cross 7AM' o 'Funcional 18:00' evitan errores.",
      "Un cupo mal configurado suele generar frustración o sobreventa.",
      "Conviene revisar asistencia y ocupación después de los primeros días de uso.",
    ],
  },
  {
    slug: "automatizaciones-y-panel-alumno-fitgrowx",
    category: "tutoriales-fitgrowx",
    title: "Automatizaciones y panel del alumno: por dónde empezar",
    description:
      "Recorrido inicial para activar mensajes, seguimiento y el panel del alumno sin complicar la operación.",
    tags: ["automatizaciones", "panel alumno", "setup"],
    cta: "Abrir tutorial",
    format: "Tutorial de onboarding",
    readTime: "8 min",
    objective: "Aprovechar funciones clave de FitGrowX desde el inicio sin depender de procesos manuales.",
    outcome: "Más orden en seguimiento, mejor experiencia para el alumno y menos tareas repetitivas para el equipo.",
    icon: BookOpen,
    intro:
      "FitGrowX no es solo gestión básica: también te permite automatizar tareas y darle más autonomía al alumno. Esta guía te ayuda a activar lo más importante primero.",
    steps: [
      "Revisá primero qué datos del alumno están completos para que el panel funcione bien.",
      "Activá automatizaciones simples antes de ir a flujos más complejos: recordatorios, seguimiento o mensajes base.",
      "Probá el acceso del alumno para validar qué ve en su panel y qué acciones puede hacer.",
      "Confirmá que clases, reservas y estado del alumno estén sincronizados con la experiencia final.",
      "Documentá internamente qué procesos quedan automáticos y cuáles siguen siendo manuales.",
    ],
    bullets: [
      "Empezar simple acelera adopción y reduce errores del equipo.",
      "El panel del alumno tiene más valor cuando la información cargada es consistente.",
      "Las automatizaciones sirven más cuando acompañan la operación, no cuando la reemplazan mal.",
    ],
  },
];

export function getVaultCategory(slug: string) {
  return vaultCategories.find((category) => category.slug === slug);
}

export function getVaultResource(slug: string) {
  return vaultResources.find((resource) => resource.slug === slug);
}

export function getResourcesByCategory(slug: string) {
  return vaultResources.filter((resource) => resource.category === slug);
}
