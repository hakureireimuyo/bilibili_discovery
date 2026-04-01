import { openExtensionPage } from "./popup-runtime.js";

export function navigateToStats(): void {
  openExtensionPage("ui/stats/stats.html");
}

export function navigateToFavorites(): void {
  openExtensionPage("ui/favorites/favorites.html");
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

export function navigateToDatabaseStats(): void {
  openExtensionPage("ui/database-stats/database-stats.html");
}

export function navigateToWatchStats(): void {
  openExtensionPage("ui/watch-stats/watch-stats.html");
}
