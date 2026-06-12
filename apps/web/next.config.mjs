/** @type {import('next').NextConfig} */
const nextConfig = {
  allowedDevOrigins: ["127.0.0.1"],
  reactStrictMode: true,
  transpilePackages: ["@ecgviewer/config", "@ecgviewer/ecg", "@ecgviewer/fhir"]
};

export default nextConfig;
