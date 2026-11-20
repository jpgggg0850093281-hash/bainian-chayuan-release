// Run from a repository checkout with npm install.
const fs = require("node:fs");
const path = require("node:path");
const { PNG } = require("pngjs");

const make = (width, height) => new PNG({ width, height });
const ink = "#27181b";
const gold = "#f7cc72";
const darkGold = "#975224";

function rect(p, x, y, w, h, hex) {
  const colour = Number.parseInt(hex.slice(1), 16);
  for (let j = Math.max(0, y); j < Math.min(y + h, p.height); j++) {
    for (let i = Math.max(0, x); i < Math.min(x + w, p.width); i++) {
      const at = (j * p.width + i) * 4;
      p.data[at] = colour >> 16;
      p.data[at + 1] = colour >> 8;
      p.data[at + 2] = colour;
      p.data[at + 3] = 255;
    }
  }
}

function oval(p, x, y, rx, ry, colour) {
  for (let dy = -ry; dy <= ry; dy++) {
    const dx = Math.floor(rx * Math.sqrt(1 - (dy / ry) ** 2));
    rect(p, x - dx, y + dy, dx * 2 + 1, 1, colour);
  }
}

function shape(p, x, y, pattern, colour) {
  pattern.split("/").forEach((line, j) => [...line].forEach((bit, i) => {
    if (bit === "1") rect(p, x + i, y + j, 1, 1, colour);
  }));
}

function save(p, file) {
  fs.writeFileSync(path.join(__dirname, file), PNG.sync.write(p));
}

const bg = make(480, 270);
rect(bg, 0, 0, 480, 270, "#13292c");
rect(bg, 0, 64, 480, 89, "#214044");
rect(bg, 0, 143, 480, 127, "#263c34");
oval(bg, 355, 44, 16, 16, "#e5b578");
for (const [x, y, width] of [[25, 139, 96], [131, 151, 111], [334, 144, 142], [438, 156, 73]]) {
  oval(bg, x, y, width, 65, "#28474a");
  oval(bg, x, y + 23, width, 43, "#1b3638");
}
for (let y = 164; y < 270; y += 10) {
  rect(bg, 0, y, 480, 1, "#182e29");
  for (let x = (y % 3) * 15; x < 480; x += 46) rect(bg, x, y, 1, 10, "#182e29");
}
for (const x of [75, 405]) {
  rect(bg, x - 38, 28, 76, 6, "#432d29");
  rect(bg, x - 31, 34, 4, 135, "#47382c");
  rect(bg, x + 27, 34, 4, 135, "#47382c");
  rect(bg, x, 34, 1, 15, "#311c23");
  oval(bg, x, 58, 14, 15, "#573e32");
  oval(bg, x, 58, 11, 12, "#ba5235");
  oval(bg, x, 57, 7, 10, "#f1a453");
  rect(bg, x - 7, 45, 15, 2, "#614633");
  rect(bg, x - 7, 70, 15, 2, "#614633");
  rect(bg, x, 73, 1, 7, "#e0874c");
  rect(bg, x - 42, 153, 84, 7, "#a66d4a");
  rect(bg, x - 39, 160, 78, 5, "#5e3f34");
  rect(bg, x - 31, 165, 6, 56, "#5e3f34");
  rect(bg, x + 25, 165, 6, 56, "#5e3f34");
  for (const dx of [-23, 10, 24]) {
    oval(bg, x + dx, 145, 7, 6, "#584335");
    oval(bg, x + dx, 144, 5, 4, "#b98353");
    rect(bg, x + dx - 4, 146, 9, 4, "#764f3a");
  }
}
save(bg, "festival.png");

