import { spawn } from 'child_process';

const viteEnv = { ...process.env, ELECTRON: '1' };
const electronEnv = { ...process.env };
delete electronEnv.ELECTRON_RUN_AS_NODE;

const viteProc = spawn('npx', ['vite'], {
    stdio: 'inherit',
    shell: true,
    env: viteEnv
});

const electronProc = spawn('npm', ['run', 'dev:electron'], {
    stdio: 'inherit',
    shell: true,
    env: electronEnv
});

let isShuttingDown = false;

const killProcessTree = (proc) => {
    try {
        if (!proc?.pid || proc.killed) return;
        if (process.platform === 'win32') {
            spawn('taskkill', ['/pid', String(proc.pid), '/t', '/f'], {
                stdio: 'ignore',
                windowsHide: true
            });
            return;
        }
        proc.kill('SIGTERM');
    } catch { }
};

const shutdown = (code = 0) => {
    if (isShuttingDown) return;
    isShuttingDown = true;
    killProcessTree(viteProc);
    killProcessTree(electronProc);
    setTimeout(() => process.exit(code), 100);
};

viteProc.on('exit', (code) => {
    shutdown(code ?? 0);
});

electronProc.on('exit', (code) => {
    shutdown(code ?? 0);
});

process.on('SIGINT', () => shutdown(0));
process.on('SIGTERM', () => shutdown(0));
