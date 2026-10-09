/** @type {import('next').NextConfig} */
const backendUrl = 
  process.env.NEXT_PUBLIC_API_URL || 
  process.env.BACKEND_API_URL || 
  "https://typeform-demo.onrender.com";

const nextConfig = {
  reactStrictMode: true,
  async rewrites() {
    return [
      {
        source: "/api/:path*",
        destination: `${backendUrl}/api/:path*`,
      },
    ];
  },
};

export default nextConfig;
