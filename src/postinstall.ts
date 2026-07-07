import { spawn, spawnSync } from 'node:child_process';
import pc from 'picocolors';

const IS_WIN = process.platform === 'win32';

// pnpm is a `pnpm.cmd` shim on Windows: it cannot be spawned without a shell (ENOENT/EINVAL).
// git ships a real .exe and must stay shell-less. Only ever pass fixed literal args through
// here — user input in a shell:true spawn is command injection (CVE-2024-27980 class).
function toolCommand(name: string): { cmd: string; shell: boolean } {
  if (IS_WIN && name === 'pnpm') return { cmd: 'pnpm.cmd', shell: true };
  return { cmd: name, shell: false };
}

export function detectTool(name: string): boolean {
  const { cmd, shell } = toolCommand(name);
  const result = spawnSync(cmd, ['--version'], { stdio: 'ignore', shell });
  return result.status === 0;
}

export function runGitInit(targetDir: string): void {
  const opts = { cwd: targetDir, stdio: 'ignore' as const };

  const init = spawnSync('git', ['init', '-b', 'main'], opts);
  if (init.status !== 0) {
    process.stdout.write(pc.yellow('  ! git init failed; skipping repo initialization\n'));
    return;
  }

  spawnSync('git', ['add', '.'], opts);

  const commit = spawnSync('git', ['commit', '-m', 'Initial commit'], opts);
  if (commit.status === 0) {
    process.stdout.write(pc.green('  ✓ Initialized git repository\n'));
    return;
  }

  const fallback = spawnSync(
    'git',
    [
      '-c', 'user.name=create-honorepo',
      '-c', 'user.email=create-honorepo@noreply.local',
      'commit', '-m', 'Initial commit',
    ],
    opts,
  );
  if (fallback.status === 0) {
    process.stdout.write(pc.green('  ✓ Initialized git repository\n'));
  } else {
    process.stdout.write(pc.yellow('  ! initial commit failed; project files are still on disk\n'));
  }
}

export async function runPnpmInstall(targetDir: string): Promise<boolean> {
  return new Promise((resolveP) => {
    const start = Date.now();
    const stop = startSpinner('Installing dependencies');

    const { cmd, shell } = toolCommand('pnpm');
    const child = spawn(cmd, ['install'], { cwd: targetDir, stdio: ['ignore', 'pipe', 'pipe'], shell });
    let stderr = '';
    let stdout = '';
    child.stdout?.on('data', (d) => { stdout += d.toString(); });
    child.stderr?.on('data', (d) => { stderr += d.toString(); });

    child.on('error', (err) => {
      stop();
      process.stdout.write(pc.red(`  ✖ Failed to start pnpm: ${err.message}\n`));
      resolveP(false);
    });

    child.on('exit', (code) => {
      stop();
      const elapsed = ((Date.now() - start) / 1000).toFixed(1);
      if (code === 0) {
        process.stdout.write(pc.green(`  ✓ Installed dependencies (${elapsed}s)\n`));
        resolveP(true);
      } else {
        process.stdout.write(pc.red(`  ✖ pnpm install failed (exit ${code})\n`));
        if (stdout) process.stdout.write(stdout);
        if (stderr) process.stderr.write(stderr);
        resolveP(false);
      }
    });
  });
}

function startSpinner(label: string): () => void {
  if (!process.stdout.isTTY) {
    process.stdout.write(`  ${label}…\n`);
    return () => { /* no-op */ };
  }
  const frames = ['⠋', '⠙', '⠹', '⠸', '⠼', '⠴', '⠦', '⠧', '⠇', '⠏'];
  let i = 0;
  const start = Date.now();
  const render = (): void => {
    const frame = frames[i % frames.length];
    const elapsed = ((Date.now() - start) / 1000).toFixed(1);
    process.stdout.write(`\r  ${pc.cyan(frame ?? '')} ${label}… ${pc.dim(`${elapsed}s`)}`);
    i++;
  };
  render();
  const id = setInterval(render, 80);
  return () => {
    clearInterval(id);
    process.stdout.write('\r' + ' '.repeat(60) + '\r');
  };
}
