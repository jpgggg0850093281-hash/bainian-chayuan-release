(() => {
  "use strict";
  const root = new URL("../../", document.currentScript.src);
  const queue = [];
  const chapterNumbers = "一二三四五六七";
  const timing = { open: 250, fly: 600, spin: 900, settle: 220, close: 230 };
  const motion = matchMedia("(prefers-reduced-motion: reduce)");
  let active = false;
  let dialog;

  function createDialog() {
    dialog = document.createElement("dialog");
    dialog.className = "badge-award";
    dialog.setAttribute("aria-labelledby", "badge-award-title");
    dialog.innerHTML = `
      <section class="badge-award__card">
        <h2 id="badge-award-title">獲得徽章</h2>
        <div class="badge-award__space" aria-hidden="true"></div>
        <div class="badge-award__details" aria-live="polite">
          <p class="badge-award__chapter"></p>
          <p class="badge-award__name"></p>
          <p class="badge-award__description"></p>
        </div>
        <button class="badge-award__accept" type="button" hidden>收下</button>
      </section>
      <canvas class="badge-award__effects" aria-hidden="true"></canvas>`;
    dialog.addEventListener("cancel", event => event.preventDefault());
    document.body.append(dialog);
    return dialog;
  }

  const easeOut = value => 1 - (1 - value) ** 3;
  const clamp = value => Math.max(0, Math.min(1, value));

  function nearestFrame(badge, angle) {
    const target = ((angle % 360) + 360) % 360;
    let best = Infinity;
    let frame = 0;
    badge.angles.forEach((candidate, index) => {
      if (candidate === null) return;
      const delta = Math.abs(candidate - target);
      const distance = Math.min(delta, 360 - delta);
      if (distance < best) {
        best = distance;
        frame = index;
      }
    });
    return frame;
  }

  function paintLight(ctx, x, y, size, time) {
    for (let i = 0; i < 12; i += 1) {
      const angle = i * Math.PI / 6 + time / 3200;
      ctx.fillStyle = i % 2 ? "#d69a3b40" : "#ffc76b58";
      for (let d = size * .34; d < size * .62; d += 4) {
        ctx.fillRect(Math.round(x + Math.cos(angle) * d), Math.round(y + Math.sin(angle) * d), 3, 3);
      }
    }
    for (let i = 0; i < 5; i += 1) {
      const angle = i * 2.4;
      const radius = size * (.43 + (i % 2) * .07);
      const intensity = (1 + Math.sin(time / 260 + i * 2.1)) / 2;
      if (intensity < .32) continue;
      const px = Math.round(x + Math.cos(angle) * radius);
      const py = Math.round(y + Math.sin(angle) * radius);
      ctx.fillStyle = "#ffe2a3";
      ctx.fillRect(px - 3, py, 7, 1);
      ctx.fillRect(px, py - 3, 1, 7);
    }
  }

  function paintTrail(ctx, x, y, progress, size) {
    const length = Math.round(size * .48 * (1 - progress));
    for (let i = 0; i < 3; i += 1) {
      const px = Math.round(x - size * .24 - i * 8);
      const py = Math.round(y + (i - 1) * 12);
      ctx.fillStyle = ["#ffd684", "#d29a48", "#90632d"][i];
      ctx.fillRect(px - length, py, length, 2);
    }
    for (let i = 0; i < 5; i += 1) {
      ctx.fillStyle = i % 2 ? "#d49a47" : "#ffe6a8";
      ctx.fillRect(Math.round(x - size * .27 - length * (i + 1) / 5),
        Math.round(y + (i * 13 % 41) - 20), i % 2 + 2, i % 2 + 2);
    }
  }

  function play(badge, image, options) {
    const view = dialog ?? createDialog();
    const canvas = view.querySelector("canvas");
    const ctx = canvas.getContext("2d");
    const space = view.querySelector(".badge-award__space");
    const title = view.querySelector("h2");
    const details = view.querySelector(".badge-award__details");
    const name = view.querySelector(".badge-award__name");
    const accept = view.querySelector("button");
    const ready = Boolean(image);
    const reduced = motion.matches;
    title.textContent = ready ? "獲得徽章" : "尚未完成";
    view.querySelector(".badge-award__chapter").textContent =
      `第${chapterNumbers[badge.chapter - 1]}章・${badge.chapterTitle}`;
    name.textContent = badge.name;
    view.querySelector(".badge-award__description").textContent =
      ready ? badge.description : "這一章的徽章素材尚未完成。";
    view.classList.toggle("badge-award--reduced", reduced);
    view.classList.remove("badge-award--revealed", "badge-award--closing");
    accept.hidden = true;

    let start;
    let revealAt;
    let closedAt;
    let frameId;
    let geometry;
    const front = Math.max(0, badge.angles.indexOf(0));
    const resize = () => {
      const bounds = space.getBoundingClientRect();
      canvas.width = view.clientWidth;
      canvas.height = view.clientHeight;
      ctx.imageSmoothingEnabled = false;
      const maxSize = Math.min(bounds.width, bounds.height);
      const ratio = maxSize / Math.max(badge.frameWidth, badge.frameHeight);
      geometry = {
        x: bounds.left + bounds.width / 2,
        y: bounds.top + bounds.height / 2,
        w: badge.frameWidth * ratio,
        h: badge.frameHeight * ratio
      };
    };

    function reveal(now) {
      if (revealAt !== undefined) return;
      revealAt = now;
      view.classList.add("badge-award--revealed");
    }

    function finish() {
      cancelAnimationFrame(frameId);
      removeEventListener("resize", resize);
      view.onclick = null;
      accept.onclick = null;
      view.close();
      active = false;
      try {
        options.onClose?.();
      } finally {
        next();
      }
    }

    function draw(now) {
      start ??= now;
      const elapsed = now - start;
      const flying = elapsed - timing.open;
      const spinning = flying - timing.fly;
      const landing = spinning - timing.spin;
      const { x: centerX, y: centerY, w, h } = geometry;
      let x = centerX;
      let y = centerY;
      let scale = 1;
      let angle = 0;
      let opacity = 1;
      let trail;
      if (!ready) {
        reveal(now);
      } else if (reduced) {
        opacity = revealAt === undefined ? clamp(flying / 250) : 1;
        if (flying >= 250) reveal(now);
      } else if (revealAt === undefined) {
        if (flying < 0) {
          opacity = 0;
        } else if (spinning < 0) {
          const p = easeOut(clamp(flying / timing.fly));
          x = -w / 2 + (centerX + w / 2) * p;
          y -= Math.sin(p * Math.PI) * Math.min(66, h * .24);
          scale = .6 + .4 * p;
          angle = 720 * p;
          trail = p;
        } else if (landing < 0) {
          angle = 360 * easeOut(clamp(spinning / timing.spin));
        } else if (landing < timing.settle) {
          scale += .06 * Math.sin(Math.PI * landing / timing.settle);
        } else {
          reveal(now);
        }
      }

      if (closedAt !== undefined) {
        const p = clamp((now - closedAt) / timing.close);
        opacity = 1 - p;
        scale *= reduced ? 1 : 1 - .45 * easeOut(p);
        if (p === 1) {
          finish();
          return;
        }
      }
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      if (ready && opacity > 0) {
        ctx.globalAlpha = opacity;
        if (revealAt !== undefined && !reduced) paintLight(ctx, x, y, h, now - revealAt);
        if (trail !== undefined) paintTrail(ctx, x, y, trail, h);
        const frame = angle === 0 ? front : nearestFrame(badge, angle);
        const width = Math.round(w * scale);
        const height = Math.round(h * scale);
        ctx.drawImage(image, frame * badge.frameWidth, 0, badge.frameWidth, badge.frameHeight,
          Math.round(x - width / 2), Math.round(y - height / 2), width, height);
        ctx.globalAlpha = 1;
      }
      if (revealAt !== undefined && closedAt === undefined && accept.hidden &&
          now - revealAt >= (reduced || !ready ? 0 : 420)) {
        accept.hidden = false;
        accept.focus({ preventScroll: true });
      }
      frameId = requestAnimationFrame(draw);
    }

    view.onclick = event => {
      if (event.target !== accept && revealAt === undefined) reveal(performance.now());
    };
    accept.onclick = () => {
      if (closedAt !== undefined) return;
      closedAt = performance.now();
      view.classList.add("badge-award--closing");
    };
    view.showModal();
    resize();
    addEventListener("resize", resize);
    frameId = requestAnimationFrame(draw);
  }

  function next() {
    if (active || !queue.length) return;
    active = true;
    const { badge, options } = queue.shift();
    if (badge.status !== "ready") {
      play(badge, null, options);
      return;
    }
    const image = new Image();
    image.onload = () => play(badge, image, options);
    image.onerror = () => play(badge, null, options);
    image.src = new URL(badge.sprite, root).href;
  }

  window.showBadgeAward = (chapter, options = {}) => {
    if (!Number.isInteger(chapter) || chapter < 1 || chapter > 7) return;
    const badge = window.BAINIAN_BADGES?.find(entry => entry.chapter === chapter);
    if (!badge) return;
    queue.push({ badge, options });
    next();
  };
})();
