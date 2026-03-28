import { openExtensionPage } from "./popup-runtime.js";

export function navigateToStats(): void {
  openExtensionPage("ui/stats/stats.html");
}

export function navigateToTestTools(): void {
  openExtensionPage("ui/test-tools/test-tools.html");
}

export function navigateToOptions(): void {
  openExtensionPage("ui/options/options.html");
}

export function navigateToThemeSettings(): void {
  openExtensionPage("ui/theme-settings/theme-settings.html");
}
