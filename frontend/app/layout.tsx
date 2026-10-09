import type { Metadata } from "next";
import { Inter, Source_Serif_4 } from "next/font/google";
import { ToastProvider } from "@/components/ui/ToastProvider";
import { AuthProvider } from "@/lib/auth";
import "./globals.css";
import "./marketing.css";

const inter = Inter({ subsets: ["latin"], display: "swap", variable: "--font-inter" });
const serif = Source_Serif_4({ subsets: ["latin"], display: "swap", variable: "--font-serif", weight: ["300", "400"] });

export const metadata: Metadata = {
  title: "Typeform Clone",
  description: "Build forms people enjoy filling in.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={`${inter.variable} ${serif.variable}`}>
      <body>
        <ToastProvider>
          <AuthProvider>{children}</AuthProvider>
        </ToastProvider>
      </body>
    </html>
  );
}
