import type { Database } from "./database.types";
import type { GymRole } from "./gyms";

// Roles & permissions. The database decides (has_permission, default_permission
// in the roles_permissions migration); this file only names and groups the
// permissions for the owner's grid and the apps' "can I?" checks.

type GymRow = Database["public"]["Tables"]["gyms"]["Row"];

export type Permission =
  | "manage_members"
  | "record_payments"
  | "confirm_upi"
  | "manage_plans_pricing"
  | "check_in_members"
  | "manage_classes"
  | "edit_workout_plans"
  | "assign_workout_plans"
  | "edit_exercises"
  | "manage_food_list"
  | "coach_nutrition"
  | "sell_pt"
  | "view_reports"
  | "edit_gym_settings"
  | "manage_sections"
  | "manage_roles"
  | "self_check_in"
  | "book_classes"
  | "log_food"
  | "log_workouts";

export type PermissionInfo = {
  key: Permission;
  label: string;
  hint: string;
  group: "Members & money" | "Front desk" | "Classes" | "Workouts" | "Nutrition" | "Gym" | "In the member app";
  // The gym switch this permission depends on; off means the row is greyed out.
  section?: keyof Pick<GymRow, "checkin_enabled" | "classes_enabled" | "workouts_enabled" | "nutrition_enabled" | "pt_enabled">;
};

export const PERMISSIONS: PermissionInfo[] = [
  { key: "manage_members", label: "Add and edit members", hint: "Add people, change their roles, approve join requests", group: "Members & money" },
  { key: "record_payments", label: "Record payments", hint: "Cash, card and UPI at the desk; cancel memberships", group: "Members & money" },
  { key: "confirm_upi", label: "Confirm UPI payments", hint: "Approve or reject payments members say they made", group: "Members & money" },
  { key: "manage_plans_pricing", label: "Change plans and prices", hint: "Membership plans and PT packages", group: "Members & money" },
  { key: "view_reports", label: "Download exports", hint: "CSV files of members and payments", group: "Members & money" },
  { key: "check_in_members", label: "Check members in", hint: "Scan member QR codes and check in by name", group: "Front desk", section: "checkin_enabled" },
  { key: "sell_pt", label: "Sell and log personal training", hint: "Sell PT packages, log and delete sessions", group: "Front desk", section: "pt_enabled" },
  { key: "manage_classes", label: "Run classes", hint: "Class types, schedule, cancel classes, mark attendance", group: "Classes", section: "classes_enabled" },
  { key: "edit_workout_plans", label: "Build workout plans", hint: "Create plans and edit their exercises", group: "Workouts", section: "workouts_enabled" },
  { key: "assign_workout_plans", label: "Assign workout plans", hint: "Give a plan to a member or take it away", group: "Workouts", section: "workouts_enabled" },
  { key: "edit_exercises", label: "Edit the exercise library", hint: "Add exercises, hide built-in ones, write exercise guides", group: "Workouts", section: "workouts_enabled" },
  { key: "manage_food_list", label: "Edit the food list", hint: "The gym's own foods, and adding members' foods to it", group: "Nutrition", section: "nutrition_enabled" },
  { key: "coach_nutrition", label: "Coach nutrition", hint: "See food logs and set targets. Trainers: only their own PT clients", group: "Nutrition", section: "nutrition_enabled" },
  { key: "edit_gym_settings", label: "Change gym settings", hint: "Name, address, hours, UPI ID, logo, QR poster", group: "Gym" },
  { key: "manage_sections", label: "Turn sections on or off", hint: "Check-in, classes, workouts, PT, nutrition and joining rules", group: "Gym" },
  { key: "manage_roles", label: "Change roles & permissions", hint: "This page, for roles they don't hold themselves. Only the owner changes this row", group: "Gym" },
  { key: "self_check_in", label: "Check in from the app", hint: "With the app or by scanning the gym's poster", group: "In the member app", section: "checkin_enabled" },
  { key: "book_classes", label: "Book classes", hint: "Book and join waitlists in the app", group: "In the member app", section: "classes_enabled" },
  { key: "log_workouts", label: "Log workouts", hint: "Record sets and reps in the app", group: "In the member app", section: "workouts_enabled" },
  { key: "log_food", label: "Log food", hint: "Record meals in the app", group: "In the member app", section: "nutrition_enabled" },
];

// Columns of the owner's grid. The owner has every permission and isn't one.
export const GRID_ROLES = ["admin", "staff", "trainer", "member"] as const satisfies readonly GymRole[];
export type GridRole = (typeof GRID_ROLES)[number];

export const ROLE_ORDER: GymRole[] = ["owner", "admin", "staff", "trainer", "member"];
export const ROLE_TITLES: Record<GymRole, string> = { owner: "Owner", admin: "Admin", staff: "Staff", trainer: "Trainer", member: "Member" };

// The highest of someone's roles, as the database's auth_role_in() returns.
export function highestRole(roles: GymRole[]): GymRole {
  return [...roles].sort((a, b) => ROLE_ORDER.indexOf(a) - ROLE_ORDER.indexOf(b))[0] ?? "member";
}

// Main role first, then extras in rank order, no repeats ("Owner + Trainer").
export function rolesLabel(role: GymRole, extra: GymRole[] = []) {
  const rest = [...new Set(extra)].filter((r) => r !== role).sort((a, b) => ROLE_ORDER.indexOf(a) - ROLE_ORDER.indexOf(b));
  return [role, ...rest].map((r) => ROLE_TITLES[r]).join(" + ");
}
