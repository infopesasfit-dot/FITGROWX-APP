# **Análisis Arquitectónico y Optimización del Motor de WhatsApp para FitGrowX en Railway**

La integración de mensajería automatizada de WhatsApp en plataformas de software como servicio (SaaS) multi-inquilino exige un diseño de infraestructura robusto que garantice la alta disponibilidad, la resiliencia ante fallos de conexión y la mitigación de bloqueos de números telefónicos. En el contexto de FitGrowX, una plataforma orientada a la gestión de gimnasios, la comunicación oportuna de alertas de acceso, confirmaciones de reservas y recordatorios de pago es un factor crítico para el éxito del modelo de negocio.  
El presente reporte analiza de manera exhaustiva la arquitectura actual de FitGrowX, la cual implementa un motor Node.js basado en la biblioteca no oficial Baileys alojado en Railway, interactuando con una base de datos Supabase. A lo largo del documento, se diagnostican las fallas recurrentes del sistema, se proponen mejoras de ingeniería de software para optimizar el flujo de mensajería y se realiza una evaluación estratégica entre el uso del protocolo web inverso de Baileys y la API oficial de Meta en la nube.

## **Diagnóstico de la Infraestructura de Mensajería Actual**

La arquitectura de mensajería de FitGrowX se estructura en torno a una única instancia de Node.js que se ejecuta en la plataforma de nube Railway. Esta instancia única asume la responsabilidad de gestionar múltiples sockets de conexión WebSocket independientes mediante la biblioteca Baileys, asignando un canal de comunicación exclusivo para cada gimnasio cliente.

\+---------------------------------------------------------------------------------+  
|                               Railway Container                                 |  
|                                                                                 |  
|   \+-----------------------+                    \+----------------------------+   |  
|   |   Node.js VM Engine   |                    | Ephemeral File System      |   |  
|   |                       |                    |                            |   |  
|   |  | \<================\> |  /wa\_auth/gym\_A/creds.json |   |  
|   |  | \<================\> |  /wa\_auth/gym\_B/creds.json |   |  
|   \+-----------------------+                    \+----------------------------+   |  
|               ^                                              |                  |  
|               | (Restores auth states)                       | (Wiped during    |  
|               |                                              |  Redeployments)  |  
|               v                                              v                  |  
|                                   |  
|    \- Table: wa\_mensajes                            \- Requires Manual QR Scan    |  
\+---------------------------------------------------------------------------------+

### **Dinámica del Flujo de Mensajes y Almacenamiento Efímero**

El flujo de trabajo operativo de la mensajería se inicia cuando FitGrowX registra y encola un mensaje dentro de la tabla wa\_mensajes de Supabase, asignando inicialmente un valor nulo al campo de control temporal (sent\_at \= NULL). La sincronización y el vaciado de esta cola de salida se delegan a un proceso de tipo cron, configurado bajo la ruta de acceso /api/cron/wa-queue-flush, el cual realiza peticiones de lectura a la base de datos de manera sistemática a intervalos rígidos de un minuto.  
Al identificar registros pendientes, el motor de mensajería extrae la información y los distribuye a través del socket de Baileys que corresponda al identificador único del gimnasio (gymId). Una vez enviado el paquete de red, el motor actualiza de inmediato el registro en Supabase con la marca de tiempo exacta de salida en sent\_at, el estado resultante (sent, blocked o failed) y la métrica de latencia en milisegundos (latency\_ms).  
El talón de Aquiles de esta implementación radica en el almacenamiento físico de las credenciales de sesión. Cada gimnasio genera un estado de autenticación a través del escaneo de un código QR generado dinámicamente en la ruta /qr/:gymId, el cual se escribe en el sistema de archivos local en el directorio /wa\_auth/:gymId. Estas credenciales tienen un período de validez de aproximadamente dos a tres meses antes de expirar de forma natural, momento en el cual el sistema actualiza el estado del gimnasio en la base de datos a needs\_reauth.  
En la infraestructura de contenedores de Railway, el sistema de archivos local es estrictamente efímero por diseño.1 Esto genera un comportamiento operativo altamente inestable:

* **Reinicios del Proceso Interno:** Si el proceso Node.js se reinicia de manera interna pero el contenedor de Railway permanece activo, el sistema de archivos temporal se conserva y el motor logra reconectar los sockets de manera transparente.1  
* **Redespliegues de la Aplicación:** Cada vez que el código de FitGrowX se actualiza, o cuando Railway migra el contenedor de nodo por mantenimiento de infraestructura, el sistema destruye por completo el contenedor anterior y aprovisiona una máquina limpia.1 Esto borra la totalidad de los datos escritos fuera de un volumen persistente, eliminando los archivos /wa\_auth/:gymId/creds.json de todos los clientes.2 En consecuencia, cada reinicio del contenedor obliga a los administradores de los gimnasios a escanear nuevamente un código QR en un entorno de producción, degradando gravemente la experiencia de usuario.

### **Persistencia Correcta en Railway**

Para que los datos de autenticación de los gimnasios sobrevivan a los ciclos de vida de Railway, el sistema requiere la implementación inmediata de un volumen persistente de red.1 En Railway, los volúmenes se montan en el contenedor únicamente al momento de inicio del proceso de ejecución y no en la fase de construcción de la imagen.3 Dado que la estructura del sistema de compilación de Railway sitúa el código de la aplicación dentro del directorio raíz /app, cualquier ruta relativa debe ser mapeada de forma absoluta incluyendo dicho prefijo.3 Por lo tanto, el volumen persistente debe ser configurado y enlazado directamente a la ruta absoluta /app/wa\_auth para asegurar la persistencia cruzada de los archivos de autenticación.3  
No obstante, una mejor práctica arquitectónica para plataformas de software como servicio multi-inquilino consiste en desacoplar por completo las credenciales de la máquina local.4 En lugar de gestionar miles de archivos JSON fragmentados en un disco de red, se puede implementar un adaptador de almacenamiento compatible con bases de datos como PostgreSQL.5 Herramientas de integración como postgres-baileys permiten que el evento de actualización de credenciales de Baileys (creds.update) guarde directamente la cadena serializada de autenticación en una tabla de base de datos relacional (por ejemplo, Supabase) asignada de forma unívoca a cada gymId 6:

| Método de Persistencia | Sobrevivencia a Redespliegues | Desempeño I/O en Red | Aislamiento Multi-Inquilino | Complejidad de Operación |
| :---- | :---- | :---- | :---- | :---- |
| **Directorio Local Efímero** | No (Pérdida total de sesiones) 1 | Excelente (Lectura local directa) | Muy baja (Estructura de carpetas) | Nula |
| **Volumen Persistente de Railway** | Sí (Almacenamiento de red duradero) 1 | Regular (Sujeto a latencia de montaje de red) 3 | Moderada (Requiere gestión de rutas locales) | Baja (Configuración vía dashboard de Railway) 3 |
| **Adaptador PostgreSQL / Supabase** | Sí (Independiente del contenedor) 6 | Óptima (Si se usa junto con un caché en memoria) 5 | Alta (Consultas indizadas por clave primaria gymId) 6 | Moderada (Requiere pool de conexiones dedicadas) |

