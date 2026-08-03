import "./globals.css";

export const metadata = {
  title: "NEXUS Foundation",
  description: "Fundação oficial da plataforma NEXUS",
};

export default function RootLayout({ children }) {
  return (
    <html lang="pt-BR">
      <body>{children}</body>
    </html>
  );
}
