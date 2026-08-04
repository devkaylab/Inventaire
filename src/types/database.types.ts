export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  // Allows to automatically instantiate createClient with right options
  // instead of createClient<Database, { PostgrestVersion: 'XX' }>(URL, KEY)
  __InternalSupabase: {
    PostgrestVersion: "14.5"
  }
  public: {
    Tables: {
      article_audit: {
        Row: {
          final_qty: number | null
          id: string
          qty_pass1: number | null
          qty_pass2: number | null
          qty_pass3: number | null
          resolved_by: string | null
          session_id: string
          sku: string
          status: string
          updated_at: string
          zone: string
        }
        Insert: {
          final_qty?: number | null
          id?: string
          qty_pass1?: number | null
          qty_pass2?: number | null
          qty_pass3?: number | null
          resolved_by?: string | null
          session_id: string
          sku: string
          status?: string
          updated_at?: string
          zone?: string
        }
        Update: {
          final_qty?: number | null
          id?: string
          qty_pass1?: number | null
          qty_pass2?: number | null
          qty_pass3?: number | null
          resolved_by?: string | null
          session_id?: string
          sku?: string
          status?: string
          updated_at?: string
          zone?: string
        }
        Relationships: [
          {
            foreignKeyName: "article_audit_resolved_by_fkey"
            columns: ["resolved_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "article_audit_session_id_fkey"
            columns: ["session_id"]
            isOneToOne: false
            referencedRelation: "inventory_sessions"
            referencedColumns: ["id"]
          },
        ]
      }
      articles: {
        Row: {
          brand: string
          ean: string | null
          ean_norm: string | null
          id: string
          label: string
          session_id: string
          sku: string
          unit_purchase_price: number
          updated_at: string
        }
        Insert: {
          brand?: string
          ean?: string | null
          ean_norm?: string | null
          id?: string
          label?: string
          session_id: string
          sku: string
          unit_purchase_price?: number
          updated_at?: string
        }
        Update: {
          brand?: string
          ean?: string | null
          ean_norm?: string | null
          id?: string
          label?: string
          session_id?: string
          sku?: string
          unit_purchase_price?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "articles_session_id_fkey"
            columns: ["session_id"]
            isOneToOne: false
            referencedRelation: "inventory_sessions"
            referencedColumns: ["id"]
          },
        ]
      }
      companies: {
        Row: {
          balise_count: number
          created_at: string
          id: string
          join_code: string
          name: string
        }
        Insert: {
          balise_count?: number
          created_at?: string
          id?: string
          join_code: string
          name: string
        }
        Update: {
          balise_count?: number
          created_at?: string
          id?: string
          join_code?: string
          name?: string
        }
        Relationships: []
      }
      counts: {
        Row: {
          counted_by: string
          created_at: string
          id: string
          pass_number: number
          qty: number
          session_id: string
          sku: string
          zone: string | null
        }
        Insert: {
          counted_by: string
          created_at?: string
          id?: string
          pass_number: number
          qty?: number
          session_id: string
          sku: string
          zone?: string | null
        }
        Update: {
          counted_by?: string
          created_at?: string
          id?: string
          pass_number?: number
          qty?: number
          session_id?: string
          sku?: string
          zone?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "counts_counted_by_fkey"
            columns: ["counted_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "counts_session_id_fkey"
            columns: ["session_id"]
            isOneToOne: false
            referencedRelation: "inventory_sessions"
            referencedColumns: ["id"]
          },
        ]
      }
      inventory_sessions: {
        Row: {
          closed_at: string | null
          company_id: string
          created_at: string
          created_by: string
          current_pass: number
          id: string
          inventory_number: string
          name: string
          security_code: string | null
          security_code_hash: string
          status: string
          store_name: string
          uses_zones: boolean
        }
        Insert: {
          closed_at?: string | null
          company_id: string
          created_at?: string
          created_by: string
          current_pass?: number
          id?: string
          inventory_number: string
          name?: string
          security_code?: string | null
          security_code_hash: string
          status?: string
          store_name: string
          uses_zones?: boolean
        }
        Update: {
          closed_at?: string | null
          company_id?: string
          created_at?: string
          created_by?: string
          current_pass?: number
          id?: string
          inventory_number?: string
          name?: string
          security_code?: string | null
          security_code_hash?: string
          status?: string
          store_name?: string
          uses_zones?: boolean
        }
        Relationships: [
          {
            foreignKeyName: "inventory_sessions_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "inventory_sessions_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          company_id: string | null
          created_at: string
          full_name: string
          id: string
          is_admin: boolean
          role: string
        }
        Insert: {
          company_id?: string | null
          created_at?: string
          full_name?: string
          id: string
          is_admin?: boolean
          role?: string
        }
        Update: {
          company_id?: string | null
          created_at?: string
          full_name?: string
          id?: string
          is_admin?: boolean
          role?: string
        }
        Relationships: [
          {
            foreignKeyName: "profiles_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
        ]
      }
      session_members: {
        Row: {
          joined_at: string
          session_id: string
          user_id: string
        }
        Insert: {
          joined_at?: string
          session_id: string
          user_id: string
        }
        Update: {
          joined_at?: string
          session_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "session_members_session_id_fkey"
            columns: ["session_id"]
            isOneToOne: false
            referencedRelation: "inventory_sessions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "session_members_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      stores: {
        Row: {
          company_id: string
          created_at: string
          id: string
          name: string
        }
        Insert: {
          company_id: string
          created_at?: string
          id?: string
          name: string
        }
        Update: {
          company_id?: string
          created_at?: string
          id?: string
          name?: string
        }
        Relationships: [
          {
            foreignKeyName: "stores_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
        ]
      }
      team_invitations: {
        Row: {
          company_id: string
          created_at: string
          created_by: string
          email: string
          full_name: string
          id: string
        }
        Insert: {
          company_id: string
          created_at?: string
          created_by: string
          email: string
          full_name?: string
          id?: string
        }
        Update: {
          company_id?: string
          created_at?: string
          created_by?: string
          email?: string
          full_name?: string
          id?: string
        }
        Relationships: [
          {
            foreignKeyName: "team_invitations_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "team_invitations_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      theoretical_stock: {
        Row: {
          id: string
          session_id: string
          sku: string
          theoretical_qty: number
        }
        Insert: {
          id?: string
          session_id: string
          sku: string
          theoretical_qty?: number
        }
        Update: {
          id?: string
          session_id?: string
          sku?: string
          theoretical_qty?: number
        }
        Relationships: [
          {
            foreignKeyName: "theoretical_stock_session_id_fkey"
            columns: ["session_id"]
            isOneToOne: false
            referencedRelation: "inventory_sessions"
            referencedColumns: ["id"]
          },
        ]
      }
      zones: {
        Row: {
          audit_done_at: string | null
          audit_status: string
          code: string
          count_done_at: string | null
          count_status: string
          created_at: string
          id: string
          name: string | null
          session_id: string
          status: string
        }
        Insert: {
          audit_done_at?: string | null
          audit_status?: string
          code: string
          count_done_at?: string | null
          count_status?: string
          created_at?: string
          id?: string
          name?: string | null
          session_id: string
          status?: string
        }
        Update: {
          audit_done_at?: string | null
          audit_status?: string
          code?: string
          count_done_at?: string | null
          count_status?: string
          created_at?: string
          id?: string
          name?: string | null
          session_id?: string
          status?: string
        }
        Relationships: [
          {
            foreignKeyName: "zones_session_id_fkey"
            columns: ["session_id"]
            isOneToOne: false
            referencedRelation: "inventory_sessions"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      admin_add_store: {
        Args: { p_company_id: string; p_name: string }
        Returns: Json
      }
      admin_create_company: { Args: { p_name: string }; Returns: Json }
      advance_pass: { Args: { p_session_id: string }; Returns: Json }
      check_invitation: { Args: { p_email: string }; Returns: boolean }
      create_company: { Args: { p_name: string }; Returns: Json }
      create_session: {
        Args: {
          p_name: string
          p_security_code: string
          p_store_id: string
          p_uses_zones?: boolean
        }
        Returns: Json
      }
      define_zone: {
        Args: {
          p_code_end: number
          p_code_start: number
          p_name: string
          p_session_id: string
        }
        Returns: Json
      }
      delete_audit_line: {
        Args: { p_session_id: string; p_sku: string; p_zone?: string }
        Returns: Json
      }
      delete_session: { Args: { p_session_id: string }; Returns: Json }
      delete_zone: {
        Args: { p_name: string; p_session_id: string }
        Returns: Json
      }
      ensure_zone: {
        Args: { p_code: string; p_session_id: string }
        Returns: Json
      }
      gen_company_code: { Args: never; Returns: string }
      generate_zones: {
        Args: { p_count: number; p_session_id: string }
        Returns: Json
      }
      get_my_company: { Args: never; Returns: string }
      get_my_role: { Args: never; Returns: string }
      get_session_detail: {
        Args: { p_session_id: string }
        Returns: {
          audited: boolean
          audited_by: string
          audited_qty: number
          brand: string
          counted_by: string
          counted_qty: number
          ean: string
          label: string
          sku: string
          zone: string
          zone_name: string
        }[]
      }
      get_session_results: {
        Args: { p_session_id: string }
        Returns: {
          brand: string
          counted_qty: number
          ean: string
          label: string
          sku: string
          status: string
          theoretical_qty: number
          unit_purchase_price: number
          variance_units: number
          variance_value: number
        }[]
      }
      get_zone_dashboard: {
        Args: { p_session_id: string }
        Returns: {
          audit_lines: number
          audit_status: string
          audit_units: number
          code: string
          count_lines: number
          count_status: string
          count_units: number
          id: string
          name: string
        }[]
      }
      get_zone_progress: {
        Args: { p_session_id: string }
        Returns: {
          code: string
          counters: number
          id: string
          lines: number
          status: string
          units: number
        }[]
      }
      is_admin: { Args: never; Returns: boolean }
      join_company: { Args: { p_code: string }; Returns: Json }
      join_session: {
        Args: { p_inventory_number: string; p_security_code: string }
        Returns: Json
      }
      recompute_session_audit: { Args: { p_session_id: string }; Returns: Json }
      resolve_audit: {
        Args: { p_final_qty: number; p_session_id: string; p_sku: string; p_zone?: string }
        Returns: Json
      }
      revert_pass: {
        Args: { p_delete_counts?: boolean; p_session_id: string }
        Returns: Json
      }
      set_zone_status: {
        Args: { p_status: string; p_zone_id: string }
        Returns: Json
      }
      generate_company_balises: {
        Args: { p_count: number }
        Returns: Json
      }
      norm_balise: { Args: { p: string }; Returns: string }
      register_balise: {
        Args: { p_code: string; p_name: string; p_session_id: string }
        Returns: Json
      }
      set_balise: {
        Args: {
          p_allow_create?: boolean
          p_code: string
          p_mode: string
          p_open: boolean
          p_session_id: string
        }
        Returns: Json
      }
    }
    Enums: {
      [_ in never]: never
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}

type DatabaseWithoutInternals = Omit<Database, "__InternalSupabase">

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, "public">]

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] &
        DefaultSchema["Views"])
    ? (DefaultSchema["Tables"] &
        DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R
      }
      ? R
      : never
    : never

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Insert: infer I
      }
      ? I
      : never
    : never

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Update: infer U
      }
      ? U
      : never
    : never

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    | keyof DefaultSchema["Enums"]
    | { schema: keyof DatabaseWithoutInternals },
  EnumName extends DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never = never,
> = DefaultSchemaEnumNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
    ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
    : never

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema["CompositeTypes"]
    | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never

export const Constants = {
  public: {
    Enums: {},
  },
} as const
