import { cpSync, mkdirSync, readFileSync, readdirSync, rmSync, statSync, unlinkSync, writeFileSync } from "node:fs";
import { join, resolve } from "node:path";

const root = process.cwd();
const srcRoot = resolve(root, "src");
const compiledRoot = resolve(root, "dist", "src");
const extensionRoot = resolve(root, "dist", "extension");

function resetExtensionDir() {
  rmSync(extensionRoot, { recursive: true, force: true });
  mkdirSync(extensionRoot, { recursive: true });
}

function copyStaticAssets() {
  cpSync(join(srcRoot, "ui"), join(extensionRoot, "ui"), { recursive: true });
  cpSync(join(srcRoot, "icons"), join(extensionRoot, "icons"), { recursive: true });
}

function copyCompiledCode() {
  const runtimeDirs = ["api", "background", "content", "database", "engine", "ui", "utls", "renderer"];
  for (const dir of runtimeDirs) {
    cpSync(join(compiledRoot, dir), join(extensionRoot, dir), { recursive: true });
  }
}

function buildManifest() {
  const manifestPath = join(srcRoot, "manifest.tson");
  const manifestJson = JSON.parse(readFileSync(manifestPath, "utf-8"));

  manifestJson.background.service_worker = "background/service-worker.js";
  manifestJson.content_scripts = manifestJson.content_scripts.map((script) => ({
    ...script,
    js: script.js.map((item) => item.replace(/\.ts$/, ".js"))
  }));

  writeFileSync(join(extensionRoot, "manifest.json"), JSON.stringify(manifestJson, null, 2));
}

function patchHtmlEntryScripts() {
  const htmlFiles = [
    join(extensionRoot, "ui", "popup", "popup.html"),
    join(extensionRoot, "ui", "options", "options.html"),
    join(extensionRoot, "ui", "stats", "stats.html"),
    // join(extensionRoot, "ui", "watch-stats", "watch-stats.html"),
    join(extensionRoot, "ui", "test-tools", "test-tools.html")
  ];

  for (const file of htmlFiles) {
    const next = readFileSync(file, "utf-8").replace(/\.ts"/g, ".js\"");
    writeFileSync(file, next);
  }
}

function removeTypeScriptArtifacts(dir) {
  for (const entry of readdirSync(dir)) {
    const fullPath = join(dir, entry);
    const stat = statSync(fullPath);
    if (stat.isDirectory()) {
      removeTypeScriptArtifacts(fullPath);
      continue;
    }
    if (fullPath.endsWith(".ts")) {
      unlinkSync(fullPath);
    }
  }
}

resetExtensionDir();
copyStaticAssets();
copyCompiledCode();
buildManifest();
patchHtmlEntryScripts();
removeTypeScriptArtifacts(extensionRoot);