const machine = make(152, 232);
oval(machine, 76, 225, 74, 6, "#162520");
rect(machine, 12, 116, 128, 107, ink);
rect(machine, 13, 117, 126, 105, "#942f35");
rect(machine, 15, 120, 12, 99, "#c04a42");
rect(machine, 31, 126, 95, 82, "#d05a49");
rect(machine, 30, 127, 1, 80, "#762732");
rect(machine, 126, 127, 1, 80, "#762732");
rect(machine, 13, 211, 126, 10, "#622831");
rect(machine, 23, 216, 106, 2, "#c15042");
oval(machine, 76, 182, 22, 18, "#a54238");
rect(machine, 49, 185, 55, 28, ink);
rect(machine, 53, 189, 47, 20, "#3c2728");
rect(machine, 57, 204, 39, 3, "#674335");
rect(machine, 101, 135, 22, 18, ink);
rect(machine, 102, 136, 20, 16, "#dab56f");
rect(machine, 111, 138, 3, 11, "#45302c");
oval(machine, 76, 66, 65, 63, ink);
oval(machine, 76, 66, 64, 62, "#88ad9d");
oval(machine, 76, 66, 60, 58, "#426564");
oval(machine, 76, 68, 56, 54, "#365153");
rect(machine, 21, 61, 3, 16, "#bad0ad");
rect(machine, 29, 37, 4, 12, "#bad0ad");
rect(machine, 34, 30, 6, 5, "#bad0ad");
rect(machine, 46, 22, 14, 3, "#a2bbaa");
rect(machine, 40, 0, 72, 9, ink);
rect(machine, 41, 1, 70, 7, "#ba503b");
rect(machine, 11, 116, 130, 9, ink);
rect(machine, 12, 117, 128, 7, "#bf4f40");
rect(machine, 22, 118, 109, 2, "#e78356");
save(machine, "machine-body.png");

const colours = [["#eb7867", "#9d3845"], ["#87c3d0", "#3a667f"], ["#a7cd80", "#507854"]];
const filledMachine = make(152, 232);
machine.data.copy(filledMachine.data);
for (const [i, [x, y]] of [[38, 92], [57, 98], [76, 96], [96, 98], [115, 91],
  [47, 77], [67, 80], [87, 79], [106, 77], [60, 62], [81, 62], [99, 62]].entries()) {
  const [light, dark] = colours[i % 3];
  oval(filledMachine, x, y, 11, 11, ink);
  oval(filledMachine, x, y, 10, 10, dark);
  oval(filledMachine, x, y - 3, 8, 6, light);
  rect(filledMachine, x - 6, y - 6, 4, 2, "#f6e5bb");
}
oval(filledMachine, 76, 166, 14, 14, ink);
oval(filledMachine, 76, 166, 12, 12, "#d2a76c");
rect(filledMachine, 71, 158, 10, 16, "#563829");
rect(filledMachine, 73, 159, 6, 13, "#f4d595");
save(filledMachine, "machine.png");

const box = make(48, 48);
rect(box, 5, 15, 38, 29, ink);
rect(box, 6, 16, 36, 27, "#883c42");
rect(box, 9, 22, 31, 19, "#ae5052");
rect(box, 4, 14, 40, 9, ink);
rect(box, 5, 15, 38, 7, "#d97962");
rect(box, 22, 10, 4, 32, gold);
oval(box, 18, 11, 5, 4, darkGold);
oval(box, 30, 11, 5, 4, darkGold);
shape(box, 28, 26, "01110/10001/00010/00100/00100/00000/00100", "#ffe6a8");
save(box, "prize.png");

const emblems = [
  "00100/01110/11111/01111/00110",
  "01110/01010/01110/01010/01110",
  "11011/11111/10101/11111/01010",
  "11111/10001/10101/10001/11111",
  "01110/11111/10101/10101/11111",
  "11111/11011/10101/10001/11111",
  "11001/10011/10001/01110/11111"
];
const characters = [
  "1111111/0001000/0111110/0100010/0111110/0100010/0111110",
  "0100000/1111110/0101000/0111110/0101000/1111111/0001000",
  "0100100/1111110/0010000/0101000/1111110/0011100/0101010",
  "0101110/1001010/1111110/0100100/1011110/0101010/1111101"
];
const summary = make(444, 92);
rect(summary, 0, 0, 444, 92, "#12271e");
fs.mkdirSync(path.join(__dirname, "coin"), { recursive: true });
const digits = ["111/101/101/101/111", "010/110/010/010/111", "111/001/111/100/111",
  "111/001/111/001/111", "101/101/111/001/001", "111/100/111/001/111", "111/100/111/101/111",
  "111/001/010/010/010", "111/101/111/101/111", "111/101/111/001/111"];

