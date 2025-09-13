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
    PostgrestVersion: "12.2.12 (cd3cf9e)"
  }
  public: {
    Tables: {
      account_balances: {
        Row: {
          account_status: string | null
          account_type: string | null
          balance: number | null
          id: string
          last_activity: string | null
          notes: string | null
          platform: string | null
          user_id: string
        }
        Insert: {
          account_status?: string | null
          account_type?: string | null
          balance?: number | null
          id?: string
          last_activity?: string | null
          notes?: string | null
          platform?: string | null
          user_id: string
        }
        Update: {
          account_status?: string | null
          account_type?: string | null
          balance?: number | null
          id?: string
          last_activity?: string | null
          notes?: string | null
          platform?: string | null
          user_id?: string
        }
        Relationships: []
      }
      accounts: {
        Row: {
          account_type: string | null
          apy: number | null
          avg_amount: number | null
          balance: number | null
          cadence: string | null
          confidence: number | null
          goal_target_value: number | null
          goal_type: string | null
          growth_12mo: number | null
          id: string
          last_charge: string | null
          merchant_display: string | null
          merchant_slug: string | null
          name: string | null
          next_estimated: string | null
          plaid_account_id: string | null
          unused_score: number | null
          user_id: string | null
        }
        Insert: {
          account_type?: string | null
          apy?: number | null
          avg_amount?: number | null
          balance?: number | null
          cadence?: string | null
          confidence?: number | null
          goal_target_value?: number | null
          goal_type?: string | null
          growth_12mo?: number | null
          id?: string
          last_charge?: string | null
          merchant_display?: string | null
          merchant_slug?: string | null
          name?: string | null
          next_estimated?: string | null
          plaid_account_id?: string | null
          unused_score?: number | null
          user_id?: string | null
        }
        Update: {
          account_type?: string | null
          apy?: number | null
          avg_amount?: number | null
          balance?: number | null
          cadence?: string | null
          confidence?: number | null
          goal_target_value?: number | null
          goal_type?: string | null
          growth_12mo?: number | null
          id?: string
          last_charge?: string | null
          merchant_display?: string | null
          merchant_slug?: string | null
          name?: string | null
          next_estimated?: string | null
          plaid_account_id?: string | null
          unused_score?: number | null
          user_id?: string | null
        }
        Relationships: []
      }
      bank_connections: {
        Row: {
          access_token: string | null
          created_at: string | null
          id: string
          institution_id: string
          institution_name: string
          is_test: boolean | null
          user_id: string | null
        }
        Insert: {
          access_token?: string | null
          created_at?: string | null
          id?: string
          institution_id: string
          institution_name: string
          is_test?: boolean | null
          user_id?: string | null
        }
        Update: {
          access_token?: string | null
          created_at?: string | null
          id?: string
          institution_id?: string
          institution_name?: string
          is_test?: boolean | null
          user_id?: string | null
        }
        Relationships: []
      }
      email_change_codes: {
        Row: {
          code: string
          created_at: string | null
          expires_at: string
          new_email: string
          old_email: string
          user_id: string
        }
        Insert: {
          code: string
          created_at?: string | null
          expires_at: string
          new_email: string
          old_email: string
          user_id: string
        }
        Update: {
          code?: string
          created_at?: string | null
          expires_at?: string
          new_email?: string
          old_email?: string
          user_id?: string
        }
        Relationships: []
      }
      idle_cash_recommendations_v2: {
        Row: {
          balance: number | null
          created_at: string
          days_idle: number | null
          estimated_yearly_gain: number | null
          id: number
          is_idle: boolean | null
          platform: string | null
          status: string | null
          target_account: string | null
          user_id: string | null
        }
        Insert: {
          balance?: number | null
          created_at?: string
          days_idle?: number | null
          estimated_yearly_gain?: number | null
          id?: number
          is_idle?: boolean | null
          platform?: string | null
          status?: string | null
          target_account?: string | null
          user_id?: string | null
        }
        Update: {
          balance?: number | null
          created_at?: string
          days_idle?: number | null
          estimated_yearly_gain?: number | null
          id?: number
          is_idle?: boolean | null
          platform?: string | null
          status?: string | null
          target_account?: string | null
          user_id?: string | null
        }
        Relationships: []
      }
      money_actions: {
        Row: {
          action: string
          created_at: string | null
          details: Json | null
          id: string
          status: string | null
          user_id: string | null
        }
        Insert: {
          action: string
          created_at?: string | null
          details?: Json | null
          id?: string
          status?: string | null
          user_id?: string | null
        }
        Update: {
          action?: string
          created_at?: string | null
          details?: Json | null
          id?: string
          status?: string | null
          user_id?: string | null
        }
        Relationships: []
      }
      recurring_series: {
        Row: {
          avg_amount: number
          cadence: string
          confidence: number
          created_at: string | null
          features: Json | null
          id: string
          last_charge: string
          merchant_display: string
          merchant_slug: string
          next_estimated: string | null
          user_id: string
        }
        Insert: {
          avg_amount: number
          cadence: string
          confidence: number
          created_at?: string | null
          features?: Json | null
          id?: string
          last_charge: string
          merchant_display: string
          merchant_slug: string
          next_estimated?: string | null
          user_id: string
        }
        Update: {
          avg_amount?: number
          cadence?: string
          confidence?: number
          created_at?: string | null
          features?: Json | null
          id?: string
          last_charge?: string
          merchant_display?: string
          merchant_slug?: string
          next_estimated?: string | null
          user_id?: string
        }
        Relationships: []
      }
      signups: {
        Row: {
          created_at: string
          email: string | null
          id: string
          lifetime_free: string | null
          marketing_opt_in: boolean | null
          source: string | null
        }
        Insert: {
          created_at?: string
          email?: string | null
          id?: string
          lifetime_free?: string | null
          marketing_opt_in?: boolean | null
          source?: string | null
        }
        Update: {
          created_at?: string
          email?: string | null
          id?: string
          lifetime_free?: string | null
          marketing_opt_in?: boolean | null
          source?: string | null
        }
        Relationships: []
      }
      subscription_actions: {
        Row: {
          action: string
          created_at: string | null
          details: Json | null
          id: string
          subscription_id: string
          user_id: string
        }
        Insert: {
          action: string
          created_at?: string | null
          details?: Json | null
          id?: string
          subscription_id: string
          user_id: string
        }
        Update: {
          action?: string
          created_at?: string | null
          details?: Json | null
          id?: string
          subscription_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "subscription_actions_subscription_id_fkey"
            columns: ["subscription_id"]
            isOneToOne: false
            referencedRelation: "subscriptions"
            referencedColumns: ["id"]
          },
        ]
      }
      subscriptions: {
        Row: {
          amount: number | null
          cancel_method: string | null
          cancel_payload: Json | null
          cancel_to: string | null
          canceled_at: string | null
          id: string
          interval: string | null
          last_checked: string | null
          merchant: string | null
          merchant_id: string | null
          merchant_name: string | null
          recurring_id: string | null
          status: string
          unused_score: number
          updated_at: string | null
          user_id: string
        }
        Insert: {
          amount?: number | null
          cancel_method?: string | null
          cancel_payload?: Json | null
          cancel_to?: string | null
          canceled_at?: string | null
          id?: string
          interval?: string | null
          last_checked?: string | null
          merchant?: string | null
          merchant_id?: string | null
          merchant_name?: string | null
          recurring_id?: string | null
          status?: string
          unused_score?: number
          updated_at?: string | null
          user_id: string
        }
        Update: {
          amount?: number | null
          cancel_method?: string | null
          cancel_payload?: Json | null
          cancel_to?: string | null
          canceled_at?: string | null
          id?: string
          interval?: string | null
          last_checked?: string | null
          merchant?: string | null
          merchant_id?: string | null
          merchant_name?: string | null
          recurring_id?: string | null
          status?: string
          unused_score?: number
          updated_at?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "subscriptions_recurring_id_fkey"
            columns: ["recurring_id"]
            isOneToOne: false
            referencedRelation: "recurring_series"
            referencedColumns: ["id"]
          },
        ]
      }
      transaction_overrides: {
        Row: {
          category: string | null
          created_at: string | null
          id: string
          notes: string | null
          transaction_id: string
          user_id: string
        }
        Insert: {
          category?: string | null
          created_at?: string | null
          id?: string
          notes?: string | null
          transaction_id: string
          user_id: string
        }
        Update: {
          category?: string | null
          created_at?: string | null
          id?: string
          notes?: string | null
          transaction_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "transaction_overrides_transaction_id_fkey"
            columns: ["transaction_id"]
            isOneToOne: false
            referencedRelation: "transactions"
            referencedColumns: ["id"]
          },
        ]
      }
      transactions: {
        Row: {
          account_id: string
          amount: number
          created_at: string | null
          date: string
          id: string
          iso_currency_code: string | null
          merchant_name: string | null
          name: string
          pending: boolean | null
          plaid_transaction_id: string
          raw_name: string | null
          user_id: string
          vendor_id: string | null
        }
        Insert: {
          account_id: string
          amount: number
          created_at?: string | null
          date: string
          id?: string
          iso_currency_code?: string | null
          merchant_name?: string | null
          name: string
          pending?: boolean | null
          plaid_transaction_id: string
          raw_name?: string | null
          user_id: string
          vendor_id?: string | null
        }
        Update: {
          account_id?: string
          amount?: number
          created_at?: string | null
          date?: string
          id?: string
          iso_currency_code?: string | null
          merchant_name?: string | null
          name?: string
          pending?: boolean | null
          plaid_transaction_id?: string
          raw_name?: string | null
          user_id?: string
          vendor_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "transactions_account_id_fkey"
            columns: ["account_id"]
            isOneToOne: false
            referencedRelation: "accounts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "transactions_vendor_id_fkey"
            columns: ["vendor_id"]
            isOneToOne: false
            referencedRelation: "vendors"
            referencedColumns: ["id"]
          },
        ]
      }
      vendors: {
        Row: {
          cancel_url: string | null
          category: string | null
          created_at: string | null
          display_name: string
          id: string
          normalized_name: string
          website: string | null
        }
        Insert: {
          cancel_url?: string | null
          category?: string | null
          created_at?: string | null
          display_name: string
          id?: string
          normalized_name: string
          website?: string | null
        }
        Update: {
          cancel_url?: string | null
          category?: string | null
          created_at?: string | null
          display_name?: string
          id?: string
          normalized_name?: string
          website?: string | null
        }
        Relationships: []
      }
      wealth_actions: {
        Row: {
          action: string | null
          created_at: string
          id: string
          user_id: string | null
        }
        Insert: {
          action?: string | null
          created_at?: string
          id?: string
          user_id?: string | null
        }
        Update: {
          action?: string | null
          created_at?: string
          id?: string
          user_id?: string | null
        }
        Relationships: []
      }
    }
    Views: {
      idle_cash_recommendations: {
        Row: {
          balance: number | null
          days_idle: number | null
          estimated_yearly_gain: number | null
          is_idle: boolean | null
          platform: string | null
          user_id: string | null
        }
        Insert: {
          balance?: number | null
          days_idle?: never
          estimated_yearly_gain?: never
          is_idle?: never
          platform?: string | null
          user_id?: string | null
        }
        Update: {
          balance?: number | null
          days_idle?: never
          estimated_yearly_gain?: never
          is_idle?: never
          platform?: string | null
          user_id?: string | null
        }
        Relationships: []
      }
      user_bank_overview: {
        Row: {
          action: string | null
          action_time: string | null
          bank_connection_id: string | null
          connected_at: string | null
          institution_id: string | null
          institution_name: string | null
          is_test: boolean | null
          status: string | null
          user_id: string | null
        }
        Relationships: []
      }
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
