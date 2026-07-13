import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Cloak",
    short_name: "Cloak",
    description:
      "Zero-knowledge, developer-centric secrets manager and password vault.",
    start_url: "/",
    display: "standalone",
    background_color: "#07080c",
    theme_color: "#1b4332",
    icons: [
      {
        src: "/logo.svg",
        sizes: "any",
        type: "image/svg+xml",
      },
      {
        src: "/logo.png",
        sizes: "512x512",
        type: "image/png",
      },
    ],
  };
}
