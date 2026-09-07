import "./globals.css";

export const metadata = {
  title: "PLENIUM",
  description: "Sistema de gestão integrado, modular e inteligente",
};

export default function RootLayout({ children }) {
  return (
    <html lang="pt-BR">
      <body>{children}</body>
    </html>
  );
}
