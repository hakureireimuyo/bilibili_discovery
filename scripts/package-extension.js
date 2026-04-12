import { readFileSync, writeFileSync, mkdirSync, existsSync, rmSync, readdirSync, statSync, createWriteStream } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { dirname } from "node:path";
import archiver from "archiver";
import { generateKeyPairSync, createPublicKey } from "node:crypto";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const root = process.cwd();
const distExtension = join(root, "dist", "extension");
const outputDir = join(root, "dist", "packages");

// Create output directory if it doesn't exist
if (!existsSync(outputDir)) {
  mkdirSync(outputDir, { recursive: true });
}

// Generate private key if not exists
const keyFile = join(root, "key.pem");
if (!existsSync(keyFile)) {
  console.log("Generating private key...");
  const { privateKey } = generateKeyPairSync("rsa", {
    modulusLength: 2048,
    publicKeyEncoding: { type: "spki", format: "pem" },
    privateKeyEncoding: { type: "pkcs8", format: "pem" }
  });
  writeFileSync(keyFile, privateKey);
  console.log(`Private key generated: ${keyFile}`);
}

// Extract public key for manifest
const privateKeyPem = readFileSync(keyFile, "utf-8");
const publicKeyObj = createPublicKey(privateKeyPem);
const publicKeyDer = publicKeyObj.export({ type: "spki", format: "der" });
const publicKeyBase64 = publicKeyDer.toString("base64");

// Update manifest with key
const manifestPath = join(distExtension, "manifest.json");
if (existsSync(manifestPath)) {
  const manifest = JSON.parse(readFileSync(manifestPath, "utf-8"));
  manifest.key = publicKeyBase64;
  writeFileSync(manifestPath, JSON.stringify(manifest, null, 2));
  console.log("Manifest updated with public key");
}

// Read package.json to get version
const packageJsonPath = join(root, "package.json");
const packageJson = JSON.parse(readFileSync(packageJsonPath, "utf-8"));
const version = packageJson.version;

console.log(`Packaging extension version ${version}...`);

// Files and directories to exclude from the package
const EXCLUDE_PATTERNS = [
  "*.md",           // All markdown files
  ".gitkeep",       // Git placeholder files
  ".DS_Store",      // macOS system files
  "Thumbs.db"       // Windows thumbnail cache
];

// Function to recursively remove files matching patterns
function cleanDirectory(dir, patterns) {
  const items = readdirSync(dir);
  
  for (const item of items) {
    const fullPath = join(dir, item);
    const stat = statSync(fullPath);
    
    if (stat.isDirectory()) {
      // Check if directory name matches any pattern
      if (patterns.some(pattern => item === pattern || item.includes(pattern))) {
        console.log(`Removing directory: ${fullPath}`);
        rmSync(fullPath, { recursive: true, force: true });
      } else {
        // Recursively clean subdirectories
        cleanDirectory(fullPath, patterns);
      }
    } else if (stat.isFile()) {
      // Check if file name matches any pattern
      if (patterns.some(pattern => 
        item === pattern || 
        item.endsWith(pattern.replace("*", "")) ||
        pattern.startsWith("*") && item.endsWith(pattern.slice(1))
      )) {
        console.log(`Removing file: ${fullPath}`);
        rmSync(fullPath, { force: true });
      }
    }
  }
}

// Clean the extension directory before packaging
console.log("\nCleaning extension directory...");
cleanDirectory(distExtension, EXCLUDE_PATTERNS);
console.log("Cleanup complete.\n");

// Create ZIP file using archiver
const zipFile = join(outputDir, `bilibili-discovery-engine-v${version}.zip`);
console.log(`Creating ZIP package: ${zipFile}`);

// Function to check if a file should be excluded
function shouldExclude(filePath) {
  const fileName = filePath.split(/[\\/]/).pop();
  return EXCLUDE_PATTERNS.some(pattern => {
    if (pattern.startsWith("*")) {
      return fileName.endsWith(pattern.slice(1));
    }
    return fileName === pattern;
  });
}

// Function to recursively add files to archive
function addFilesToArchive(archive, dir, baseDir) {
  const items = readdirSync(dir);
  
  for (const item of items) {
    const fullPath = join(dir, item);
    const stat = statSync(fullPath);
    
    if (stat.isDirectory()) {
      addFilesToArchive(archive, fullPath, baseDir);
    } else if (stat.isFile() && !shouldExclude(fullPath)) {
      const relativePath = fullPath.replace(baseDir, "").replace(/^[\\/]/, "");
      archive.file(fullPath, { name: relativePath });
    }
  }
}

// Create output stream
const output = createWriteStream(zipFile);
const archive = archiver("zip", {
  zlib: { level: 9 } // Maximum compression
});

// Handle archive events
output.on("close", () => {
  console.log(`\n✓ ZIP file created: ${zipFile}`);
  console.log(`  Total size: ${(archive.pointer() / 1024).toFixed(2)} KB`);
});

// Archive error handling
archive.on("error", (err) => {
  console.error("\n✗ Archive error:", err.message);
  process.exit(1);
});

// Pipe archive data to the file
archive.pipe(output);

// Add all files from extension directory
addFilesToArchive(archive, distExtension, distExtension);

// Finalize the archive
archive.finalize();

console.log(`\n✓ Extension packaged successfully!`);
console.log(`  ZIP: ${zipFile}`);
console.log(`\nTo create CRX file manually:`);
console.log(`1. Go to chrome://extensions/ or edge://extensions/`);
console.log(`2. Enable "Developer mode"`);
console.log(`3. Click "Pack extension"`);
console.log(`4. Select the extension folder: ${distExtension}`);
console.log(`5. Select private key file: ${keyFile}`);
console.log(`6. The CRX file will be generated in the same directory`);
console.log(`\nTo install/update the extension:`);
console.log(`1. Drag and drop the .crx file into chrome://extensions/ or edge://extensions/`);
console.log(`2. Chrome/Edge will automatically update if the extension ID matches`);
console.log(`\nAlternative method with ZIP:`);
console.log(`1. Unzip the ZIP file`);
console.log(`2. Go to chrome://extensions/ or edge://extensions/`);
console.log(`3. Enable "Developer mode"`);
console.log(`4. Click "Load unpacked" and select the unzipped folder`);
console.log(`5. Chrome/Edge will update the extension if ID matches`);
