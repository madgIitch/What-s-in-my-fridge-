export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  graphql_public: {
    Tables: {
      [_ in never]: never
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      graphql: {
        Args: {
          extensions?: Json
          operationName?: string
          query?: string
          variables?: Json
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
  public: {
    Tables: {
      billing_anomalies: {
        Row: {
          code: string
          created_at: string
          detail: Json
          id: number
          stripe_customer_id: string | null
          user_id: string | null
        }
        Insert: {
          code: string
          created_at?: string
          detail?: Json
          id?: never
          stripe_customer_id?: string | null
          user_id?: string | null
        }
        Update: {
          code?: string
          created_at?: string
          detail?: Json
          id?: never
          stripe_customer_id?: string | null
          user_id?: string | null
        }
        Relationships: []
      }
      billing_override_audit: {
        Row: {
          actor: string
          after_state: Json
          before_state: Json
          created_at: string
          id: number
          reason: string
          user_id: string
        }
        Insert: {
          actor: string
          after_state: Json
          before_state: Json
          created_at?: string
          id?: never
          reason: string
          user_id: string
        }
        Update: {
          actor?: string
          after_state?: Json
          before_state?: Json
          created_at?: string
          id?: never
          reason?: string
          user_id?: string
        }
        Relationships: []
      }
      billing_overrides: {
        Row: {
          actor: string
          reason: string
          updated_at: string
          user_id: string
          value: boolean | null
        }
        Insert: {
          actor?: string
          reason: string
          updated_at?: string
          user_id: string
          value?: boolean | null
        }
        Update: {
          actor?: string
          reason?: string
          updated_at?: string
          user_id?: string
          value?: boolean | null
        }
        Relationships: []
      }
      catalog_manifests: {
        Row: {
          captured_at: string
          completeness: string
          fetched_at: string | null
          id: string
          imported_at: string
          product_count: number
          retailer: string
          schema_version: number
          sha256: string
          source: string
        }
        Insert: {
          captured_at: string
          completeness: string
          fetched_at?: string | null
          id?: string
          imported_at?: string
          product_count: number
          retailer: string
          schema_version: number
          sha256: string
          source: string
        }
        Update: {
          captured_at?: string
          completeness?: string
          fetched_at?: string | null
          id?: string
          imported_at?: string
          product_count?: number
          retailer?: string
          schema_version?: number
          sha256?: string
          source?: string
        }
        Relationships: []
      }
      catalog_versions: {
        Row: {
          active: boolean
          checksum: string
          id: string
          imported_at: string
          ingredient_count: number
          matcher_version: string
          recipe_count: number
          source_version: string
        }
        Insert: {
          active?: boolean
          checksum: string
          id?: string
          imported_at?: string
          ingredient_count: number
          matcher_version?: string
          recipe_count: number
          source_version: string
        }
        Update: {
          active?: boolean
          checksum?: string
          id?: string
          imported_at?: string
          ingredient_count?: number
          matcher_version?: string
          recipe_count?: number
          source_version?: string
        }
        Relationships: []
      }
      client_mutations: {
        Row: {
          client_mutation_id: string
          code: string
          created_at: string
          expected_version: number | null
          id: string
          item_id: string
          operation: string
          payload: Json
          result_item: Json | null
          status: string
          updated_at: string
          user_id: string
        }
        Insert: {
          client_mutation_id: string
          code: string
          created_at?: string
          expected_version?: number | null
          id?: string
          item_id: string
          operation: string
          payload?: Json
          result_item?: Json | null
          status: string
          updated_at?: string
          user_id: string
        }
        Update: {
          client_mutation_id?: string
          code?: string
          created_at?: string
          expected_version?: number | null
          id?: string
          item_id?: string
          operation?: string
          payload?: Json
          result_item?: Json | null
          status?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      commercial_products: {
        Row: {
          barcode: string | null
          catalog_manifest_id: string | null
          created_at: string
          display_name: string
          fetched_at: string | null
          food_concept_id: string | null
          id: string
          provenance: Json
          retailer: string
          retailer_product_id: string | null
          source: string
          updated_at: string
        }
        Insert: {
          barcode?: string | null
          catalog_manifest_id?: string | null
          created_at?: string
          display_name: string
          fetched_at?: string | null
          food_concept_id?: string | null
          id?: string
          provenance?: Json
          retailer: string
          retailer_product_id?: string | null
          source: string
          updated_at?: string
        }
        Update: {
          barcode?: string | null
          catalog_manifest_id?: string | null
          created_at?: string
          display_name?: string
          fetched_at?: string | null
          food_concept_id?: string | null
          id?: string
          provenance?: Json
          retailer?: string
          retailer_product_id?: string | null
          source?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "commercial_products_catalog_manifest_id_fkey"
            columns: ["catalog_manifest_id"]
            isOneToOne: false
            referencedRelation: "catalog_manifests"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "commercial_products_food_concept_id_fkey"
            columns: ["food_concept_id"]
            isOneToOne: false
            referencedRelation: "food_concepts"
            referencedColumns: ["id"]
          },
        ]
      }
      cooking_mutations: {
        Row: {
          client_mutation_id: string
          code: string
          conflicts: Json
          created_at: string
          id: string
          payload: Json
          result: Json | null
          status: string
          user_id: string
        }
        Insert: {
          client_mutation_id: string
          code: string
          conflicts?: Json
          created_at?: string
          id?: string
          payload: Json
          result?: Json | null
          status: string
          user_id: string
        }
        Update: {
          client_mutation_id?: string
          code?: string
          conflicts?: Json
          created_at?: string
          id?: string
          payload?: Json
          result?: Json | null
          status?: string
          user_id?: string
        }
        Relationships: []
      }
      favorite_mutations: {
        Row: {
          client_mutation_id: string
          code: string
          conflicts: Json
          created_at: string
          id: string
          payload: Json
          recipe_id: string
          result: Json | null
          status: string
          user_id: string
        }
        Insert: {
          client_mutation_id: string
          code: string
          conflicts?: Json
          created_at?: string
          id?: string
          payload: Json
          recipe_id: string
          result?: Json | null
          status: string
          user_id: string
        }
        Update: {
          client_mutation_id?: string
          code?: string
          conflicts?: Json
          created_at?: string
          id?: string
          payload?: Json
          recipe_id?: string
          result?: Json | null
          status?: string
          user_id?: string
        }
        Relationships: []
      }
      favorite_recipes: {
        Row: {
          created_at: string
          deleted_at: string | null
          id: string
          ingredients_with_measures: Json
          instructions: string
          legacy_id: string | null
          match_percentage: number
          matched_ingredients: Json
          missing_ingredients: Json
          name: string
          recipe_id: string
          saved_at: string
          snapshot: Json
          snapshot_version: number
          source: string
          updated_at: string
          user_id: string
          version: number
        }
        Insert: {
          created_at?: string
          deleted_at?: string | null
          id?: string
          ingredients_with_measures?: Json
          instructions: string
          legacy_id?: string | null
          match_percentage: number
          matched_ingredients?: Json
          missing_ingredients?: Json
          name: string
          recipe_id: string
          saved_at: string
          snapshot: Json
          snapshot_version?: number
          source?: string
          updated_at?: string
          user_id: string
          version?: number
        }
        Update: {
          created_at?: string
          deleted_at?: string | null
          id?: string
          ingredients_with_measures?: Json
          instructions?: string
          legacy_id?: string | null
          match_percentage?: number
          matched_ingredients?: Json
          missing_ingredients?: Json
          name?: string
          recipe_id?: string
          saved_at?: string
          snapshot?: Json
          snapshot_version?: number
          source?: string
          updated_at?: string
          user_id?: string
          version?: number
        }
        Relationships: []
      }
      food_concept_aliases: {
        Row: {
          created_at: string
          food_concept_id: string
          id: string
          normalized_alias: string
          source: string
        }
        Insert: {
          created_at?: string
          food_concept_id: string
          id?: string
          normalized_alias: string
          source: string
        }
        Update: {
          created_at?: string
          food_concept_id?: string
          id?: string
          normalized_alias?: string
          source?: string
        }
        Relationships: [
          {
            foreignKeyName: "food_concept_aliases_food_concept_id_fkey"
            columns: ["food_concept_id"]
            isOneToOne: false
            referencedRelation: "food_concepts"
            referencedColumns: ["id"]
          },
        ]
      }
      food_concepts: {
        Row: {
          category: string | null
          created_at: string
          display_name: string
          id: string
          shelf_life_days: number | null
          slug: string
          suggested_location: string | null
          updated_at: string
        }
        Insert: {
          category?: string | null
          created_at?: string
          display_name: string
          id?: string
          shelf_life_days?: number | null
          slug: string
          suggested_location?: string | null
          updated_at?: string
        }
        Update: {
          category?: string | null
          created_at?: string
          display_name?: string
          id?: string
          shelf_life_days?: number | null
          slug?: string
          suggested_location?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      ingredient_aliases: {
        Row: {
          alias: string
          catalog_version_id: string
          id: string
          ingredient_id: string
          normalized_alias: string
        }
        Insert: {
          alias: string
          catalog_version_id: string
          id?: string
          ingredient_id: string
          normalized_alias: string
        }
        Update: {
          alias?: string
          catalog_version_id?: string
          id?: string
          ingredient_id?: string
          normalized_alias?: string
        }
        Relationships: [
          {
            foreignKeyName: "ingredient_aliases_catalog_version_id_fkey"
            columns: ["catalog_version_id"]
            isOneToOne: false
            referencedRelation: "catalog_versions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ingredient_aliases_ingredient_id_fkey"
            columns: ["ingredient_id"]
            isOneToOne: false
            referencedRelation: "ingredients"
            referencedColumns: ["id"]
          },
        ]
      }
      ingredient_mappings: {
        Row: {
          canonical: boolean
          confidence: number
          created_at: string
          deleted_at: string | null
          id: string
          legacy_id: string | null
          method: string
          normalized_name: string
          scanned_name: string
          source: string
          updated_at: string
          user_id: string
          verified_by_user: boolean
          version: number
        }
        Insert: {
          canonical?: boolean
          confidence: number
          created_at?: string
          deleted_at?: string | null
          id?: string
          legacy_id?: string | null
          method: string
          normalized_name: string
          scanned_name: string
          source?: string
          updated_at?: string
          user_id: string
          verified_by_user?: boolean
          version?: number
        }
        Update: {
          canonical?: boolean
          confidence?: number
          created_at?: string
          deleted_at?: string | null
          id?: string
          legacy_id?: string | null
          method?: string
          normalized_name?: string
          scanned_name?: string
          source?: string
          updated_at?: string
          user_id?: string
          verified_by_user?: boolean
          version?: number
        }
        Relationships: []
      }
      ingredients: {
        Row: {
          catalog_version_id: string | null
          category: string
          category_spanish: string | null
          created_at: string
          id: string
          name: string
          normalized_name: string | null
          seed_version: string
          slug: string
          subcategory: string | null
          synonyms: Json
          updated_at: string
        }
        Insert: {
          catalog_version_id?: string | null
          category: string
          category_spanish?: string | null
          created_at?: string
          id?: string
          name: string
          normalized_name?: string | null
          seed_version: string
          slug: string
          subcategory?: string | null
          synonyms?: Json
          updated_at?: string
        }
        Update: {
          catalog_version_id?: string | null
          category?: string
          category_spanish?: string | null
          created_at?: string
          id?: string
          name?: string
          normalized_name?: string | null
          seed_version?: string
          slug?: string
          subcategory?: string | null
          synonyms?: Json
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "ingredients_catalog_version_id_fkey"
            columns: ["catalog_version_id"]
            isOneToOne: false
            referencedRelation: "catalog_versions"
            referencedColumns: ["id"]
          },
        ]
      }
      inventory_items: {
        Row: {
          acquired_on: string | null
          acquired_on_source: string | null
          added_at: string
          category: string | null
          commercial_product_id: string | null
          created_at: string
          deleted_at: string | null
          expiry_date: string | null
          expiry_date_exact: string | null
          food_concept_id: string | null
          freshness_estimated_days: number | null
          freshness_precision: string
          freshness_source: string | null
          id: string
          knowledge_provenance: string
          legacy_id: string | null
          location: string | null
          location_confirmed: boolean
          name: string
          normalization_source: string | null
          normalization_status: string
          normalized_name: string | null
          normalizer_version: string | null
          notes: string | null
          quantity: number
          quantity_exact: number | null
          quantity_precision: string
          quantity_unit: string | null
          raw_name: string | null
          raw_text: string | null
          receipt_draft_id: string | null
          receipt_line_id: string | null
          receipt_quantity_evidence: Json | null
          retailer: string | null
          source: string
          stock_mode: string
          stock_state: string | null
          unit: string
          updated_at: string
          user_id: string
          version: number
        }
        Insert: {
          acquired_on?: string | null
          acquired_on_source?: string | null
          added_at: string
          category?: string | null
          commercial_product_id?: string | null
          created_at?: string
          deleted_at?: string | null
          expiry_date?: string | null
          expiry_date_exact?: string | null
          food_concept_id?: string | null
          freshness_estimated_days?: number | null
          freshness_precision?: string
          freshness_source?: string | null
          id?: string
          knowledge_provenance?: string
          legacy_id?: string | null
          location?: string | null
          location_confirmed?: boolean
          name: string
          normalization_source?: string | null
          normalization_status?: string
          normalized_name?: string | null
          normalizer_version?: string | null
          notes?: string | null
          quantity: number
          quantity_exact?: number | null
          quantity_precision?: string
          quantity_unit?: string | null
          raw_name?: string | null
          raw_text?: string | null
          receipt_draft_id?: string | null
          receipt_line_id?: string | null
          receipt_quantity_evidence?: Json | null
          retailer?: string | null
          source?: string
          stock_mode?: string
          stock_state?: string | null
          unit: string
          updated_at?: string
          user_id: string
          version?: number
        }
        Update: {
          acquired_on?: string | null
          acquired_on_source?: string | null
          added_at?: string
          category?: string | null
          commercial_product_id?: string | null
          created_at?: string
          deleted_at?: string | null
          expiry_date?: string | null
          expiry_date_exact?: string | null
          food_concept_id?: string | null
          freshness_estimated_days?: number | null
          freshness_precision?: string
          freshness_source?: string | null
          id?: string
          knowledge_provenance?: string
          legacy_id?: string | null
          location?: string | null
          location_confirmed?: boolean
          name?: string
          normalization_source?: string | null
          normalization_status?: string
          normalized_name?: string | null
          normalizer_version?: string | null
          notes?: string | null
          quantity?: number
          quantity_exact?: number | null
          quantity_precision?: string
          quantity_unit?: string | null
          raw_name?: string | null
          raw_text?: string | null
          receipt_draft_id?: string | null
          receipt_line_id?: string | null
          receipt_quantity_evidence?: Json | null
          retailer?: string | null
          source?: string
          stock_mode?: string
          stock_state?: string | null
          unit?: string
          updated_at?: string
          user_id?: string
          version?: number
        }
        Relationships: [
          {
            foreignKeyName: "inventory_items_commercial_product_id_fkey"
            columns: ["commercial_product_id"]
            isOneToOne: false
            referencedRelation: "commercial_products"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "inventory_items_food_concept_id_fkey"
            columns: ["food_concept_id"]
            isOneToOne: false
            referencedRelation: "food_concepts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "inventory_items_receipt_draft_id_fkey"
            columns: ["receipt_draft_id"]
            isOneToOne: false
            referencedRelation: "receipt_drafts"
            referencedColumns: ["id"]
          },
        ]
      }
      legacy_id_map: {
        Row: {
          created_at: string
          entity_type: string
          id: string
          legacy_id: string
          source: string
          target_id: string
          user_id: string
        }
        Insert: {
          created_at?: string
          entity_type: string
          id?: string
          legacy_id: string
          source?: string
          target_id: string
          user_id: string
        }
        Update: {
          created_at?: string
          entity_type?: string
          id?: string
          legacy_id?: string
          source?: string
          target_id?: string
          user_id?: string
        }
        Relationships: []
      }
      legacy_migration_records: {
        Row: {
          canonical_data: Json
          collection: string
          created_at: string
          id: string
          legacy_id: string
          source: string
          source_updated_at: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          canonical_data?: Json
          collection: string
          created_at?: string
          id?: string
          legacy_id: string
          source?: string
          source_updated_at?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          canonical_data?: Json
          collection?: string
          created_at?: string
          id?: string
          legacy_id?: string
          source?: string
          source_updated_at?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      meal_entries: {
        Row: {
          calories_estimate: number | null
          consumed_at: string | null
          created_at: string
          custom_name: string | null
          deleted_at: string | null
          id: string
          ingredients_consumed: Json
          legacy_id: string | null
          meal_date: string
          meal_type: string
          notes: string | null
          recipe_id: string | null
          recipe_snapshot: Json | null
          source: string
          updated_at: string
          user_id: string
          version: number
        }
        Insert: {
          calories_estimate?: number | null
          consumed_at?: string | null
          created_at?: string
          custom_name?: string | null
          deleted_at?: string | null
          id?: string
          ingredients_consumed?: Json
          legacy_id?: string | null
          meal_date: string
          meal_type: string
          notes?: string | null
          recipe_id?: string | null
          recipe_snapshot?: Json | null
          source?: string
          updated_at?: string
          user_id: string
          version?: number
        }
        Update: {
          calories_estimate?: number | null
          consumed_at?: string | null
          created_at?: string
          custom_name?: string | null
          deleted_at?: string | null
          id?: string
          ingredients_consumed?: Json
          legacy_id?: string | null
          meal_date?: string
          meal_type?: string
          notes?: string | null
          recipe_id?: string | null
          recipe_snapshot?: Json | null
          source?: string
          updated_at?: string
          user_id?: string
          version?: number
        }
        Relationships: [
          {
            foreignKeyName: "meal_entries_recipe_id_fkey"
            columns: ["recipe_id"]
            isOneToOne: false
            referencedRelation: "recipes"
            referencedColumns: ["id"]
          },
        ]
      }
      meal_mutations: {
        Row: {
          client_mutation_id: string
          code: string
          conflicts: Json
          created_at: string
          id: number
          meal_entry_id: string
          request_hash: string
          result: Json | null
          status: string
          user_id: string
        }
        Insert: {
          client_mutation_id: string
          code: string
          conflicts?: Json
          created_at?: string
          id?: never
          meal_entry_id: string
          request_hash: string
          result?: Json | null
          status: string
          user_id: string
        }
        Update: {
          client_mutation_id?: string
          code?: string
          conflicts?: Json
          created_at?: string
          id?: never
          meal_entry_id?: string
          request_hash?: string
          result?: Json | null
          status?: string
          user_id?: string
        }
        Relationships: []
      }
      migration_runs: {
        Row: {
          created_by: string
          finished_at: string | null
          id: string
          source_commit: string
          started_at: string
          status: string
          summary: Json
        }
        Insert: {
          created_by: string
          finished_at?: string | null
          id?: string
          source_commit: string
          started_at?: string
          status?: string
          summary?: Json
        }
        Update: {
          created_by?: string
          finished_at?: string | null
          id?: string
          source_commit?: string
          started_at?: string
          status?: string
          summary?: Json
        }
        Relationships: []
      }
      ocr_monthly_usage: {
        Row: {
          consumed: number
          period_start: string
          reserved: number
          user_id: string
        }
        Insert: {
          consumed?: number
          period_start: string
          reserved?: number
          user_id: string
        }
        Update: {
          consumed?: number
          period_start?: string
          reserved?: number
          user_id?: string
        }
        Relationships: []
      }
      profiles: {
        Row: {
          created_at: string
          display_name: string | null
          locale: string
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          display_name?: string | null
          locale?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          display_name?: string | null
          locale?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      push_deliveries: {
        Row: {
          attempts: number
          completed_version: number
          created_at: string
          error_code: string | null
          event_key: string
          id: string
          job_id: string
          next_attempt_at: string
          sent_at: string | null
          status: string
          subscription_id: string
          updated_at: string
        }
        Insert: {
          attempts?: number
          completed_version: number
          created_at?: string
          error_code?: string | null
          event_key: string
          id?: string
          job_id: string
          next_attempt_at?: string
          sent_at?: string | null
          status?: string
          subscription_id: string
          updated_at?: string
        }
        Update: {
          attempts?: number
          completed_version?: number
          created_at?: string
          error_code?: string | null
          event_key?: string
          id?: string
          job_id?: string
          next_attempt_at?: string
          sent_at?: string | null
          status?: string
          subscription_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "push_deliveries_job_id_fkey"
            columns: ["job_id"]
            isOneToOne: false
            referencedRelation: "recipe_import_jobs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "push_deliveries_subscription_id_fkey"
            columns: ["subscription_id"]
            isOneToOne: false
            referencedRelation: "push_subscriptions"
            referencedColumns: ["id"]
          },
        ]
      }
      push_subscriptions: {
        Row: {
          auth: string
          created_at: string
          endpoint: string
          endpoint_hash: string
          expiration_time: string | null
          id: string
          p256dh: string
          revoked_at: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          auth: string
          created_at?: string
          endpoint: string
          endpoint_hash: string
          expiration_time?: string | null
          id?: string
          p256dh: string
          revoked_at?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          auth?: string
          created_at?: string
          endpoint?: string
          endpoint_hash?: string
          expiration_time?: string | null
          id?: string
          p256dh?: string
          revoked_at?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      receipt_drafts: {
        Row: {
          captured_at: string
          confirmation_payload_hash: string | null
          confirmed: boolean
          confirmed_at: string | null
          confirmed_item_ids: string[]
          created_at: string
          currency: string | null
          deleted_at: string | null
          edited_lines: Json
          error_code: string | null
          id: string
          image_hash: string | null
          image_path: string | null
          legacy_id: string | null
          lines: Json
          merchant: string | null
          normalization_review: Json
          normalizer_version: string | null
          ocr_locale: string | null
          ocr_request_id: string | null
          ocr_result: Json | null
          original_lines: Json
          parser_version: string | null
          purchase_date: string | null
          quota_consumed: boolean
          quota_period: string | null
          raw_text: string
          retailer: string | null
          review_decisions: Json
          source: string
          status: string
          total: number | null
          unrecognized_lines: Json
          updated_at: string
          user_id: string
          version: number
        }
        Insert: {
          captured_at?: string
          confirmation_payload_hash?: string | null
          confirmed?: boolean
          confirmed_at?: string | null
          confirmed_item_ids?: string[]
          created_at?: string
          currency?: string | null
          deleted_at?: string | null
          edited_lines?: Json
          error_code?: string | null
          id?: string
          image_hash?: string | null
          image_path?: string | null
          legacy_id?: string | null
          lines?: Json
          merchant?: string | null
          normalization_review?: Json
          normalizer_version?: string | null
          ocr_locale?: string | null
          ocr_request_id?: string | null
          ocr_result?: Json | null
          original_lines?: Json
          parser_version?: string | null
          purchase_date?: string | null
          quota_consumed?: boolean
          quota_period?: string | null
          raw_text?: string
          retailer?: string | null
          review_decisions?: Json
          source?: string
          status?: string
          total?: number | null
          unrecognized_lines?: Json
          updated_at?: string
          user_id: string
          version?: number
        }
        Update: {
          captured_at?: string
          confirmation_payload_hash?: string | null
          confirmed?: boolean
          confirmed_at?: string | null
          confirmed_item_ids?: string[]
          created_at?: string
          currency?: string | null
          deleted_at?: string | null
          edited_lines?: Json
          error_code?: string | null
          id?: string
          image_hash?: string | null
          image_path?: string | null
          legacy_id?: string | null
          lines?: Json
          merchant?: string | null
          normalization_review?: Json
          normalizer_version?: string | null
          ocr_locale?: string | null
          ocr_request_id?: string | null
          ocr_result?: Json | null
          original_lines?: Json
          parser_version?: string | null
          purchase_date?: string | null
          quota_consumed?: boolean
          quota_period?: string | null
          raw_text?: string
          retailer?: string | null
          review_decisions?: Json
          source?: string
          status?: string
          total?: number | null
          unrecognized_lines?: Json
          updated_at?: string
          user_id?: string
          version?: number
        }
        Relationships: []
      }
      receipt_line_mutations: {
        Row: {
          client_mutation_id: string
          created_at: string
          draft_id: string
          id: string
          line_id: string
          request_hash: string
          result: Json
          user_id: string
        }
        Insert: {
          client_mutation_id: string
          created_at?: string
          draft_id: string
          id?: string
          line_id: string
          request_hash: string
          result: Json
          user_id: string
        }
        Update: {
          client_mutation_id?: string
          created_at?: string
          draft_id?: string
          id?: string
          line_id?: string
          request_hash?: string
          result?: Json
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "receipt_line_mutations_draft_id_fkey"
            columns: ["draft_id"]
            isOneToOne: false
            referencedRelation: "receipt_drafts"
            referencedColumns: ["id"]
          },
        ]
      }
      recipe_import_jobs: {
        Row: {
          attempts: number
          completed_at: string | null
          completed_version: number
          created_at: string
          enqueued_at: string | null
          error_code: string | null
          id: string
          idempotency_key: string
          lease_expires_at: string | null
          manual_text: string | null
          provenance: Json
          result: Json | null
          retryable: boolean
          source_type: string
          source_url: string | null
          state: string
          updated_at: string
          upload_object: string | null
          user_id: string
          worker_id: string | null
        }
        Insert: {
          attempts?: number
          completed_at?: string | null
          completed_version?: number
          created_at?: string
          enqueued_at?: string | null
          error_code?: string | null
          id?: string
          idempotency_key: string
          lease_expires_at?: string | null
          manual_text?: string | null
          provenance?: Json
          result?: Json | null
          retryable?: boolean
          source_type: string
          source_url?: string | null
          state?: string
          updated_at?: string
          upload_object?: string | null
          user_id: string
          worker_id?: string | null
        }
        Update: {
          attempts?: number
          completed_at?: string | null
          completed_version?: number
          created_at?: string
          enqueued_at?: string | null
          error_code?: string | null
          id?: string
          idempotency_key?: string
          lease_expires_at?: string | null
          manual_text?: string | null
          provenance?: Json
          result?: Json | null
          retryable?: boolean
          source_type?: string
          source_url?: string | null
          state?: string
          updated_at?: string
          upload_object?: string | null
          user_id?: string
          worker_id?: string | null
        }
        Relationships: []
      }
      recipe_import_reprocesses: {
        Row: {
          child_job_id: string
          created_at: string
          id: string
          job_id: string
          pipeline_version: string
          user_id: string
        }
        Insert: {
          child_job_id: string
          created_at?: string
          id?: string
          job_id: string
          pipeline_version: string
          user_id: string
        }
        Update: {
          child_job_id?: string
          created_at?: string
          id?: string
          job_id?: string
          pipeline_version?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "recipe_import_reprocesses_child_job_id_fkey"
            columns: ["child_job_id"]
            isOneToOne: true
            referencedRelation: "recipe_import_jobs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "recipe_import_reprocesses_job_id_fkey"
            columns: ["job_id"]
            isOneToOne: false
            referencedRelation: "recipe_import_jobs"
            referencedColumns: ["id"]
          },
        ]
      }
      recipe_import_revisions: {
        Row: {
          created_at: string
          id: string
          job_id: string
          result: Json
          user_id: string
          version: number
        }
        Insert: {
          created_at?: string
          id?: string
          job_id: string
          result: Json
          user_id: string
          version: number
        }
        Update: {
          created_at?: string
          id?: string
          job_id?: string
          result?: Json
          user_id?: string
          version?: number
        }
        Relationships: [
          {
            foreignKeyName: "recipe_import_revisions_job_id_fkey"
            columns: ["job_id"]
            isOneToOne: false
            referencedRelation: "recipe_import_jobs"
            referencedColumns: ["id"]
          },
        ]
      }
      recipe_import_usage: {
        Row: {
          consumed: number
          period_start: string
          user_id: string
        }
        Insert: {
          consumed?: number
          period_start: string
          user_id: string
        }
        Update: {
          consumed?: number
          period_start?: string
          user_id?: string
        }
        Relationships: []
      }
      recipe_ingredients: {
        Row: {
          category: string | null
          food_concept_id: string | null
          id: string
          ingredient_id: string | null
          measure: string | null
          name: string
          normalized_name: string
          position: number
          recipe_id: string
        }
        Insert: {
          category?: string | null
          food_concept_id?: string | null
          id?: string
          ingredient_id?: string | null
          measure?: string | null
          name: string
          normalized_name: string
          position: number
          recipe_id: string
        }
        Update: {
          category?: string | null
          food_concept_id?: string | null
          id?: string
          ingredient_id?: string | null
          measure?: string | null
          name?: string
          normalized_name?: string
          position?: number
          recipe_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "recipe_ingredients_food_concept_id_fkey"
            columns: ["food_concept_id"]
            isOneToOne: false
            referencedRelation: "food_concepts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "recipe_ingredients_ingredient_id_fkey"
            columns: ["ingredient_id"]
            isOneToOne: false
            referencedRelation: "ingredients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "recipe_ingredients_recipe_id_fkey"
            columns: ["recipe_id"]
            isOneToOne: false
            referencedRelation: "recipes"
            referencedColumns: ["id"]
          },
        ]
      }
      recipe_monthly_usage: {
        Row: {
          consumed: number
          period_start: string
          user_id: string
        }
        Insert: {
          consumed?: number
          period_start: string
          user_id: string
        }
        Update: {
          consumed?: number
          period_start?: string
          user_id?: string
        }
        Relationships: []
      }
      recipe_suggestion_cache: {
        Row: {
          cache_key: string
          catalog_version_id: string
          created_at: string
          expires_at: string
          inventory_hash: string
          matcher_version: string
          result: Json | null
          status: string
          user_id: string
        }
        Insert: {
          cache_key: string
          catalog_version_id: string
          created_at?: string
          expires_at: string
          inventory_hash: string
          matcher_version: string
          result?: Json | null
          status?: string
          user_id: string
        }
        Update: {
          cache_key?: string
          catalog_version_id?: string
          created_at?: string
          expires_at?: string
          inventory_hash?: string
          matcher_version?: string
          result?: Json | null
          status?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "recipe_suggestion_cache_catalog_version_id_fkey"
            columns: ["catalog_version_id"]
            isOneToOne: false
            referencedRelation: "catalog_versions"
            referencedColumns: ["id"]
          },
        ]
      }
      recipes: {
        Row: {
          catalog_version_id: string
          external_id: string
          id: string
          instructions: string
          metadata: Json
          name: string
        }
        Insert: {
          catalog_version_id: string
          external_id: string
          id?: string
          instructions?: string
          metadata?: Json
          name: string
        }
        Update: {
          catalog_version_id?: string
          external_id?: string
          id?: string
          instructions?: string
          metadata?: Json
          name?: string
        }
        Relationships: [
          {
            foreignKeyName: "recipes_catalog_version_id_fkey"
            columns: ["catalog_version_id"]
            isOneToOne: false
            referencedRelation: "catalog_versions"
            referencedColumns: ["id"]
          },
        ]
      }
      shopping_list_items: {
        Row: {
          checked: boolean
          created_at: string
          deleted_at: string | null
          id: string
          ingredient_key: string | null
          name: string
          quantity: number | null
          unit: string | null
          updated_at: string
          user_id: string
          version: number
        }
        Insert: {
          checked?: boolean
          created_at?: string
          deleted_at?: string | null
          id?: string
          ingredient_key?: string | null
          name: string
          quantity?: number | null
          unit?: string | null
          updated_at?: string
          user_id: string
          version?: number
        }
        Update: {
          checked?: boolean
          created_at?: string
          deleted_at?: string | null
          id?: string
          ingredient_key?: string | null
          name?: string
          quantity?: number | null
          unit?: string | null
          updated_at?: string
          user_id?: string
          version?: number
        }
        Relationships: []
      }
      shopping_list_mutations: {
        Row: {
          client_mutation_id: string
          code: string
          conflicts: Json
          created_at: string
          id: string
          payload: Json
          result: Json | null
          status: string
          user_id: string
        }
        Insert: {
          client_mutation_id: string
          code: string
          conflicts?: Json
          created_at?: string
          id?: string
          payload: Json
          result?: Json | null
          status: string
          user_id: string
        }
        Update: {
          client_mutation_id?: string
          code?: string
          conflicts?: Json
          created_at?: string
          id?: string
          payload?: Json
          result?: Json | null
          status?: string
          user_id?: string
        }
        Relationships: []
      }
      stripe_events: {
        Row: {
          created_at: string
          event_created: number
          event_id: string
          event_type: string
          processed_at: string
          processing_status: string
          result: Json
        }
        Insert: {
          created_at?: string
          event_created: number
          event_id: string
          event_type: string
          processed_at?: string
          processing_status: string
          result: Json
        }
        Update: {
          created_at?: string
          event_created?: number
          event_id?: string
          event_type?: string
          processed_at?: string
          processing_status?: string
          result?: Json
        }
        Relationships: []
      }
      subscriptions: {
        Row: {
          cancel_at_period_end: boolean
          created_at: string
          current_period_end: string | null
          last_event_created: number | null
          last_event_id: string | null
          status: string
          stripe_customer_id: string | null
          stripe_subscription_id: string | null
          updated_at: string
          user_id: string
          version: number
        }
        Insert: {
          cancel_at_period_end?: boolean
          created_at?: string
          current_period_end?: string | null
          last_event_created?: number | null
          last_event_id?: string | null
          status?: string
          stripe_customer_id?: string | null
          stripe_subscription_id?: string | null
          updated_at?: string
          user_id: string
          version?: number
        }
        Update: {
          cancel_at_period_end?: boolean
          created_at?: string
          current_period_end?: string | null
          last_event_created?: number | null
          last_event_id?: string | null
          status?: string
          stripe_customer_id?: string | null
          stripe_subscription_id?: string | null
          updated_at?: string
          user_id?: string
          version?: number
        }
        Relationships: []
      }
      today_catalog_revision: {
        Row: {
          revision: number
          singleton: boolean
          updated_at: string
        }
        Insert: {
          revision?: number
          singleton?: boolean
          updated_at?: string
        }
        Update: {
          revision?: number
          singleton?: boolean
          updated_at?: string
        }
        Relationships: []
      }
      today_recommendation_cache: {
        Row: {
          cache_key: string
          catalog_version_id: string
          civil_date: string
          created_at: string
          expires_at: string
          matcher_version: string
          recommendation_version: string
          result: Json
          snapshot_key: string
          user_id: string
        }
        Insert: {
          cache_key: string
          catalog_version_id: string
          civil_date: string
          created_at?: string
          expires_at: string
          matcher_version: string
          recommendation_version: string
          result: Json
          snapshot_key: string
          user_id: string
        }
        Update: {
          cache_key?: string
          catalog_version_id?: string
          civil_date?: string
          created_at?: string
          expires_at?: string
          matcher_version?: string
          recommendation_version?: string
          result?: Json
          snapshot_key?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "today_recommendation_cache_catalog_version_id_fkey"
            columns: ["catalog_version_id"]
            isOneToOne: false
            referencedRelation: "catalog_versions"
            referencedColumns: ["id"]
          },
        ]
      }
      today_shopping_mutations: {
        Row: {
          client_mutation_id: string
          created_at: string
          item_ids: string[]
          recipe_id: string
          snapshot_key: string
          user_id: string
        }
        Insert: {
          client_mutation_id: string
          created_at?: string
          item_ids?: string[]
          recipe_id: string
          snapshot_key: string
          user_id: string
        }
        Update: {
          client_mutation_id?: string
          created_at?: string
          item_ids?: string[]
          recipe_id?: string
          snapshot_key?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "today_shopping_mutations_recipe_id_fkey"
            columns: ["recipe_id"]
            isOneToOne: false
            referencedRelation: "recipes"
            referencedColumns: ["id"]
          },
        ]
      }
      usage_counters: {
        Row: {
          feature: string
          period: string
          updated_at: string
          used: number
          user_id: string
        }
        Insert: {
          feature: string
          period: string
          updated_at?: string
          used?: number
          user_id: string
        }
        Update: {
          feature?: string
          period?: string
          updated_at?: string
          used?: number
          user_id?: string
        }
        Relationships: []
      }
      usage_ledger: {
        Row: {
          allowed: boolean
          created_at: string
          feature: string
          idempotency_key: string
          period: string
          response: Json
          user_id: string
        }
        Insert: {
          allowed: boolean
          created_at?: string
          feature: string
          idempotency_key: string
          period: string
          response: Json
          user_id: string
        }
        Update: {
          allowed?: boolean
          created_at?: string
          feature?: string
          idempotency_key?: string
          period?: string
          response?: Json
          user_id?: string
        }
        Relationships: []
      }
      user_entitlements: {
        Row: {
          plan: string
          status: string
          updated_at: string
          user_id: string
        }
        Insert: {
          plan?: string
          status?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          plan?: string
          status?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      user_product_mappings: {
        Row: {
          confirmed_by_user: boolean
          created_at: string
          display_name: string
          food_concept_id: string | null
          id: string
          normalized_raw_name: string
          retailer: string | null
          updated_at: string
          user_id: string
          version: number
        }
        Insert: {
          confirmed_by_user?: boolean
          created_at?: string
          display_name: string
          food_concept_id?: string | null
          id?: string
          normalized_raw_name: string
          retailer?: string | null
          updated_at?: string
          user_id: string
          version?: number
        }
        Update: {
          confirmed_by_user?: boolean
          created_at?: string
          display_name?: string
          food_concept_id?: string | null
          id?: string
          normalized_raw_name?: string
          retailer?: string | null
          updated_at?: string
          user_id?: string
          version?: number
        }
        Relationships: [
          {
            foreignKeyName: "user_product_mappings_food_concept_id_fkey"
            columns: ["food_concept_id"]
            isOneToOne: false
            referencedRelation: "food_concepts"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      activate_recipe_catalog: {
        Args: {
          p_checksum: string
          p_matcher_version: string
          p_recipes: Json
          p_source_version: string
          p_vocabulary: Json
        }
        Returns: Json
      }
      apply_cooking_mutation: {
        Args: {
          p_client_mutation_id: string
          p_lines: Json
          p_recipe_snapshot: Json
        }
        Returns: Json
      }
      apply_favorite_mutation: {
        Args: {
          p_client_mutation_id: string
          p_desired_state: string
          p_expected_version?: number
          p_recipe_id: string
          p_snapshot?: Json
        }
        Returns: Json
      }
      apply_inventory_mutation: {
        Args: {
          p_client_mutation_id: string
          p_expected_version?: number
          p_item_id: string
          p_operation: string
          p_payload?: Json
        }
        Returns: Json
      }
      apply_meal_mutation: {
        Args: {
          p_client_mutation_id: string
          p_expected_version?: number
          p_meal_entry_id: string
          p_operation: string
          p_payload?: Json
        }
        Returns: Json
      }
      apply_pantry_mutation_v3: {
        Args: {
          p_client_mutation_id: string
          p_expected_version: number
          p_item_id: string
          p_payload: Json
        }
        Returns: Json
      }
      apply_shopping_list_mutation: {
        Args: {
          p_client_mutation_id: string
          p_desired_state: string
          p_expected_version?: number
          p_ingredient_key: string
          p_item_id: string
          p_name: string
          p_quantity: number
          p_unit: string
        }
        Returns: Json
      }
      apply_today_shopping_v1: {
        Args: {
          p_client_mutation_id: string
          p_recipe_id: string
          p_snapshot_key: string
        }
        Returns: Json
      }
      attach_receipt_image: {
        Args: { p_draft_id: string; p_image_path: string }
        Returns: undefined
      }
      begin_recipe_suggestion: {
        Args: { p_cache_key: string; p_inventory_hash: string }
        Returns: Json
      }
      billing_entitlement: { Args: { p_user_id: string }; Returns: Json }
      claim_push_delivery: { Args: never; Returns: Json }
      claim_recipe_import_job: {
        Args: { p_job_id: string; p_worker_id: string }
        Returns: Json
      }
      complete_receipt_ocr: {
        Args: {
          p_draft_id: string
          p_parser_version: string
          p_raw_text: string
          p_result: Json
        }
        Returns: undefined
      }
      complete_recipe_import_job: {
        Args: {
          p_job_id: string
          p_provenance: Json
          p_result: Json
          p_worker_id: string
        }
        Returns: boolean
      }
      complete_recipe_suggestion: {
        Args: { p_cache_key: string; p_result: Json }
        Returns: undefined
      }
      confirm_receipt_draft: {
        Args: { p_draft_id: string; p_lines: Json }
        Returns: Json
      }
      confirm_receipt_draft_v2: {
        Args: {
          p_draft_id: string
          p_lines: Json
          p_normalizer_version: string
          p_payload_hash: string
          p_purchase_date: string
        }
        Returns: Json
      }
      consume_usage: {
        Args: { p_feature: string; p_idempotency_key: string }
        Returns: Json
      }
      create_recipe_import_job: {
        Args: {
          p_idempotency_key: string
          p_manual_text: string
          p_provenance: Json
          p_source_type: string
          p_source_url: string
          p_upload_object: string
        }
        Returns: Json
      }
      fail_receipt_ocr: {
        Args: { p_draft_id: string; p_error_code: string }
        Returns: undefined
      }
      fail_recipe_import_job: {
        Args: {
          p_error_code: string
          p_job_id: string
          p_retryable: boolean
          p_worker_id: string
        }
        Returns: boolean
      }
      fail_recipe_suggestion: {
        Args: { p_cache_key: string }
        Returns: undefined
      }
      find_recipe_candidates: {
        Args: { p_limit?: number; p_names: string[] }
        Returns: {
          recipe_id: string
        }[]
      }
      find_today_recipe_candidates_v1: {
        Args: { p_limit?: number }
        Returns: {
          overlap_count: number
          recipe_id: string
          source_rank: number
        }[]
      }
      finish_push_delivery: {
        Args: {
          p_delivery_id: string
          p_error_code: string
          p_next_attempt_at: string
          p_revoke_subscription: boolean
          p_status: string
        }
        Returns: boolean
      }
      import_retailer_catalog_v1: {
        Args: { p_manifest: Json; p_products: Json }
        Returns: Json
      }
      invoke_receipt_vision: { Args: { p_draft_id: string }; Returns: Json }
      link_firebase_auth_identity: {
        Args: { firebase_uid: string; target_user_id: string }
        Returns: undefined
      }
      mark_receipt_vision_invoked: {
        Args: { p_draft_id: string }
        Returns: undefined
      }
      mark_recipe_job_enqueue_failed: {
        Args: { p_job_id: string }
        Returns: undefined
      }
      owns_row: { Args: { row_user_id: string }; Returns: boolean }
      process_stripe_event: {
        Args: {
          p_cancel_at_period_end: boolean
          p_customer_id: string
          p_event_created: number
          p_event_id: string
          p_event_type: string
          p_period_end: string
          p_result: Json
          p_status: string
          p_subscription_id: string
          p_user_id: string
        }
        Returns: Json
      }
      pull_meal_entries: {
        Args: {
          p_cursor_id?: string
          p_cursor_updated_at?: string
          p_limit?: number
        }
        Returns: Json
      }
      r1_normalize_text: { Args: { value: string }; Returns: string }
      read_today_cache_v1: {
        Args: {
          p_date: string
          p_matcher_version: string
          p_recommendation_version: string
        }
        Returns: Json
      }
      reconcile_subscription: {
        Args: {
          p_cancel_at_period_end: boolean
          p_customer_id: string
          p_event_created: number
          p_event_id: string
          p_period_end: string
          p_status: string
          p_subscription_id: string
          p_user_id: string
        }
        Returns: Json
      }
      register_push_subscription: {
        Args: {
          p_auth: string
          p_endpoint: string
          p_endpoint_hash: string
          p_expiration_time: string
          p_p256dh: string
        }
        Returns: string
      }
      release_receipt_ocr: { Args: { p_draft_id: string }; Returns: undefined }
      request_recipe_import_reprocess: {
        Args: { p_job_id: string }
        Returns: Json
      }
      reserve_receipt_ocr: {
        Args: {
          p_draft_id: string
          p_image_hash: string
          p_locale: string
          p_request_id: string
        }
        Returns: Json
      }
      resolve_receipt_line_v2: {
        Args: {
          p_client_mutation_id: string
          p_decision: string
          p_display_name: string
          p_draft_id: string
          p_expected_version: number
          p_food_concept_id: string
          p_line_id: string
          p_request_hash: string
        }
        Returns: Json
      }
      restore_inventory_item_v3: {
        Args: {
          p_client_mutation_id: string
          p_expected_version: number
          p_item_id: string
        }
        Returns: Json
      }
      revoke_push_subscription: {
        Args: { p_endpoint_hash: string }
        Returns: boolean
      }
      save_recipe_import_revision: {
        Args: {
          p_expected_version: number
          p_job_id: string
          p_restore?: boolean
          p_result: Json
        }
        Returns: Json
      }
      set_billing_override: {
        Args: {
          p_actor?: string
          p_reason: string
          p_user_id: string
          p_value: boolean
        }
        Returns: Json
      }
      set_recipe_import_stage: {
        Args: { p_job_id: string; p_stage: string; p_worker_id: string }
        Returns: boolean
      }
      store_today_cache_v1: {
        Args: {
          p_cache_key: string
          p_date: string
          p_matcher_version: string
          p_recommendation_version: string
          p_result: Json
          p_snapshot_key: string
          p_user_id: string
        }
        Returns: Json
      }
      today_lock_snapshot_v1: { Args: never; Returns: undefined }
      today_parse_measure_v1: {
        Args: { value: string }
        Returns: {
          quantity: number
          unit: string
        }[]
      }
      today_state_key_for_user_v1: {
        Args: {
          p_date: string
          p_matcher_version: string
          p_recommendation_version: string
          p_user_id: string
        }
        Returns: string
      }
      today_state_key_v1: {
        Args: {
          p_date: string
          p_matcher_version: string
          p_recommendation_version: string
        }
        Returns: string
      }
      valid_meal_consumed: { Args: { value: Json }; Returns: boolean }
    }
    Enums: {
      [_ in never]: never
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
  storage: {
    Tables: {
      buckets: {
        Row: {
          allowed_mime_types: string[] | null
          avif_autodetection: boolean | null
          created_at: string | null
          file_size_limit: number | null
          id: string
          name: string
          owner: string | null
          owner_id: string | null
          public: boolean | null
          type: Database["storage"]["Enums"]["buckettype"]
          updated_at: string | null
          versioning_status: string
        }
        Insert: {
          allowed_mime_types?: string[] | null
          avif_autodetection?: boolean | null
          created_at?: string | null
          file_size_limit?: number | null
          id: string
          name: string
          owner?: string | null
          owner_id?: string | null
          public?: boolean | null
          type?: Database["storage"]["Enums"]["buckettype"]
          updated_at?: string | null
          versioning_status?: string
        }
        Update: {
          allowed_mime_types?: string[] | null
          avif_autodetection?: boolean | null
          created_at?: string | null
          file_size_limit?: number | null
          id?: string
          name?: string
          owner?: string | null
          owner_id?: string | null
          public?: boolean | null
          type?: Database["storage"]["Enums"]["buckettype"]
          updated_at?: string | null
          versioning_status?: string
        }
        Relationships: []
      }
      buckets_analytics: {
        Row: {
          created_at: string
          deleted_at: string | null
          format: string
          id: string
          name: string
          type: Database["storage"]["Enums"]["buckettype"]
          updated_at: string
        }
        Insert: {
          created_at?: string
          deleted_at?: string | null
          format?: string
          id?: string
          name: string
          type?: Database["storage"]["Enums"]["buckettype"]
          updated_at?: string
        }
        Update: {
          created_at?: string
          deleted_at?: string | null
          format?: string
          id?: string
          name?: string
          type?: Database["storage"]["Enums"]["buckettype"]
          updated_at?: string
        }
        Relationships: []
      }
      buckets_vectors: {
        Row: {
          created_at: string
          id: string
          type: Database["storage"]["Enums"]["buckettype"]
          updated_at: string
        }
        Insert: {
          created_at?: string
          id: string
          type?: Database["storage"]["Enums"]["buckettype"]
          updated_at?: string
        }
        Update: {
          created_at?: string
          id?: string
          type?: Database["storage"]["Enums"]["buckettype"]
          updated_at?: string
        }
        Relationships: []
      }
      iceberg_namespaces: {
        Row: {
          bucket_name: string
          catalog_id: string
          created_at: string
          id: string
          metadata: Json
          name: string
          updated_at: string
        }
        Insert: {
          bucket_name: string
          catalog_id: string
          created_at?: string
          id?: string
          metadata?: Json
          name: string
          updated_at?: string
        }
        Update: {
          bucket_name?: string
          catalog_id?: string
          created_at?: string
          id?: string
          metadata?: Json
          name?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "iceberg_namespaces_catalog_id_fkey"
            columns: ["catalog_id"]
            isOneToOne: false
            referencedRelation: "buckets_analytics"
            referencedColumns: ["id"]
          },
        ]
      }
      iceberg_tables: {
        Row: {
          bucket_name: string
          catalog_id: string
          created_at: string
          id: string
          location: string
          name: string
          namespace_id: string
          remote_table_id: string | null
          shard_id: string | null
          shard_key: string | null
          updated_at: string
        }
        Insert: {
          bucket_name: string
          catalog_id: string
          created_at?: string
          id?: string
          location: string
          name: string
          namespace_id: string
          remote_table_id?: string | null
          shard_id?: string | null
          shard_key?: string | null
          updated_at?: string
        }
        Update: {
          bucket_name?: string
          catalog_id?: string
          created_at?: string
          id?: string
          location?: string
          name?: string
          namespace_id?: string
          remote_table_id?: string | null
          shard_id?: string | null
          shard_key?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "iceberg_tables_catalog_id_fkey"
            columns: ["catalog_id"]
            isOneToOne: false
            referencedRelation: "buckets_analytics"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "iceberg_tables_namespace_id_fkey"
            columns: ["namespace_id"]
            isOneToOne: false
            referencedRelation: "iceberg_namespaces"
            referencedColumns: ["id"]
          },
        ]
      }
      migrations: {
        Row: {
          executed_at: string | null
          hash: string
          id: number
          name: string
        }
        Insert: {
          executed_at?: string | null
          hash: string
          id: number
          name: string
        }
        Update: {
          executed_at?: string | null
          hash?: string
          id?: number
          name?: string
        }
        Relationships: []
      }
      objects: {
        Row: {
          archived_at: string | null
          bucket_id: string | null
          created_at: string | null
          id: string
          is_delete_marker: boolean
          is_versioned: boolean
          last_accessed_at: string | null
          metadata: Json | null
          name: string | null
          owner: string | null
          owner_id: string | null
          path_tokens: string[] | null
          updated_at: string | null
          user_metadata: Json | null
          version: string | null
        }
        Insert: {
          archived_at?: string | null
          bucket_id?: string | null
          created_at?: string | null
          id?: string
          is_delete_marker?: boolean
          is_versioned?: boolean
          last_accessed_at?: string | null
          metadata?: Json | null
          name?: string | null
          owner?: string | null
          owner_id?: string | null
          path_tokens?: string[] | null
          updated_at?: string | null
          user_metadata?: Json | null
          version?: string | null
        }
        Update: {
          archived_at?: string | null
          bucket_id?: string | null
          created_at?: string | null
          id?: string
          is_delete_marker?: boolean
          is_versioned?: boolean
          last_accessed_at?: string | null
          metadata?: Json | null
          name?: string | null
          owner?: string | null
          owner_id?: string | null
          path_tokens?: string[] | null
          updated_at?: string | null
          user_metadata?: Json | null
          version?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "objects_bucketId_fkey"
            columns: ["bucket_id"]
            isOneToOne: false
            referencedRelation: "buckets"
            referencedColumns: ["id"]
          },
        ]
      }
      s3_multipart_uploads: {
        Row: {
          bucket_id: string
          created_at: string
          id: string
          in_progress_size: number
          key: string
          metadata: Json | null
          owner_id: string | null
          upload_signature: string
          user_metadata: Json | null
          version: string
        }
        Insert: {
          bucket_id: string
          created_at?: string
          id: string
          in_progress_size?: number
          key: string
          metadata?: Json | null
          owner_id?: string | null
          upload_signature: string
          user_metadata?: Json | null
          version: string
        }
        Update: {
          bucket_id?: string
          created_at?: string
          id?: string
          in_progress_size?: number
          key?: string
          metadata?: Json | null
          owner_id?: string | null
          upload_signature?: string
          user_metadata?: Json | null
          version?: string
        }
        Relationships: [
          {
            foreignKeyName: "s3_multipart_uploads_bucket_id_fkey"
            columns: ["bucket_id"]
            isOneToOne: false
            referencedRelation: "buckets"
            referencedColumns: ["id"]
          },
        ]
      }
      s3_multipart_uploads_parts: {
        Row: {
          bucket_id: string
          created_at: string
          etag: string
          id: string
          key: string
          owner_id: string | null
          part_number: number
          size: number
          upload_id: string
          version: string
        }
        Insert: {
          bucket_id: string
          created_at?: string
          etag: string
          id?: string
          key: string
          owner_id?: string | null
          part_number: number
          size?: number
          upload_id: string
          version: string
        }
        Update: {
          bucket_id?: string
          created_at?: string
          etag?: string
          id?: string
          key?: string
          owner_id?: string | null
          part_number?: number
          size?: number
          upload_id?: string
          version?: string
        }
        Relationships: [
          {
            foreignKeyName: "s3_multipart_uploads_parts_bucket_id_fkey"
            columns: ["bucket_id"]
            isOneToOne: false
            referencedRelation: "buckets"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "s3_multipart_uploads_parts_upload_id_fkey"
            columns: ["upload_id"]
            isOneToOne: false
            referencedRelation: "s3_multipart_uploads"
            referencedColumns: ["id"]
          },
        ]
      }
      vector_indexes: {
        Row: {
          bucket_id: string
          created_at: string
          data_type: string
          dimension: number
          distance_metric: string
          id: string
          metadata_configuration: Json | null
          name: string
          updated_at: string
        }
        Insert: {
          bucket_id: string
          created_at?: string
          data_type: string
          dimension: number
          distance_metric: string
          id?: string
          metadata_configuration?: Json | null
          name: string
          updated_at?: string
        }
        Update: {
          bucket_id?: string
          created_at?: string
          data_type?: string
          dimension?: number
          distance_metric?: string
          id?: string
          metadata_configuration?: Json | null
          name?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "vector_indexes_bucket_id_fkey"
            columns: ["bucket_id"]
            isOneToOne: false
            referencedRelation: "buckets_vectors"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      allow_any_operation: {
        Args: { expected_operations: string[] }
        Returns: boolean
      }
      allow_only_operation: {
        Args: { expected_operation: string }
        Returns: boolean
      }
      can_insert_object: {
        Args: { bucketid: string; metadata: Json; name: string; owner: string }
        Returns: undefined
      }
      extension: { Args: { name: string }; Returns: string }
      filename: { Args: { name: string }; Returns: string }
      foldername: { Args: { name: string }; Returns: string[] }
      get_common_prefix: {
        Args: { p_delimiter: string; p_key: string; p_prefix: string }
        Returns: string
      }
      get_size_by_bucket: {
        Args: never
        Returns: {
          bucket_id: string
          size: number
        }[]
      }
      list_multipart_uploads_with_delimiter: {
        Args: {
          bucket_id: string
          delimiter_param: string
          max_keys?: number
          next_key_token?: string
          next_upload_token?: string
          prefix_param: string
        }
        Returns: {
          created_at: string
          id: string
          key: string
        }[]
      }
      list_objects_with_delimiter: {
        Args: {
          _bucket_id: string
          delimiter_param: string
          max_keys?: number
          next_token?: string
          prefix_param: string
          sort_order?: string
          start_after?: string
        }
        Returns: {
          created_at: string
          id: string
          last_accessed_at: string
          metadata: Json
          name: string
          updated_at: string
        }[]
      }
      operation: { Args: never; Returns: string }
      search: {
        Args: {
          bucketname: string
          levels?: number
          limits?: number
          offsets?: number
          prefix: string
          search?: string
          sortcolumn?: string
          sortorder?: string
        }
        Returns: {
          created_at: string
          id: string
          last_accessed_at: string
          metadata: Json
          name: string
          updated_at: string
        }[]
      }
      search_by_timestamp: {
        Args: {
          p_bucket_id: string
          p_level: number
          p_limit: number
          p_prefix: string
          p_sort_column: string
          p_sort_column_after: string
          p_sort_order: string
          p_start_after: string
        }
        Returns: {
          created_at: string
          id: string
          key: string
          last_accessed_at: string
          metadata: Json
          name: string
          updated_at: string
        }[]
      }
      search_v2: {
        Args: {
          bucket_name: string
          levels?: number
          limits?: number
          prefix: string
          sort_column?: string
          sort_column_after?: string
          sort_order?: string
          start_after?: string
        }
        Returns: {
          created_at: string
          id: string
          key: string
          last_accessed_at: string
          metadata: Json
          name: string
          updated_at: string
        }[]
      }
    }
    Enums: {
      buckettype: "STANDARD" | "ANALYTICS" | "VECTOR"
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
  graphql_public: {
    Enums: {},
  },
  public: {
    Enums: {},
  },
  storage: {
    Enums: {
      buckettype: ["STANDARD", "ANALYTICS", "VECTOR"],
    },
  },
} as const

