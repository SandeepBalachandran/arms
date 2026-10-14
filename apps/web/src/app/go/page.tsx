import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { getCurrentUser, getMyGyms, TEAM_ROLES } from "@/lib/auth";
import { VIEW_COOKIE } from "@/lib/view";

// The front door of the installed app. Signed out → sign in. Signed in → the
// admin for people on a gym's team, the member app for everyone else. A team
// member who switched to the member view stays there (see /switch/[view]).
// A page (not a route handler) so the sign-in form's redirect lands here smoothly.
export default async function GoPage() {
  if (!(await getCurrentUser())) redirect("/login?next=/go");

  const onTeam = (await getMyGyms()).some((m) => TEAM_ROLES.includes(m.role));
  const wantsMember = (await cookies()).get(VIEW_COOKIE)?.value === "member";
  redirect(onTeam && !wantsMember ? "/admin" : "/app");
}
