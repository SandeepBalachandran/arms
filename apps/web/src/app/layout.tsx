import type { Metadata, Viewport } from "next";
import { Geist_Mono, Poppins } from "next/font/google";
import { Toaster } from "@/components/toaster";
import { TooltipProvider } from "@/components/tooltip";
import { getTheme } from "@/lib/theme";
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
  title: { default: "GOS", template: "%s · GOS" },
  description: "Run your gym: memberships, check-ins, classes and workouts.",
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
      </body>
    </html>
  );
}
