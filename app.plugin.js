// app.plugin.js
const { withDangerousMod, withAppDelegate } = require('@expo/config-plugins');
const fs = require('fs');
const path = require('path');

/** ──────────────────────────────────────────────────────────
 * 1) Keep your Podfile patch (use_frameworks! :linkage => :static)
 * ────────────────────────────────────────────────────────── */
function addUseFrameworksStatic(podfileContent) {
  if (!podfileContent.includes('use_frameworks! :linkage => :static')) {
    return podfileContent.replace(
      /^(.*use_expo_modules!.*)$/m,
      `$1\nuse_frameworks! :linkage => :static`
    );
  }
  return podfileContent;
}

function modifyPodfile(podfileContent) {
  return addUseFrameworksStatic(podfileContent);
}

const withFrameworksStaticPodfile = (config) => {
  return withDangerousMod(config, [
    'ios',
    (cfg) => {
      const podfilePath = path.join(cfg.modRequest.platformProjectRoot, 'Podfile');
      let contents = fs.readFileSync(podfilePath, 'utf-8');
      contents = modifyPodfile(contents);
      fs.writeFileSync(podfilePath, contents, 'utf-8');
      return cfg;
    },
  ]);
};

/** ──────────────────────────────────────────────────────────
 * 2) Patch AppDelegate.swift to support Firebase Phone Auth
 *    - import FirebaseCore + React
 *    - FirebaseApp.configure() at launch
 *    - openURL & continueUserActivity forwarding
 * ────────────────────────────────────────────────────────── */
const withFirebasePhoneAuthIOS = (config) =>
  withAppDelegate(config, (cfg) => {
    const mod = cfg.modResults;

    // Only Swift AppDelegate is handled here (Expo defaults to Swift).
    if (mod.language !== 'swift') return cfg;

    let src = mod.contents;

    const ensureImport = (name) => {
      if (!src.includes(`import ${name}`)) {
        // insert after ExpoModulesCore import if present, else at top
        if (src.includes('import ExpoModulesCore')) {
          src = src.replace(
            /import ExpoModulesCore\s*\n/,
            (m) => m + `import ${name}\n`
          );
        } else {
          src = `import ${name}\n` + src;
        }
      }
    };

    ensureImport('FirebaseCore');   // for FirebaseApp
    ensureImport('React');          // for RCTLinkingManager

    // Ensure FirebaseApp.configure() in didFinishLaunching
    if (!src.includes('FirebaseApp.configure()')) {
      // Insert just after method opening brace
      src = src.replace(
        /(didFinishLaunchingWithOptions[^{]+\{\s*\n)/,
        (m) => m + '    if FirebaseApp.app() == nil { FirebaseApp.configure() }\n'
      );
    }

    // Ensure openURL handler exists (for reCAPTCHA return)
    if (!/application\(\s*_ app:\s*UIApplication,\s*open url:\s*URL,/.test(src)) {
      const openUrl = `
  override func application(
    _ app: UIApplication,
    open url: URL,
    options: [UIApplication.OpenURLOptionsKey : Any] = [:]
  ) -> Bool {
    if RCTLinkingManager.application(app, open: url, options: options) {
      return true
    }
    return super.application(app, open: url, options: options)
  }
`;
      // append before final class closing brace
      src = src.replace(/\n\}\s*$/, openUrl + '\n}');
    }

    // Ensure continue userActivity exists (optional but nice)
    if (!/continue userActivity:\s*NSUserActivity/.test(src)) {
      const contUA = `
  override func application(
    _ application: UIApplication,
    continue userActivity: NSUserActivity,
    restorationHandler: @escaping ([UIUserActivityRestoring]?) -> Void
  ) -> Bool {
    if RCTLinkingManager.application(application, continue: userActivity, restorationHandler: restorationHandler) {
      return true
    }
    return super.application(application, continue: userActivity, restorationHandler: restorationHandler)
  }
`;
      src = src.replace(/\n\}\s*$/, contUA + '\n}');
    }

    cfg.modResults.contents = src;
    return cfg;
  });

/** ──────────────────────────────────────────────────────────
 * 3) Compose both mods
 * ────────────────────────────────────────────────────────── */
module.exports = function (config) {
  config = withFrameworksStaticPodfile(config);
  config = withFirebasePhoneAuthIOS(config);
  return config;
};
