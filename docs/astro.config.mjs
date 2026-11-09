// @ts-check
import { defineConfig } from 'astro/config';
import starlight from '@astrojs/starlight';

// 站点部署在 GitHub Pages 项目页：https://atorber.github.io/hitrading
export default defineConfig({
  site: 'https://atorber.github.io',
  base: '/hitrading',
  integrations: [
    starlight({
      title: 'HiTrading',
      description: 'A股投资助手 —— DeepSeek Harness 插件：11 个 Agent 工具 + 11-Tab 交互控制台，纯分析不下单。',
      logo: { src: './src/assets/logo.svg' },
      favicon: '/favicon.svg',
      customCss: ['./src/styles/custom.css'],
      locales: {
        root: { label: '简体中文', lang: 'zh-CN' },
      },
      social: {
        github: 'https://github.com/atorber/hitrading',
      },
      head: [
        { tag: 'meta', attrs: { property: 'og:image', content: 'https://atorber.github.io/hitrading/og.png' } },
        { tag: 'meta', attrs: { property: 'og:image:width', content: '1200' } },
        { tag: 'meta', attrs: { property: 'og:image:height', content: '630' } },
        { tag: 'meta', attrs: { name: 'twitter:card', content: 'summary_large_image' } },
      ],
      sidebar: [
        {
          label: '开始',
          items: [
            { label: '介绍', slug: 'index' },
            { label: '安装', slug: 'install' },
          ],
        },
        {
          label: '控制台',
          items: [
            { label: '总览', slug: 'guide/overview' },
            { label: '行情自选', slug: 'guide/watchlist' },
            { label: '市场量能', slug: 'guide/energy' },
            { label: '强势股', slug: 'guide/powerful' },
            { label: '选股', slug: 'guide/screen' },
            { label: '持仓与回测', slug: 'guide/portfolio-backtest' },
            { label: '资讯与预警', slug: 'guide/news-alerts' },
          ],
        },
        {
          label: '进阶',
          items: [
            { label: 'Agent 工具', slug: 'tools' },
            { label: 'HTTP API', slug: 'http-api' },
            { label: '架构与数据', slug: 'architecture' },
          ],
        },
        { label: '常见问题', slug: 'faq' },
      ],
    }),
  ],
});
