const nextConfig = {
  async redirects() {
    return [
      { source: "/clients", destination: "/settings/customers", permanent: false },
      { source: "/kunder", destination: "/settings/customers", permanent: false },
      { source: "/customers", destination: "/settings/customers", permanent: false },
      {
        source: "/customers/:id",
        destination: "/settings/customers/:id",
        permanent: false,
      },
      { source: "/konsulter", destination: "/settings/consultants", permanent: false },
      { source: "/consultants", destination: "/settings/consultants", permanent: false },
      {
        source: "/consultants/:id",
        destination: "/settings/consultants/:id",
        permanent: false,
      },
      { source: "/projekt", destination: "/projects", permanent: false },
      { source: "/allokering", destination: "/planner/allocation", permanent: false },
      { source: "/allocation", destination: "/planner/allocation", permanent: false },
      { source: "/planner", destination: "/planner/allocation", permanent: false },
      { source: "/time-report", destination: "/time-report/time-report", permanent: false },
      {
        source: "/time-report/project-manager",
        destination: "/time-report/approval",
        permanent: false,
      },
      { source: "/inställningar", destination: "/settings/general", permanent: false },
      { source: "/settings", destination: "/settings/general", permanent: false },
    ];
  },
};

export default nextConfig;
