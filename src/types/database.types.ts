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
      account_deletion_requests: {
        Row: {
          company_id: string | null
          created_at: string
          email: string | null
          full_name: string | null
          id: string
          role: string | null
          status: string
          user_id: string
        }
        Insert: {
          company_id?: string | null
          created_at?: string
          email?: string | null
          full_name?: string | null
          id?: string
          role?: string | null
          status?: string
          user_id: string
        }
        Update: {
          company_id?: string | null
          created_at?: string
          email?: string | null
          full_name?: string | null
          id?: string
          role?: string | null
          status?: string
          user_id?: string
        }
        Relationships: []
      }
      admin_audit_log: {
        Row: {
          action: string
          actor_id: string | null
          actor_label: string
          created_at: string
          details: Json
          id: number
          target_id: string
          target_label: string
          target_type: string
        }
        Insert: {
          action: string
          actor_id?: string | null
          actor_label?: string
          created_at?: string
          details?: Json
          id?: never
          target_id?: string
          target_label?: string
          target_type?: string
        }
        Update: {
          action?: string
          actor_id?: string | null
          actor_label?: string
          created_at?: string
          details?: Json
          id?: never
          target_id?: string
          target_label?: string
          target_type?: string
        }
        Relationships: []
      }
      alertes_envoyees: {
        Row: {
          cle: string
          derniere_le: string
          nombre: number
          premiere_le: string
        }
        Insert: {
          cle: string
          derniere_le?: string
          nombre?: number
          premiere_le?: string
        }
        Update: {
          cle?: string
          derniere_le?: string
          nombre?: number
          premiere_le?: string
        }
        Relationships: []
      }
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
      audit_empreintes: {
        Row: {
          calcule_le: string
          comptages: number
          session_id: string
        }
        Insert: {
          calcule_le?: string
          comptages: number
          session_id: string
        }
        Update: {
          calcule_le?: string
          comptages?: number
          session_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "audit_empreintes_session_id_fkey"
            columns: ["session_id"]
            isOneToOne: true
            referencedRelation: "inventory_sessions"
            referencedColumns: ["id"]
          },
        ]
      }
      companies: {
        Row: {
          balise_count: number
          billing_period: string | null
          created_at: string
          id: string
          join_code: string
          license_status: string
          name: string
          plan: string
          stripe_customer_id: string | null
          stripe_subscription_id: string | null
        }
        Insert: {
          balise_count?: number
          billing_period?: string | null
          created_at?: string
          id?: string
          join_code: string
          license_status?: string
          name: string
          plan?: string
          stripe_customer_id?: string | null
          stripe_subscription_id?: string | null
        }
        Update: {
          balise_count?: number
          billing_period?: string | null
          created_at?: string
          id?: string
          join_code?: string
          license_status?: string
          name?: string
          plan?: string
          stripe_customer_id?: string | null
          stripe_subscription_id?: string | null
        }
        Relationships: []
      }
      company_audit_log: {
        Row: {
          action: string
          actor_id: string | null
          actor_label: string
          company_id: string
          created_at: string
          details: Json
          id: number
          target_label: string
        }
        Insert: {
          action: string
          actor_id?: string | null
          actor_label?: string
          company_id: string
          created_at?: string
          details?: Json
          id?: never
          target_label?: string
        }
        Update: {
          action?: string
          actor_id?: string | null
          actor_label?: string
          company_id?: string
          created_at?: string
          details?: Json
          id?: never
          target_label?: string
        }
        Relationships: [
          {
            foreignKeyName: "company_audit_log_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
        ]
      }
      company_requests: {
        Row: {
          accepted_at: string | null
          admin_note: string
          ape: string | null
          billing_period: string | null
          company_id: string | null
          company_name: string
          contact_email: string
          contact_first_name: string
          contact_last_name: string
          contact_phone: string
          created_at: string
          decline_reason: string
          declined_at: string | null
          id: string
          message: string
          paid_at: string | null
          plan: string | null
          quote_amount_cents: number | null
          quote_expires_at: string | null
          quote_lines: Json
          quote_reference: string
          quote_sent_at: string | null
          quote_token: string | null
          siren: string | null
          status: string
          store_count: number
          stores: Json
          stripe_checkout_session_id: string | null
          stripe_customer_id: string | null
          stripe_invoice_id: string | null
          stripe_payment_intent_id: string | null
          updated_at: string
        }
        Insert: {
          accepted_at?: string | null
          admin_note?: string
          ape?: string | null
          billing_period?: string | null
          company_id?: string | null
          company_name: string
          contact_email: string
          contact_first_name: string
          contact_last_name: string
          contact_phone?: string
          created_at?: string
          decline_reason?: string
          declined_at?: string | null
          id?: string
          message?: string
          paid_at?: string | null
          plan?: string | null
          quote_amount_cents?: number | null
          quote_expires_at?: string | null
          quote_lines?: Json
          quote_reference?: string
          quote_sent_at?: string | null
          quote_token?: string | null
          siren?: string | null
          status?: string
          store_count: number
          stores?: Json
          stripe_checkout_session_id?: string | null
          stripe_customer_id?: string | null
          stripe_invoice_id?: string | null
          stripe_payment_intent_id?: string | null
          updated_at?: string
        }
        Update: {
          accepted_at?: string | null
          admin_note?: string
          ape?: string | null
          billing_period?: string | null
          company_id?: string | null
          company_name?: string
          contact_email?: string
          contact_first_name?: string
          contact_last_name?: string
          contact_phone?: string
          created_at?: string
          decline_reason?: string
          declined_at?: string | null
          id?: string
          message?: string
          paid_at?: string | null
          plan?: string | null
          quote_amount_cents?: number | null
          quote_expires_at?: string | null
          quote_lines?: Json
          quote_reference?: string
          quote_sent_at?: string | null
          quote_token?: string | null
          siren?: string | null
          status?: string
          store_count?: number
          stores?: Json
          stripe_checkout_session_id?: string | null
          stripe_customer_id?: string | null
          stripe_invoice_id?: string | null
          stripe_payment_intent_id?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "company_requests_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
        ]
      }
      counts: {
        Row: {
          counted_by: string | null
          created_at: string
          id: string
          pass_number: number
          qty: number
          session_id: string
          sku: string
          zone: string | null
        }
        Insert: {
          counted_by?: string | null
          created_at?: string
          id?: string
          pass_number: number
          qty?: number
          session_id: string
          sku: string
          zone?: string | null
        }
        Update: {
          counted_by?: string | null
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
          created_by: string | null
          current_pass: number
          id: string
          inventory_number: string
          name: string
          security_code: string | null
          security_code_hash: string
          status: string
          store_id: string
          store_name: string
          uses_zones: boolean
        }
        Insert: {
          closed_at?: string | null
          company_id: string
          created_at?: string
          created_by?: string | null
          current_pass?: number
          id?: string
          inventory_number: string
          name?: string
          security_code?: string | null
          security_code_hash: string
          status?: string
          store_id: string
          store_name: string
          uses_zones?: boolean
        }
        Update: {
          closed_at?: string | null
          company_id?: string
          created_at?: string
          created_by?: string | null
          current_pass?: number
          id?: string
          inventory_number?: string
          name?: string
          security_code?: string | null
          security_code_hash?: string
          status?: string
          store_id?: string
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
          {
            foreignKeyName: "inventory_sessions_store_id_fkey"
            columns: ["store_id"]
            isOneToOne: false
            referencedRelation: "stores"
            referencedColumns: ["id"]
          },
        ]
      }
      message_fils: {
        Row: {
          company_id: string | null
          cree_le: string
          cree_par: string | null
          dernier_le: string
          id: string
          portee: string
          sujet: string
        }
        Insert: {
          company_id?: string | null
          cree_le?: string
          cree_par?: string | null
          dernier_le?: string
          id?: string
          portee: string
          sujet: string
        }
        Update: {
          company_id?: string | null
          cree_le?: string
          cree_par?: string | null
          dernier_le?: string
          id?: string
          portee?: string
          sujet?: string
        }
        Relationships: [
          {
            foreignKeyName: "message_fils_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "message_fils_cree_par_fkey"
            columns: ["cree_par"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      message_participants: {
        Row: {
          fil_id: string
          lu_le: string | null
          user_id: string
        }
        Insert: {
          fil_id: string
          lu_le?: string | null
          user_id: string
        }
        Update: {
          fil_id?: string
          lu_le?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "message_participants_fil_id_fkey"
            columns: ["fil_id"]
            isOneToOne: false
            referencedRelation: "message_fils"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "message_participants_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      messages: {
        Row: {
          auteur: string | null
          auteur_interne: boolean
          auteur_label: string
          corps: string
          cree_le: string
          fil_id: string
          id: number
        }
        Insert: {
          auteur?: string | null
          auteur_interne?: boolean
          auteur_label?: string
          corps: string
          cree_le?: string
          fil_id: string
          id?: never
        }
        Update: {
          auteur?: string | null
          auteur_interne?: boolean
          auteur_label?: string
          corps?: string
          cree_le?: string
          fil_id?: string
          id?: never
        }
        Relationships: [
          {
            foreignKeyName: "messages_auteur_fkey"
            columns: ["auteur"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "messages_fil_id_fkey"
            columns: ["fil_id"]
            isOneToOne: false
            referencedRelation: "message_fils"
            referencedColumns: ["id"]
          },
        ]
      }
      notifications: {
        Row: {
          created_at: string
          donnees: Json
          id: number
          read_at: string | null
          type: string
          user_id: string
        }
        Insert: {
          created_at?: string
          donnees?: Json
          id?: never
          read_at?: string | null
          type: string
          user_id: string
        }
        Update: {
          created_at?: string
          donnees?: Json
          id?: never
          read_at?: string | null
          type?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "notifications_user_id_fkey"
            columns: ["user_id"]
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
          first_name: string
          full_name: string
          id: string
          is_admin: boolean
          is_company_admin: boolean
          last_name: string
          role: string
        }
        Insert: {
          company_id?: string | null
          created_at?: string
          first_name?: string
          full_name?: string
          id: string
          is_admin?: boolean
          is_company_admin?: boolean
          last_name?: string
          role?: string
        }
        Update: {
          company_id?: string | null
          created_at?: string
          first_name?: string
          full_name?: string
          id?: string
          is_admin?: boolean
          is_company_admin?: boolean
          last_name?: string
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
      push_tokens: {
        Row: {
          platform: string | null
          token: string
          updated_at: string
          user_id: string
        }
        Insert: {
          platform?: string | null
          token: string
          updated_at?: string
          user_id: string
        }
        Update: {
          platform?: string | null
          token?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "push_tokens_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      session_invitations: {
        Row: {
          company_id: string
          created_at: string
          created_by: string | null
          email: string
          full_name: string
          id: string
          role: string
          session_id: string
        }
        Insert: {
          company_id: string
          created_at?: string
          created_by?: string | null
          email: string
          full_name?: string
          id?: string
          role?: string
          session_id: string
        }
        Update: {
          company_id?: string
          created_at?: string
          created_by?: string | null
          email?: string
          full_name?: string
          id?: string
          role?: string
          session_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "session_invitations_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "session_invitations_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "session_invitations_session_id_fkey"
            columns: ["session_id"]
            isOneToOne: false
            referencedRelation: "inventory_sessions"
            referencedColumns: ["id"]
          },
        ]
      }
      session_members: {
        Row: {
          joined_at: string
          role: string
          session_id: string
          user_id: string
        }
        Insert: {
          joined_at?: string
          role?: string
          session_id: string
          user_id: string
        }
        Update: {
          joined_at?: string
          role?: string
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
      store_requests: {
        Row: {
          accepted_at: string | null
          admin_note: string
          billing_period: string | null
          company_id: string
          created_at: string
          decline_reason: string
          declined_at: string | null
          devices: number | null
          handled_at: string | null
          id: string
          kind: string
          message: string
          paid_at: string | null
          quote_amount_cents: number | null
          quote_expires_at: string | null
          quote_lines: Json
          quote_reference: string
          quote_sent_at: string | null
          quote_token: string | null
          requested_by: string | null
          requested_label: string
          sqm: number | null
          status: string
          store_id: string | null
          store_name: string
          stripe_checkout_session_id: string | null
          stripe_customer_id: string | null
          stripe_invoice_id: string | null
          stripe_payment_intent_id: string | null
          units: number | null
        }
        Insert: {
          accepted_at?: string | null
          admin_note?: string
          billing_period?: string | null
          company_id: string
          created_at?: string
          decline_reason?: string
          declined_at?: string | null
          devices?: number | null
          handled_at?: string | null
          id?: string
          kind?: string
          message?: string
          paid_at?: string | null
          quote_amount_cents?: number | null
          quote_expires_at?: string | null
          quote_lines?: Json
          quote_reference?: string
          quote_sent_at?: string | null
          quote_token?: string | null
          requested_by?: string | null
          requested_label?: string
          sqm?: number | null
          status?: string
          store_id?: string | null
          store_name: string
          stripe_checkout_session_id?: string | null
          stripe_customer_id?: string | null
          stripe_invoice_id?: string | null
          stripe_payment_intent_id?: string | null
          units?: number | null
        }
        Update: {
          accepted_at?: string | null
          admin_note?: string
          billing_period?: string | null
          company_id?: string
          created_at?: string
          decline_reason?: string
          declined_at?: string | null
          devices?: number | null
          handled_at?: string | null
          id?: string
          kind?: string
          message?: string
          paid_at?: string | null
          quote_amount_cents?: number | null
          quote_expires_at?: string | null
          quote_lines?: Json
          quote_reference?: string
          quote_sent_at?: string | null
          quote_token?: string | null
          requested_by?: string | null
          requested_label?: string
          sqm?: number | null
          status?: string
          store_id?: string | null
          store_name?: string
          stripe_checkout_session_id?: string | null
          stripe_customer_id?: string | null
          stripe_invoice_id?: string | null
          stripe_payment_intent_id?: string | null
          units?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "store_requests_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "store_requests_requested_by_fkey"
            columns: ["requested_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "store_requests_store_id_fkey"
            columns: ["store_id"]
            isOneToOne: false
            referencedRelation: "stores"
            referencedColumns: ["id"]
          },
        ]
      }
      store_supervisors: {
        Row: {
          created_at: string
          store_id: string
          user_id: string
        }
        Insert: {
          created_at?: string
          store_id: string
          user_id: string
        }
        Update: {
          created_at?: string
          store_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "store_supervisors_store_id_fkey"
            columns: ["store_id"]
            isOneToOne: false
            referencedRelation: "stores"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "store_supervisors_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      store_team: {
        Row: {
          created_at: string
          store_id: string
          user_id: string
        }
        Insert: {
          created_at?: string
          store_id: string
          user_id: string
        }
        Update: {
          created_at?: string
          store_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "store_team_store_id_fkey"
            columns: ["store_id"]
            isOneToOne: false
            referencedRelation: "stores"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "store_team_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      stores: {
        Row: {
          annual_price_cents: number | null
          company_id: string
          created_at: string
          devices: number | null
          id: string
          join_code: string
          name: string
          sqm: number | null
          units: number | null
        }
        Insert: {
          annual_price_cents?: number | null
          company_id: string
          created_at?: string
          devices?: number | null
          id?: string
          join_code: string
          name: string
          sqm?: number | null
          units?: number | null
        }
        Update: {
          annual_price_cents?: number | null
          company_id?: string
          created_at?: string
          devices?: number | null
          id?: string
          join_code?: string
          name?: string
          sqm?: number | null
          units?: number | null
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
      stripe_events_traites: {
        Row: {
          event_id: string
          recu_le: string
        }
        Insert: {
          event_id: string
          recu_le?: string
        }
        Update: {
          event_id?: string
          recu_le?: string
        }
        Relationships: []
      }
      submission_attempts: {
        Row: {
          created_at: string
          id: number
          key: string
          scope: string
        }
        Insert: {
          created_at?: string
          id?: number
          key: string
          scope: string
        }
        Update: {
          created_at?: string
          id?: number
          key?: string
          scope?: string
        }
        Relationships: []
      }
      supervisor_requests: {
        Row: {
          admin_note: string
          company_id: string
          created_at: string
          email: string
          first_name: string
          id: string
          last_name: string
          phone: string
          reviewed_at: string | null
          reviewed_by: string | null
          status: string
          store_id: string
          user_id: string | null
        }
        Insert: {
          admin_note?: string
          company_id: string
          created_at?: string
          email: string
          first_name: string
          id?: string
          last_name: string
          phone?: string
          reviewed_at?: string | null
          reviewed_by?: string | null
          status?: string
          store_id: string
          user_id?: string | null
        }
        Update: {
          admin_note?: string
          company_id?: string
          created_at?: string
          email?: string
          first_name?: string
          id?: string
          last_name?: string
          phone?: string
          reviewed_at?: string | null
          reviewed_by?: string | null
          status?: string
          store_id?: string
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "supervisor_requests_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "supervisor_requests_reviewed_by_fkey"
            columns: ["reviewed_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "supervisor_requests_store_id_fkey"
            columns: ["store_id"]
            isOneToOne: false
            referencedRelation: "stores"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "supervisor_requests_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      team_invitations: {
        Row: {
          company_id: string
          created_at: string
          created_by: string | null
          email: string
          first_name: string
          full_name: string
          id: string
          last_name: string
          role: string
          store_ids: string[]
        }
        Insert: {
          company_id: string
          created_at?: string
          created_by?: string | null
          email: string
          first_name?: string
          full_name?: string
          id?: string
          last_name?: string
          role?: string
          store_ids?: string[]
        }
        Update: {
          company_id?: string
          created_at?: string
          created_by?: string | null
          email?: string
          first_name?: string
          full_name?: string
          id?: string
          last_name?: string
          role?: string
          store_ids?: string[]
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
      accept_quote_by_token: { Args: { p_token: string }; Returns: Json }
      admin_add_store: {
        Args: {
          p_annual_price_cents?: number
          p_company_id: string
          p_devices?: number
          p_name: string
          p_sqm?: number
          p_units?: number
        }
        Returns: Json
      }
      admin_assign_supervisor: {
        Args: { p_store_id: string; p_user_id: string }
        Returns: Json
      }
      admin_business_overview: { Args: never; Returns: Json }
      admin_charge_pointes: { Args: never; Returns: Json }
      admin_company_detail: { Args: { p_company_id: string }; Returns: Json }
      admin_create_company: { Args: { p_name: string }; Returns: Json }
      admin_delete_company: { Args: { p_company_id: string }; Returns: Json }
      admin_delete_company_request: { Args: { p_id: string }; Returns: Json }
      admin_delete_store: { Args: { p_store_id: string }; Returns: Json }
      admin_delete_user: { Args: { p_user_id: string }; Returns: Json }
      admin_fulfil_company_request: {
        Args: { p_id: string; p_store_names?: string[] }
        Returns: Json
      }
      admin_fulfil_store_removal: { Args: { p_id: string }; Returns: Json }
      admin_fulfil_store_request: { Args: { p_id: string }; Returns: Json }
      admin_invite_company_admin: {
        Args: {
          p_company: string
          p_email: string
          p_first_name: string
          p_last_name: string
        }
        Returns: Json
      }
      admin_list_audit_log: {
        Args: { p_limit?: number }
        Returns: {
          action: string
          actor_label: string
          created_at: string
          details: Json
          id: number
          target_id: string
          target_label: string
          target_type: string
        }[]
      }
      admin_list_companies: {
        Args: never
        Returns: {
          created_at: string
          id: string
          join_code: string
          name: string
        }[]
      }
      admin_list_companies_overview: {
        Args: never
        Returns: {
          company_admin_count: number
          counter_count: number
          created_at: string
          id: string
          last_session_at: string
          name: string
          pending_invitations: number
          store_count: number
          supervisor_count: number
        }[]
      }
      admin_list_company_members: {
        Args: { p_company_id: string }
        Returns: {
          email: string
          full_name: string
          id: string
          is_company_admin: boolean
          role: string
        }[]
      }
      admin_list_company_requests: {
        Args: never
        Returns: {
          admin_note: string
          ape: string
          company_id: string
          company_name: string
          contact_email: string
          contact_first_name: string
          contact_last_name: string
          contact_phone: string
          created_at: string
          decline_reason: string
          declined_at: string
          id: string
          message: string
          quote_amount_cents: number
          quote_reference: string
          siren: string
          status: string
          store_count: number
          stores: Json
        }[]
      }
      admin_list_store_requests: { Args: never; Returns: Json }
      admin_list_store_supervisors: {
        Args: { p_company_id: string }
        Returns: {
          store_id: string
          user_id: string
        }[]
      }
      admin_list_stores: {
        Args: never
        Returns: {
          company_id: string
          id: string
          join_code: string
          name: string
        }[]
      }
      admin_notify_emails: { Args: never; Returns: string[] }
      admin_pipeline: { Args: never; Returns: Json }
      admin_quote_company_request: {
        Args: {
          p_amount_cents: number
          p_billing_period?: string
          p_id: string
          p_lines?: Json
          p_note?: string
          p_reference: string
        }
        Returns: Json
      }
      admin_quote_store_request: {
        Args: {
          p_amount_cents: number
          p_billing_period?: string
          p_id: string
          p_lines?: Json
          p_note?: string
          p_reference: string
        }
        Returns: Json
      }
      admin_reject_store_request: {
        Args: { p_id: string; p_note?: string }
        Returns: Json
      }
      admin_rename_company: {
        Args: { p_company_id: string; p_name: string }
        Returns: Json
      }
      admin_rename_store: {
        Args: { p_name: string; p_store_id: string }
        Returns: Json
      }
      admin_revenu_par_entreprise: { Args: never; Returns: Json }
      admin_revoke_company_admin: { Args: { p_user: string }; Returns: Json }
      admin_set_company_request_status: {
        Args: { p_id: string; p_note?: string; p_status: string }
        Returns: Json
      }
      admin_set_store_price: {
        Args: { p_price_cents: number; p_store_id: string }
        Returns: Json
      }
      admin_set_store_request_status: {
        Args: { p_id: string; p_note?: string; p_status: string }
        Returns: Json
      }
      admin_set_store_volume: {
        Args: { p_sqm?: number; p_store_id: string; p_units: number }
        Returns: Json
      }
      admin_unassign_supervisor: {
        Args: { p_store_id: string; p_user_id: string }
        Returns: Json
      }
      admin_usage_overview: { Args: { p_company_id?: string }; Returns: Json }
      advance_pass: { Args: { p_session_id: string }; Returns: Json }
      annuel_du_devis: {
        Args: {
          p_amount_cents: number
          p_billing_period: string
          p_lines: Json
        }
        Returns: number
      }
      anomalies_a_signaler: { Args: never; Returns: Json }
      attach_checkout_session: {
        Args: {
          p_customer_id?: string
          p_id: string
          p_kind: string
          p_session_id: string
        }
        Returns: Json
      }
      ca_cancel_invitation: { Args: { p_id: string }; Returns: Json }
      ca_cancel_store_request: { Args: { p_id: string }; Returns: Json }
      ca_company_overview: { Args: never; Returns: Json }
      ca_delete_user: { Args: { p_user: string }; Returns: Json }
      ca_invite_supervisor: {
        Args: {
          p_email: string
          p_first_name: string
          p_last_name: string
          p_store_ids?: string[]
        }
        Returns: Json
      }
      ca_list_audit_log: { Args: { p_limit?: number }; Returns: Json }
      ca_list_store_requests: { Args: never; Returns: Json }
      ca_list_team: { Args: never; Returns: Json }
      ca_remove_supervisor: { Args: { p_user: string }; Returns: Json }
      ca_rename_company: { Args: { p_name: string }; Returns: Json }
      ca_rename_store: {
        Args: { p_name: string; p_store_id: string }
        Returns: Json
      }
      ca_request_store:
        | {
            Args: { p_devices?: number; p_message?: string; p_name: string }
            Returns: Json
          }
        | {
            Args: {
              p_message: string
              p_name: string
              p_sqm: number
              p_units: number
            }
            Returns: Json
          }
      ca_request_store_removal: {
        Args: { p_message?: string; p_store_id: string }
        Returns: Json
      }
      ca_set_counter_stores: {
        Args: { p_store_ids: string[]; p_user: string }
        Returns: Json
      }
      ca_set_supervisor_stores: {
        Args: { p_store_ids: string[]; p_user: string }
        Returns: Json
      }
      ca_set_user_role: {
        Args: { p_role: string; p_store_ids?: string[]; p_user: string }
        Returns: Json
      }
      ca_store_detail: { Args: { p_store_id: string }; Returns: Json }
      can_access_session: { Args: { p_session_id: string }; Returns: boolean }
      can_join_session_topic: { Args: { p_topic: string }; Returns: boolean }
      cancel_my_invitation: { Args: { p_id: string }; Returns: Json }
      catalogue_hors_ligne: {
        Args: {
          p_apres_sku?: string
          p_depuis?: string
          p_limite?: number
          p_session_id: string
        }
        Returns: {
          brand: string
          ean: string
          label: string
          prix: number
          sku: string
        }[]
      }
      catalogue_repere: {
        Args: { p_session_id: string }
        Returns: {
          repere: string
          total: number
        }[]
      }
      check_invitation: { Args: { p_email: string }; Returns: boolean }
      client_ip: { Args: never; Returns: string }
      cloturer_audit_balise: {
        Args: { p_code: string; p_session_id: string }
        Returns: Json
      }
      compose_full_name: {
        Args: { p_fallback?: string; p_first: string; p_last: string }
        Returns: string
      }
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
      declencher_alerte: { Args: never; Returns: undefined }
      decline_quote_by_token: {
        Args: { p_reason?: string; p_token: string }
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
      deposer_message_admin: {
        Args: { p_message: string; p_sujet: string }
        Returns: Json
      }
      deposer_message_quantinvo: {
        Args: { p_message: string; p_sujet: string }
        Returns: Json
      }
      deposer_notification_admins: {
        Args: { p_donnees: Json; p_type: string }
        Returns: number
      }
      deposer_souscription: {
        Args: {
          p_amount_cents: number
          p_annual_cents: number
          p_billing_period: string
          p_company_name: string
          p_email: string
          p_first_name: string
          p_last_name: string
          p_plan: string
          p_store_name: string
        }
        Returns: Json
      }
      ecarts_arbitres_page: {
        Args: { p_limite?: number; p_offset?: number; p_session_id: string }
        Returns: {
          brand: string
          ean: string
          final_qty: number
          id: string
          label: string
          qty_pass1: number
          qty_pass2: number
          qty_pass3: number
          resolved_by: string
          session_id: string
          sku: string
          status: string
          total: number
          updated_at: string
          zone: string
          zone_name: string
        }[]
      }
      ecarts_page: {
        Args: {
          p_limite?: number
          p_offset?: number
          p_ordre?: string
          p_session_id: string
          p_zone?: string
        }
        Returns: {
          audite: number
          brand: string
          compte: number
          ean: string
          ecart: number
          ecart_valeur: number
          final_qty: number
          genre: string
          id: string
          label: string
          qty_pass1: number
          qty_pass2: number
          qty_pass3: number
          resolved_by: string
          session_id: string
          sku: string
          status: string
          total: number
          unit_purchase_price: number
          updated_at: string
          zone: string
          zone_name: string
        }[]
      }
      ecarts_resume: {
        Args: { p_session_id: string }
        Returns: {
          arbitres: number
          manque_audit: number
          manque_comptage: number
          quantite: number
          total: number
          unites: number
          valeur: number
        }[]
      }
      ecarts_zones: {
        Args: { p_session_id: string }
        Returns: {
          lignes: number
          nom: string
        }[]
      }
      ensure_zone: {
        Args: { p_code: string; p_session_id: string }
        Returns: Json
      }
      etat_import: {
        Args: { p_session_id: string }
        Returns: {
          articles: number
          stock: number
          theorique: number
        }[]
      }
      export_my_data: { Args: never; Returns: Json }
      fil_pour_email: { Args: { p_fil: string }; Returns: Json }
      find_user_by_email: {
        Args: { p_email: string }
        Returns: {
          company_id: string
          full_name: string
          role: string
          user_id: string
        }[]
      }
      fulfil_paid_request: {
        Args: {
          p_customer_id?: string
          p_event_id?: string
          p_invoice_id?: string
          p_payment_intent_id?: string
          p_session_id: string
          p_subscription_id?: string
        }
        Returns: Json
      }
      gen_company_code: { Args: never; Returns: string }
      gen_store_code: { Args: never; Returns: string }
      generate_company_balises: { Args: { p_count: number }; Returns: Json }
      generate_zones: {
        Args: { p_count: number; p_session_id: string }
        Returns: Json
      }
      get_balise_detail: {
        Args: { p_code: string; p_session_id: string }
        Returns: {
          audit_status: string
          audited_qty: number
          brand: string
          counted_qty: number
          ean: string
          final_qty: number
          label: string
          sku: string
        }[]
      }
      get_company_directory: {
        Args: never
        Returns: {
          email: string
          full_name: string
          role: string
          user_id: string
        }[]
      }
      get_my_company: { Args: never; Returns: string }
      get_my_count_totals: {
        Args: { p_session_id: string }
        Returns: {
          audited: number
          counted: number
        }[]
      }
      get_my_role: { Args: never; Returns: string }
      get_my_stores: {
        Args: never
        Returns: {
          id: string
          join_code: string
          name: string
        }[]
      }
      get_session_count_totals: {
        Args: { p_session_id: string }
        Returns: {
          audited: number
          audited_skus: number
          counted: number
          counted_skus: number
        }[]
      }
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
      get_session_theoretical_total: {
        Args: { p_session_id: string }
        Returns: number
      }
      get_store_directory: {
        Args: { p_store_id: string }
        Returns: {
          email: string
          full_name: string
          role: string
          user_id: string
        }[]
      }
      get_zone_dashboard: {
        Args: { p_session_id: string }
        Returns: {
          audit_lines: number
          audit_lines_autres: number
          audit_status: string
          audit_units: number
          audit_units_autres: number
          code: string
          count_lines: number
          count_lines_autres: number
          count_status: string
          count_units: number
          count_units_autres: number
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
      invite_company_admin_after_payment: {
        Args: {
          p_company: string
          p_email: string
          p_first: string
          p_last: string
        }
        Returns: Json
      }
      is_admin: { Args: never; Returns: boolean }
      is_assigned_store: { Args: { p_store_id: string }; Returns: boolean }
      is_company_admin: { Args: { p_company?: string }; Returns: boolean }
      is_session_participant: {
        Args: { p_session_id: string }
        Returns: boolean
      }
      join_company: { Args: { p_code: string }; Returns: Json }
      join_session: {
        Args: { p_inventory_number: string; p_security_code: string }
        Returns: Json
      }
      join_store: { Args: { p_code: string }; Returns: Json }
      leave_session: { Args: { p_session_id: string }; Returns: Json }
      lister_articles: {
        Args: { p_apres_sku?: string; p_limite?: number; p_session_id: string }
        Returns: {
          brand: string
          ean: string
          ean_norm: string
          id: string
          label: string
          session_id: string
          sku: string
          unit_purchase_price: number
          updated_at: string
        }[]
      }
      lister_ecarts: {
        Args: { p_session_id: string }
        Returns: {
          brand: string
          ean: string
          final_qty: number
          id: string
          label: string
          qty_pass1: number
          qty_pass2: number
          qty_pass3: number
          resolved_by: string
          session_id: string
          sku: string
          status: string
          unit_purchase_price: number
          updated_at: string
          zone: string
        }[]
      }
      log_admin_action: {
        Args: {
          p_action: string
          p_details?: Json
          p_target_id: string
          p_target_label: string
          p_target_type: string
        }
        Returns: undefined
      }
      log_company_action: {
        Args: {
          p_action: string
          p_company: string
          p_details?: Json
          p_target_label: string
        }
        Returns: undefined
      }
      log_system_action: {
        Args: {
          p_action: string
          p_actor: string
          p_details?: Json
          p_target_id: string
          p_target_label: string
          p_target_type: string
        }
        Returns: undefined
      }
      marquer_alertes: { Args: { p_cles: string[] }; Returns: number }
      marquer_messages_lus: { Args: never; Returns: Json }
      marquer_notifications_lues: { Args: never; Returns: Json }
      membre_ou_superviseur: {
        Args: { p_session_id: string }
        Returns: boolean
      }
      mes_balises_comptees: {
        Args: { p_pass?: number; p_session_id: string }
        Returns: {
          brand: string
          ean: string
          label: string
          qty: number
          sku: string
          zone: string
        }[]
      }
      mes_fils: { Args: never; Returns: Json }
      mes_messages: { Args: never; Returns: Json }
      mes_notifications: { Args: never; Returns: Json }
      my_team_by_store: { Args: never; Returns: Json }
      nom_propre: { Args: { p_nom: string }; Returns: string }
      norm_balise: { Args: { p: string }; Returns: string }
      oublier_empreinte_audit: {
        Args: { p_session_id: string }
        Returns: undefined
      }
      ouvrir_fil: {
        Args: { p_message: string; p_sujet: string }
        Returns: Json
      }
      ouvrir_message_fil: { Args: { p_fil: string }; Returns: Json }
      purge_expired_data: { Args: never; Returns: Json }
      quote_by_token: { Args: { p_token: string }; Returns: Json }
      rapport_detail_page: {
        Args: { p_limite?: number; p_offset?: number; p_session_id: string }
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
          total: number
          zone: string
          zone_name: string
        }[]
      }
      rapport_page: {
        Args: {
          p_limite?: number
          p_offset?: number
          p_recherche?: string
          p_sens?: string
          p_session_id: string
          p_tri?: string
        }
        Returns: {
          brand: string
          counted_qty: number
          ean: string
          label: string
          sku: string
          status: string
          theoretical_qty: number
          total: number
          unit_purchase_price: number
          variance_units: number
          variance_value: number
        }[]
      }
      rapport_resume: {
        Args: { p_session_id: string }
        Returns: {
          compte: number
          ecart_unites: number
          ecart_valeur: number
          lignes: number
          non_arbitres: number
          theorique: number
        }[]
      }
      rate_limit_ok: {
        Args: {
          p_key: string
          p_max: number
          p_scope: string
          p_window: string
        }
        Returns: boolean
      }
      recompute_session_audit: {
        Args: { p_force?: boolean; p_session_id: string }
        Returns: Json
      }
      register_balise: {
        Args: { p_code: string; p_name: string; p_session_id: string }
        Returns: Json
      }
      remove_counter_from_store: {
        Args: { p_store_id: string; p_user: string }
        Returns: Json
      }
      remove_session_member: {
        Args: { p_session_id: string; p_user_id: string }
        Returns: Json
      }
      repondre_fil: {
        Args: { p_fil: string; p_message: string }
        Returns: Json
      }
      request_account_deletion: { Args: never; Returns: Json }
      resolve_audit: {
        Args: {
          p_final_qty: number
          p_session_id: string
          p_sku: string
          p_zone?: string
        }
        Returns: Json
      }
      revert_pass: {
        Args: { p_delete_counts?: boolean; p_session_id: string }
        Returns: Json
      }
      scans_de_balise: {
        Args: { p_pass: number; p_session_id: string; p_zone?: string }
        Returns: {
          brand: string
          dernier_scan: string
          ean: string
          ean_norm: string
          id: string
          label: string
          qty: number
          session_id: string
          sku: string
          unit_purchase_price: number
          updated_at: string
        }[]
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
      set_zone_status: {
        Args: { p_status: string; p_zone_id: string }
        Returns: Json
      }
      siren_valide: { Args: { p_siren: string }; Returns: boolean }
      submit_company_request: {
        Args: {
          p_ape?: string
          p_company_name: string
          p_email: string
          p_first_name: string
          p_last_name: string
          p_message?: string
          p_phone: string
          p_siren?: string
          p_store_count: number
          p_stores?: Json
        }
        Returns: Json
      }
      submit_company_request_detailed: {
        Args: {
          p_ape?: string
          p_company_name: string
          p_email: string
          p_first_name: string
          p_last_name: string
          p_message?: string
          p_phone: string
          p_siren?: string
          p_store_count: number
          p_stores?: Json
        }
        Returns: Json
      }
      sync_subscription_status: {
        Args: {
          p_event_id?: string
          p_status: string
          p_subscription_id: string
        }
        Returns: Json
      }
      tableau_de_bord_superviseur: {
        Args: { p_semaine?: string }
        Returns: Json
      }
      vider_balise: {
        Args: { p_code: string; p_session_id: string }
        Returns: Json
      }
      vider_import: {
        Args: { p_cible: string; p_session_id: string }
        Returns: number
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
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never) = never,
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
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
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
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
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
  EnumName extends (DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never) = never,
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
  CompositeTypeName extends (PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never) = never,
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
