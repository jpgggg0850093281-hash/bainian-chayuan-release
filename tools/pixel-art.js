const fs = require('node:fs');
const path = require('node:path');
const { PNG } = require('pngjs');

const root = path.resolve(__dirname, '..');
const load = file => JSON.parse(fs.readFileSync(path.join(root, file), 'utf8').replace(/^\uFEFF/, ''));
const readPng = file => PNG.sync.read(fs.readFileSync(file));
const bayer = [0, 8, 2, 10, 12, 4, 14, 6, 3, 11, 1, 9, 15, 7, 13, 5];

function lanczos(x) {
  x = Math.abs(x);
  if (x < 1e-8) return 1;
  if (x >= 3) return 0;
  return Math.sin(Math.PI * x) * Math.sin(Math.PI * x / 3) / (Math.PI * Math.PI * x * x / 3);
}

function sampleAxis(inputSize, outputSize) {
  const scale = Math.max(1, inputSize / outputSize);
  return Array.from({ length: outputSize }, (_, i) => {
    const center = (i + .5) * inputSize / outputSize - .5;
    const first = Math.max(0, Math.ceil(center - 3 * scale));
    const last = Math.min(inputSize - 1, Math.floor(center + 3 * scale));
    return { first, weights: Array.from({ length: last - first + 1 }, (_, j) => lanczos((first + j - center) / scale)) };
  });
}

function render(input, width, height, palette, dither = true) {
  const output = new PNG({ width, height });
  const columns = sampleAxis(input.width, width);
  const rows = sampleAxis(input.height, height);
  for (let y = 0; y < height; y++) {
    const row = rows[y];
    for (let x = 0; x < width; x++) {
      const column = columns[x];
      let r = 0, g = 0, b = 0, opacity = 0, total = 0;
      for (let j = 0; j < row.weights.length; j++) {
        const start = ((row.first + j) * input.width + column.first) * 4;
        for (let i = 0; i < column.weights.length; i++) {
          const offset = start + i * 4;
          const weight = row.weights[j] * column.weights[i];
          const alpha = input.data[offset + 3] / 255;
          total += weight;
          opacity += weight * alpha;
          r += weight * alpha * input.data[offset];
          g += weight * alpha * input.data[offset + 1];
          b += weight * alpha * input.data[offset + 2];
        }
      }
      const offset = (y * width + x) * 4;
      if (opacity / total < .5) {
        output.data.fill(255, offset, offset + 3);
        output.data[offset + 3] = 0;
        continue;
      }
      const rgb = [r / opacity, g / opacity, b / opacity];
      const color = palette ? nearest(rgb, palette, x, y, dither) :
        rgb.map(value => Math.max(0, Math.min(255, Math.round(value))));
      output.data.set(color, offset);
      output.data[offset + 3] = 255;
    }
  }
  return output;
}

function nearest([r, g, b], palette, x, y, enabled) {
  const dither = enabled ? (bayer[(y % 4) * 4 + x % 4] - 7.5) * .85 : 0;
  r = r + dither;
  g = g + dither;
  b = b + dither;
  let best = palette[0];
  let distance = Infinity;
  for (const color of palette) {
    const dr = r - color[0], dg = g - color[1], db = b - color[2];
    const score = dr * dr * .25 + dg * dg * .55 + db * db * .20;
    if (score < distance) {
      best = color;
      distance = score;
    }
  }
  return best;
}

function colorBox(samples) {
  const low = [255, 255, 255], high = [0, 0, 0];
  let count = 0;
  for (const { rgb, weight } of samples) {
    count += weight;
    rgb.forEach((value, channel) => {
      low[channel] = Math.min(low[channel], value);
      high[channel] = Math.max(high[channel], value);
    });
  }
  const ranges = high.map((value, channel) => value - low[channel]);
  const range = Math.max(...ranges);
  return { samples, count, channel: ranges.indexOf(range), score: samples.length > 1 ? range * count : 0 };
}

