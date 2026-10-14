import { redirect } from "next/navigation";
import { getCurrentUser, getMyGyms, TEAM_ROLES } from "@/lib/auth";

// The front door of the installed app. Signed out → sign in. Signed in → the
// developers' view for platform admins, the admin for people on a gym's team,
// the member app for everyone else. To use another side, sign out and sign in
// with that account.
// A page (not a route handler) so the sign-in form's redirect lands here smoothly.
export default async function GoPage() {
  const user = await getCurrentUser();
  if (!user) redirect("/login?next=/go");
  if (user.isPlatformAdmin) redirect("/platform");
  const onTeam = (await getMyGyms()).some((m) => TEAM_ROLES.includes(m.role));
  redirect(onTeam ? "/admin" : "/app");
}
