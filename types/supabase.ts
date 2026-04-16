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
      builder_edits: {
        Row: {
          commerce_tenant_id: string | null
          created_at: string
          edit_json: Json
          generation_id: string
          id: string
          owner_id: string
        }
        Insert: {
          commerce_tenant_id?: string | null
          created_at?: string
          edit_json: Json
          generation_id: string
          id?: string
          owner_id: string
        }
        Update: {
          commerce_tenant_id?: string | null
          created_at?: string
          edit_json?: Json
          generation_id?: string
          id?: string
          owner_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "builder_edits_generation_id_fkey"
            columns: ["generation_id"]
            isOneToOne: false
            referencedRelation: "builder_generations"
            referencedColumns: ["id"]
          },
        ]
      }
      builder_generations: {
        Row: {
          agent_outputs_json: Json | null
          brief_json: Json
          commerce_tenant_id: string | null
          created_at: string
          final_css: string | null
          final_html: string | null
          final_js: string | null
          id: string
          owner_id: string
          project_id: string
          status: string
        }
        Insert: {
          agent_outputs_json?: Json | null
          brief_json: Json
          commerce_tenant_id?: string | null
          created_at?: string
          final_css?: string | null
          final_html?: string | null
          final_js?: string | null
          id?: string
          owner_id: string
          project_id: string
          status?: string
        }
        Update: {
          agent_outputs_json?: Json | null
          brief_json?: Json
          commerce_tenant_id?: string | null
          created_at?: string
          final_css?: string | null
          final_html?: string | null
          final_js?: string | null
          id?: string
          owner_id?: string
          project_id?: string
          status?: string
        }
        Relationships: [
          {
            foreignKeyName: "builder_generations_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "builder_projects"
            referencedColumns: ["id"]
          },
        ]
      }
      builder_projects: {
        Row: {
          brief_json: Json
          commerce_tenant_id: string | null
          created_at: string
          current_generation_id: string | null
          id: string
          name: string
          owner_id: string
          slug: string
          updated_at: string
        }
        Insert: {
          brief_json?: Json
          commerce_tenant_id?: string | null
          created_at?: string
          current_generation_id?: string | null
          id?: string
          name: string
          owner_id: string
          slug: string
          updated_at?: string
        }
        Update: {
          brief_json?: Json
          commerce_tenant_id?: string | null
          created_at?: string
          current_generation_id?: string | null
          id?: string
          name?: string
          owner_id?: string
          slug?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "builder_projects_current_generation_id_fkey"
            columns: ["current_generation_id"]
            isOneToOne: false
            referencedRelation: "builder_generations"
            referencedColumns: ["id"]
          },
        ]
      }
      builder_publishes: {
        Row: {
          commerce_tenant_id: string | null
          created_at: string
          generation_id: string
          id: string
          owner_id: string
          published_html: string
          published_url: string | null
        }
        Insert: {
          commerce_tenant_id?: string | null
          created_at?: string
          generation_id: string
          id?: string
          owner_id: string
          published_html: string
          published_url?: string | null
        }
        Update: {
          commerce_tenant_id?: string | null
          created_at?: string
          generation_id?: string
          id?: string
          owner_id?: string
          published_html?: string
          published_url?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "builder_publishes_generation_id_fkey"
            columns: ["generation_id"]
            isOneToOne: false
            referencedRelation: "builder_generations"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      [_ in never]: never
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
