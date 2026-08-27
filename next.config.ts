import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Allow the member Android WebView on LAN to load `next dev` assets.
  allowedDevOrigins: ["192.168.*.*", "10.0.2.2"],
};

export default nextConfig;
