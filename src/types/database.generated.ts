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
          secure_token_hash: string | null
          status: string
          user_agent_summary: string | null
          viewed_at: string | null
        }
        Insert: {
          approval_pdf_file_id?: string | null
          created_at?: string
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
          secure_token_hash?: string | null
          status: string
          user_agent_summary?: string | null
          viewed_at?: string | null
        }
        Update: {
          approval_pdf_file_id?: string | null
          created_at?: string
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
          secure_token_hash?: string | null
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
          created_at: string
          created_by: string
          current_version: number
          id: string
          last_saved_at: string
          organization_id: string
          schema_version: number
          source: string
          status: string
          submitted_at: string | null
          title: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          created_by: string
          current_version?: number
          id?: string
          last_saved_at?: string
          organization_id: string
          schema_version: number
          source?: string
          status?: string
          submitted_at?: string | null
          title: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          created_by?: string
          current_version?: number
          id?: string
          last_saved_at?: string
          organization_id?: string
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
          estimated_dispatch_at: string | null
          estimated_total_paise: number
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
          estimated_dispatch_at?: string | null
          estimated_total_paise?: number
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
          estimated_dispatch_at?: string | null
          estimated_total_paise?: number
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
            foreignKeyName: "orders_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
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
          must_use_mfa: boolean
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
          must_use_mfa?: boolean
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
          must_use_mfa?: boolean
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
      deactivate_staff_member: {
        Args: { p_user_id: string }
        Returns: undefined
      }
      expire_private_upload_slots: { Args: never; Returns: number }
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
      record_staff_login: { Args: never; Returns: undefined }
      review_file_scan: {
        Args: {
          p_file_id: string
          p_review_note: string
          p_scan_status: Database["public"]["Enums"]["file_scan_status"]
        }
        Returns: boolean
      }
      soft_delete_file: { Args: { p_file_id: string }; Returns: boolean }
      staff_has_permission: {
        Args: { p_permission_name: string }
        Returns: boolean
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