for (const [index, angle] of [0, 60, 120, 180, 240, 300].entries()) {
  const back = angle >= 120 && angle <= 240;
  const face = make(64, 64);
  oval(face, 32, 32, 30, 30, ink);
  oval(face, 32, 32, 29, 29, darkGold);
  oval(face, 32, 31, 28, 27, gold);
  oval(face, 32, 32, 21, 21, "#cc8a42");
  oval(face, 32, 31, 20, 20, "#edb45a");
  if (back) {
    characters.forEach((pattern, i) => shape(face, 20 + i % 2 * 16, 20 + Math.floor(i / 2) * 14, pattern, "#633f29"));
    oval(face, 15, 34, 2, 7, "#a96832");
    oval(face, 49, 34, 2, 7, "#a96832");
  } else {
    oval(face, 32, 37, 16, 6, "#ad6737");
    oval(face, 29, 35, 9, 4, "#5b6744");
    oval(face, 36, 34, 8, 5, "#667451");
    oval(face, 32, 25, 10, 2, "#ffe59b");
    oval(face, 28, 22, 3, 2, "#728045");
    oval(face, 36, 20, 4, 2, "#728045");
    emblems.forEach((pattern, i) => {
      const t = i * Math.PI * 2 / 7 - Math.PI / 2;
      shape(face, Math.round(30 + Math.cos(t) * 25), Math.round(30 + Math.sin(t) * 25), pattern, darkGold);
    });
  }

  const frame = make(64, 64);
  const oblique = angle !== 0 && angle !== 180;
  const width = oblique ? Math.round(61 * .62) : 61;
  const side = angle === 60 || angle === 240 ? 1 : -1;
  const start = Math.floor((64 - width - (oblique ? 4 : 0)) / 2) + (oblique && side < 0 ? 4 : 0);
  for (let y = 0; y < 64; y++) {
    let edge = undefined;
    for (let x = 0; x < width; x++) {
      const sx = 2 + Math.round(x * 60 / (width - 1));
      const from = (y * 64 + sx) * 4;
      if (!face.data[from + 3]) continue;
      face.data.copy(frame.data, (y * 64 + start + x) * 4, from, from + 4);
      if (edge === undefined || side > 0) edge = start + x;
    }
    if (oblique && edge !== undefined) {
      const thickness = Math.min(4, 1 + y - 2, 1 + 62 - y);
      for (let d = 0; d <= thickness; d++) {
        rect(frame, edge + d * side, y, 1, 1, d === thickness ? ink : y % 4 < 2 ? "#ac6a36" : "#d79c4f");
      }
    }
  }
  save(frame, `coin/${String(angle).padStart(3, "0")}.png`);
  for (let y = 0; y < 64; y++) {
    for (let x = 0; x < 64; x++) {
      const from = (y * 64 + x) * 4;
      if (frame.data[from + 3]) frame.data.copy(summary.data, ((y + 5) * 444 + index * 74 + x + 5) * 4, from, from + 4);
    }
  }
  [...String(angle)].forEach((digit, i) => shape(summary, index * 74 + 31 + (i - 1) * 4, 78, digits[digit], gold));
  shape(summary, index * 74 + 31 + (String(angle).length - 1) * 4, 76, "11/11", gold);
}
save(summary, "coin-frames.png");

const standIns = make(6 * 32, 7 * 32);
for (let i = 0; i < emblems.length; i++) {
  for (let frame = 0; frame < 6; frame++) {
    const x = frame * 32 + 16, y = i * 32 + 16;
    const width = frame % 3 === 0 ? 13 : 8;
    oval(standIns, x, y, width, 13, ink);
    oval(standIns, x, y, width - 1, 12, darkGold);
    oval(standIns, x, y - 1, width - 2, 10, gold);
    shape(standIns, x - 2, y - 3, emblems[i], "#5d4932");
  }
}
save(standIns, "badge-placeholders.png");
