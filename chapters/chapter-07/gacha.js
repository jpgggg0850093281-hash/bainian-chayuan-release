(() => {
  "use strict";

  const ASSETS = "assets/gacha/";
  const PRIZES = [
    { id: "red", name: "獎品一", description: "紅色扭蛋裡的祭典紀念品。", image: ASSETS + "prize.png", weight: 1, colour: ["#eb7867", "#9d3845"] },
    { id: "blue", name: "獎品二", description: "藍色扭蛋裡的祭典紀念品。", image: ASSETS + "prize.png", weight: 1, colour: ["#87c3d0", "#3a667f"] },
    { id: "green", name: "獎品三", description: "綠色扭蛋裡的祭典紀念品。", image: ASSETS + "prize.png", weight: 1, colour: ["#a7cd80", "#507854"] }
  ];
  const chapters = [
    ["雨後的第一壺茶", "茶寮新手"], ["乾日的水路", "守水人"], ["留得住的手藝", "傳藝人"],
    ["水車下的訪客", "溪畔觀察員"], ["湖岸的約定", "護岸人"], ["茶箱裡的兩封信", "山湖信使"],
    ["同桌的茶", "百年茶緣"]
  ];
  const get = id => document.getElementById(id);
  const canvas = document.querySelector("canvas");
  const ctx = canvas.getContext("2d", { alpha: false });
  ctx.imageSmoothingEnabled = false;
  const status = get("status");
  const action = get("action");
  const handle = get("handle");
  const announcement = get("announcement");
  const award = get("award");
  const params = new URLSearchParams(location.search);
  const dev = params.get("dev") === "1";
  const storageKey = "bainian-gacha-result";
  const reduced = matchMedia("(prefers-reduced-motion: reduce)");
  const tau = Math.PI * 2;
  const colours = PRIZES.map(prize => prize.colour);
  const angles = [0, 60, 120, 180, 240, 300];
  const image = url => Object.assign(new Image(), { src: url });
  const art = {
    background: image(ASSETS + "festival.png"),
    machine: image(ASSETS + "machine-body.png"),
    placeholders: image(ASSETS + "badge-placeholders.png"),
    coin: angles.map(angle => image(ASSETS + "coin/" + String(angle).padStart(3, "0") + ".png"))
  };
  const sprites = [];
  let phase = "loading";
  let prize;
  let skip;
  let render = () => {};
  let audio;

  function read(key) {
    try { return localStorage.getItem(key); } catch { return null; }
  }

  function writeResult(id) {
    try {
      localStorage.setItem(storageKey, id);
      return true;
    } catch {
      return false;
    }
  }

  function rollPrize() {
    let ticket = Math.random() * PRIZES.reduce((sum, item) => sum + item.weight, 0);
    return PRIZES.find(item => (ticket -= item.weight) < 0) ?? PRIZES[0];
  }

  function loadBadges() {
    function applyBadges() {
      for (const badge of window.BAINIAN_BADGES ?? []) {
        const index = badge.chapter - 1;
        chapters[index] = [badge.chapterTitle, badge.name];
        if (badge.sprite) {
          const sprite = image(new URL(badge.sprite, new URL("../../", location.href)).href);
          sprite.addEventListener("load", () => render());
          sprites[index] = { ...badge, sprite };
        }
      }
    }
    if (window.BAINIAN_BADGES) return applyBadges();
    const script = document.createElement("script");
    script.src = "../../assets/badges/badges.js";
    script.addEventListener("load", applyBadges);
    document.head.append(script);
  }

  function resize() {
    const width = Math.min(innerWidth - 16, (innerHeight - 220) * 480 / 270);
    const scale = Math.max(1, Math.floor(width / 480));
    document.documentElement.style.setProperty("--stage-width", `${scale * 480}px`);
  }

  function paint(img, ...coordinates) {
    if (img.complete && img.naturalWidth > 0) ctx.drawImage(img, ...coordinates.map(Math.round));
  }

  function rect(x, y, w, h, colour) {
    ctx.fillStyle = colour;
    ctx.fillRect(Math.round(x), Math.round(y), Math.max(1, Math.round(w)), Math.max(1, Math.round(h)));
  }

  function oval(x, y, rx, ry, colour) {
    for (let row = -ry; row <= ry; row++) {
      const half = Math.floor(rx * Math.sqrt(1 - (row / ry) ** 2));
      rect(x - half, y + row, half * 2 + 1, 1, colour);
    }
  }

  function pixelRay(x, y, direction, from, to, colour) {
    for (let r = from; r < to; r += 2) {
      rect(x + Math.cos(direction) * r, y + Math.sin(direction) * r, 2, 2, colour);
    }
  }

  function rays(x, y, radius, time) {
    for (let i = 0; i < 14; i++) {
      pixelRay(x, y, i * tau / 14 + time, radius * .68, radius + (i % 3) * 7, "#c99453");
    }
  }

  function particles(x, y, progress) {
    for (let i = 0; i < 30; i++) {
      const angle = i * 2.399963;
      const distance = 12 + progress * (22 + i % 9 * 8);
      rect(x + Math.cos(angle) * distance, y + Math.sin(angle) * distance, i % 4 + 1, i % 4 + 1,
        i % 3 ? "#e9b866" : "#fff3b6");
    }
  }

  function background() {
    rect(0, 0, 480, 270, "#12271e");
    paint(art.background, 0, 0);
  }

  function capsule(x, y, radius, colour, split = false, lid = false) {
    if (split) {
      for (let dy = 0; dy <= radius; dy++) {
        const dx = Math.floor(radius * Math.sqrt(1 - (dy / radius) ** 2));
        rect(x - dx, y + (lid ? -dy : dy), 2 * dx + 1, 1, "#342326");
        if (dx > 1 && dy < radius) rect(x - dx + 1, y + (lid ? -dy : dy), 2 * dx - 1, 1, colour[lid ? 0 : 1]);
      }
      rect(x - radius + 2, y, radius * 2 - 3, 1, "#e5c39b");
      return;
    }
    oval(x, y, radius, radius, "#342326");
    oval(x, y, radius - 1, radius - 1, colour[1]);
    oval(x, y - Math.floor(radius * .25), radius - 3, Math.floor(radius * .6), colour[0]);
    rect(x - radius + 2, y, radius * 2 - 3, 1, "#342326");
    rect(x - Math.round(radius / 2), y - Math.round(radius / 2), Math.round(radius * .48), 2, "#fff0c1");
  }

  const balls = [[38, 92], [57, 98], [76, 96], [96, 98], [115, 91], [47, 77], [67, 80],
    [87, 79], [106, 77], [60, 62], [81, 62], [99, 62]];

  function machine(turn = 0, shutter = false) {
    background();
    const x = 164 + Math.sin(turn * tau * 3) * Math.sin(turn * Math.PI) * 5;
    const y = 18;
    paint(art.machine, x, y);
    const tumble = Math.sin(turn * Math.PI);
    balls.forEach(([bx, by], i) => {
      const dx = Math.sin(turn * tau * 2 + i) * 7 * tumble;
      const dy = Math.abs(Math.sin(turn * tau * 2 + i * .9)) * -16 * tumble;
      capsule(x + bx + dx, y + by + dy, 11, colours[i % colours.length]);
    });
    oval(x + 76, y + 166, 14, 14, "#27181b");
    oval(x + 76, y + 166, 12, 12, "#d2a76c");
    pixelRay(x + 76, y + 166, turn * tau + Math.PI / 2, -9, 9, "#63422c");
    pixelRay(x + 75, y + 166, turn * tau + Math.PI / 2, -7, 7, "#ffe0a0");
    if (shutter) {
      rect(160, 20, 160, 209, "#421f2d");
      for (let i = 0; i < 8; i++) {
        rect(161 + i * 20, 22, 18, 202, i % 2 ? "#783d4b" : "#8c4953");
        rect(161 + i * 20, 22, 2, 202, "#b7625c");
      }
      rect(161, 213, 158, 3, "#d2a66c");
      rect(154, 19, 172, 5, "#dcaf71");
      rect(217, 110, 46, 38, "#4b2634");
      rect(224, 116, 32, 25, "#a57056");
      rect(234, 121, 12, 15, "#4b2634");
      rect(236, 118, 8, 4, "#4b2634");
    }
  }

  const frameAt = angle => Math.round(angle / 60) % 6;
  const ease = p => 1 - (1 - p) ** 3;
  const clamp = p => Math.max(0, Math.min(1, p));
  const mix = (a, b, p) => a + (b - a) * p;

  function coin(x, y, size, angle = 0, width = size) {
    paint(art.coin[frameAt(angle)], x - width / 2, y - size / 2, width, size);
  }

  function badge(index, x, y, size, angle) {
    const frame = frameAt(angle);
    const entry = sprites[index];
    if (entry?.sprite.naturalWidth === entry?.frameWidth * 6 && entry.sprite.naturalHeight === entry.frameHeight) {
      paint(entry.sprite, frame * entry.frameWidth, 0, entry.frameWidth, entry.frameHeight,
        x - size / 2, y - size / 2, size, size);
    } else {
      paint(art.placeholders, frame * 32, index * 32, 32, 32, x - size / 2, y - size / 2, size, size);
    }
  }

  function show(text, buttonText, next) {
    status.textContent = text;
    action.hidden = !buttonText;
    action.textContent = buttonText ?? "";
    action.onclick = next ?? null;
    handle.hidden = phase !== "handle";
  }

  function hold(draw) {
    render = draw;
    render();
  }

  function animate(duration, draw, done) {
    render = () => {};
    const origin = performance.now();
    const quiet = reduced.matches;
    let frame;
    function finish() {
      if (skip !== finish) return;
      cancelAnimationFrame(frame);
      skip = null;
      draw(1);
      done();
    }
    function tick(now) {
      const p = clamp((now - origin) / (quiet ? 180 : duration));
      if (p >= 1) return finish();
      if (quiet) {
        draw(1);
        ctx.globalAlpha = 1 - p;
        rect(0, 0, 480, 270, "#12271e");
        ctx.globalAlpha = 1;
      } else {
        draw(p);
      }
      frame = requestAnimationFrame(tick);
    }
    skip = finish;
    frame = requestAnimationFrame(tick);
  }

  function ring(p, fusing = false) {
    background();
    rect(0, 0, 480, 270, "#10221dbe");
    if (fusing && p > .87) {
      const burst = (p - .87) / .13;
      const shakePhase = clamp(burst * 260 / 200);
      const shake = Math.round(Math.sin(shakePhase * tau * 3) * (1 - shakePhase) * 3);
      paint(art.background, shake, 0);
      rect(0, 0, 480, 270, "#10221dbe");
      particles(240 + shake, 131, burst);
      ctx.globalAlpha = (1 - burst) ** 2;
      rect(0, 0, 480, 270, "#fffbea");
      ctx.globalAlpha = 1;
      return;
    }
    const count = fusing ? 7 : Math.min(7, Math.floor(p * 7) + 1);
    const t = fusing ? p / .87 : 0;
    for (let i = 0; i < count; i++) {
      const theta = i * tau / 7 - Math.PI / 2 + t * t * tau * 2.5;
      const r = 88 * (1 - t);
      const x = 240 + Math.cos(theta) * r * 1.42;
      const y = 133 + Math.sin(theta) * r;
      if (fusing) {
        for (let trail = 10; trail >= 1; trail--) {
          const behind = theta - trail * .033;
          rect(240 + Math.cos(behind) * (r + trail) * 1.42, 133 + Math.sin(behind) * (r + trail),
            2 + Math.floor((10 - trail) / 3), 2, trail < 5 ? "#f0b864" : "#af783e");
        }
      }
      const pop = fusing ? 1 - .28 * t : .45 + .55 * ease(clamp((p * 7 - i) * 2));
      badge(i, x, y, 68 * pop, t * 1440);
    }
  }

  function intro() {
    phase = "intro";
    let last = -1;
    show("", "略過動畫", () => skip?.());
    animate(2800, p => {
      ring(p);
      const index = Math.min(6, Math.floor(p * 7));
      if (index !== last) {
        status.textContent = chapters[index].join("・");
        last = index;
      }
    }, fusion);
  }

  function fusion() {
    phase = "fusion";
    show("七枚徽章正在融合", "略過動畫", () => skip?.());
    animate(2000, p => ring(p, true), revealCoin);
  }

  function revealCoin() {
    phase = "coin";
    show("七枚徽章化為一枚扭蛋硬幣", "略過動畫", () => skip?.());
    function draw(p) {
      background();
      rect(0, 0, 480, 270, "#10221dbb");
      rays(240, 133, 90, p * .4);
      const spin = clamp(p / .84);
      const bounce = p > .84 ? Math.sin((p - .84) / .16 * Math.PI) * .06 : 0;
      coin(240, 133, 134 * (.18 + .82 * ease(spin) + bounce), 720 * ease(spin));
    }
    animate(1400, draw, () => {
      hold(() => draw(1));
      show("七枚徽章化為一枚扭蛋硬幣", "投幣", () => {
        prepareAudio();
        insert();
      });
    });
  }

  function prepareAudio() {
    try {
      const Audio = window.AudioContext ?? window.webkitAudioContext;
      audio ??= new Audio();
      audio.resume().catch(() => {});
    } catch {
      // Visual slot feedback also works without an audio device.
    }
  }

  function ding() {
    if (audio?.state !== "running") return;
    const tone = audio.createOscillator();
    const gain = audio.createGain();
    const t = audio.currentTime;
    tone.frequency.value = 1330;
    gain.gain.setValueAtTime(.1, t);
    gain.gain.exponentialRampToValueAtTime(.001, t + .22);
    tone.connect(gain).connect(audio.destination);
    tone.start(t);
    tone.stop(t + .23);
  }

  function insert() {
    phase = "insert";
    show("硬幣正在滑入投幣口", "略過動畫", () => skip?.());
    animate(1050, p => {
      machine();
      const arc = ease(clamp(p / .78));
      const slot = clamp((p - .78) / .22);
      if (p < .97) coin(mix(69, 277, arc), mix(176, 161, arc) - 66 * Math.sin(arc * Math.PI),
        mix(62, 20, arc) * (1 - slot * .8), 780 * arc, mix(62, 12, arc) * (1 - slot * .9));
      if (p > .82) {
        ctx.globalAlpha = clamp((p - .82) * 9);
        rays(277, 161, 12, 0);
        ctx.globalAlpha = 1;
      }
    }, () => {
      ding();
      phase = "handle";
      hold(machine);
      show("轉動把手", "轉動把手", turn);
      action.focus({ preventScroll: true });
    });
  }

  function turn() {
    phase = "turn";
    show("扭蛋正在翻滾", "略過動畫", () => skip?.());
    animate(900, p => machine(ease(p)), drop);
  }

  function drop() {
    if (!dev) {
      const stored = read(storageKey);
      if (stored) return finishStored(stored);
    }
    const selected = rollPrize();
    const storageAvailable = dev || writeResult(selected.id);
    if (!storageAvailable) {
      phase = "error";
      hold(machine);
      show("無法儲存抽獎進度，請開啟瀏覽器的本機儲存功能。");
      return;
    }
    prize = selected;
    phase = "drop";
    show("扭蛋從機器滾出來了", "略過動畫", () => skip?.());
    const draw = p => {
      machine();
      if (p >= .45) rect(0, 0, 480, 270, "#10221d70");
      const travel = ease(clamp((p - .35) / .65));
      const roll = clamp(p / .35);
      capsule(240 + 30 * Math.sin(roll * Math.PI * .8) * (1 - travel),
        mix(215 + roll * 20, 132, travel) - Math.sin(travel * Math.PI) * 24,
        Math.round(mix(12, 57, travel)), prize.colour);
    };
    animate(1100, draw, () => {
      phase = "capsule";
      hold(() => draw(1));
      show("扭蛋已經掉出來了", "點一下打開", openCapsule);
      action.focus({ preventScroll: true });
    });
  }

  function openCapsule() {
    phase = "opening";
    show("打開扭蛋", "略過動畫", () => skip?.());
    animate(1050, p => {
      machine();
      rect(0, 0, 480, 270, "#10221da0");
      if (p < .32) {
        capsule(240 + 6 * Math.sin(p / .32 * tau * 2), 132, 57, prize.colour);
        return;
      }
      const t = ease((p - .32) / .68);
      rays(240, 125, 62, t);
      particles(240, 124, t);
      capsule(240, 143, 57, prize.colour, true);
      const x = mix(240, 342, t);
      const y = mix(141, 189, t) - Math.sin(t * Math.PI) * 91;
      ctx.save();
      ctx.translate(Math.round(x), Math.round(y));
      ctx.rotate(t * 3.4);
      capsule(0, 0, 57, prize.colour, true, true);
      ctx.restore();
    }, showPrize);
  }

  function showPrize() {
    phase = "prize";
    get("prize-image").src = prize.image;
    get("prize-name").textContent = "獲得" + prize.name;
    get("prize-description").textContent = prize.description;
    get("again").disabled = !dev;
    show("祭典扭蛋已開啟");
    award.showModal();
    get("accept").focus({ preventScroll: true });
  }

  function finishStored(id) {
    phase = "done";
    hold(machine);
    const recorded = PRIZES.find(item => item.id === id);
    show(recorded ? "已獲得" + recorded.name : "本次祭典已抽獎", recorded ? "查看獎品" : null, () => {
      prize = recorded;
      showPrize();
    });
  }

  for (const dialog of [announcement, award]) dialog.addEventListener("cancel", event => event.preventDefault());
  canvas.addEventListener("click", () => phase === "capsule" ? openCapsule() : skip?.());
  handle.addEventListener("click", turn);
  get("start").addEventListener("click", () => {
    prepareAudio();
    announcement.close();
    intro();
  });
  get("accept").addEventListener("click", () => {
    award.close();
    finishStored(prize.id);
  });
  get("again").addEventListener("click", () => {
    if (!dev) return;
    award.close();
    revealCoin();
  });
  addEventListener("resize", resize);
  resize();
  loadBadges();

  const jumps = { fusion, coin: revealCoin, insert, capsule: drop, prize: () => { prize = rollPrize(); showPrize(); } };
  Promise.all([art.background, art.machine, art.placeholders, ...art.coin].map(img => img.decode())).then(() => {
    const completed = chapters.filter((_, i) => read(`bainian-chapter-0${i + 1}`) === "done").length;
    const stored = read(storageKey);
    hold(() => machine(0, !dev && completed !== 7));
    if (!dev && completed !== 7) show(`已收集 ${completed}／7 枚徽章，集齊後開放扭蛋機。`);
    else if (!dev && stored) finishStored(stored);
    else if (dev && Object.hasOwn(jumps, params.get("step"))) jumps[params.get("step")]();
    else {
      show("已收集 7／7 枚徽章");
      announcement.showModal();
    }
  }).catch(() => show("扭蛋素材載入失敗，請重新開啟本頁。"));
})();
