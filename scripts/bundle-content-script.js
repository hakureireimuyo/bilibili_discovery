import { build } from 'esbuild';
import { join } from 'node:path';
import { mkdirSync, existsSync } from 'node:fs';

const root = process.cwd();
const srcRoot = join(root, 'src');
const distRoot = join(root, 'dist', 'extension', 'content');

async function bundleContentScript() {
  // 确保输出目录存在
  if (!existsSync(distRoot)) {
    mkdirSync(distRoot, { recursive: true });
  }

  console.log('Bundling content script...');

  try {
    await build({
      entryPoints: [join(srcRoot, 'content', 'index.ts')],
      bundle: true,
      outfile: join(distRoot, 'index.js'),
      format: 'iife',
      target: 'es2020',
      sourcemap: false,
      minify: false,
      external: [],
      platform: 'browser',
      treeShaking: true,
    });

    console.log('Content script bundled successfully!');
  } catch (error) {
    console.error('Error bundling content script:', error);
    process.exit(1);
  }
}

bundleContentScript();
