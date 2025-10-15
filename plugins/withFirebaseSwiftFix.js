// plugins/withFirebaseSwiftFix.js
const { withAppDelegate, withInfoPlist } = require("@expo/config-plugins");

module.exports = function withFirebaseSwiftFix(config) {
  // 1) Ensure URL scheme from REVERSED_CLIENT_ID (reCAPTCHA return)
  config = withInfoPlist(config, (c) => {
    const reversed = c.extra?.iosReversedClientId;
    if (reversed) {
      const types = c.modResults.CFBundleURLTypes ?? [];
      const has = types.some(t => (t.CFBundleURLSchemes || []).includes(reversed));
      if (!has) {
        types.push({ CFBundleURLSchemes: [reversed] });
        c.modResults.CFBundleURLTypes = types;
      }
    }
    return c;
  });

  // 2) Patch Swift AppDelegate
  config = withAppDelegate(config, (c) => {
    if (c.modResults.language !== "swift") return c;
    let src = c.modResults.contents;

    // imports
    if (!src.includes("import FirebaseCore")) {
      src = src.replace("import UIKit", "import UIKit\nimport FirebaseCore");
    }
    if (!src.includes("import React")) {
      src = src.replace("import UIKit", "import UIKit\nimport React");
    }

    // Ensure FirebaseApp.configure() in didFinishLaunchingWithOptions
    const didFinishRegex =
      /func\s+application\(\s*_?\s*application:\s*UIApplication,\s*didFinishLaunchingWithOptions\s+launchOptions:\s*\[UIApplication\.LaunchOptionsKey:\s*Any\]\?\)\s*->\s*Bool\s*\{([\s\S]*?)\n\}/m;

    if (didFinishRegex.test(src) && !src.includes("FirebaseApp.configure()")) {
      src = src.replace(
        didFinishRegex,
        (m, body) => m.replace(body, `\n    FirebaseApp.configure()\n${body}`)
      );
    } else if (!didFinishRegex.test(src)) {
      // add minimal didFinish if missing
      const method = `
  func application(_ application: UIApplication, didFinishLaunchingWithOptions launchOptions: [UIApplication.LaunchOptionsKey: Any]?) -> Bool {
    FirebaseApp.configure()
    return true
  }`;
      src = src.replace(/\}\s*$/m, `${method}\n}\n`);
    }

    // openURL handler (reCAPTCHA / Linking)
    if (!src.includes("RCTLinkingManager.application(app, open: url, options: options)")) {
      const openURL = `
  // Added by withFirebaseSwiftFix
  override func application(_ app: UIApplication,
                            open url: URL,
                            options: [UIApplication.OpenURLOptionsKey : Any] = [:]) -> Bool {
    return RCTLinkingManager.application(app, open: url, options: options)
  }`;
      src = src.replace(/\}\s*$/m, `${openURL}\n}\n`);
    }

    // Universal Links (nice-to-have)
    if (!src.includes("continue userActivity: NSUserActivity")) {
      const continueUL = `
  // Added by withFirebaseSwiftFix (universal links)
  override func application(_ application: UIApplication,
                            continue userActivity: NSUserActivity,
                            restorationHandler: @escaping ([UIUserActivityRestoring]?) -> Void) -> Bool {
    return RCTLinkingManager.application(application, continue: userActivity, restorationHandler: restorationHandler)
  }`;
      src = src.replace(/\}\s*$/m, `${continueUL}\n}\n`);
    }

    c.modResults.contents = src;
    return c;
  });

  return config;
};
