/**
 * 数据库测试运行脚本
 * 用于在非浏览器环境中运行数据库测试
 */

import { readdirSync, statSync } from "node:fs";
import { join, resolve } from "node:path";
import { pathToFileURL } from "node:url";

function findTestFiles(dir) {
  const entries = readdirSync(dir);
  const files = [];
  for (const entry of entries) {
    const fullPath = join(dir, entry);
    const stat = statSync(fullPath);
    if (stat.isDirectory()) {
      files.push(...findTestFiles(fullPath));
    } else if (entry.endsWith(".test.js")) {
      files.push(fullPath);
    }
  }
  return files;
}

const root = resolve(process.cwd(), "dist", "extension", "database", "tests");
const runnerPath = join(root, "test-runner.js");
const runnerModule = await import(pathToFileURL(runnerPath).href);
const testFiles = findTestFiles(root);

if (testFiles.length === 0) {
  console.log("[Test] No database test files found.");
  process.exit(0);
}

console.log(`[Test] Found ${testFiles.length} database test file(s)`);

for (const file of testFiles) {
  console.log(`[Test] Running ${file}`);
  await import(pathToFileURL(file).href);
}

await runnerModule.runTests();
