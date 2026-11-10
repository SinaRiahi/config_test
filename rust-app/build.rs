fn main() {
    #[cfg(target_os = "windows")]
    {
        let mut res = winresource::WindowsResource::new();
        res.set_icon("icon.ico");
        res.set("ProductName", "VPN Config Checker");
        res.set(
            "FileDescription",
            "VPN Config Checker - AI Studio Deep Regional Verifier",
        );
        res.set("CompanyName", "Sina Riahi Open Source");
        res.set("LegalCopyright", "Copyright (c) 2025-2026 Sina Riahi");
        res.set("OriginalFilename", "vpn-config-checker.exe");
        res.set("InternalName", "vpn-config-checker");
        // Embed an explicit Windows Application Manifest declaring standard user level
        // ("asInvoker") and Windows 10 / 11 compatibility to prevent UAC elevation prompts
        // and reduce heuristic SmartScreen / Defender false-positive warnings.
        res.set_manifest(
            r#"<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<assembly xmlns="urn:schemas-microsoft-com:asm.v1" manifestVersion="1.0">
  <assemblyIdentity
    version="0.2.0.0"
    processorArchitecture="*"
    name="SinaRiahi.VpnConfigChecker.App"
    type="win32"
  />
  <description>VPN Config Checker - AI Studio Deep Regional Verifier</description>
  <trustInfo xmlns="urn:schemas-microsoft-com:asm.v3">
    <security>
      <requestedPrivileges>
        <requestedExecutionLevel level="asInvoker" uiAccess="false" />
      </requestedPrivileges>
    </security>
  </trustInfo>
  <compatibility xmlns="urn:schemas-microsoft-com:compatibility.v1">
    <application>
      <!-- Windows 10 and Windows 11 -->
      <supportedOS Id="{8e0f7a12-bfb3-4fe8-b9a5-48fd50a15a9a}" />
    </application>
  </compatibility>
  <application xmlns="urn:schemas-microsoft-com:asm.v3">
    <windowsSettings>
      <dpiAware xmlns="http://schemas.microsoft.com/SMI/2005/WindowsSettings">true/pm</dpiAware>
      <dpiAwareness xmlns="http://schemas.microsoft.com/SMI/2016/WindowsSettings">PerMonitorV2, PerMonitor</dpiAwareness>
    </windowsSettings>
  </application>
</assembly>"#,
        );
        let _ = res.compile();
    }
}
