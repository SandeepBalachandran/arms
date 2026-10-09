// Hand-written to match supabase/migrations until a database is available.
// Replace with generated types: `npm run db:types` (repo root).

export type Json = string | number | boolean | null | { [key: string]: Json | undefined } | Json[];

type GymRole = "owner" | "admin" | "staff" | "trainer" | "member";
type GymStatus = "pending" | "active" | "suspended";
type MemberStatus = "invited" | "active" | "inactive";

export type Database = {
  public: {
    Tables: {
      profiles: {
        Row: {
          id: string;
          full_name: string;
          phone: string | null;
          avatar_url: string | null;
          is_platform_admin: boolean;
          created_at: string;
        };
        Insert: {
          id: string;
          full_name?: string;
          phone?: string | null;
          avatar_url?: string | null;
          is_platform_admin?: boolean;
          created_at?: string;
        };
        Update: {
          full_name?: string;
          phone?: string | null;
          avatar_url?: string | null;
        };
        Relationships: [];
      };
      gyms: {
        Row: {
          id: string;
          slug: string;
          name: string;
          logo_url: string | null;
          timezone: string;
          currency: string;
          address: string | null;
          phone: string | null;
          status: GymStatus;
          platform_plan: string;
          created_at: string;
        };
        Insert: {
          id?: string;
          slug: string;
          name: string;
          logo_url?: string | null;
          timezone?: string;
          currency?: string;
          address?: string | null;
          phone?: string | null;
          status?: GymStatus;
          platform_plan?: string;
          created_at?: string;
        };
        Update: {
          slug?: string;
          name?: string;
          logo_url?: string | null;
          timezone?: string;
          currency?: string;
          address?: string | null;
          phone?: string | null;
          status?: GymStatus;
          platform_plan?: string;
        };
        Relationships: [];
      };
      gym_secrets: {
        Row: {
          gym_id: string;
          razorpay_key_id: string | null;
          razorpay_key_secret_enc: string | null;
          razorpay_webhook_secret_enc: string | null;
          updated_at: string;
        };
        Insert: {
          gym_id: string;
          razorpay_key_id?: string | null;
          razorpay_key_secret_enc?: string | null;
          razorpay_webhook_secret_enc?: string | null;
          updated_at?: string;
        };
        Update: {
          razorpay_key_id?: string | null;
          razorpay_key_secret_enc?: string | null;
          razorpay_webhook_secret_enc?: string | null;
          updated_at?: string;
        };
        Relationships: [
          { foreignKeyName: "gym_secrets_gym_id_fkey"; columns: ["gym_id"]; isOneToOne: true; referencedRelation: "gyms"; referencedColumns: ["id"] },
        ];
      };
      gym_members: {
        Row: {
          id: string;
          gym_id: string;
          user_id: string;
          role: GymRole;
          status: MemberStatus;
          joined_at: string;
        };
        Insert: {
          id?: string;
          gym_id: string;
          user_id: string;
          role?: GymRole;
          status?: MemberStatus;
          joined_at?: string;
        };
        Update: {
          role?: GymRole;
          status?: MemberStatus;
        };
        Relationships: [
          { foreignKeyName: "gym_members_gym_id_fkey"; columns: ["gym_id"]; isOneToOne: false; referencedRelation: "gyms"; referencedColumns: ["id"] },
          { foreignKeyName: "gym_members_user_id_fkey"; columns: ["user_id"]; isOneToOne: false; referencedRelation: "profiles"; referencedColumns: ["id"] },
        ];
      };
    };
    Views: { [_ in never]: never };
    Functions: {
      auth_role_in: { Args: { p_gym_id: string }; Returns: GymRole };
      is_gym_staff: { Args: { p_gym_id: string }; Returns: boolean };
      is_gym_team: { Args: { p_gym_id: string }; Returns: boolean };
      is_platform_admin: { Args: Record<PropertyKey, never>; Returns: boolean };
      register_gym: { Args: { p_name: string; p_slug: string; p_timezone?: string }; Returns: string };
      join_gym: { Args: { p_slug: string }; Returns: string };
    };
    Enums: {
      gym_role: GymRole;
      gym_status: GymStatus;
      member_status: MemberStatus;
    };
    CompositeTypes: { [_ in never]: never };
  };
};
