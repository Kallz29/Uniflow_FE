const { withAndroidManifest, withDangerousMod } = require('@expo/config-plugins');
const fs = require('fs');
const path = require('path');

// Plugin 1: Tambah networkSecurityConfig ke AndroidManifest
const withNetworkSecurityManifest = (config) => {
  return withAndroidManifest(config, (config) => {
    const manifest = config.modResults.manifest;
    const app = manifest.application[0];

    // Set networkSecurityConfig attribute
    app.$['android:networkSecurityConfig'] = '@xml/network_security_config';

    // Pastikan usesCleartextTraffic juga true
    app.$['android:usesCleartextTraffic'] = 'true';

    return config;
  });
};

// Plugin 2: Tulis file network_security_config.xml ke res/xml
const withNetworkSecurityFile = (config) => {
  return withDangerousMod(config, [
    'android',
    (config) => {
      const xmlDir = path.join(
        config.modRequest.platformProjectRoot,
        'app', 'src', 'main', 'res', 'xml'
      );

      // Buat direktori jika belum ada
      if (!fs.existsSync(xmlDir)) {
        fs.mkdirSync(xmlDir, { recursive: true });
      }

      const xmlContent = `<?xml version="1.0" encoding="utf-8"?>
<network-security-config>
    <!--
      Allow cleartext HTTP specifically to ESP32 AP IP.
      Android 10+ blocks cleartext by default; this explicitly
      whitelists 192.168.4.1 without opening all cleartext traffic.
    -->
    <domain-config cleartextTrafficPermitted="true">
        <domain includeSubdomains="false">192.168.4.1</domain>
    </domain-config>
    <base-config cleartextTrafficPermitted="false">
        <trust-anchors>
            <certificates src="system" />
        </trust-anchors>
    </base-config>
</network-security-config>`;

      fs.writeFileSync(
        path.join(xmlDir, 'network_security_config.xml'),
        xmlContent,
        'utf8'
      );

      console.log('[Plugin] network_security_config.xml ditulis ke', xmlDir);
      return config;
    },
  ]);
};

module.exports = (config) => {
  config = withNetworkSecurityManifest(config);
  config = withNetworkSecurityFile(config);
  return config;
};