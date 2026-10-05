export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[];

export type Database = {
  // Allows to automatically instantiate createClient with right options
  // instead of createClient<Database, { PostgrestVersion: 'XX' }>(URL, KEY)
  __InternalSupabase: {
    PostgrestVersion: '14.18';
  };
  graphql_public: {
    Tables: {
      [_ in never]: never;
    };
    Views: {
      [_ in never]: never;
    };
    Functions: {
      graphql: {
        Args: {
          extensions?: Json;
          operationName?: string;
          query?: string;
          variables?: Json;
        };
        Returns: Json;
      };
    };
    Enums: {
      [_ in never]: never;
    };
    CompositeTypes: {
      [_ in never]: never;
    };
  };
  public: {
    Tables: {
      task_completions: {
        Row: {
          user_id: string;
          task_id: string;
          occurrence_on: string;
          completed_at: string;
        };
        Insert: {
          user_id: string;
          task_id: string;
          occurrence_on: string;
          completed_at?: string;
        };
        Update: { completed_at?: string };
        Relationships: [];
      };
      tasks: {
        Row: {
          id: string;
          user_id: string;
          rrule: string | null;
          excluded_dates: string[];
          title: string;
          notes: string;
          due_on: string | null;
          due_time: string | null;
          completed_at: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          user_id: string;
          rrule?: string | null;
          excluded_dates?: string[];
          title: string;
          notes?: string;
          due_on?: string | null;
          due_time?: string | null;
          completed_at?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          rrule?: string | null;
          excluded_dates?: string[];
          title?: string;
          notes?: string;
          due_on?: string | null;
          due_time?: string | null;
          completed_at?: string | null;
        };
        Relationships: [];
      };
      allowed_emails: {
        Row: {
          created_at: string;
          email: string;
        };
        Insert: {
          created_at?: string;
          email: string;
        };
        Update: {
          created_at?: string;
          email?: string;
        };
        Relationships: [];
      };
      budgets: {
        Row: {
          category_id: string | null;
          created_at: string;
          id: string;
          monthly_amount: number;
          updated_at: string;
          user_id: string;
        };
        Insert: {
          category_id?: string | null;
          created_at?: string;
          id?: string;
          monthly_amount: number;
          updated_at?: string;
          user_id: string;
        };
        Update: {
          category_id?: string | null;
          created_at?: string;
          id?: string;
          monthly_amount?: number;
          updated_at?: string;
          user_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: 'budgets_category_id_fkey';
            columns: ['category_id'];
            isOneToOne: false;
            referencedRelation: 'categories';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'budgets_category_owner';
            columns: ['user_id', 'category_id'];
            isOneToOne: false;
            referencedRelation: 'categories';
            referencedColumns: ['user_id', 'id'];
          },
        ];
      };
      categories: {
        Row: {
          color: string;
          created_at: string;
          icon: string | null;
          id: string;
          kind: string;
          name: string;
          sort_order: number;
          user_id: string;
        };
        Insert: {
          color?: string;
          created_at?: string;
          icon?: string | null;
          id?: string;
          kind: string;
          name: string;
          sort_order?: number;
          user_id: string;
        };
        Update: {
          color?: string;
          created_at?: string;
          icon?: string | null;
          id?: string;
          kind?: string;
          name?: string;
          sort_order?: number;
          user_id?: string;
        };
        Relationships: [];
      };
      event_completions: {
        Row: {
          amount_paid: number | null;
          completed_at: string;
          event_id: string;
          id: string;
          occurrence_at: string;
          status: string;
          user_id: string;
        };
        Insert: {
          amount_paid?: number | null;
          completed_at?: string;
          event_id: string;
          id?: string;
          occurrence_at: string;
          status?: string;
          user_id: string;
        };
        Update: {
          amount_paid?: number | null;
          completed_at?: string;
          event_id?: string;
          id?: string;
          occurrence_at?: string;
          status?: string;
          user_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: 'completions_event_owner';
            columns: ['user_id', 'event_id'];
            isOneToOne: false;
            referencedRelation: 'events';
            referencedColumns: ['user_id', 'id'];
          },
          {
            foreignKeyName: 'event_completions_event_id_fkey';
            columns: ['event_id'];
            isOneToOne: false;
            referencedRelation: 'events';
            referencedColumns: ['id'];
          },
        ];
      };
      events: {
        Row: {
          refill_on: string | null;
          refill_reminder_days: number;
          followup_minutes: number | null;
          excluded_dates: string[];
          active: boolean;
          all_day: boolean;
          amount: number | null;
          category_id: string | null;
          created_at: string;
          dose: string | null;
          ends_at: string | null;
          expense_category_id: string | null;
          google_event_id: string | null;
          google_sync_error: string | null;
          google_synced_at: string | null;
          group_id: string | null;
          id: string;
          location: string | null;
          notes: string | null;
          photo_path: string | null;
          reminder_minutes: number[];
          rrule: string | null;
          starts_at: string;
          timezone: string;
          title: string;
          type: string;
          updated_at: string;
          user_id: string;
        };
        Insert: {
          refill_on?: string | null;
          refill_reminder_days?: number;
          followup_minutes?: number | null;
          excluded_dates?: string[];
          active?: boolean;
          all_day?: boolean;
          amount?: number | null;
          category_id?: string | null;
          created_at?: string;
          dose?: string | null;
          ends_at?: string | null;
          expense_category_id?: string | null;
          google_event_id?: string | null;
          google_sync_error?: string | null;
          google_synced_at?: string | null;
          group_id?: string | null;
          id?: string;
          location?: string | null;
          notes?: string | null;
          photo_path?: string | null;
          reminder_minutes?: number[];
          rrule?: string | null;
          starts_at: string;
          timezone?: string;
          title: string;
          type: string;
          updated_at?: string;
          user_id: string;
        };
        Update: {
          refill_on?: string | null;
          refill_reminder_days?: number;
          followup_minutes?: number | null;
          excluded_dates?: string[];
          active?: boolean;
          all_day?: boolean;
          amount?: number | null;
          category_id?: string | null;
          created_at?: string;
          dose?: string | null;
          ends_at?: string | null;
          expense_category_id?: string | null;
          google_event_id?: string | null;
          google_sync_error?: string | null;
          google_synced_at?: string | null;
          group_id?: string | null;
          id?: string;
          location?: string | null;
          notes?: string | null;
          photo_path?: string | null;
          reminder_minutes?: number[];
          rrule?: string | null;
          starts_at?: string;
          timezone?: string;
          title?: string;
          type?: string;
          updated_at?: string;
          user_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: 'events_category_id_fkey';
            columns: ['category_id'];
            isOneToOne: false;
            referencedRelation: 'categories';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'events_category_owner';
            columns: ['user_id', 'category_id'];
            isOneToOne: false;
            referencedRelation: 'categories';
            referencedColumns: ['user_id', 'id'];
          },
          {
            foreignKeyName: 'events_expense_category_id_fkey';
            columns: ['expense_category_id'];
            isOneToOne: false;
            referencedRelation: 'categories';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'events_expense_category_owner';
            columns: ['user_id', 'expense_category_id'];
            isOneToOne: false;
            referencedRelation: 'categories';
            referencedColumns: ['user_id', 'id'];
          },
        ];
      };
      expenses: {
        Row: {
          amount: number;
          category_id: string | null;
          completion_id: string | null;
          created_at: string;
          event_id: string | null;
          id: string;
          note: string | null;
          spent_on: string;
          user_id: string;
        };
        Insert: {
          amount: number;
          category_id?: string | null;
          completion_id?: string | null;
          created_at?: string;
          event_id?: string | null;
          id?: string;
          note?: string | null;
          spent_on?: string;
          user_id: string;
        };
        Update: {
          amount?: number;
          category_id?: string | null;
          completion_id?: string | null;
          created_at?: string;
          event_id?: string | null;
          id?: string;
          note?: string | null;
          spent_on?: string;
          user_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: 'expenses_category_id_fkey';
            columns: ['category_id'];
            isOneToOne: false;
            referencedRelation: 'categories';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'expenses_category_owner';
            columns: ['user_id', 'category_id'];
            isOneToOne: false;
            referencedRelation: 'categories';
            referencedColumns: ['user_id', 'id'];
          },
          {
            foreignKeyName: 'expenses_completion_id_fkey';
            columns: ['completion_id'];
            isOneToOne: true;
            referencedRelation: 'event_completions';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'expenses_completion_owner';
            columns: ['user_id', 'completion_id'];
            isOneToOne: false;
            referencedRelation: 'event_completions';
            referencedColumns: ['user_id', 'id'];
          },
          {
            foreignKeyName: 'expenses_event_id_fkey';
            columns: ['event_id'];
            isOneToOne: false;
            referencedRelation: 'events';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'expenses_event_owner';
            columns: ['user_id', 'event_id'];
            isOneToOne: false;
            referencedRelation: 'events';
            referencedColumns: ['user_id', 'id'];
          },
        ];
      };
      google_tokens: {
        Row: {
          refresh_token: string;
          updated_at: string;
          user_id: string;
        };
        Insert: {
          refresh_token: string;
          updated_at?: string;
          user_id: string;
        };
        Update: {
          refresh_token?: string;
          updated_at?: string;
          user_id?: string;
        };
        Relationships: [];
      };
      integration_status: {
        Row: {
          google_connected: boolean;
          google_error: string | null;
          google_last_success: string | null;
          push_last_success: string | null;
          updated_at: string;
          user_id: string;
        };
        Insert: {
          google_connected?: boolean;
          google_error?: string | null;
          google_last_success?: string | null;
          push_last_success?: string | null;
          updated_at?: string;
          user_id: string;
        };
        Update: {
          google_connected?: boolean;
          google_error?: string | null;
          google_last_success?: string | null;
          push_last_success?: string | null;
          updated_at?: string;
          user_id?: string;
        };
        Relationships: [];
      };
      push_sent: {
        Row: {
          event_id: string;
          occurrence_at: string;
          sent_at: string;
        };
        Insert: {
          event_id: string;
          occurrence_at: string;
          sent_at?: string;
        };
        Update: {
          event_id?: string;
          occurrence_at?: string;
          sent_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: 'push_sent_event_id_fkey';
            columns: ['event_id'];
            isOneToOne: false;
            referencedRelation: 'events';
            referencedColumns: ['id'];
          },
        ];
      };
      push_subscriptions: {
        Row: {
          auth: string;
          created_at: string;
          endpoint: string;
          id: string;
          p256dh: string;
          user_agent: string | null;
          user_id: string;
        };
        Insert: {
          auth: string;
          created_at?: string;
          endpoint: string;
          id?: string;
          p256dh: string;
          user_agent?: string | null;
          user_id: string;
        };
        Update: {
          auth?: string;
          created_at?: string;
          endpoint?: string;
          id?: string;
          p256dh?: string;
          user_agent?: string | null;
          user_id?: string;
        };
        Relationships: [];
      };
      reminder_deliveries: {
        Row: {
          attempts: number;
          event_id: string;
          lead_minutes: number;
          lease_until: string;
          occurrence_at: string;
          sent_at: string | null;
          subscription_id: string;
          user_id: string;
        };
        Insert: {
          attempts?: number;
          event_id: string;
          lead_minutes: number;
          lease_until?: string;
          occurrence_at: string;
          sent_at?: string | null;
          subscription_id: string;
          user_id: string;
        };
        Update: {
          attempts?: number;
          event_id?: string;
          lead_minutes?: number;
          lease_until?: string;
          occurrence_at?: string;
          sent_at?: string | null;
          subscription_id?: string;
          user_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: 'reminder_deliveries_event_id_fkey';
            columns: ['event_id'];
            isOneToOne: false;
            referencedRelation: 'events';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'reminder_deliveries_subscription_id_fkey';
            columns: ['subscription_id'];
            isOneToOne: false;
            referencedRelation: 'push_subscriptions';
            referencedColumns: ['id'];
          },
        ];
      };
      sync_outbox: {
        Row: {
          action: string;
          attempts: number;
          available_at: string;
          created_at: string;
          event_id: string;
          google_event_id: string | null;
          id: number;
          last_error: string | null;
          lease_until: string | null;
          processed_at: string | null;
          user_id: string;
        };
        Insert: {
          action: string;
          attempts?: number;
          available_at?: string;
          created_at?: string;
          event_id: string;
          google_event_id?: string | null;
          id?: never;
          last_error?: string | null;
          lease_until?: string | null;
          processed_at?: string | null;
          user_id: string;
        };
        Update: {
          action?: string;
          attempts?: number;
          available_at?: string;
          created_at?: string;
          event_id?: string;
          google_event_id?: string | null;
          id?: never;
          last_error?: string | null;
          lease_until?: string | null;
          processed_at?: string | null;
          user_id?: string;
        };
        Relationships: [];
      };
      user_settings: {
        Row: {
          created_at: string;
          currency: string;
          google_calendar_id: string;
          locale: string;
          push_enabled: boolean;
          timezone: string;
          updated_at: string;
          user_id: string;
        };
        Insert: {
          created_at?: string;
          currency?: string;
          google_calendar_id?: string;
          locale?: string;
          push_enabled?: boolean;
          timezone?: string;
          updated_at?: string;
          user_id: string;
        };
        Update: {
          created_at?: string;
          currency?: string;
          google_calendar_id?: string;
          locale?: string;
          push_enabled?: boolean;
          timezone?: string;
          updated_at?: string;
          user_id?: string;
        };
        Relationships: [];
      };
      dose_snoozes: {
        Row: {
          user_id: string;
          event_id: string;
          occurrence_at: string;
          remind_at: string;
        };
        Insert: {
          user_id: string;
          event_id: string;
          occurrence_at: string;
          remind_at: string;
        };
        Update: {
          user_id?: string;
          event_id?: string;
          occurrence_at?: string;
          remind_at?: string;
        };
        Relationships: [];
      };
      family_shares: {
        Row: {
          id: string;
          user_id: string;
          email: string;
          medications: boolean;
          appointments: boolean;
          bills: boolean;
          created_at: string;
        };
        Insert: {
          id?: string;
          user_id: string;
          email: string;
          medications?: boolean;
          appointments?: boolean;
          bills?: boolean;
          created_at?: string;
        };
        Update: {
          id?: string;
          user_id?: string;
          email?: string;
          medications?: boolean;
          appointments?: boolean;
          bills?: boolean;
          created_at?: string;
        };
        Relationships: [];
      };
      worker_leases: {
        Row: {
          lease_until: string;
          name: string;
          owner: string;
          user_id: string | null;
        };
        Insert: {
          lease_until: string;
          name: string;
          owner: string;
          user_id?: string | null;
        };
        Update: {
          lease_until?: string;
          name?: string;
          owner?: string;
          user_id?: string | null;
        };
        Relationships: [];
      };
    };
    Views: {
      monthly_spend: {
        Row: {
          category_id: string | null;
          month: string | null;
          total: number | null;
          user_id: string | null;
        };
        Relationships: [
          {
            foreignKeyName: 'expenses_category_id_fkey';
            columns: ['category_id'];
            isOneToOne: false;
            referencedRelation: 'categories';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'expenses_category_owner';
            columns: ['user_id', 'category_id'];
            isOneToOne: false;
            referencedRelation: 'categories';
            referencedColumns: ['user_id', 'id'];
          },
        ];
      };
    };
    Functions: {
      edit_task_occurrence: {
        Args: {
          p_task_id: string;
          p_day: string;
          p_scope: string;
          p_input?: Json;
        };
        Returns: string;
      };
      edit_event_occurrence: {
        Args: {
          p_event_id: string;
          p_occurrence_at: string;
          p_scope: string;
          p_input?: Json;
        };
        Returns: string;
      };
      create_recurring_expense: { Args: { p_input: Json }; Returns: string };

      share_with_family: {
        Args: {
          p_email: string;
          p_medications: boolean;
          p_appointments: boolean;
          p_bills: boolean;
        };
        Returns: string;
      };
      read_family_view: { Args: Record<string, never>; Returns: Json };
      save_appointment_occurrence: {
        Args: { p_event_id: string; p_occurrence_at: string; p_input: Json };
        Returns: string | null;
      };
      claim_reminder: {
        Args: {
          p_event_id: string;
          p_lead_minutes: number;
          p_occurrence_at: string;
          p_subscription_id: string;
          p_user_id: string;
        };
        Returns: boolean;
      };
      claim_sync_jobs: {
        Args: { p_limit?: number; p_user_id?: string };
        Returns: {
          action: string;
          attempts: number;
          available_at: string;
          created_at: string;
          event_id: string;
          google_event_id: string | null;
          id: number;
          last_error: string | null;
          lease_until: string | null;
          processed_at: string | null;
          user_id: string;
        }[];
        SetofOptions: {
          from: '*';
          to: 'sync_outbox';
          isOneToOne: false;
          isSetofReturn: true;
        };
      };
      claim_worker: {
        Args: { p_name: string; p_owner: string };
        Returns: boolean;
      };
      delete_medication_group: {
        Args: { p_group_id: string };
        Returns: undefined;
      };
      dispatch_reminder_worker: {
        Args: { p_function: string };
        Returns: number;
      };
      mark_bill_paid: {
        Args: {
          p_amount_paid?: number;
          p_event_id: string;
          p_occurrence_at: string;
          p_paid_on?: string;
        };
        Returns: string;
      };
      save_medication_group: {
        Args: { p_group_id: string; p_rows: Json };
        Returns: string;
      };
      save_medication_with_photo: {
        Args: { p_group_id: string; p_photo_path?: string; p_rows: Json };
        Returns: string;
      };
    };
    Enums: {
      [_ in never]: never;
    };
    CompositeTypes: {
      [_ in never]: never;
    };
  };
};

