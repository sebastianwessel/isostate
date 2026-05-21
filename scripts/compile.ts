#!/usr/bin/env tsx
/**
 * CLI script to compile a YAML DSL scene file into a runtime bundle.
 *
 * Usage:
 *   tsx scripts/compile.ts <input.yaml> [--output build/scene.js] [--format json] [--no-minify]
 */

import { readFileSync, writeFileSync, existsSync, mkdirSync } from 'fs';
import { dirname, resolve } from 'path';

import { parseScene, validateScene, compileScene, toJs, toJson } from '../packages/core/src/dsl/index.ts';

interface CliOptions {
  output: string;
  format: 'js' | 'json';
  minify: boolean;
}

function parseArgs(): { input: string; options: CliOptions } {
  const args = process.argv.slice(2);

  if (args.length === 0) {
    console.error('Usage: tsx scripts/compile.ts <input.yaml> [--output build/scene.js] [--format json] [--no-minify]');
    process.exit(1);
  }

  let input = args[0];
  const options: CliOptions = {
    output: 'build/scene.isostate.js',
    format: 'js',
    minify: true,
  };

  for (let i = 1; i < args.length; i++) {
    const arg = args[i];

    if (arg === '--output' && args[i + 1]) {
      options.output = args[++i];
    } else if (arg === '--format' && args[i + 1]) {
      const fmt = args[++i];
      if (fmt !== 'js' && fmt !== 'json') {
        console.error(`Unknown format: ${fmt}. Must be 'js' or 'json'.`);
        process.exit(1);
      }
      options.format = fmt;
    } else if (arg === '--no-minify') {
      options.minify = false;
    } else {
      console.error(`Unknown option: ${arg}`);
      process.exit(1);
    }
  }

  return { input, options };
}

function main() {
  const { input, options } = parseArgs();

  const rawYaml = readFileSync(input, 'utf-8');
  console.log(`Parsing: ${input}`);

  const scene = parseScene(rawYaml);
  console.log(
    `  → ${scene.scenes.length} scenes, ${scene.header.layers.length} layers, ${scene.header.assets.length} assets`
  );

  const report = validateScene(scene);

  if (report.errors.length > 0) {
    console.error(`\nValidation failed with ${report.errors.length} error(s):`);
    for (const error of report.errors) {
      const loc = error.elementId ? ` [element: ${error.elementId}]` : '';
      const st = error.stateName ? ` [state: ${error.stateName}]` : '';
      console.error(`  ${error.code}: ${error.message}${loc}${st}`);
    }
    process.exit(1);
  }

  if (report.warnings.length > 0) {
    console.warn(`\n${report.warnings.length} warning(s):`);
    for (const warning of report.warnings) {
      console.warn(`  ${warning.code}: ${warning.message}`);
    }
  }

  console.log('  → Validated successfully');

  // Compile to runtime bundle
  const bundle = compileScene(scene, {
    minify: options.minify,
  });

  // Serialize to output
  let output: string;
  if (options.format === 'json') {
    output = toJson(bundle);
  } else {
    output = toJs(bundle, { minify: options.minify });
  }

  // Write output
  const outPath = resolve(options.output);
  const outDir = dirname(outPath);
  if (!existsSync(outDir)) {
    mkdirSync(outDir, { recursive: true });
  }
  writeFileSync(outPath, output);
  console.log(`  → Compiled to: ${outPath}`);
}

main();
