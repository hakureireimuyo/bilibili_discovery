
import { readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";

const root = process.cwd();
const envSrcPath = join(root, "src", "env.ts");

// 从环境变量获取构建模式
const NODE_ENV = process.env.NODE_ENV || "development";

// 根据NODE_ENV确定日志级别
let LOG_LEVEL;
if (NODE_ENV === "production") {
  LOG_LEVEL = "none"; // 生产环境不输出日志
} else {
  LOG_LEVEL = "debug"; // 开发环境输出所有日志
}

// 读取env.ts模板
let envContent = readFileSync(envSrcPath, "utf-8");

// 替换占位符
envContent = envContent
  .replace(/'__LOG_LEVEL__'/g, `'${LOG_LEVEL}'`)
  .replace(/__IS_DEV__/g, NODE_ENV === "development" ? "true" : "false")
  .replace(/__IS_PROD__/g, NODE_ENV === "production" ? "true" : "false");

// 写回文件
writeFileSync(envSrcPath, envContent, "utf-8");

console.log(`[Prebuild] Environment set to: ${NODE_ENV}`);
console.log(`[Prebuild] LOG_LEVEL: ${LOG_LEVEL}`);
