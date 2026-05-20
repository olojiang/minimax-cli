import { mkdir, rm, writeFile } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { dirname, join, resolve } from 'node:path';
import sharp from 'sharp';

const root = resolve(import.meta.dirname, '..');
const source = join(root, 'build', 'icon.svg');
const iconset = join(root, 'build', 'icon.iconset');
const png = join(root, 'build', 'icon.png');
const ico = join(root, 'build', 'icon.ico');
const icns = join(root, 'build', 'icon.icns');
const androidRes = join(root, 'android', 'app', 'src', 'main', 'res');

const sizes = [
  [16, 'icon_16x16.png'],
  [32, 'icon_16x16@2x.png'],
  [32, 'icon_32x32.png'],
  [64, 'icon_32x32@2x.png'],
  [128, 'icon_128x128.png'],
  [256, 'icon_128x128@2x.png'],
  [256, 'icon_256x256.png'],
  [512, 'icon_256x256@2x.png'],
  [512, 'icon_512x512.png'],
  [1024, 'icon_512x512@2x.png'],
];

await rm(iconset, { recursive: true, force: true });
await mkdir(iconset, { recursive: true });

await sharp(source).resize(1024, 1024).png().toFile(png);
await Promise.all(sizes.map(([size, filename]) => (
  sharp(source).resize(size, size).png().toFile(join(iconset, filename))
)));
await writePngIco(source, ico);

if (existsSync(androidRes)) {
  const androidIcons = [
    ['mipmap-mdpi', 48],
    ['mipmap-hdpi', 72],
    ['mipmap-xhdpi', 96],
    ['mipmap-xxhdpi', 144],
    ['mipmap-xxxhdpi', 192],
  ];
  await Promise.all(androidIcons.flatMap(([folder, size]) => {
    const target = join(androidRes, folder);
    return [
      sharp(source).resize(size, size).png().toFile(join(target, 'ic_launcher.png')),
      sharp(source).resize(size, size).png().toFile(join(target, 'ic_launcher_round.png')),
      sharp(source).resize(size, size).png().toFile(join(target, 'ic_launcher_foreground.png')),
    ];
  }));
}

if (process.platform === 'darwin') {
  execFileSync('iconutil', ['-c', 'icns', iconset, '-o', icns], { stdio: 'inherit' });
} else if (!existsSync(icns)) {
  console.warn('Skipping .icns generation because iconutil is only available on macOS.');
}

await rm(iconset, { recursive: true, force: true });

async function writePngIco(input, output) {
  const iconSizes = [16, 24, 32, 48, 64, 128, 256];
  const images = await Promise.all(iconSizes.map(async size => ({
    size,
    data: await sharp(input).resize(size, size).png().toBuffer(),
  })));

  const headerSize = 6;
  const directorySize = 16 * images.length;
  let offset = headerSize + directorySize;
  const header = Buffer.alloc(offset);

  header.writeUInt16LE(0, 0);
  header.writeUInt16LE(1, 2);
  header.writeUInt16LE(images.length, 4);

  images.forEach((image, index) => {
    const entryOffset = headerSize + index * 16;
    header.writeUInt8(image.size === 256 ? 0 : image.size, entryOffset);
    header.writeUInt8(image.size === 256 ? 0 : image.size, entryOffset + 1);
    header.writeUInt8(0, entryOffset + 2);
    header.writeUInt8(0, entryOffset + 3);
    header.writeUInt16LE(1, entryOffset + 4);
    header.writeUInt16LE(32, entryOffset + 6);
    header.writeUInt32LE(image.data.length, entryOffset + 8);
    header.writeUInt32LE(offset, entryOffset + 12);
    offset += image.data.length;
  });

  await mkdir(dirname(output), { recursive: true });
  await writeFile(output, Buffer.concat([
    header,
    ...images.map(image => image.data),
  ]));
}
