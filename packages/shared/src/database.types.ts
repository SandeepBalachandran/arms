
export type Json = string | number | boolean | null | { [key: string]: Json | undefined } | Json[]

export type Database = {
  
  "public": {
          Tables: {
            "app_secrets": {
                  Row: {
                    "name": string,"value": string
                  }
                  ComputedFields: never
                  Insert: {
                    "name": string,"value": string
                  }
                  Update: {
                    "name"?: string,"value"?: string
                  }
                  Relationships: [
                    
                  ]
                },"body_metrics": {
                  Row: {
                    "body_fat_pct": number | null,"created_at": string,"gym_id": string,"id": string,"measured_on": string,"member_id": string,"notes": string | null,"waist_cm": number | null,"weight_kg": number | null
                  }
                  ComputedFields: never
                  Insert: {
                    "body_fat_pct"?: number | null,"created_at"?: string,"gym_id": string,"id"?: string,"measured_on": string,"member_id": string,"notes"?: string | null,"waist_cm"?: number | null,"weight_kg"?: number | null
                  }
                  Update: {
                    "body_fat_pct"?: number | null,"created_at"?: string,"gym_id"?: string,"id"?: string,"measured_on"?: string,"member_id"?: string,"notes"?: string | null,"waist_cm"?: number | null,"weight_kg"?: number | null
                  }
                  Relationships: [
                    {
      foreignKeyName: "body_metrics_gym_id_fkey"
      columns: ["gym_id"]
isOneToOne: false
      referencedRelation: "gyms"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "body_metrics_member_id_fkey"
      columns: ["member_id"]
isOneToOne: false
      referencedRelation: "gym_members"
      referencedColumns: ["id"]
    }
                  ]
                },"checkins": {
                  Row: {
                    "checked_in_at": string,"gym_id": string,"id": string,"member_id": string,"membership_ok": boolean,"method": Database["public"]['Enums']["checkin_method"],"recorded_by": string | null
                  }
                  ComputedFields: never
                  Insert: {
                    "checked_in_at"?: string,"gym_id": string,"id"?: string,"member_id": string,"membership_ok": boolean,"method": Database["public"]['Enums']["checkin_method"],"recorded_by"?: string | null
                  }
                  Update: {
                    "checked_in_at"?: string,"gym_id"?: string,"id"?: string,"member_id"?: string,"membership_ok"?: boolean,"method"?: Database["public"]['Enums']["checkin_method"],"recorded_by"?: string | null
                  }
                  Relationships: [
                    {
      foreignKeyName: "checkins_gym_id_fkey"
      columns: ["gym_id"]
isOneToOne: false
      referencedRelation: "gyms"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "checkins_member_id_fkey"
      columns: ["member_id"]
isOneToOne: false
      referencedRelation: "gym_members"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "checkins_recorded_by_fkey"
      columns: ["recorded_by"]
isOneToOne: false
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    }
                  ]
                },"class_bookings": {
                  Row: {
                    "created_at": string,"gym_id": string,"id": string,"member_id": string,"session_id": string,"status": Database["public"]['Enums']["booking_status"],"updated_at": string,"waitlisted_at": string | null
                  }
                  ComputedFields: never
                  Insert: {
                    "created_at"?: string,"gym_id": string,"id"?: string,"member_id": string,"session_id": string,"status": Database["public"]['Enums']["booking_status"],"updated_at"?: string,"waitlisted_at"?: string | null
                  }
                  Update: {
                    "created_at"?: string,"gym_id"?: string,"id"?: string,"member_id"?: string,"session_id"?: string,"status"?: Database["public"]['Enums']["booking_status"],"updated_at"?: string,"waitlisted_at"?: string | null
                  }
                  Relationships: [
                    {
      foreignKeyName: "class_bookings_gym_id_fkey"
      columns: ["gym_id"]
isOneToOne: false
      referencedRelation: "gyms"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "class_bookings_member_id_fkey"
      columns: ["member_id"]
isOneToOne: false
      referencedRelation: "gym_members"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "class_bookings_session_id_fkey"
      columns: ["session_id"]
isOneToOne: false
      referencedRelation: "class_sessions"
      referencedColumns: ["id"]
    }
                  ]
                },"class_sessions": {
                  Row: {
                    "cancel_reason": string | null,"capacity": number,"class_type_id": string,"created_at": string,"duration_min": number,"gym_id": string,"id": string,"room": string | null,"starts_at": string,"status": Database["public"]['Enums']["session_status"],"trainer_member_id": string | null
                  }
                  ComputedFields: never
                  Insert: {
                    "cancel_reason"?: string | null,"capacity": number,"class_type_id": string,"created_at"?: string,"duration_min": number,"gym_id": string,"id"?: string,"room"?: string | null,"starts_at": string,"status"?: Database["public"]['Enums']["session_status"],"trainer_member_id"?: string | null
                  }
                  Update: {
                    "cancel_reason"?: string | null,"capacity"?: number,"class_type_id"?: string,"created_at"?: string,"duration_min"?: number,"gym_id"?: string,"id"?: string,"room"?: string | null,"starts_at"?: string,"status"?: Database["public"]['Enums']["session_status"],"trainer_member_id"?: string | null
                  }
                  Relationships: [
                    {
      foreignKeyName: "class_sessions_class_type_id_fkey"
      columns: ["class_type_id"]
isOneToOne: false
      referencedRelation: "class_types"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "class_sessions_gym_id_fkey"
      columns: ["gym_id"]
isOneToOne: false
      referencedRelation: "gyms"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "class_sessions_trainer_member_id_fkey"
      columns: ["trainer_member_id"]
isOneToOne: false
      referencedRelation: "gym_members"
      referencedColumns: ["id"]
    }
                  ]
                },"class_types": {
                  Row: {
                    "created_at": string,"default_capacity": number,"default_duration_min": number,"description": string | null,"gym_id": string,"id": string,"is_active": boolean,"name": string
                  }
                  ComputedFields: never
                  Insert: {
                    "created_at"?: string,"default_capacity"?: number,"default_duration_min"?: number,"description"?: string | null,"gym_id": string,"id"?: string,"is_active"?: boolean,"name": string
                  }
                  Update: {
                    "created_at"?: string,"default_capacity"?: number,"default_duration_min"?: number,"description"?: string | null,"gym_id"?: string,"id"?: string,"is_active"?: boolean,"name"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "class_types_gym_id_fkey"
      columns: ["gym_id"]
isOneToOne: false
      referencedRelation: "gyms"
      referencedColumns: ["id"]
    }
                  ]
                },"exercises": {
                  Row: {
                    "created_at": string,"gym_id": string | null,"id": string,"is_active": boolean,"measure": Database["public"]['Enums']["exercise_measure"],"muscle_group": string,"name": string
                  }
                  ComputedFields: never
                  Insert: {
                    "created_at"?: string,"gym_id"?: string | null,"id"?: string,"is_active"?: boolean,"measure"?: Database["public"]['Enums']["exercise_measure"],"muscle_group": string,"name": string
                  }
                  Update: {
                    "created_at"?: string,"gym_id"?: string | null,"id"?: string,"is_active"?: boolean,"measure"?: Database["public"]['Enums']["exercise_measure"],"muscle_group"?: string,"name"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "exercises_gym_id_fkey"
      columns: ["gym_id"]
isOneToOne: false
      referencedRelation: "gyms"
      referencedColumns: ["id"]
    }
                  ]
                },"gym_hidden_exercises": {
                  Row: {
                    "exercise_id": string,"gym_id": string
                  }
                  ComputedFields: never
                  Insert: {
                    "exercise_id": string,"gym_id": string
                  }
                  Update: {
                    "exercise_id"?: string,"gym_id"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "gym_hidden_exercises_exercise_id_fkey"
      columns: ["exercise_id"]
isOneToOne: false
      referencedRelation: "exercises"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "gym_hidden_exercises_gym_id_fkey"
      columns: ["gym_id"]
isOneToOne: false
      referencedRelation: "gyms"
      referencedColumns: ["id"]
    }
                  ]
                },"gym_members": {
                  Row: {
                    "gym_id": string,"id": string,"joined_at": string,"role": Database["public"]['Enums']["gym_role"],"status": Database["public"]['Enums']["member_status"],"user_id": string
                  }
                  ComputedFields: never
                  Insert: {
                    "gym_id": string,"id"?: string,"joined_at"?: string,"role"?: Database["public"]['Enums']["gym_role"],"status"?: Database["public"]['Enums']["member_status"],"user_id": string
                  }
                  Update: {
                    "gym_id"?: string,"id"?: string,"joined_at"?: string,"role"?: Database["public"]['Enums']["gym_role"],"status"?: Database["public"]['Enums']["member_status"],"user_id"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "gym_members_gym_id_fkey"
      columns: ["gym_id"]
isOneToOne: false
      referencedRelation: "gyms"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "gym_members_user_id_fkey"
      columns: ["user_id"]
isOneToOne: false
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    }
                  ]
                },"gym_secrets": {
                  Row: {
                    "gym_id": string,"razorpay_key_id": string | null,"razorpay_key_secret_enc": string | null,"razorpay_webhook_secret_enc": string | null,"updated_at": string
                  }
                  ComputedFields: never
                  Insert: {
                    "gym_id": string,"razorpay_key_id"?: string | null,"razorpay_key_secret_enc"?: string | null,"razorpay_webhook_secret_enc"?: string | null,"updated_at"?: string
                  }
                  Update: {
                    "gym_id"?: string,"razorpay_key_id"?: string | null,"razorpay_key_secret_enc"?: string | null,"razorpay_webhook_secret_enc"?: string | null,"updated_at"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "gym_secrets_gym_id_fkey"
      columns: ["gym_id"]
isOneToOne: true
      referencedRelation: "gyms"
      referencedColumns: ["id"]
    }
                  ]
                },"gyms": {
                  Row: {
                    "address": string | null,"checkin_dedupe_hours": number,"checkin_enabled": boolean,"checkin_self_allowed": boolean,"classes_booking_window_days": number,"classes_cancel_cutoff_hours": number,"classes_enabled": boolean,"classes_require_membership": boolean,"created_at": string,"currency": string,"expiry_warning_days": number,"id": string,"join_requires_approval": boolean,"logo_url": string | null,"manual_payment_methods": (Database["public"]['Enums']["payment_method"])[],"name": string,"phone": string | null,"phone_country_code": string,"platform_plan": string,"receipt_prefix": string,"receipt_seq": number,"renewal_message": string,"slug": string,"status": Database["public"]['Enums']["gym_status"],"timezone": string,"upi_id": string | null,"upi_payee_name": string | null,"workouts_enabled": boolean
                  }
                  ComputedFields: never
                  Insert: {
                    "address"?: string | null,"checkin_dedupe_hours"?: number,"checkin_enabled"?: boolean,"checkin_self_allowed"?: boolean,"classes_booking_window_days"?: number,"classes_cancel_cutoff_hours"?: number,"classes_enabled"?: boolean,"classes_require_membership"?: boolean,"created_at"?: string,"currency"?: string,"expiry_warning_days"?: number,"id"?: string,"join_requires_approval"?: boolean,"logo_url"?: string | null,"manual_payment_methods"?: (Database["public"]['Enums']["payment_method"])[],"name": string,"phone"?: string | null,"phone_country_code"?: string,"platform_plan"?: string,"receipt_prefix"?: string,"receipt_seq"?: number,"renewal_message"?: string,"slug": string,"status"?: Database["public"]['Enums']["gym_status"],"timezone"?: string,"upi_id"?: string | null,"upi_payee_name"?: string | null,"workouts_enabled"?: boolean
                  }
                  Update: {
                    "address"?: string | null,"checkin_dedupe_hours"?: number,"checkin_enabled"?: boolean,"checkin_self_allowed"?: boolean,"classes_booking_window_days"?: number,"classes_cancel_cutoff_hours"?: number,"classes_enabled"?: boolean,"classes_require_membership"?: boolean,"created_at"?: string,"currency"?: string,"expiry_warning_days"?: number,"id"?: string,"join_requires_approval"?: boolean,"logo_url"?: string | null,"manual_payment_methods"?: (Database["public"]['Enums']["payment_method"])[],"name"?: string,"phone"?: string | null,"phone_country_code"?: string,"platform_plan"?: string,"receipt_prefix"?: string,"receipt_seq"?: number,"renewal_message"?: string,"slug"?: string,"status"?: Database["public"]['Enums']["gym_status"],"timezone"?: string,"upi_id"?: string | null,"upi_payee_name"?: string | null,"workouts_enabled"?: boolean
                  }
                  Relationships: [
                    
                  ]
                },"member_notes": {
                  Row: {
                    "author_id": string | null,"body": string,"created_at": string,"gym_id": string,"id": string,"member_id": string
                  }
                  ComputedFields: never
                  Insert: {
                    "author_id"?: string | null,"body": string,"created_at"?: string,"gym_id": string,"id"?: string,"member_id": string
                  }
                  Update: {
                    "author_id"?: string | null,"body"?: string,"created_at"?: string,"gym_id"?: string,"id"?: string,"member_id"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "member_notes_author_id_fkey"
      columns: ["author_id"]
isOneToOne: false
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "member_notes_gym_id_fkey"
      columns: ["gym_id"]
isOneToOne: false
      referencedRelation: "gyms"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "member_notes_member_id_fkey"
      columns: ["member_id"]
isOneToOne: false
      referencedRelation: "gym_members"
      referencedColumns: ["id"]
    }
                  ]
                },"payments": {
                  Row: {
                    "amount_paise": number,"created_at": string,"gym_id": string,"id": string,"member_id": string,"method": Database["public"]['Enums']["payment_method"],"note": string | null,"paid_at": string | null,"plan_id": string | null,"razorpay_order_id": string | null,"razorpay_payment_id": string | null,"receipt_no": number | null,"recorded_by": string | null,"reviewed_at": string | null,"status": Database["public"]['Enums']["payment_status"],"subscription_id": string | null,"utr": string | null
                  }
                  ComputedFields: never
                  Insert: {
                    "amount_paise": number,"created_at"?: string,"gym_id": string,"id"?: string,"member_id": string,"method": Database["public"]['Enums']["payment_method"],"note"?: string | null,"paid_at"?: string | null,"plan_id"?: string | null,"razorpay_order_id"?: string | null,"razorpay_payment_id"?: string | null,"receipt_no"?: number | null,"recorded_by"?: string | null,"reviewed_at"?: string | null,"status"?: Database["public"]['Enums']["payment_status"],"subscription_id"?: string | null,"utr"?: string | null
                  }
                  Update: {
                    "amount_paise"?: number,"created_at"?: string,"gym_id"?: string,"id"?: string,"member_id"?: string,"method"?: Database["public"]['Enums']["payment_method"],"note"?: string | null,"paid_at"?: string | null,"plan_id"?: string | null,"razorpay_order_id"?: string | null,"razorpay_payment_id"?: string | null,"receipt_no"?: number | null,"recorded_by"?: string | null,"reviewed_at"?: string | null,"status"?: Database["public"]['Enums']["payment_status"],"subscription_id"?: string | null,"utr"?: string | null
                  }
                  Relationships: [
                    {
      foreignKeyName: "payments_gym_id_fkey"
      columns: ["gym_id"]
isOneToOne: false
      referencedRelation: "gyms"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "payments_member_id_fkey"
      columns: ["member_id"]
isOneToOne: false
      referencedRelation: "gym_members"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "payments_plan_id_fkey"
      columns: ["plan_id"]
isOneToOne: false
      referencedRelation: "plans"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "payments_recorded_by_fkey"
      columns: ["recorded_by"]
isOneToOne: false
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "payments_subscription_id_fkey"
      columns: ["subscription_id"]
isOneToOne: false
      referencedRelation: "subscriptions"
      referencedColumns: ["id"]
    }
                  ]
                },"plan_assignments": {
                  Row: {
                    "assigned_at": string,"assigned_by": string | null,"gym_id": string,"id": string,"member_id": string,"plan_id": string
                  }
                  ComputedFields: never
                  Insert: {
                    "assigned_at"?: string,"assigned_by"?: string | null,"gym_id": string,"id"?: string,"member_id": string,"plan_id": string
                  }
                  Update: {
                    "assigned_at"?: string,"assigned_by"?: string | null,"gym_id"?: string,"id"?: string,"member_id"?: string,"plan_id"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "plan_assignments_assigned_by_fkey"
      columns: ["assigned_by"]
isOneToOne: false
      referencedRelation: "gym_members"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "plan_assignments_gym_id_fkey"
      columns: ["gym_id"]
isOneToOne: false
      referencedRelation: "gyms"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "plan_assignments_member_id_fkey"
      columns: ["member_id"]
isOneToOne: false
      referencedRelation: "gym_members"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "plan_assignments_plan_id_fkey"
      columns: ["plan_id"]
isOneToOne: false
      referencedRelation: "workout_plans"
      referencedColumns: ["id"]
    }
                  ]
                },"plans": {
                  Row: {
                    "class_credits": number | null,"created_at": string,"description": string | null,"duration_days": number,"gym_id": string,"id": string,"is_active": boolean,"name": string,"price_paise": number,"sort_order": number
                  }
                  ComputedFields: never
                  Insert: {
                    "class_credits"?: number | null,"created_at"?: string,"description"?: string | null,"duration_days": number,"gym_id": string,"id"?: string,"is_active"?: boolean,"name": string,"price_paise": number,"sort_order"?: number
                  }
                  Update: {
                    "class_credits"?: number | null,"created_at"?: string,"description"?: string | null,"duration_days"?: number,"gym_id"?: string,"id"?: string,"is_active"?: boolean,"name"?: string,"price_paise"?: number,"sort_order"?: number
                  }
                  Relationships: [
                    {
      foreignKeyName: "plans_gym_id_fkey"
      columns: ["gym_id"]
isOneToOne: false
      referencedRelation: "gyms"
      referencedColumns: ["id"]
    }
                  ]
                },"profiles": {
                  Row: {
                    "avatar_url": string | null,"created_at": string,"full_name": string,"id": string,"is_platform_admin": boolean,"phone": string | null
                  }
                  ComputedFields: never
                  Insert: {
                    "avatar_url"?: string | null,"created_at"?: string,"full_name"?: string,"id": string,"is_platform_admin"?: boolean,"phone"?: string | null
                  }
                  Update: {
                    "avatar_url"?: string | null,"created_at"?: string,"full_name"?: string,"id"?: string,"is_platform_admin"?: boolean,"phone"?: string | null
                  }
                  Relationships: [
                    
                  ]
                },"subscriptions": {
                  Row: {
                    "cancelled_at": string | null,"created_at": string,"created_by": string | null,"ends_on": string,"gym_id": string,"id": string,"member_id": string,"plan_id": string | null,"plan_name": string,"price_paise": number,"starts_on": string,"status": Database["public"]['Enums']["subscription_status"]
                  }
                  ComputedFields: never
                  Insert: {
                    "cancelled_at"?: string | null,"created_at"?: string,"created_by"?: string | null,"ends_on": string,"gym_id": string,"id"?: string,"member_id": string,"plan_id"?: string | null,"plan_name": string,"price_paise": number,"starts_on": string,"status"?: Database["public"]['Enums']["subscription_status"]
                  }
                  Update: {
                    "cancelled_at"?: string | null,"created_at"?: string,"created_by"?: string | null,"ends_on"?: string,"gym_id"?: string,"id"?: string,"member_id"?: string,"plan_id"?: string | null,"plan_name"?: string,"price_paise"?: number,"starts_on"?: string,"status"?: Database["public"]['Enums']["subscription_status"]
                  }
                  Relationships: [
                    {
      foreignKeyName: "subscriptions_created_by_fkey"
      columns: ["created_by"]
isOneToOne: false
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "subscriptions_gym_id_fkey"
      columns: ["gym_id"]
isOneToOne: false
      referencedRelation: "gyms"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "subscriptions_member_id_fkey"
      columns: ["member_id"]
isOneToOne: false
      referencedRelation: "gym_members"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "subscriptions_plan_id_fkey"
      columns: ["plan_id"]
isOneToOne: false
      referencedRelation: "plans"
      referencedColumns: ["id"]
    }
                  ]
                },"workout_log_sets": {
                  Row: {
                    "duration_sec": number | null,"exercise_id": string,"id": string,"log_id": string,"reps": number | null,"set_no": number,"weight_kg": number | null
                  }
                  ComputedFields: never
                  Insert: {
                    "duration_sec"?: number | null,"exercise_id": string,"id"?: string,"log_id": string,"reps"?: number | null,"set_no": number,"weight_kg"?: number | null
                  }
                  Update: {
                    "duration_sec"?: number | null,"exercise_id"?: string,"id"?: string,"log_id"?: string,"reps"?: number | null,"set_no"?: number,"weight_kg"?: number | null
                  }
                  Relationships: [
                    {
      foreignKeyName: "workout_log_sets_exercise_id_fkey"
      columns: ["exercise_id"]
isOneToOne: false
      referencedRelation: "exercises"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "workout_log_sets_log_id_fkey"
      columns: ["log_id"]
isOneToOne: false
      referencedRelation: "workout_logs"
      referencedColumns: ["id"]
    }
                  ]
                },"workout_logs": {
                  Row: {
                    "day_label": string | null,"duration_min": number | null,"gym_id": string,"id": string,"member_id": string,"notes": string | null,"performed_at": string,"plan_id": string | null
                  }
                  ComputedFields: never
                  Insert: {
                    "day_label"?: string | null,"duration_min"?: number | null,"gym_id": string,"id"?: string,"member_id": string,"notes"?: string | null,"performed_at"?: string,"plan_id"?: string | null
                  }
                  Update: {
                    "day_label"?: string | null,"duration_min"?: number | null,"gym_id"?: string,"id"?: string,"member_id"?: string,"notes"?: string | null,"performed_at"?: string,"plan_id"?: string | null
                  }
                  Relationships: [
                    {
      foreignKeyName: "workout_logs_gym_id_fkey"
      columns: ["gym_id"]
isOneToOne: false
      referencedRelation: "gyms"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "workout_logs_member_id_fkey"
      columns: ["member_id"]
isOneToOne: false
      referencedRelation: "gym_members"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "workout_logs_plan_id_fkey"
      columns: ["plan_id"]
isOneToOne: false
      referencedRelation: "workout_plans"
      referencedColumns: ["id"]
    }
                  ]
                },"workout_plan_items": {
                  Row: {
                    "day_label": string,"exercise_id": string,"id": string,"notes": string | null,"plan_id": string,"position": number,"reps": string,"rest_sec": number | null,"sets": number
                  }
                  ComputedFields: never
                  Insert: {
                    "day_label": string,"exercise_id": string,"id"?: string,"notes"?: string | null,"plan_id": string,"position"?: number,"reps": string,"rest_sec"?: number | null,"sets": number
                  }
                  Update: {
                    "day_label"?: string,"exercise_id"?: string,"id"?: string,"notes"?: string | null,"plan_id"?: string,"position"?: number,"reps"?: string,"rest_sec"?: number | null,"sets"?: number
                  }
                  Relationships: [
                    {
      foreignKeyName: "workout_plan_items_exercise_id_fkey"
      columns: ["exercise_id"]
isOneToOne: false
      referencedRelation: "exercises"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "workout_plan_items_plan_id_fkey"
      columns: ["plan_id"]
isOneToOne: false
      referencedRelation: "workout_plans"
      referencedColumns: ["id"]
    }
                  ]
                },"workout_plans": {
                  Row: {
                    "created_at": string,"created_by": string | null,"description": string | null,"gym_id": string,"id": string,"is_archived": boolean,"name": string
                  }
                  ComputedFields: never
                  Insert: {
                    "created_at"?: string,"created_by"?: string | null,"description"?: string | null,"gym_id": string,"id"?: string,"is_archived"?: boolean,"name": string
                  }
                  Update: {
                    "created_at"?: string,"created_by"?: string | null,"description"?: string | null,"gym_id"?: string,"id"?: string,"is_archived"?: boolean,"name"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "workout_plans_created_by_fkey"
      columns: ["created_by"]
isOneToOne: false
      referencedRelation: "gym_members"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "workout_plans_gym_id_fkey"
      columns: ["gym_id"]
isOneToOne: false
      referencedRelation: "gyms"
      referencedColumns: ["id"]
    }
                  ]
                }
          }
          Views: {
            [_ in never]: never
          }
          Functions: {
            "auth_role_in":
{ Args: { "p_gym_id": string }; Returns: Database["public"]['Enums']["gym_role"]
                           },
"book_class":
{ Args: { "p_session_id": string }; Returns: Database["public"]['Enums']["booking_status"]
                           },
"cancel_booking":
{ Args: { "p_booking_id": string }; Returns: undefined
                           },
"cancel_class_session":
{ Args: { "p_reason"?: string,"p_session_id": string }; Returns: undefined
                           },
"cancel_subscription":
{ Args: { "p_subscription_id": string }; Returns: undefined
                           },
"check_in_by_token":
{ Args: { "p_token": string }; Returns: Json
                           },
"checkin_signature":
{ Args: { "p_payload": string }; Returns: string
                           },
"claim_upi_payment":
{ Args: { "p_gym_id": string,"p_plan_id": string,"p_utr"?: string }; Returns: string
                           },
"class_schedule":
{ Args: { "p_from": string,"p_gym_id": string,"p_to": string }; Returns: {
              "booked_count": number,"cancel_reason": string,"capacity": number,"class_name": string,"class_type_id": string,"description": string,"duration_min": number,"id": string,"my_booking_id": string,"my_status": Database["public"]['Enums']["booking_status"],"room": string,"starts_at": string,"status": Database["public"]['Enums']["session_status"],"trainer_name": string,"waitlist_count": number
            }[]
                           },
"confirm_upi_payment":
{ Args: { "p_payment_id": string,"p_starts_on"?: string }; Returns: string
                           },
"create_class_series":
{ Args: { "p_capacity"?: number,"p_class_type_id": string,"p_duration_min"?: number,"p_local_time": string,"p_room"?: string,"p_start_date": string,"p_trainer_member_id"?: string,"p_weekdays": (number)[],"p_weeks": number }; Returns: number
                           },
"expire_subscriptions":
{ Args: Record<PropertyKey, never>; Returns: number
                           },
"find_user_id":
{ Args: { "p_email"?: string,"p_phone"?: string }; Returns: string
                           },
"gym_today":
{ Args: { "p_gym_id": string }; Returns: string
                           },
"is_assigned_plan":
{ Args: { "p_plan_id": string }; Returns: boolean
                           },
"is_gym_staff":
{ Args: { "p_gym_id": string }; Returns: boolean
                           },
"is_gym_team":
{ Args: { "p_gym_id": string }; Returns: boolean
                           },
"is_my_log":
{ Args: { "p_log_id": string }; Returns: boolean
                           },
"is_my_membership":
{ Args: { "p_member_id": string }; Returns: boolean
                           },
"is_platform_admin":
{ Args: Record<PropertyKey, never>; Returns: boolean
                           },
"issue_checkin_token":
{ Args: { "p_gym_id": string }; Returns: string
                           },
"join_gym":
{ Args: { "p_slug": string }; Returns: string
                           },
"log_gym_id":
{ Args: { "p_log_id": string }; Returns: string
                           },
"mark_attendance":
{ Args: { "p_attended": boolean,"p_booking_id": string }; Returns: undefined
                           },
"plan_gym_id":
{ Args: { "p_plan_id": string }; Returns: string
                           },
"record_checkin":
{ Args: { "p_member_id": string,"p_method": Database["public"]['Enums']["checkin_method"] }; Returns: Json
                           },
"record_manual_payment":
{ Args: { "p_amount_paise"?: number,"p_member_id": string,"p_method": Database["public"]['Enums']["payment_method"],"p_note"?: string,"p_plan_id": string,"p_starts_on"?: string }; Returns: string
                           },
"register_gym":
{ Args: { "p_name": string,"p_slug": string,"p_timezone"?: string }; Returns: string
                           },
"reject_upi_payment":
{ Args: { "p_payment_id": string,"p_reason"?: string }; Returns: undefined
                           },
"review_join_request":
{ Args: { "p_approve": boolean,"p_member_id": string }; Returns: undefined
                           },
"self_check_in":
{ Args: { "p_gym_id": string }; Returns: Json
                           },
"staff_check_in":
{ Args: { "p_member_id": string }; Returns: Json
                           },
"start_subscription":
{ Args: { "p_member_id": string,"p_plan_id": string,"p_starts_on"?: string }; Returns: string
                           },
"withdraw_upi_payment":
{ Args: { "p_payment_id": string }; Returns: undefined
                           }
          }
          Enums: {
            "booking_status": "booked"|"waitlisted"|"cancelled"|"attended"|"no_show","checkin_method": "self"|"scan"|"manual","exercise_measure": "weight_reps"|"reps"|"time","gym_role": "owner"|"admin"|"staff"|"trainer"|"member","gym_status": "pending"|"active"|"suspended","member_status": "invited"|"active"|"inactive"|"pending","payment_method": "online"|"cash"|"upi"|"card"|"bank_transfer","payment_status": "created"|"paid"|"failed"|"refunded","session_status": "scheduled"|"cancelled","subscription_status": "active"|"cancelled"|"expired"
          }
          CompositeTypes: {
            [_ in never]: never
          }
        }
}

