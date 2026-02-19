import "./globals.css";

import { CommandOS } from "@/components/command-os/command-os";
import { CommandProvider } from "@/components/command-os/command-provider";
import { ToastProvider } from "@/components/ui/toast";

type RootLayoutProps = {
  children: React.ReactNode;
};

export default function RootLayout({ children }: RootLayoutProps) {
  return (
    <html lang="pl">
      <body className="min-h-screen bg-bg text-text">
        <CommandProvider>
          <ToastProvider>
            {children}
            <CommandOS />
          </ToastProvider>
        </CommandProvider>
      </body>
    </html>
  );
}