## **Análisis de Fallas Críticas y Cuellos de Botella**

El motor de WhatsApp de FitGrowX experimenta múltiples fallas de carácter crítico que saturan el soporte técnico del SaaS y causan una latencia impredecible en la cola de distribución de mensajes.

### **El Bucle Infinito del Error 401**

Uno de los problemas más destructivos es el bucle infinito de desautenticación, identificado por el código de estado 401 Unauthorized. Para frenar este ciclo de fallas, se debió implementar una ruta de emergencia /wipe para purgar de forma manual las credenciales corruptas. El origen científico de esta anomalía reside en una condición de carrera de escritura no atómica entre la biblioteca subyacente de Baileys y el sistema de archivos del contenedor.8  
Cuando se altera el estado de la sesión, Baileys invoca internamente la rutina saveCreds(), la cual ejecuta de manera asíncrona y no atómica un guardado sobre el archivo creds.json en disco.8 Esta operación trunca el archivo existente a un tamaño de cero bytes antes de escribir los nuevos caracteres formateados en JSON.8 Durante esta ventana crítica de microsegundos, el archivo creds.json carece de contenido válido en el disco duro.8  
Si un proceso concurrente de lectura dentro del motor o un comando de reconexión de socket intenta leer el archivo en ese milisegundo preciso, la lectura recupera una estructura de datos incompleta, provocando un fallo irrecuperable en JSON.parse.8 La aplicación interpreta erróneamente esta interrupción física como una corrupción real del archivo de credenciales de WhatsApp, activando mecanismos de recuperación que restauran un respaldo obsoleto o corrupto (creds.json.bak).8 Al presentarse esta firma desfasada ante los servidores de WhatsApp, la sesión es revocada con un código 401 y un mensaje de error tipo conflict: device\_removed.8  
A esto se le suma el crecimiento desmedido del sistema de archivos de Baileys.11 Para operar la encriptación de extremo a extremo de forma segura, el protocolo de WhatsApp Web requiere la constante creación de archivos de claves previas (pre-keys), claves de sesión y claves de remitente (sender-keys).4  
Si la base de datos de autenticación no cuenta con una rutina automatizada de limpieza (garbage collection), el directorio de autenticación acumula rápidamente más de 800 archivos pequeños de claves desactualizadas.11 Este volumen de archivos satura la tabla de descriptores de archivos del sistema operativo, ralentizando el microservicio Node.js y sumergiendo a las conexiones de los gimnasios en un "estado zombie".11 En este estado de zombie, el motor de la plataforma muestra un estatus de conectado, pero cualquier intento de envío de mensajes falla de inmediato con un error de ausencia de escucha activa (No active WhatsApp Web listener).11

Baileys escribe credenciales:  
1\. Inicia saveCreds()  
2\. Trunca creds.json a 0 bytes  
   \====== CONCURRENT READ ATTEMPTS TO INITIALIZE HANDSHAKE \=====  
   Result: Incomplete file read / JSON.parse fails\!  
3\. Server receives corrupted handshake credentials  
4\. WhatsApp Gateway throws Status 401: device\_removed

### **Desconexiones y Sensibilidad de Red**

Los cierres de sockets son normales dentro de la operación cotidiana de Baileys debido a las políticas del protocolo de WhatsApp, las cuales desconectan conexiones inactivas que superen un umbral de 30 segundos sin tráfico de datos o mensajes de mantenimiento de canal (keep-alive).13 Asimismo, la infraestructura de Railway experimenta latencias de red variables hacia los servidores centrales de Meta ubicados en Estados Unidos o Europa, lo cual acorta severamente los tiempos de tolerancia para la negociación del apretón de manos (handshake).10  
Por otra parte, cuando varios gimnasios intentan emparejar sus cuentas utilizando códigos QR o códigos de enlace desde una dirección IP compartida en la nube de Railway, los sistemas automáticos de protección de Meta limitan la tasa de tráfico y rechazan las solicitudes de conexión por considerar que provienen de una red con reputación comprometida.9 El resultado es que el teléfono muestra un error que indica "No se pudo vincular el dispositivo" y la terminal Node.js registra la desconexión con códigos 401 o 515 de error de transmisión.9

### **Resiliencia Nula ante Errores y Ausencia de Backoff**

El motor actual se limita a realizar un máximo de dos intentos de envío en caso de falla, sin suspender el envío de mensajes dirigidos a un gimnasio cuya sesión se encuentra inactiva. Al no existir un desacoplamiento entre el estado de la conexión física del socket y el proceso de extracción de mensajes en el cron, el sistema intenta despachar las notificaciones aun cuando la conexión WebSocket está caída.  
Esta secuencia apresurada no solo agota los intentos de reintento del mensaje de inmediato, sino que también bombardea los servidores de WhatsApp con solicitudes de envío en momentos de desconexión, un comportamiento anómalo que los sistemas automatizados de Meta catalogan de manera fulminante como spam de telemetría de red, derivando en el bloqueo definitivo de la línea del gimnasio.13

## **Reingeniería de la Arquitectura de Colas y Anti-Baneo**

Para transformar el motor de WhatsApp de FitGrowX en un servicio resiliente, de baja latencia y con bajo riesgo de baneo, es imperativo rediseñar la infraestructura utilizando patrones modernos de mensajería asíncrona.

### **Desacoplamiento de Mensajes mediante BullMQ y Redis**

El sistema de polling basado en un cron que corre cada 1 minuto (wa-queue-flush) debe ser desechado en favor de una arquitectura orientada a eventos en tiempo real utilizando BullMQ sobre una instancia de caché Redis.5  
Bajo este enfoque, cuando la plataforma encola un mensaje en Supabase con sent\_at \= NULL, un webhook de base de datos o un disparador directo en el backend de la aplicación inserta un trabajo (job) en la cola estructurada de BullMQ de forma inmediata.15 Esto reduce el retraso artificial de entrega de un máximo de 60 segundos a una latencia de milisegundos.  
BullMQ permite además pausar colas de manera selectiva por canal.15 Si el motor detecta que el socket de un gimnasio específico (gymId) se ha desconectado o muestra un estatus de needs\_reauth, el hilo de ejecución puede pausar automáticamente la sub-cola de ese gimnasio en Redis.15 Los mensajes nuevos se acumularán de forma segura en la cola de espera de Redis y se procesarán únicamente cuando el socket vuelva a registrar un estado saludable de tipo conectado (SESSION\_CONNECTED).12

