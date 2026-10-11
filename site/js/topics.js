/** Built-in speaking scenarios. Daily pick uses the Asia/Taipei calendar date. */

export const TOPICS = [
  {
    id: "restaurant",
    titleZh: "在餐廳點餐",
    titleEn: "Ordering at a restaurant",
    scenarioZh: "你在一家忙碌的餐廳。向服務生點主餐、詢問過敏原，並請對方推薦一道菜。",
    scenarioEn:
      "You are at a busy restaurant. Order a main dish, ask about allergens, and ask the server for a recommendation.",
    phrases: [
      { en: "Could I see the menu, please?", zh: "請給我看一下菜單好嗎？" },
      { en: "Does this dish contain nuts?", zh: "這道菜含有堅果嗎？" },
      { en: "What would you recommend?", zh: "你會推薦什麼？" },
    ],
  },
  {
    id: "farm-tour",
    titleZh: "帶客人參觀農場",
    titleEn: "Giving a farm tour",
    scenarioZh: "海外訪客來到位在台灣的農場。你帶路、介紹作物，並回答關於採收季節的問題。",
    scenarioEn:
      "An overseas visitor is touring a farm in Taiwan. Show them around, describe the crops, and answer a question about the harvest season.",
    phrases: [
      { en: "Let me show you the fields.", zh: "我帶你去看看田裡。" },
      { en: "We harvest this crop in early summer.", zh: "這項作物在初夏採收。" },
      { en: "Please watch your step on the path.", zh: "走這條路請小心腳下。" },
    ],
  },
  {
    id: "overseas-client",
    titleZh: "跟海外客戶見面",
    titleEn: "Meeting an overseas client",
    scenarioZh: "你第一次跟海外客戶當面開會。打招呼、簡單介紹公司，並約下一步。",
    scenarioEn:
      "You are meeting an overseas client in person for the first time. Greet them, give a short introduction to your company, and agree on a next step.",
    phrases: [
      { en: "It's a pleasure to meet you in person.", zh: "很高興能當面見到你。" },
      { en: "Let me give you a brief overview.", zh: "我先做個簡短說明。" },
      { en: "Shall we schedule a follow-up next week?", zh: "我們約下週再談一次好嗎？" },
    ],
  },
  {
    id: "microbial-fertilizer",
    titleZh: "介紹微生物肥料",
    titleEn: "Talking about a microbial fertilizer",
    scenarioZh: "買主在農場詢問你們的微生物肥料。說明它如何幫助土壤、怎麼施用，以及適合哪些作物。",
    scenarioEn:
      "A buyer at the farm asks about your microbial fertilizer. Explain how it helps the soil, how to apply it, and which crops it suits.",
    phrases: [
      { en: "This microbial fertilizer improves soil health.", zh: "這款微生物肥料有助於土壤健康。" },
      { en: "We apply it at the root zone before planting.", zh: "種植前施在根系周圍。" },
      { en: "It helps the crop take up nutrients more efficiently.", zh: "它讓作物更有效吸收養分。" },
    ],
  },
  {
    id: "travel",
    titleZh: "旅行與問路",
    titleEn: "Travel and asking for directions",
    scenarioZh: "你在國外城市迷路了。向路人問去車站的路，並確認要不要轉車。",
    scenarioEn:
      "You are lost in a city abroad. Ask a passerby how to get to the station and whether you need to transfer.",
    phrases: [
      { en: "Excuse me, how do I get to the station?", zh: "不好意思，車站怎麼走？" },
      { en: "Is it within walking distance?", zh: "走路到得了嗎？" },
      { en: "Do I need to change trains?", zh: "我需要轉車嗎？" },
    ],
  },
  {
    id: "small-talk",
    titleZh: "初次見面的閒聊",
    titleEn: "Small talk with someone new",
    scenarioZh: "你在活動上認識新朋友。聊天氣、週末，以及對方從哪裡來，保持輕鬆。",
    scenarioEn:
      "You meet someone new at an event. Chat about the weather, the weekend, and where they are from. Keep it light.",
    phrases: [
      { en: "How has your week been?", zh: "你這週過得怎麼樣？" },
      { en: "Have you been to Taiwan before?", zh: "你以前來過台灣嗎？" },
      { en: "The weather is really nice today.", zh: "今天天氣真好。" },
    ],
  },
  {
    id: "job-interview",
    titleZh: "英文面試",
    titleEn: "A job interview",
    scenarioZh: "你正在面試一份需要英語的工作。介紹經歷、說明一個優點，並問面試官一個問題。",
    scenarioEn:
      "You are interviewing for a job that uses English. Introduce your experience, describe one strength, and ask the interviewer a question.",
    phrases: [
      { en: "Thank you for having me today.", zh: "謝謝今天給我這個機會。" },
      { en: "In my last role, I worked with growers.", zh: "上一份工作我跟農友合作。" },
      { en: "Could you tell me more about the team?", zh: "可以多說一點團隊的情況嗎？" },
    ],
  },
  {
    id: "market",
    titleZh: "在市場買菜",
    titleEn: "Shopping at a market",
    scenarioZh: "你在傳統市場用英語跟攤販買水果。詢問價格、新鮮度，並請對方少算一點。",
    scenarioEn:
      "You are buying fruit at a market stall in English. Ask about the price and freshness, and try a polite request for a better price.",
    phrases: [
      { en: "How much are these mangoes?", zh: "這些芒果怎麼賣？" },
      { en: "Are they ripe enough to eat today?", zh: "今天吃的話熟了嗎？" },
      { en: "Could you give me a small discount?", zh: "可以算便宜一點嗎？" },
    ],
  },
  {
    id: "weather-crops",
    titleZh: "聊天氣跟作物",
    titleEn: "Weather and the crops",
    scenarioZh: "跟同行聊最近的雨勢對作物的影響，以及你們準備怎麼應對。",
    scenarioEn:
      "Talk with a colleague about recent rain, how it is affecting the crops, and what you plan to do about it.",
    phrases: [
      { en: "We've had a lot of rain this week.", zh: "這週雨下得很多。" },
      { en: "The leaves are starting to yellow.", zh: "葉子開始發黃了。" },
      { en: "We may need to delay the harvest.", zh: "我們可能得把採收延後。" },
    ],
  },
  {
    id: "hotel",
    titleZh: "飯店入住",
    titleEn: "Checking into a hotel",
    scenarioZh: "你抵達飯店。辦理入住、確認早餐時間，並請對方換一間比較安靜的房間。",
    scenarioEn:
      "You arrive at a hotel. Check in, confirm breakfast hours, and ask for a quieter room.",
    phrases: [
      { en: "I have a reservation under this name.", zh: "我用這個名字訂了房。" },
      { en: "What time is breakfast served?", zh: "早餐幾點開始？" },
      { en: "Could I have a quieter room, if possible?", zh: "如果可以的話，能換一間安靜一點的嗎？" },
    ],
  },
  {
    id: "phone",
    titleZh: "用電話預約",
    titleEn: "Making an appointment by phone",
    scenarioZh: "你打電話到診所預約。說明想看的時段，並留下聯絡方式。",
    scenarioEn:
      "You are calling a clinic to make an appointment. Say which time you prefer and leave a contact number.",
    phrases: [
      { en: "I'd like to make an appointment.", zh: "我想預約。" },
      { en: "Is Thursday afternoon available?", zh: "星期四下午有空嗎？" },
      { en: "The best number to reach me is…", zh: "最好用這個電話聯絡我…" },
    ],
  },
  {
    id: "hometown",
    titleZh: "介紹自己的家鄉",
    titleEn: "Describing your hometown",
    scenarioZh: "朋友問你的家鄉。描述地方、食物，以及你最想帶訪客去的一個地方。",
    scenarioEn:
      "A friend asks about your hometown. Describe the place, a local food, and one spot you would show a visitor.",
    phrases: [
      { en: "I grew up in a small town.", zh: "我在一個小鎮長大。" },
      { en: "We're known for our night markets.", zh: "我們以夜市出名。" },
      { en: "If you visit, I'll take you to the old street.", zh: "你如果來，我帶你去老街。" },
    ],
  },
];

