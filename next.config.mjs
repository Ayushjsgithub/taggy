/** @type {import('next').NextConfig} */
const nextConfig = {
  /* config options here */
  serverExternalPackages: ['ffmpeg-static', 'fluent-ffmpeg'],
  reactCompiler: true,
  turbopack: {
    root: '.',
  },
};

export default nextConfig;
