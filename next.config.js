/** @type {import('next').NextConfig} */
const nextConfig = {
  transpilePackages: ['lunar-javascript'],
  // 部署用：产出一个自带裁剪后 node_modules 的 .next/standalone，容器里只需 node server.js
  output: 'standalone',
};

module.exports = nextConfig;
