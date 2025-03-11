// app.plugin.js

const { withDangerousMod } = require('@expo/config-plugins');
const fs = require('fs');
const path = require('path');

/**
 * Insert `use_frameworks! :linkage => :static` after `use_expo_modules!` if not already present.
 */
function addUseFrameworksStatic(podfileContent) {
  if (!podfileContent.includes('use_frameworks! :linkage => :static')) {
    return podfileContent.replace(
      /^(.*use_expo_modules!.*)$/m,
      `$1\nuse_frameworks! :linkage => :static`
    );
  }
  return podfileContent;
}

/**
 * Modify Podfile content (only adding `use_frameworks! :linkage => :static`)
 */
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

module.exports = function (config) {
  return withFrameworksStaticPodfile(config);
};
