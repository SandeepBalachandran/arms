import { NextResponse, type NextRequest } from "next/server";
import { getMyGyms, TEAM_ROLES } from "@/lib/auth";
import { VIEW_COOKIE, viewCookieOptions } from "@/lib/view";

// "Open the member app" / "Open the admin": remembers the choice, then goes there.
export async function GET(request: NextRequest, { params }: { params: Promise<{ view: string }> }) {
  const { origin } = request.nextUrl;
  const { view } = await params;
  const onTeam = (await getMyGyms()).some((m) => TEAM_ROLES.includes(m.role));
  const target = view === "admin" && onTeam ? "admin" : "member";

  const response = NextResponse.redirect(`${origin}${target === "admin" ? "/admin" : "/app"}`);
  response.cookies.set(VIEW_COOKIE, target, viewCookieOptions);
  return response;
}
