export type GuideSection = {
  id: string;
  eyebrow: string;
  title: string;
  intro: string;
  bullets: string[];
  tip?: string;
};

export const GUIDE_SECTIONS: GuideSection[] = [
  {
    id: "que-es-fitgrowx",
    eyebrow: "Introducción",
    title: "Qué hace FitGrowX por el gym",
    intro:
      "FitGrowX automatiza por WhatsApp gran parte del recorrido del cliente para captar más alumnos, retener mejor y ordenar la operación del gimnasio desde un solo sistema.",
    bullets: [
      "Hace seguimiento automático por WhatsApp para captar nuevos prospectos, responderles y moverlos hasta la inscripción.",
      "Ayuda a retener alumnos con flujos automáticos, seguimiento y control del estado de cada cliente.",
      "Separa la experiencia del dueño, del staff y del alumno para que cada uno vea solo lo que necesita.",
    ],
    tip: "No es solo un panel para mirar cosas: es un sistema que trabaja por vos mientras ordena cobros, alumnos, clases y seguimiento.",
  },
  {
    id: "perfil-negocio",
    eyebrow: "Paso 1",
    title: "El dueño tiene su panel y su espacio privado",
    intro:
      "El panel del dueño está pensado para manejar el negocio completo sin mezclar su información sensible con la operación diaria del staff.",
    bullets: [
      "Puede guardar configuraciones importantes solo para él, sin exponerlas al equipo.",
      "Desde ahí conecta WhatsApp, Mercado Pago, Google Ads y Facebook Ads.",
      "También puede ver ingresos, egresos, prospectos y el estado general del negocio.",
    ],
    tip: "La idea es que el dueño tenga control total del negocio, pero sin tener que hacer él cada tarea operativa.",
  },
  {
    id: "membresias-cobros",
    eyebrow: "Paso 2",
    title: "Cobros, membresías e ingresos ordenados",
    intro:
      "FitGrowX deja armado el lado comercial del gym para que cobrar no dependa de acordarse ni de perseguir alumnos a mano.",
    bullets: [
      "Cada membresía se configura con precio, duración, vencimiento y estado.",
      "El sistema automatiza mensajes por WhatsApp para acompañar el cobro y la continuidad del alumno.",
      "El dueño además puede registrar ingresos y egresos para tener una visión más clara del negocio.",
    ],
    tip: "Cuando cobro, membresía y seguimiento están conectados, la tasa de retención sube porque el sistema no deja caer conversaciones importantes.",
  },
  {
    id: "alumnos-operacion",
    eyebrow: "Paso 3",
    title: "El staff opera el día a día del gym",
    intro:
      "El staff tiene su propio acceso para operar recepción, alumnos, clases y horarios sin tocar la parte sensible del dueño.",
    bullets: [
      "Puede usar el scanner con varios métodos: QR del alumno, QR fijo en el gym y check-in manual por DNI.",
      "Desde alumnos puede asignar rutinas generadas por IA y dar seguimiento básico.",
      "También administra clases y horarios para ordenar la experiencia diaria del gimnasio.",
    ],
    tip: "La recepción deja de depender de memoria, papeles o mensajes sueltos: cada acción queda dentro del sistema.",
  },
  {
    id: "whatsapp-automatizaciones",
    eyebrow: "Paso 4",
    title: "WhatsApp automatiza el recorrido del cliente",
    intro:
      "La diferencia fuerte de FitGrowX es que no solo avisa cosas: automatiza gran parte del recorrido comercial y de retención por WhatsApp.",
    bullets: [
      "Puede captar, responder, hacer seguimiento y empujar conversiones de nuevos prospectos.",
      "También acompaña al alumno actual con recordatorios, continuidad y mensajes que mejoran la retención.",
      "Todo eso corre en segundo plano para que el negocio siga avanzando aunque el dueño no esté encima.",
    ],
    tip: "El objetivo no es mandar mensajes por mandar: es automatizar momentos clave para vender más y perder menos alumnos.",
  },
  {
    id: "landing-leads",
    eyebrow: "Paso 5",
    title: "Landing, prospectos y campañas conectadas",
    intro:
      "El dueño puede crear su propia landing y conectarla a un panel de prospectos para hacer seguimiento real de cada oportunidad.",
    bullets: [
      "Cada lead entra al sistema y queda visible para seguimiento comercial.",
      "La landing se conecta con la automatización por WhatsApp para no dejar consultas sin mover.",
      "Además puede sumar Google Ads y Facebook Ads para atraer tráfico y medir mejor el crecimiento.",
    ],
    tip: "La landing no vive sola: funciona mejor cuando está unida a prospectos, anuncios y automatización.",
  },
  {
    id: "equipo-rutina",
    eyebrow: "Paso 6",
    title: "El alumno también tiene su propia app",
    intro:
      "FitGrowX no termina en el dueño o en el staff. El alumno también vive su experiencia desde una app propia.",
    bullets: [
      "Desde ahí puede hacer check-in, anotarse a clases y ver su rutina.",
      "También registra sus marcas y puede seguir metas que va alcanzando dentro del gym.",
      "Y para cerrar la experiencia física, entregamos una caja de bienvenida con porta QR y NFC para automatizar la entrada.",
    ],
    tip: "La idea final es simple: que el negocio se vea profesional, que el staff trabaje mejor y que el alumno sienta una experiencia moderna de punta a punta.",
  },
];

export const FAQ_ITEMS = [
  {
    question: "¿Por dónde conviene empezar a configurar FitGrowX?",
    answer:
      "Primero el panel del dueño y sus conexiones, después membresías y cobros, luego staff, alumnos y clases, y recién ahí landing, prospectos y automatizaciones. Ese orden hace que todo quede mejor conectado.",
  },
  {
    question: "¿Qué puede hacer el staff dentro de FitGrowX?",
    answer:
      "El staff opera recepción, scanner QR, check-in por DNI, alumnos, clases y horarios. También puede asignar rutinas generadas por IA, sin tocar configuraciones sensibles del dueño.",
  },
  {
    question: "¿El alumno también tiene su propia app?",
    answer:
      "Sí. El alumno puede hacer check-in, ver la rutina que le asignó el coach o el staff, anotar sus marcas, seguir metas y anotarse a clases desde su propia app.",
  },
  {
    question: "¿La automatización por WhatsApp solo avisa vencimientos?",
    answer:
      "No. Esa es solo una parte. FitGrowX usa WhatsApp para captar nuevos contactos, responder, hacer seguimiento comercial y también trabajar la retención de los alumnos actuales.",
  },
  {
    question: "¿La landing queda conectada con los prospectos?",
    answer:
      "Sí. La landing alimenta un panel de prospectos donde el dueño puede hacer seguimiento, y además puede conectarla con Google Ads y Facebook Ads para potenciar captación.",
  },
  {
    question: "¿Cómo es la experiencia física en el ingreso al gym?",
    answer:
      "Entregamos una caja de bienvenida con porta QR y NFC para que el dueño automatice la entrada y le dé al gimnasio una experiencia más prolija desde el primer contacto.",
  },
  {
    question: "¿Las automatizaciones reemplazan al equipo?",
    answer:
      "No. Lo que hacen es sacar trabajo repetitivo, acelerar el seguimiento y dejar al equipo más libre para atención, ventas y acompañamiento real.",
  },
];