export function taipeiDateKey(date = new Date()) {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Taipei",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(date);
}

/** Stable FNV-1a so the same Taipei date always maps to the same topic. */
export function indexForDate(dateKey, length) {
  let h = 2166136261;
  for (let i = 0; i < dateKey.length; i += 1) {
    h ^= dateKey.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return (h >>> 0) % length;
}

export function defaultSelection(date = new Date(), topics = TOPICS) {
  const dateKey = taipeiDateKey(date);
  return {
    dateKey,
    mode: "daily",
    index: indexForDate(dateKey, topics.length),
    customText: "",
  };
}

export function loadSelection(storage, date = new Date(), topics = TOPICS) {
  const fresh = defaultSelection(date, topics);
  try {
    const saved = JSON.parse(storage.getItem("speak-app.topicState") || "null");
    if (!saved || saved.dateKey !== fresh.dateKey) return fresh;
    const index = Number.isInteger(saved.index) ? saved.index % topics.length : fresh.index;
    const mode = saved.mode === "custom" || saved.mode === "reroll" ? saved.mode : "daily";
    return {
      dateKey: fresh.dateKey,
      mode,
      index,
      customText: typeof saved.customText === "string" ? saved.customText : "",
    };
  } catch {
    return fresh;
  }
}

export function saveSelection(storage, selection) {
  storage.setItem("speak-app.topicState", JSON.stringify(selection));
}

export function rerollSelection(selection, topics = TOPICS, rng = Math.random) {
  if (topics.length < 2) return { ...selection, mode: "reroll", customText: "" };
  let index = selection.index;
  for (let attempt = 0; attempt < 8 && index === selection.index; attempt += 1) {
    index = Math.floor(rng() * topics.length);
  }
  if (index === selection.index) index = (selection.index + 1) % topics.length;
  return { ...selection, mode: "reroll", index, customText: "" };
}

export function customSelection(selection, text) {
  return { ...selection, mode: "custom", customText: text.trim() };
}

export function resolveTopic(selection, topics = TOPICS) {
  if (selection.mode === "custom" && selection.customText.trim()) {
    const text = selection.customText.trim();
    return {
      id: "custom",
      titleZh: text,
      titleEn: text,
      scenarioZh: "依照你輸入的主題，用英語把對話進行下去。",
      scenarioEn: `The learner chose this topic: ${text}. Build a practical spoken role-play around it.`,
      phrases: [
        { en: "Let me tell you a bit about this.", zh: "我先說明一下。" },
        { en: "Could you ask me a follow-up question?", zh: "可以再問我一個問題嗎？" },
        { en: "How would you say that more naturally?", zh: "這句怎樣說會更自然？" },
      ],
      custom: true,
    };
  }
  const topic = topics[((selection.index % topics.length) + topics.length) % topics.length];
  return { ...topic, custom: false };
}

export function selectionLabel(selection) {
  if (selection.mode === "custom") return "自訂主題";
  if (selection.mode === "reroll") return "已換一個主題";
  return "今日建議";
}
