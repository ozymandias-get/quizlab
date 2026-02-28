import { spawn } from 'child_process';

const viteProc = spawn('npx', ['vite'], {
    stdio: 'inherit',
    shell: true,
    env: { ...process.env, ELECTRON: '1' }
});

const electronProc = spawn('npm', ['run', 'dev:electron'], {
    stdio: 'inherit',
    shell: true,
    env: process.env
});

const cleanup = () => {
    try { viteProc.kill(); } catch (e) { }
    try { electronProc.kill(); } catch (e) { }
    process.exit();
};

process.on('SIGINT', cleanup);
process.on('SIGTERM', cleanup);
process.on('exit', cleanup);
