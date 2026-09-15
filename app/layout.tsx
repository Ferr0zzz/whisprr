import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Whisprr",
  description: "Partage de secrets zero-knowledge",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="fr">
      <body>{children}</body>
    </html>
  );
}