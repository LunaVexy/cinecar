import type { Metadata } from "next";
import "./globals.css";
export const metadata: Metadata = {
  title: "CineCar — cinema no carro, entre amigos",
  description: "Escolham uma noite chuvosa, votem no filme e combinem o que cada pessoa leva para a sessão CineCar.",
  icons: { icon: [{ url: "/cinecar-film.svg", type: "image/svg+xml" }], shortcut: "/cinecar-film.svg" },
};
export default function RootLayout({children}:{children:React.ReactNode}) { return <html lang="pt-BR"><body className="antialiased">{children}</body></html>; }
