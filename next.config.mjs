/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  experimental: {
    // Patient proposal uploads (images/PDF up to 2MB) go through server actions.
    serverActions: { bodySizeLimit: "3mb" },
  },
  async headers() {
    return [
      {
        source: "/(.*)",
        headers: [
          // No page in this app should ever be embedded in an iframe —
          // blocks clickjacking against admin & payment pages.
          { key: "X-Frame-Options", value: "DENY" },
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
          { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=()" },
        ],
      },
    ];
  },
};

export default nextConfig;
