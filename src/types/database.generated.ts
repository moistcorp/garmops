export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  public: {
    Tables: {
      account_principals: {
        Row: {
          account_type: Database["public"]["Enums"]["account_type"]
          active: boolean
          created_at: string
          created_by: string | null
          id: string
          normalized_email: string
          updated_at: string
          user_id: string | null
        }
        Insert: {
          account_type: Database["public"]["Enums"]["account_type"]
          active?: boolean
          created_at?: string
          created_by?: string | null
          id?: string
          normalized_email: string
          updated_at?: string
          user_id?: string | null
        }
        Update: {
          account_type?: Database["public"]["Enums"]["account_type"]
          active?: boolean
          created_at?: string
          created_by?: string | null
          id?: string
          normalized_email?: string
          updated_at?: string
          user_id?: string | null
        }
        Relationships: []
      }
      addresses: {
        Row: {
          city: string
          contact_name: string | null
          country_code: string
          created_at: string
          id: string
          is_default_billing: boolean
          is_default_shipping: boolean
          label: string | null
          landmark: string | null
          line1: string
          line2: string | null
          phone: string | null
          postal_code: string
          state: string
          updated_at: string
          user_id: string
        }
        Insert: {
          city: string
          contact_name?: string | null
          country_code?: string
          created_at?: string
          id?: string
          is_default_billing?: boolean
          is_default_shipping?: boolean
          label?: string | null
          landmark?: string | null
          line1: string
          line2?: string | null
          phone?: string | null
          postal_code: string
          state: string
          updated_at?: string
          user_id: string
        }
        Update: {
          city?: string
          contact_name?: string | null
          country_code?: string
          created_at?: string
          id?: string
          is_default_billing?: boolean
          is_default_shipping?: boolean
          label?: string | null
          landmark?: string | null
          line1?: string
          line2?: string | null
          phone?: string | null
          postal_code?: string
          state?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "addresses_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      audit_logs: {
        Row: {
          action: string
          actor_type: string
          actor_user_id: string | null
          after_state: Json | null
          before_state: Json | null
          created_at: string
          id: string
          metadata: Json
          order_id: string | null
          target_id: string | null
          target_type: string
        }
        Insert: {
          action: string
          actor_type: string
          actor_user_id?: string | null
          after_state?: Json | null
          before_state?: Json | null
          created_at?: string
          id?: string
          metadata?: Json
          order_id?: string | null
          target_id?: string | null
          target_type: string
        }
        Update: {
          action?: string
          actor_type?: string
          actor_user_id?: string | null
          after_state?: Json | null
          before_state?: Json | null
          created_at?: string
          id?: string
          metadata?: Json
          order_id?: string | null
          target_id?: string | null
          target_type?: string
        }
        Relationships: [
          {
            foreignKeyName: "audit_logs_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "orders"
            referencedColumns: ["id"]
          },
        ]
      }
      auth_rate_limits: {
        Row: {
          attempts: number
          blocked_until: string | null
          scope: string
          subject_hash: string
          updated_at: string
          window_started_at: string
        }
        Insert: {
          attempts?: number
          blocked_until?: string | null
          scope: string
          subject_hash: string
          updated_at?: string
          window_started_at: string
        }
        Update: {
          attempts?: number
          blocked_until?: string | null
          scope?: string
          subject_hash?: string
          updated_at?: string
          window_started_at?: string
        }
        Relationships: []
      }
      cancellation_requests: {
        Row: {
          created_at: string
          decided_at: string | null
          decided_by: string | null
          id: string
          order_id: string
          reason: string
          requested_by: string
          requested_from_status:
            | Database["public"]["Enums"]["order_status"]
            | null
          status: string
        }
        Insert: {
          created_at?: string
          decided_at?: string | null
          decided_by?: string | null
          id?: string
          order_id: string
          reason: string
          requested_by: string
          requested_from_status?:
            | Database["public"]["Enums"]["order_status"]
            | null
          status?: string
        }
        Update: {
          created_at?: string
          decided_at?: string | null
          decided_by?: string | null
          id?: string
          order_id?: string
          reason?: string
          requested_by?: string
          requested_from_status?:
            | Database["public"]["Enums"]["order_status"]
            | null
          status?: string
        }
        Relationships: [
          {
            foreignKeyName: "cancellation_requests_decided_by_fkey"
            columns: ["decided_by"]
            isOneToOne: false
            referencedRelation: "staff_members"
            referencedColumns: ["user_id"]
          },
          {
            foreignKeyName: "cancellation_requests_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "orders"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "cancellation_requests_requested_by_fkey"
            columns: ["requested_by"]
            isOneToOne: false
            referencedRelation: "staff_members"
            referencedColumns: ["user_id"]
          },
        ]
      }
      checkout_payment_attempts: {
        Row: {
          amount_paise: number
          attempt_number: number
          checkout_session_id: string
          completed_at: string | null
          created_at: string
          currency: string
          customer_email: string
          customer_name: string
          customer_phone: string
          expected_product_info: string
          failed_at: string | null
          failure_code: string | null
          failure_message: string | null
          id: string
          initiated_at: string | null
          last_reconciled_at: string | null
          last_reconciliation_error: string | null
          paid_at: string | null
          provider: string
          provider_merchant_txn_id: string
          provider_payment_id: string | null
          raw_verified_snapshot: Json | null
          reconciliation_attempts: number
          status: Database["public"]["Enums"]["payment_status"]
          updated_at: string
        }
        Insert: {
          amount_paise: number
          attempt_number: number
          checkout_session_id: string
          completed_at?: string | null
          created_at?: string
          currency?: string
          customer_email: string
          customer_name: string
          customer_phone: string
          expected_product_info: string
          failed_at?: string | null
          failure_code?: string | null
          failure_message?: string | null
          id?: string
          initiated_at?: string | null
          last_reconciled_at?: string | null
          last_reconciliation_error?: string | null
          paid_at?: string | null
          provider?: string
          provider_merchant_txn_id: string
          provider_payment_id?: string | null
          raw_verified_snapshot?: Json | null
          reconciliation_attempts?: number
          status?: Database["public"]["Enums"]["payment_status"]
          updated_at?: string
        }
        Update: {
          amount_paise?: number
          attempt_number?: number
          checkout_session_id?: string
          completed_at?: string | null
          created_at?: string
          currency?: string
          customer_email?: string
          customer_name?: string
          customer_phone?: string
          expected_product_info?: string
          failed_at?: string | null
          failure_code?: string | null
          failure_message?: string | null
          id?: string
          initiated_at?: string | null
          last_reconciled_at?: string | null
          last_reconciliation_error?: string | null
          paid_at?: string | null
          provider?: string
          provider_merchant_txn_id?: string
          provider_payment_id?: string | null
          raw_verified_snapshot?: Json | null
          reconciliation_attempts?: number
          status?: Database["public"]["Enums"]["payment_status"]
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "checkout_payment_attempts_checkout_session_id_fkey"
            columns: ["checkout_session_id"]
            isOneToOne: false
            referencedRelation: "checkout_sessions"
            referencedColumns: ["id"]
          },
        ]
      }
      checkout_payment_events: {
        Row: {
          authentic: boolean
          checkout_payment_attempt_id: string
          created_at: string
          event_fingerprint: string
          event_source: string
          event_type: string
          id: string
          payload: Json
          processed: boolean
          processed_at: string | null
          processing_error: string | null
          provider: string
          provider_event_id: string | null
        }
        Insert: {
          authentic?: boolean
          checkout_payment_attempt_id: string
          created_at?: string
          event_fingerprint: string
          event_source: string
          event_type: string
          id?: string
          payload: Json
          processed?: boolean
          processed_at?: string | null
          processing_error?: string | null
          provider?: string
          provider_event_id?: string | null
        }
        Update: {
          authentic?: boolean
          checkout_payment_attempt_id?: string
          created_at?: string
          event_fingerprint?: string
          event_source?: string
          event_type?: string
          id?: string
          payload?: Json
          processed?: boolean
          processed_at?: string | null
          processing_error?: string | null
          provider?: string
          provider_event_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "checkout_payment_events_checkout_payment_attempt_id_fkey"
            columns: ["checkout_payment_attempt_id"]
            isOneToOne: false
            referencedRelation: "checkout_payment_attempts"
            referencedColumns: ["id"]
          },
        ]
      }
      checkout_sessions: {
        Row: {
          cart_id: string
          created_at: string
          currency: string
          customer_user_id: string
          discount_code_id: string | null
          discount_paise: number
          expires_at: string
          final_order_id: string | null
          final_order_number: string | null
          final_payment_attempt_id: string | null
          finalized_at: string | null
          flow: string
          id: string
          idempotency_key: string
          provider_payment_id: string | null
          request_hash: string
          return_path: string
          rpc_payload: Json
          status: string
          subtotal_paise: number
          tax_paise: number
          total_paise: number
          updated_at: string
          verified_snapshot: Json | null
        }
        Insert: {
          cart_id: string
          created_at?: string
          currency?: string
          customer_user_id: string
          discount_code_id?: string | null
          discount_paise?: number
          expires_at: string
          final_order_id?: string | null
          final_order_number?: string | null
          final_payment_attempt_id?: string | null
          finalized_at?: string | null
          flow: string
          id?: string
          idempotency_key: string
          provider_payment_id?: string | null
          request_hash: string
          return_path: string
          rpc_payload: Json
          status?: string
          subtotal_paise: number
          tax_paise: number
          total_paise: number
          updated_at?: string
          verified_snapshot?: Json | null
        }
        Update: {
          cart_id?: string
          created_at?: string
          currency?: string
          customer_user_id?: string
          discount_code_id?: string | null
          discount_paise?: number
          expires_at?: string
          final_order_id?: string | null
          final_order_number?: string | null
          final_payment_attempt_id?: string | null
          finalized_at?: string | null
          flow?: string
          id?: string
          idempotency_key?: string
          provider_payment_id?: string | null
          request_hash?: string
          return_path?: string
          rpc_payload?: Json
          status?: string
          subtotal_paise?: number
          tax_paise?: number
          total_paise?: number
          updated_at?: string
          verified_snapshot?: Json | null
        }
        Relationships: [
          {
            foreignKeyName: "checkout_sessions_customer_user_id_fkey"
            columns: ["customer_user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "checkout_sessions_discount_code_id_fkey"
            columns: ["discount_code_id"]
            isOneToOne: false
            referencedRelation: "discount_codes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "checkout_sessions_final_order_id_fkey"
            columns: ["final_order_id"]
            isOneToOne: false
            referencedRelation: "orders"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "checkout_sessions_final_payment_attempt_id_fkey"
            columns: ["final_payment_attempt_id"]
            isOneToOne: false
            referencedRelation: "payment_attempts"
            referencedColumns: ["id"]
          },
        ]
      }
      customer_billing_profiles: {
        Row: {
          billing_address: Json | null
          billing_email: string | null
          created_at: string
          gstin: string | null
          id: string
          legal_business_name: string | null
          profile_type: string
          updated_at: string
          user_id: string
        }
        Insert: {
          billing_address?: Json | null
          billing_email?: string | null
          created_at?: string
          gstin?: string | null
          id?: string
          legal_business_name?: string | null
          profile_type?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          billing_address?: Json | null
          billing_email?: string | null
          created_at?: string
          gstin?: string | null
          id?: string
          legal_business_name?: string | null
          profile_type?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "customer_billing_profiles_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: true
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      customer_privacy_preferences: {
        Row: {
          analytics_enabled: boolean
          customer_user_id: string
          recovery_messages_enabled: boolean
          updated_at: string
        }
        Insert: {
          analytics_enabled?: boolean
          customer_user_id: string
          recovery_messages_enabled?: boolean
          updated_at?: string
        }
        Update: {
          analytics_enabled?: boolean
          customer_user_id?: string
          recovery_messages_enabled?: boolean
          updated_at?: string
        }
        Relationships: []
      }
      design_project_versions: {
        Row: {
          configuration_snapshot: Json
          created_at: string
          created_by: string
          design_project_id: string
          id: string
          pricing_input_snapshot: Json | null
          version_number: number
        }
        Insert: {
          configuration_snapshot: Json
          created_at?: string
          created_by: string
          design_project_id: string
          id?: string
          pricing_input_snapshot?: Json | null
          version_number: number
        }
        Update: {
          configuration_snapshot?: Json
          created_at?: string
          created_by?: string
          design_project_id?: string
          id?: string
          pricing_input_snapshot?: Json | null
          version_number?: number
        }
        Relationships: [
          {
            foreignKeyName: "design_project_versions_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "design_project_versions_design_project_id_fkey"
            columns: ["design_project_id"]
            isOneToOne: false
            referencedRelation: "design_projects"
            referencedColumns: ["id"]
          },
        ]
      }
      design_projects: {
        Row: {
          archived_at: string | null
          client_import_id: string | null
          created_at: string
          created_by: string
          current_version: number
          draft_revision: number
          draft_snapshot: Json
          id: string
          last_saved_at: string
          pricing_input_snapshot: Json | null
          recovery_last_sent_at: string | null
          schema_version: number
          source: string
          status: string
          submitted_at: string | null
          title: string
          updated_at: string
        }
        Insert: {
          archived_at?: string | null
          client_import_id?: string | null
          created_at?: string
          created_by: string
          current_version?: number
          draft_revision?: number
          draft_snapshot: Json
          id?: string
          last_saved_at?: string
          pricing_input_snapshot?: Json | null
          recovery_last_sent_at?: string | null
          schema_version: number
          source?: string
          status?: string
          submitted_at?: string | null
          title: string
          updated_at?: string
        }
        Update: {
          archived_at?: string | null
          client_import_id?: string | null
          created_at?: string
          created_by?: string
          current_version?: number
          draft_revision?: number
          draft_snapshot?: Json
          id?: string
          last_saved_at?: string
          pricing_input_snapshot?: Json | null
          recovery_last_sent_at?: string | null
          schema_version?: number
          source?: string
          status?: string
          submitted_at?: string | null
          title?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "design_projects_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      discount_codes: {
        Row: {
          active: boolean
          code: string
          created_at: string
          created_by: string
          description: string | null
          ends_at: string | null
          fixed_amount_paise: number | null
          id: string
          kind: Database["public"]["Enums"]["discount_kind"]
          maximum_discount_paise: number | null
          maximum_redemptions: number | null
          maximum_redemptions_per_customer: number
          minimum_subtotal_paise: number
          percentage_basis_points: number | null
          starts_at: string | null
          updated_at: string
        }
        Insert: {
          active?: boolean
          code: string
          created_at?: string
          created_by: string
          description?: string | null
          ends_at?: string | null
          fixed_amount_paise?: number | null
          id?: string
          kind: Database["public"]["Enums"]["discount_kind"]
          maximum_discount_paise?: number | null
          maximum_redemptions?: number | null
          maximum_redemptions_per_customer?: number
          minimum_subtotal_paise?: number
          percentage_basis_points?: number | null
          starts_at?: string | null
          updated_at?: string
        }
        Update: {
          active?: boolean
          code?: string
          created_at?: string
          created_by?: string
          description?: string | null
          ends_at?: string | null
          fixed_amount_paise?: number | null
          id?: string
          kind?: Database["public"]["Enums"]["discount_kind"]
          maximum_discount_paise?: number | null
          maximum_redemptions?: number | null
          maximum_redemptions_per_customer?: number
          minimum_subtotal_paise?: number
          percentage_basis_points?: number | null
          starts_at?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "discount_codes_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "staff_members"
            referencedColumns: ["user_id"]
          },
        ]
      }
      discount_redemptions: {
        Row: {
          customer_user_id: string
          discount_code_id: string
          discount_paise: number
          id: string
          order_id: string
          redeemed_at: string
        }
        Insert: {
          customer_user_id: string
          discount_code_id: string
          discount_paise: number
          id?: string
          order_id: string
          redeemed_at?: string
        }
        Update: {
          customer_user_id?: string
          discount_code_id?: string
          discount_paise?: number
          id?: string
          order_id?: string
          redeemed_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "discount_redemptions_customer_user_id_fkey"
            columns: ["customer_user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "discount_redemptions_discount_code_id_fkey"
            columns: ["discount_code_id"]
            isOneToOne: false
            referencedRelation: "discount_codes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "discount_redemptions_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: true
            referencedRelation: "orders"
            referencedColumns: ["id"]
          },
        ]
      }
      discount_reservations: {
        Row: {
          checkout_session_id: string
          created_at: string
          customer_user_id: string
          discount_code_id: string
          expires_at: string
          id: string
          redeemed_order_id: string | null
          status: string
          updated_at: string
        }
        Insert: {
          checkout_session_id: string
          created_at?: string
          customer_user_id: string
          discount_code_id: string
          expires_at: string
          id?: string
          redeemed_order_id?: string | null
          status?: string
          updated_at?: string
        }
        Update: {
          checkout_session_id?: string
          created_at?: string
          customer_user_id?: string
          discount_code_id?: string
          expires_at?: string
          id?: string
          redeemed_order_id?: string | null
          status?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "discount_reservations_checkout_session_id_fkey"
            columns: ["checkout_session_id"]
            isOneToOne: true
            referencedRelation: "checkout_sessions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "discount_reservations_customer_user_id_fkey"
            columns: ["customer_user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "discount_reservations_discount_code_id_fkey"
            columns: ["discount_code_id"]
            isOneToOne: false
            referencedRelation: "discount_codes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "discount_reservations_redeemed_order_id_fkey"
            columns: ["redeemed_order_id"]
            isOneToOne: false
            referencedRelation: "orders"
            referencedColumns: ["id"]
          },
        ]
      }
      integration_jobs: {
        Row: {
          attempts: number
          available_at: string
          completed_at: string | null
          created_at: string
          deduplication_key: string
          id: string
          job_type: string
          last_error: string | null
          locked_at: string | null
          locked_by: string | null
          payload: Json
          status: string
          updated_at: string
        }
        Insert: {
          attempts?: number
          available_at?: string
          completed_at?: string | null
          created_at?: string
          deduplication_key: string
          id?: string
          job_type: string
          last_error?: string | null
          locked_at?: string | null
          locked_by?: string | null
          payload: Json
          status?: string
          updated_at?: string
        }
        Update: {
          attempts?: number
          available_at?: string
          completed_at?: string | null
          created_at?: string
          deduplication_key?: string
          id?: string
          job_type?: string
          last_error?: string | null
          locked_at?: string | null
          locked_by?: string | null
          payload?: Json
          status?: string
          updated_at?: string
        }
        Relationships: []
      }
      invoices: {
        Row: {
          buyer_snapshot: Json
          created_at: string
          currency: string
          discount_paise: number
          id: string
          invoice_number: string | null
          issued_at: string | null
          kind: Database["public"]["Enums"]["invoice_kind"]
          line_items: Json
          order_id: string
          paid_paise: number
          pdf_file_id: string | null
          place_of_supply: string | null
          seller_snapshot: Json
          status: Database["public"]["Enums"]["invoice_sync_status"]
          subtotal_paise: number
          tax_paise: number
          taxable_value_paise: number
          total_paise: number
          updated_at: string
        }
        Insert: {
          buyer_snapshot: Json
          created_at?: string
          currency?: string
          discount_paise?: number
          id?: string
          invoice_number?: string | null
          issued_at?: string | null
          kind: Database["public"]["Enums"]["invoice_kind"]
          line_items: Json
          order_id: string
          paid_paise?: number
          pdf_file_id?: string | null
          place_of_supply?: string | null
          seller_snapshot: Json
          status?: Database["public"]["Enums"]["invoice_sync_status"]
          subtotal_paise: number
          tax_paise: number
          taxable_value_paise: number
          total_paise: number
          updated_at?: string
        }
        Update: {
          buyer_snapshot?: Json
          created_at?: string
          currency?: string
          discount_paise?: number
          id?: string
          invoice_number?: string | null
          issued_at?: string | null
          kind?: Database["public"]["Enums"]["invoice_kind"]
          line_items?: Json
          order_id?: string
          paid_paise?: number
          pdf_file_id?: string | null
          place_of_supply?: string | null
          seller_snapshot?: Json
          status?: Database["public"]["Enums"]["invoice_sync_status"]
          subtotal_paise?: number
          tax_paise?: number
          taxable_value_paise?: number
          total_paise?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "invoices_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "orders"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "invoices_pdf_file_fk"
            columns: ["pdf_file_id"]
            isOneToOne: false
            referencedRelation: "order_files"
            referencedColumns: ["id"]
          },
        ]
      }
      legal_document_versions: {
        Row: {
          current_version: string
          document_kind: string
          updated_at: string
        }
        Insert: {
          current_version: string
          document_kind: string
          updated_at?: string
        }
        Update: {
          current_version?: string
          document_kind?: string
          updated_at?: string
        }
        Relationships: []
      }
      number_counters: {
        Row: {
          calendar_year: number
          namespace: string
          next_value: number
        }
        Insert: {
          calendar_year: number
          namespace: string
          next_value?: number
        }
        Update: {
          calendar_year?: number
          namespace?: string
          next_value?: number
        }
        Relationships: []
      }
      order_artwork_requirements: {
        Row: {
          captured_at: string
          created_by: string
          file_id: string
          id: string
          is_active: boolean
          order_id: string
          order_item_id: string | null
          requirement_key: string
          revision: number
          superseded_at: string | null
          superseded_by_requirement_id: string | null
        }
        Insert: {
          captured_at?: string
          created_by: string
          file_id: string
          id?: string
          is_active?: boolean
          order_id: string
          order_item_id?: string | null
          requirement_key: string
          revision: number
          superseded_at?: string | null
          superseded_by_requirement_id?: string | null
        }
        Update: {
          captured_at?: string
          created_by?: string
          file_id?: string
          id?: string
          is_active?: boolean
          order_id?: string
          order_item_id?: string | null
          requirement_key?: string
          revision?: number
          superseded_at?: string | null
          superseded_by_requirement_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "order_artwork_requirements_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "order_artwork_requirements_file_id_fkey"
            columns: ["file_id"]
            isOneToOne: false
            referencedRelation: "order_files"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "order_artwork_requirements_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "orders"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "order_artwork_requirements_order_item_id_fkey"
            columns: ["order_item_id"]
            isOneToOne: false
            referencedRelation: "order_items"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "order_artwork_requirements_superseded_by_fkey"
            columns: ["superseded_by_requirement_id"]
            isOneToOne: false
            referencedRelation: "order_artwork_requirements"
            referencedColumns: ["id"]
          },
        ]
      }
      order_configuration_revisions: {
        Row: {
          changed_by: string
          changed_paths: string[]
          created_at: string
          id: string
          next_snapshot: Json
          order_id: string
          previous_order_status:
            | Database["public"]["Enums"]["order_status"]
            | null
          previous_snapshot: Json
          production_revision: boolean
          reason: string
          revision_number: number
        }
        Insert: {
          changed_by: string
          changed_paths: string[]
          created_at?: string
          id?: string
          next_snapshot: Json
          order_id: string
          previous_order_status?:
            | Database["public"]["Enums"]["order_status"]
            | null
          previous_snapshot: Json
          production_revision?: boolean
          reason: string
          revision_number: number
        }
        Update: {
          changed_by?: string
          changed_paths?: string[]
          created_at?: string
          id?: string
          next_snapshot?: Json
          order_id?: string
          previous_order_status?:
            | Database["public"]["Enums"]["order_status"]
            | null
          previous_snapshot?: Json
          production_revision?: boolean
          reason?: string
          revision_number?: number
        }
        Relationships: [
          {
            foreignKeyName: "order_configuration_revisions_changed_by_fkey"
            columns: ["changed_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "order_configuration_revisions_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "orders"
            referencedColumns: ["id"]
          },
        ]
      }
      order_files: {
        Row: {
          bucket_name: string
          byte_size: number
          content_type: string
          created_at: string
          deleted_at: string | null
          design_project_id: string | null
          extension: string
          finalized_at: string | null
          id: string
          kind: Database["public"]["Enums"]["file_kind"]
          object_cleanup_attempted_at: string | null
          object_cleanup_completed_at: string | null
          object_etag: string | null
          object_key: string
          order_id: string | null
          original_filename: string
          replacement_for_file_id: string | null
          review_reason: string | null
          review_status: Database["public"]["Enums"]["artwork_review_status"]
          reviewed_at: string | null
          reviewed_by: string | null
          safe_filename: string
          scan_status: Database["public"]["Enums"]["file_scan_status"]
          sha256: string | null
          updated_at: string
          upload_expires_at: string | null
          upload_status: string
          uploaded_by: string
          visibility: Database["public"]["Enums"]["file_visibility"]
        }
        Insert: {
          bucket_name?: string
          byte_size: number
          content_type: string
          created_at?: string
          deleted_at?: string | null
          design_project_id?: string | null
          extension: string
          finalized_at?: string | null
          id?: string
          kind: Database["public"]["Enums"]["file_kind"]
          object_cleanup_attempted_at?: string | null
          object_cleanup_completed_at?: string | null
          object_etag?: string | null
          object_key: string
          order_id?: string | null
          original_filename: string
          replacement_for_file_id?: string | null
          review_reason?: string | null
          review_status?: Database["public"]["Enums"]["artwork_review_status"]
          reviewed_at?: string | null
          reviewed_by?: string | null
          safe_filename: string
          scan_status?: Database["public"]["Enums"]["file_scan_status"]
          sha256?: string | null
          updated_at?: string
          upload_expires_at?: string | null
          upload_status?: string
          uploaded_by: string
          visibility: Database["public"]["Enums"]["file_visibility"]
        }
        Update: {
          bucket_name?: string
          byte_size?: number
          content_type?: string
          created_at?: string
          deleted_at?: string | null
          design_project_id?: string | null
          extension?: string
          finalized_at?: string | null
          id?: string
          kind?: Database["public"]["Enums"]["file_kind"]
          object_cleanup_attempted_at?: string | null
          object_cleanup_completed_at?: string | null
          object_etag?: string | null
          object_key?: string
          order_id?: string | null
          original_filename?: string
          replacement_for_file_id?: string | null
          review_reason?: string | null
          review_status?: Database["public"]["Enums"]["artwork_review_status"]
          reviewed_at?: string | null
          reviewed_by?: string | null
          safe_filename?: string
          scan_status?: Database["public"]["Enums"]["file_scan_status"]
          sha256?: string | null
          updated_at?: string
          upload_expires_at?: string | null
          upload_status?: string
          uploaded_by?: string
          visibility?: Database["public"]["Enums"]["file_visibility"]
        }
        Relationships: [
          {
            foreignKeyName: "order_files_design_project_id_fkey"
            columns: ["design_project_id"]
            isOneToOne: false
            referencedRelation: "design_projects"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "order_files_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "orders"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "order_files_replacement_for_file_id_fkey"
            columns: ["replacement_for_file_id"]
            isOneToOne: false
            referencedRelation: "order_files"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "order_files_reviewed_by_fkey"
            columns: ["reviewed_by"]
            isOneToOne: false
            referencedRelation: "staff_members"
            referencedColumns: ["user_id"]
          },
          {
            foreignKeyName: "order_files_uploaded_by_fkey"
            columns: ["uploaded_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      order_items: {
        Row: {
          artwork_snapshot: Json
          colour_snapshot: Json
          created_at: string
          decoration_snapshot: Json
          id: string
          line_number: number
          line_total_paise: number
          neck_label_snapshot: Json | null
          order_id: string
          product_id: string
          product_name: string
          product_slug: string
          product_snapshot: Json
          quantity: number
          size_breakdown: Json
          unit_price_paise: number
        }
        Insert: {
          artwork_snapshot: Json
          colour_snapshot: Json
          created_at?: string
          decoration_snapshot: Json
          id?: string
          line_number: number
          line_total_paise: number
          neck_label_snapshot?: Json | null
          order_id: string
          product_id: string
          product_name: string
          product_slug: string
          product_snapshot: Json
          quantity: number
          size_breakdown: Json
          unit_price_paise: number
        }
        Update: {
          artwork_snapshot?: Json
          colour_snapshot?: Json
          created_at?: string
          decoration_snapshot?: Json
          id?: string
          line_number?: number
          line_total_paise?: number
          neck_label_snapshot?: Json | null
          order_id?: string
          product_id?: string
          product_name?: string
          product_slug?: string
          product_snapshot?: Json
          quantity?: number
          size_breakdown?: Json
          unit_price_paise?: number
        }
        Relationships: [
          {
            foreignKeyName: "order_items_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "orders"
            referencedColumns: ["id"]
          },
        ]
      }
      order_status_history: {
        Row: {
          actor_type: string
          actor_user_id: string | null
          created_at: string
          customer_message: string | null
          customer_visible: boolean
          from_status: Database["public"]["Enums"]["order_status"] | null
          id: string
          internal_note: string | null
          metadata: Json
          order_id: string
          public_status: Database["public"]["Enums"]["public_order_status"]
          reason: string | null
          to_status: Database["public"]["Enums"]["order_status"]
        }
        Insert: {
          actor_type: string
          actor_user_id?: string | null
          created_at?: string
          customer_message?: string | null
          customer_visible?: boolean
          from_status?: Database["public"]["Enums"]["order_status"] | null
          id?: string
          internal_note?: string | null
          metadata?: Json
          order_id: string
          public_status: Database["public"]["Enums"]["public_order_status"]
          reason?: string | null
          to_status: Database["public"]["Enums"]["order_status"]
        }
        Update: {
          actor_type?: string
          actor_user_id?: string | null
          created_at?: string
          customer_message?: string | null
          customer_visible?: boolean
          from_status?: Database["public"]["Enums"]["order_status"] | null
          id?: string
          internal_note?: string | null
          metadata?: Json
          order_id?: string
          public_status?: Database["public"]["Enums"]["public_order_status"]
          reason?: string | null
          to_status?: Database["public"]["Enums"]["order_status"]
        }
        Relationships: [
          {
            foreignKeyName: "order_status_history_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "orders"
            referencedColumns: ["id"]
          },
        ]
      }
      orders: {
        Row: {
          amount_paid_paise: number
          artwork_approved_at: string | null
          assigned_staff_user_id: string | null
          billing_snapshot: Json
          business_snapshot: Json
          cancelled_at: string | null
          configuration_reopen_previous_status:
            | Database["public"]["Enums"]["order_status"]
            | null
          configuration_reopen_reason: string | null
          configuration_reopened_at: string | null
          configuration_reopened_by: string | null
          configuration_revision: number
          configuration_schema_version: number
          configuration_snapshot: Json
          confirmed_at: string
          created_at: string
          created_by_staff_user_id: string | null
          currency: string
          customer_reference: string | null
          customer_snapshot: Json
          customer_user_id: string
          delivered_at: string | null
          design_project_id: string | null
          design_version_id: string | null
          discount_code_id: string | null
          discount_code_snapshot: string | null
          discount_paise: number
          dispatched_at: string | null
          estimated_dispatch_at: string | null
          hold_from_status: Database["public"]["Enums"]["order_status"] | null
          id: string
          internal_priority: string
          order_number: string
          order_source: Database["public"]["Enums"]["order_source"]
          order_type: Database["public"]["Enums"]["order_type"]
          pricing_version: string
          production_approved_configuration_revision: number | null
          production_started_at: string | null
          public_status: Database["public"]["Enums"]["public_order_status"]
          refund_reference: string | null
          refund_requested_at: string | null
          refunded_at: string | null
          requested_delivery_date: string | null
          shipping_charge_paise: number
          shipping_snapshot: Json
          status: Database["public"]["Enums"]["order_status"]
          subtotal_paise: number
          tax_paise: number
          taxable_value_paise: number
          terms_snapshot: Json
          total_paise: number
          updated_at: string
        }
        Insert: {
          amount_paid_paise?: number
          artwork_approved_at?: string | null
          assigned_staff_user_id?: string | null
          billing_snapshot: Json
          business_snapshot?: Json
          cancelled_at?: string | null
          configuration_reopen_previous_status?:
            | Database["public"]["Enums"]["order_status"]
            | null
          configuration_reopen_reason?: string | null
          configuration_reopened_at?: string | null
          configuration_reopened_by?: string | null
          configuration_revision?: number
          configuration_schema_version: number
          configuration_snapshot: Json
          confirmed_at?: string
          created_at?: string
          created_by_staff_user_id?: string | null
          currency?: string
          customer_reference?: string | null
          customer_snapshot: Json
          customer_user_id: string
          delivered_at?: string | null
          design_project_id?: string | null
          design_version_id?: string | null
          discount_code_id?: string | null
          discount_code_snapshot?: string | null
          discount_paise?: number
          dispatched_at?: string | null
          estimated_dispatch_at?: string | null
          hold_from_status?: Database["public"]["Enums"]["order_status"] | null
          id?: string
          internal_priority?: string
          order_number: string
          order_source: Database["public"]["Enums"]["order_source"]
          order_type: Database["public"]["Enums"]["order_type"]
          pricing_version: string
          production_approved_configuration_revision?: number | null
          production_started_at?: string | null
          public_status: Database["public"]["Enums"]["public_order_status"]
          refund_reference?: string | null
          refund_requested_at?: string | null
          refunded_at?: string | null
          requested_delivery_date?: string | null
          shipping_charge_paise?: number
          shipping_snapshot: Json
          status: Database["public"]["Enums"]["order_status"]
          subtotal_paise: number
          tax_paise: number
          taxable_value_paise: number
          terms_snapshot: Json
          total_paise: number
          updated_at?: string
        }
        Update: {
          amount_paid_paise?: number
          artwork_approved_at?: string | null
          assigned_staff_user_id?: string | null
          billing_snapshot?: Json
          business_snapshot?: Json
          cancelled_at?: string | null
          configuration_reopen_previous_status?:
            | Database["public"]["Enums"]["order_status"]
            | null
          configuration_reopen_reason?: string | null
          configuration_reopened_at?: string | null
          configuration_reopened_by?: string | null
          configuration_revision?: number
          configuration_schema_version?: number
          configuration_snapshot?: Json
          confirmed_at?: string
          created_at?: string
          created_by_staff_user_id?: string | null
          currency?: string
          customer_reference?: string | null
          customer_snapshot?: Json
          customer_user_id?: string
          delivered_at?: string | null
          design_project_id?: string | null
          design_version_id?: string | null
          discount_code_id?: string | null
          discount_code_snapshot?: string | null
          discount_paise?: number
          dispatched_at?: string | null
          estimated_dispatch_at?: string | null
          hold_from_status?: Database["public"]["Enums"]["order_status"] | null
          id?: string
          internal_priority?: string
          order_number?: string
          order_source?: Database["public"]["Enums"]["order_source"]
          order_type?: Database["public"]["Enums"]["order_type"]
          pricing_version?: string
          production_approved_configuration_revision?: number | null
          production_started_at?: string | null
          public_status?: Database["public"]["Enums"]["public_order_status"]
          refund_reference?: string | null
          refund_requested_at?: string | null
          refunded_at?: string | null
          requested_delivery_date?: string | null
          shipping_charge_paise?: number
          shipping_snapshot?: Json
          status?: Database["public"]["Enums"]["order_status"]
          subtotal_paise?: number
          tax_paise?: number
          taxable_value_paise?: number
          terms_snapshot?: Json
          total_paise?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "orders_assigned_staff_user_id_fkey"
            columns: ["assigned_staff_user_id"]
            isOneToOne: false
            referencedRelation: "staff_members"
            referencedColumns: ["user_id"]
          },
          {
            foreignKeyName: "orders_configuration_reopened_by_fkey"
            columns: ["configuration_reopened_by"]
            isOneToOne: false
            referencedRelation: "staff_members"
            referencedColumns: ["user_id"]
          },
          {
            foreignKeyName: "orders_created_by_staff_user_id_fkey"
            columns: ["created_by_staff_user_id"]
            isOneToOne: false
            referencedRelation: "staff_members"
            referencedColumns: ["user_id"]
          },
          {
            foreignKeyName: "orders_customer_user_id_fkey"
            columns: ["customer_user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "orders_design_project_id_fkey"
            columns: ["design_project_id"]
            isOneToOne: false
            referencedRelation: "design_projects"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "orders_design_version_id_fkey"
            columns: ["design_version_id"]
            isOneToOne: false
            referencedRelation: "design_project_versions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "orders_discount_code_id_fkey"
            columns: ["discount_code_id"]
            isOneToOne: false
            referencedRelation: "discount_codes"
            referencedColumns: ["id"]
          },
        ]
      }
      payment_attempts: {
        Row: {
          amount_paise: number
          attempt_number: number
          created_at: string
          currency: string
          customer_email: string
          customer_name: string
          expected_product_info: string
          failed_at: string | null
          failure_code: string | null
          failure_message: string | null
          id: string
          initiated_at: string | null
          last_reconciled_at: string | null
          last_reconciliation_error: string | null
          order_id: string
          paid_at: string | null
          provider: string
          provider_merchant_txn_id: string
          provider_payment_id: string | null
          purpose: Database["public"]["Enums"]["payment_purpose"]
          raw_verified_snapshot: Json | null
          reconciliation_attempts: number
          status: Database["public"]["Enums"]["payment_status"]
          updated_at: string
        }
        Insert: {
          amount_paise: number
          attempt_number: number
          created_at?: string
          currency?: string
          customer_email: string
          customer_name: string
          expected_product_info: string
          failed_at?: string | null
          failure_code?: string | null
          failure_message?: string | null
          id?: string
          initiated_at?: string | null
          last_reconciled_at?: string | null
          last_reconciliation_error?: string | null
          order_id: string
          paid_at?: string | null
          provider?: string
          provider_merchant_txn_id: string
          provider_payment_id?: string | null
          purpose: Database["public"]["Enums"]["payment_purpose"]
          raw_verified_snapshot?: Json | null
          reconciliation_attempts?: number
          status?: Database["public"]["Enums"]["payment_status"]
          updated_at?: string
        }
        Update: {
          amount_paise?: number
          attempt_number?: number
          created_at?: string
          currency?: string
          customer_email?: string
          customer_name?: string
          expected_product_info?: string
          failed_at?: string | null
          failure_code?: string | null
          failure_message?: string | null
          id?: string
          initiated_at?: string | null
          last_reconciled_at?: string | null
          last_reconciliation_error?: string | null
          order_id?: string
          paid_at?: string | null
          provider?: string
          provider_merchant_txn_id?: string
          provider_payment_id?: string | null
          purpose?: Database["public"]["Enums"]["payment_purpose"]
          raw_verified_snapshot?: Json | null
          reconciliation_attempts?: number
          status?: Database["public"]["Enums"]["payment_status"]
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "payment_attempts_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "orders"
            referencedColumns: ["id"]
          },
        ]
      }
      payment_events: {
        Row: {
          authentic: boolean
          created_at: string
          event_fingerprint: string
          event_source: string
          event_type: string
          id: string
          payload: Json
          payment_attempt_id: string
          processed: boolean
          processed_at: string | null
          processing_error: string | null
          provider: string
          provider_event_id: string | null
        }
        Insert: {
          authentic?: boolean
          created_at?: string
          event_fingerprint: string
          event_source: string
          event_type: string
          id?: string
          payload: Json
          payment_attempt_id: string
          processed?: boolean
          processed_at?: string | null
          processing_error?: string | null
          provider?: string
          provider_event_id?: string | null
        }
        Update: {
          authentic?: boolean
          created_at?: string
          event_fingerprint?: string
          event_source?: string
          event_type?: string
          id?: string
          payload?: Json
          payment_attempt_id?: string
          processed?: boolean
          processed_at?: string | null
          processing_error?: string | null
          provider?: string
          provider_event_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "payment_events_payment_attempt_id_fkey"
            columns: ["payment_attempt_id"]
            isOneToOne: false
            referencedRelation: "payment_attempts"
            referencedColumns: ["id"]
          },
        ]
      }
      privacy_requests: {
        Row: {
          created_at: string
          customer_note: string | null
          customer_user_id: string
          id: string
          request_type: Database["public"]["Enums"]["privacy_request_type"]
          resolution_notes: string | null
          status: Database["public"]["Enums"]["privacy_request_status"]
          updated_at: string
        }
        Insert: {
          created_at?: string
          customer_note?: string | null
          customer_user_id: string
          id?: string
          request_type: Database["public"]["Enums"]["privacy_request_type"]
          resolution_notes?: string | null
          status?: Database["public"]["Enums"]["privacy_request_status"]
          updated_at?: string
        }
        Update: {
          created_at?: string
          customer_note?: string | null
          customer_user_id?: string
          id?: string
          request_type?: Database["public"]["Enums"]["privacy_request_type"]
          resolution_notes?: string | null
          status?: Database["public"]["Enums"]["privacy_request_status"]
          updated_at?: string
        }
        Relationships: []
      }
      profiles: {
        Row: {
          created_at: string
          department: string | null
          first_name: string
          id: string
          job_title: string | null
          last_name: string
          locale: string
          onboarding_completed_at: string | null
          phone: string | null
          privacy_accepted_at: string | null
          privacy_version: string | null
          terms_accepted_at: string | null
          terms_version: string | null
          timezone: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          department?: string | null
          first_name: string
          id: string
          job_title?: string | null
          last_name: string
          locale?: string
          onboarding_completed_at?: string | null
          phone?: string | null
          privacy_accepted_at?: string | null
          privacy_version?: string | null
          terms_accepted_at?: string | null
          terms_version?: string | null
          timezone?: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          department?: string | null
          first_name?: string
          id?: string
          job_title?: string | null
          last_name?: string
          locale?: string
          onboarding_completed_at?: string | null
          phone?: string | null
          privacy_accepted_at?: string | null
          privacy_version?: string | null
          terms_accepted_at?: string | null
          terms_version?: string | null
          timezone?: string
          updated_at?: string
        }
        Relationships: []
      }
      staff_members: {
        Row: {
          activated_at: string | null
          active: boolean
          created_at: string
          deactivated_at: string | null
          email: string
          invited_at: string | null
          invited_by: string | null
          last_staff_login_at: string | null
          mfa_enrolled_at: string | null
          must_use_mfa: boolean
          role: Database["public"]["Enums"]["staff_role"]
          updated_at: string
          user_id: string
        }
        Insert: {
          activated_at?: string | null
          active?: boolean
          created_at?: string
          deactivated_at?: string | null
          email: string
          invited_at?: string | null
          invited_by?: string | null
          last_staff_login_at?: string | null
          mfa_enrolled_at?: string | null
          must_use_mfa?: boolean
          role: Database["public"]["Enums"]["staff_role"]
          updated_at?: string
          user_id: string
        }
        Update: {
          activated_at?: string | null
          active?: boolean
          created_at?: string
          deactivated_at?: string | null
          email?: string
          invited_at?: string | null
          invited_by?: string | null
          last_staff_login_at?: string | null
          mfa_enrolled_at?: string | null
          must_use_mfa?: boolean
          role?: Database["public"]["Enums"]["staff_role"]
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "staff_members_invited_by_fkey"
            columns: ["invited_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "staff_members_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: true
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      system_job_runs: {
        Row: {
          completed_at: string | null
          created_at: string
          error_message: string | null
          id: string
          job_name: string
          started_at: string
          status: string
          summary: Json
          trigger_source: string
          trigger_user_id: string | null
        }
        Insert: {
          completed_at?: string | null
          created_at?: string
          error_message?: string | null
          id?: string
          job_name: string
          started_at?: string
          status?: string
          summary?: Json
          trigger_source?: string
          trigger_user_id?: string | null
        }
        Update: {
          completed_at?: string | null
          created_at?: string
          error_message?: string | null
          id?: string
          job_name?: string
          started_at?: string
          status?: string
          summary?: Json
          trigger_source?: string
          trigger_user_id?: string | null
        }
        Relationships: []
      }
      terms_acceptances: {
        Row: {
          accepted_at: string
          checkout_session_id: string | null
          id: string
          order_id: string | null
          privacy_version: string
          request_metadata: Json
          source_flow: string
          terms_content_hash: string
          terms_version: string
          user_id: string
        }
        Insert: {
          accepted_at?: string
          checkout_session_id?: string | null
          id?: string
          order_id?: string | null
          privacy_version: string
          request_metadata?: Json
          source_flow: string
          terms_content_hash: string
          terms_version: string
          user_id: string
        }
        Update: {
          accepted_at?: string
          checkout_session_id?: string | null
          id?: string
          order_id?: string | null
          privacy_version?: string
          request_metadata?: Json
          source_flow?: string
          terms_content_hash?: string
          terms_version?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "terms_acceptances_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "orders"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "terms_acceptances_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      accept_legal_terms: {
        Args: { p_privacy_version: string; p_terms_version: string }
        Returns: boolean
      }
      archive_cloud_design: {
        Args: { p_design_project_id: string; p_expected_revision: number }
        Returns: boolean
      }
      claim_expired_private_uploads: {
        Args: { p_limit?: number }
        Returns: {
          file_id: string
          object_key: string
        }[]
      }
      claim_integration_jobs: {
        Args: { p_limit: number; p_worker_id: string }
        Returns: {
          attempts: number
          available_at: string
          completed_at: string | null
          created_at: string
          deduplication_key: string
          id: string
          job_type: string
          last_error: string | null
          locked_at: string | null
          locked_by: string | null
          payload: Json
          status: string
          updated_at: string
        }[]
        SetofOptions: {
          from: "*"
          to: "integration_jobs"
          isOneToOne: false
          isSetofReturn: true
        }
      }
      complete_customer_onboarding: {
        Args: {
          p_department: string
          p_first_name: string
          p_last_name: string
          p_phone: string
          p_privacy_version: string
          p_terms_version: string
        }
        Returns: undefined
      }
      complete_expired_private_upload_cleanup: {
        Args: { p_file_ids: string[] }
        Returns: number
      }
      complete_integration_job: {
        Args: { p_job_id: string; p_worker_id: string }
        Returns: boolean
      }
      configuration_artwork_file_ids: {
        Args: { p_snapshot: Json }
        Returns: string[]
      }
      consume_auth_rate_limit: {
        Args: {
          p_max_attempts: number
          p_scope: string
          p_subject_hash: string
          p_window_seconds: number
        }
        Returns: {
          allowed: boolean
          retry_after_seconds: number
        }[]
      }
      create_cloud_design: {
        Args: {
          p_client_import_id?: string
          p_configuration_snapshot: Json
          p_pricing_input_snapshot?: Json
          p_schema_version: number
          p_source?: string
          p_title: string
        }
        Returns: {
          created_new: boolean
          design_project_id: string
          design_version_id: string
          draft_revision: number
          last_saved_at: string
          version_number: number
        }[]
      }
      create_cloud_design_version: {
        Args: { p_design_project_id: string; p_expected_revision: number }
        Returns: {
          conflict: boolean
          design_version_id: string
          draft_revision: number
          last_saved_at: string
          version_number: number
        }[]
      }
      create_private_upload_slot: {
        Args: {
          p_byte_size: number
          p_content_type: string
          p_design_project_id: string
          p_expires_at: string
          p_extension: string
          p_kind: Database["public"]["Enums"]["file_kind"]
          p_order_id: string
          p_original_filename: string
          p_replacement_for_file_id: string
          p_safe_filename: string
          p_sha256: string
          p_visibility: Database["public"]["Enums"]["file_visibility"]
        }
        Returns: {
          file_id: string
          object_key: string
        }[]
      }
      current_account_type: {
        Args: never
        Returns: Database["public"]["Enums"]["account_type"]
      }
      current_staff_role: {
        Args: never
        Returns: Database["public"]["Enums"]["staff_role"]
      }
      customer_artwork_requirements: {
        Args: { p_order_id: string }
        Returns: {
          file_id: string
          requirement_key: string
          review_reason: string
          review_status: Database["public"]["Enums"]["artwork_review_status"]
          revision: number
          safe_filename: string
          upload_status: string
        }[]
      }
      customer_order_history: {
        Args: { p_order_id: string }
        Returns: {
          actor_type: string
          created_at: string
          customer_message: string
          id: string
          public_status: Database["public"]["Enums"]["public_order_status"]
          to_status: Database["public"]["Enums"]["order_status"]
        }[]
      }
      customer_payment_summaries: {
        Args: { p_order_id: string }
        Returns: {
          amount_paise: number
          created_at: string
          paid_at: string
          payment_attempt_id: string
          purpose: Database["public"]["Enums"]["payment_purpose"]
          status: Database["public"]["Enums"]["payment_status"]
        }[]
      }
      decide_order_cancellation: {
        Args: { p_approve: boolean; p_note?: string; p_request_id: string }
        Returns: boolean
      }
      duplicate_cloud_design: {
        Args: {
          p_client_operation_id: string
          p_design_project_id: string
          p_title: string
        }
        Returns: {
          created_new: boolean
          design_project_id: string
          design_version_id: string
          draft_revision: number
          last_saved_at: string
          version_number: number
        }[]
      }
      enqueue_abandoned_design_recovery: {
        Args: { p_inactive_interval?: string }
        Returns: number
      }
      ensure_customer_account: {
        Args: { p_privacy_version: string; p_terms_version: string }
        Returns: string
      }
      ensure_customer_account_validated: {
        Args: { p_privacy_version: string; p_terms_version: string }
        Returns: string
      }
      expire_private_upload_slots: { Args: never; Returns: number }
      fail_integration_job: {
        Args: {
          p_error: string
          p_job_id: string
          p_permanent?: boolean
          p_retry_at: string
          p_worker_id: string
        }
        Returns: boolean
      }
      finalize_checkout_full_payment: {
        Args: {
          p_checkout_payment_attempt_id: string
          p_provider_payment_id: string
          p_seller_snapshot: Json
          p_verified_amount_paise: number
          p_verified_snapshot: Json
        }
        Returns: {
          already_finalized: boolean
          duplicate_success: boolean
          order_id: string
          order_number: string
          payment_attempt_id: string
        }[]
      }
      finalize_private_upload: {
        Args: {
          p_actual_byte_size: number
          p_actual_content_type: string
          p_actual_sha256: string
          p_file_id: string
          p_object_etag: string
        }
        Returns: boolean
      }
      finalize_verified_payment: {
        Args: {
          p_currency: string
          p_invoice_kind?: Database["public"]["Enums"]["invoice_kind"]
          p_payment_attempt_id: string
          p_provider_payment_id: string
          p_verified_amount_paise: number
          p_verified_snapshot: Json
        }
        Returns: boolean
      }
      foundry_business_metrics: {
        Args: { p_from: string; p_to: string }
        Returns: Json
      }
      get_staff_access_context: {
        Args: never
        Returns: {
          active: boolean
          mfa_satisfied: boolean
          must_use_mfa: boolean
          role: Database["public"]["Enums"]["staff_role"]
        }[]
      }
      is_active_staff: { Args: { p_require_mfa?: boolean }; Returns: boolean }
      is_order_transition_allowed: {
        Args: {
          p_from: Database["public"]["Enums"]["order_status"]
          p_to: Database["public"]["Enums"]["order_status"]
        }
        Returns: boolean
      }
      next_number: {
        Args: { p_namespace: string; p_prefix: string }
        Returns: string
      }
      order_public_status_for_internal: {
        Args: { p_status: Database["public"]["Enums"]["order_status"] }
        Returns: Database["public"]["Enums"]["public_order_status"]
      }
      record_order_refund: {
        Args: {
          p_complete: boolean
          p_order_id: string
          p_reason: string
          p_reference: string
        }
        Returns: boolean
      }
      record_payment_reconciliation_attempt: {
        Args: { p_attempt_id: string; p_checkout: boolean; p_error?: string }
        Returns: boolean
      }
      record_payu_payment_state: {
        Args: {
          p_failure_code?: string
          p_failure_message?: string
          p_payment_attempt_id: string
          p_provider_payment_id?: string
          p_state: Database["public"]["Enums"]["payment_status"]
          p_verified_snapshot?: Json
        }
        Returns: boolean
      }
      record_staff_login: { Args: never; Returns: undefined }
      record_staff_mfa_enrollment: { Args: never; Returns: undefined }
      replace_configuration_artwork_file: {
        Args: {
          p_file_id: string
          p_line_number: number
          p_slot: string
          p_snapshot: Json
        }
        Returns: Json
      }
      request_order_cancellation: {
        Args: { p_order_id: string; p_reason: string }
        Returns: string
      }
      reserve_tax_invoice_number: {
        Args: { p_invoice_id: string }
        Returns: {
          invoice_id: string
          invoice_number: string
        }[]
      }
      retry_integration_job: { Args: { p_job_id: string }; Returns: boolean }
      review_artwork_file: {
        Args: {
          p_decision: Database["public"]["Enums"]["artwork_review_status"]
          p_file_id: string
          p_reason?: string
        }
        Returns: boolean
      }
      save_cloud_design_draft: {
        Args: {
          p_configuration_snapshot: Json
          p_design_project_id: string
          p_expected_revision: number
          p_pricing_input_snapshot?: Json
          p_schema_version: number
          p_title?: string
        }
        Returns: {
          configuration_snapshot: Json
          conflict: boolean
          current_version: number
          draft_revision: number
          last_saved_at: string
          pricing_input_snapshot: Json
          status: string
          title: string
        }[]
      }
      save_customer_address: {
        Args: {
          p_address_id: string
          p_city: string
          p_contact_name: string
          p_country_code: string
          p_label: string
          p_landmark: string
          p_line1: string
          p_line2: string
          p_phone: string
          p_postal_code: string
          p_role: string
          p_state: string
          p_use_as_shipping: boolean
        }
        Returns: string
      }
      save_customer_checkout_defaults: {
        Args: {
          p_billing_address: Json
          p_billing_email: string
          p_billing_entity: string
          p_billing_same_as_shipping: boolean
          p_first_name: string
          p_gstin: string
          p_last_name: string
          p_phone: string
          p_shipping_address: Json
        }
        Returns: undefined
      }
      set_staff_active: {
        Args: { p_active: boolean; p_user_id: string }
        Returns: boolean
      }
      soft_delete_file: { Args: { p_file_id: string }; Returns: boolean }
      staff_has_permission: { Args: { p_permission: string }; Returns: boolean }
      staff_mfa_satisfied: { Args: never; Returns: boolean }
      staff_order_history: {
        Args: { p_order_id: string }
        Returns: {
          actor_type: string
          created_at: string
          customer_message: string
          id: string
          internal_note: string
          public_status: Database["public"]["Enums"]["public_order_status"]
          reason: string
          to_status: Database["public"]["Enums"]["order_status"]
        }[]
      }
      staff_payment_summaries: {
        Args: { p_order_id?: string }
        Returns: {
          amount_paise: number
          created_at: string
          failure_message: string
          order_id: string
          order_number: string
          paid_at: string
          payment_attempt_id: string
          provider_merchant_txn_id: string
          provider_payment_id: string
          purpose: Database["public"]["Enums"]["payment_purpose"]
          status: Database["public"]["Enums"]["payment_status"]
        }[]
      }
      staff_transition_order: {
        Args: {
          p_customer_message?: string
          p_internal_note?: string
          p_order_id: string
          p_reason?: string
          p_to_status: Database["public"]["Enums"]["order_status"]
        }
        Returns: boolean
      }
      update_my_profile: {
        Args: {
          p_department?: string
          p_first_name: string
          p_job_title?: string
          p_last_name: string
          p_locale?: string
          p_phone?: string
          p_timezone?: string
        }
        Returns: boolean
      }
      validate_discount_code: {
        Args: {
          p_code: string
          p_customer_user_id: string
          p_subtotal_paise: number
        }
        Returns: {
          discount_code_id: string
          discount_paise: number
          normalized_code: string
        }[]
      }
    }
    Enums: {
      account_type: "customer" | "staff"
      artwork_review_status:
        | "pending_review"
        | "approved"
        | "changes_requested"
        | "rejected"
      discount_kind: "percentage" | "fixed"
      file_kind:
        | "customer_artwork"
        | "approval_pdf"
        | "proof"
        | "invoice_pdf"
        | "qc_photo"
        | "packing_list"
        | "shipping_label"
        | "shipment_document"
        | "other"
      file_scan_status:
        | "pending"
        | "manual_review"
        | "clean"
        | "rejected"
        | "not_required"
        | "pending_scan"
        | "infected"
        | "scan_failed"
        | "scanner_unavailable"
      file_visibility: "customer" | "staff_only"
      invoice_kind: "tax_invoice" | "credit_note"
      invoice_sync_status:
        | "queued"
        | "processing"
        | "completed"
        | "retryable_failure"
        | "permanent_failure"
        | "voided"
      order_source: "customer_checkout" | "reorder"
      order_status:
        | "payment_confirmed"
        | "order_review"
        | "artwork_pending"
        | "artwork_approved"
        | "production_approved"
        | "material_preparation"
        | "printing"
        | "stitching"
        | "quality_check"
        | "packing"
        | "ready_to_dispatch"
        | "dispatched"
        | "delivered"
        | "on_hold"
        | "cancelled"
        | "refund_pending"
        | "refunded"
      order_type: "configurator_order" | "sample_purchase" | "reorder"
      payment_purpose: "order_full" | "refund"
      payment_status:
        | "created"
        | "initiated"
        | "pending"
        | "paid"
        | "failed"
        | "cancelled"
        | "duplicate_success"
        | "refunded"
        | "partially_refunded"
        | "disputed"
      privacy_request_status:
        | "submitted"
        | "in_review"
        | "completed"
        | "rejected"
      privacy_request_type: "export" | "delete" | "correction"
      public_order_status:
        | "order_received"
        | "artwork_under_review"
        | "approved_for_production"
        | "in_production"
        | "quality_check_and_packing"
        | "preparing_dispatch"
        | "shipped"
        | "delivered"
        | "action_required"
        | "cancelled"
      staff_role: "founder" | "operations"
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
    Enums: {
      account_type: ["customer", "staff"],
      artwork_review_status: [
        "pending_review",
        "approved",
        "changes_requested",
        "rejected",
      ],
      discount_kind: ["percentage", "fixed"],
      file_kind: [
        "customer_artwork",
        "approval_pdf",
        "proof",
        "invoice_pdf",
        "qc_photo",
        "packing_list",
        "shipping_label",
        "shipment_document",
        "other",
      ],
      file_scan_status: [
        "pending",
        "manual_review",
        "clean",
        "rejected",
        "not_required",
        "pending_scan",
        "infected",
        "scan_failed",
        "scanner_unavailable",
      ],
      file_visibility: ["customer", "staff_only"],
      invoice_kind: ["tax_invoice", "credit_note"],
      invoice_sync_status: [
        "queued",
        "processing",
        "completed",
        "retryable_failure",
        "permanent_failure",
        "voided",
      ],
      order_source: ["customer_checkout", "reorder"],
      order_status: [
        "payment_confirmed",
        "order_review",
        "artwork_pending",
        "artwork_approved",
        "production_approved",
        "material_preparation",
        "printing",
        "stitching",
        "quality_check",
        "packing",
        "ready_to_dispatch",
        "dispatched",
        "delivered",
        "on_hold",
        "cancelled",
        "refund_pending",
        "refunded",
      ],
      order_type: ["configurator_order", "sample_purchase", "reorder"],
      payment_purpose: ["order_full", "refund"],
      payment_status: [
        "created",
        "initiated",
        "pending",
        "paid",
        "failed",
        "cancelled",
        "duplicate_success",
        "refunded",
        "partially_refunded",
        "disputed",
      ],
      privacy_request_status: [
        "submitted",
        "in_review",
        "completed",
        "rejected",
      ],
      privacy_request_type: ["export", "delete", "correction"],
      public_order_status: [
        "order_received",
        "artwork_under_review",
        "approved_for_production",
        "in_production",
        "quality_check_and_packing",
        "preparing_dispatch",
        "shipped",
        "delivered",
        "action_required",
        "cancelled",
      ],
      staff_role: ["founder", "operations"],
    },
  },
} as const

