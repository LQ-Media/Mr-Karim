// Fonts are self-hosted from npm (@fontsource), so builds never depend on
// reaching Google Fonts.
import "@fontsource/oswald/500.css";
import "@fontsource/oswald/600.css";
import "@fontsource/oswald/700.css";
import "@fontsource/nunito-sans/400.css";
import "@fontsource/nunito-sans/600.css";
import "@fontsource/nunito-sans/700.css";
import "@fontsource/nunito-sans/800.css";
import "@fontsource/noto-naskh-arabic/arabic-400.css";
import "@fontsource/noto-naskh-arabic/arabic-700.css";
import "@fontsource/amiri/arabic-400.css";
import "./globals.css";
import { APP_NAME, APP_SHORT_NAME, APP_TAGLINE } from "@/lib/brand";
import { getLang } from "@/lib/i18n";


export const metadata = {
  title: { default: APP_NAME, template: `%s · ${APP_NAME}` },
  description: APP_TAGLINE,
  applicationName: APP_NAME,
  metadataBase: new URL(process.env.APP_ORIGIN || "http://localhost:3000"),
  openGraph: { title: APP_NAME, description: APP_TAGLINE, siteName: APP_NAME, type: "website" },
  appleWebApp: { capable: true, title: APP_SHORT_NAME, statusBarStyle: "default" },
  // Kept out of search engines until the Ustaz says go public (ALLOW_INDEXING=1).
  robots: process.env.ALLOW_INDEXING === "1" ? undefined : { index: false, follow: false },
};

export const viewport = {
  themeColor: "#17140F",
  viewportFit: "cover",
  width: "device-width",
  initialScale: 1,
};

export default async function RootLayout({ children }) {
  const lang = await getLang();
  return (
    <html
      lang={lang}
      className="h-full"
    >
      <body className="min-h-full">{children}</body>
    </html>
  );
}