### **Algoritmo de Backoff Exponencial con Variación Gaussiana**

Para resolver el problema de los reintentos ineficaces, el motor de ejecución asíncrono debe programar los reintentos utilizando un modelo de retroceso exponencial (exponential backoff) enriquecido con variación Gaussiana (jitter).19 El cálculo del tiempo de espera para un reintento específico se rige bajo la siguiente expresión matemática:  
![][image1]  
Donde ![][image2] es el intervalo de retardo inicial definido (por ejemplo, 5000 ms) y el valor de ![][image3] corresponde al orden secuencial de la prueba de entrega en curso.20 Para evitar que múltiples mensajes fallidos se acumulen y se reintenten de forma coordinada, provocando picos de carga sobre la conexión, se introduce un factor de distorsión aleatoria o jitter 19:  
![][image4]  
Esto dispersa en el tiempo los reintentos de forma orgánica, suavizando la carga de la cola en el servidor y reduciendo el patrón de ráfagas ante los servidores de Meta.19

Intento 1: 5000 ms \+ Jitter (\~5000 ms a \~6250 ms)  
Intento 2: 10000 ms \+ Jitter (\~10000 ms a \~12500 ms)  
Intento 3: 20000 ms \+ Jitter (\~20000 ms a \~25000 ms)  
Intento 4: 40000 ms \+ Jitter (\~40000 ms a \~50000 ms)  
Intento 5: 80000 ms \+ Jitter (\~80000 ms a \~100000 ms)

### **Reglas de Tráfico Humano, Restricciones Horarias y Métricas**

La prevención de bloqueos por parte del sistema automatizado de spam de WhatsApp requiere que las transmisiones automáticas adopten patrones de comportamiento indistinguibles de una interacción humana real.13 Se proponen las siguientes medidas de mitigación de baneo dentro del motor:

1. **Retardo Variable mediante Distribución Gaussiana:** Evitar el envío de mensajes a intervalos de tiempo idénticos.19 El motor debe establecer pausas dinámicas con una media de 4 segundos y una desviación estándar de 1.5 segundos entre cada entrega exitosa.17  
2. **Simulación Dinámica de Escritura:** Emitir de forma activa un paquete de estado de escritura en WhatsApp (composing) antes del envío del texto.19 La duración de este estado debe calcularse proporcionalmente a la longitud del mensaje enviado a una razón promedio de 30 milisegundos por carácter.19  
3. **Control Horario por Zona de Destinatario:** Las restricciones de tiempo originales de FitGrowX (enviar únicamente de 10:00 a 13:00 hs y de 15:00 a 19:00 hs en la zona horaria de Argentina) deben ser aplicadas rigurosamente en producción. La función de control isWithinAllowedWindow() que actualmente se encuentra forzada en true para propósitos de prueba de laboratorio debe ser enlazada a un validador de huso horario basado en la biblioteca Moment.js o la API nativa de internacionalización de Node.js. Si la hora de envío cae fuera de los intervalos permitidos, BullMQ mantendrá el trabajo en estado diferido (delayed) en Redis hasta que la ventana permitida vuelva a abrirse.  
4. **Enrutamiento por Reputación de Destinatarios:** La tabla de monitoreo wa\_contact\_metrics debe actualizarse constantemente.11 Si un número de WhatsApp reporta un bloqueo o un rebote persistente, el sistema debe imponer un periodo de enfriamiento (cooldown) estricto de 24 horas sobre ese contacto específico antes de intentar despachar un nuevo mensaje, evitando la acumulación de reportes de abuso.  
5. **Panel de Control Integrado:** El tablero WaHealthDashboard y la tabla wa\_mensajes\_log procesarán métricas de rendimiento operacional en tiempo real:

| Métrica en wa\_mensajes\_log | Umbral Óptimo | Acción de Mitigación en WaHealthDashboard |
| :---- | :---- | :---- |
| **Block Ratio (Tasa de Bloqueo)** | **![][image5]** | Si supera el ![][image6], se pausa la cola entera y se notifica al gimnasio.19 |
| **Latencia Promedio (Latency\_ms)** | **![][image7]** | Si supera los ![][image8], se programa una purga de pre-keys del socket.11 |
| **Tasa de Error de Entrega** | **![][image5]** | Si excede el ![][image9], se activa una rutina de reinicio del WebSocket.12 |

## **Evaluación Estratégica: API No Oficial (Baileys) vs. API Oficial de Meta**

Para una plataforma SaaS de rápido crecimiento como FitGrowX, la elección del canal tecnológico de WhatsApp representa una decisión de negocio crítica con implicaciones en costos, experiencia de usuario y seguridad de datos.

### **Factores Operacionales y Estabilidad**

El uso de Baileys aprovecha el protocolo inverso de WhatsApp Web.13 Su beneficio financiero directo es obvio: al operar emulando una sesión web, Meta no cobra tarifas de mensajería, lo que permite que el SaaS ofrezca envíos masivos ilimitados a un costo de infraestructura de red de pocos dólares al mes.7  
Sin embargo, al carecer de soporte oficial, está sujeto a interrupciones repentinas cada vez que Meta realiza actualizaciones de seguridad sobre el código de su cliente web.13 Además, las cuentas corren un riesgo permanente de ser suspendidas de por vida por comportamiento automatizado no sancionado.13  
Por otro lado, la API oficial de WhatsApp Cloud (Meta Cloud API) está diseñada específicamente para su uso a nivel empresarial.13 Al operar de manera nativa mediante peticiones HTTPS REST y suscripciones de webhook directas hacia el backend, elimina por completo la necesidad de mantener WebSockets persistentes encendidos en Railway, eliminando el consumo excesivo de memoria RAM y CPU del motor de FitGrowX.5 Además, la API oficial no presenta riesgos de bloqueo de cuenta por envíos recurrentes, ya que el modelo utiliza plantillas de mensajes pre-aprobadas por Meta.13

### **Análisis de Costos de Mensajería para el Mercado de Argentina**

A diferencia del modelo gratuito de Baileys, la API de WhatsApp Cloud se basa en un esquema de cobro por conversación (ventanas de mensajería de 24 horas).24 Las tarifas varían según el origen del mensaje y el país del destinatario final 24:

\+---------------------------------------------------------------------------------+  
|                  WhatsApp Cloud API Conversation Window (24h)                   |  
|                                                                                 |  
|   \+---------------------------------------+---------------------------------+   |  
|   |         Iniciada por Negocio          |      Iniciada por Usuario       |   |  
|   |                                       |                                 |   |  
|   |  \- Marketing (Promo):   $0.0742 USD   |  \- Service (Atención):          |   |  
|   |  \- Utility (Alertas):   $0.0350 USD   |    \* Primeras 1000/mes:  GRATIS |   |  
|   |  \- Auth (OTP):          $0.0350 USD   |    \* Posteriores:        $0.0152 USD |   |  
|   \+---------------------------------------+---------------------------------+   |  
\+---------------------------------------------------------------------------------+

