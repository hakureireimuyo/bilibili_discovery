import { openExtensionPage } from "./popup-runtime.js";

export function navigateToWorkbench(view: string = "overview"): void {
  openExtensionPage(`ui/workbench/workbench.html#${view}`);
}

export function navigateToStats(): void {
  navigateToWorkbench("stats");
}

export function navigateToFavorites(): void {
  navigateToWorkbench("favorites");
}

export function navigateToTestTools(): void {
  navigateToWorkbench("test-tools");
}

export function navigateToOptions(): void {
  navigateToWorkbench("settings");
}

export function navigateToThemeSettings(): void {
  navigateToWorkbench("themes");
}

export function navigateToDatabaseStats(): void {
  navigateToWorkbench("database");
}

export function navigateToWatchStats(): void {
  navigateToWorkbench("watch-stats");
}

export function navigateToWatchHistory(): void {
  navigateToWorkbench("watch-history");
}
