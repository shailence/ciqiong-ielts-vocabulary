import fs from "node:fs";
import path from "node:path";
import { pathToFileURL } from "node:url";

const modulePath = process.env.TESSERACT_MODULE ?? "/private/tmp/ocrdeps/node_modules/tesseract.js/src/index.js";
const languagePath = process.env.TESSERACT_LANG_PATH ?? "/private/tmp/ocrdeps/lang";
const imagesDirectory = process.argv[2];
const outputDirectory = process.argv[3];
const concurrency = Number(process.argv[4] ?? 5);
if (!imagesDirectory || !outputDirectory) {
  throw new Error("usage: node ocr-book-tesseract.mjs IMAGE_DIR OUTPUT_DIR [CONCURRENCY]");
}

const { createScheduler, createWorker } = await import(pathToFileURL(modulePath));
fs.mkdirSync(outputDirectory, { recursive: true });
const scheduler = createScheduler();
for (let index = 0; index < concurrency; index += 1) {
  const worker = await createWorker(["eng", "chi_sim"], 1, { langPath: languagePath });
  await worker.setParameters({ preserve_interword_spaces: "1" });
  scheduler.addWorker(worker);
}

const files = fs.readdirSync(imagesDirectory)
  .filter((name) => /^page-\d+\.jpg$/.test(name))
  .sort((a, b) => Number(a.match(/\d+/)[0]) - Number(b.match(/\d+/)[0]));
let completed = 0;
await Promise.all(files.map(async (file) => {
  const page = Number(file.match(/\d+/)[0]);
  const destination = path.join(outputDirectory, `page-${String(page).padStart(3, "0")}.json`);
  if (fs.existsSync(destination) && fs.statSync(destination).size > 100) {
    completed += 1;
    return;
  }
  const result = await scheduler.addJob(
    "recognize",
    path.join(imagesDirectory, file),
    {},
    { text: true, blocks: true },
  );
  fs.writeFileSync(destination, JSON.stringify({ page, text: result.data.text, blocks: result.data.blocks }));
  completed += 1;
  if (completed % 10 === 0 || completed === files.length) console.log(`${completed}/${files.length}`);
}));
await scheduler.terminate();