type DatabaseWithoutInternals = Omit<Database, '__InternalSupabase'>;

type DefaultSchema = DatabaseWithoutInternals[Extract<
  keyof Database,
  'public'
>];

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema['Tables'] & DefaultSchema['Views'])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions['schema']]['Tables'] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions['schema']]['Views'])
    : never) = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals;
}
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions['schema']]['Tables'] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions['schema']]['Views'])[TableName] extends {
      Row: infer R;
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema['Tables'] &
        DefaultSchema['Views'])
    ? (DefaultSchema['Tables'] &
        DefaultSchema['Views'])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R;
      }
      ? R
      : never
    : never;

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    keyof DefaultSchema['Tables'] | { schema: keyof DatabaseWithoutInternals },
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions['schema']]['Tables']
    : never) = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals;
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions['schema']]['Tables'][TableName] extends {
      Insert: infer I;
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema['Tables']
    ? DefaultSchema['Tables'][DefaultSchemaTableNameOrOptions] extends {
        Insert: infer I;
      }
      ? I
      : never
    : never;

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    keyof DefaultSchema['Tables'] | { schema: keyof DatabaseWithoutInternals },
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions['schema']]['Tables']
    : never) = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals;
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions['schema']]['Tables'][TableName] extends {
      Update: infer U;
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema['Tables']
    ? DefaultSchema['Tables'][DefaultSchemaTableNameOrOptions] extends {
        Update: infer U;
      }
      ? U
      : never
    : never;

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    keyof DefaultSchema['Enums'] | { schema: keyof DatabaseWithoutInternals },
  EnumName extends (DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions['schema']]['Enums']
    : never) = never,
> = DefaultSchemaEnumNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals;
}
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions['schema']]['Enums'][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema['Enums']
    ? DefaultSchema['Enums'][DefaultSchemaEnumNameOrOptions]
    : never;

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema['CompositeTypes']
    | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends (PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions['schema']]['CompositeTypes']
    : never) = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals;
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions['schema']]['CompositeTypes'][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema['CompositeTypes']
    ? DefaultSchema['CompositeTypes'][PublicCompositeTypeNameOrOptions]
    : never;

export const Constants = {
  graphql_public: {
    Enums: {},
  },
  public: {
    Enums: {},
  },
} as const;
