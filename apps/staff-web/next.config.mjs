/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  // @clinica/shared é TS/CJS do workspace — transpilar no build do Next.
  transpilePackages: ['@clinica/shared'],
};

export default nextConfig;
