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
    PostgrestVersion: "14.15"
  }
  public: {
    Tables: {
      animation_prompt_lab_jobs: {
        Row: {
          animation_row_id: string
          archetype: string
          completed_at: string | null
          cost_confirmed_at: string
          created_at: string
          duration_seconds: number
          error: string | null
          estimated_cost_usd: number
          id: string
          idempotency_key: string
          model: string
          model_key: string
          output_url: string | null
          pricing_version: string
          prompt: string
          prompt_version: string
          provider_status: string | null
          resolution: string
          start_frame_prediction_id: string | null
          start_frame_url: string | null
          status: string
          still_index: number
          still_url: string
          stop_requested_at: string | null
          updated_at: string
          video_prediction_id: string | null
        }
        Insert: {
          animation_row_id: string
          archetype: string
          completed_at?: string | null
          cost_confirmed_at: string
          created_at?: string
          duration_seconds: number
          error?: string | null
          estimated_cost_usd: number
          id?: string
          idempotency_key: string
          model: string
          model_key: string
          output_url?: string | null
          pricing_version: string
          prompt: string
          prompt_version: string
          provider_status?: string | null
          resolution: string
          start_frame_prediction_id?: string | null
          start_frame_url?: string | null
          status?: string
          still_index: number
          still_url: string
          stop_requested_at?: string | null
          updated_at?: string
          video_prediction_id?: string | null
        }
        Update: {
          animation_row_id?: string
          archetype?: string
          completed_at?: string | null
          cost_confirmed_at?: string
          created_at?: string
          duration_seconds?: number
          error?: string | null
          estimated_cost_usd?: number
          id?: string
          idempotency_key?: string
          model?: string
          model_key?: string
          output_url?: string | null
          pricing_version?: string
          prompt?: string
          prompt_version?: string
          provider_status?: string | null
          resolution?: string
          start_frame_prediction_id?: string | null
          start_frame_url?: string | null
          status?: string
          still_index?: number
          still_url?: string
          stop_requested_at?: string | null
          updated_at?: string
          video_prediction_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "animation_prompt_lab_jobs_animation_row_id_fkey"
            columns: ["animation_row_id"]
            isOneToOne: false
            referencedRelation: "botanical_animated"
            referencedColumns: ["id"]
          },
        ]
      }
      animation_provider_jobs: {
        Row: {
          attempt: number
          created_at: string
          error: string | null
          id: string
          job_key: string
          model: string | null
          output_data: string | null
          output_url: string | null
          prediction_id: string | null
          provider: string
          row_id: string
          status: string
          updated_at: string
        }
        Insert: {
          attempt?: number
          created_at?: string
          error?: string | null
          id?: string
          job_key: string
          model?: string | null
          output_data?: string | null
          output_url?: string | null
          prediction_id?: string | null
          provider?: string
          row_id: string
          status?: string
          updated_at?: string
        }
        Update: {
          attempt?: number
          created_at?: string
          error?: string | null
          id?: string
          job_key?: string
          model?: string | null
          output_data?: string | null
          output_url?: string | null
          prediction_id?: string | null
          provider?: string
          row_id?: string
          status?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "animation_provider_jobs_row_id_fkey"
            columns: ["row_id"]
            isOneToOne: false
            referencedRelation: "botanical_animated"
            referencedColumns: ["id"]
          },
        ]
      }
      app_auth_settings: {
        Row: {
          passcode_hash: string
          singleton: boolean
          updated_at: string
        }
        Insert: {
          passcode_hash: string
          singleton?: boolean
          updated_at?: string
        }
        Update: {
          passcode_hash?: string
          singleton?: boolean
          updated_at?: string
        }
        Relationships: []
      }
      app_members: {
        Row: {
          created_at: string
          role: string
          user_id: string
        }
        Insert: {
          created_at?: string
          role?: string
          user_id: string
        }
        Update: {
          created_at?: string
          role?: string
          user_id?: string
        }
        Relationships: []
      }
      app_secrets: {
        Row: {
          ciphertext: string
          iv: string
          name: string
          updated_at: string
        }
        Insert: {
          ciphertext: string
          iv: string
          name: string
          updated_at?: string
        }
        Update: {
          ciphertext?: string
          iv?: string
          name?: string
          updated_at?: string
        }
        Relationships: []
      }
      botanical_animated: {
        Row: {
          caption: string | null
          clip_urls: string[] | null
          cost_breakdown: Json
          cost_confirmed_at: string | null
          cost_confirmed_estimate_usd: number | null
          cost_usd: number | null
          created_at: string
          error: string | null
          final_video_url: string | null
          id: string
          plant_name: string | null
          pricing_version: string | null
          progress: Json
          queue_status: string
          retry_counts: Json
          script: Json | null
          source_content_id: string | null
          still_urls: string[] | null
          stop_requested_at: string | null
          updated_at: string
          verified_fact: string | null
        }
        Insert: {
          caption?: string | null
          clip_urls?: string[] | null
          cost_breakdown?: Json
          cost_confirmed_at?: string | null
          cost_confirmed_estimate_usd?: number | null
          cost_usd?: number | null
          created_at?: string
          error?: string | null
          final_video_url?: string | null
          id?: string
          plant_name?: string | null
          pricing_version?: string | null
          progress?: Json
          queue_status?: string
          retry_counts?: Json
          script?: Json | null
          source_content_id?: string | null
          still_urls?: string[] | null
          stop_requested_at?: string | null
          updated_at?: string
          verified_fact?: string | null
        }
        Update: {
          caption?: string | null
          clip_urls?: string[] | null
          cost_breakdown?: Json
          cost_confirmed_at?: string | null
          cost_confirmed_estimate_usd?: number | null
          cost_usd?: number | null
          created_at?: string
          error?: string | null
          final_video_url?: string | null
          id?: string
          plant_name?: string | null
          pricing_version?: string | null
          progress?: Json
          queue_status?: string
          retry_counts?: Json
          script?: Json | null
          source_content_id?: string | null
          still_urls?: string[] | null
          stop_requested_at?: string | null
          updated_at?: string
          verified_fact?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "botanical_animated_source_content_id_fkey"
            columns: ["source_content_id"]
            isOneToOne: false
            referencedRelation: "botanical_content"
            referencedColumns: ["id"]
          },
        ]
      }
      botanical_content: {
        Row: {
          caption: string | null
          created_at: string
          generation_run_id: string | null
          hook_variants: Json | null
          id: string
          part2_hook: string | null
          plant_name: string | null
          queue_status: string
          raw_content: string | null
          score_reasoning: string | null
          script: string
          script_visuals: string | null
          thumbnail: string | null
          verified_fact: string | null
          virality_score: number | null
        }
        Insert: {
          caption?: string | null
          created_at?: string
          generation_run_id?: string | null
          hook_variants?: Json | null
          id?: string
          part2_hook?: string | null
          plant_name?: string | null
          queue_status?: string
          raw_content?: string | null
          score_reasoning?: string | null
          script: string
          script_visuals?: string | null
          thumbnail?: string | null
          verified_fact?: string | null
          virality_score?: number | null
        }
        Update: {
          caption?: string | null
          created_at?: string
          generation_run_id?: string | null
          hook_variants?: Json | null
          id?: string
          part2_hook?: string | null
          plant_name?: string | null
          queue_status?: string
          raw_content?: string | null
          score_reasoning?: string | null
          script?: string
          script_visuals?: string | null
          thumbnail?: string | null
          verified_fact?: string | null
          virality_score?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "botanical_content_generation_run_id_fkey"
            columns: ["generation_run_id"]
            isOneToOne: true
            referencedRelation: "still_generation_runs"
            referencedColumns: ["id"]
          },
        ]
      }
      content_metrics: {
        Row: {
          average_view_duration_seconds: number | null
          average_view_percentage: number | null
          captured_at: string
          comments: number | null
          engaged_views: number | null
          estimated_revenue_usd: number | null
          id: string
          likes: number | null
          publication_id: string
          raw: Json
          saves: number | null
          shares: number | null
          subscribers_gained: number | null
          views: number | null
          watch_time_seconds: number | null
        }
        Insert: {
          average_view_duration_seconds?: number | null
          average_view_percentage?: number | null
          captured_at?: string
          comments?: number | null
          engaged_views?: number | null
          estimated_revenue_usd?: number | null
          id?: string
          likes?: number | null
          publication_id: string
          raw?: Json
          saves?: number | null
          shares?: number | null
          subscribers_gained?: number | null
          views?: number | null
          watch_time_seconds?: number | null
        }
        Update: {
          average_view_duration_seconds?: number | null
          average_view_percentage?: number | null
          captured_at?: string
          comments?: number | null
          engaged_views?: number | null
          estimated_revenue_usd?: number | null
          id?: string
          likes?: number | null
          publication_id?: string
          raw?: Json
          saves?: number | null
          shares?: number | null
          subscribers_gained?: number | null
          views?: number | null
          watch_time_seconds?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "content_metrics_publication_id_fkey"
            columns: ["publication_id"]
            isOneToOne: false
            referencedRelation: "content_publications"
            referencedColumns: ["id"]
          },
        ]
      }
      content_publications: {
        Row: {
          animated_id: string | null
          botanical_content_id: string | null
          caption: string | null
          created_at: string
          delivered_at: string | null
          delivery_mode: string
          error: string | null
          experiment: Json
          id: string
          idempotency_key: string
          music_label: string | null
          platform: string
          published_at: string | null
          remote_content_id: string | null
          remote_publish_id: string | null
          remote_url: string | null
          status: string
          title: string | null
          updated_at: string
        }
        Insert: {
          animated_id?: string | null
          botanical_content_id?: string | null
          caption?: string | null
          created_at?: string
          delivered_at?: string | null
          delivery_mode: string
          error?: string | null
          experiment?: Json
          id?: string
          idempotency_key: string
          music_label?: string | null
          platform: string
          published_at?: string | null
          remote_content_id?: string | null
          remote_publish_id?: string | null
          remote_url?: string | null
          status?: string
          title?: string | null
          updated_at?: string
        }
        Update: {
          animated_id?: string | null
          botanical_content_id?: string | null
          caption?: string | null
          created_at?: string
          delivered_at?: string | null
          delivery_mode?: string
          error?: string | null
          experiment?: Json
          id?: string
          idempotency_key?: string
          music_label?: string | null
          platform?: string
          published_at?: string | null
          remote_content_id?: string | null
          remote_publish_id?: string | null
          remote_url?: string | null
          status?: string
          title?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "content_publications_animated_id_fkey"
            columns: ["animated_id"]
            isOneToOne: false
            referencedRelation: "botanical_animated"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "content_publications_botanical_content_id_fkey"
            columns: ["botanical_content_id"]
            isOneToOne: false
            referencedRelation: "botanical_content"
            referencedColumns: ["id"]
          },
        ]
      }
      cost_events: {
        Row: {
          actual_cost_usd: number | null
          animated_id: string | null
          botanical_content_id: string | null
          created_at: string
          estimated_cost_usd: number
          generation_run_id: string | null
          id: string
          model: string
          operation: string
          provider: string
          provider_job_id: string | null
          status: string
        }
        Insert: {
          actual_cost_usd?: number | null
          animated_id?: string | null
          botanical_content_id?: string | null
          created_at?: string
          estimated_cost_usd: number
          generation_run_id?: string | null
          id?: string
          model: string
          operation: string
          provider: string
          provider_job_id?: string | null
          status: string
        }
        Update: {
          actual_cost_usd?: number | null
          animated_id?: string | null
          botanical_content_id?: string | null
          created_at?: string
          estimated_cost_usd?: number
          generation_run_id?: string | null
          id?: string
          model?: string
          operation?: string
          provider?: string
          provider_job_id?: string | null
          status?: string
        }
        Relationships: [
          {
            foreignKeyName: "cost_events_animated_id_fkey"
            columns: ["animated_id"]
            isOneToOne: false
            referencedRelation: "botanical_animated"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "cost_events_botanical_content_id_fkey"
            columns: ["botanical_content_id"]
            isOneToOne: false
            referencedRelation: "botanical_content"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "cost_events_generation_run_id_fkey"
            columns: ["generation_run_id"]
            isOneToOne: false
            referencedRelation: "still_generation_runs"
            referencedColumns: ["id"]
          },
        ]
      }
      pin_login_attempts: {
        Row: {
          attempted_at: string
          id: number
          ip_hash: string
          succeeded: boolean
        }
        Insert: {
          attempted_at?: string
          id?: never
          ip_hash: string
          succeeded?: boolean
        }
        Update: {
          attempted_at?: string
          id?: never
          ip_hash?: string
          succeeded?: boolean
        }
        Relationships: []
      }
      platform_connections: {
        Row: {
          access_token: string
          account_id: string
          account_name: string | null
          created_at: string
          expires_at: string | null
          id: string
          metadata: Json
          platform: string
          refresh_token: string | null
          scopes: string[]
          updated_at: string
        }
        Insert: {
          access_token: string
          account_id: string
          account_name?: string | null
          created_at?: string
          expires_at?: string | null
          id?: string
          metadata?: Json
          platform: string
          refresh_token?: string | null
          scopes?: string[]
          updated_at?: string
        }
        Update: {
          access_token?: string
          account_id?: string
          account_name?: string | null
          created_at?: string
          expires_at?: string | null
          id?: string
          metadata?: Json
          platform?: string
          refresh_token?: string | null
          scopes?: string[]
          updated_at?: string
        }
        Relationships: []
      }
      platform_oauth_states: {
        Row: {
          code_verifier: string | null
          created_at: string
          expires_at: string
          platform: string
          state_hash: string
          used_at: string | null
          user_id: string
        }
        Insert: {
          code_verifier?: string | null
          created_at?: string
          expires_at: string
          platform: string
          state_hash: string
          used_at?: string | null
          user_id: string
        }
        Update: {
          code_verifier?: string | null
          created_at?: string
          expires_at?: string
          platform?: string
          state_hash?: string
          used_at?: string | null
          user_id?: string
        }
        Relationships: []
      }
      still_generation_runs: {
        Row: {
          actual_cost_usd: number | null
          botanical_content_id: string | null
          completed_at: string | null
          confirmed_estimate_usd: number
          created_at: string
          daily_limit_usd: number
          error: string | null
          estimated_cost_usd: number
          id: string
          idempotency_key: string
          image_count: number
          image_provider: string
          model: string
          model_version: string | null
          per_run_limit_usd: number
          pricing_version: string
          prompt_version: string
          status: string
          text_model_version: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          actual_cost_usd?: number | null
          botanical_content_id?: string | null
          completed_at?: string | null
          confirmed_estimate_usd: number
          created_at?: string
          daily_limit_usd: number
          error?: string | null
          estimated_cost_usd: number
          id?: string
          idempotency_key: string
          image_count?: number
          image_provider: string
          model: string
          model_version?: string | null
          per_run_limit_usd: number
          pricing_version: string
          prompt_version: string
          status?: string
          text_model_version?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          actual_cost_usd?: number | null
          botanical_content_id?: string | null
          completed_at?: string | null
          confirmed_estimate_usd?: number
          created_at?: string
          daily_limit_usd?: number
          error?: string | null
          estimated_cost_usd?: number
          id?: string
          idempotency_key?: string
          image_count?: number
          image_provider?: string
          model?: string
          model_version?: string | null
          per_run_limit_usd?: number
          pricing_version?: string
          prompt_version?: string
          status?: string
          text_model_version?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "still_generation_runs_botanical_content_id_fkey"
            columns: ["botanical_content_id"]
            isOneToOne: false
            referencedRelation: "botanical_content"
            referencedColumns: ["id"]
          },
        ]
      }
      tiktok_send_jobs: {
        Row: {
          content_id: string | null
          created_at: string
          fail_reason: string | null
          id: string
          phase: string
          publication_id: string | null
          publish_id: string | null
          raw: Json | null
          tiktok_status: string | null
          updated_at: string
        }
        Insert: {
          content_id?: string | null
          created_at?: string
          fail_reason?: string | null
          id?: string
          phase?: string
          publication_id?: string | null
          publish_id?: string | null
          raw?: Json | null
          tiktok_status?: string | null
          updated_at?: string
        }
        Update: {
          content_id?: string | null
          created_at?: string
          fail_reason?: string | null
          id?: string
          phase?: string
          publication_id?: string | null
          publish_id?: string | null
          raw?: Json | null
          tiktok_status?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "tiktok_send_jobs_publication_id_fkey"
            columns: ["publication_id"]
            isOneToOne: false
            referencedRelation: "content_publications"
            referencedColumns: ["id"]
          },
        ]
      }
      tiktok_tokens: {
        Row: {
          access_token: string
          created_at: string
          expires_at: string
          id: string
          open_id: string
          refresh_expires_at: string | null
          refresh_token: string
          scope: string | null
          updated_at: string
        }
        Insert: {
          access_token: string
          created_at?: string
          expires_at: string
          id?: string
          open_id: string
          refresh_expires_at?: string | null
          refresh_token: string
          scope?: string | null
          updated_at?: string
        }
        Update: {
          access_token?: string
          created_at?: string
          expires_at?: string
          id?: string
          open_id?: string
          refresh_expires_at?: string | null
          refresh_token?: string
          scope?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      trend_content: {
        Row: {
          caption: string | null
          created_at: string
          id: string
          part2_hook: string | null
          raw_content: string | null
          script: string
          script_visuals: string | null
          subject: string | null
          thumbnail: string | null
          verified_fact: string | null
        }
        Insert: {
          caption?: string | null
          created_at?: string
          id?: string
          part2_hook?: string | null
          raw_content?: string | null
          script: string
          script_visuals?: string | null
          subject?: string | null
          thumbnail?: string | null
          verified_fact?: string | null
        }
        Update: {
          caption?: string | null
          created_at?: string
          id?: string
          part2_hook?: string | null
          raw_content?: string | null
          script?: string
          script_visuals?: string | null
          subject?: string | null
          thumbnail?: string | null
          verified_fact?: string | null
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      authenticate_app_pin: {
        Args: { _ip_hash: string; _passcode: string }
        Returns: string
      }
      claim_provider_job: {
        Args: {
          _job_key: string
          _max_attempts: number
          _model: string
          _provider: string
          _row_id: string
        }
        Returns: {
          attempt: number
          claimed: boolean
          exhausted: boolean
          job_id: string
          job_status: string
          output_url: string
          prediction_id: string
        }[]
      }
      claim_still_generation_run: {
        Args: {
          _confirmed_estimate_usd: number
          _daily_limit_usd: number
          _estimated_cost_usd: number
          _idempotency_key: string
          _image_provider: string
          _model: string
          _per_run_limit_usd: number
          _pricing_version: string
          _prompt_version: string
          _user_id: string
        }
        Returns: {
          claimed: boolean
          content_id: string
          daily_reserved_usd: number
          rejection_code: string
          run_id: string
          run_status: string
        }[]
      }
      consume_animation_retry: {
        Args: { _bucket: string; _limit_value: number; _row_id: string }
        Returns: {
          allowed: boolean
          limit_value: number
          used: number
        }[]
      }
      expire_stale_active_animated: {
        Args: { _threshold_seconds?: number }
        Returns: number
      }
      guarded_update_animated: {
        Args: { _patch: Json; _row_id: string }
        Returns: boolean
      }
      is_app_member: { Args: never; Returns: boolean }
      patch_botanical_visual: {
        Args: { _content_id: string; _moment: string; _patch: Json }
        Returns: string
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
