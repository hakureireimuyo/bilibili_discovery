import { cpSync, existsSync, mkdirSync, readFileSync, readdirSync, rmSync, statSync, unlinkSync, writeFileSync } from "node:fs";
import { join, resolve } from "node:path";

const root = process.cwd();
const srcRoot = resolve(root, "src");
const compiledRoot = resolve(root, "dist", "src");
const extensionRoot = resolve(root, "dist", "extension");

function resetExtensionDir() {
  rmSync(extensionRoot, { recursive: true, force: true });
  mkdirSync(extensionRoot, { recursive: true });
}

function resetCompiledArtifacts() {
  const staleCompiledDirs = [
    join(compiledRoot, "ui", "theme-switcher"),
    join(compiledRoot, "utils", "theme"),
    join(compiledRoot, "utils", "themeManager.js")
  ];

  for (const target of staleCompiledDirs) {
    rmSync(target, { recursive: true, force: true });
  }
}

function copyStaticAssets() {
  cpSync(join(srcRoot, "ui"), join(extensionRoot, "ui"), { recursive: true });
  cpSync(join(srcRoot, "icons"), join(extensionRoot, "icons"), { recursive: true });
}

function copyCompiledCode() {
  const runtimeDirs = ["api", "background", "content", "database", "engine", "ui", "utils", "themes", "renderer"];
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
    join(extensionRoot, "ui", "test-tools", "test-tools.html"),
    join(extensionRoot, "ui", "theme-settings", "theme-settings.html"),
    join(extensionRoot, "ui", "theme-example", "theme-example.html")
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

function removeDeprecatedRuntimeArtifacts() {
  const deprecatedTargets = [
    join(extensionRoot, "ui", "theme-switcher"),
    join(extensionRoot, "utils", "theme"),
    join(extensionRoot, "utils", "themeManager.js")
  ];

  for (const target of deprecatedTargets) {
    if (existsSync(target)) {
      rmSync(target, { recursive: true, force: true });
    }
  }
}

function patchJsModuleSpecifiers(dir) {
  for (const entry of readdirSync(dir)) {
    const fullPath = join(dir, entry);
    const stat = statSync(fullPath);

    if (stat.isDirectory()) {
      patchJsModuleSpecifiers(fullPath);
      continue;
    }

    if (!fullPath.endsWith(".js")) {
      continue;
    }

    const content = readFileSync(fullPath, "utf-8");
    const next = content
      .replace(/(import\s+[^'"]*from\s+["'])(\.{1,2}\/[^"'?]+?)(["'])/g, (match, prefix, specifier, suffix) => {
        return /\.[a-z]+$/i.test(specifier) ? match : `${prefix}${specifier}.js${suffix}`;
      })
      .replace(/(export\s+\*\s+from\s+["'])(\.{1,2}\/[^"'?]+?)(["'])/g, (match, prefix, specifier, suffix) => {
        return /\.[a-z]+$/i.test(specifier) ? match : `${prefix}${specifier}.js${suffix}`;
      })
      .replace(/(export\s+\{[^}]+\}\s+from\s+["'])(\.{1,2}\/[^"'?]+?)(["'])/g, (match, prefix, specifier, suffix) => {
        return /\.[a-z]+$/i.test(specifier) ? match : `${prefix}${specifier}.js${suffix}`;
      });

    if (next !== content) {
      writeFileSync(fullPath, next);
    }
  }
}

resetExtensionDir();
resetCompiledArtifacts();
copyStaticAssets();
copyCompiledCode();
buildManifest();
patchHtmlEntryScripts();
removeDeprecatedRuntimeArtifacts();
removeTypeScriptArtifacts(extensionRoot);
patchJsModuleSpecifiers(extensionRoot);
