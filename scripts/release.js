import { readFileSync, writeFileSync, mkdirSync, existsSync } from "node:fs";
import { join } from "node:path";
import { execSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import { dirname } from "node:path";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const root = process.cwd();
const distExtension = join(root, "dist", "extension");
const outputDir = join(root, "dist", "packages");

// Create output directory if it doesn't exist
if (!existsSync(outputDir)) {
  mkdirSync(outputDir, { recursive: true });
}

// Get version from command line argument or manifest
let version;
const versionArg = process.argv[2];

if (versionArg) {
  version = versionArg;
  console.log(`\n📦 Packaging extension version ${version} (from command line argument)...`);
} else {
  // Read the manifest to get version
  const manifestPath = join(distExtension, "manifest.json");
  const manifest = JSON.parse(readFileSync(manifestPath, "utf-8"));
  version = manifest.version;
  console.log(`\n📦 Packaging extension version ${version} (from manifest.json)...`);
}

// Check if 7-Zip is available
let zipFile;
try {
  execSync("7z", { stdio: "pipe" });
  console.log("✅ Using 7-Zip for packaging...");

  // Create ZIP file
  zipFile = join(outputDir, `bili-random-up-v${version}.zip`);
  execSync(`7z a -tzip "${zipFile}" "${distExtension}\*"`, { stdio: "inherit" });

  console.log(`✅ ZIP file created: ${zipFile}`);

} catch (error) {
  console.log("⚠️  7-Zip not found, trying PowerShell Compress-Archive...");

  try {
    zipFile = join(outputDir, `bili-random-up-v${version}.zip`);
    execSync(
      `powershell -Command "Compress-Archive -Path '${distExtension}\*' -DestinationPath '${zipFile}' -Force"`,
      { stdio: "inherit" }
    );

    console.log(`✅ ZIP file created: ${zipFile}`);

  } catch (error) {
    console.error("❌ Failed to create package. Please manually zip the extension folder:");
    console.log(distExtension);
    process.exit(1);
  }
}

console.log(`\n✅ Successfully packaged version ${version}!`);
console.log(`\n📦 Package file: ${zipFile}`);
console.log(`\n🎉 You can now upload the ZIP file to GitHub Releases!`);
