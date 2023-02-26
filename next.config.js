/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  experimental: {
    externalDir: true, // 允许从next.js项目之外引用ts/tsx，see https://github.com/vercel/next.js/pull/22867#issue-824441539
    esmExternals: "loose", // 避免一些引包错误，see https://github.com/vercel/next.js/pull/27069#issue-941260214
  },
};

module.exports = nextConfig;
