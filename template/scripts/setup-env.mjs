#!/usr/bin/env node
// Copies every .env.example in the workspace to .env, skipping files that already exist.
import { copyFileSync, existsSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';

const ROOT = process.cwd();
const SEARCH_DIRS = ['apps', 'packages'];
let copied = 0;
let skipped = 0;

function findEnvExamples(dir) {
  const results = [];
  for (const entry of readdirSync(dir)) {
    if (entry === 'node_modules' || entry === '.git') continue;
    const full = join(dir, entry);
    const stat = statSync(full);
    if (stat.isDirectory()) {
      results.push(...findEnvExamples(full));
    } else if (entry === '.env.example') {
      results.push(full);
    }
  }
  return results;
}

const examples = SEARCH_DIRS.flatMap((d) =>
  existsSync(join(ROOT, d)) ? findEnvExamples(join(ROOT, d)) : [],
);

for (const example of examples) {
  const target = example.replace(/\.example$/, '');
  if (existsSync(target)) {
    console.log(`skip   ${target} (exists)`);
    skipped++;
  } else {
    copyFileSync(example, target);
    console.log(`create ${target}`);
    copied++;
  }
}

console.log(`\nDone. Created ${copied}, skipped ${skipped}.`);
