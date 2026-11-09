// 生成官网 OG 分享图：satori 渲染 SVG → sharp 转 PNG
// 纯英文文案，避免 CJK 字体依赖（Source Sans 3 静态 TTF 仅覆盖拉丁字符）
import { readFile, writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import satori from 'satori';
import sharp from 'sharp';

const here = (p) => fileURLToPath(new URL(p, import.meta.url));
const fontRegular = await readFile(here('../src/assets/fonts/SourceSans3-Regular.ttf'));
const fontBold = await readFile(here('../src/assets/fonts/SourceSans3-Semibold.ttf'));

const el = (type, style, children) => ({ type, props: { style, children } });
const text = (content, style) => ({ type: 'div', props: { style: { display: 'flex', ...style }, children: content } });

const bar = (h, color) => el('div', { display: 'flex', width: 26, height: h, background: color, borderRadius: 4, marginRight: 8, alignSelf: 'flex-end' }, []);

const card = el('div', {
  width: '1200px', height: '630px', display: 'flex', flexDirection: 'column',
  justifyContent: 'space-between', padding: '64px 72px', boxSizing: 'border-box',
  background: 'linear-gradient(135deg, #0b1220 0%, #111a2e 55%, #0e1a24 100%)',
  color: '#f4f6fb', fontFamily: 'SourceSans',
}, [
  el('div', { display: 'flex', alignItems: 'flex-end', height: 130 }, [
    bar(46, '#e63946'), bar(86, '#2a9d8f'), bar(66, '#e63946'), bar(108, '#2a9d8f'),
  ]),
  el('div', { display: 'flex', flexDirection: 'column' }, [
    text('HiTrading', { fontSize: 96, fontWeight: 700, letterSpacing: '-2px', lineHeight: 1.05 }),
    text('A-share research assistant for DeepSeek Harness', { fontSize: 34, color: '#aeb9cf', marginTop: 14 }),
  ]),
  el('div', { display: 'flex', flexDirection: 'column' }, [
    text('11 agent tools · 11-tab console · local HTTP API', { fontSize: 24, color: '#7f8da8' }),
    text('github.com/atorber/hitrading', { fontSize: 24, color: '#4f9d7a', marginTop: 10 }),
  ]),
]);

const svg = await satori(card, {
  width: 1200,
  height: 630,
  fonts: [
    { name: 'SourceSans', data: fontRegular, weight: 400, style: 'normal' },
    { name: 'SourceSans', data: fontBold, weight: 700, style: 'normal' },
  ],
});

const png = await sharp(Buffer.from(svg)).png({ compressionLevel: 9 }).toBuffer();
await writeFile(here('../public/og.png'), png);
console.log('og.png generated:', png.length, 'bytes');
