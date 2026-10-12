// Creates (or refreshes) a "Fettle" shortcut on the Windows desktop that runs scripts/launch.mjs.
import { spawnSync } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

if (process.platform !== 'win32') {
  console.error('Desktop shortcuts are only set up on Windows. Run `node scripts/launch.mjs` instead.');
  process.exit(1);
}

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const icon = path.join(root, 'assets', 'fettle.ico');
const quote = (s) => `'${s.replace(/'/g, "''")}'`;

// WScript.Shell is the standard way to write a .lnk; the Desktop path follows OneDrive redirection.
const ps = `
$desktop = [Environment]::GetFolderPath('Desktop')
$link = Join-Path $desktop 'Fettle.lnk'
$shell = New-Object -ComObject WScript.Shell
$s = $shell.CreateShortcut($link)
$s.TargetPath = "$env:SystemRoot\\System32\\cmd.exe"
$s.Arguments = '/c title Fettle server - close to stop && node scripts\\launch.mjs'
$s.WorkingDirectory = ${quote(root)}
$s.IconLocation = ${quote(icon)} + ',0'
$s.Description = 'Start Fettle and open it in your browser'
$s.WindowStyle = 7
$s.Save()
Write-Output $link
`;

const result = spawnSync('powershell.exe', ['-NoProfile', '-NonInteractive', '-Command', ps], { encoding: 'utf8' });
if (result.status !== 0) {
  console.error(result.stderr || 'Could not create the shortcut.');
  process.exit(1);
}
console.log(`Shortcut created: ${result.stdout.trim()}`);
