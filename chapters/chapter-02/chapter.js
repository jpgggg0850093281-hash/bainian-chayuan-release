async function createScene() {
  const width = 1672;
  const height = 941;
  const weather = {
    morning: { ambient: [250, 248, 242], haze: [211, 228, 221], sun: .76, lamp: .75, rain: 0, wind: .68 },
    rain: { ambient: [151, 174, 186], haze: [150, 177, 185], sun: .13, lamp: 1.18, rain: 1, wind: 1.15 },
    dusk: { ambient: [138, 126, 157], haze: [157, 150, 201], sun: .26, lamp: 1.42, rain: 0, wind: .43 }
  };
  const accessibility = matchMedia("(prefers-reduced-motion: reduce)");
  let paused = accessibility.matches;
  let selected = weather.morning;
  let light = structuredClone(selected);
  let elapsed = 0;
  let lastFrame;
  let animation;
  let activeTween;
  let viewCenter = .51;
  let drag;
  const lanterns = [[.152, .456, .031], [.309, .474, .027], [.368, .525, .043], [.678, .364, .014], [.787, .275, .010]];
  const puddles = [[.145, .757, .041], [.227, .738, .037], [.309, .757, .032], [.485, .778, .032], [.739, .776, .036], [.852, .733, .042]];
  let seed = 97;
  const random = () => {
    seed = (seed * 1664525 + 1013904223) >>> 0;
    return seed / 4294967296;
  };
  const leaves = Array.from({ length: 17 }, () => ({
    x: random(), y: random(), phase: random() * Math.PI * 2, speed: .018 + random() * .035,
    size: 2 + random() * 3.5, color: ["#dac26e", "#98ab51", "#c89642", "#e5cc79"][Math.floor(random() * 4)]
  }));
  const drops = Array.from({ length: 155 }, () => ({
    x: random(), y: random(), speed: .48 + random() * .69, length: 8 + random() * 23, alpha: .17 + random() * .36
  }));

  const main = document.querySelector("main");
  const canvas = document.querySelector("#scene");
  const context = canvas.getContext("2d");
  const heroLayer = document.querySelector("#hero-layer");
  const heroContext = heroLayer.getContext("2d");
  const status = document.querySelector("#scene-status");
  const motion = document.querySelector("#motion");
  const weatherButtons = document.querySelectorAll("[data-weather]");
  const chapterPanel = document.querySelector("#chapter-panel");
  const panelSpeaker = document.querySelector("#chapter-speaker");
  const panelLine = document.querySelector("#chapter-line");
  const controls = document.querySelector("#chapter-actions");
  const targets = document.querySelector("#scene-targets");
  const quest = document.querySelector("#current-quest");
  const guide = document.querySelector("#garden-guide");
  const field = document.querySelector("#field-view");
  const fieldTitle = document.querySelector("#field-title");
  const fieldInstruction = document.querySelector("#field-instruction");
  const fieldContent = document.querySelector("#field-content");
  const fieldActions = document.querySelector("#field-actions");
  const storageKey = "bainian-chapter-02";

  function loadImage(source) {
    const image = new Image();
    image.src = "../../" + source;
    return image.decode().then(() => image);
  }

  let backdrop;
  let playerBase;
  let playerSheets;
  try {
    [backdrop, playerBase, playerSheets] = await Promise.all([
      loadImage("assets/scene-sluice-wide-gate.png"),
      loadImage(playerArt.base),
      Promise.all(Object.values(playerArt.sheets).map(loadImage)),
      loadImage("assets/game/scene-sluice.png"),
    ]);
  } catch {
    status.textContent = "場景素材未載入，請重新整理頁面。";
    return;
  }

  const actor = { x: .53, y: .77, facing: "front" };
  let busy = false;
  let effect;
  let sceneProjection;
  let suppressRoadClickUntil = 0;
  let task = "intro";
  let saved = false;
  let waterSummary = "";

  const places = [
    { id: "uncle", label: "阿仁伯", x: .53, y: .60, stop: { x: .53, y: .747 } },
    { id: "gauge", label: "水位刻尺", x: .67, y: .55, stop: { x: .67, y: .76 } },
    { id: "leak", label: "水道漏水處", x: .765, y: .63, stop: { x: .75, y: .77 } },
    { id: "gate", label: "水車水閘", x: .85, y: .52, stop: { x: .825, y: .75 } },
  ];
  const tasks = {
    intro: ["uncle", "去石路找阿仁伯，了解今年的旱況。"],
    gauge: ["gauge", "到水位刻尺，找出今天的水線。"],
    quiz: ["uncle", "回阿仁伯身邊，回答他關於水位的問題。"],
    leak: ["leak", "到水道觀察，找出漏水的位置。"],
    repair: ["gate", "到水車水閘，關水並修好漏水的接合處。"],
    divide: ["gate", "在水車水閘分水。下游至少三格，上坡至少兩格。"],
    report: ["uncle", "帶著分水結果回去找阿仁伯。"],
    done: [null, "乾日的水路已完成。"],
  };

  function actionButton(action, container) {
    const button = document.createElement("button");
    button.type = "button";
    button.textContent = action.label;
    button.addEventListener("click", action.run);
    container.append(button);
    return button;
  }

  function setPanelVisible(visible) {
    chapterPanel.hidden = !visible;
    quest.setAttribute("aria-expanded", String(visible));
    guide.hidden = visible || task === "done";
  }

  function panel(speaker, line, actions = [], focus = true) {
    panelSpeaker.textContent = speaker;
    panelLine.textContent = line;
    controls.replaceChildren();
    for (const action of actions) actionButton(action, controls);
    setPanelVisible(true);
    if (focus) panelSpeaker.focus();
  }

  function showQuest(focus = true) {
    const [target, hint] = tasks[task];
    const place = places.find(item => item.id === target);
    const actions = place ? [{ label: "前往" + place.label, run: () => visitPlace(place) }] : [];
    panel("目前任務", hint, actions, focus);
  }

  function advance(next) {
    task = next;
    guide.textContent = tasks[task][1];
    guide.hidden = !chapterPanel.hidden || task === "done";
    for (let i = 0; i < places.length; i += 1) {
      if (places[i].id === tasks[task][0]) markerButtons[i].setAttribute("aria-current", "step");
      else markerButtons[i].removeAttribute("aria-current");
    }
  }

  function showField(title, instruction, fill) {
    fieldTitle.textContent = title;
    fieldInstruction.textContent = instruction;
    fieldContent.replaceChildren();
    fieldActions.replaceChildren();
    fill();
    if (!field.open) field.showModal();
    fieldTitle.focus();
  }

  function finishField(next) {
    advance(next);
    field.close();
    showQuest();
  }

  function showDrought() {
    panel("阿仁伯", "雨只下在靠湖這頭，上坡的蓄水槽還是空的。去看水位以前，先讀讀這幾天的巡田記錄。", [
      { label: "查看旱況資料卡", run: () => showField("茶園巡田記錄", "這是阿仁伯今天的巡田筆記。", () => {
        const list = document.createElement("dl");
        for (const [key, value] of [["上坡蓄水槽", "見底"], ["水道刻尺", "等青禾確認水線"], ["下游茶園", "仍需留水"]]) {
          const row = document.createElement("div");
          const name = document.createElement("dt");
          const detail = document.createElement("dd");
          name.textContent = key;
          detail.textContent = value;
          row.append(name, detail);
          list.append(row);
        }
        fieldContent.append(list);
        actionButton({ label: "收好筆記", run: () => finishField("gauge") }, fieldActions);
      }) },
    ]);
  }

  function showGauge() {
    showField("水位刻尺・認水線", "藍線是今天的水面。點選藍線旁的刻度。", () => {
      const scene = document.createElement("div");
      scene.className = "gesture-scene";
      const gauge = document.createElement("div");
      gauge.className = "gauge";
      for (const level of [8, 6, 3]) {
        const button = actionButton({ label: level + " 格", run: () => {
          if (level === 6) finishField("quiz");
          else fieldInstruction.textContent = "看一下藍色水線貼著哪一道刻度。";
        } }, gauge);
        if (level === 6) {
          button.dataset.currentWater = "";
          button.setAttribute("aria-label", "6 格，藍色水線");
        }
      }
      scene.append(gauge);
      fieldContent.append(scene);
    });
  }

  function showQuiz() {
    showField("阿仁伯考考你", "今天只有六格水。下游至少要三格，上坡至少要兩格。哪種分法還能留一格？", () => {
      for (const [label, correct] of [["上坡三格、下游兩格", false], ["上坡兩格、下游三格", true], ["上坡四格、下游兩格", false]]) {
        actionButton({ label, run: () => {
          if (correct) finishField("leak");
          else fieldInstruction.textContent = "下游至少要三格。試著把兩邊需要的水加起來。";
        } }, fieldActions);
      }
    });
  }

  function showLeak() {
    showField("石砌水道・找漏水", "管子旁有一處一直冒水。點選你要查看的位置。", () => {
      const scene = document.createElement("div");
      scene.className = "gesture-scene";
      for (const label of ["總閥把手", "接合處的水滴", "下游出水口"]) {
        actionButton({ label, run: () => {
          if (label === "接合處的水滴") finishField("repair");
          else fieldInstruction.textContent = "水滴從兩段管子接起來的地方冒出，再看看。";
        } }, scene);
      }
      fieldContent.append(scene);
    });
  }

  function report() {
    try {
      localStorage.setItem(storageKey, "done");
      saved = true;
    } catch {
      waterSummary += "\n這台裝置目前無法儲存進度。";
    }
    updateCoins();
    advance("done");
    panel("阿仁伯・第二章完成", waterSummary + "\n\n「水有留給下游，明早咱們再一起看水線。走，回茶寮教後生做茶。」", [
      { label: "查看紀念幣", run: showCoinBook },
    ]);
  }

  function updateCoins() {
    document.querySelector("#coin-total").textContent = saved ? "1／1" : "0／1";
  }

  function showCoinBook() {
    panel("紀念幣", saved ? "已收錄「守水人」。青禾修好了水閥，也讓兩端的茶園都分得到水。" : "完成分水並向阿仁伯回報，就能獲得「守水人」。");
  }

  const interactions = {
    intro: showDrought, gauge: showGauge, quiz: showQuiz, leak: showLeak,
    repair: openValve, divide: openValve, report,
  };

  function visitPlace(place) {
    walkVillage(place.stop, () => {
      if (place.id === tasks[task][0]) interactions[task]();
      else panel(place.label, tasks[task][1], [{ label: "查看目前任務", run: () => showQuest() }]);
    });
  }

  const markerButtons = places.map(place => {
    const marker = actionButton({ label: place.label, run: () => visitPlace(place) }, targets);
    marker.className = "scene-target";
    marker.dataset.kind = "place";
    return marker;
  });

  document.querySelector("#close-chapter").addEventListener("click", () => {
    setPanelVisible(false);
    quest.focus();
  });
  quest.addEventListener("click", () => showQuest());
  document.querySelector("#story-book").addEventListener("click", () => panel("第二章・乾日的水路", "坡上蓄水見底，青禾和阿仁伯要把漏水的水閘修好，讓上坡和下游都分得到水。"));
  document.querySelector("#coin-book").addEventListener("click", showCoinBook);
  new ResizeObserver(() => {
    const toolbar = document.querySelector(".scene-controls");
    main.style.setProperty("--toolbar-height", toolbar.offsetHeight + "px");
  }).observe(document.querySelector(".scene-controls"));

  const valve = document.querySelector("#valve-workbench");
  const machine = document.querySelector("#valve-machine");
  const valveInstruction = document.querySelector("#valve-instruction");
  const wheel = document.querySelector("#valve-wheel");
  const seat = document.querySelector("#valve-seat");
  const bolts = document.querySelectorAll("[data-bolt]");
  const valveFinish = document.querySelector("#finish-valve");
  const upstreamButton = document.querySelector("#send-upstream");
  const downstreamButton = document.querySelector("#send-downstream");
  const tightening = [0, 2, 1, 3];
  const repair = { phase: "inspect", loose: new Set(), tight: 0, upstream: 0, downstream: 0 };
  const repairHints = {
    inspect: "先點接合處找漏水的位置。",
    close: "漏水來自接合處。先轉動總閥關水。",
    unbolt: "關水後，逐一鬆開四顆固定螺帽。",
    gasket: "舊墊圈有裂縫。接合處對應中環，從零件盤挑一枚。",
    seat: "點接合處，把止水墊壓進槽裡。",
    tighten: "按左上、右下、右上、左下的對角順序鎖緊。",
    test: "再轉總閥試水，看看接合處還漏不漏。",
    divide: "有六格水。下游至少三格、上坡至少兩格。點兩個水閘分配，也可以留一格備用。"
  };

  function updateValve(message = repairHints[repair.phase]) {
    const phase = repair.phase;
    const reserve = 6 - repair.upstream - repair.downstream;
    valve.dataset.distributing = String(phase === "divide");
    document.querySelector("#valve-title").textContent = phase === "divide" ? "水車水閘・分水" : "水車水閘・修理台";
    valveInstruction.textContent = message;
    machine.dataset.closed = String(!["inspect", "close", "divide"].includes(phase));
    machine.dataset.leaking = String(phase === "inspect" || phase === "close");
    wheel.disabled = phase !== "close" && phase !== "test";
    seat.disabled = phase !== "inspect" && phase !== "seat";
    for (const bolt of bolts) {
      const number = Number(bolt.dataset.bolt);
      bolt.dataset.loose = String(repair.loose.has(number));
      bolt.disabled = !["unbolt", "tighten"].includes(phase) || (phase === "unbolt" ? repair.loose.has(number) : !repair.loose.has(number));
    }
    document.querySelector("#valve-parts").hidden = phase !== "gasket";
    document.querySelector("#valve-channels").hidden = phase !== "divide";
    document.querySelector("#upstream-level").textContent = repair.upstream;
    document.querySelector("#downstream-level").textContent = repair.downstream;
    document.querySelector("#water-reserve").textContent = reserve;
    upstreamButton.disabled = reserve === 0;
    downstreamButton.disabled = reserve === 0;
    valveFinish.hidden = phase !== "divide" || repair.upstream < 2 || repair.downstream < 3;
  }

  function openValve() {
    if (valve.open) return;
    updateValve();
    valve.showModal();
    document.querySelector("#valve-title").focus();
  }

  seat.addEventListener("click", () => {
    if (repair.phase === "inspect") repair.phase = "close";
    else if (repair.phase === "seat") repair.phase = "tighten";
    else return;
    updateValve();
  });
  wheel.addEventListener("click", () => {
    if (repair.phase === "close") repair.phase = "unbolt";
    else if (repair.phase === "test") {
      repair.phase = "divide";
      valve.close();
      advance("divide");
      showQuest();
    }
    else return;
    updateValve();
  });
  for (const bolt of bolts) bolt.addEventListener("click", () => {
    const number = Number(bolt.dataset.bolt);
    if (repair.phase === "unbolt") {
      repair.loose.add(number);
      if (repair.loose.size === 4) repair.phase = "gasket";
    } else if (repair.phase === "tighten") {
      if (number !== tightening[repair.tight]) {
        updateValve("先鎖提示順序的下一顆，讓接合處平均受力。");
        return;
      }
      repair.loose.delete(number);
      repair.tight += 1;
      if (repair.tight === 4) repair.phase = "test";
    } else return;
    updateValve();
  });
  for (const gasket of document.querySelectorAll("[data-gasket]")) gasket.addEventListener("click", () => {
    if (repair.phase !== "gasket") return;
    if (gasket.dataset.gasket !== "fitted") {
      updateValve("這枚墊圈卡不進接合槽。比較一下尺寸，再選一枚。");
      return;
    }
    repair.phase = "seat";
    updateValve();
  });
  function sendWater(channel) {
    if (repair.phase !== "divide" || repair.upstream + repair.downstream >= 6) return;
    repair[channel] += 1;
    updateValve();
  }
  upstreamButton.addEventListener("click", () => sendWater("upstream"));
  downstreamButton.addEventListener("click", () => sendWater("downstream"));
  document.querySelector("#reset-water").addEventListener("click", () => {
    repair.upstream = 0;
    repair.downstream = 0;
    updateValve();
  });

  valveFinish.addEventListener("click", () => {
    if (task !== "divide" || repair.upstream < 2 || repair.downstream < 3) return;
    const downstreamFirst = repair.downstream > repair.upstream;
    const remaining = 6 - repair.upstream - repair.downstream;
    const effects = downstreamFirst ? [-2, 3, 3, 2] : [0, 2, 4, 3];
    const indicators = ["經營資金", "茶葉品質", "環境健康", "地方共好"];
    waterSummary = "上坡 " + repair.upstream + " 格，下游 " + repair.downstream + " 格，備用 " + remaining + " 格。\n"
      + indicators.map((name, index) => name + " " + (effects[index] > 0 ? "+" : "") + effects[index]).join("　");
    valve.close();
    advance("report");
    panel("試水完成", waterSummary + "\n\n回石路找阿仁伯。", [
      { label: "回阿仁伯身邊", run: () => visitPlace(places[0]) },
    ]);
  });

  function walkVillage(destination, arrive) {
    if (busy || closeupOpen()) return;
    busy = true;
    setPanelVisible(false);
    effect = { kind: "walk", amount: 0 };
    const route = [];
    const roadEdge = .727;
    if (actor.y < roadEdge) route.push({ x: actor.x, y: roadEdge });
    if (destination.y < roadEdge) route.push({ x: destination.x, y: roadEdge });
    route.push(destination);
    function step(index) {
      const next = route[index];
      if (!next) {
        effect = undefined;
        busy = false;
        render();
        arrive?.();
        return;
      }
      const { x: startX, y: startY } = actor;
      const startCenter = viewCenter;
      const dx = next.x - startX;
      const dy = next.y - startY;
      actor.facing = Math.abs(dx) > .012 ? (dx < 0 ? "left" : "right") : (dy < 0 ? "back" : "front");
      tween(190 + Math.hypot(dx * 3250, dy * 2450), amount => {
        const travel = amount * amount * (3 - 2 * amount);
        actor.x = startX + dx * travel;
        actor.y = startY + dy * travel;
        viewCenter = startCenter + (next.x - startCenter) * travel;
        effect.amount = travel;
        effect.distance = Math.hypot(dx * width, dy * height) * travel;
      }, () => step(index + 1));
    }
    step(0);
  }

  function tween(duration, draw, done) {
    activeTween = { duration, draw, done };
    scheduleFrame();
  }


  const haze = document.createElement("canvas");
  haze.width = width;
  haze.height = height;
  const hazeContext = haze.getContext("2d");
  hazeContext.filter = "blur(1.8px)";
  hazeContext.drawImage(backdrop, 0, 0, width, height);
  hazeContext.filter = "none";
  hazeContext.globalCompositeOperation = "destination-in";
  const depth = hazeContext.createLinearGradient(0, height * .19, 0, height * .48);
  depth.addColorStop(0, "rgba(0,0,0,.95)");
  depth.addColorStop(1, "transparent");
  hazeContext.fillStyle = depth;
  hazeContext.fillRect(0, 0, width, height);

  const color = ([r, g, b], alpha = 1) => `rgba(${Math.round(r)},${Math.round(g)},${Math.round(b)},${alpha})`;
  const wrap = (number, interval = 1) => ((number % interval) + interval) % interval;

  function glow(x, y, radius, rgb, alpha) {
    const gradient = context.createRadialGradient(x, y, 0, x, y, radius);
    gradient.addColorStop(0, color(rgb, alpha));
    gradient.addColorStop(.45, color(rgb, alpha * .28));
    gradient.addColorStop(1, color(rgb, 0));
    context.fillStyle = gradient;
    context.fillRect(x - radius, y - radius, radius * 2, radius * 2);
  }

  function ellipse(x, y, radiusX, radiusY) {
    context.beginPath();
    context.ellipse(x, y, radiusX, radiusY, 0, 0, Math.PI * 2);
  }

  function updateLight(amount) {
    for (const key of ["sun", "lamp", "rain", "wind"]) light[key] += (selected[key] - light[key]) * amount;
    for (const key of ["ambient", "haze"]) {
      light[key] = light[key].map((channel, index) => channel + (selected[key][index] - channel) * amount);
    }
  }

  function drawLandscape() {
    // Interpolate the painted landscape during fractional camera moves.
    context.imageSmoothingEnabled = false;
    context.drawImage(backdrop, 0, 0, width, height);
    context.drawImage(haze, 0, 0);
    context.globalCompositeOperation = "multiply";
    context.fillStyle = color(light.ambient);
    context.fillRect(0, 0, width, height);
    context.globalCompositeOperation = "source-over";
    const mist = context.createLinearGradient(0, height * .13, 0, height * .54);
    mist.addColorStop(0, color(light.haze, .04));
    mist.addColorStop(.37, color(light.haze, .06 + light.rain * .10));
    mist.addColorStop(.62, color(light.haze, .13 + light.rain * .17));
    mist.addColorStop(1, color(light.haze, 0));
    context.fillStyle = mist;
    context.fillRect(0, height * .13, width, height * .41);
  }

  const waterGrid = document.createElement("canvas");
  waterGrid.width = 480;
  waterGrid.height = 270;
  const waterPaint = waterGrid.getContext("2d");
  const wheelFrames = [];
  const waterMasks = [
    [[426, 103], [434, 105], [426, 124], [425, 145], [426, 161], [412, 162], [413, 123], [419, 111]],
    [[400, 113], [408, 113], [403, 117], [397, 122], [390, 127], [380, 129], [382, 125], [389, 122], [392, 116]],
    [[371, 144], [379, 146], [390, 146], [395, 155], [410, 158], [437, 164], [443, 170], [432, 170], [411, 165], [392, 163], [375, 157]],
    [[424, 187], [445, 187], [452, 191], [459, 194], [470, 201], [479, 207], [479, 222], [455, 215], [451, 207], [442, 199], [431, 193]]
  ];
  function clipWater(mask) {
    waterPaint.beginPath();
    mask.forEach(([x, y], index) => index ? waterPaint.lineTo(x, y) : waterPaint.moveTo(x, y));
    waterPaint.closePath();
    waterPaint.clip();
  }

  function paintWaterFrame(tick) {
    waterPaint.clearRect(0, 0, 480, 270);
    const wheelFrame = Math.floor(tick / 6) % 6;
    if (!wheelFrames[wheelFrame]) {
      const tile = document.createElement("canvas");
      tile.width = 31;
      tile.height = 61;
      const painter = tile.getContext("2d");
      const pitch = Math.PI / 6;
      for (let y = 0; y < 61; y += 1) {
        for (let x = 0; x < 31; x += 1) {
          const dx = (x - 27) / 25;
          const dy = (y - 30) / 29;
          const radius = Math.hypot(dx, dy);
          if (radius > .89 || radius < .17 || (x > 27 && y > 29)) continue;
          const angle = Math.atan2(dy, dx) + wheelFrame * pitch / 6;
          const spoke = Math.abs(Math.sin(angle * 6)) * radius;
          painter.fillStyle = spoke < .11 ? "#94552c" : spoke < .17 ? "#593219" :
            y % 7 === 0 ? "#1b3236" : "#202525";
          if (radius > .81) painter.fillStyle = (x + y) % 6 < 2 ? "#ad6a35" : "#784225";
          painter.fillRect(x, y, 1, 1);
        }
      }
      wheelFrames[wheelFrame] = tile;
    }
    waterPaint.drawImage(wheelFrames[wheelFrame], 424, 95);
    const streams = [
      { mask: 0, start: [419, 101], end: [421, 164], length: 60, speed: 4, count: 14, bar: [1, 5] },
      { mask: 1, start: [392, 110], end: [392, 131], length: 21, speed: 3, count: 15, bar: [1, 4] },
      { mask: 2, start: [367, 144], end: [441, 169], length: 74, speed: 2, count: 23, bar: [3, 1] },
      { mask: 3, start: [424, 186], end: [481, 218], length: 57, speed: 1, count: 19, bar: [3, 1] }
    ];
    for (const stream of streams) {
      waterPaint.save();
      clipWater(waterMasks[stream.mask]);
      for (let i = 0; i < stream.count; i += 1) {
        const phase = (tick * stream.speed + i * 11) % stream.length;
        const t = phase / stream.length;
        const cross = i * 7 % 17 - 8;
        const vertical = stream.mask < 2;
        const x = Math.round(stream.start[0] + (stream.end[0] - stream.start[0]) * t + (vertical ? cross : 0));
        const y = Math.round(stream.start[1] + (stream.end[1] - stream.start[1]) * t + (vertical ? 0 : cross));
        waterPaint.fillStyle = phase < 4 || phase > stream.length - 5 ? "#87bed244" :
          i % 3 ? "#b9e9f2aa" : "#eefbffcc";
        waterPaint.fillRect(x, y, stream.bar[0], stream.bar[1]);
      }
      waterPaint.restore();
    }
    for (const [x, y, mask, phase] of [[419, 159, 2, 0], [433, 165, 2, 1], [440, 190, 3, 2]]) {
      waterPaint.save();
      clipWater(waterMasks[mask]);
      const size = (Math.floor(tick / 2) + phase) % 3;
      waterPaint.fillStyle = "#e1f9fb";
      waterPaint.fillRect(x - size, y - size, 1, 1);
      waterPaint.fillRect(x + size + 1, y - size + 1, 1, 1);
      waterPaint.restore();
    }
  }

  let lastWaterTick = -1;
  function drawWater() {
    const tick = Math.floor(elapsed * 6);
    if (tick !== lastWaterTick) {
      paintWaterFrame(tick);
      lastWaterTick = tick;
    }
    context.imageSmoothingEnabled = false;
    context.drawImage(waterGrid, 0, 0, width, height);
  }

  function drawLighting() {
    context.save();
    context.globalCompositeOperation = "screen";
    const sx = width * .106;
    const sy = height * .111;
    glow(sx, sy, width * .236, [255, 168, 72], light.sun * .25);
    for (let ray = 0; ray < 4; ray += 1) {
      const tx = (.339 + ray * .115 + Math.sin(elapsed * .43 + ray) * .008) * width;
      const ty = (.51 + ray * .07) * height;
      const shaft = context.createLinearGradient(sx, sy, tx, ty);
      shaft.addColorStop(0, color([255, 218, 143], light.sun * .18));
      shaft.addColorStop(.59, color([255, 216, 156], light.sun * (.055 + ray * .008)));
      shaft.addColorStop(1, color([255, 200, 144], 0));
      context.fillStyle = shaft;
      context.beginPath();
      context.moveTo(sx + ray * 11 - 7, sy + 18);
      context.lineTo(sx + ray * 13 + 11, sy + 11);
      context.lineTo(tx + 112, ty);
      context.lineTo(tx - 56, ty - 12);
      context.closePath();
      context.fill();
    }
    lanterns.forEach(([x, y, size], index) => {
      const flicker = .92 + Math.sin(elapsed * (1.7 + index * .51) + index) * .055 + Math.sin(elapsed * 6.9 + index * 4) * .025;
      glow(x * width, y * height, size * width, [255, 161, 61], light.lamp * flicker * .42);
    });
    context.restore();
  }

  function drawHero() {
    const x = width * actor.x;
    const y = height * actor.y;
    context.save();
    context.translate(x + 13, y + 2);
    context.rotate(.11);
    context.fillStyle = color([18, 23, 22], .20 + light.sun * .12);
    ellipse(7, 1, 32, 7);
    context.fill();
    context.fillStyle = "#14231db3";
    ellipse(-12, 0, 16, 4);
    context.fill();
    context.restore();
    const direction = actor.facing === "back" ? 1 : actor.facing === "front" ? 2 : 0;
    const sprite = playerSheets[direction];
    const walking = effect?.kind === "walk";
    const seconds = (effect?.animationMs ?? 0) / 1000;
    const frame = walking ? Math.floor(seconds * playerArt.framesPerSecond) % playerArt.frameCount : playerArt.idleFrame;
    const transform = heroContext.getTransform();
    const scale = Math.max(1, Math.round(heroLayer.height * .17 / playerArt.height));
    const footX = Math.round(x * transform.a + transform.e);
    const footY = Math.round(y * transform.d + transform.f);
    const bob = !sprite && walking ? 2 * (frame % 2) : 0;
    heroContext.save();
    heroContext.setTransform(actor.facing === "right" ? -scale : scale, 0, 0, scale, footX, footY - bob);
    heroContext.imageSmoothingEnabled = false;
    heroContext.drawImage(sprite ?? playerBase, sprite ? frame * playerArt.width : 0, 0, playerArt.width, playerArt.height,
      -playerArt.anchor[0], -playerArt.anchor[1], playerArt.width, playerArt.height);
    heroContext.restore();
  }

  function drawBirds() {
    const flight = wrap(elapsed * .023 + .29);
    const horizon = height * (.156 + Math.sin(elapsed * .12) * .012);
    context.save();
    context.fillStyle = color([34, 67, 72], .55 * (1 - light.rain * .7));
    for (let index = 0; index < 5; index += 1) {
      const x = Math.round(width * (.215 + flight * .61) - index * (14 + index % 2 * 5));
      const y = Math.round(horizon + (index % 2 === 0 ? index * 5 : index * 6 + 5));
      const lift = Math.sin(elapsed * 7.5 + index * .83);
      context.fillRect(x - 2, y, 4, 2);
      context.fillRect(x - 5, y - Math.round(lift * 3), 4, 1.6);
      context.fillRect(x + 1, y - Math.round(lift * 3), 4, 1.6);
    }
    context.restore();
  }

  function drawButterflies() {
    const base = [[.448, .60], [.622, .565], [.907, .767]];
    base.forEach(([anchorX, anchorY], index) => {
      const t = elapsed + index * 2.9;
      const x = Math.round(width * (anchorX + Math.sin(t * .77) * .022));
      const y = Math.round(height * (anchorY + Math.cos(t * 1.26) * .024 - Math.sin(t * 1.93) * .008));
      const span = 1 + Math.abs(Math.sin(t * 14.2)) * (3.9 + index / 2);
      context.fillStyle = color(index === 1 ? [239, 201, 133] : [249, 219, 167], .83 * (1 - light.rain * .85));
      context.fillRect(x - span, y - 2, span, 2);
      context.fillRect(x + 1, y - 2, span, 2);
      context.fillRect(x - span + 1, y, Math.max(1, span - 1), 2);
      context.fillRect(x + 1, y, Math.max(1, span - 1), 2);
    });
  }

  function drawLeaves() {
    for (const leaf of leaves) {
      const x = width * (-.06 + wrap(leaf.x + elapsed * .05 * light.wind, 1.1));
      const y = height * (-.11 + wrap(leaf.y + elapsed * leaf.speed, .96));
      const spin = Math.sin(elapsed * 2.1 + leaf.phase);
      context.save();
      context.globalAlpha = .63;
      context.translate(Math.round(x + 12 * spin), Math.round(y));
      context.rotate(spin * 1.5);
      context.fillStyle = leaf.color;
      context.fillRect(-leaf.size, -1, leaf.size * 2, 2);
      context.fillRect(-leaf.size * .4, -2, leaf.size, 4);
      context.restore();
    }
  }

  function drawForeground() {
    const sway = Math.sin(elapsed * 1.24) * 2.3 * light.wind;
    for (const [x, y, direction] of [[.011, .998, 1], [.981, .981, -1]]) {
      context.save();
      context.translate(width * x, height * y);
      for (let blade = 0; blade < 9; blade += 1) {
        const bend = sway * (1 + blade / 2);
        const endX = direction * (7 + blade * 8.5) + bend;
        const endY = -19 - blade % 4 * 15 - blade * 2;
        context.strokeStyle = blade % 2 ? "#56794f" : "#365d41";
        context.lineWidth = 2 + blade % 3;
        context.beginPath();
        context.moveTo(blade * 2 * direction, 0);
        context.quadraticCurveTo(endX * .48, endY * .72, endX, endY);
        context.stroke();
        context.fillStyle = blade % 2 ? "#8ea362" : "#638858";
        context.fillRect(endX - 3, endY, 6, 3);
      }
      context.restore();
    }
  }

  function drawRain() {
    if (light.rain < .01) return;
    context.save();
    context.lineWidth = 1.1;
    for (const drop of drops) {
      const x = wrap(drop.x - elapsed * .14 * light.wind) * width;
      const y = wrap(drop.y + elapsed * drop.speed) * height;
      context.strokeStyle = color([189, 225, 241], drop.alpha * light.rain);
      context.beginPath();
      context.moveTo(x, y);
      context.lineTo(x - drop.length * .27, y + drop.length);
      context.stroke();
    }
    puddles.forEach(([x, y, size], index) => {
      const ring = wrap(elapsed * 1.45 + index * .71);
      context.strokeStyle = color([184, 218, 231], light.rain * (1 - ring) * .53);
      ellipse(x * width, y * height, (2 + ring * 15) * (size / .041), .6 + ring * 3);
      context.stroke();
    });
    context.restore();
  }

  function render() {
    const viewportWidth = canvas.width;
    const viewportHeight = canvas.height;
    const portraitRatio = viewportWidth / viewportHeight < 1;
    const scale = portraitRatio ? Math.max(viewportWidth / (width * .64), viewportHeight / height)
      : Math.max(viewportWidth / width, viewportHeight / height);
    const zoom = scale * (portraitRatio ? 1.035 : 1.12);
    const center = viewCenter;
    const cropX = Math.min(0, Math.max(viewportWidth - width * zoom, viewportWidth / 2 - width * zoom * center));
    const cropY = (viewportHeight - height * scale) / 2;
    context.setTransform(1, 0, 0, 1, 0, 0);
    context.fillStyle = "#101f1c";
    context.fillRect(0, 0, viewportWidth, viewportHeight);
    const originX = Math.round(cropX);
    const originY = Math.round(Math.min(0, Math.max(viewportHeight - height * zoom,
      cropY - (zoom - scale) * height / 2)));
    sceneProjection = { zoom, originX, originY };
    context.imageSmoothingEnabled = false;
    context.setTransform(zoom, 0, 0, zoom, originX, originY);
    drawLandscape();
    drawWater();
    drawLighting();
    drawBirds();
    heroContext.setTransform(1, 0, 0, 1, 0, 0);
    heroContext.clearRect(0, 0, heroLayer.width, heroLayer.height);
    const heroScaleX = heroLayer.width / viewportWidth;
    const heroScaleY = heroLayer.height / viewportHeight;
    heroContext.setTransform(zoom * heroScaleX, 0, 0, zoom * heroScaleY,
      originX * heroScaleX, originY * heroScaleY);
    drawHero();
    drawButterflies();
    drawLeaves();
    drawForeground();
    drawRain();
    markerButtons.forEach((button, index) => {
      const point = places[index];
      const x = originX + point.x * width * zoom;
      const y = originY + point.y * height * zoom;
      const margin = 50 * viewportWidth / canvas.clientWidth;
      button.hidden = x < margin || x > viewportWidth - margin || y < 22 || y > viewportHeight - 22;
      button.disabled = busy;
      button.style.left = (x / viewportWidth * 100) + "%";
      button.style.top = (y / viewportHeight * 100) + "%";
    });
  }

  function resize() {
    const sceneWidth = Math.max(1, canvas.clientWidth);
    const sceneHeight = Math.max(1, canvas.clientHeight);
    const ratio = Math.min(480 / sceneWidth, 270 / sceneHeight);
    const heroRatio = Math.min(devicePixelRatio || 1, 1.75);
    for (const [layer, scale] of [[canvas, ratio], [heroLayer, heroRatio]]) {
      const nextWidth = Math.max(1, Math.round(sceneWidth * scale));
      const nextHeight = Math.max(1, Math.round(sceneHeight * scale));
      if (layer.width !== nextWidth) layer.width = nextWidth;
      if (layer.height !== nextHeight) layer.height = nextHeight;
    }
    render();
  }

  function frame(time) {
    animation = undefined;
    const step = Math.min(.05, lastFrame === undefined ? .016 : (time - lastFrame) / 1000);
    lastFrame = time;
    if (!paused) {
      elapsed += step;
      const amount = 1 - Math.exp(-step * 4.5);
      updateLight(amount);
    }
    const tween = activeTween;
    if (tween) {
      tween.start ??= time;
      if (effect?.kind === "walk") effect.animationMs = time - tween.start;
      const fraction = accessibility.matches ? 1 : Math.min(1, (time - tween.start) / tween.duration);
      tween.draw(fraction);
      if (fraction === 1) {
        activeTween = undefined;
        tween.done();
      }
    }
    if (!closeupOpen()) render();
    scheduleFrame();
  }

  function closeupOpen() {
    return Boolean(field.open || valve.open);
  }

  function scheduleFrame() {
    if (animation === undefined && (activeTween || (!paused && !closeupOpen() && !document.hidden))) {
      animation = requestAnimationFrame(frame);
    }
  }

  for (const closeup of [field, valve]) {
    closeup.addEventListener("close", () => {
      lastFrame = undefined;
      render();
      scheduleFrame();
    });
  }
  document.addEventListener("visibilitychange", () => {
    lastFrame = undefined;
    scheduleFrame();
  });

  function setPaused(value) {
    paused = value;
    motion.setAttribute("aria-pressed", String(value));
    motion.textContent = value ? "播放動態" : "暫停動態";
    if (paused && !activeTween && animation !== undefined) {
      cancelAnimationFrame(animation);
      animation = undefined;
    }
    lastFrame = undefined;
    scheduleFrame();
  }

  for (const button of weatherButtons) {
    button.addEventListener("click", () => {
      selected = weather[button.dataset.weather];
      for (const control of weatherButtons) control.setAttribute("aria-pressed", String(control === button));
      if (paused) {
        updateLight(1);
        render();
      }
    });
  }
  motion.addEventListener("click", () => setPaused(!paused));
  accessibility.addEventListener("change", event => setPaused(event.matches));
  canvas.addEventListener("pointermove", event => {
    if (drag?.id !== event.pointerId || busy) return;
    const delta = event.clientX - drag.x;
    const distance = Math.max(0, Math.abs(delta) - 7);
    if (!drag.moved && !distance) return;
    drag.moved = true;
    const movement = Math.sign(delta) * distance / Math.max(canvas.clientHeight * width / height, canvas.clientWidth);
    viewCenter = Math.max(.14, Math.min(.86, drag.center - movement));
    if (paused) render();
  });
  canvas.addEventListener("pointerdown", event => {
    if (drag || event.pointerType === "mouse" || canvas.clientWidth >= canvas.clientHeight || busy) return;
    drag = { id: event.pointerId, x: event.clientX, center: viewCenter };
    canvas.setPointerCapture(event.pointerId);
  });
  for (const eventName of ["pointerup", "pointercancel", "lostpointercapture"]) {
    canvas.addEventListener(eventName, event => {
      if (drag?.id !== event.pointerId) return;
      if (drag.moved) suppressRoadClickUntil = performance.now() + 250;
      drag = undefined;
    });
  }
  canvas.addEventListener("click", event => {
    if (busy || closeupOpen() || performance.now() < suppressRoadClickUntil) return;
    const rect = canvas.getBoundingClientRect();
    const { zoom, originX, originY } = sceneProjection;
    const x = ((event.clientX - rect.left) * canvas.width / rect.width - originX) / (width * zoom);
    const y = ((event.clientY - rect.top) * canvas.height / rect.height - originY) / (height * zoom);
    // Keep feet on the continuous flagstone lane, below the wall and above the foreground foliage.
    if (x >= .09 && x <= .89 && y >= .727 && y <= .805) walkVillage({ x, y });
  });
  addEventListener("resize", resize);
  canvas.addEventListener("keydown", event => {
    if (!["ArrowLeft", "ArrowRight"].includes(event.key) || busy || closeupOpen()) return;
    event.preventDefault();
    const offset = event.key === "ArrowLeft" ? -.05 : .05;
    walkVillage({ x: Math.min(.89, Math.max(.09, actor.x + offset)), y: actor.y });
  });

  try {
    saved = localStorage.getItem(storageKey) === "done";
  } catch {
    // The chapter can run without local storage.
  }
  updateCoins();
  advance("intro");
  resize();
  setPaused(paused);
  status.textContent = "";
  main.classList.remove("loading");
  showQuest(false);
}

createScene();