type DatabaseWithoutInternals = Omit<Database, '__InternalSupabase'>

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
    : never = never
> = DefaultSchemaTableNameOrOptions extends { schema: keyof DatabaseWithoutInternals }
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
  ? (DefaultSchema["Tables"] & DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
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
    : never = never
> = DefaultSchemaTableNameOrOptions extends { schema: keyof DatabaseWithoutInternals }
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
    : never = never
> = DefaultSchemaTableNameOrOptions extends { schema: keyof DatabaseWithoutInternals }
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
    : never = never
> = DefaultSchemaEnumNameOrOptions extends { schema: keyof DatabaseWithoutInternals }
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
    : never = never
> = PublicCompositeTypeNameOrOptions extends { schema: keyof DatabaseWithoutInternals }
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
  ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
  : never

export const Constants = {
  "public": {
          Enums: {
            "booking_status": ["booked", "waitlisted", "cancelled", "attended", "no_show"],"checkin_method": ["self", "scan", "manual"],"exercise_measure": ["weight_reps", "reps", "time"],"gym_role": ["owner", "admin", "staff", "trainer", "member"],"gym_status": ["pending", "active", "suspended"],"member_status": ["invited", "active", "inactive", "pending"],"payment_method": ["online", "cash", "upi", "card", "bank_transfer"],"payment_status": ["created", "paid", "failed", "refunded"],"session_status": ["scheduled", "cancelled"],"subscription_status": ["active", "cancelled", "expired"]
          }
        }
} as const
