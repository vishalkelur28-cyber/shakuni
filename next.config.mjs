/** @type {import('next').NextConfig} */
const nextConfig = {
  // solc bundles its own WASM compiler; keep it out of the server bundle and
  // load it from node_modules at runtime in the /api/solc-analyze route.
  experimental: {
    serverComponentsExternalPackages: ["solc"],
  },
};

export default nextConfig;
