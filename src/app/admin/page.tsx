import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { GymPicker } from "@/components/gym-picker";
import { getMyGyms, requireUser, TEAM_ROLES } from "@/lib/auth";

export const metadata: Metadata = { title: "Admin" };

export default async function AdminIndex() {
  await requireUser("/admin");
  const gyms = (await getMyGyms()).filter((m) => TEAM_ROLES.includes(m.role));
  if (gyms.length === 1) redirect(`/admin/${gyms[0].gym.slug}`);

  return (
    <GymPicker
      title="Choose a gym to manage"
      gyms={gyms}
      hrefPrefix="/admin"
      empty={
        <>
          You don&apos;t manage any gyms yet.{" "}
          <Link href="/register-gym" className="text-brand hover:underline">Register your gym</Link>
        </>
      }
    />
  );
}
