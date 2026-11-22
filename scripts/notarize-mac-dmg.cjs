const { execFile } = require('node:child_process');
const { mkdtemp, rename, rmdir } = require('node:fs/promises');
const path = require('node:path');
const { setTimeout: delay } = require('node:timers/promises');
const { promisify } = require('node:util');

const run = promisify(execFile);
const developerIdRequirement = 'anchor apple generic and certificate leaf[field.1.2.840.113635.100.6.1.13] exists';

module.exports = async ({ file }) => {
  if (!file || path.extname(file) !== '.dmg') return;

  const pendingDir = await mkdtemp(path.join(path.dirname(file), '.notarization-'));
  const pendingDmg = path.join(pendingDir, path.basename(file));
  await rename(file, pendingDmg);

  const credentials = ['--keychain-profile', process.env.APPLE_KEYCHAIN_PROFILE || 'decksona-notary'];
  if (process.env.APPLE_KEYCHAIN) credentials.push('--keychain', process.env.APPLE_KEYCHAIN);

  try {
    await run('codesign', ['--verify', '--strict', `-R=${developerIdRequirement}`, pendingDmg]);
    console.log(`Submitting ${path.basename(file)} to Apple for notarization.`);
    const submission = await run('xcrun', ['notarytool', 'submit', pendingDmg, ...credentials, '--output-format', 'json']);
    const { id } = JSON.parse(submission.stdout);
    console.log(`Waiting for Apple notarization (submission ${id}).`);
    const result = await run('xcrun', ['notarytool', 'wait', id, ...credentials, '--output-format', 'json']);
    const { status } = JSON.parse(result.stdout);
    if (status !== 'Accepted') throw new Error(`Apple reported ${status} for submission ${id}.`);

    for (let attempt = 1; ; attempt += 1) {
      try {
        await run('xcrun', ['stapler', 'staple', pendingDmg]);
        break;
      } catch (error) {
        if (attempt === 4) throw error;
        await delay(1_000 * attempt);
      }
    }
    await run('xcrun', ['stapler', 'validate', pendingDmg]);
    await run('codesign', ['--verify', '--strict', `-R=${developerIdRequirement}`, pendingDmg]);
    await run('spctl', ['--assess', '--type', 'open', '--context', 'context:primary-signature', pendingDmg]);
  } catch (error) {
    const detail = error.stderr?.trim() || error.stdout?.trim() || error.message;
    throw new Error(`The macOS release DMG is pending at ${pendingDmg}. ${detail}`, { cause: error });
  }

  await rename(pendingDmg, file);
  await rmdir(pendingDir);
  console.log(`Notarized macOS release verified at ${file}.`);
};
