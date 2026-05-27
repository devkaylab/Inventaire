export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
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
          id: string
          label: string
          sku: string
          unit_purchase_price: number
          updated_at: string
        }
        Insert: {
          brand?: string
          ean?: string | null
          id?: string
          label?: string
          sku: string
          unit_purchase_price?: number
          updated_at?: string
        }
        Update: {
          brand?: string
          ean?: string | null
          id?: string
          label?: string
          sku?: string
          unit_purchase_price?: number
          updated_at?: string
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
          created_at: string
          created_by: string
          current_pass: number
          id: string
          inventory_number: string
          security_code_hash: string
          status: string
          store_name: string
        }
        Insert: {
          closed_at?: string | null
          created_at?: string
          created_by: string
          current_pass?: number
          id?: string
          inventory_number: string
          security_code_hash: string
          status?: string
          store_name: string
        }
        Update: {
          closed_at?: string | null
          created_at?: string
          created_by?: string
          current_pass?: number
          id?: string
          inventory_number?: string
          security_code_hash?: string
          status?: string
          store_name?: string
        }
        Relationships: [
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
          created_at: string
          full_name: string
          id: string
          role: string
        }
        Insert: {
          created_at?: string
          full_name?: string
          id: string
          role?: string
        }
        Update: {
          created_at?: string
          full_name?: string
          id?: string
          role?: string
        }
        Relationships: []
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
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      advance_pass: { Args: { p_session_id: string }; Returns: Json }
      create_session: {
        Args: { p_security_code: string; p_store_name: string }
        Returns: Json
      }
      get_my_role: { Args: Record<PropertyKey, never>; Returns: string }
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
      join_session: {
        Args: { p_inventory_number: string; p_security_code: string }
        Returns: Json
      }
      recompute_session_audit: { Args: { p_session_id: string }; Returns: Json }
      resolve_audit: {
        Args: { p_final_qty: number; p_session_id: string; p_sku: string }
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
