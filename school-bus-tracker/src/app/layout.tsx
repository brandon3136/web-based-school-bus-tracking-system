import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "SafeRoute – School Bus Tracker",
  description: "Real-time school bus tracking for parents, administrators and drivers",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        <script
          dangerouslySetInnerHTML={{
            __html: `(function(){try{var t=localStorage.getItem("saferoute_theme");if(t==="dark")document.documentElement.setAttribute("data-theme","dark")}catch(e){}})()`,
          }}
        />
      </head>
      <body className="antialiased">{children}</body>
    </html>
  );
}
