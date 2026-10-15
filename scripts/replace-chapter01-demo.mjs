import { readFile, writeFile } from "node:fs/promises";

const path = "public/data/vocab-expansions.demo.v1.json";
const data = JSON.parse(await readFile(path, "utf8"));
const meta = { contentAuthor: "词穹编辑示范", linguisticSources: ["原始词库词义", "standard geographical and scientific usage"], reviewStatus: "draft", updatedAt: "2026-10-15" };
const make = (wordId, partOfSpeech, mnemonic, relations, collocations, text, translationZh, target) => ({
  wordId, chapterId: "01", chapterTitle: "自然地理", listId: 1, partOfSpeech,
  mnemonic, relatedWords: relations.map(({label})=>label), collocations,
  exampleEnglish: text, exampleChinese: translationZh,
  exampleSource: "原创雅思风格例句；非剑桥雅思真题原文", contentStatus: "draft",
  memoryAid: { kind: "linguistic-or-semantic", noteZh: mnemonic }, relations,
  example: { text, translationZh, target, sourceType: "original-ielts-style", copyrightStatus: "Original for 词穹; not copied from an IELTS test." },
  provenance: meta,
});
const rel=(label,type,targetWordId,isExtension=false)=>({label,type,...(targetWordId?{targetWordId}:{}),isExtension});
const col=(text,translationZh)=>({text,translationZh});

