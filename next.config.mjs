import path from 'path';
import bundleAnalyzer from '@next/bundle-analyzer';

const withBundleAnalyzer = bundleAnalyzer({
    enabled: process.env.ANALYZE === 'true',
    openAnalyzer: false,
});

const projectDir = import.meta.dirname;
const facadeAioha = path.join(projectDir, 'lib/aioha/facade-aioha.ts');
const facadeReactUi = path.join(projectDir, 'lib/aioha/facade-react-ui.tsx');

/** @type {import('next').NextConfig} */
const nextConfig = {
    experimental: {
        // instrumentation.ts loads by default. Home HTML holds framework
        // scripts unless SNAPIE_DEFER_FRAMEWORK_SCRIPTS=0. See
        // lib/perf/deferFrameworkScripts.js.
        serverActions: {
            bodySizeLimit: '10mb', // Increase the body size limit
        },
    },
    images: {
        // AVIF when the browser asks for it, WebP otherwise. Sharp (a
        // production dependency) does the encode inside /_next/image.
        formats: ['image/avif', 'image/webp'],
        // Fixed partner hosts only. Do not add hostname: '**' — that would
        // let the optimizer fetch whatever URL a client passes. Feed images
        // are arbitrary user-content URLs, so they go through the same-origin
        // /api/image-proxy path (localPatterns below). The proxy, not this
        // allowlist, is what blocks SSRF.
        remotePatterns: [
            {
                protocol: 'https',
                hostname: 'media.giphy.com',
            },
            {
                protocol: 'https',
                hostname: 'media0.giphy.com',
            },
            {
                protocol: 'https',
                hostname: 'media1.giphy.com',
            },
            {
                protocol: 'https',
                hostname: 'media2.giphy.com',
            },
            {
                protocol: 'https',
                hostname: 'media3.giphy.com',
            },
            {
                protocol: 'https',
                hostname: 'media4.giphy.com',
            },
            {
                protocol: 'https',
                hostname: 'i.giphy.com',
            },
            {
                protocol: 'https',
                hostname: 'i.imgur.com',
            },
            {
                protocol: 'https',
                hostname: '**.imgur.com',
            },
            {
                protocol: 'https',
                hostname: 'images.ecency.com',
            },
            {
                protocol: 'https',
                hostname: 'images.hive.blog',
            },
        ],
        // localPatterns replaces "allow every local path". The proxy is the
        // only query-string path the optimizer may fetch; its `url` param is
        // checked in the route. Other same-origin images are allowed only
        // when they have no query string (public files, static imports).
        localPatterns: [
            { pathname: '/api/image-proxy' },
            { pathname: '/**', search: '' },
        ],
    },
    webpack: (config, { isServer }) => {
        // Ignore optional native dependencies that don't work in Vercel
        config.resolve.fallback = {
            ...config.resolve.fallback,
            fs: false,
            memcpy: false,
        };

        // Ignore memcpy module completely
        config.externals = config.externals || [];
        config.externals.push({
            'memcpy': 'commonjs memcpy'
        });

        // Resolve .svg imports as plain URL strings. @aioha/react-ui ships
        // `import KeychainIcon from '../icons/keychain.svg'` and renders them
        // via <image href={icon}> — which requires a URL, not Next.js's
        // default StaticImageData object. No other file in the project imports
        // svg directly, so a global rule is safe.
        config.module.rules.push({
            test: /\.svg$/,
            type: 'asset/resource',
        });

        // App imports of the wallet libraries resolve to tiny facades. The real
        // packages stay an async chunk, loaded when a session exists or login
        // opens the wallet modal. Imports from node_modules and from lib/aioha
        // (the loader) keep the real packages.
        config.plugins.push({
            apply(compiler) {
                compiler.hooks.normalModuleFactory.tap('LazyAiohaFacades', (nmf) => {
                    nmf.hooks.beforeResolve.tap('LazyAiohaFacades', (resolveData) => {
                        if (!resolveData) return;
                        const request = resolveData.request;
                        if (request !== '@aioha/aioha' && request !== '@aioha/react-ui') return;
                        const from = resolveData.contextInfo?.issuer || resolveData.context || '';
                        if (!from.includes(projectDir)) return;
                        if (from.includes(`${path.sep}node_modules${path.sep}`)) return;
                        if (from.includes(`${path.sep}lib${path.sep}aioha${path.sep}`)) return;
                        resolveData.request = request === '@aioha/aioha' ? facadeAioha : facadeReactUi;
                    });
                });
            },
        });

        return config;
    }
}

export default withBundleAnalyzer(nextConfig);

