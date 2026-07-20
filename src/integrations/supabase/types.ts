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
    PostgrestVersion: "14.1"
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
        Relationships: []
      }
      tiktok_send_jobs: {
        Row: {
          content_id: string | null
          created_at: string
          fail_reason: string | null
          id: string
          phase: string
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
          publish_id?: string | null
          raw?: Json | null
          tiktok_status?: string | null
          updated_at?: string
        }
        Relationships: []
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
