import sharp from 'sharp';
import { mkdirSync, copyFileSync } from 'node:fs';
import { resolve } from 'node:path';

const ROOT = process.cwd();
const BRAND_DIR = resolve(ROOT, 'campaign-kafe-caddesi/brand');
const ASSETS_DIR = resolve(ROOT, 'assets');
const PUB_DIR = resolve(ROOT, 'public');

const masterIcon = resolve(BRAND_DIR, 'icon-master-1024.png');
const masterLogo = resolve(BRAND_DIR, 'logo-transparent.png');

mkdirSync(ASSETS_DIR, { recursive: true });
mkdirSync(PUB_DIR, { recursive: true });

// 1. icon-only.png (1024x1024)
copyFileSync(masterIcon, resolve(ASSETS_DIR, 'icon-only.png'));
console.log('icon-only.png copied');

// 2. icon-background.png (1024x1024 solid #103D40)
await sharp({
  create: {
    width: 1024,
    height: 1024,
    channels: 4,
    background: { r: 16, g: 61, b: 64, alpha: 1 } // #103D40
  }
}).png().toFile(resolve(ASSETS_DIR, 'icon-background.png'));
console.log('icon-background.png created');

// 3. icon-foreground.png (1024x1024 with icon scaled to 720x720 centered)
const resizedEmblem = await sharp(masterIcon)
  .resize(720, 720, { fit: 'contain' })
  .toBuffer();

await sharp({
  create: {
    width: 1024,
    height: 1024,
    channels: 4,
    background: { r: 0, g: 0, b: 0, alpha: 0 }
  }
})
.composite([{ input: resizedEmblem, left: 152, top: 152 }])
.png()
.toFile(resolve(ASSETS_DIR, 'icon-foreground.png'));
console.log('icon-foreground.png created');

// 4. splash.png (2732x2732, background #103D40, logo in center)
const logoLight = await sharp(masterLogo)
  .resize(1200, 680, { fit: 'contain' })
  .toBuffer();

await sharp({
  create: {
    width: 2732,
    height: 2732,
    channels: 4,
    background: { r: 16, g: 61, b: 64, alpha: 1 } // #103D40
  }
})
.composite([{ input: logoLight, left: Math.round((2732 - 1200) / 2), top: Math.round((2732 - 680) / 2) }])
.png()
.toFile(resolve(ASSETS_DIR, 'splash.png'));
console.log('splash.png created');

// 5. splash-dark.png (2732x2732, background #082D32, logo in center)
await sharp({
  create: {
    width: 2732,
    height: 2732,
    channels: 4,
    background: { r: 8, g: 45, b: 50, alpha: 1 } // #082D32
  }
})
.composite([{ input: logoLight, left: Math.round((2732 - 1200) / 2), top: Math.round((2732 - 680) / 2) }])
.png()
.toFile(resolve(ASSETS_DIR, 'splash-dark.png'));
console.log('splash-dark.png created');

// 6. Public PWA icons
await sharp(masterIcon).resize(192, 192).png().toFile(resolve(PUB_DIR, 'pwa-192.png'));
await sharp(masterIcon).resize(512, 512).png().toFile(resolve(PUB_DIR, 'pwa-512.png'));
await sharp(masterIcon).resize(512, 512).png().toFile(resolve(PUB_DIR, 'pwa-maskable-512.png'));
console.log('public pwa icons updated');

// 7. iOS AppIcon (1024x1024 opaque 3-channel RGB — Apple rejects alpha/rounded corners)
const IOS_ICON_DIR = resolve(ROOT, 'ios/App/App/Assets.xcassets/AppIcon.appiconset');
const IOS_SPLASH_DIR = resolve(ROOT, 'ios/App/App/Assets.xcassets/Splash.imageset');
mkdirSync(IOS_ICON_DIR, { recursive: true });
mkdirSync(IOS_SPLASH_DIR, { recursive: true });

await sharp(masterIcon)
  .resize(1024, 1024, { fit: 'cover' })
  .flatten({ background: { r: 16, g: 61, b: 64 } })
  .removeAlpha()
  .png({ compressionLevel: 9 })
  .toFile(resolve(IOS_ICON_DIR, 'AppIcon-512@2x.png'));
console.log('iOS AppIcon-512@2x.png (1024x1024 opaque RGB) updated');

// 8. iOS LaunchScreen Splash images (light & dark, opaque 2732x2732)
const splashLightBuf = await sharp(resolve(ASSETS_DIR, 'splash.png'))
  .flatten({ background: { r: 16, g: 61, b: 64 } })
  .removeAlpha()
  .png({ compressionLevel: 9 })
  .toBuffer();
const splashDarkBuf = await sharp(resolve(ASSETS_DIR, 'splash-dark.png'))
  .flatten({ background: { r: 8, g: 45, b: 50 } })
  .removeAlpha()
  .png({ compressionLevel: 9 })
  .toBuffer();

for (const scale of ['1x', '2x', '3x']) {
  await sharp(splashLightBuf).toFile(resolve(IOS_SPLASH_DIR, `Default@${scale}~universal~anyany.png`));
  await sharp(splashDarkBuf).toFile(resolve(IOS_SPLASH_DIR, `Default@${scale}~universal~anyany-dark.png`));
}
console.log('iOS Splash.imageset updated');