function adaptivePalette(image, limit) {
  const histogram = new Map();
  for (let offset = 0; offset < image.data.length; offset += 4) {
    if (image.data[offset + 3] === 0) continue;
    const color = image.data.readUIntBE(offset, 3);
    histogram.set(color, (histogram.get(color) ?? 0) + 1);
  }
  if (!histogram.size) return [];
  const boxes = [colorBox(Array.from(histogram, ([color, weight]) =>
    ({ rgb: [color >> 16, (color >> 8) & 255, color & 255], weight })))];
  while (boxes.length < limit) {
    const best = boxes.reduce((index, box, i) => box.score > boxes[index].score ? i : index, 0);
    const { samples, count, channel, score } = boxes[best];
    if (!score) break;
    samples.sort((a, b) => a.rgb[channel] - b.rgb[channel]);
    let split = 0, weight = 0;
    do { weight += samples[split++].weight; } while (weight < count / 2 && split < samples.length - 1);
    boxes.splice(best, 1, colorBox(samples.slice(0, split)), colorBox(samples.slice(split)));
  }
  return boxes.map(({ samples, count }) => [0, 1, 2].map(channel =>
    Math.round(samples.reduce((sum, sample) => sum + sample.rgb[channel] * sample.weight, 0) / count)));
}

function renderAdaptive(input, width, height, limit, dither) {
  const output = render(input, width, height, null);
  const palette = adaptivePalette(output, limit);
  for (let offset = 0; offset < output.data.length; offset += 4) {
    if (output.data[offset + 3] === 0) continue;
    const pixel = offset / 4;
    const rgb = output.data.subarray(offset, offset + 3);
    output.data.set(nearest(rgb, palette, pixel % width, Math.floor(pixel / width), dither), offset);
  }
  return output;
}

function check(image, width, height, accepted, limit) {
  if (image.width !== width || image.height !== height) return 'wrong dimensions';
  const used = new Set();
  for (let offset = 0; offset < image.data.length; offset += 4) {
    const alpha = image.data[offset + 3];
    const pixel = offset / 4;
    const position = `${pixel % width},${Math.floor(pixel / width)}`;
    if (alpha !== 0 && alpha !== 255) return `partial opacity at ${position}`;
    if (alpha === 0) continue;
    const color = image.data.readUIntBE(offset, 3);
    if (limit === undefined) {
      if (!accepted.has(color)) return 'color outside palette at ' + position;
    } else {
      used.add(color);
      if (used.size > limit) return 'more than ' + limit + ' colors';
    }
  }
  return null;
}

function run(mode) {
  if (mode !== 'pixelize' && mode !== 'check') throw new Error('Usage: node tools/pixel-art.js pixelize|check');
  const manifest = load('assets/sizes.json');
  const colors = load('src/assets/palette.json').map(color => color.toLowerCase());
  if (colors.length !== 48 || new Set(colors).size !== 48 || colors.some(color => !/^#[0-9a-f]{6}$/.test(color))) {
    throw new Error('Palette must contain 48 unique colors.');
  }
  const accepted = new Set(colors.map(color => parseInt(color.slice(1), 16)));
  const palette = [...accepted].map(color => [color >> 16, (color >> 8) & 255, color & 255]);
  const destination = path.join(root, 'assets/game');
  const source = mode === 'pixelize' ? path.join(root, 'assets/raw') : destination;
  const files = fs.readdirSync(source, { withFileTypes: true }).filter(file => file.isFile()).map(file => file.name).sort();
  let failed = false;
  function fail(file, message) {
    console.error(`FAIL ${file}: ${message}`);
    failed = true;
  }
  if (mode === 'check') {
    for (const file of Object.keys(manifest)) {
      if (!files.includes(file)) fail(file, 'missing');
    }
  }
  for (const file of files) {
    const size = Object.hasOwn(manifest, file) && manifest[file];
    if (!size || path.extname(file).toLowerCase() !== '.png') {
      fail(file, 'no PNG size entry');
      continue;
    }
    const settings = Array.isArray(size) ? { size } : size;
    const { size: dimensions, colors: limit, dither = true } = settings;
    if (!Array.isArray(dimensions) || dimensions.length !== 2 ||
        !dimensions.every(value => Number.isSafeInteger(value) && value > 0) ||
        (limit !== undefined && (!Number.isInteger(limit) || limit < 1 || limit > 128)) ||
        typeof dither !== 'boolean') {
      fail(file, 'invalid size, colors (1–128), or dither setting');
      continue;
    }
    const [width, height] = dimensions;
    const image = readPng(path.join(source, file));
    if (mode === 'pixelize') {
      const output = limit === undefined ? render(image, width, height, palette, dither) :
        renderAdaptive(image, width, height, limit, dither);
      fs.writeFileSync(path.join(destination, file), PNG.sync.write(output));
      console.log(`Rendered ${file} ${width}x${height}`);
    } else {
      const error = check(image, width, height, accepted, limit);
      if (error) fail(file, error);
      else console.log(`PASS ${file}`);
    }
  }
  if (failed) process.exitCode = 1;
}

try {
  run(process.argv[2]);
} catch (error) {
  console.error(error.message);
  process.exitCode = 1;
}
