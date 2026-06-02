export const EJERCICIOS: readonly string[] = [
  // ── Cuádriceps / Piernas ────────────────────────────────────────────
  "Sentadilla", "Sentadilla con Barra", "Sentadilla Sumo", "Sentadilla Búlgara",
  "Sentadilla Hack", "Sentadilla Frontal", "Sentadilla Goblet", "Sentadilla Pistol",
  "Leg Press", "Leg Press 45°", "Extensión de Cuádriceps", "Zancada",
  "Zancada Caminando", "Zancada con Barra", "Zancada con Mancuernas",
  "Step-up", "Box Jump", "Salto al Cajón", "Sentadilla en Multipower",

  // ── Isquiotibiales / Glúteos ────────────────────────────────────────
  "Curl de Isquiotibiales", "Curl de Isquiotibiales Sentado", "Peso Muerto Rumano",
  "Peso Muerto", "Peso Muerto Sumo", "Good Morning", "Hip Thrust",
  "Hip Thrust con Barra", "Glute Bridge", "Abductor en Máquina",
  "Aductor en Máquina", "Cable Kickback", "Donkey Kick",

  // ── Pantorrillas ────────────────────────────────────────────────────
  "Pantorrillas de Pie", "Pantorrillas Sentado", "Pantorrillas en Prensa",
  "Saltos de Cuerda", "Double Under", "Single Under",

  // ── Pecho ────────────────────────────────────────────────────────────
  "Press de Banca", "Press de Banca con Mancuernas", "Press Inclinado",
  "Press Inclinado con Mancuernas", "Press Declinado", "Press Declinado con Mancuernas",
  "Aperturas con Mancuernas", "Aperturas Inclinadas", "Aperturas en Polea",
  "Fondos en Paralelas", "Fondos Pectorales", "Flexiones", "Push-up",
  "Flexiones Inclinadas", "Flexiones Declinadas", "Flexiones Diamante",
  "Pec Deck", "Cruces en Polea", "Press en Máquina", "Cable Fly",

  // ── Espalda ──────────────────────────────────────────────────────────
  "Dominadas", "Dominadas Agarre Supino", "Chin-up", "Pull-up",
  "Jalón al Pecho", "Jalón Trasnuca", "Jalón en Polea Baja",
  "Remo con Barra", "Remo con Mancuerna", "Remo en Polea", "Remo Sentado",
  "Remo en T", "Remo Pendlay", "Face Pull", "Pull-over con Mancuerna",
  "Pull-over en Polea", "Hiperextensión de Espalda", "Back Extension",
  "Peso Muerto Convencional", "Encogimiento de Hombros", "Shrug con Barra",
  "Shrug con Mancuernas", "Ring Row", "TRX Row",

  // ── Hombros ──────────────────────────────────────────────────────────
  "Press Militar", "Press Militar con Mancuernas", "Press Arnold",
  "Elevaciones Laterales", "Elevaciones Frontales", "Vuelos Posteriores",
  "Vuelos con Mancuerna", "Vuelos en Polea", "Press Trasnuca",
  "Upright Row", "Remo al Mentón", "Handstand Push-up", "HSPU",

  // ── Bíceps ───────────────────────────────────────────────────────────
  "Curl de Bíceps con Barra", "Curl de Bíceps con Mancuernas",
  "Curl Martillo", "Curl Concentrado", "Curl en Polea", "Curl Predicador",
  "Curl Inclinado", "Curl 21s", "Curl con Barra EZ",

  // ── Tríceps ──────────────────────────────────────────────────────────
  "Extensión de Tríceps", "Press Francés", "Press Francés con Mancuerna",
  "Extensión en Polea Alta", "Patada de Tríceps", "Fondos en Banco",
  "Overhead Tricep Extension", "Extensión de Tríceps Unilateral",

  // ── Core / Abdominales ───────────────────────────────────────────────
  "Plancha", "Plancha Lateral", "Plancha con Toque de Hombro",
  "Crunches", "Crunch en Polea", "Crunch Inverso", "Rueda Abdominal",
  "Sit-up", "GHD Sit-up", "Toes to Bar", "Knees to Elbow",
  "Hanging Leg Raise", "Russian Twist", "Mountain Climber",
  "Hollow Body", "L-Sit", "Dragon Flag", "Ab Rollout",

  // ── Olímpicos / CrossFit Barbell ────────────────────────────────────
  "Clean", "Power Clean", "Hang Clean", "Hang Power Clean",
  "Snatch", "Power Snatch", "Hang Snatch", "Hang Power Snatch",
  "Clean and Jerk", "Split Jerk", "Push Jerk", "Push Press",
  "Thruster", "Overhead Squat", "Snatch Balance",

  // ── Kettlebell ───────────────────────────────────────────────────────
  "Kettlebell Swing", "Kettlebell American Swing", "Kettlebell Clean",
  "Kettlebell Snatch", "Kettlebell Press", "Turkish Get-Up",
  "Kettlebell Goblet Squat", "Kettlebell Deadlift",

  // ── Gimnásticos ──────────────────────────────────────────────────────
  "Muscle-up", "Bar Muscle-up", "Ring Muscle-up", "Ring Dip",
  "Ring Push-up", "Rope Climb", "Handstand Walk", "L-Pull-up",
  "Pistol Squat", "Box Jump Over", "Broad Jump",

  // ── Cardio / Metabólico ─────────────────────────────────────────────
  "Burpee", "Burpee Box Jump", "Burpee Box Jump Over", "Burpee Pull-up",
  "Wall Ball", "Ball Slam", "Medicine Ball Clean",
  "Remo en Máquina", "Ski Erg", "Assault Bike", "Air Bike",
  "Sprints", "Saltos", "Saltos Laterales", "Jump Rope",

  // ── Cargadas / Funcional ────────────────────────────────────────────
  "Farmers Walk", "Suitcase Carry", "Overhead Carry",
  "Sled Push", "Sled Pull", "Tire Flip", "Sandbag Clean",
  "Battle Ropes", "Prowler",

  // ── Estiramiento / Movilidad ────────────────────────────────────────
  "Estiramiento de Cuádriceps", "Estiramiento de Isquiotibiales",
  "Estiramiento de Glúteo", "Estiramiento de Espalda",
  "Estiramiento de Pecho", "Estiramiento de Hombro",
  "Foam Roller Cuádriceps", "Foam Roller IT Band",
  "Hip Flexor Stretch", "Pigeon Pose", "World's Greatest Stretch",
].sort((a, b) => a.localeCompare(b, "es"));
