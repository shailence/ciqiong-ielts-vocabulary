import { readFile, writeFile } from "node:fs/promises";

const vocab=JSON.parse(await readFile("public/vocab.json","utf8"));
const extensionData=JSON.parse(await readFile("public/data/vocab-expansions.demo.v1.json","utf8"));
const entries=new Map(extensionData.entries.map(entry=>[entry.wordId,entry]));
const fields={examples:0,translations:0,mnemonics:0,relations:0,collocations:0,complete:0};
const lists=vocab.map(list=>{
  const stats={list:list.number,total:list.words.length,complete:0,examples:0,translations:0,mnemonics:0,relations:0,collocations:0};
  for(const word of list.words){
    const entry=entries.get(word.id); if(!entry)continue;
    const checks={examples:!!(entry.exampleEnglish||entry.example?.text),translations:!!(entry.exampleChinese||entry.example?.translationZh),mnemonics:!!(entry.mnemonic||entry.memoryAid?.noteZh),relations:!!entry.relations?.length,collocations:!!entry.collocations?.length};
    for(const [field,ok] of Object.entries(checks))if(ok){fields[field]++;stats[field]++}
    if(Object.values(checks).every(Boolean)){fields.complete++;stats.complete++}
  }
  return stats;
});
const total=vocab.reduce((sum,list)=>sum+list.words.length,0);
const percentage=value=>`${(value/total*100).toFixed(2)}%`;
const report={generatedAt:new Date().toISOString(),total,...fields,coveragePercentage:percentage(fields.complete),missing:{examples:total-fields.examples,translations:total-fields.translations,mnemonics:total-fields.mnemonics,relations:total-fields.relations,collocations:total-fields.collocations},lists};
await writeFile("docs/v2/vocabulary-coverage-report.json",`${JSON.stringify(report,null,2)}\n`);
const rows=lists.map(item=>`| ${String(item.list).padStart(2,"0")} | ${item.total} | ${item.complete} | ${(item.complete/item.total*100).toFixed(1)}% |`).join("\n");
await writeFile("docs/v2/vocabulary-coverage-report.md",`# 词穹 V2.0 词汇拓展覆盖率\n\n生成时间：${report.generatedAt}\n\n> 本报告只统计已写入独立拓展数据层并通过字段检查的内容，不把原始释义计作拓展内容。\n\n- 原始词条：${total}\n- 完整拓展：${fields.complete}（${percentage(fields.complete)}）\n- 英文例句：${fields.examples}；缺失 ${report.missing.examples}\n- 中文翻译：${fields.translations}；缺失 ${report.missing.translations}\n- 联想记忆：${fields.mnemonics}；缺失 ${report.missing.mnemonics}\n- 主题关联：${fields.relations}；缺失 ${report.missing.relations}\n- 高频搭配：${fields.collocations}；缺失 ${report.missing.collocations}\n\n## 分 List 覆盖\n\n| List | 词条 | 完整拓展 | 覆盖率 |\n|---:|---:|---:|---:|\n${rows}\n\n## 质量边界\n\n当前完成的是三个主题的 30 条人工示范，其中 Chapter 01 为 List 01 前 10 个真实词条。其余词条仍须按批次生成、语言学复核、版权状态检查和人工验收；未完成前不得标记为全量覆盖。\n`);
console.log(JSON.stringify({total,complete:fields.complete,coverage:percentage(fields.complete),missing:report.missing},null,2));
