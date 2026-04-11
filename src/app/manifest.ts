import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Lean Mean Lead Finder Machine",
    short_name: "Lean Mean Leads",
    description:
      "Lead search, contact enrichment, inbox activity, documents, and outreach operations in one dashboard.",
    start_url: "/",
    display: "standalone",
    background_color: "#f5f0e4",
    theme_color: "#111418",
    icons: [
      {
        src: "/icon",
        sizes: "512x512",
        type: "image/png",
      },
      {
        src: "/apple-icon",
        sizes: "180x180",
        type: "image/png",
      },
    ],
  };
}
