import "./globals.css";

export const metadata = {
  title: "NEXUS",
  description: "Ecossistema inteligente de soluções",
};

export default function RootLayout({ children }) {
  return (
    <html lang="pt-BR">
      <body>{children}</body>
    </html>
  );
}
