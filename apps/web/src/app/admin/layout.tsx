import type { Metadata, Viewport } from "next";
import { RegisterAdminApp } from "./register-admin-app";

// The admin panel installs as its own app, "GOS Admin": a different name, icon
// and scope from the member app, so the two sit side by side on one phone.
export const metadata: Metadata = {
  manifest: "/gos-admin.webmanifest",
  icons: { icon: "/admin-icons/icon-192.png", apple: "/admin-icons/apple-touch-icon.png" },
  appleWebApp: { capable: true, title: "GOS Admin", statusBarStyle: "default" },
};

export const viewport: Viewport = { themeColor: "#18181b" };

export default function AdminRootLayout({ children }: LayoutProps<"/admin">) {
  return (
    <>
      <RegisterAdminApp />
      {children}
    </>
  );
}
