const { execFileSync } = require('node:child_process');
const path = require('node:path');

module.exports = ({ appOutDir, packager }) => {
  const app = path.join(appOutDir, `${packager.appInfo.productFilename}.app`);
  const args = ['--verify', '--deep', '--strict'];
  if (packager.platformSpecificBuildOptions.identity !== '-') {
    args.push('-R=anchor apple generic and certificate leaf[field.1.2.840.113635.100.6.1.13] exists');
  }
  execFileSync('codesign', [...args, app], { stdio: 'inherit' });
};
