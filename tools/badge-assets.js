const fs = require("node:fs");
const path = require("node:path");
const { spawnSync } = require("node:child_process");
const { PNG } = require("pngjs");

const root = path.join(__dirname, "..", "assets", "badges");
const manifest = JSON.parse(fs.readFileSync(path.join(root, "badges.json"), "utf8"));
const angles = [0, 60, 120, 180, 240, 300];
const fps = 30;
const spinFrames = 54;
const holdFrames = 30;

function javascriptIndex() {
  return `window.BAINIAN_BADGES = ${JSON.stringify(manifest, null, 2)};\n`;
}

function readImage(filename, width, height) {
  const image = PNG.sync.read(fs.readFileSync(filename));
  if (image.width !== width || image.height !== height) {
    throw new Error(`${filename}: expected ${width}×${height}, got ${image.width}×${image.height}`);
  }
  for (let i = 3; i < image.data.length; i += 4) {
    if (image.data[i] !== 0 && image.data[i] !== 255) {
      throw new Error(`${filename}: alpha must be 0 or 255`);
    }
  }
  return image;
}

function readBadge(badge) {
  const directory = path.join(root, badge.id);
  const frameDirectory = path.join(directory, "frames");
  const files = badge.frameFiles ?? angles.map(angle => `${String(angle).padStart(3, "0")}.png`);
  if (files.length !== badge.frameCount || badge.angles.length !== files.length ||
      [...files].sort().join(",") !== fs.readdirSync(frameDirectory).filter(file => file.endsWith(".png")).sort().join(",")) {
    throw new Error(`${badge.id}: frames do not match the registered filenames and angles`);
  }
  const { frameWidth: width, frameHeight: height } = badge;
  const images = files.map(file => readImage(path.join(frameDirectory, file), width, height));
  const frontIndex = badge.angles.indexOf(0);
  if (frontIndex < 0) throw new Error(`${badge.id}: missing front angle`);
  const sprite = new PNG({ width: width * images.length, height });
  images.forEach((image, index) => PNG.bitblt(image, sprite, 0, 0, width, height, index * width, 0));
  return { directory, images, sprite, frontIndex };
}

function createPreview({ directory, images, frontIndex }) {
  const version = spawnSync("ffmpeg", ["-version"], { stdio: "ignore" });
  if (version.error?.code === "ENOENT") {
    console.log("FFmpeg is unavailable. Skipped preview.mp4.");
    return;
  }
  if (version.status !== 0) throw new Error("Could not run FFmpeg");

  const front = images[frontIndex];
  const width = front.width + front.width % 2;
  const height = front.height + front.height % 2;
  const frameSize = width * height * 3;
  const video = Buffer.allocUnsafe(frameSize * (spinFrames + holdFrames));
  for (let frame = 0; frame < spinFrames + holdFrames; frame += 1) {
    const progress = 1 - (1 - Math.min(frame / spinFrames, 1)) ** 2;
    const index = (frontIndex + Math.floor(progress * images.length * 2)) % images.length;
    const settled = frame - spinFrames;
    const scale = settled >= 0 && settled < 8 ? 1 + .025 * Math.sin(Math.PI * settled / 8) : 1;
    const image = images[index];
    let target = frame * frameSize;
    for (let y = 0; y < height; y += 1) {
      const srcY = Math.floor((y + .5 - height / 2) / scale + image.height / 2);
      for (let x = 0; x < width; x += 1) {
        const srcX = Math.floor((x + .5 - width / 2) / scale + image.width / 2);
        const source = (srcY * image.width + srcX) * 4;
        const opaque = srcX >= 0 && srcX < image.width && srcY >= 0 && srcY < image.height && image.data[source + 3] === 255;
        video[target++] = opaque ? image.data[source] : 0x12;
        video[target++] = opaque ? image.data[source + 1] : 0x27;
        video[target++] = opaque ? image.data[source + 2] : 0x1e;
      }
    }
  }
  const result = spawnSync("ffmpeg", [
    "-hide_banner", "-loglevel", "error", "-y", "-f", "rawvideo", "-pixel_format", "rgb24",
    "-video_size", `${width}x${height}`, "-framerate", String(fps), "-i", "pipe:0",
    "-an", "-c:v", "libx264", "-pix_fmt", "yuv420p", "-movflags", "+faststart",
    path.join(directory, "preview.mp4")
  ], { input: video, stdio: ["pipe", "inherit", "inherit"] });
  if (result.error || result.status !== 0) throw new Error("FFmpeg could not create preview.mp4");
}

function build(id) {
  const badge = manifest.find(entry => entry.id === id);
  if (!badge) throw new Error("Usage: npm run badge:build -- <chapter-folder>");
  const assets = readBadge(badge);
  fs.writeFileSync(path.join(assets.directory, "sprite.png"), PNG.sync.write(assets.sprite));
  fs.writeFileSync(path.join(assets.directory, "front.png"), PNG.sync.write(assets.images[assets.frontIndex]));
  createPreview(assets);
  fs.writeFileSync(path.join(root, "badges.js"), javascriptIndex());
  console.log(`Built ${badge.id} (${badge.frameCount} frames)`);
}

function check() {
  if (fs.readFileSync(path.join(root, "badges.js"), "utf8") !== javascriptIndex()) {
    throw new Error("badges.js is out of sync with badges.json");
  }
  const ready = manifest.filter(badge => badge.status === "ready");
  for (const badge of ready) {
    const { directory, images, sprite, frontIndex } = readBadge(badge);
    for (const [file, expected] of [["sprite.png", sprite], ["front.png", images[frontIndex]]]) {
      const image = readImage(path.join(directory, file), expected.width, expected.height);
      if (!image.data.equals(expected.data)) throw new Error(`${badge.id}/${file}: rebuild the generated PNG`);
    }
    if (!fs.statSync(path.join(directory, "preview.mp4")).size) throw new Error(`${badge.id}: empty preview`);
    console.log(`OK ${badge.id} (${badge.frameCount} × ${badge.frameWidth}×${badge.frameHeight})`);
  }
  console.log(`Checked ${ready.length} ready badges.`);
}

try {
  const [, , action, id] = process.argv;
  if (action === "build") build(id);
  else if (action === "check") check();
  else throw new Error("Expected build or check");
} catch (error) {
  console.error(error.message);
  process.exitCode = 1;
}
