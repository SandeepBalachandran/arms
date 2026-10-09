import Link from "next/link";
import { Card } from "@/components/ui";
import type { GymMembership } from "@/lib/auth";

// Lists the gyms a user can open in an area (admin or member app).
export function GymPicker({
  title,
  gyms,
  hrefPrefix,
  empty,
}: {
  title: string;
  gyms: GymMembership[];
  hrefPrefix: "/admin";
  empty: React.ReactNode;
}) {
  return (
    <main className="mx-auto w-full max-w-md flex-1 px-4 py-12">
      <h1 className="mb-4 text-2xl font-semibold">{title}</h1>
      {gyms.length === 0 ? (
        <Card className="text-sm text-muted">{empty}</Card>
      ) : (
        <ul className="space-y-2">
          {gyms.map(({ gym, role }) => (
            <li key={gym.id}>
              <Link href={`${hrefPrefix}/${gym.slug}`}>
                <Card className="flex items-center justify-between hover:border-brand">
                  <span className="font-medium">{gym.name}</span>
                  <span className="text-xs capitalize text-muted">{role}</span>
                </Card>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </main>
  );
}