La siguiente tabla compara detalladamente los costos aplicables para el tráfico enviado hacia destinatarios de Argentina (vigentes al período de estudio) 25:

| Categoría de Conversación | Tarifa de Meta (Argentina) | Detalle del Caso de Uso en FitGrowX |
| :---- | :---- | :---- |
| **Primeras 1,000 Conversaciones** | **$0.00 USD** (Gratis al mes) 24 | Chats de atención al cliente iniciados por los usuarios (consultas de membresías).24 |
| **Conversaciones de Utilidad** | **$0.0350 USD** / ventana 24h 26 | Alertas automáticas del sistema, recordatorios de cuotas vencidas y avisos de acceso.24 |
| **Conversaciones de Autenticación** | **$0.0350 USD** / ventana 24h 26 | Envío de contraseñas temporales y códigos de verificación de doble factor (OTP).24 |
| **Conversaciones de Marketing** | **$0.0742 USD** / ventana 24h 26 | Campañas promocionales, alertas de nuevos horarios, promociones de pases de temporada.24 |

Si FitGrowX procesa mensualmente 100,000 mensajes de utilidad repartidos uniformemente entre múltiples gimnasios, la API oficial podría significar un costo directo facturado por Meta de hasta $3,500.00 USD. Para contrarrestar esta barrera comercial en mercados latinoamericanos con alta sensibilidad de precios, el SaaS puede incorporar flujos de registro integrado de Meta (Embedded Signup) de marcas de soporte técnico como 360dialog o Chakra Chat.27  
Esto permite que cada gimnasio asocie su propia cuenta comercial de WhatsApp (WABA) y asuma directamente los costos de mensajería de Meta mediante su propia tarjeta de crédito, liberando a FitGrowX de la carga de cobros e intermediaciones financieras complejas.27

## **Recomendaciones Técnicas de Implementación**

Para corregir los problemas actuales de FitGrowX preservando la arquitectura gratuita basada en Baileys sobre Railway, se recomienda seguir los siguientes pasos de reingeniería de software:

### **1\. Reemplazar la Biblioteca Raw Baileys por WaSP (WhatsApp Session Protocol)**

En lugar de reescribir de forma manual los complejos flujos de reintentos, amortiguación de bloqueos y persistencia, la solución de producción óptima consiste en integrar la biblioteca de código abierto **WaSP**.17 Diseñada específicamente como una capa de abstracción para Baileys, WaSP incorpora características de nivel empresarial 17:

* **Persistencia por Adaptadores:** Cuenta con integraciones nativas para almacenar las sesiones de los gimnasios de forma segura y directa en Redis o PostgreSQL (Supabase) sin depender del sistema de archivos efímero de Railway.17  
* **Reconexión Integrada con Backoff:** Sustituye el bucle de reconexión primitivo por una máquina de estados que maneja retrocesos progresivos inteligentes, reduciendo la tasa de errores 401\.17  
* **Cola Anti-Baneo Nativa:** Administra de forma nativa la variación Gaussiana en el envío y las colas de prioridad de mensajes de manera aislada por inquilino (multi-tenant isolation).17

Bash  
\# Instalación del ecosistema WaSP con soporte para bases de datos relacionales  
npm install wasp-protocol pg ioredis @whiskeysockets/baileys

### **2\. Implementar Escrituras Atómicas de Credenciales en el Archivo de Sesión**

Si se opta por mantener las credenciales locales en disco, es indispensable modificar el método de escritura para evitar estados corruptos por bloqueos de descriptores 8:

JavaScript  
import { promises as fs } from 'fs';  
import { join } from 'path';

