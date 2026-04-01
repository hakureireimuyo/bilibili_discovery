import { cpSync, existsSync, mkdirSync, readFileSync, readdirSync, rmSync, statSync, unlinkSync, writeFileSync } from "node:fs";
import { join, resolve } from "node:path";

const root = process.cwd();
const srcRoot = resolve(root, "src");
const compiledRoot = resolve(root, "dist", "extension");
const extensionRoot = resolve(root, "dist", "extension");

function resetExtensionDir() {
  // 只删除manifest.json，保留TypeScript编译的文件
  if (existsSync(join(extensionRoot, "manifest.json"))) {
    unlinkSync(join(extensionRoot, "manifest.json"));
  }
  // 不再删除整个 ui 目录，避免删除 TypeScript 编译生成的 .js 文件
  // 只删除 icons 目录，因为它会重新复制
  if (existsSync(join(extensionRoot, "icons"))) {
    rmSync(join(extensionRoot, "icons"), { recursive: true, force: true });
  }
  // 确保extensionRoot存在
  if (!existsSync(extensionRoot)) {
    mkdirSync(extensionRoot, { recursive: true });
  }
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
  // 复制 icons 目录
  cpSync(join(srcRoot, "icons"), join(extensionRoot, "icons"), { recursive: true });

  // 复制 _locales 目录
  cpSync(join(srcRoot, "_locales"), join(extensionRoot, "_locales"), { recursive: true });

  // 只复制 ui 目录中的 HTML 和 CSS 文件，不复制 .ts 文件
  const uiSrcDir = join(srcRoot, "ui");
  const uiDestDir = join(extensionRoot, "ui");

  function copyHtmlAndCssFiles(srcDir, destDir) {
    if (!existsSync(destDir)) {
      mkdirSync(destDir, { recursive: true });
    }

    const entries = readdirSync(srcDir);
    for (const entry of entries) {
      const srcPath = join(srcDir, entry);
      const destPath = join(destDir, entry);
      const stat = statSync(srcPath);

      if (stat.isDirectory()) {
        copyHtmlAndCssFiles(srcPath, destPath);
      } else if (entry.endsWith('.html') || entry.endsWith('.css')) {
        // 只复制 HTML 和 CSS 文件
        cpSync(srcPath, destPath);
      }
    }
  }

  copyHtmlAndCssFiles(uiSrcDir, uiDestDir);
}

function copyCompiledCode() {
  const runtimeDirs = ["api", "background", "content", "database", "engine", "ui", "utils", "themes", "renderer"];
  for (const dir of runtimeDirs) {
    const srcDir = join(compiledRoot, dir);
    const destDir = join(extensionRoot, dir);

    // 只复制存在的目录
    if (existsSync(srcDir)) {
      cpSync(srcDir, destDir, { recursive: true });
    }
  }
}

function buildManifest() {
  const manifestPath = join(srcRoot, "manifest.tson");
  const packageJsonPath = join(root, "package.json");
  
  const manifestJson = JSON.parse(readFileSync(manifestPath, "utf-8"));
  const packageJson = JSON.parse(readFileSync(packageJsonPath, "utf-8"));

  // Sync version from package.json to manifest.json
  manifestJson.version = packageJson.version;
  console.log(`Syncing version: ${packageJson.version}`);

  manifestJson.background = {
    service_worker: "background/service-worker.js",
    type: "module"
  };
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
    join(extensionRoot, "ui", "favorites", "favorites.html"),
    join(extensionRoot, "ui", "stats", "stats.html"),
    join(extensionRoot, "ui", "database-stats", "database-stats.html"),
    join(extensionRoot, "ui", "watch-stats", "watch-stats.html"),
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
      // 跳过 ui 目录，避免删除编译后的 .js 文件
      if (entry !== 'ui') {
        removeTypeScriptArtifacts(fullPath);
      }
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
// copyCompiledCode(); // 不需要复制，TypeScript编译器已经直接输出到dist/extension
buildManifest();
patchHtmlEntryScripts();
removeDeprecatedRuntimeArtifacts();
removeTypeScriptArtifacts(extensionRoot);
patchJsModuleSpecifiers(extensionRoot);
