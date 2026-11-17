export const devScenes = {
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
} as const;
