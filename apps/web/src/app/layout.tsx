import type { Metadata, Viewport } from "next";
import { Geist_Mono, Poppins } from "next/font/google";
import { RegisterPwa } from "@/components/register-pwa";
import { Toaster } from "@/components/toaster";
import { TooltipProvider } from "@/components/tooltip";
import { getTheme } from "@/lib/theme";
import { BRAND } from "@gymos/shared";
import "./globals.css";

// Same font as the member app. Poppins isn't a variable font, so list weights.
const poppins = Poppins({
  variable: "--font-poppins",
  subsets: ["latin"],
  weight: ["400", "500", "600", "700", "800"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: { default: BRAND.name, template: `%s · ${BRAND.name}` },
  description: "Run your gym: memberships, check-ins, classes and workouts.",
  appleWebApp: { capable: true, title: BRAND.name, statusBarStyle: "default" },
};

export const viewport: Viewport = {
  themeColor: "#fafafa",
  // Lets fixed bars use env(safe-area-inset-*) on phones with a home indicator.
  viewportFit: "cover",
};

export default async function RootLayout({ children }: LayoutProps<"/">) {
  const theme = await getTheme();
  return (
    <html
      lang="en"
      data-theme={theme}
      className={`${poppins.variable} ${geistMono.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col font-sans">
        <TooltipProvider>{children}</TooltipProvider>
        <Toaster />
        <RegisterPwa />
        {/* Chrome fires this once, early: keep it for the install banner (components/install-banner.tsx). */}
        <script
          dangerouslySetInnerHTML={{
            __html: "window.addEventListener('beforeinstallprompt',function(e){e.preventDefault();window.__gosInstallPrompt=e;window.dispatchEvent(new Event('gos-installable'))})",
          }}
        />
      </body>
    </html>
  );
}
