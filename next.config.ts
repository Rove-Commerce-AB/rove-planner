import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  async redirects() {
    return [
      { source: "/clients", destination: "/customers", permanent: false },
      { source: "/kunder", destination: "/customers", permanent: false },
      { source: "/konsulter", destination: "/consultants", permanent: false },
      { source: "/projekt", destination: "/projects", permanent: false },
      { source: "/allokering", destination: "/allocation", permanent: false },
      { source: "/inställningar", destination: "/settings", permanent: false },
    ];
  },
};

export default nextConfig;
