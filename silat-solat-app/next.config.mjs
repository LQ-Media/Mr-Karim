/** @type {import('next').NextConfig} */
const nextConfig = {
  poweredByHeader: false,
  // Standalone output so the Dockerfile ships a slim image to Railway.
  output: "standalone",
  // pg opens sockets and must not be bundled.
  serverExternalPackages: ["pg"],
  images: { remotePatterns: [{ protocol: "https", hostname: "i.ytimg.com" }] },
};

export default nextConfig;
