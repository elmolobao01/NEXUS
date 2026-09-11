import "./globals.css";

export const metadata = {
  title: "PLENIUM | Ecossistema de Soluções",
  description: "Gestão, IA, integração e resultados em um ecossistema de soluções que se adapta ao seu negócio.",
  icons: { icon: "/icon.png", apple: "/icon.png" },
};

export default function RootLayout({ children }) {
  return (
    <html lang="pt-BR">
      <body>{children}</body>
    </html>
  );
}