// Procedimiento de Escritura Atómica para Evitar Corrupción en creds.json  
async function writeAtomicAuthData(data, folder, filename) {  
    const finalPath \= join(folder, filename);  
    const tempPath \= \`${finalPath}.tmp\`;  
      
    // Serializar credenciales a string utilizando el formateador nativo de Baileys  
    const serializedData \= JSON.stringify(data, BufferJSON.replacer);  
      
    // 1\. Escribir el contenido completo sobre un archivo temporal  
    await fs.writeFile(tempPath, serializedData, 'utf8');  
      
    // 2\. Realizar un reemplazo atómico a nivel de sistema operativo  
    await fs.rename(tempPath, finalPath);  
}

Este procedimiento garantiza que no exista un momento de inactividad donde el archivo en el volumen persistente posea un tamaño de cero bytes, neutralizando por completo el baneo inducido por la lectura de firmas vacías.8

### **3\. Habilitar Pruning Semanal de Pre-Keys**

Para evitar el estado de socket zombie de los gimnasios activos, se debe ejecutar una tarea de limpieza de pre-keys antiguas dentro del flujo de reconexión de cada cliente, manteniendo un límite máximo de seguridad de claves activas simultáneamente en disco o base de datos (por ejemplo, 150 archivos).11

## **Conclusión No Técnica para Perfiles No-Code y de Negocio**

*Para comprender los retos operativos de WhatsApp en FitGrowX y cómo esta reingeniería soluciona los problemas de raíz, se presenta a continuación un análisis simplificado libre de tecnicismos.*

### **El Diagnóstico de la Situación Actual**

Imaginemos que la mensajería de WhatsApp para los gimnasios de FitGrowX funciona como una oficina de correos privada integrada por una flota de repartidores en bicicleta (los "repartidores" son el motor Baileys).21 Esta estructura presenta tres fallas que impactan negativamente la experiencia del usuario y amenazan la continuidad del negocio:

1. **La "Pérdida de Memoria" de los Repartidores (Reinicio de Sesiones):** Cada vez que el equipo de FitGrowX introduce una mejora en el sistema, o cuando la nube de Railway realiza mantenimiento diario, el contenedor se apaga y se enciende de nuevo de manera automática.1 Como el sistema almacena las "credenciales de acceso" de los gimnasios en un disco temporal de la oficina de correos, el reinicio borra por completo la información.2 El repartidor olvida instantáneamente qué ruta le toca y pierde las llaves físicas de las puertas de WhatsApp. En la práctica, el dueño de un gimnasio se despierta con el servicio inactivo y se ve obligado a volver a escanear un código QR con su teléfono para poder recuperar el servicio de envío.2  
2. **El "Bucle de Error 401" (Las llaves dobladas):** Al escribir la información de acceso de manera desordenada y al mismo tiempo que se intenta enviar correspondencia, el sistema a veces "dobla la llave de metal" en la cerradura virtual.8 Cuando WhatsApp intenta verificar si el repartidor tiene autorización legítima para acceder, encuentra una llave rota, asume que es un intruso y bloquea el acceso.8 La plataforma entra entonces en un intento infinito de arranque que consume recursos del sistema, forzando al equipo técnico de FitGrowX a aplicar el botón de emergencia de limpieza (/wipe) para borrar todo de cero.  
3. **La Alarma Rígida de 1 Minuto y Reintentos Débiles:** Actualmente, un reloj automatizado (el proceso cron) baja a la oficina de correo a revisar si hay cartas para enviar una sola vez por minuto. Si un gimnasio tiene un mensaje de acceso inmediato, este puede tardar hasta 60 segundos completos en procesarse, una latencia inaceptable para notificaciones de seguridad en tiempo real. Adicionalmente, si el teléfono del gimnasio se queda temporalmente sin señal, el sistema intenta mandar la carta dos veces de forma inmediata, falla, y etiqueta el mensaje como "fallido". No hay un espacio para respirar o reintentar más tarde de forma inteligente.13

### **El Plan de Acción Estratégico**

Para solucionar de forma definitiva estos incidentes sin incurrir en costos elevados, el plan de acción se estructura en tres etapas estratégicas de implementación:

ETAPA 1: Caja Fuerte Virtual (Supabase)  
\-\> Se guardan las credenciales en la base de datos de manera permanente.  
\-\> Resultado: Nunca más un gimnasio tendrá que re-escanear su código QR tras actualizar el servidor.

ETAPA 2: El Cartero Resiliente (BullMQ)  
\-\> Se desecha la alarma de 1 min y se introduce una cola instantánea de envíos.  
\-\> Se simulan pausas de escritura y comportamiento humano dinámico para evitar bloqueos.  
\-\> Resultado: Entregas instantáneas en milisegundos y protección activa anti-baneo.

ETAPA 3: El Modelo Híbrido (API Oficial \+ API No Oficial)  
\-\> Se ofrece la opción gratuita mejorada por QR y una opción premium conectada a la API de Meta.  
\-\> Resultado: Escalabilidad a prueba de fallos y adaptada a la capacidad económica de cada gimnasio.

* **Etapa 1: Instalar una Caja Fuerte Virtual en Supabase (Persistencia de Sesión):** En lugar de escribir los códigos de acceso en el disco efímero de Railway, se reconfigura el sistema para que las claves se guarden en una tabla segura dentro de Supabase.6 Así, cuando el servidor se reinicie, el cartero simplemente se estira, saca las llaves de la base de datos segura y sigue enviando mensajes sin que ningún gimnasio note la interrupción.6  
* **Etapa 2: Sustituir la Alarma de un Minuto por una Oficina de Envíos en Tiempo Real (BullMQ y WaSP):** Se migra el flujo de mensajería a una oficina postal asíncrona.15 Los mensajes de FitGrowX se procesarán instantáneamente al crearse en milisegundos. Si el teléfono del gimnasio de destino se encuentra apagado o sin internet, el sistema pausará de forma inteligente las notificaciones de ese gimnasio específico, guardando las cartas en casilleros seguros.15 En cuanto el teléfono detecte conexión, el sistema reiniciará los envíos de forma paulatina y controlada, aplicando pequeñas variaciones de tiempo para simular la velocidad de un dedo humano escribiendo en pantalla y proteger la reputación de la línea telefónica.19  
* **Etapa 3: Integrar una Vía Oficial (Hibridación con la API en la Nube de Meta):** Si bien Baileys es gratuito y excelente para gimnasios con presupuestos limitados, el crecimiento del SaaS exige que los clientes premium de FitGrowX cuenten con un canal oficial sin riesgos de caídas.13 Se recomienda adaptar la base de datos para ofrecer un modelo de conexión dual:  
  * *Acceso Gratuito Mejorado (Método Baileys):* El gimnasio escanea su QR de forma gratuita. Su conexión será mucho más estable gracias a las mejoras de la Etapa 1 y 2, pero asume un pequeño margen de riesgo inherente a actualizaciones de WhatsApp.13  
  * *Acceso Premium Corporativo (Método Meta Cloud API):* Los gimnasios grandes asocian su tarjeta de crédito directamente a Meta utilizando un portal de registro integrado (Embedded Signup) provisto por FitGrowX.27 El gimnasio paga sus costos por mensaje directamente a Facebook 27 (aproximadamente $0.035 USD por conversación en Argentina) 26, disfrutando de una línea de comunicación blindada contra baneos y con soporte oficial libre de desconexiones.13

#### **Obras citadas**

1. database \- Railway Central Station, fecha de acceso: mayo 21, 2026, [https://station.railway.com/questions/database-579e82c2](https://station.railway.com/questions/database-579e82c2)  
2. Lost production data after upgrading from Trial to Hobby \- Railway Central Station, fecha de acceso: mayo 21, 2026, [https://station.railway.com/questions/lost-production-data-after-upgrading-fro-d63843c7](https://station.railway.com/questions/lost-production-data-after-upgrading-fro-d63843c7)  
3. Using Volumes | Railway Docs, fecha de acceso: mayo 21, 2026, [https://docs.railway.com/volumes](https://docs.railway.com/volumes)  
4. K4lameety/baileys: WhatsApp Web API Library \- GitHub, fecha de acceso: mayo 21, 2026, [https://github.com/K4lameety/baileys](https://github.com/K4lameety/baileys)  
5. Deploy Evolution API | Open Source Messaging Automation Platform \- Railway, fecha de acceso: mayo 21, 2026, [https://railway.com/deploy/self-host-evolution-api](https://railway.com/deploy/self-host-evolution-api)  
6. postgres-baileys CDN by jsDelivr \- A CDN for npm and GitHub, fecha de acceso: mayo 21, 2026, [https://www.jsdelivr.com/package/npm/postgres-baileys](https://www.jsdelivr.com/package/npm/postgres-baileys)  
7. Deploy Evolution API — WhatsApp REST API \- Railway, fecha de acceso: mayo 21, 2026, [https://railway.com/deploy/evolution-api-whatsapp](https://railway.com/deploy/evolution-api-whatsapp)  
8. WhatsApp: repeated 'restored corrupted creds.json from backup ..., fecha de acceso: mayo 21, 2026, [https://github.com/openclaw/openclaw/issues/67337](https://github.com/openclaw/openclaw/issues/67337)  
9. \[BUG\] Having issues connecting device 401 error · Issue \#2248 · WhiskeySockets/Baileys, fecha de acceso: mayo 21, 2026, [https://github.com/WhiskeySockets/Baileys/issues/2248](https://github.com/WhiskeySockets/Baileys/issues/2248)  
10. OpenClaw WhatsApp channel — QR scans but connection fails with 401 Unauthorized, fecha de acceso: mayo 21, 2026, [https://www.reddit.com/r/whatsapp/comments/1rsazb9/openclaw\_whatsapp\_channel\_qr\_scans\_but\_connection/](https://www.reddit.com/r/whatsapp/comments/1rsazb9/openclaw_whatsapp_channel_qr_scans_but_connection/)  
11. \[Bug\]: WhatsApp Baileys credential store bloats (7K+ files) leading to zombie listener · Issue \#19618 \- GitHub, fecha de acceso: mayo 21, 2026, [https://github.com/openclaw/openclaw/issues/19618](https://github.com/openclaw/openclaw/issues/19618)  
12. \[BUG\] Messages stopping arrive · Issue \#2331 · WhiskeySockets/Baileys \- GitHub, fecha de acceso: mayo 21, 2026, [https://github.com/WhiskeySockets/Baileys/issues/2331](https://github.com/WhiskeySockets/Baileys/issues/2331)  
13. Feature Request: WhatsApp Cloud API (official) as alternative to Baileys \#23093 \- GitHub, fecha de acceso: mayo 21, 2026, [https://github.com/openclaw/openclaw/issues/23093](https://github.com/openclaw/openclaw/issues/23093)  
14. \[BUG\] QR code scan succeeds on mobile but login fails with 401 and "Unable to link device" error · Issue \#2381 · WhiskeySockets/Baileys \- GitHub, fecha de acceso: mayo 21, 2026, [https://github.com/WhiskeySockets/Baileys/issues/2381](https://github.com/WhiskeySockets/Baileys/issues/2381)  
15. Trigger.dev vs BullMQ, fecha de acceso: mayo 21, 2026, [https://trigger.dev/vs/bullmq](https://trigger.dev/vs/bullmq)  
16. BullMQ \- Background Jobs and Message Queue for Node.js, Python, Elixir & more | BullMQ, fecha de acceso: mayo 21, 2026, [https://bullmq.io/](https://bullmq.io/)  
17. kobie3717/wasp: WaSP — WhatsApp Session Protocol ... \- GitHub, fecha de acceso: mayo 21, 2026, [https://github.com/kobie3717/wasp](https://github.com/kobie3717/wasp)  
18. I built an open-source WhatsApp protocol layer — WaSP (WhatsApp Session Protocol) : r/node \- Reddit, fecha de acceso: mayo 21, 2026, [https://www.reddit.com/r/node/comments/1s0nlqa/i\_built\_an\_opensource\_whatsapp\_protocol\_layer/](https://www.reddit.com/r/node/comments/1s0nlqa/i_built_an_opensource_whatsapp_protocol_layer/)  
19. Build an anti-ban toolkit for Whatsapp automation(Baileys) \- open source : r/node \- Reddit, fecha de acceso: mayo 21, 2026, [https://www.reddit.com/r/node/comments/1rb1oqj/build\_an\_antiban\_toolkit\_for\_whatsapp/?tl=en](https://www.reddit.com/r/node/comments/1rb1oqj/build_an_antiban_toolkit_for_whatsapp/?tl=en)  
20. How to Implement Job Retries with Exponential Backoff in BullMQ \- OneUptime, fecha de acceso: mayo 21, 2026, [https://oneuptime.com/blog/post/2026-01-21-bullmq-retry-exponential-backoff/view](https://oneuptime.com/blog/post/2026-01-21-bullmq-retry-exponential-backoff/view)  
21. Evolution API WhatsApp: Open Source Alternative to Integrate \- GuruSup, fecha de acceso: mayo 21, 2026, [https://gurusup.com/blog/evolution-api-whatsapp](https://gurusup.com/blog/evolution-api-whatsapp)  
22. Looking for practical advice: WhatsApp API for multiple clients (Meta limits vs Unofficial vs BSPs) : r/AI\_Agents \- Reddit, fecha de acceso: mayo 21, 2026, [https://www.reddit.com/r/AI\_Agents/comments/1rfkh9r/looking\_for\_practical\_advice\_whatsapp\_api\_for/](https://www.reddit.com/r/AI_Agents/comments/1rfkh9r/looking_for_practical_advice_whatsapp_api_for/)  
23. WhatsApp Cloud API vs Business API – Key Differences Explained \- Authkey, fecha de acceso: mayo 21, 2026, [https://authkey.io/blogs/whatsapp-cloud-api-vs-business-api-which-is-right-for-your-business/](https://authkey.io/blogs/whatsapp-cloud-api-vs-business-api-which-is-right-for-your-business/)  
24. Pricing Explained — WhatChimp Docs, fecha de acceso: mayo 21, 2026, [https://help.whatchimp.com/docs/overview/pricing-explained](https://help.whatchimp.com/docs/overview/pricing-explained)  
25. Axoxa \- Enhance your customer service with cloud-based WhatsApp, fecha de acceso: mayo 21, 2026, [https://www.axoxa.io/](https://www.axoxa.io/)  
26. WhatsApp Conversation-based pricing \- Woztell, fecha de acceso: mayo 21, 2026, [https://woztell.com/whatsapp-conversation-based-pricing/](https://woztell.com/whatsapp-conversation-based-pricing/)  
27. Embed WhatsApp Business API Into Your SaaS or Agency Platform \- ChakraHQ, fecha de acceso: mayo 21, 2026, [https://chakrahq.com/article/whatsapp-api-partner-integration-solution-embedded/](https://chakrahq.com/article/whatsapp-api-partner-integration-solution-embedded/)  
28. Embedded Signup | Get Started | Postman API Network, fecha de acceso: mayo 21, 2026, [https://www.postman.com/meta/whatsapp-business-platform/collection/du6gzjv/embedded-signup](https://www.postman.com/meta/whatsapp-business-platform/collection/du6gzjv/embedded-signup)  
29. Best WhatsApp API for multi-tenant SaaS where users send from their own numbers?, fecha de acceso: mayo 21, 2026, [https://www.reddit.com/r/WhatsappBusinessAPI/comments/1s5s9xd/best\_whatsapp\_api\_for\_multitenant\_saas\_where/](https://www.reddit.com/r/WhatsappBusinessAPI/comments/1s5s9xd/best_whatsapp_api_for_multitenant_saas_where/)  
30. Looking for WhatsApp BSP (multi-tenant SaaS, embedded onboarding \+ billing) \- Reddit, fecha de acceso: mayo 21, 2026, [https://www.reddit.com/r/WhatsappBusinessAPI/comments/1s3fonp/looking\_for\_whatsapp\_bsp\_multitenant\_saas/](https://www.reddit.com/r/WhatsappBusinessAPI/comments/1s3fonp/looking_for_whatsapp_bsp_multitenant_saas/)

[image1]: <data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAmwAAABFCAYAAAD3qbryAAAFR0lEQVR4Xu3dWchtUxwA8GWeZSxSrjFThmROvJhnZSjKg5BE4YEk3ZQ8yZQHQilJPCkKIS8o81DIlAeZ5yHztP7ttXzrLuee+13Xvd893/n96t/e67/P/s7Z+3s4/9Zea52UAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAABa1+Q4tE+upFbvEwAA0+CWHHv3yRFO6BNLYVnOrR7KcXmfBABgcGn670XXspzb26NPAMA0+SvH5zkWpuEL9vUcv+W4MMclOR4or5nPNs9xYBqu888c++bYL8cpOT4o+Un1cY4v0nANESc2x87PcW/Z/yTHR2U//vdV/P/bouvrHGuX/Xpf2nPbe9Wf+3aODcv+H01+NhRsAEy1c7t2fJFe3eW+6drzVRQbN/TJ7MEc9/fJCbBDjjWa9sNp0YLqqDRTsL2c45CyH8Vr1Rddcf4ZJT4tufbccQVbe+zLNPM49qLFREvBBsDUip6kXnyprtXl7uza89FZabj2jfoDxST2sj2dhh6xVlzHBmX/iDRTsL2QY5+yX7chiq6Tc6xaYtR9aM/tC7Y4NwrD1bpjn+U4p2kviYINgKn1RtfeOI3+Qj6yT8xD76TR116NO7Y8PZtjlz5ZfN8nOjel4XF3K67j6LIf/9dasL2ahsfAoW7D3WnoTduktH9PQ/EVNi3b9tz2PtVz3xpxbGnvp4INAIob09J/kc4Xcd1RjCzOXN6XN3Ps1eUe79qzFdcRBde2aXjUHT1w0QsW22hvXbbf1RNK+6mm/VKO59Mw1u2etOi5X6V/n1uLvVXSMCYwHqX2vbjjxJjK+DsRMSYPAKZafJnPZWGyNI4dEcek4fFb9BwdnuOwf1493lZpuO74G6Ncmeb+vmyZhjFf6+T4qTs2W3ENdXIAADCh4gv9sT45Be5I4wuymIhxa9n/NY1/7fIUjxZ/7pOz9FyaeTQJAEyoU9NQiBzUH5gC43oW10v/Pta3V5Qf0/A4ctRkkXFiLNsjfRIAmDwxTmquCpH/ohZZS4oD6gljxOte7JNFHOuXNZmL+xSTD6oo2mbzCwXhzDT0ILZ27NoAwISIIiQGd4/yXtmel+OqNIwVqx4t25iwUNfvit6c28t+LW52yvFEGgaeRy4WUI3trs1rbstxetlfkeL9Y4ZstUUalsSI/LpNvqqfd/0cP5T9C9JwbWummQKvLhIbfinbusxGvZdLEu8xajZofN49+2QnJgH0BexcFJsAwDLYOQ3FQMzsi/g2DWOk7mtflIZirC6WGr8EEDMMP8xxdvOadnX8mAEYhcFdaSjo6rm1WBhVNCzIcUWOV/oDy1Fce1xPfJ7YxizRKKxiRmQUbYvTfv7Yj/XJQvxAeUx6qMcjHzMm4xckqjjW3sslWdgnGtf2iU4Uk32xNureAwATLoqO4/pkGnrC3s3xfmlHD1MrCoPoabuuy4e2aNiutON9osco1vRa2fUF24Icx+c4qclVMWP1mTRMXFjcwrMAAMusXYMrxrpd1rRrAdIWbKelYVHeWFE/eu2qJ8u2LVpiXa6Y8BBivNVrzbGVVV+wjcodnBZdgLYeb9d6i3sJAPC/2b3ZjzXBNivbqhZs+6dhLFdrmzTz2HCUWMh1+7IfY7YmQR2v1upnb8aaaTHLNB4ht9p7CQCwwlzcJwAAWHnsluP6HDf3BwAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAIDp9je4LQ8MV3Fv5gAAAABJRU5ErkJggg==>

[image2]: <data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAACoAAAAYCAYAAACMcW/9AAABnElEQVR4Xu2VTSsHURSHD3nZCAssrIgsLdiQlyzlnYh8AAsLhbLBR1BSVsRC2SgbRTZsrEQslBQlPgAbbyn8jnNuc5rmP7Mx87eYp56695w7zW9ud2aIUlJ+GYHTcAbO6ngKTsIxsy7rVMF2+A0fYBNshC1wW+sHbnG2qSUJ1O9vgCKSHu9w1tkgCZMJ7oX1EyMqyC2F9xODQ5z5i4aoB0mESpIQ3f6G4V8EXafwEO5lOtb5KFzw2skRtVuHJP0CnVfoPHHCzmchSX/VV088aA3JTXv9DeUL3viLJNfUwUXydpopg0tw0NSYPrgGO0ytmOSzOGRqGdmj4N2ZJ6nz7zQIe80jSWhXzyEJ/6y1LpI/HcPvA1MO73Q8QfLAgWzBT/LOJ+8czz/gE8kLE4YN2gbfzDwPdpK3plrHm7BEa/dwGY6rfP9YsEGbzfwFDujYrimFK1rLh6+wx/Rjw4bgM8lHxZ13B49b4RzM1dowrIcN8ERrzLUZ/yn8c7iCpyRBHUfwHO6TnMdLkqA7cJdkvYN39B1emFpKSkoc/ABydGOxfDTx5AAAAABJRU5ErkJggg==>

[image3]: <data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAADwAAAAXCAYAAABXlyyHAAAB2klEQVR4Xu2WvytFYRjHH79iEQaThcmgGKx2BiWSiUH5VVgMFtSNP0BJTEZCSJTBSJFBlLKYDCJsolB4v533vR7P+5y47lU3vZ/61nk+5zk/nnPuebtEgUDgP/Bu81vypfgDMnqNG5MXKVMgnYf1U9K5v4zz1wMXUxYNfEHfD5wnRYpg2IwNfE/+N+xqpMzk0mTD1t0xfS6lbH+VdWMmxyYPbB8/ps7kxGTP1rUxfS6cCusSJlN2u5w3aHSSf6I+69aYm7eOc6A4kEuRL2EObwmDO5Yo6hli7tw6DmrtDReS31ugOI9m8ps6FDesuLiBT8n3CeHmRA3WFRc38BP5vQDuTEpOE/kHtiluQHFxA8Mhu0ocM7aHs6w41K/CAXcNSZxP0kh+Q4viehUnB8aDAm/Ca0yT37OoOD5Ajkm94jlxPon2htsV575rzr5wuGEwIbxjkm3Pkt/jvmsOHwB/QPDgwRHzHLhVKTmt5B/YpbgRxY0yV0PRr8WBn+Etq4tMDlm9QP75thS3w9wgfV2F4XtY3W9dLLgp/NO6MrkzqaRogXAONzxu8iwcTuzAAoGLYIWVuDeGYNuBBYdft8Hk0eSauepkd1TjHNvMOTbp8xorYl8gEAgEAtnKB64GtvIY4CPjAAAAAElFTkSuQmCC>

[image4]: <data:image/png;base64,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>

[image5]: <data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAADYAAAAUCAYAAADGIc7gAAAAgElEQVR4Xu3UoQ2AQBBE0bU0gEWQQAVYNApLByQk9IClAzyeqqgAAwkCmAtuBAK3m33JNzdqzYk455z7J0M7P2pWoRt1PGjVyntQzYNWA7pQwYNWEzpQwoNmC1pRxIMVM9pQzIMVIzpRzoMVvbw/Y8mDFeHLDwc2PFiR8oNz7tMDeZwQOvjm00kAAAAASUVORK5CYII=>

[image6]: <data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAACQAAAAUCAYAAADlep81AAAB20lEQVR4Xu2VO0geQRSFr+9HsJEUqSVgoWKKiLWdCME6nRZWoo2FgoiglQTEztJKBK1COiViofgCUYwhhaWNj0JREN/eszODZ+8/+9tE+As/ODD33N07d3dmdkXeKQx6Vb9VRTZBzFvjrdhRDfnxk6qbcoFt1ZQ1r1TLqkNxNzam05mcqFZUs6pbVWUq62oFWlV9qiPVo8+hGYxT3Kl6KF4Vd3ExeTEuVHMUd0i6gToTg3ETb6qqjZfcxDeO+fg7eTHsZABeix9/8DEzSuMGiSwVqFF9pHhDXCH7+plByZ0MwFszcaBTXBOBBxpnUiquCPZEPhYluyGeaED1U9yyYGsEsNlzloopk5el+2ZyMXYluyHrf1L1U/xFNUlxraqN4hzOVdfWNKxL7sQg1pCF3+C06peqSXVMfoqv4oru2QQxI/GJ4fHSWPYlvTe5xnAYYBPXUwK89qT4nsTy8Las6cHpm6AYS8c1koMVCl9SosJ79hTwCQG4BofAeva6wL2J8aHkhpJaYXIuvOC9z+ShGLwq8k7F/aMCXRJ/a+Cvqtyakr6+PQyafeJMdePH3AzAycPSWvC1PlAtiWu6JJ1OwJsYsabnn7g9C7Ie5r+Df1c+fqj+SPxh3ilsngECjHWMU6+3TQAAAABJRU5ErkJggg==>

[image7]: <data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAEUAAAAUCAYAAADbX/B7AAAAgklEQVR4Xu3VoQ2DUBjE8bMsgEWQlAmw6CosGzRpwg5YNsDjmaoTYCBBQI8809wETb77JX/zzn3mAWZmZv/swTZ9jOrJLvbWIaIX0jFaHSIa2MlqHSKa2M4KHaJa2IdlOhgws5XlOhgwsoNVOhjQI/1AjQ6WvuX7OJ0OBpT6YGb24wvz0RA6OJ6CFQAAAABJRU5ErkJggg==>

[image8]: <data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAADsAAAAUCAYAAAAz30VQAAACJElEQVR4Xu2Wz0tVQRzFv5hWEkRCK5GwVmK5yYR2YssgxJW7bB+CGxHc+QcIbW3TSoQiF0UhSiZUKG5046JtVlQqlBKE9ut7mu/Iud83l4bgBcL9wOHNOXPefTPv3XvfFamoqDiKNKm+qd6rfpm6Cg2RWctfqxZVe+Y9n1RLqmnVvupkYTaQ06kbftFvLTtD2SPLolZoLvJFNUP+utQeO6dTN5olfNgcZfilkb2k7CGNy0gtGlmP8x7fqSv4MPxyPuOFPaBxijEp38grG+d0/judEhbAG7xvr09VBxIWzsxL+UZ+2Din47krxS/+q2rK/JKE6x1Z7CFj3qjGVVddfsiu1C4KN5Mt8o8l3KQi61L7HsALzemkaJAwj5tZpNUyXsMlyyLtztfQJ6Fw2uXHnAfo3bTxsnkPbySnUwbmBxPZNfLxS2k0f978pIT7UIGzEiZTG0uB7qaN75n3IMNpD3I6ZaDjT0Vk5xLZcfLPLSt8Ljb4kwPlBY1RniAfs882HjbvQbZq45xOGehcTmRtieyEy8ANNnw9RPDwAE5JOMgQzQFkd5yPpxBnF53/WycFOt2JLLXZ+JDSrxqluT/gFELJa4Q68MyTRIYb2DPyt+TfOinQ6SWPMxFZB2XYJLIW8wPmD7liQUoXqIeDf1dt29wOzTF4QtpQLUjop67/nE4EfzMfVe9UHyQ81uLRNWZ4xRMfLjnO1iRs9raENeN9FRUVR4jf193LI8Vdz/IAAAAASUVORK5CYII=>

[image9]: <data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAACwAAAAUCAYAAAD2rd/BAAAB80lEQVR4Xu2VO0slQRCFyweraKSBLIYGJioYKCYmG2qyP0HNFNFEfCCIgYGIIGa7mRgsgqAgZoqogYgKIvjODNTAR2Do2zrT00tNTbU3vMG9HxzoOtXdU9M9002UJ3foZW2wCnRCsKiNbHHIGonbn6wukfMcsGa12UNuQIg91hnrL7l+1cl0kDvWFusf64VVmsgmn9nC6mNdsz7iHIpF+z8wt1nzcdsC23Ul4ioK95U8sRZE3E7JcTUqBhMqxkKVKS+ig9KDPfDrDW9QeRprPnjNcbs8jiXjol1HxqfgCRWMbYKvfwh4z8qTDJM9H7wdFXt+kyvS8y7aKUIFj5Ltw7N8zxrZeXiykAHWCrltfxU+fkbzU/CECsaWWH6mgo/IzlvjfrL6RdzImhFxJeuXiCNCBU+S7VsPluySnc80Dsgd+MNaZTUILyJUcMjP9OA5svPw5NZrjil59FlzRIQKw5vBL1E+vDflSXCeWvPB29dmDE6PKRHj07DmiAgVDOC3Gh6uVE8hpS8T9Ck2PHkSSPQC+BPKpJtcskgnmE3Wg4hrKT0RYu3dk7t0PJ2U7uPBLfpDm2T0Pyd3fd6QuxJvWY+sNtmJuYxzy+QmqUimaYi1pDyA2+6UtU5uBa0FwUqOaTPmgtWkzWyDhfqOadaJNvPkPF/2g4x1Rwu9kgAAAABJRU5ErkJggg==>