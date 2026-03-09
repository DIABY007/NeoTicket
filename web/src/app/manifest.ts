import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "NeoTicket",
    short_name: "NeoTicket",
    description: "Billetterie mobile-first pour le marche burkinabe.",
    start_url: "/",
    display: "standalone",
    background_color: "#f8f7f4",
    theme_color: "#f8f7f4",
    lang: "fr",
    icons: [
      {
        src: "/logo.svg",
        type: "image/svg+xml",
        sizes: "any",
      },
    ],
  };
}
