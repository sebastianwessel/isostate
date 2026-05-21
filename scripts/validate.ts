#!/usr/bin/env tsx
/**
 * CLI script to validate a YAML DSL scene file.
 *
 * Usage:
 *   tsx scripts/validate.ts <input.yaml>
 */

import { readFileSync } from 'fs';
import { parseScene, validateScene } from '../packages/core/src/dsl/index.ts';

function main() {
  const args = process.argv.slice(2);

  if (args.length === 0) {
    console.error('Usage: tsx scripts/validate.ts <input.yaml>');
    process.exit(1);
  }

  const input = args[0];

  const rawYaml = readFileSync(input, 'utf-8');
  console.log(`Validating: ${input}`);

  const scene = parseScene(rawYaml);
  console.log(
    `  → ${scene.scenes.length} scenes, ${scene.header.layers.length} layers, ${scene.header.assets.length} assets`
  );

  const report = validateScene(scene);

  if (report.errors.length > 0) {
    console.error(`\n❌ Validation failed: ${report.errors.length} error(s)`);
    for (const error of report.errors) {
      const loc = error.elementId ? ` [${error.elementId}]` : '';
      const st = error.stateName ? ` [${error.stateName}]` : '';
      console.error(`  ${error.code}: ${error.message}${loc}${st}`);
    }
    process.exit(1);
  }

  if (report.warnings.length > 0) {
    console.warn(`\n⚠ ${report.warnings.length} warning(s):`);
    for (const warning of report.warnings) {
      console.warn(`  ${warning.code}: ${warning.message}`);
    }
  }

  console.log(`\n✓ Validated successfully`);
  if (report.warnings.length > 0) {
    console.log(`  (${report.warnings.length} warning(s))`);
  }
}

main();
