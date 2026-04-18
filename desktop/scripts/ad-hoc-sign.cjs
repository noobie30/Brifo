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

  // Pin the code-signing identifier to the app's bundle ID. With plain
  // `--sign -`, codesign derives a per-build identifier, so macOS TCC
  // (Microphone permission) can treat every rebuild as a new app and
  // accumulate duplicate entries. Pinning `--identifier` keeps the
  // identifier stable across rebuilds — the best we can do under
  // ad-hoc signing (Developer ID + notarization would be deterministic).
  const bundleId =
    context.packager.appInfo.info._configuration.appId || "com.brifo.desktop";

  // eslint-disable-next-line no-console
  console.log(
    `[ad-hoc-sign] signing ${appPath} (identifier=${bundleId})`,
  );
  execFileSync(
    "codesign",
    [
      "--deep",
      "--force",
      "--sign",
      "-",
      "--identifier",
      bundleId,
      appPath,
    ],
    { stdio: "inherit" },
  );
};
