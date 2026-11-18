const devScenes = {
  "village": {
    "intro": { "label": "阿嬤開場", "leaves": 0 }
  },
  "tea-garden": {
    "entrance": { "label": "梯田入口", "leaves": 0 },
    "pick": { "label": "採摘嫩梢", "leaves": 0 },
    "return": { "label": "採滿回茶寮", "leaves": 18 }
  },
  "tea-room": {
    "scoop": { "label": "茶勺放乾茶葉", "leaves": 18, "phase": "leaves" },
    "water": { "label": "水壺倒水", "leaves": 18, "phase": "water" },
    "steep": { "label": "浸泡", "leaves": 18, "phase": "steep" },
    "pour": { "label": "茶壺倒入茶杯", "leaves": 18, "phase": "cup" },
    "serve": { "label": "奉茶給阿嬤", "leaves": 18, "phase": "serve" }
  },
  "chapter-end": {
    "award": { "label": "領取紀念幣", "leaves": 18, "coins": 1 },
    "ending": { "label": "章末對話", "leaves": 18, "coins": 1 },
    "coins": { "label": "紀念幣圖鑑", "leaves": 18, "coins": 1 },
    "story": { "label": "故事頁", "leaves": 0 }
  }
};



function basketPixels(count, capacity = 18) {
  const columns = Array(12).fill(0);
  const clusters = [];
  const pixels = [];
  let seed = 611;
  function random() {
    seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0;
    return seed / 4294967296;
  }
  const leaf = [
    ".....23.....",
    "....2332....",
    ".22.2332..2.",
    "2332232.2332",
    ".23323223332",
    "..233233332.",
    "...2223322..",
    "....12222...",
    "......1....."
  ];
  for (let i = 0; i < count; i += 1) {
    const spread = Math.min(1, i / 10);
    const start = Math.round(2 * (1 - spread));
    let score = Infinity;
    let best = start;
    for (let col = start; col < columns.length - start; col += 1) {
      const wall = Math.abs(col - 5.5) / 5.5;
      const value = columns[col] + wall * .32 + random() * .19;
      if (value < score) { best = col; score = value; }
    }
    const level = columns[best];
    for (let col = Math.max(0, best - 2); col <= Math.min(11, best + 2); col += 1) {
      columns[col] += [1.1, .76, .36][Math.abs(col - best)];
    }
    clusters.push({
      x: Math.round(7 + best * 7.8 + (random() - .5) * 5),
      y: Math.round(42 - level * 7 - Math.sin(best / 11 * Math.PI) * i * .45 + (random() - .5) * 5),
      angle: (random() - .5) * 1.7,
      flip: random() < .5 ? -1 : 1,
      shade: random() < .42 || best < 2 || best > 9 ? -1 : 0,
      level
    });
  }
  const full = count >= capacity;
  clusters.sort((a, b) => a.level - b.level || a.y - b.y);
  for (const c of clusters) {
    for (const [offsetX, offsetY, twist, shadow] of [[-5, 2, -.44, -1], [6, 1, .55, -1], [0, -2, 0, 0]]) {
      const sin = Math.sin(c.angle + twist);
      const cos = Math.cos(c.angle + twist);
      for (let y = 0; y < 22; y += 1) {
        for (let x = 0; x < 31; x += 1) {
          const dx = x - 15;
          const dy = y - 11;
          const sx = Math.round((dx * cos + dy * sin) * c.flip / 1.82 + 5.5);
          const sy = Math.round((-dx * sin + dy * cos) / 1.5 + 4);
          const tone = Number(leaf[sy]?.[sx]);
          if (!tone) continue;
          const px = c.x + dx + offsetX;
          const py = c.y + dy + offsetY;
          if (px >= 0 && px < 100 && py >= (full ? 0 : 8) && py < 52) pixels.push([px, py, Math.max(0, tone + c.shade + shadow)]);
        }
      }
    }
  }
  return pixels;
}

"use strict";

const canvas = document.querySelector("#scene");
const status = document.querySelector("#scene-status");
const motion = document.querySelector("#motion");
const weatherButtons = document.querySelectorAll("[data-weather]");
const context = canvas.getContext("2d", { alpha: false });
const heroLayer = document.querySelector("#hero-layer");
const heroContext = heroLayer.getContext("2d");

