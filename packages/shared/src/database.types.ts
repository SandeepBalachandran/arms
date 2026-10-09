// Hand-written to match supabase/migrations until a database is available.
// Replace with generated types: `npm run db:types` (repo root).

export type Json = string | number | boolean | null | { [key: string]: Json | undefined } | Json[];

type GymRole = "owner" | "admin" | "staff" | "trainer" | "member";
type GymStatus = "pending" | "active" | "suspended";
type MemberStatus = "invited" | "active" | "inactive";
type SubscriptionStatus = "active" | "cancelled" | "expired";
type PaymentMethod = "online" | "cash" | "upi" | "card" | "bank_transfer";
type PaymentStatus = "created" | "paid" | "failed" | "refunded";
type CheckinMethod = "self" | "scan" | "manual";
type SessionStatus = "scheduled" | "cancelled";
type BookingStatus = "booked" | "waitlisted" | "cancelled" | "attended" | "no_show";

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
          receipt_seq: number;
          upi_id: string | null;
          upi_payee_name: string | null;
          checkin_enabled: boolean;
          classes_enabled: boolean;
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
          upi_id?: string | null;
          upi_payee_name?: string | null;
          checkin_enabled?: boolean;
          classes_enabled?: boolean;
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
          upi_id?: string | null;
          upi_payee_name?: string | null;
          checkin_enabled?: boolean;
          classes_enabled?: boolean;
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
      plans: {
        Row: {
          id: string;
          gym_id: string;
          name: string;
          description: string | null;
          price_paise: number;
          duration_days: number;
          class_credits: number | null;
          is_active: boolean;
          sort_order: number;
          created_at: string;
        };
        Insert: {
          id?: string;
          gym_id: string;
          name: string;
          description?: string | null;
          price_paise: number;
          duration_days: number;
          class_credits?: number | null;
          is_active?: boolean;
          sort_order?: number;
          created_at?: string;
        };
        Update: {
          name?: string;
          description?: string | null;
          price_paise?: number;
          duration_days?: number;
          class_credits?: number | null;
          is_active?: boolean;
          sort_order?: number;
        };
        Relationships: [
          { foreignKeyName: "plans_gym_id_fkey"; columns: ["gym_id"]; isOneToOne: false; referencedRelation: "gyms"; referencedColumns: ["id"] },
        ];
      };
      subscriptions: {
        Row: {
          id: string;
          gym_id: string;
          member_id: string;
          plan_id: string | null;
          plan_name: string;
          price_paise: number;
          starts_on: string;
          ends_on: string;
          status: SubscriptionStatus;
          cancelled_at: string | null;
          created_by: string | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          gym_id: string;
          member_id: string;
          plan_id?: string | null;
          plan_name: string;
          price_paise: number;
          starts_on: string;
          ends_on: string;
          status?: SubscriptionStatus;
          cancelled_at?: string | null;
          created_by?: string | null;
          created_at?: string;
        };
        Update: {
          status?: SubscriptionStatus;
          cancelled_at?: string | null;
        };
        Relationships: [
          { foreignKeyName: "subscriptions_gym_id_fkey"; columns: ["gym_id"]; isOneToOne: false; referencedRelation: "gyms"; referencedColumns: ["id"] },
          { foreignKeyName: "subscriptions_member_id_fkey"; columns: ["member_id"]; isOneToOne: false; referencedRelation: "gym_members"; referencedColumns: ["id"] },
          { foreignKeyName: "subscriptions_plan_id_fkey"; columns: ["plan_id"]; isOneToOne: false; referencedRelation: "plans"; referencedColumns: ["id"] },
        ];
      };
      payments: {
        Row: {
          id: string;
          gym_id: string;
          member_id: string;
          subscription_id: string | null;
          amount_paise: number;
          method: PaymentMethod;
          status: PaymentStatus;
          receipt_no: number | null;
          razorpay_order_id: string | null;
          razorpay_payment_id: string | null;
          note: string | null;
          paid_at: string | null;
          recorded_by: string | null;
          plan_id: string | null;
          utr: string | null;
          reviewed_at: string | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          gym_id: string;
          member_id: string;
          subscription_id?: string | null;
          plan_id?: string | null;
          utr?: string | null;
          reviewed_at?: string | null;
          amount_paise: number;
          method: PaymentMethod;
          status?: PaymentStatus;
          receipt_no?: number | null;
          razorpay_order_id?: string | null;
          razorpay_payment_id?: string | null;
          note?: string | null;
          paid_at?: string | null;
          recorded_by?: string | null;
          created_at?: string;
        };
        Update: {
          status?: PaymentStatus;
          razorpay_payment_id?: string | null;
          paid_at?: string | null;
        };
        Relationships: [
          { foreignKeyName: "payments_gym_id_fkey"; columns: ["gym_id"]; isOneToOne: false; referencedRelation: "gyms"; referencedColumns: ["id"] },
          { foreignKeyName: "payments_member_id_fkey"; columns: ["member_id"]; isOneToOne: false; referencedRelation: "gym_members"; referencedColumns: ["id"] },
          { foreignKeyName: "payments_subscription_id_fkey"; columns: ["subscription_id"]; isOneToOne: false; referencedRelation: "subscriptions"; referencedColumns: ["id"] },
          { foreignKeyName: "payments_recorded_by_fkey"; columns: ["recorded_by"]; isOneToOne: false; referencedRelation: "profiles"; referencedColumns: ["id"] },
          { foreignKeyName: "payments_plan_id_fkey"; columns: ["plan_id"]; isOneToOne: false; referencedRelation: "plans"; referencedColumns: ["id"] },
        ];
      };
      checkins: {
        Row: {
          id: string;
          gym_id: string;
          member_id: string;
          checked_in_at: string;
          method: CheckinMethod;
          membership_ok: boolean;
          recorded_by: string | null;
        };
        Insert: never;
        Update: never;
        Relationships: [
          { foreignKeyName: "checkins_gym_id_fkey"; columns: ["gym_id"]; isOneToOne: false; referencedRelation: "gyms"; referencedColumns: ["id"] },
          { foreignKeyName: "checkins_member_id_fkey"; columns: ["member_id"]; isOneToOne: false; referencedRelation: "gym_members"; referencedColumns: ["id"] },
        ];
      };
      class_types: {
        Row: {
          id: string;
          gym_id: string;
          name: string;
          description: string | null;
          default_capacity: number;
          default_duration_min: number;
          is_active: boolean;
          created_at: string;
        };
        Insert: {
          id?: string;
          gym_id: string;
          name: string;
          description?: string | null;
          default_capacity?: number;
          default_duration_min?: number;
          is_active?: boolean;
          created_at?: string;
        };
        Update: {
          name?: string;
          description?: string | null;
          default_capacity?: number;
          default_duration_min?: number;
          is_active?: boolean;
        };
        Relationships: [
          { foreignKeyName: "class_types_gym_id_fkey"; columns: ["gym_id"]; isOneToOne: false; referencedRelation: "gyms"; referencedColumns: ["id"] },
        ];
      };
      class_sessions: {
        Row: {
          id: string;
          gym_id: string;
          class_type_id: string;
          trainer_member_id: string | null;
          starts_at: string;
          duration_min: number;
          capacity: number;
          room: string | null;
          status: SessionStatus;
          cancel_reason: string | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          gym_id: string;
          class_type_id: string;
          trainer_member_id?: string | null;
          starts_at: string;
          duration_min: number;
          capacity: number;
          room?: string | null;
          status?: SessionStatus;
          cancel_reason?: string | null;
          created_at?: string;
        };
        Update: {
          trainer_member_id?: string | null;
          starts_at?: string;
          duration_min?: number;
          capacity?: number;
          room?: string | null;
        };
        Relationships: [
          { foreignKeyName: "class_sessions_gym_id_fkey"; columns: ["gym_id"]; isOneToOne: false; referencedRelation: "gyms"; referencedColumns: ["id"] },
          { foreignKeyName: "class_sessions_class_type_id_fkey"; columns: ["class_type_id"]; isOneToOne: false; referencedRelation: "class_types"; referencedColumns: ["id"] },
          { foreignKeyName: "class_sessions_trainer_member_id_fkey"; columns: ["trainer_member_id"]; isOneToOne: false; referencedRelation: "gym_members"; referencedColumns: ["id"] },
        ];
      };
      class_bookings: {
        Row: {
          id: string;
          gym_id: string;
          session_id: string;
          member_id: string;
          status: BookingStatus;
          waitlisted_at: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: never;
        Update: never;
        Relationships: [
          { foreignKeyName: "class_bookings_gym_id_fkey"; columns: ["gym_id"]; isOneToOne: false; referencedRelation: "gyms"; referencedColumns: ["id"] },
          { foreignKeyName: "class_bookings_session_id_fkey"; columns: ["session_id"]; isOneToOne: false; referencedRelation: "class_sessions"; referencedColumns: ["id"] },
          { foreignKeyName: "class_bookings_member_id_fkey"; columns: ["member_id"]; isOneToOne: false; referencedRelation: "gym_members"; referencedColumns: ["id"] },
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
      is_my_membership: { Args: { p_member_id: string }; Returns: boolean };
      gym_today: { Args: { p_gym_id: string }; Returns: string };
      record_manual_payment: {
        Args: {
          p_member_id: string;
          p_plan_id: string;
          p_method: PaymentMethod;
          p_starts_on?: string;
          p_amount_paise?: number;
          p_note?: string;
        };
        Returns: string;
      };
      cancel_subscription: { Args: { p_subscription_id: string }; Returns: undefined };
      claim_upi_payment: { Args: { p_gym_id: string; p_plan_id: string; p_utr?: string }; Returns: string };
      withdraw_upi_payment: { Args: { p_payment_id: string }; Returns: undefined };
      confirm_upi_payment: { Args: { p_payment_id: string; p_starts_on?: string }; Returns: string };
      reject_upi_payment: { Args: { p_payment_id: string; p_reason?: string }; Returns: undefined };
      self_check_in: { Args: { p_gym_id: string }; Returns: Json };
      issue_checkin_token: { Args: { p_gym_id: string }; Returns: string };
      check_in_by_token: { Args: { p_token: string }; Returns: Json };
      staff_check_in: { Args: { p_member_id: string }; Returns: Json };
      class_schedule: {
        Args: { p_gym_id: string; p_from: string; p_to: string };
        Returns: {
          id: string;
          class_type_id: string;
          class_name: string;
          description: string | null;
          trainer_name: string | null;
          starts_at: string;
          duration_min: number;
          capacity: number;
          room: string | null;
          status: SessionStatus;
          cancel_reason: string | null;
          booked_count: number;
          waitlist_count: number;
          my_booking_id: string | null;
          my_status: BookingStatus | null;
        }[];
      };
      create_class_series: {
        Args: {
          p_class_type_id: string;
          p_weekdays: number[];
          p_local_time: string;
          p_start_date: string;
          p_weeks: number;
          p_trainer_member_id?: string;
          p_capacity?: number;
          p_duration_min?: number;
          p_room?: string;
        };
        Returns: number;
      };
      book_class: { Args: { p_session_id: string }; Returns: BookingStatus };
      cancel_booking: { Args: { p_booking_id: string }; Returns: undefined };
      cancel_class_session: { Args: { p_session_id: string; p_reason?: string }; Returns: undefined };
      mark_attendance: { Args: { p_booking_id: string; p_attended: boolean }; Returns: undefined };
    };
    Enums: {
      gym_role: GymRole;
      gym_status: GymStatus;
      member_status: MemberStatus;
      subscription_status: SubscriptionStatus;
      payment_method: PaymentMethod;
      payment_status: PaymentStatus;
      checkin_method: CheckinMethod;
      session_status: SessionStatus;
      booking_status: BookingStatus;
    };
    CompositeTypes: { [_ in never]: never };
  };
};
