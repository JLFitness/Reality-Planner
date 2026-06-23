// One-off: build PWA PNG icons + favicon from the app logo. Home-screen icons are
// centred on the brand background (#020617); the favicon stays transparent.
// Run: node scripts/gen-icons.mjs
import sharp from 'sharp';

const SRC = 'Logos/logo 1.png';
const BG = { r: 2, g: 6, b: 23, alpha: 1 }; // brand slate-950

// Trim the transparent padding around the logo so it fills the icon nicely.
const trimmed = () => sharp(SRC).trim();

async function gen(size, out, pad = 0.18) {
  const inner = Math.round(size * (1 - pad * 2));
  const logo = await trimmed()
    .resize(inner, inner, { fit: 'contain', background: { r: 0, g: 0, b: 0, alpha: 0 } })
    .toBuffer();
  await sharp({ create: { width: size, height: size, channels: 4, background: BG } })
    .composite([{ input: logo, gravity: 'center' }])
    .png()
    .toFile(out);
  console.log('wrote', out);
}

async function favicon(size, out) {
  await trimmed()
    .resize(size, size, { fit: 'contain', background: { r: 0, g: 0, b: 0, alpha: 0 } })
    .png()
    .toFile(out);
  console.log('wrote', out);
}

await gen(192, 'public/icon-192.png');
await gen(512, 'public/icon-512.png');
await gen(180, 'public/apple-touch-icon.png');
await favicon(64, 'public/favicon.png');
