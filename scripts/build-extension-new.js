import { readFileSync, writeFileSync, mkdirSync, cpSync } from "node:fs";
import { resolve, join } from "node:path";

const root = process.cwd();
const srcExtension = resolve(root, "src");
const distExtension = resolve(root, "dist", "extension");

mkdirSync(distExtension, { recursive: true });

cpSync(join(srcExtension, "ui"), join(distExtension, "ui"), { recursive: true });

// Copy icons directory if it exists
const iconsSrc = join(srcExtension, "icons");
const iconsDist = join(distExtension, "icons");
try {
  cpSync(iconsSrc, iconsDist, { recursive: true });
} catch (err) {
  // Icons directory doesn't exist, skip
}

const manifestPath = join(srcExtension, "manifest.tson");
const manifestJson = JSON.parse(readFileSync(manifestPath, "utf-8"));

manifestJson.background.service_worker = "background/service-worker.js";
manifestJson.content_scripts = manifestJson.content_scripts.map((script) => ({
  ...script,
  js: script.js.map((item) => item.replace(/\.ts$/, ".js"))
}));

writeFileSync(join(distExtension, "manifest.json"), JSON.stringify(manifestJson, null, 2));

const popupHtmlPath = join(distExtension, "ui", "popup", "popup.html");
const optionsHtmlPath = join(distExtension, "ui", "options", "options.html");

const popupHtml = readFileSync(popupHtmlPath, "utf-8").replace(/\.ts"/g, ".js"");
writeFileSync(popupHtmlPath, popupHtml);

const optionsHtml = readFileSync(optionsHtmlPath, "utf-8").replace(/\.ts"/g, ".js"");
writeFileSync(optionsHtmlPath, optionsHtml);

// Process api-test.html
try {
  const apiTestHtmlPath = join(distExtension, "ui", "api-test", "api-test.html");
  const apiTestHtml = readFileSync(apiTestHtmlPath, "utf-8").replace(/\.ts"/g, ".js"");
  writeFileSync(apiTestHtmlPath, apiTestHtml);
} catch (err) {
  // api-test.html doesn't exist, skip
}
