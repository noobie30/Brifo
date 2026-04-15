const { execFileSync } = require("node:child_process");
const path = require("node:path");

// electron-builder afterPack hook. Runs after the .app bundle is written but
// before it is archived into a DMG/ZIP. We ad-hoc sign the app here so the
// DMG packaged in the next step contains a signed bundle — otherwise macOS
// Gatekeeper blocks the unsigned app with no easy override path.
//
// Ad-hoc signing (--sign -) is NOT the same as Developer ID + notarization:
// users still have to right-click → Open the first time. But it is a strictly
// better user experience than shipping a totally unsigned app.
exports.default = async function adHocSign(context) {
  if (context.electronPlatformName !== "darwin") return;

  const appName = context.packager.appInfo.productFilename;
  const appPath = path.join(context.appOutDir, `${appName}.app`);

  // eslint-disable-next-line no-console
  console.log(`[ad-hoc-sign] signing ${appPath}`);
  execFileSync("codesign", ["--deep", "--force", "--sign", "-", appPath], {
    stdio: "inherit",
  });
};
