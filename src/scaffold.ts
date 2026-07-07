import {
  copyFileSync,
  mkdirSync,
  readdirSync,
  readFileSync,
  statSync,
  writeFileSync,
} from 'node:fs';
import { dirname, join, relative } from 'node:path';

export type ScaffoldVars = {
  projectName: string;
  scope: string;
};

const TEXT_EXTENSIONS = new Set([
  '.ts', '.tsx', '.js', '.jsx', '.mjs', '.cjs',
  '.json', '.md', '.txt', '.yaml', '.yml', '.toml',
  '.html', '.css', '.example', '.prisma',
]);

const TEXT_FILENAMES = new Set([
  '_gitignore', '_npmrc', '_nvmrc', '_editorconfig',
]);

function isTextFile(name: string): boolean {
  if (TEXT_FILENAMES.has(name)) return true;
  const dot = name.lastIndexOf('.');
  if (dot === -1) return false;
  return TEXT_EXTENSIONS.has(name.slice(dot));
}

function unhideName(name: string): string {
  if (name.startsWith('_')) return '.' + name.slice(1);
  return name;
}

export function substitute(content: string, vars: ScaffoldVars): string {
  // With an empty scope, "@__scope__/web" must become "my-app-web", not the invalid "@/web",
  // so the scoped prefix is replaced as a unit before the bare tokens.
  const packagePrefix = vars.scope ? `@${vars.scope}/` : `${vars.projectName}-`;
  return content
    .replaceAll('@__scope__/', packagePrefix)
    .replaceAll('__projectName__', vars.projectName)
    .replaceAll('__scope__', vars.scope || vars.projectName);
}

export function scaffold(templateDir: string, targetDir: string, vars: ScaffoldVars): string[] {
  mkdirSync(targetDir, { recursive: true });
  const created: string[] = [];
  walk(templateDir, targetDir, targetDir, vars, created);
  return created;
}

function walk(
  src: string,
  dst: string,
  dstRoot: string,
  vars: ScaffoldVars,
  created: string[],
): void {
  for (const entry of readdirSync(src)) {
    const srcPath = join(src, entry);
    const dstName = unhideName(entry);
    const dstPath = join(dst, dstName);
    const stat = statSync(srcPath);

    if (stat.isDirectory()) {
      mkdirSync(dstPath, { recursive: true });
      walk(srcPath, dstPath, dstRoot, vars, created);
      continue;
    }

    mkdirSync(dirname(dstPath), { recursive: true });

    if (isTextFile(entry)) {
      const content = readFileSync(srcPath, 'utf8');
      writeFileSync(dstPath, substitute(content, vars));
    } else {
      copyFileSync(srcPath, dstPath);
    }
    created.push(relative(dstRoot, dstPath));
  }
}