if (!context) {
  status.textContent = "這個瀏覽器無法繪製場景。";
  motion.disabled = true;
  for (const button of weatherButtons) button.disabled = true;
} else {
  createScene();
}

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
  const pointer = { x: 0, y: 0, targetX: 0, targetY: 0 };
  let viewCenter = .45;
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
  const reflections = Array.from({ length: 41 }, () => ({
    x: random(), y: random(), phase: random() * Math.PI * 2, size: 4 + 20 * random()
  }));

  const artWarnings = new Set();
  const pixelDev = location.protocol === "file:" || ["localhost", "127.0.0.1", "[::1]"].includes(location.hostname) ||
    new URLSearchParams(location.search).get("dev") === "1";

  function image(source) {
    return new Promise((resolve, reject) => {
      const result = new Image();
      result.onload = () => {
        if (pixelDev && (result.naturalWidth > 480 || result.naturalHeight > 270)) {
          artWarnings.add(source);
          let warning = document.querySelector("#pixel-art-warning");
          if (!warning) {
            warning = document.createElement("output");
            warning.id = "pixel-art-warning";
            document.body.append(warning);
          }
          warning.textContent = "像素規格待遷移：" + [...artWarnings].join("、");
        }
        result.decode().then(() => resolve(result), reject);
      };
      result.onerror = reject;
      result.src = source;
    });
  }

  let backdrop;
  let garden;
  let playerBase;
  let playerSheets;
  try {
    [backdrop, garden, playerBase, playerSheets] = await Promise.all([
      image("assets/scene-sluice-wide-gate.png"),
      image("assets/hillside-tea.png"),
      image(playerArt.base),
      Promise.all(Object.values(playerArt.sheets).map(image)),
      ...[...Object.values(playerArt.harvest), "assets/game/harvest-canopy.png",
        "assets/tea-table.png", "assets/tea-props.png", "assets/tea-sprig.png",
        "assets/tea-sip-frames.png", "assets/tea-coin-frames.png"].map(image)
    ]);
  } catch {
    status.textContent = "場景素材未載入。請確認圖片和網頁放在同一個資料夾。";
    motion.disabled = true;
    for (const button of weatherButtons) button.disabled = true;
    return;
  }

  const panelSpeaker = document.querySelector("#chapter-speaker");
  const chapterPanel = document.querySelector("#chapter-panel");
  const questButton = document.querySelector("#current-quest");
  const panelLine = document.querySelector("#chapter-line");
  const controls = document.querySelector("#chapter-actions");
  const targets = document.querySelector("#scene-targets");
  const gardenGuide = document.querySelector("#garden-guide");
  const main = canvas.closest("main");
  const toolbar = document.querySelector(".scene-controls");
  if (typeof ResizeObserver === "function") {
    new ResizeObserver(([entry]) => {
      main.style.setProperty("--toolbar-height", `${entry.target.offsetHeight}px`);
    }).observe(toolbar);
  }
  const crops = [
    { x: .42, y: .645 }, { x: .51, y: .64 }, { x: .60, y: .635 }
  ];
  const actor = { x: .5, y: .77, facing: "front" };
  let stage = "intro";
  let effect;
  let busy = false;
  let markerButtons = [];
  let sceneProjection;
  let movedInVillage = false;
  let suppressRoadClickUntil = 0;
  const villagePlaces = [
    { label: "老茶寮", x: .215, y: .63, stop: { x: .216, y: .733 }, visit: showTeaHouse },
    { label: "梯田入口", x: .607, y: .385, stop: { x: .607, y: .656 }, visit: openGarden },
    { label: "水車水閘", x: .847, y: .579, stop: { x: .825, y: .733 }, visit: showSluice }
  ];
  const chapterNames = ["雨後的第一壺茶", "乾日的水路", "留得住的手藝", "水車下的訪客", "湖岸的約定", "茶箱裡的兩封信", "同桌的茶"];
  const coinNames = ["茶寮新手", "守水人", "傳藝人", "溪畔觀察員", "護岸人", "山湖信使", "百年茶緣"];
  const chapterNumbers = "一二三四五六七";
  const chapters = [
    {
      place: 2, speaker: "阿仁伯", task: "去水車水閘看水位，決定乾天怎麼分水。",
      line: "雨只下在靠湖這頭，上坡的蓄水槽還是空的。阿仁伯指著水閘旁的水線：再把水全引上坡，下游的茶樹就分不到水。",
      choices: [
        ["修漏口，輪流灌溉", "大家輪班開水閘，下游也留得住細流。阿仁伯說：『我教妳認水線，但得有人接著學。』", [0, 2, 4, 3]],
        ["先救幼苗，再鋪草保水", "先用存水救了幼苗，再鋪草減少蒸發。成株能等幾天，但茶農得一起改巡田時間。", [-2, 3, 3, 2]]
      ]
    },
    {
      place: 0, speaker: "阿仁伯", task: "回老茶寮，和茶農安排下一代怎麼學做茶。",
      line: "阿仁伯說手腕沒以前有力，茶袋可以交給別人扛，聞葉子判斷火候這件事，卻得有人花時間學。",
      choices: [
        ["約一場兩代人的小課", "青禾把茶寮騰出一桌，讓老茶農示範、年輕人實做。練到一半，有學徒在溪邊發現蝴蝶停在野花上。", [-2, 3, 0, 5]],
        ["跟班記下火候，再輪班示範", "青禾先做了一張火候筆記。茶農每人教一段，長輩能輪流休息。學徒也提議去溪邊找夏天的野花。", [1, 2, 0, 4]]
      ]
    },
    {
      place: 2, speaker: "青禾", task: "到水閘旁觀察溪岸，找出蝴蝶停留的地方。",
      line: "水閘旁有石縫和淺水。蝴蝶停在岸邊一叢不起眼的野花上。哪一處適合留下觀察記號？",
      choices: [
        ["記下野花旁的觀察點", "青禾站在路邊記下花和蝴蝶出現的位置。她往下游一望，發現下一場雨可能把裸露坡面的泥沖進溪裡。", [0, 0, 4, 2]],
        ["站在石路記錄石縫和淺水", "青禾沿著水道觀察，也看見雨水在裸露的坡面留下一道道細溝。", [0, 0, 3, 3]]
      ]
    },
    {
      place: 1, speaker: "阿春阿嬤", task: "到梯田入口，決定怎麼減少泥土流進溪裡。",
      line: "灌溉省下水，溪岸也得留得住土。阿嬤指了指最陡的一段茶壟：『先做哪一小段，讓大家能看見有沒有用？』",
      choices: [
        ["在溪岸留一段草帶", "草帶減慢逕流，也留住野花。鄰居把一只舊茶箱交還茶寮，說裡面可能有以前的交流紀錄。", [-2, 1, 5, 2]],
        ["和鄰居一起鋪草護坡", "大伙從最容易沖刷的那段做起，約好下雨後一起巡查。一位鄰居帶來一只標著日本地址的舊茶箱。", [-1, 1, 4, 4]]
      ]
    },
    {
      place: 0, speaker: "青禾", task: "回老茶寮，把茶箱的寄件印章和開場那封信核對。",
      line: "茶箱裡有一封泛黃的沼田來信，還有一張魚池寄出的回信草稿。青禾想起第一天收到的信。要如何把這兩份紀錄講清楚？",
      choices: [
        ["照寄件地和日期排成往返順序", "比對信上的「沼田」印章後，青禾把兩封信並排展示，留白處寫上待查。她提議在祭典讓大家帶一件物品來補故事。", [0, 0, 0, 5]],
        ["請阿嬤一起核對印章和舊照片", "阿嬤認出照片裡的老茶寮。青禾把能確認的內容寫成標籤，並邀居民在祭典分享各自記得的事。", [0, 0, 0, 5]]
      ]
    },
    {
      place: 0, speaker: "魚池茶緣祭典", task: "到老茶寮前的祭典茶席，泡茶回信並轉出最後一枚紀念幣。",
      line: "茶寮前擺了茶桌，桌上有水線拓印、火候筆記、溪岸觀察圖和兩封舊信。青禾把第一天沒寫完的回信攤開，準備邀沼田的朋友再來喝茶。",
      choices: [
        ["奉茶，寄出回信", "回信寫道：『你們問今年的茶還香不香。香。只是這一壺，要謝的人比從前更多了。』茶寮的門牌仍朝著「營業」。", [0, 2, 0, 5]],
        ["請阿嬤先奉第一杯", "阿嬤把第一杯遞給一路幫忙的鄰居。青禾寄出回信。日落時，兩人在茶桌旁留了兩個位子，等遠方的朋友來。", [0, 2, 0, 5]]
      ]
    }
  ];
  const saveKey = "bainian-chayuan-seven-v1";
  const previewOnly = true;
  let choices = [];
  let replay;
  try {
    const saved = previewOnly ? null : JSON.parse(localStorage.getItem(saveKey));
    if (Array.isArray(saved) && saved.length <= 7 && saved.every(choice => choice === 0 || choice === 1)) choices = saved;
  } catch { /* Play remains available when local storage is unavailable. */ }
  const caption = document.querySelector("#chapter-caption");
  const coinTotal = document.querySelector("#coin-total");
  const statNames = ["經營資金", "茶葉品質", "環境健康", "地方共好"];
  document.querySelector("#story-book").addEventListener("click", showStoryBook);
  document.querySelector("#coin-book").addEventListener("click", showCoinBook);

  function updateBooks() {
    coinTotal.textContent = `${(replay?.choices ?? choices).length}／${previewOnly ? 1 : 7}`;
    const index = Math.min(choices.length, 6);
    caption.textContent = previewOnly ? "第一章・雨後的第一壺茶" : replay ? `重玩・第${chapterNumbers[replay.index]}章`
      : choices.length === 7 ? "七章完結・魚池茶鄉" : `第${chapterNumbers[index]}章・${chapterNames[index]}`;
  }

  function saveChoice(choice) {
    choices.push(choice);
    if (!replay && !previewOnly) {
      try { localStorage.setItem(saveKey, JSON.stringify(choices)); } catch { /* Session progress remains. */ }
    }
    updateBooks();
  }

  function showStoryBook() {
    setPanelVisible(true);
    if (previewOnly) {
      panel("第一章・雨後的第一壺茶", "沼田寄來一封信。青禾想先替阿嬤採一簍春茶，親手泡一壺再回信。", [
        { label: "從第一章開始", run: resetPreview },
        { label: "回目前任務", run: showQuest }
      ]);
      return;
    }
    if (replay) {
      panel("章節重玩", `正在測試第${chapterNumbers[replay.index]}章・${chapterNames[replay.index]}。`, [
        { label: "回到本章", run: showQuest }, { label: "退出重玩", run: endReplay }
      ]);
      return;
    }
    panel("故事・魚池到沼田", "選一章獨立試玩。重玩不會改變原本的章節進度或紀念幣。", [
      ...chapterNames.map((name, index) => ({ label: `${chapterNumbers[index]}・${name}`, run: () => startReplay(index) })),
      { label: "回目前任務", run: showQuest }, { label: "茶園指標", run: showStats }
    ]);
  }

  function startReplay(index) {
    if (busy || replay) return;
    replay = { index, choices, stage, actor: { ...actor }, viewCenter, movedInVillage,
      crops: crops.map(crop => crop.done), tea: { ...tea }, repair };
    choices = Array.from({ length: index }, (_, step) => replay.choices[step] ?? 0);
    clearTimeout(teaTimer);
    Object.assign(tea, { phase: "leaves", readyAt: 0 });
    repair = newRepair();
    main.classList.remove("in-garden");
    resumeGame();
  }

  function endReplay() {
    if (!replay || busy) return;
    const original = replay;
    replay = undefined;
    choices = original.choices;
    stage = original.stage;
    repair = original.repair;
    Object.assign(tea, original.tea);
    crops.forEach((crop, index) => { crop.done = original.crops[index]; });
    if (stage === "garden") openGarden();
    else {
      main.classList.remove("in-garden");
      showVillageMarkers();
    }
    Object.assign(actor, original.actor);
    viewCenter = original.viewCenter;
    movedInVillage = original.movedInVillage;
    updateBooks();
    showQuest();
    render();
  }

  function chapterResultAction() {
    if (replay) return { label: "結束重玩，回原本進度", run: endReplay };
    return choices.length === 7 ? { label: "查看七枚紀念幣", run: showCoinBook }
      : { label: "查看下一章任務", run: showQuest };
  }

  function showStats() {
    const totals = [80, 75, 90, 70];
    for (let index = 1; index < choices.length; index += 1) {
      const impact = chapters[index - 1].choices[choices[index]][2];
      impact.forEach((delta, stat) => { totals[stat] += delta; });
    }
    panel("茶園指標", statNames.map((name, index) =>
      `${name}　${Math.max(0, Math.min(100, totals[index]))}／100`).join("\n"),
    [{ label: "回故事", run: showStoryBook }]);
  }

  function showCoinBook() {
    setPanelVisible(true);
    const earned = (replay?.choices ?? choices).length;
    if (previewOnly) {
      panel(`紀念幣　${earned}／1`, earned ? "已取得「茶寮新手」。" : "完成第一章即可取得「茶寮新手」。");
      return;
    }
    panel(`紀念幣　${earned}／7`, coinNames.map((name, index) =>
      `${index + 1}. ${index < earned ? name : "尚未取得"}`).join("\n"));
  }

  function showChapterEvent() {
    if (stage !== "saga") return;
    const index = choices.length;
    const chapter = chapters[index - 1];
    setPanelVisible(true);
    if (index === 1) {
      panel(chapter.speaker, chapter.line, [{ label: "開始修水閥", run: openValve }]);
      return;
    }
    panel(chapter.speaker, chapter.line, chapter.choices.map(([label, result, impact], choice) => ({
      label,
      run() {
        if (choices.length !== index || stage !== "saga") return;
        const summary = impact.map((value, stat) => value ? `${statNames[stat]} ${value > 0 ? "+" : ""}${value}` : "").filter(Boolean).join("　");
        function conclude() {
          if (choices.length !== index) return;
          saveChoice(choice);
          if (choices.length === 7) stage = "complete";
          panel(`第${chapterNumbers[index]}章完成・${coinNames[index]}`, `${result}\n\n本章影響　${summary}`, [
            chapterResultAction()
          ]);
        }
        if (index === 6) {
          panel("祭典扭蛋", "茶席旁的扭蛋機裝著今年的紀念幣。青禾伸手轉動把手。", [{ label: "轉動扭蛋", run: conclude }]);
        } else conclude();
      }
    })));
  }

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
  const newRepair = () => ({ phase: "inspect", loose: new Set(), tight: 0, upstream: 0, downstream: 0 });
  let repair = newRepair();
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
    if (choices.length !== 1 || valve.open) return;
    updateValve();
    valve.showModal();
  }

  seat.addEventListener("click", () => {
    if (repair.phase === "inspect") repair.phase = "close";
    else if (repair.phase === "seat") repair.phase = "tighten";
    else return;
    updateValve();
  });
  wheel.addEventListener("click", () => {
    if (repair.phase === "close") repair.phase = "unbolt";
    else if (repair.phase === "test") repair.phase = "divide";
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
    if (choices.length !== 1 || repair.phase !== "divide" || repair.upstream < 2 || repair.downstream < 3) return;
    const choice = repair.downstream > repair.upstream ? 1 : 0;
    const [, result, impact] = chapters[0].choices[choice];
    saveChoice(choice);
    valve.close();
    const summary = impact.map((value, index) => value ? `${statNames[index]} ${value > 0 ? "+" : ""}${value}` : "").filter(Boolean).join("　");
    panel("第二章完成・守水人", `接合處不再漏水。上坡 ${repair.upstream} 格，下游 ${repair.downstream} 格。\n${result}\n\n本章影響　${summary}`, [
      chapterResultAction()
    ]);
  });
  function setPanelVisible(visible) {
    chapterPanel.hidden = !visible;
    questButton.setAttribute("aria-expanded", String(visible));
  }

  document.querySelector("#close-chapter").addEventListener("click", () => {
    setPanelVisible(false);
    questButton.focus();
  });
  questButton.addEventListener("click", showQuest);

  function panel(speaker, line, actions = []) {
    panelSpeaker.textContent = speaker;
    panelLine.textContent = line;
    controls.replaceChildren();
    for (const action of actions) {
      const button = document.createElement("button");
      button.type = "button";
      button.textContent = action.label;
      if (action.pressed !== undefined) button.setAttribute("aria-pressed", String(action.pressed));
      button.addEventListener("click", action.run);
      controls.append(button);
    }
  }

  function resetPreview() {
    if (busy) return;
    choices = [];
    clearTimeout(teaTimer);
    Object.assign(tea, { phase: "leaves", readyAt: 0 });
    updateBooks();
    intro();
  }

  function intro() {
    stage = "intro";
    for (const crop of crops) {
      crop.done = false;
      crop.shoots = new Set();
    }
    main.classList.remove("in-garden");
    actor.x = .5;
    actor.y = .77;
    movedInVillage = false;
    viewCenter = .45;
    showVillageMarkers();
    showTeaHouse();
    render();
  }

  function resumeGame() {
    updateBooks();
    if (!choices.length) {
      intro();
      return;
    }
    stage = choices.length === 7 ? "complete" : "saga";
    showVillageMarkers();
    showQuest();
    render();
  }

  function showTeaHouse() {
    setPanelVisible(true);
    if (stage === "home") {
      panel("阿春阿嬤", "妳聞聞，嫩葉裡還有山上的香。水已離火了。坐這裡，妳親手泡一壺，我們嘗過再想怎麼回信。", [
        { label: "坐下試泡春茶", run: openTea }
      ]);
      return;
    }
    if (stage === "complete") {
      showEnding();
      return;
    }
    panel("阿春阿嬤", "雨停了，青禾。沼田寄了封信來，說想念咱們的茶。妳願意替我泡一壺今年的新茶嗎？", [
      { label: "到梯田茶園", run: () => visitPlace(villagePlaces[1]) }
    ]);
  }

  function showSluice() {
    setPanelVisible(true);
    panel("水車水閘", "水車旁的木閘分配灌溉用水。從石路就能看見石溝上的水位刻度和溪邊的野花。");
  }

  function showQuest() {
    setPanelVisible(true);
    if (replay && choices.length > replay.index) {
      panel("章節重玩完成", `已完成「${chapterNames[replay.index]}」的試玩。原本的進度仍可繼續。`, [chapterResultAction()]);
      return;
    }
    if (stage === "garden") {
      const done = crops.every(crop => crop.done);
      showGardenPanel(done ? "春茶採好了。帶嫩葉回茶寮找阿嬤。" : "點茶株標記，走近採摘。");
      return;
    }
    if (stage === "complete") {
      showEnding();
      return;
    }
    if (stage === "saga") {
      const chapter = chapters[choices.length - 1];
      const place = villagePlaces[chapter.place];
      panel(`第${chapterNumbers[choices.length]}章・${chapterNames[choices.length]}`, chapter.task, [
        { label: `前往${place.label}`, run: () => visitPlace(place) }
      ]);
      return;
    }
    const atHome = stage === "home";
    panel("目前任務・雨後的第一壺茶",
      atHome ? "田間工作已完成。回茶寮和阿嬤泡一壺新茶。"
        : "從木門進梯田，採三株春茶的嫩葉，再帶回老茶寮。你也可以先點石路探索。",
      [atHome ? { label: "找阿嬤泡茶", run: () => visitPlace(villagePlaces[0]) }
        : { label: "到梯田茶園", run: () => visitPlace(villagePlaces[1]) }]);
  }

  function showVillageMarkers() {
    targets.replaceChildren();
    markerButtons = villagePlaces.map(place => {
      const button = document.createElement("button");
      button.type = "button";
      button.className = "scene-target";
      button.dataset.kind = "place";
      button.textContent = place.label;
      button.addEventListener("click", () => visitPlace(place));
      targets.append(button);
      return button;
    });
  }

  function visitPlace(place) {
    if (replay && choices.length > replay.index) {
      showQuest();
      return;
    }
    if (stage === "saga" && place === villagePlaces[chapters[choices.length - 1].place]) {
      walkVillage(place.stop, showChapterEvent);
      return;
    }
    if (place === villagePlaces[1] && stage !== "intro") {
      walkVillage(place.stop, () => {
        setPanelVisible(true);
        panel("梯田入口", "今天的春茶採好了。沿石階下去就是茶寮前的路。");
      });
      return;
    }
    walkVillage(place.stop, place.visit);
  }

  function walkVillage(destination, arrive) {
    if (busy || stage === "garden") return;
    busy = true;
    movedInVillage = true;
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

  function openGarden() {
    stage = "garden";
    setPanelVisible(true);
    actor.x = .48;
    actor.y = .791;
    actor.facing = "back";
    viewCenter = .51;
    main.classList.add("in-garden");
    targets.replaceChildren();
    markerButtons = crops.map((crop, index) => {
      const button = document.createElement("button");
      button.type = "button";
      button.className = "scene-target";
      button.dataset.kind = "pick";
      button.setAttribute("aria-label", `採第 ${index + 1} 株茶`);
      button.innerHTML = "<span class=\"interaction-marker\" aria-hidden=\"true\"><span>✦</span></span>";
      button.addEventListener("click", () => tend(crop));
      targets.append(button);
      return button;
    });
    showGardenPanel("春茶正好，採三株嫩梢。");
    render();
  }

  function showGardenPanel(line) {
    const picked = crops.filter(crop => crop.done).length;
    const actions = picked === crops.length ? [{ label: "帶茶葉回老茶寮", run: returnHome }] : [];
    panel(`春茶採收　${picked}／${crops.length}`, line, actions);
  }

  function tween(duration, draw, done) {
    activeTween = { duration, draw, done };
    scheduleFrame();
  }

  function tend(crop) {
    if (busy || crop.done || stage !== "garden") return;
    busy = true;
    const startX = actor.x;
    const startCenter = viewCenter;
    const endX = crop.x - .026;
    const startY = actor.y;
    const endY = .785;
    actor.facing = Math.abs(endX - startX) > Math.abs(endY - startY) ? (endX < startX ? "left" : "right") : (endY < startY ? "back" : "front");
    effect = { kind: "walk", amount: 0, crop };
    tween(190 + Math.hypot((endX - startX) * 3250, (endY - startY) * 2450), progress => {
      const amount = progress * progress * (3 - 2 * progress);
      actor.x = startX + (endX - startX) * amount;
      actor.y = startY + (endY - startY) * amount;
      viewCenter = startCenter;
      effect.amount = amount;
      effect.distance = Math.hypot((endX - startX) * width, (endY - startY) * height) * amount;
    }, () => {
      effect = undefined;
      actor.facing = "back";
      openHarvest(crop);
    });
  }

  function returnHome() {
    stage = "home";
    main.classList.remove("in-garden");
    actor.x = villagePlaces[0].stop.x;
    actor.y = villagePlaces[0].stop.y;
    actor.facing = "back";
    viewCenter = .34;
    showVillageMarkers();
    showTeaHouse();
    render();
  }

  const coinAward = document.querySelector("#coin-award");

  function finish() {
    if (stage !== "home") return;
    saveChoice(0);
    coinAward.showModal();
    if (previewOnly) {
      stage = "complete";
      showEnding();
      return;
    }
    stage = "saga";
    panel("第一章完成・茶寮新手", "阿嬤抿了一口：「清香還在。跟沼田的朋友說，今年我們也等他們來。」青禾翻回「營業」，才鋪開信紙，阿仁伯就來報信：靠湖這頭下了雨，上坡的蓄水槽卻還空著。", [
      chapterResultAction()
    ]);
  }

  const teaBench = document.querySelector("#tea-workbench");
  const teaTable = document.querySelector("#tea-table");
  const teaInstruction = document.querySelector("#tea-instruction");
  const teaEffects = teaTable.querySelector(".tea-effects").getContext("2d");
  const cupSurface = teaTable.querySelector(".cup-surface").getContext("2d");
  const scoopCanvas = teaTable.querySelector(".scoop-content").getContext("2d");
  const cupOpening = { x: 21, y: 10, rx: 13, ry: 6 };
  const cupRows = [
    [],
    [[18, 24], [16, 26], [16, 26], [18, 24]],
    [[17, 25], [14, 28], [13, 29], [13, 29], [15, 27], [17, 25]],
    [[18, 24], [14, 28], [12, 30], [11, 31], [11, 31], [12, 30], [14, 28], [17, 25]]
  ];
  function drawCup(level, time = 0) {
    cupSurface.clearRect(0, 0, 48, 42);
    const rows = cupRows[level];
    const top = 15 - rows.length;
    rows.forEach(([left, right], index) => {
      const y = top + index;
      for (let x = left; x <= right; x += 1) {
        const { x: cx, y: cy, rx, ry } = cupOpening;
        if (((x - cx) / rx) ** 2 + ((y - cy) / ry) ** 2 > 1) continue;
        cupSurface.fillStyle = index === 0 ? "#98541e" :
          y === top + 2 && x >= 16 + Math.floor(time / 100) % 4 && x < 21 ? "#efb64b" : "#be781e";
        cupSurface.fillRect(x, y, 1, 1);
      }
    });
  }

  const dryTeaPalette = ["#211610", "#36241a", "#563827", "#795137"];
  const dryTeaGroups = [3, 2, 4, 3, 3, 4, 2, 3, 4, 3, 2, 3];
  let dryTeaTime = 130;
  const scoopLeaves = dryTeaGroups.flatMap((size, group) => {
    const release = dryTeaTime;
    dryTeaTime += 55 + group * 23 % 35;
    return Array.from({ length: size }, (_, index) => {
      const n = group * 4 + index;
      const angle = n * 2.399963;
      const radius = Math.sqrt((n + .5) / 48);
      return {
        x: Math.round(17 + radius * (10 * Math.cos(angle) - 8 * Math.sin(angle))),
        y: Math.round(28 + radius * (10 * Math.sin(angle) - 8 * Math.cos(angle))),
        release, n
      };
    });
  });

  function dryTeaPixel(context, x, y, n, angle) {
    const length = 3 + n % 3;
    for (let j = 0; j < length; j += 1) {
      const dx = j - (length - 1) / 2;
      const dy = j === 0 || j === length - 1 ? 0 : (n % 2 ? 1 : -1);
      const px = x + Math.round(dx * Math.cos(angle) - dy * Math.sin(angle));
      const py = y + Math.round(dx * Math.sin(angle) + dy * Math.cos(angle));
      context.fillStyle = dryTeaPalette[j === 0 ? 0 : j === 2 && n % 3 === 0 ? 3 : 1 + n % 2];
      context.fillRect(px, py, 1, 1);
    }
  }

  function drawScoop(time = -200) {
    scoopCanvas.clearRect(0, 0, 48, 45);
    for (const leaf of scoopLeaves) {
      if (time >= leaf.release) continue;
      const slide = Math.max(0, 1 - (leaf.release - time) / 125);
      const x = Math.round(leaf.x + (10 - leaf.x) * slide);
      const y = Math.round(leaf.y + (38 - leaf.y) * slide);
      dryTeaPixel(scoopCanvas, x, y, leaf.n, leaf.n * .71 + slide * .2);
    }
  }

  function drawSteam(now) {
    if (!teaBench.open || tea.phase !== "steep") return;
    teaEffects.clearRect(0, 0, 480, 270);
    const shades = ["#faf2dfaa", "#faf2df77", "#faf2df44"];
    for (let i = 0; i < 4; i += 1) {
      const age = (Math.floor(now / 85) + i * 6) % 24;
      const x = 239 + Math.round(Math.sin(age / 4 + i) * 4);
      const y = 155 - age;
      teaEffects.fillStyle = shades[Math.floor(age / 8)];
      teaEffects.fillRect(x, y, 4, 3);
      teaEffects.fillRect(x + 1, y - 1, 2, 5);
    }
    requestAnimationFrame(drawSteam);
  }
  const harvest = document.querySelector("#harvest-view");
  const harvestScene = document.querySelector("#harvest-scene");
  const harvestInstruction = document.querySelector("#harvest-instruction");
  const tea = { phase: "leaves", readyAt: 0 };
  let pickingCrop;
  const hands = {
    left: { image: document.querySelector("#harvest-left-hand"), leaf: document.querySelector("#harvest-left-leaf"), rest: { x: 17, y: 76 }, base: { x: -2, y: 104 }, mirror: true, held: [] },
    right: { image: document.querySelector("#harvest-hand"), leaf: document.querySelector("#harvest-loose-leaf"), rest: { x: 87, y: 76 }, base: { x: 102, y: 104 }, mirror: false, held: [] }
  };
  const harvestPile = document.querySelector("#harvest-pile");
  const harvestFinish = document.querySelector("#harvest-finish");
  const harvestBasket = harvestScene.querySelector('[data-object="basket"]');
  const shoots = [...harvestScene.querySelectorAll(".harvest-shoot")];
  let handRun = 0;
  let teaTimer;
  let pouring = false;
  let pourRun = 0;
  const teaSteps = {
    leaves: ["leaves", "pot", "捏住茶葉，把嫩葉放進空壺。"],
    water: ["kettle", "pot", "提起水壺，移到茶壺口上方，把水倒進去。"],
    steep: [null, null, "讓嫩葉在熱水裡舒展一下。"],
    cup: ["pot", "cup", "茶香出來了。提起茶壺，把茶湯倒進杯裡。"],
    serve: ["cup", "grandma", "把盛好的茶杯移到阿嬤手邊。"]
  };

  function dragObjects(scene, accepts, drop, miss) {
    let drag;
    function release(event, canceled) {
      if (!drag || event.pointerId !== drag.id) return;
      const { object, x, y } = drag;
      object.style.removeProperty("--drag-x");
      object.style.removeProperty("--drag-y");
      object.classList.remove("dragging");
      drag = undefined;
      if (canceled) return;
      const target = Array.from(scene.querySelectorAll("[data-object]")).find(item => {
        if (item === object || item.hidden) return false;
        const rect = item.getBoundingClientRect();
        return event.clientX >= rect.left && event.clientX <= rect.right &&
          event.clientY >= rect.top && event.clientY <= rect.bottom;
      });
      if (target) drop(object, target, { x: event.clientX - x, y: event.clientY - y });
      else miss();
    }
    scene.addEventListener("pointerdown", event => {
      const object = event.target.closest("[data-object]");
      if (!object || drag || !accepts(object) || event.button !== 0) return;
      event.preventDefault();
      drag = { object, id: event.pointerId, x: event.clientX, y: event.clientY };
      object.classList.add("dragging");
      scene.setPointerCapture(event.pointerId);
    });
    scene.addEventListener("pointermove", event => {
      if (!drag || event.pointerId !== drag.id) return;
      drag.object.style.setProperty("--drag-x", (event.clientX - drag.x) + "px");
      drag.object.style.setProperty("--drag-y", (event.clientY - drag.y) + "px");
    });
    scene.addEventListener("pointerup", event => release(event, false));
    scene.addEventListener("pointercancel", event => release(event, true));
    scene.addEventListener("lostpointercapture", event => release(event, true));
  }

  function renderTea(message) {
    if (tea.phase === "steep" && Date.now() >= tea.readyAt) tea.phase = "cup";
    const [source, target, instruction] = teaSteps[tea.phase];
    teaTable.dataset.phase = tea.phase;
    if (tea.phase !== "steep" && !pouring) teaEffects.clearRect(0, 0, 480, 270);
    drawCup(tea.phase === "serve" ? 3 : 0);
    if (tea.phase === "leaves") drawScoop();
    teaInstruction.hidden = false;
    teaInstruction.textContent = message ?? instruction;
    for (const object of teaTable.querySelectorAll("[data-object]")) {
      object.dataset.pickable = String(object.dataset.object === source);
      object.dataset.destination = String(object.dataset.object === target);
      if (object.dataset.object === source) object.dataset.guide = "active";
      else delete object.dataset.guide;
    }
  }

  function openTea() {
    if (stage !== "home" || teaBench.open) return;
    renderTea();
    teaBench.showModal();
    if (tea.phase === "steep") requestAnimationFrame(drawSteam);
    if (tea.phase === "steep") teaTimer = setTimeout(() => renderTea(), Math.max(0, tea.readyAt - Date.now()));
  }

  function teaDrop(source, target, offset) {
    if (stage !== "home" || !teaBench.open || pouring) return;
    const [expectedSource, expectedTarget] = teaSteps[tea.phase];
    if (source.dataset.object !== expectedSource || target.dataset.object !== expectedTarget) {
      renderTea("這一步要放到發亮的位置，再試一下。");
      return;
    }
    if (tea.phase === "serve") {
      const run = ++pourRun;
      pouring = true;
      source.classList.add("pouring-prop");
      teaInstruction.textContent = "阿嬤握住杯把，抿一口春茶。";
      teaTable.dataset.sipping = "true";
      const timings = [0, 310, 630, 950, 1660, 2040, 2620];
      let start;
      const layers = [...teaTable.querySelectorAll(".tea-sip-sequence > div")];
      let frame = -1;
      function sip(now) {
        if (run !== pourRun || !teaBench.open) return;
        start ??= now;
        const elapsed = now - start;
        const next = accessibility.matches ? 5 : timings.findLastIndex(cue => cue <= elapsed);
        if (next === 6 || (accessibility.matches && elapsed >= 500)) {
          clearPour(source);
          teaBench.close();
          finish();
          return;
        }
        if (frame !== next) {
          frame = next;
          const layer = layers[frame % 2];
          layer.dataset.sipFrame = String(frame);
          layer.style.setProperty("--sip-column", String(frame % 3));
          layer.style.setProperty("--sip-row", String(Math.floor(frame / 3)));
          layer.style.zIndex = String(frame + 1);
          layer.animate([{ opacity: frame === 0 ? 1 : 0 }, { opacity: 1 }],
            { duration: accessibility.matches || frame === 3 ? 1 : 145, fill: "forwards" });
        }
        requestAnimationFrame(sip);
      }
      requestAnimationFrame(sip);
      return;
    }
    const phase = tea.phase;
    animatePour(source, target, offset, phase, () => {
      if (phase === "leaves") tea.phase = "water";
      if (phase === "water") {
        tea.phase = "steep";
        requestAnimationFrame(drawSteam);
        tea.readyAt = Date.now() + 6500;
        clearTimeout(teaTimer);
        teaTimer = setTimeout(() => { if (teaBench.open) renderTea(); }, 6500);
      }
      if (phase === "cup") tea.phase = "serve";
      renderTea();
    });
  }

  function clearPour(source) {
    source.style.removeProperty("--drag-x");
    source.style.removeProperty("--drag-y");
    source.style.removeProperty("--drag-angle");
    source.classList.remove("pouring-prop");
    delete source.dataset.empty;
    delete teaTable.dataset.sipping;
    for (const layer of teaTable.querySelectorAll(".tea-sip-sequence > div")) {
      for (const animation of layer.getAnimations()) animation.cancel();
      layer.style.removeProperty("z-index");
      delete layer.dataset.sipFrame;
    }
    teaEffects.clearRect(0, 0, 480, 270);
    pouring = false;
  }

  function animatePour(source, target, offset, phase, done) {
    const run = ++pourRun;
    pouring = true;
    source.classList.add("pouring-prop");
    const scene = teaTable.getBoundingClientRect();
    const from = source.getBoundingClientRect();
    const into = target.getBoundingClientRect();
    // Anchors are measured inside the cropped sprite, at the lip and the opening.
    const lip = { leaves: [.20, .88], water: [.12, .55], cup: [.08, .37] }[phase];
    const opening = phase === "cup" ? [.43, .29] : [.50, .24];
    const receiver = { x: into.left - scene.left + into.width * opening[0], y: into.top - scene.top + into.height * opening[1] };
    const center = { x: from.left - scene.left + from.width / 2, y: from.top - scene.top + from.height / 2 };
    const dx = (lip[0] - .5) * from.width;
    const dy = (lip[1] - .5) * from.height;
    const angle = { leaves: -35, water: -24, cup: -30 }[phase];
    const radians = angle * Math.PI / 180;
    const lipX = dx * Math.cos(radians) - dy * Math.sin(radians);
    const lipY = dx * Math.sin(radians) + dy * Math.cos(radians);
    const clearance = phase === "water" ? scene.height * .115 : Math.max(14, scene.height * .16);
    const streamOffset = phase === "water" ? scene.width * .008 : 0;
    const aligned = { x: receiver.x + streamOffset - center.x - lipX, y: receiver.y - clearance - center.y - lipY };
    const flowTime = phase === "leaves" ? 1260 : 1250;
    const alignTime = 340;
    const returnTime = 340;
    let start;
    const mix = (a, b, t) => a + (b - a) * t;
    const ease = t => t * t * (3 - 2 * t);
    function pose(x, y, tilt) {
      source.style.setProperty("--drag-x", Math.round(x / scene.width * 480) * scene.width / 480 + "px");
      source.style.setProperty("--drag-y", Math.round(y / scene.height * 270) * scene.height / 270 + "px");
      source.style.setProperty("--drag-angle", (phase === "cup" ? Math.round(tilt / 15) * 15 : tilt) + "deg");
    }
    pose(offset.x, offset.y, 0);
    const gridX = Math.round(receiver.x / scene.width * 480);
    const gridY = Math.round(receiver.y / scene.height * 270);
    const sourceOffset = Math.round(streamOffset / scene.width * 480);
    const fall = Math.round(clearance / scene.height * 270);
    function effects(time, fill) {
      teaEffects.clearRect(0, 0, 480, 270);
      const top = gridY - fall;
      if (phase === "leaves") {
        drawScoop(time);
        for (const leaf of scoopLeaves) {
          const age = time - leaf.release;
          const duration = 165 + leaf.n * 17 % 46;
          if (age < 0 || age >= duration + 110) continue;
          const x = gridX + (leaf.n * 13 % 9 - 4);
          if (age < duration) {
            const p = age / duration;
            const y = top + Math.round(p * p * fall);
            if (y < gridY - 1) dryTeaPixel(teaEffects, x, Math.min(y, gridY - 4), leaf.n, leaf.n * .71 + p * .36);
          } else if (leaf.n % 4 === 0) {
            const dust = age - duration;
            teaEffects.globalAlpha = dust < 45 ? .65 : .28;
            teaEffects.fillStyle = "#bf956e";
            teaEffects.fillRect(x - 1, gridY - 2 - Math.floor(dust / 40), 1, 1);
            teaEffects.fillRect(x + 1, gridY - 3, 1, 1);
            teaEffects.globalAlpha = 1;
          }
        }
        return;
      }
      if (phase === "water") {
        const length = Math.min(fall, Math.floor(time / 3));
        const glint = Math.floor(time / 28);
        for (let y = 0; y < length; y += 1) {
          const progress = y / (fall - 1);
          const x = gridX + Math.round(sourceOffset * (1 - progress * progress));
          teaEffects.fillStyle = "#9cc8cd";
          teaEffects.fillRect(x, top + y, 3, 1);
          teaEffects.fillStyle = (y - glint) % 9 === 0 ? "#def5e9" : "#b9dfe3";
          teaEffects.fillRect(x + 1, top + y, 1, 1);
        }
        if (length === fall && glint % 8 < 3) {
          teaEffects.fillStyle = "#def5e9";
          teaEffects.fillRect(gridX - 2, gridY - 2, 1, 1);
          teaEffects.fillRect(gridX + 4, gridY - 3, 1, 1);
        }
        return;
      }
      const cycle = Math.floor(time / 80) % 3;
      const depth = Math.round(6 * (1 - fill));
      const length = Math.min(fall + depth, Math.floor(time / 3));
      for (let y = 0; y < length; y += 1) {
        const progress = Math.min(1, y / Math.max(1, fall - 1));
        const x = gridX + Math.round(Math.sin(progress * Math.PI) * (cycle + 1) * .6);
        teaEffects.fillStyle = "#d79340";
        teaEffects.fillRect(x, top + y, 2, 1);
        teaEffects.fillStyle = "#f3ca79";
        if ((y + cycle) % 4 !== 0) teaEffects.fillRect(x, top + y, 1, 1);
      }
      if (length === fall + depth) {
        teaEffects.fillRect(gridX - 2 - cycle, gridY + depth - 1, 1, 1);
        teaEffects.fillRect(gridX + 2 + cycle, gridY + depth, 1, 1);
      }
    }
    function frame(now) {
      if (run !== pourRun || !teaBench.open) return;
      start ??= now;
      const elapsed = accessibility.matches ? alignTime + flowTime + returnTime : now - start;
      if (elapsed < alignTime) {
        const p = ease(elapsed / alignTime);
        pose(mix(offset.x, aligned.x, p), mix(offset.y, aligned.y, p), angle * p);
      } else if (elapsed < alignTime + flowTime) {
        pose(aligned.x, aligned.y, angle);
        const time = elapsed - alignTime;
        const fill = Math.max(0, (time - 150) / (flowTime - 150));
        if (phase === "cup") drawCup(Math.min(3, Math.floor(fill * 4)), time);
        effects(time, fill);
      } else if (elapsed < alignTime + flowTime + returnTime) {
        teaEffects.clearRect(0, 0, 480, 270);
        const p = 1 - ease((elapsed - alignTime - flowTime) / returnTime);
        pose(aligned.x * p, aligned.y * p, angle * p);
      } else {
        clearPour(source);
        done();
        return;
      }
      requestAnimationFrame(frame);
    }
    requestAnimationFrame(frame);
  }

  teaBench.addEventListener("close", () => {
    clearTimeout(teaTimer);
    pourRun += 1;
    for (const prop of teaTable.querySelectorAll(".pouring-prop")) clearPour(prop);
  });
  dragObjects(teaTable, object => !pouring && object.dataset.pickable === "true", teaDrop,
    () => renderTea("把手上的東西移到發亮的位置再放開。"));

  function openHarvest(crop) {
    pickingCrop = crop;
    crop.shoots ??= new Set();
    for (const shoot of shoots) {
      shoot.hidden = crop.shoots.has(shoot.dataset.object);
      shoot.disabled = false;
    }
    harvestFinish.hidden = true;
    drawBasket();
    // The hidden dialog has no layout dimensions until it opens.
    harvest.showModal();
    for (const hand of Object.values(hands)) {
      hand.busy = false;
      hand.held = [];
      hand.leaf.hidden = true;
      setHarvestGrip(hand, false);
      placeHarvestHand(hand, hand.rest);
      point(hand.leaf, hand.rest);
    }
    showHarvestCounts();
  }

  harvest.addEventListener("close", () => {
    handRun += 1;
    delete harvestScene.dataset.reaching;
    for (const hand of Object.values(hands)) {
      hand.busy = false;
      hand.leaf.hidden = true;
    }
    for (const leaf of harvestScene.querySelectorAll(".harvest-deposit-leaf")) leaf.remove();
    const finishedCrop = pickingCrop?.done;
    pickingCrop = undefined;
    busy = false;
    effect = undefined;
    if (finishedCrop) showGardenPanel(crops.every(plant => plant.done) ? "春茶採好了。回去找阿嬤吧。" : "嫩梢入簍。沿茶壟往下一株採。");
    render();
  });
  harvestFinish.addEventListener("click", () => harvest.close());

  function drawBasket(falling) {
    const count = crops.reduce((total, crop) => total + (crop.shoots?.size ?? 0), 0);
    const palette = ["#234117", "#365d21", "#57812d", "#8bad46"];
    const context = harvestPile.getContext("2d");
    context.clearRect(0, 0, 100, 52);
    for (const [x, y, shade] of basketPixels(count, crops.length * shoots.length)) {
      context.fillStyle = palette[shade];
      context.fillRect(x, y, 1, 1);
    }
    if (falling) {
      const [x, y] = falling;
      context.fillStyle = palette[2];
      context.fillRect(x - 3, y - 2, 7, 2);
      context.fillStyle = palette[3];
      context.fillRect(x, y - 4, 2, 4);
    }
  }

  function point(element, position) {
    element.style.left = position.x + "%";
    element.style.top = position.y + "%";
  }

  function setHarvestGrip(hand, gripping) {
    hand.image.src = gripping ? playerArt.harvest.grip : playerArt.harvest.reach;
  }

  function harvestArmPose(hand, position, width, height) {
    const x = Math.round(position.x * width / 100);
    const y = Math.round(position.y * height / 100);
    const dx = Math.round(hand.base.x * width / 100) - x;
    const dy = Math.round(hand.base.y * height / 100) - y;
    const distance = Math.hypot(dx, dy);
    return { x, y, angle: Math.atan2(dy, dx), reachable: distance <= width * .82 * .79 };
  }

  function placeHarvestHand(hand, position) {
    const pose = harvestArmPose(hand, position, harvestScene.clientWidth, harvestScene.clientHeight);
    hand.image.style.left = pose.x + "px";
    hand.image.style.top = pose.y + "px";
    hand.image.style.transform = `rotate(${pose.angle}rad) scaleY(${hand.mirror ? -1 : 1})`;
  }

  function centerOf(element) {
    const scene = harvestScene.getBoundingClientRect();
    const rect = element.getBoundingClientRect();
    return { x: (rect.left - scene.left + rect.width / 2) / scene.width * 100,
      y: (rect.top - scene.top + rect.height / 2) / scene.height * 100 };
  }

  function moveHand(hand, run, start, end, duration, carrying, done) {
    let first;
    function frame(now) {
      if (run !== handRun || !harvest.open) return;
      first ??= now;
      const fraction = accessibility.matches ? 1 : Math.min(1, (now - first) / duration);
      const progress = start === hand.rest ? 1 - (1 - fraction) ** 3 : fraction ** 2;
      const position = { x: start.x + (end.x - start.x) * progress,
        y: start.y + (end.y - start.y) * progress };
      placeHarvestHand(hand, position);
      if (carrying) point(hand.leaf, position);
      if (fraction < 1) requestAnimationFrame(frame);
      else done?.();
    }
    requestAnimationFrame(frame);
  }

  function showHarvestCounts() {
    harvestInstruction.textContent = `點亮框裡的嫩梢採摘。已入簍 ${pickingCrop.shoots.size}／6。`;
    harvestInstruction.hidden = pickingCrop.shoots.size === shoots.length;
    const next = shoots.find(shoot => !shoot.hidden && !shoot.disabled);
    for (const shoot of shoots) shoot.dataset.guide = shoot === next ? "active" : "pending";
  }

  for (const shoot of shoots) shoot.addEventListener("click", event => {
    const bounds = harvestScene.getBoundingClientRect();
    const stem = event.detail ? {
      x: (event.clientX - bounds.left) / bounds.width * 100,
      y: (event.clientY - bounds.top) / bounds.height * 100
    } : centerOf(shoot);
    const hand = hands[centerOf(shoot).x < 50 ? "left" : "right"];
    if (!pickingCrop || shoot.hidden || Object.values(hands).some(side => side.busy)) return;
    if (!harvestArmPose(hand, stem, bounds.width, bounds.height).reachable) {
      harvestInstruction.textContent = "這裡搆不到，試著點紅箭頭底下的嫩梢。";
      return;
    }
    hand.busy = true;
    shoot.disabled = true;
    harvestScene.dataset.reaching = "true";
    const crop = pickingCrop;
    const run = handRun;
    const basket = centerOf(harvestBasket);
    setHarvestGrip(hand, hand.held.length > 0);
    moveHand(hand, run, hand.rest, stem, 370, hand.held.length > 0, pluck);
    function pluck() {
      setHarvestGrip(hand, true);
      shoot.hidden = true;
      hand.held.push(shoot.dataset.object);
      hand.leaf.dataset.held = hand.held.length;
      point(hand.leaf, stem);
      hand.leaf.hidden = false;
      showHarvestCounts();
      const release = { x: basket.x + (hand.mirror ? -7 : 3), y: basket.y - 7 };
      moveHand(hand, run, stem, release, 300, true, () => {
        setHarvestGrip(hand, false);
        hand.leaf.hidden = true;
        let start;
        function fall(now) {
          if (run !== handRun || !harvest.open) return;
          start ??= now;
          const progress = accessibility.matches ? 1 : Math.min(1, (now - start) / 230);
          if (progress < 1) {
            drawBasket([hand.mirror ? 24 : 63, Math.round(progress * progress * 35)]);
            requestAnimationFrame(fall);
            return;
          }
          hand.held = [];
          crop.shoots.add(shoot.dataset.object);
          crop.done = crop.shoots.size === shoots.length;
          drawBasket();
          showHarvestCounts();
          moveHand(hand, run, release, hand.rest, 250, false, () => {
            hand.busy = false;
            delete harvestScene.dataset.reaching;
            if (!crop.done) return;
            if (crops.every(plant => plant.done)) {
              harvestInstruction.textContent = "三處的春茶都採齊了，小茶簍已經裝滿。";
              harvestFinish.hidden = false;
            } else harvest.close();
          });
        }
        requestAnimationFrame(fall);
      });
    }
  });


  function showEnding() {
    if (previewOnly) {
      panel("第一章完成・茶寮新手", "阿嬤接過茶，抿了一口：「清香還在。跟沼田的朋友說，今年我們也等他們來。」青禾把門牌翻回「營業」，在茶杯旁攤開新的信紙。", [
        { label: "再玩一次", run: resetPreview }, { label: "查看紀念幣", run: showCoinBook }
      ]);
      return;
    }
    panel("七章完結・同桌的茶", "雨後收到的那封信，終於有了回音。青禾寄出回信，茶寮也重新開張了。門前茶席還留著兩個空位，等沼田的朋友來喝茶。", [
      { label: "查看七枚紀念幣", run: showCoinBook },
      { label: "查看故事", run: showStoryBook }
    ]);
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
    context.drawImage(stage === "garden" ? garden : backdrop, 0, 0, width, height);
    if (stage !== "garden") context.drawImage(haze, 0, 0);
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
    if (stage !== "garden") lanterns.forEach(([x, y, size], index) => {
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
    const zoom = scale * (stage === "garden" || portraitRatio ? 1.035 : 1.12);
    const margin = Math.max(viewportWidth, viewportHeight) * .009;
    const center = stage === "garden" && !portraitRatio ? .5 : viewCenter;
    const cropX = Math.min(0, Math.max(viewportWidth - width * zoom, viewportWidth / 2 - width * zoom * center));
    const cropY = (viewportHeight - height * scale) / 2;
    context.setTransform(1, 0, 0, 1, 0, 0);
    context.fillStyle = "#101f1c";
    context.fillRect(0, 0, viewportWidth, viewportHeight);
    const originX = Math.min(0, Math.max(viewportWidth - width * zoom, cropX + pointer.x * margin));
    const originY = Math.min(0, Math.max(viewportHeight - height * zoom,
      cropY - (zoom - scale) * height / 2 + pointer.y * margin));
    sceneProjection = { zoom, originX: Math.round(originX), originY: Math.round(originY) };
    context.imageSmoothingEnabled = false;
    context.setTransform(zoom, 0, 0, zoom, Math.round(originX), Math.round(originY));
    drawLandscape();
    if (stage !== "garden") drawWater();
    drawLighting();
    drawBirds();
    heroContext.setTransform(1, 0, 0, 1, 0, 0);
    heroContext.clearRect(0, 0, heroLayer.width, heroLayer.height);
    const heroScaleX = heroLayer.width / viewportWidth;
    const heroScaleY = heroLayer.height / viewportHeight;
    heroContext.setTransform(zoom * heroScaleX, 0, 0, zoom * heroScaleY,
      Math.round(originX) * heroScaleX, Math.round(originY) * heroScaleY);
    drawHero();
    drawButterflies();
    drawLeaves();
    if (stage !== "garden") drawForeground();
    drawRain();
    markerButtons.forEach((button, index) => {
      const point = stage === "garden" ? crops[index] : villagePlaces[index];
      const x = originX + point.x * width * zoom;
      const y = originY + point.y * height * zoom;
      const margin = (stage === "garden" ? 22 : 38) * viewportWidth / canvas.clientWidth;
      button.hidden = Boolean(point.done) || x < margin || x > viewportWidth - margin || y < 22 || y > viewportHeight - 22;
      button.style.left = `${x / viewportWidth * 100}%`;
      button.style.top = `${y / viewportHeight * 100}%`;
    });
    const first = stage === "garden" && markerButtons.find(button => !button.hidden);
    gardenGuide.hidden = stage !== "garden" || busy || crops.every(crop => crop.done);
    if (!gardenGuide.hidden && !gardenGuide.textContent) {
      gardenGuide.textContent = "點亮框茶株走近，再點嫩梢採摘。";
    }
    if (stage === "garden") {
      for (const button of markerButtons) {
        button.dataset.guide = button === first && !busy ? "active" : "pending";
      }
    }

  }

  function resize() {
    const ratio = Math.min(480 / Math.max(1, canvas.clientWidth), 270 / Math.max(1, canvas.clientHeight));
    canvas.width = Math.max(1, Math.round(canvas.clientWidth * ratio));
    canvas.height = Math.max(1, Math.round(canvas.clientHeight * ratio));
    const heroRatio = Math.min(devicePixelRatio || 1, 1.75);
    heroLayer.width = Math.max(1, Math.round(canvas.clientWidth * heroRatio));
    heroLayer.height = Math.max(1, Math.round(canvas.clientHeight * heroRatio));
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
      pointer.x += (pointer.targetX - pointer.x) * amount;
      pointer.y += (pointer.targetY - pointer.y) * amount;
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
    return Boolean(teaBench.open || harvest.open || valve.open);
  }

  function scheduleFrame() {
    if (animation === undefined && (activeTween || (!paused && !closeupOpen() && !document.hidden))) {
      animation = requestAnimationFrame(frame);
    }
  }

  for (const closeup of [teaBench, harvest, valve]) {
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
    if (drag?.id === event.pointerId) {
      if (Math.abs(event.clientX - drag.x) > 7) drag.moved = true;
      const movement = (event.clientX - drag.x) / Math.max(canvas.clientHeight * width / height, canvas.clientWidth);
      viewCenter = Math.max(.14, Math.min(.86, drag.center - movement));
      if (paused) render();
      return;
    }
    if (event.pointerType !== "mouse") return;
    pointer.targetX = .5 - event.offsetX / canvas.clientWidth;
    pointer.targetY = .5 - event.offsetY / canvas.clientHeight;
  });
  canvas.addEventListener("pointerdown", event => {
    if (event.pointerType === "mouse" || canvas.clientWidth >= canvas.clientHeight || busy) return;
    drag = { id: event.pointerId, x: event.clientX, center: viewCenter };
    canvas.setPointerCapture(event.pointerId);
  });
  for (const eventName of ["pointerup", "pointercancel"]) {
    canvas.addEventListener(eventName, event => {
      if (drag?.id !== event.pointerId) return;
      if (drag.moved) suppressRoadClickUntil = performance.now() + 250;
      drag = undefined;
    });
  }
  canvas.addEventListener("pointerleave", () => {
    pointer.targetX = 0;
    pointer.targetY = 0;
  });
  canvas.addEventListener("click", event => {
    if (stage === "garden" || busy || performance.now() < suppressRoadClickUntil) return;
    const rect = canvas.getBoundingClientRect();
    const { zoom, originX, originY } = sceneProjection;
    const x = ((event.clientX - rect.left) * canvas.width / rect.width - originX) / (width * zoom);
    const y = ((event.clientY - rect.top) * canvas.height / rect.height - originY) / (height * zoom);
    // Keep feet on the continuous flagstone lane, below the wall and above the foreground foliage.
    if (x >= .09 && x <= .89 && y >= .727 && y <= .805) walkVillage({ x, y });
  });
  addEventListener("resize", resize);
  function installSceneDeveloperTools() {
    const query = new URLSearchParams(location.search);
    const local = location.protocol === "file:" ||
      ["localhost", "127.0.0.1", "[::1]"].includes(location.hostname);
    if (!local && query.get("dev") !== "1") return;

    const dev = document.createElement("aside");
    dev.className = "scene-dev";
    dev.hidden = true;
    dev.innerHTML = `<strong>開發跳轉</strong>
      <label>場景 <select data-dev="scene"></select></label>
      <label>步驟 <select data-dev="step"></select></label>
      <label>已採茶葉 <input data-dev="leaves" type="number" min="0" max="18" value="0"></label>
      <label>紀念幣 <input data-dev="coins" type="number" min="0" max="1" value="0"></label>
      <label>語言 <select data-dev="lang"><option>zh-Hant</option><option>en</option></select></label>
      <button type="button" data-dev="jump">跳過去</button>
      <button type="button" data-dev="reset">重設全部</button>`;
    document.body.append(dev);
    const field = name => dev.querySelector(`[data-dev="${name}"]`);
    const scene = field("scene"), step = field("step");
    for (const name of Object.keys(devScenes)) scene.add(new Option(name, name));

    function showSteps() {
      step.replaceChildren();
      for (const [id, config] of Object.entries(devScenes[scene.value])) step.add(new Option(config.label, id));
    }
    function showDefaults() {
      const config = devScenes[scene.value][step.value];
      field("leaves").value = config.leaves;
      field("coins").value = config.coins ?? 0;
    }
    scene.addEventListener("change", () => { showSteps(); showDefaults(); });
    step.addEventListener("change", showDefaults);
    showSteps();
    showDefaults();

    let jumping = false;
    async function jump(sceneName, stepName, useControls = false) {
      const config = Object.hasOwn(devScenes, sceneName) && Object.hasOwn(devScenes[sceneName], stepName)
        ? devScenes[sceneName][stepName] : null;
      if (!config || jumping) return;
      jumping = true;
      try {
        activeTween = undefined;
        document.body.append(dev);
        for (const dialog of [harvest, teaBench, coinAward]) {
          if (!dialog.open) continue;
          await new Promise(resolve => {
            dialog.addEventListener("close", resolve, { once: true });
            dialog.close();
          });
        }
        clearTimeout(teaTimer);
        busy = false;
        effect = undefined;
        replay = undefined;
        const bounded = (name, min, max) => Math.min(max, Math.max(min,
          useControls ? Math.trunc(Number(field(name).value)) || 0 : 0));
        const count = bounded("leaves", config.leaves, crops.length * shoots.length);
        choices = bounded("coins", config.coins ?? 0, 1) ? [0] : [];
        Object.assign(tea, { phase: config.phase ?? "leaves",
          readyAt: config.phase === "steep" ? Date.now() + 6500 : 0 });
        intro();
        crops.forEach((crop, index) => {
          const names = shoots.slice(0, Math.max(0, count - index * shoots.length))
            .map(shoot => shoot.dataset.object);
          crop.shoots = new Set(names);
          crop.done = names.length === shoots.length;
        });
        updateBooks();
        if (sceneName === "tea-garden") {
          openGarden();
          if (stepName === "pick") {
            const crop = crops.find(plant => !plant.done);
            if (crop) openHarvest(crop);
          }
          if (stepName === "return") showGardenPanel("春茶採好了。回去找阿嬤吧。");
        } else if (sceneName === "tea-room") {
          returnHome();
          openTea();
        } else if (sceneName === "chapter-end") {
          if (stepName === "story") showStoryBook();
          else if (stepName === "coins") showCoinBook();
          else {
            stage = "complete";
            showEnding();
            if (stepName === "award") coinAward.showModal();
          }
        }
        scene.value = sceneName;
        showSteps();
        step.value = stepName;
        field("leaves").value = count;
        field("coins").value = choices.length;
      } finally {
        jumping = false;
      }
    }
    field("jump").addEventListener("click", () => { dev.hidden = true; void jump(scene.value, step.value, true); });
    field("reset").addEventListener("click", () => {
      field("lang").value = "zh-Hant";
      field("lang").dispatchEvent(new Event("change"));
      void jump("village", "intro");
    });
    field("lang").addEventListener("change", event => {
      const english = event.target.value === "en";
      dev.lang = event.target.value;
      dev.querySelector("strong").textContent = english ? "Scene debugger" : "開發跳轉";
      field("jump").textContent = english ? "Jump" : "跳過去";
      field("reset").textContent = english ? "Reset" : "重設全部";
    });
    document.addEventListener("keydown", event => {
      if (event.shiftKey && event.code === "KeyD" && !event.repeat) {
        event.preventDefault();
        const opening = dev.hidden;
        if (opening) (document.querySelector("dialog[open]") ?? document.body).append(dev);
        dev.hidden = !opening;
      }
    });
    if (query.has("scene") && query.has("step")) void jump(query.get("scene"), query.get("step"));
  }

  resize();
  status.textContent = "";
  status.closest("main").classList.remove("loading");
  resumeGame();
  installSceneDeveloperTools();
  setPaused(paused);
}