const chapter01 = [
  make("l1-1",["noun"],"源自希腊语 atmos（蒸气）与 sphaira（球体）。可联想为环绕地球的气体层；这是可靠词源，不是牵强拆词。",[rel("hydrosphere","same-theme","l1-2"),rel("oxygen","semantic","l1-4"),rel("carbon dioxide","semantic","l1-6"),rel("climate","semantic","l2-46")],[col("the Earth's atmosphere","地球大气层"),col("a friendly atmosphere","友好的氛围")],"The Earth's atmosphere regulates temperature and protects living organisms from harmful radiation.","地球大气层调节温度，并保护生物免受有害辐射。","atmosphere"),
  make("l1-2",["noun"],"hydro- 表示“水”，sphere 表示“球体或圈层”；hydrosphere 指地球上全部水体构成的水圈。",[rel("atmosphere","same-theme","l1-1"),rel("ocean","hyponym","l2-20"),rel("water cycle","semantic",null,true),rel("biosphere","same-theme",null,true)],[col("the Earth's hydrosphere","地球水圈"),col("hydrosphere system","水圈系统")],"Pollution in one river can eventually affect other parts of the hydrosphere.","一条河流中的污染最终可能影响水圈的其他部分。","hydrosphere"),
  make("l1-3",["noun"],"litho- 源自希腊语 lithos（石头），sphere 表示圈层；联想地球坚硬的岩石外层。",[rel("crust","semantic","l1-9"),rel("mantle","semantic","l1-10"),rel("plate","semantic","l4-1"),rel("mineral","semantic","l1-28")],[col("continental lithosphere","大陆岩石圈"),col("lithospheric plate","岩石圈板块")],"The lithosphere is divided into plates that move slowly over geological time.","岩石圈被分成多个板块，它们在地质时间尺度上缓慢移动。","lithosphere"),
  make("l1-4",["noun"],"用词族 oxygen—oxide—oxidation 串联记忆。oxygen 的历史构词意为“成酸者”，源于早期化学理论，并不表示所有酸都含氧。",[rel("oxide","word-family","l1-5"),rel("atmosphere","same-theme","l1-1"),rel("hydrogen","semantic","l1-7"),rel("oxidation","word-family",null,true)],[col("oxygen level","氧气水平"),col("dissolved oxygen","溶解氧")],"A decline in dissolved oxygen can threaten fish and other aquatic organisms.","溶解氧下降会威胁鱼类及其他水生生物。","oxygen"),
  make("l1-5",["noun"],"oxide 是氧与另一种元素形成的化合物；与 oxygen、oxidise、oxidation 作为词族记忆。",[rel("oxygen","word-family","l1-4"),rel("mineral","semantic","l1-28"),rel("carbon dioxide","hyponym","l1-6"),rel("oxidation","word-family",null,true)],[col("metal oxide","金属氧化物"),col("nitrogen oxide","氮氧化物")],"Some metal oxides in industrial emissions contribute to serious air pollution.","工业排放中的一些金属氧化物会造成严重的空气污染。","oxides"),
  make("l1-6",["noun"],"di- 表示“二”：一个碳原子与两个氧原子组成 carbon dioxide（CO₂）。用构成关系记忆，不做伪词源拆解。",[rel("oxygen","semantic","l1-4"),rel("greenhouse","semantic","l1-23"),rel("atmosphere","same-theme","l1-1"),rel("emission","semantic","l31-27")],[col("carbon dioxide emissions","二氧化碳排放"),col("atmospheric carbon dioxide","大气中的二氧化碳")],"Reducing carbon dioxide emissions is central to limiting long-term climate change.","减少二氧化碳排放是限制长期气候变化的核心。","carbon dioxide"),
  make("l1-7",["noun"],"hydro- 表示“水”，-gen 表示“产生者”；hydrogen 这一名称有“生成水的元素”之意。",[rel("oxygen","semantic","l1-4"),rel("hydrosphere","same-theme","l1-2"),rel("fuel","semantic","l27-53"),rel("water","semantic",null,true)],[col("hydrogen fuel","氢燃料"),col("green hydrogen","绿氢")],"Green hydrogen may help decarbonise industries that cannot easily rely on electricity alone.","绿氢可能帮助那些难以仅依靠电力的行业实现脱碳。","hydrogen"),
  make("l1-8",["noun"],"用“地壳 crust—地幔 mantle—地核 core”的由外到内顺序记忆；core 也可表示事物最核心的部分。",[rel("crust","same-theme","l1-9"),rel("mantle","same-theme","l1-10"),rel("inner core","hyponym",null,true),rel("outer core","hyponym",null,true)],[col("the Earth's core","地核"),col("core temperature","核心温度")],"Movement in the Earth's outer core helps generate the planet's magnetic field.","地球外核中的运动有助于产生地球磁场。","core"),
  make("l1-9",["noun"],"crust 日常指面包或派的硬外皮；地理中指地球最外层的“硬壳”，用共同的外层意象记忆。",[rel("lithosphere","semantic","l1-3"),rel("mantle","same-theme","l1-10"),rel("core","same-theme","l1-8"),rel("plate","semantic","l4-1")],[col("continental crust","大陆地壳"),col("oceanic crust","海洋地壳")],"Oceanic crust is generally thinner and denser than continental crust.","海洋地壳通常比大陆地壳更薄、密度更高。","crust"),
  make("l1-10",["noun"],"mantle 原指覆盖肩部的斗篷；地球的 mantle 像厚重覆盖层包围地核，位于地壳之下。",[rel("crust","same-theme","l1-9"),rel("core","same-theme","l1-8"),rel("magma","semantic","l1-41"),rel("lithosphere","semantic","l1-3")],[col("the Earth's mantle","地幔"),col("upper mantle","上地幔")],"Heat from the mantle drives processes that gradually reshape the Earth's surface.","来自地幔的热量驱动着逐渐重塑地球表面的过程。","mantle"),
];

const old = new Set(data.demoGroups[0].wordIds);
data.demoGroups[0].wordIds = chapter01.map(({wordId})=>wordId);
data.entries = [...chapter01, ...data.entries.filter(({wordId})=>!old.has(wordId))].map((entry) => ({
  chapterId: String(entry.chapterId || data.demoGroups.find(group=>group.wordIds.includes(entry.wordId))?.chapter || "").padStart(2,"0"),
  chapterTitle: entry.chapterTitle || data.demoGroups.find(group=>group.wordIds.includes(entry.wordId))?.themeZh,
  listId: entry.listId || Number(entry.wordId.match(/^l(\d+)-/)?.[1]),
  mnemonic: entry.mnemonic || entry.memoryAid?.noteZh,
  relatedWords: entry.relatedWords || entry.relations?.map(({label})=>label),
  exampleEnglish: entry.exampleEnglish || entry.example?.text,
  exampleChinese: entry.exampleChinese || entry.example?.translationZh,
  exampleSource: entry.exampleSource || "原创雅思风格例句；非剑桥雅思真题原文",
  contentStatus: entry.contentStatus || entry.provenance?.reviewStatus,
  ...entry,
}));
await writeFile(path, `${JSON.stringify(data, null, 2)}\n`);
