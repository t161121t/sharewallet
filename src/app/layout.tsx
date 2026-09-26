import type { Metadata } from "next";
import { Geist, Geist_Mono, Dancing_Script } from "next/font/google";
import { Toaster } from "react-hot-toast";
import ThemeSync from "@/components/layout/ThemeSync";
import KonstaProvider from "@/components/layout/KonstaProvider";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

const dancingScript = Dancing_Script({
  variable: "--font-dancing-script",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Share Wallet",
  description: "共有ウォレットアプリ",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="ja">
      <head>
        {/* Konsta UIのdark:バリアントは.darkクラスの有無で切り替わるため、初回ペイント前に
            同期的に.darkクラスを付与する(ThemeSyncのuseEffectを待つとダークモード端末で
            一瞬ライトテーマがちらつくため)。以降のOS設定変更の追従はThemeSyncが担う。 */}
        <script
          dangerouslySetInnerHTML={{
            __html:
              "try{if(window.matchMedia('(prefers-color-scheme: dark)').matches){document.documentElement.classList.add('dark')}}catch(e){}",
          }}
        />
      </head>
      <body
        className={`${geistSans.variable} ${geistMono.variable} ${dancingScript.variable} antialiased`}
      >
        <ThemeSync />
        <KonstaProvider>{children}</KonstaProvider>
        <Toaster
          position="top-center"
          toastOptions={{
            duration: 2500,
            style: {
              borderRadius: "9999px",
              background: "#2d2a26",
              color: "#faf8f5",
              fontSize: "14px",
              padding: "8px 20px",
            },
          }}
        />
      </body>
    </html>
  );
}
