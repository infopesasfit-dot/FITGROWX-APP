export type Database = {
  public: {
    Tables: {
      alumnos: {
        Row: {
          id: string;
          gym_id: string;
          full_name: string;
          phone: string | null;
          email: string | null;
          dni: string | null;
          status: string;
          plan_id: string | null;
          next_expiration_date: string | null;
          frozen_since: string | null;
          pausa_hasta: string | null;
          deuda_pendiente: number | null;
          last_payment_date: string | null;
          created_at: string;
          updated_at: string;
          deleted_at: string | null;
        };
      };
      profiles: {
        Row: {
          id: string;
          gym_id: string | null;
          role: string | null;
          full_name: string | null;
          email: string | null;
          created_at: string;
          updated_at: string;
        };
      };
      pagos: {
        Row: {
          id: string;
          gym_id: string;
          alumno_id: string;
          amount: number;
          method: string | null;
          status: string;
          date: string;
          concepto: string | null;
          created_at: string;
          updated_at: string;
        };
      };
      planes: {
        Row: {
          id: string;
          gym_id: string;
          nombre: string;
          precio: number;
          periodo: string | null;
          duracion_dias: number | null;
          accent_color: string | null;
          active: boolean;
          created_at: string;
          updated_at: string;
        };
      };
      gyms: {
        Row: {
          id: string;
          name: string;
          plan_type: string | null;
          created_at: string;
          updated_at: string;
        };
      };
      gym_settings: {
        Row: {
          gym_id: string;
          gym_name: string | null;
          owner_name: string | null;
          email: string | null;
          whatsapp: string | null;
          slug: string | null;
          created_at: string;
          updated_at: string;
        };
      };
      push_subscriptions: {
        Row: {
          alumno_id: string;
          gym_id: string;
          endpoint: string;
          p256dh: string;
          auth: string;
          updated_at: string;
        };
      };
      asistencias: {
        Row: {
          id: string;
          gym_id: string;
          alumno_id: string;
          fecha: string;
          created_at: string;
        };
      };
      rutinas: {
        Row: {
          id: string;
          gym_id: string;
          alumno_id: string;
          nombre: string;
          ejercicios: unknown;
          updated_at: string;
          created_at: string;
        };
      };
      progreso_pesos: {
        Row: {
          id: string;
          alumno_id: string;
          ejercicio: string;
          peso: number;
          fecha: string;
          notas: string | null;
          created_at: string;
        };
      };
      progreso_fotos: {
        Row: {
          id: string;
          alumno_id: string;
          storage_path: string;
          fecha: string;
          privada: boolean;
          completada: boolean;
          created_at: string;
        };
      };
      gym_classes: {
        Row: {
          id: string;
          gym_id: string;
          class_name: string;
          day_of_week: number;
          start_time: string;
          max_capacity: number | null;
          event_type: string | null;
          notes: string | null;
          coach_name: string | null;
          created_at: string;
          updated_at: string;
        };
      };
      [key: string]: {
        Row: Record<string, unknown>;
      };
    };
    Views: Record<string, unknown>;
    Functions: Record<string, unknown>;
    Enums: Record<string, unknown>;
  };
};
