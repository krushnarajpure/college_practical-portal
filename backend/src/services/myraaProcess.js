import { spawn } from 'node:child_process';
import net from 'node:net';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

let myraaProcess;

function isPortAvailable(port) {
  return new Promise((resolve) => {
    const tester = net.createServer();

    tester.once('error', () => resolve(false));
    tester.once('listening', () => {
      tester.close(() => resolve(true));
    });

    tester.listen(port, '127.0.0.1');
  });
}

export function startMyraaService() {
  if (process.env.MYRAA_AUTOSTART === 'false' || myraaProcess) return myraaProcess;

  const currentDirectory = path.dirname(fileURLToPath(import.meta.url));
  const myraaDirectory = path.resolve(currentDirectory, '../../../myraa/Myraa-Voice-Assistant-main');
  const npmCommand = process.platform === 'win32' ? 'npm.cmd' : 'npm';
  const myraaPort = Number(process.env.MYRAA_PORT || '3001');

  isPortAvailable(myraaPort)
    .then((available) => {
      if (!available) {
        console.log(`[Myraa] Port ${myraaPort} is already in use. Skipping integrated Myraa startup.`);
        return;
      }

      try {
        myraaProcess = spawn(npmCommand, ['run', 'dev'], {
          cwd: myraaDirectory,
          env: { ...process.env, PORT: String(myraaPort), MYRAA_PORT: String(myraaPort) },
          stdio: 'inherit',
          shell: process.platform === 'win32'
        });
      } catch (error) {
        console.error(`[Myraa] Could not start integrated service: ${error.message}`);
        return;
      }

      myraaProcess.on('error', (error) => console.error(`[Myraa] Could not start integrated service: ${error.message}`));
      myraaProcess.on('exit', (code, signal) => {
        console.log(`[Myraa] Integrated service stopped (${signal || code || 'unknown'}).`);
        myraaProcess = undefined;
      });
    })
    .catch((error) => {
      console.error(`[Myraa] Could not start integrated service: ${error.message}`);
    });

  return myraaProcess;
}

export function stopMyraaService() {
  if (!myraaProcess) return;
  myraaProcess.kill();
  myraaProcess = undefined;
}
