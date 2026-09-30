import { spawn } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

let myraaProcess;

export function startMyraaService() {
  if (process.env.MYRAA_AUTOSTART === 'false' || myraaProcess) return myraaProcess;
  const currentDirectory = path.dirname(fileURLToPath(import.meta.url));
  const myraaDirectory = path.resolve(currentDirectory, '../../../myraa/Myraa-Voice-Assistant-main');
  const npmCommand = process.platform === 'win32' ? 'npm.cmd' : 'npm';
  const myraaPort = process.env.MYRAA_PORT || '3001';
  try {
    myraaProcess = spawn(npmCommand, ['run', 'dev'], {
      cwd: myraaDirectory,
      env: { ...process.env, PORT: myraaPort, MYRAA_PORT: myraaPort },
      stdio: 'inherit',
      shell: process.platform === 'win32'
    });
  } catch (error) {
    console.error(`[Myraa] Could not start integrated service: ${error.message}`);
    return undefined;
  }
  myraaProcess.on('error', (error) => console.error(`[Myraa] Could not start integrated service: ${error.message}`));
  myraaProcess.on('exit', (code, signal) => {
    console.log(`[Myraa] Integrated service stopped (${signal || code || 'unknown'}).`);
    myraaProcess = undefined;
  });
  return myraaProcess;
}

export function stopMyraaService() {
  if (!myraaProcess) return;
  myraaProcess.kill();
  myraaProcess = undefined;
}
