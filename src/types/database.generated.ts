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
      addresses: {
        Row: {
          city: string
          contact_name: string | null
          country_code: string
          created_at: string
          gstin: string | null
          id: string
          is_default_billing: boolean
          is_default_shipping: boolean
          label: string | null
          landmark: string | null
          line1: string
          line2: string | null
          organization_id: string
          phone: string | null
          postal_code: string
          state: string
          updated_at: string
        }
        Insert: {
          city: string
          contact_name?: string | null
          country_code?: string
          created_at?: string
          gstin?: string | null
          id?: string
          is_default_billing?: boolean
          is_default_shipping?: boolean
          label?: string | null
          landmark?: string | null
          line1: string
          line2?: string | null
          organization_id: string
          phone?: string | null
          postal_code: string
          state: string
          updated_at?: string
        }
        Update: {
          city?: string
          contact_name?: string | null
          country_code?: string
          created_at?: string
          gstin?: string | null
          id?: string
          is_default_billing?: boolean
          is_default_shipping?: boolean
          label?: string | null
          landmark?: string | null
          line1?: string
          line2?: string | null
          organization_id?: string
          phone?: string | null
          postal_code?: string
          state?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "addresses_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      approvals: {
        Row: {
          approval_pdf_file_id: string | null
          created_at: string
          decision_metadata: Json | null
          design_version_id: string
          expires_at: string | null
          id: string
          ip_hash: string | null
          order_id: string
          requested_by: string | null
          requested_from_email: string | null
          requested_from_user_id: string | null
          responded_at: string | null
          response_note: string | null
          revoked_at: string | null
          revoked_by: string | null
          secure_token_hash: string | null
          snapshot_sha256: string | null
          status: string
          user_agent_summary: string | null
          viewed_at: string | null
        }
        Insert: {
          approval_pdf_file_id?: string | null
          created_at?: string
          decision_metadata?: Json | null
          design_version_id: string
          expires_at?: string | null
          id?: string
          ip_hash?: string | null
          order_id: string
          requested_by?: string | null
          requested_from_email?: string | null
          requested_from_user_id?: string | null
          responded_at?: string | null
          response_note?: string | null
          revoked_at?: string | null
          revoked_by?: string | null
          secure_token_hash?: string | null
          snapshot_sha256?: string | null
          status: string
          user_agent_summary?: string | null
          viewed_at?: string | null
        }
        Update: {
          approval_pdf_file_id?: string | null
          created_at?: string
          decision_metadata?: Json | null
          design_version_id?: string
          expires_at?: string | null
          id?: string
          ip_hash?: string | null
          order_id?: string
          requested_by?: string | null
          requested_from_email?: string | null
          requested_from_user_id?: string | null
          responded_at?: string | null
          response_note?: string | null
          revoked_at?: string | null
          revoked_by?: string | null
          secure_token_hash?: string | null
          snapshot_sha256?: string | null
          status?: string
          user_agent_summary?: string | null
          viewed_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "approvals_approval_pdf_file_id_fkey"
            columns: ["approval_pdf_file_id"]
            isOneToOne: false
            referencedRelation: "order_files"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "approvals_design_version_id_fkey"
            columns: ["design_version_id"]
            isOneToOne: false
            referencedRelation: "design_project_versions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "approvals_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "orders"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "approvals_requested_by_fkey"
            columns: ["requested_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "approvals_requested_from_user_id_fkey"
            columns: ["requested_from_user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "approvals_revoked_by_fkey"
            columns: ["revoked_by"]
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
          ip_hash: string | null
          order_id: string | null
          organization_id: string | null
          request_id: string | null
          target_id: string | null
          target_type: string
          user_agent_summary: string | null
        }
        Insert: {
          action: string
          actor_type: string
          actor_user_id?: string | null
          after_state?: Json | null
          before_state?: Json | null
          created_at?: string
          id?: string
          ip_hash?: string | null
          order_id?: string | null
          organization_id?: string | null
          request_id?: string | null
          target_id?: string | null
          target_type: string
          user_agent_summary?: string | null
        }
        Update: {
          action?: string
          actor_type?: string
          actor_user_id?: string | null
          after_state?: Json | null
          before_state?: Json | null
          created_at?: string
          id?: string
          ip_hash?: string | null
          order_id?: string | null
          organization_id?: string | null
          request_id?: string | null
          target_id?: string | null
          target_type?: string
          user_agent_summary?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "audit_logs_actor_user_id_fkey"
            columns: ["actor_user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "audit_logs_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "orders"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "audit_logs_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
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
          window_started_at?: string
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
      design_estimates: {
        Row: {
          balance_due_paise: number
          client_operation_id: string
          converted_order_id: string | null
          created_at: string
          created_by: string
          currency: string
          design_project_id: string
          design_revision: number
          design_version_id: string
          discount_paise: number
          estimate_number: string
          generated_at: string
          gst_paise: number
          gst_rate_basis_points: number
          id: string
          organization_id: string
          pricing_engine_version: string
          pricing_snapshot: Json
          reservation_fee_paise: number
          shipping_paise: number | null
          status: string
          subtotal_paise: number
          taxable_subtotal_paise: number
          total_paise: number
          valid_until: string
        }
        Insert: {
          balance_due_paise: number
          client_operation_id: string
          converted_order_id?: string | null
          created_at?: string
          created_by: string
          currency?: string
          design_project_id: string
          design_revision: number
          design_version_id: string
          discount_paise: number
          estimate_number: string
          generated_at?: string
          gst_paise: number
          gst_rate_basis_points: number
          id?: string
          organization_id: string
          pricing_engine_version: string
          pricing_snapshot: Json
          reservation_fee_paise: number
          shipping_paise?: number | null
          status?: string
          subtotal_paise: number
          taxable_subtotal_paise: number
          total_paise: number
          valid_until: string
        }
        Update: {
          balance_due_paise?: number
          client_operation_id?: string
          converted_order_id?: string | null
          created_at?: string
          created_by?: string
          currency?: string
          design_project_id?: string
          design_revision?: number
          design_version_id?: string
          discount_paise?: number
          estimate_number?: string
          generated_at?: string
          gst_paise?: number
          gst_rate_basis_points?: number
          id?: string
          organization_id?: string
          pricing_engine_version?: string
          pricing_snapshot?: Json
          reservation_fee_paise?: number
          shipping_paise?: number | null
          status?: string
          subtotal_paise?: number
          taxable_subtotal_paise?: number
          total_paise?: number
          valid_until?: string
        }
        Relationships: [
          {
            foreignKeyName: "design_estimates_converted_order_id_fkey"
            columns: ["converted_order_id"]
            isOneToOne: false
            referencedRelation: "orders"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "design_estimates_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "design_estimates_design_project_id_fkey"
            columns: ["design_project_id"]
            isOneToOne: false
            referencedRelation: "design_projects"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "design_estimates_design_version_id_fkey"
            columns: ["design_version_id"]
            isOneToOne: false
            referencedRelation: "design_project_versions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "design_estimates_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
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
          organization_id: string
          pricing_input_snapshot: Json | null
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
          draft_snapshot?: Json
          id?: string
          last_saved_at?: string
          organization_id: string
          pricing_input_snapshot?: Json | null
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
          organization_id?: string
          pricing_input_snapshot?: Json | null
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
          {
            foreignKeyName: "design_projects_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      idempotency_keys: {
        Row: {
          actor_id: string | null
          created_at: string
          expires_at: string
          id: string
          key: string
          request_hash: string
          resource_id: string | null
          resource_type: string | null
          response_body: Json | null
          response_status: number | null
          scope: string
        }
        Insert: {
          actor_id?: string | null
          created_at?: string
          expires_at: string
          id?: string
          key: string
          request_hash: string
          resource_id?: string | null
          resource_type?: string | null
          response_body?: Json | null
          response_status?: number | null
          scope: string
        }
        Update: {
          actor_id?: string | null
          created_at?: string
          expires_at?: string
          id?: string
          key?: string
          request_hash?: string
          resource_id?: string | null
          resource_type?: string | null
          response_body?: Json | null
          response_status?: number | null
          scope?: string
        }
        Relationships: []
      }
      integration_jobs: {
        Row: {
          aggregate_id: string
          aggregate_type: string
          attempt_count: number
          available_at: string
          completed_at: string | null
          created_at: string
          dedupe_key: string
          id: string
          job_type: string
          last_error: string | null
          locked_at: string | null
          locked_by: string | null
          max_attempts: number
          payload: Json
          priority: number
          status: string
          updated_at: string
        }
        Insert: {
          aggregate_id: string
          aggregate_type: string
          attempt_count?: number
          available_at?: string
          completed_at?: string | null
          created_at?: string
          dedupe_key: string
          id?: string
          job_type: string
          last_error?: string | null
          locked_at?: string | null
          locked_by?: string | null
          max_attempts?: number
          payload?: Json
          priority?: number
          status?: string
          updated_at?: string
        }
        Update: {
          aggregate_id?: string
          aggregate_type?: string
          attempt_count?: number
          available_at?: string
          completed_at?: string | null
          created_at?: string
          dedupe_key?: string
          id?: string
          job_type?: string
          last_error?: string | null
          locked_at?: string | null
          locked_by?: string | null
          max_attempts?: number
          payload?: Json
          priority?: number
          status?: string
          updated_at?: string
        }
        Relationships: []
      }
      invoice_number_counters: {
        Row: {
          financial_year: number
          next_value: number
        }
        Insert: {
          financial_year: number
          next_value?: number
        }
        Update: {
          financial_year?: number
          next_value?: number
        }
        Relationships: []
      }
      invoices: {
        Row: {
          attempt_count: number
          balance_paise: number | null
          completed_at: string | null
          created_at: string
          currency: string
          document_number: string | null
          emailed_at: string | null
          id: string
          issue_date: string | null
          kind: Database["public"]["Enums"]["invoice_kind"]
          last_error_code: string | null
          last_error_message: string | null
          next_attempt_at: string | null
          order_id: string
          paid_paise: number | null
          payment_attempt_id: string | null
          pdf_file_id: string | null
          provider: string
          provider_snapshot: Json | null
          provider_status: string | null
          reference_number: string
          subtotal_paise: number | null
          sync_status: Database["public"]["Enums"]["invoice_sync_status"]
          tax_configuration_snapshot: Json | null
          tax_paise: number | null
          total_paise: number | null
          updated_at: string
          zoho_contact_id: string | null
          zoho_document_id: string | null
          zoho_payment_id: string | null
        }
        Insert: {
          attempt_count?: number
          balance_paise?: number | null
          completed_at?: string | null
          created_at?: string
          currency?: string
          document_number?: string | null
          emailed_at?: string | null
          id?: string
          issue_date?: string | null
          kind: Database["public"]["Enums"]["invoice_kind"]
          last_error_code?: string | null
          last_error_message?: string | null
          next_attempt_at?: string | null
          order_id: string
          paid_paise?: number | null
          payment_attempt_id?: string | null
          pdf_file_id?: string | null
          provider?: string
          provider_snapshot?: Json | null
          provider_status?: string | null
          reference_number: string
          subtotal_paise?: number | null
          sync_status?: Database["public"]["Enums"]["invoice_sync_status"]
          tax_configuration_snapshot?: Json | null
          tax_paise?: number | null
          total_paise?: number | null
          updated_at?: string
          zoho_contact_id?: string | null
          zoho_document_id?: string | null
          zoho_payment_id?: string | null
        }
        Update: {
          attempt_count?: number
          balance_paise?: number | null
          completed_at?: string | null
          created_at?: string
          currency?: string
          document_number?: string | null
          emailed_at?: string | null
          id?: string
          issue_date?: string | null
          kind?: Database["public"]["Enums"]["invoice_kind"]
          last_error_code?: string | null
          last_error_message?: string | null
          next_attempt_at?: string | null
          order_id?: string
          paid_paise?: number | null
          payment_attempt_id?: string | null
          pdf_file_id?: string | null
          provider?: string
          provider_snapshot?: Json | null
          provider_status?: string | null
          reference_number?: string
          subtotal_paise?: number | null
          sync_status?: Database["public"]["Enums"]["invoice_sync_status"]
          tax_configuration_snapshot?: Json | null
          tax_paise?: number | null
          total_paise?: number | null
          updated_at?: string
          zoho_contact_id?: string | null
          zoho_document_id?: string | null
          zoho_payment_id?: string | null
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
            foreignKeyName: "invoices_payment_attempt_id_fkey"
            columns: ["payment_attempt_id"]
            isOneToOne: false
            referencedRelation: "payment_attempts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "invoices_pdf_file_id_fkey"
            columns: ["pdf_file_id"]
            isOneToOne: false
            referencedRelation: "order_files"
            referencedColumns: ["id"]
          },
        ]
      }
      notifications: {
        Row: {
          action_url: string | null
          body: string
          created_at: string
          id: string
          order_id: string | null
          organization_id: string | null
          read_at: string | null
          title: string
          type: string
          user_id: string
        }
        Insert: {
          action_url?: string | null
          body: string
          created_at?: string
          id?: string
          order_id?: string | null
          organization_id?: string | null
          read_at?: string | null
          title: string
          type: string
          user_id: string
        }
        Update: {
          action_url?: string | null
          body?: string
          created_at?: string
          id?: string
          order_id?: string | null
          organization_id?: string | null
          read_at?: string | null
          title?: string
          type?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "notifications_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "orders"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "notifications_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "notifications_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
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
      order_comments: {
        Row: {
          action_required: boolean
          action_type: string | null
          author_user_id: string
          body: string
          created_at: string
          id: string
          order_id: string
          resolved_at: string | null
          resolved_by: string | null
          updated_at: string
          visibility: string
        }
        Insert: {
          action_required?: boolean
          action_type?: string | null
          author_user_id: string
          body: string
          created_at?: string
          id?: string
          order_id: string
          resolved_at?: string | null
          resolved_by?: string | null
          updated_at?: string
          visibility: string
        }
        Update: {
          action_required?: boolean
          action_type?: string | null
          author_user_id?: string
          body?: string
          created_at?: string
          id?: string
          order_id?: string
          resolved_at?: string | null
          resolved_by?: string | null
          updated_at?: string
          visibility?: string
        }
        Relationships: [
          {
            foreignKeyName: "order_comments_author_user_id_fkey"
            columns: ["author_user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "order_comments_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "orders"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "order_comments_resolved_by_fkey"
            columns: ["resolved_by"]
            isOneToOne: false
            referencedRelation: "profiles"
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
          finalized_at: string | null
          id: string
          kind: Database["public"]["Enums"]["file_kind"]
          object_etag: string | null
          object_key: string
          order_id: string | null
          original_filename: string
          provider_source: string
          safe_filename: string
          scan_review_note: string | null
          scan_reviewed_at: string | null
          scan_reviewed_by: string | null
          scan_status: Database["public"]["Enums"]["file_scan_status"]
          sha256: string | null
          upload_expires_at: string | null
          upload_status: Database["public"]["Enums"]["file_upload_status"]
          uploaded_by: string | null
          version_number: number | null
          visibility: Database["public"]["Enums"]["file_visibility"]
        }
        Insert: {
          bucket_name: string
          byte_size: number
          content_type: string
          created_at?: string
          deleted_at?: string | null
          design_project_id?: string | null
          finalized_at?: string | null
          id?: string
          kind: Database["public"]["Enums"]["file_kind"]
          object_etag?: string | null
          object_key: string
          order_id?: string | null
          original_filename: string
          provider_source?: string
          safe_filename: string
          scan_review_note?: string | null
          scan_reviewed_at?: string | null
          scan_reviewed_by?: string | null
          scan_status?: Database["public"]["Enums"]["file_scan_status"]
          sha256?: string | null
          upload_expires_at?: string | null
          upload_status?: Database["public"]["Enums"]["file_upload_status"]
          uploaded_by?: string | null
          version_number?: number | null
          visibility: Database["public"]["Enums"]["file_visibility"]
        }
        Update: {
          bucket_name?: string
          byte_size?: number
          content_type?: string
          created_at?: string
          deleted_at?: string | null
          design_project_id?: string | null
          finalized_at?: string | null
          id?: string
          kind?: Database["public"]["Enums"]["file_kind"]
          object_etag?: string | null
          object_key?: string
          order_id?: string | null
          original_filename?: string
          provider_source?: string
          safe_filename?: string
          scan_review_note?: string | null
          scan_reviewed_at?: string | null
          scan_reviewed_by?: string | null
          scan_status?: Database["public"]["Enums"]["file_scan_status"]
          sha256?: string | null
          upload_expires_at?: string | null
          upload_status?: Database["public"]["Enums"]["file_upload_status"]
          uploaded_by?: string | null
          version_number?: number | null
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
            foreignKeyName: "order_files_scan_reviewed_by_fkey"
            columns: ["scan_reviewed_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
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
      order_item_sizes: {
        Row: {
          order_item_id: string
          quantity: number
          size_code: string
        }
        Insert: {
          order_item_id: string
          quantity: number
          size_code: string
        }
        Update: {
          order_item_id?: string
          quantity?: number
          size_code?: string
        }
        Relationships: [
          {
            foreignKeyName: "order_item_sizes_order_item_id_fkey"
            columns: ["order_item_id"]
            isOneToOne: false
            referencedRelation: "order_items"
            referencedColumns: ["id"]
          },
        ]
      }
      order_items: {
        Row: {
          artwork_snapshot: Json | null
          colour_snapshot: Json | null
          created_at: string
          decoration_snapshot: Json | null
          id: string
          line_number: number
          line_total_paise: number | null
          neck_label_snapshot: Json | null
          order_id: string
          product_id: string | null
          product_name: string
          product_slug: string | null
          product_snapshot: Json
          quantity: number
          size_breakdown: Json
          unit_price_paise: number | null
        }
        Insert: {
          artwork_snapshot?: Json | null
          colour_snapshot?: Json | null
          created_at?: string
          decoration_snapshot?: Json | null
          id?: string
          line_number: number
          line_total_paise?: number | null
          neck_label_snapshot?: Json | null
          order_id: string
          product_id?: string | null
          product_name: string
          product_slug?: string | null
          product_snapshot: Json
          quantity: number
          size_breakdown: Json
          unit_price_paise?: number | null
        }
        Update: {
          artwork_snapshot?: Json | null
          colour_snapshot?: Json | null
          created_at?: string
          decoration_snapshot?: Json | null
          id?: string
          line_number?: number
          line_total_paise?: number | null
          neck_label_snapshot?: Json | null
          order_id?: string
          product_id?: string | null
          product_name?: string
          product_slug?: string | null
          product_snapshot?: Json
          quantity?: number
          size_breakdown?: Json
          unit_price_paise?: number | null
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
          metadata: Json | null
          order_id: string
          public_status: Database["public"]["Enums"]["public_order_status"]
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
          metadata?: Json | null
          order_id: string
          public_status: Database["public"]["Enums"]["public_order_status"]
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
          metadata?: Json | null
          order_id?: string
          public_status?: Database["public"]["Enums"]["public_order_status"]
          to_status?: Database["public"]["Enums"]["order_status"]
        }
        Relationships: [
          {
            foreignKeyName: "order_status_history_actor_user_id_fkey"
            columns: ["actor_user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
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
          assigned_team: string | null
          billing_snapshot: Json
          cancelled_at: string | null
          company_snapshot: Json
          configuration_schema_version: number
          confirmed_at: string | null
          created_at: string
          currency: string
          customer_reference: string | null
          customer_snapshot: Json
          customer_user_id: string
          delivered_at: string | null
          design_project_id: string | null
          design_version_id: string | null
          dispatched_at: string | null
          estimate_id: string | null
          estimated_dispatch_at: string | null
          estimated_total_paise: number
          expected_approval_at: string | null
          expected_production_at: string | null
          expected_qc_at: string | null
          expires_at: string | null
          id: string
          internal_priority: string
          order_number: string
          order_type: Database["public"]["Enums"]["order_type"]
          organization_id: string
          po_number: string | null
          pricing_version: string
          production_started_at: string | null
          public_status: Database["public"]["Enums"]["public_order_status"]
          requested_delivery_date: string | null
          reservation_amount_paise: number
          reservation_paid_at: string | null
          shipping_paise: number
          shipping_snapshot: Json
          source_order_id: string | null
          status: Database["public"]["Enums"]["order_status"]
          submitted_at: string
          subtotal_paise: number
          tax_estimate_paise: number
          terms_snapshot: Json
          updated_at: string
        }
        Insert: {
          amount_paid_paise?: number
          artwork_approved_at?: string | null
          assigned_staff_user_id?: string | null
          assigned_team?: string | null
          billing_snapshot: Json
          cancelled_at?: string | null
          company_snapshot: Json
          configuration_schema_version: number
          confirmed_at?: string | null
          created_at?: string
          currency?: string
          customer_reference?: string | null
          customer_snapshot: Json
          customer_user_id: string
          delivered_at?: string | null
          design_project_id?: string | null
          design_version_id?: string | null
          dispatched_at?: string | null
          estimate_id?: string | null
          estimated_dispatch_at?: string | null
          estimated_total_paise?: number
          expected_approval_at?: string | null
          expected_production_at?: string | null
          expected_qc_at?: string | null
          expires_at?: string | null
          id?: string
          internal_priority?: string
          order_number: string
          order_type: Database["public"]["Enums"]["order_type"]
          organization_id: string
          po_number?: string | null
          pricing_version: string
          production_started_at?: string | null
          public_status: Database["public"]["Enums"]["public_order_status"]
          requested_delivery_date?: string | null
          reservation_amount_paise?: number
          reservation_paid_at?: string | null
          shipping_paise?: number
          shipping_snapshot: Json
          source_order_id?: string | null
          status: Database["public"]["Enums"]["order_status"]
          submitted_at?: string
          subtotal_paise?: number
          tax_estimate_paise?: number
          terms_snapshot: Json
          updated_at?: string
        }
        Update: {
          amount_paid_paise?: number
          artwork_approved_at?: string | null
          assigned_staff_user_id?: string | null
          assigned_team?: string | null
          billing_snapshot?: Json
          cancelled_at?: string | null
          company_snapshot?: Json
          configuration_schema_version?: number
          confirmed_at?: string | null
          created_at?: string
          currency?: string
          customer_reference?: string | null
          customer_snapshot?: Json
          customer_user_id?: string
          delivered_at?: string | null
          design_project_id?: string | null
          design_version_id?: string | null
          dispatched_at?: string | null
          estimate_id?: string | null
          estimated_dispatch_at?: string | null
          estimated_total_paise?: number
          expected_approval_at?: string | null
          expected_production_at?: string | null
          expected_qc_at?: string | null
          expires_at?: string | null
          id?: string
          internal_priority?: string
          order_number?: string
          order_type?: Database["public"]["Enums"]["order_type"]
          organization_id?: string
          po_number?: string | null
          pricing_version?: string
          production_started_at?: string | null
          public_status?: Database["public"]["Enums"]["public_order_status"]
          requested_delivery_date?: string | null
          reservation_amount_paise?: number
          reservation_paid_at?: string | null
          shipping_paise?: number
          shipping_snapshot?: Json
          source_order_id?: string | null
          status?: Database["public"]["Enums"]["order_status"]
          submitted_at?: string
          subtotal_paise?: number
          tax_estimate_paise?: number
          terms_snapshot?: Json
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
            foreignKeyName: "orders_estimate_id_fkey"
            columns: ["estimate_id"]
            isOneToOne: false
            referencedRelation: "design_estimates"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "orders_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "orders_source_order_id_fkey"
            columns: ["source_order_id"]
            isOneToOne: false
            referencedRelation: "orders"
            referencedColumns: ["id"]
          },
        ]
      }
      organization_members: {
        Row: {
          accepted_at: string | null
          created_at: string
          invited_at: string | null
          invited_by: string | null
          organization_id: string
          role: Database["public"]["Enums"]["organization_role"]
          status: string
          user_id: string
        }
        Insert: {
          accepted_at?: string | null
          created_at?: string
          invited_at?: string | null
          invited_by?: string | null
          organization_id: string
          role: Database["public"]["Enums"]["organization_role"]
          status?: string
          user_id: string
        }
        Update: {
          accepted_at?: string | null
          created_at?: string
          invited_at?: string | null
          invited_by?: string | null
          organization_id?: string
          role?: Database["public"]["Enums"]["organization_role"]
          status?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "organization_members_invited_by_fkey"
            columns: ["invited_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "organization_members_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "organization_members_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      organizations: {
        Row: {
          billing_email: string | null
          created_at: string
          created_by: string
          display_name: string
          gstin: string | null
          id: string
          industry: string | null
          legal_name: string
          pan: string | null
          phone: string | null
          slug: string | null
          status: string
          updated_at: string
          website: string | null
          zoho_contact_id: string | null
          zoho_contact_synced_at: string | null
        }
        Insert: {
          billing_email?: string | null
          created_at?: string
          created_by: string
          display_name: string
          gstin?: string | null
          id?: string
          industry?: string | null
          legal_name: string
          pan?: string | null
          phone?: string | null
          slug?: string | null
          status?: string
          updated_at?: string
          website?: string | null
          zoho_contact_id?: string | null
          zoho_contact_synced_at?: string | null
        }
        Update: {
          billing_email?: string | null
          created_at?: string
          created_by?: string
          display_name?: string
          gstin?: string | null
          id?: string
          industry?: string | null
          legal_name?: string
          pan?: string | null
          phone?: string | null
          slug?: string | null
          status?: string
          updated_at?: string
          website?: string | null
          zoho_contact_id?: string | null
          zoho_contact_synced_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "organizations_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
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
          last_verified_at: string | null
          order_id: string
          paid_at: string | null
          payment_number: string
          provider: string
          provider_merchant_txn_id: string
          provider_payment_id: string | null
          purpose: string
          raw_verified_snapshot: Json | null
          refunded_at: string | null
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
          last_verified_at?: string | null
          order_id: string
          paid_at?: string | null
          payment_number: string
          provider?: string
          provider_merchant_txn_id: string
          provider_payment_id?: string | null
          purpose: string
          raw_verified_snapshot?: Json | null
          refunded_at?: string | null
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
          last_verified_at?: string | null
          order_id?: string
          paid_at?: string | null
          payment_number?: string
          provider?: string
          provider_merchant_txn_id?: string
          provider_payment_id?: string | null
          purpose?: string
          raw_verified_snapshot?: Json | null
          refunded_at?: string | null
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
          event_fingerprint: string
          event_source: string
          event_type: string
          id: string
          payload: Json
          payment_attempt_id: string | null
          processed: boolean
          processed_at: string | null
          processing_error: string | null
          provider: string
          provider_event_id: string | null
          received_at: string
        }
        Insert: {
          authentic?: boolean
          event_fingerprint: string
          event_source: string
          event_type: string
          id?: string
          payload: Json
          payment_attempt_id?: string | null
          processed?: boolean
          processed_at?: string | null
          processing_error?: string | null
          provider: string
          provider_event_id?: string | null
          received_at?: string
        }
        Update: {
          authentic?: boolean
          event_fingerprint?: string
          event_source?: string
          event_type?: string
          id?: string
          payload?: Json
          payment_attempt_id?: string | null
          processed?: boolean
          processed_at?: string | null
          processing_error?: string | null
          provider?: string
          provider_event_id?: string | null
          received_at?: string
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
      profiles: {
        Row: {
          avatar_r2_key: string | null
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
          avatar_r2_key?: string | null
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
          avatar_r2_key?: string | null
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
      shipment_events: {
        Row: {
          created_at: string
          created_by: string | null
          customer_message: string | null
          id: string
          internal_note: string | null
          location: string | null
          occurred_at: string
          shipment_id: string
          source: string
          status: string
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          customer_message?: string | null
          id?: string
          internal_note?: string | null
          location?: string | null
          occurred_at: string
          shipment_id: string
          source?: string
          status: string
        }
        Update: {
          created_at?: string
          created_by?: string | null
          customer_message?: string | null
          id?: string
          internal_note?: string | null
          location?: string | null
          occurred_at?: string
          shipment_id?: string
          source?: string
          status?: string
        }
        Relationships: [
          {
            foreignKeyName: "shipment_events_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "shipment_events_shipment_id_fkey"
            columns: ["shipment_id"]
            isOneToOne: false
            referencedRelation: "shipments"
            referencedColumns: ["id"]
          },
        ]
      }
      shipments: {
        Row: {
          carrier: string | null
          created_at: string
          created_by: string | null
          customer_visible_note: string | null
          delivered_at: string | null
          dispatched_at: string | null
          estimated_delivery_at: string | null
          id: string
          order_id: string
          package_count: number | null
          shipment_number: string
          status: string
          tracking_number: string | null
          tracking_url: string | null
          updated_at: string
        }
        Insert: {
          carrier?: string | null
          created_at?: string
          created_by?: string | null
          customer_visible_note?: string | null
          delivered_at?: string | null
          dispatched_at?: string | null
          estimated_delivery_at?: string | null
          id?: string
          order_id: string
          package_count?: number | null
          shipment_number: string
          status?: string
          tracking_number?: string | null
          tracking_url?: string | null
          updated_at?: string
        }
        Update: {
          carrier?: string | null
          created_at?: string
          created_by?: string | null
          customer_visible_note?: string | null
          delivered_at?: string | null
          dispatched_at?: string | null
          estimated_delivery_at?: string | null
          id?: string
          order_id?: string
          package_count?: number | null
          shipment_number?: string
          status?: string
          tracking_number?: string | null
          tracking_url?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "shipments_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "shipments_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "orders"
            referencedColumns: ["id"]
          },
        ]
      }
      staff_members: {
        Row: {
          activated_at: string | null
          active: boolean
          created_at: string
          deactivated_at: string | null
          invited_at: string | null
          invited_by: string | null
          last_staff_login_at: string | null
          role: Database["public"]["Enums"]["staff_role"]
          team: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          activated_at?: string | null
          active?: boolean
          created_at?: string
          deactivated_at?: string | null
          invited_at?: string | null
          invited_by?: string | null
          last_staff_login_at?: string | null
          role: Database["public"]["Enums"]["staff_role"]
          team?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          activated_at?: string | null
          active?: boolean
          created_at?: string
          deactivated_at?: string | null
          invited_at?: string | null
          invited_by?: string | null
          last_staff_login_at?: string | null
          role?: Database["public"]["Enums"]["staff_role"]
          team?: string | null
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
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      activate_invited_staff: { Args: never; Returns: undefined }
      allocate_order_number: {
        Args: { p_order_type: Database["public"]["Enums"]["order_type"] }
        Returns: string
      }
      archive_cloud_design: {
        Args: { p_design_project_id: string; p_expected_revision: number }
        Returns: {
          archived: boolean
          archived_at: string
          conflict: boolean
          draft_revision: number
        }[]
      }
      assign_invoice_number: { Args: { p_invoice_id: string }; Returns: string }
      claim_integration_jobs: {
        Args: {
          p_batch_size?: number
          p_lock_timeout?: string
          p_worker_id: string
        }
        Returns: {
          aggregate_id: string
          aggregate_type: string
          attempt_count: number
          available_at: string
          completed_at: string | null
          created_at: string
          dedupe_key: string
          id: string
          job_type: string
          last_error: string | null
          locked_at: string | null
          locked_by: string | null
          max_attempts: number
          payload: Json
          priority: number
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
          p_company_name: string
          p_department: string
          p_first_name: string
          p_gstin: string
          p_industry: string
          p_job_title: string
          p_last_name: string
          p_phone: string
          p_privacy_version: string
          p_terms_version: string
          p_website: string
        }
        Returns: string
      }
      complete_integration_job: {
        Args: { p_job_id: string; p_worker_id: string }
        Returns: {
          aggregate_id: string
          aggregate_type: string
          attempt_count: number
          available_at: string
          completed_at: string | null
          created_at: string
          dedupe_key: string
          id: string
          job_type: string
          last_error: string | null
          locked_at: string | null
          locked_by: string | null
          max_attempts: number
          payload: Json
          priority: number
          status: string
          updated_at: string
        }
        SetofOptions: {
          from: "*"
          to: "integration_jobs"
          isOneToOne: true
          isSetofReturn: false
        }
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
          remaining: number
          retry_after_seconds: number
        }[]
      }
      create_cloud_design: {
        Args: {
          p_client_import_id?: string
          p_configuration_snapshot: Json
          p_organization_id: string
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
          created: boolean
          design_version_id: string
          draft_revision: number
          last_saved_at: string
          version_number: number
        }[]
      }
      create_design_estimate_from_server: {
        Args: {
          p_balance_due_paise: number
          p_client_operation_id: string
          p_created_by: string
          p_design_project_id: string
          p_discount_paise: number
          p_expected_revision: number
          p_gst_paise: number
          p_gst_rate_basis_points: number
          p_organization_id: string
          p_pricing_engine_version: string
          p_pricing_snapshot: Json
          p_reservation_fee_paise: number
          p_shipping_paise: number
          p_subtotal_paise: number
          p_taxable_subtotal_paise: number
          p_total_paise: number
          p_valid_until: string
        }
        Returns: {
          created: boolean
          design_revision: number
          design_version_id: string
          estimate_id: string
          estimate_number: string
          status: string
          valid_until: string
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
          p_safe_filename: string
          p_sha256: string
          p_visibility: Database["public"]["Enums"]["file_visibility"]
        }
        Returns: {
          file_id: string
          object_key: string
        }[]
      }
      current_staff_role: {
        Args: never
        Returns: Database["public"]["Enums"]["staff_role"]
      }
      customer_shipment_events: {
        Args: { p_order_id: string }
        Returns: {
          customer_message: string
          id: string
          location: string
          occurred_at: string
          shipment_id: string
          status: string
        }[]
      }
      deactivate_staff_member: {
        Args: { p_user_id: string }
        Returns: undefined
      }
      defer_integration_job: {
        Args: {
          p_available_at: string
          p_job_id: string
          p_reason: string
          p_worker_id: string
        }
        Returns: {
          aggregate_id: string
          aggregate_type: string
          attempt_count: number
          available_at: string
          completed_at: string | null
          created_at: string
          dedupe_key: string
          id: string
          job_type: string
          last_error: string | null
          locked_at: string | null
          locked_by: string | null
          max_attempts: number
          payload: Json
          priority: number
          status: string
          updated_at: string
        }
        SetofOptions: {
          from: "*"
          to: "integration_jobs"
          isOneToOne: true
          isSetofReturn: false
        }
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
      expire_private_upload_slots: { Args: never; Returns: number }
      external_respond_order_approval: {
        Args: {
          p_decision: string
          p_ip_hash?: string
          p_response_note?: string
          p_secure_token_hash: string
          p_user_agent_summary?: string
        }
        Returns: Json
      }
      fail_integration_job: {
        Args: {
          p_error: string
          p_job_id: string
          p_retryable: boolean
          p_worker_id: string
        }
        Returns: {
          aggregate_id: string
          aggregate_type: string
          attempt_count: number
          available_at: string
          completed_at: string | null
          created_at: string
          dedupe_key: string
          id: string
          job_type: string
          last_error: string | null
          locked_at: string | null
          locked_by: string | null
          max_attempts: number
          payload: Json
          priority: number
          status: string
          updated_at: string
        }
        SetofOptions: {
          from: "*"
          to: "integration_jobs"
          isOneToOne: true
          isSetofReturn: false
        }
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
        Returns: {
          already_finalized: boolean
          invoice_id: string
          invoice_job_id: string
          order_id: string
          order_number: string
          payment_attempt_id: string
        }[]
      }
      has_organization_role: {
        Args: {
          p_allowed_roles: Database["public"]["Enums"]["organization_role"][]
          p_organization_id: string
        }
        Returns: boolean
      }
      is_active_staff: { Args: never; Returns: boolean }
      is_design_organization_member: {
        Args: { p_design_project_id: string }
        Returns: boolean
      }
      is_order_organization_member: {
        Args: { p_order_id: string }
        Returns: boolean
      }
      is_organization_member: {
        Args: { p_organization_id: string }
        Returns: boolean
      }
      link_order_to_estimate: {
        Args: {
          p_customer_user_id: string
          p_estimate_id: string
          p_order_id: string
        }
        Returns: boolean
      }
      mark_all_notifications_read: { Args: never; Returns: number }
      mark_notification_read: {
        Args: { p_notification_id: string }
        Returns: boolean
      }
      order_public_status_for_internal: {
        Args: { p_status: Database["public"]["Enums"]["order_status"] }
        Returns: Database["public"]["Enums"]["public_order_status"]
      }
      provision_staff_invitation: {
        Args: {
          p_first_name: string
          p_last_name: string
          p_role: Database["public"]["Enums"]["staff_role"]
          p_team: string
          p_user_id: string
        }
        Returns: undefined
      }
      record_payu_payment_state: {
        Args: {
          p_failure_code?: string
          p_failure_message?: string
          p_payment_attempt_id: string
          p_provider_payment_id?: string
          p_state: string
          p_verified_snapshot?: Json
        }
        Returns: undefined
      }
      record_staff_login: { Args: never; Returns: undefined }
      respond_order_approval: {
        Args: {
          p_approval_id: string
          p_decision: string
          p_response_note?: string
        }
        Returns: Json
      }
      retry_invoice_integration_job: {
        Args: { p_invoice_id: string }
        Returns: string
      }
      retry_order_payment: {
        Args: {
          p_customer_user_id: string
          p_idempotency_key: string
          p_order_id: string
          p_request_hash: string
        }
        Returns: {
          attempt_number: number
          created_new: boolean
          order_id: string
          order_number: string
          payment_attempt_id: string
          payment_status: Database["public"]["Enums"]["payment_status"]
        }[]
      }
      review_file_scan: {
        Args: {
          p_file_id: string
          p_review_note: string
          p_scan_status: Database["public"]["Enums"]["file_scan_status"]
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
          saved: boolean
          status: string
          title: string
        }[]
      }
      soft_delete_file: { Args: { p_file_id: string }; Returns: boolean }
      staff_add_order_comment: {
        Args: {
          p_action_required?: boolean
          p_action_type?: string
          p_body: string
          p_order_id: string
          p_visibility: string
        }
        Returns: string
      }
      staff_approval_queue: {
        Args: { p_limit?: number }
        Returns: {
          created_at: string
          expires_at: string
          id: string
          order_number: string
          organization_name: string
          requested_from_email: string
          responded_at: string
          status: string
        }[]
      }
      staff_assign_order: {
        Args: {
          p_assigned_staff_user_id?: string
          p_assigned_team?: string
          p_order_id: string
          p_reason?: string
        }
        Returns: Json
      }
      staff_change_order_file_visibility: {
        Args: {
          p_file_id: string
          p_reason: string
          p_visibility: Database["public"]["Enums"]["file_visibility"]
        }
        Returns: boolean
      }
      staff_create_approval_request: {
        Args: {
          p_approval_pdf_file_id: string
          p_design_version_id: string
          p_expires_at?: string
          p_order_id: string
          p_requested_from_email?: string
          p_requested_from_user_id?: string
          p_secure_token_hash?: string
        }
        Returns: string
      }
      staff_create_shipment: {
        Args: {
          p_carrier: string
          p_customer_visible_note?: string
          p_estimated_delivery_at: string
          p_order_id: string
          p_package_count: number
          p_tracking_number: string
          p_tracking_url: string
        }
        Returns: string
      }
      staff_dashboard_metrics: { Args: never; Returns: Json }
      staff_has_permission: {
        Args: { p_permission_name: string }
        Returns: boolean
      }
      staff_list_assignable_members: {
        Args: never
        Returns: {
          display_name: string
          role: Database["public"]["Enums"]["staff_role"]
          team: string
          user_id: string
        }[]
      }
      staff_order_approvals: {
        Args: { p_order_id: string }
        Returns: {
          approval_pdf_file_id: string
          created_at: string
          design_version_id: string
          expires_at: string
          id: string
          requested_from_email: string
          requested_from_user_id: string
          responded_at: string
          response_note: string
          revoked_at: string
          snapshot_sha256: string
          status: string
          viewed_at: string
        }[]
      }
      staff_resolve_order_action: {
        Args: { p_comment_id: string; p_resolution_note?: string }
        Returns: boolean
      }
      staff_revoke_approval: {
        Args: { p_approval_id: string; p_reason: string }
        Returns: boolean
      }
      staff_safe_payment_summary: {
        Args: { p_order_id: string }
        Returns: {
          amount_paise: number
          attempt_count: number
          paid_at: string
          status: Database["public"]["Enums"]["payment_status"]
        }[]
      }
      staff_search_orders: {
        Args: {
          p_assignee?: string
          p_at_risk?: boolean
          p_date_from?: string
          p_date_to?: string
          p_invoice_state?: string
          p_limit?: number
          p_missing?: string
          p_my_orders?: boolean
          p_offset?: number
          p_order_type?: Database["public"]["Enums"]["order_type"]
          p_overdue?: boolean
          p_payment_state?: string
          p_priority?: string
          p_public_status?: Database["public"]["Enums"]["public_order_status"]
          p_query?: string
          p_shipment_state?: string
          p_status?: Database["public"]["Enums"]["order_status"]
          p_team?: string
        }
        Returns: {
          assigned_staff_user_id: string
          assigned_team: string
          assignee_name: string
          customer_email: string
          customer_name: string
          estimated_dispatch_at: string
          expected_approval_at: string
          expected_production_at: string
          expected_qc_at: string
          internal_priority: string
          invoice_status: Database["public"]["Enums"]["invoice_sync_status"]
          open_action_count: number
          order_id: string
          order_number: string
          order_type: Database["public"]["Enums"]["order_type"]
          organization_id: string
          organization_name: string
          payment_status: Database["public"]["Enums"]["payment_status"]
          po_number: string
          public_status: Database["public"]["Enums"]["public_order_status"]
          quantity_total: number
          requested_delivery_date: string
          shipment_status: string
          status: Database["public"]["Enums"]["order_status"]
          submitted_at: string
          total_count: number
          updated_at: string
        }[]
      }
      staff_set_order_dates: {
        Args: {
          p_estimated_dispatch_at?: string
          p_expected_approval_at?: string
          p_expected_production_at?: string
          p_expected_qc_at?: string
          p_order_id: string
        }
        Returns: Json
      }
      staff_set_order_priority: {
        Args: { p_order_id: string; p_priority: string; p_reason?: string }
        Returns: Json
      }
      staff_transition_order: {
        Args: {
          p_customer_message?: string
          p_internal_note?: string
          p_order_id: string
          p_reason?: string
          p_to_status: Database["public"]["Enums"]["order_status"]
        }
        Returns: Json
      }
      staff_update_shipment: {
        Args: {
          p_carrier: string
          p_customer_visible_note: string
          p_estimated_delivery_at: string
          p_event_location?: string
          p_internal_note?: string
          p_package_count: number
          p_shipment_id: string
          p_status: string
          p_tracking_number: string
          p_tracking_url: string
        }
        Returns: Json
      }
      submit_custom_order: {
        Args: {
          p_billing_snapshot: Json
          p_company_snapshot: Json
          p_configuration_schema_version: number
          p_customer_reference?: string
          p_customer_snapshot: Json
          p_customer_user_id: string
          p_design_project_id: string
          p_design_version_id: string
          p_expires_at?: string
          p_file_ids?: string[]
          p_idempotency_key: string
          p_items: Json
          p_organization_id: string
          p_po_number?: string
          p_pricing_version: string
          p_request_hash: string
          p_requested_delivery_date?: string
          p_reservation_amount_paise: number
          p_shipping_paise: number
          p_shipping_snapshot: Json
          p_subtotal_paise: number
          p_tax_estimate_paise: number
          p_terms_snapshot: Json
        }
        Returns: {
          order_id: string
          order_number: string
          payment_attempt_id: string
          submitted_at: string
        }[]
      }
      submit_order: {
        Args: {
          p_billing_snapshot: Json
          p_company_snapshot: Json
          p_configuration_schema_version: number
          p_customer_reference?: string
          p_customer_snapshot: Json
          p_customer_user_id: string
          p_design_project_id?: string
          p_design_version_id?: string
          p_expires_at?: string
          p_idempotency_key: string
          p_items: Json
          p_order_type: Database["public"]["Enums"]["order_type"]
          p_organization_id: string
          p_po_number?: string
          p_pricing_version: string
          p_request_hash: string
          p_requested_delivery_date?: string
          p_reservation_amount_paise: number
          p_shipping_paise: number
          p_shipping_snapshot: Json
          p_subtotal_paise: number
          p_tax_estimate_paise: number
          p_terms_snapshot: Json
        }
        Returns: {
          order_id: string
          order_number: string
          payment_attempt_id: string
          submitted_at: string
        }[]
      }
      submit_reorder_order: {
        Args: {
          p_billing_snapshot: Json
          p_company_snapshot: Json
          p_configuration_schema_version: number
          p_customer_reference?: string
          p_customer_snapshot: Json
          p_customer_user_id: string
          p_design_project_id: string
          p_design_version_id: string
          p_expires_at?: string
          p_idempotency_key: string
          p_items: Json
          p_organization_id: string
          p_po_number?: string
          p_pricing_version: string
          p_request_hash: string
          p_requested_delivery_date?: string
          p_reservation_amount_paise: number
          p_shipping_paise: number
          p_shipping_snapshot: Json
          p_source_order_id: string
          p_subtotal_paise: number
          p_tax_estimate_paise: number
          p_terms_snapshot: Json
        }
        Returns: {
          order_id: string
          order_number: string
          payment_attempt_id: string
          submitted_at: string
        }[]
      }
      user_can_access_design: {
        Args: { p_design_project_id: string }
        Returns: boolean
      }
      user_can_access_order: { Args: { p_order_id: string }; Returns: boolean }
      user_can_access_order_item: {
        Args: { p_order_item_id: string }
        Returns: boolean
      }
    }
    Enums: {
      file_kind:
        | "customer_artwork"
        | "purchase_order"
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
        | "clean"
        | "rejected"
        | "manual_review"
        | "not_required"
      file_upload_status: "pending" | "finalized" | "failed" | "expired"
      file_visibility: "customer" | "staff_only" | "public"
      invoice_kind:
        | "reservation_retainer"
        | "reservation_invoice"
        | "sample_tax_invoice"
        | "final_tax_invoice"
        | "credit_note"
      invoice_sync_status:
        | "not_required"
        | "queued"
        | "processing"
        | "completed"
        | "retryable_failure"
        | "permanent_failure"
        | "voided"
      order_status:
        | "awaiting_payment"
        | "payment_failed"
        | "reservation_paid"
        | "submitted_for_review"
        | "needs_customer_action"
        | "commercial_review"
        | "quote_ready"
        | "awaiting_quote_approval"
        | "awaiting_balance_payment"
        | "artwork_review"
        | "awaiting_artwork_approval"
        | "approved_for_production"
        | "production_queued"
        | "in_production"
        | "quality_control"
        | "packing"
        | "ready_to_dispatch"
        | "dispatched"
        | "delivered"
        | "on_hold"
        | "cancelled"
        | "refunded"
        | "expired"
      order_type: "custom_bulk" | "sample_purchase" | "reorder"
      organization_role: "owner" | "buyer" | "approver" | "finance" | "viewer"
      payment_status:
        | "created"
        | "initiated"
        | "pending"
        | "paid"
        | "failed"
        | "cancelled"
        | "refunded"
        | "partially_refunded"
        | "disputed"
      public_order_status:
        | "payment_incomplete"
        | "order_submitted"
        | "action_required"
        | "under_review"
        | "awaiting_approval"
        | "payment_due"
        | "approved"
        | "in_production"
        | "quality_check"
        | "ready_to_dispatch"
        | "dispatched"
        | "delivered"
        | "on_hold"
        | "cancelled"
      staff_role:
        | "super_admin"
        | "operations_admin"
        | "sales"
        | "production"
        | "artwork"
        | "finance"
        | "qc"
        | "dispatch"
        | "support"
        | "read_only"
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
      file_kind: [
        "customer_artwork",
        "purchase_order",
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
        "clean",
        "rejected",
        "manual_review",
        "not_required",
      ],
      file_upload_status: ["pending", "finalized", "failed", "expired"],
      file_visibility: ["customer", "staff_only", "public"],
      invoice_kind: [
        "reservation_retainer",
        "reservation_invoice",
        "sample_tax_invoice",
        "final_tax_invoice",
        "credit_note",
      ],
      invoice_sync_status: [
        "not_required",
        "queued",
        "processing",
        "completed",
        "retryable_failure",
        "permanent_failure",
        "voided",
      ],
      order_status: [
        "awaiting_payment",
        "payment_failed",
        "reservation_paid",
        "submitted_for_review",
        "needs_customer_action",
        "commercial_review",
        "quote_ready",
        "awaiting_quote_approval",
        "awaiting_balance_payment",
        "artwork_review",
        "awaiting_artwork_approval",
        "approved_for_production",
        "production_queued",
        "in_production",
        "quality_control",
        "packing",
        "ready_to_dispatch",
        "dispatched",
        "delivered",
        "on_hold",
        "cancelled",
        "refunded",
        "expired",
      ],
      order_type: ["custom_bulk", "sample_purchase", "reorder"],
      organization_role: ["owner", "buyer", "approver", "finance", "viewer"],
      payment_status: [
        "created",
        "initiated",
        "pending",
        "paid",
        "failed",
        "cancelled",
        "refunded",
        "partially_refunded",
        "disputed",
      ],
      public_order_status: [
        "payment_incomplete",
        "order_submitted",
        "action_required",
        "under_review",
        "awaiting_approval",
        "payment_due",
        "approved",
        "in_production",
        "quality_check",
        "ready_to_dispatch",
        "dispatched",
        "delivered",
        "on_hold",
        "cancelled",
      ],
      staff_role: [
        "super_admin",
        "operations_admin",
        "sales",
        "production",
        "artwork",
        "finance",
        "qc",
        "dispatch",
        "support",
        "read_only",
      ],
    },
  },
} as const
