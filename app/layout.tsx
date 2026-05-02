import type { Metadata } from "next";
import { Sidebar } from "@/components/layout/Sidebar";
import { Header } from "@/components/layout/Header";
import { getEditableSettings } from "@/src/server/services/settings.service";
import "./globals.css";

export const metadata: Metadata = {
  title: "OpenLead Scout",
  description: "Rule-based local business lead generation from public resources."
};

export default async function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  const settings = await getEditableSettings().catch(() => ({ attributionText: undefined }));
  const attribution = settings.attributionText || "Data from OpenStreetMap contributors.";

  return (
    <html lang="en" suppressHydrationWarning>
      <body>
        <div className="min-h-screen md:flex">
          <Sidebar />
          <div className="flex min-h-screen flex-1 flex-col">
            <Header />
            <main className="flex-1 px-4 py-6 md:px-6">{children}</main>
            <footer className="border-t bg-white px-4 py-3 text-xs text-muted-foreground md:px-6">
              {attribution}
            </footer>
          </div>
        </div>
      </body>
    </html>
  );
}
