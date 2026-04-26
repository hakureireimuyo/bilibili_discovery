import { build } from "esbuild";
import { join } from "node:path";

const root = process.cwd();

async function bundleWorkbenchAnimations() {
  const entry = join(root, "src", "ui", "workbench", "animations", "index.ts");
  const outfile = join(root, "dist", "extension", "ui", "workbench", "animations", "index.js");

  console.log("Bundling workbench animations with tsParticles...");

  try {
    await build({
      entryPoints: [entry],
      bundle: true,
      outfile,
      format: "esm",
      target: "es2020",
      platform: "browser",
      treeShaking: true,
      minify: false,
      sourcemap: false,
    });

    const { statSync } = await import("node:fs");
    const size = statSync(outfile).size;
    console.log(`  → ${outfile} (${(size / 1024).toFixed(1)} KB)`);
  } catch (error) {
    console.error("Error bundling workbench animations:", error);
    process.exit(1);
  }
}

bundleWorkbenchAnimations();
