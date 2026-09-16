import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Build autonome pour l'image Docker (déploiement sur le dédié agence).
  output: "standalone",
};

export default nextConfig;
