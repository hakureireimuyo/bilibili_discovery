import { navigateToFavorites, navigateToStats, navigateToTestTools, navigateToOptions, navigateToThemeSettings, navigateToDatabaseStats, navigateToWatchStats } from "./popup-progress.js";
import { openExtensionPage } from "./popup-runtime.js";
import { initThemedPage } from "../../themes/index.js";
import { getValue } from "../../database/implementations/index.js";

function formatTime(timestamp: number | null): string {
  if (!timestamp) {
    return "-";
  }
  const date = new Date(timestamp);
  return `${date.getMonth() + 1}/${date.getDate()} ${date
    .getHours()
    .toString()
    .padStart(2, "0")}:${date.getMinutes().toString().padStart(2, "0")}`;
}

function setText(id: string, value: string): void {
  const el = document.getElementById(id);
  if (el) {
    el.textContent = value;
  }
}

async function loadStatus(): Promise<void> {
  try {
    const settings = await getValue<{ userId?: number }>("settings");
    const userId = settings?.userId;
    const userIdEl = document.getElementById("status-user-id");

    if (userIdEl) {
      if (userId) {
        userIdEl.textContent = String(userId);
      } else {
        userIdEl.textContent = "未设置";
        userIdEl.style.color = "#ff6b6b";
        userIdEl.style.cursor = "pointer";
        userIdEl.title = "点击前往设置页面";
        userIdEl.addEventListener("click", () => {
          navigateToOptions();
        });
      }
    }
  } catch (error) {
    console.error("[popup] Failed to load status:", error);
  }
}

function bindButtons(): void {
  const btnStats = document.getElementById("btn-stats");
  if (btnStats) {
    btnStats.addEventListener("click", (event) => {
      console.log("[popup] btn-stats clicked");
      event.preventDefault();
      event.stopPropagation();
      navigateToStats();
    });
  }

  const btnWatchStats = document.getElementById("btn-watch-stats");
  if (btnWatchStats) {
    btnWatchStats.addEventListener("click", (event) => {
      console.log("[popup] btn-watch-stats clicked");
      event.preventDefault();
      event.stopPropagation();
      navigateToWatchStats();
    });
  }

  const btnFavorites = document.getElementById("btn-favorites");
  if (btnFavorites) {
    btnFavorites.addEventListener("click", (event) => {
      console.log("[popup] btn-favorites clicked");
      event.preventDefault();
      event.stopPropagation();
      navigateToFavorites();
    });
  }

  const btnInterestStats = document.getElementById("btn-interest-stats");
  if (btnInterestStats) {
    btnInterestStats.addEventListener("click", (event) => {
      console.log("[popup] btn-interest-stats clicked");
      event.preventDefault();
      event.stopPropagation();
      navigateToTestTools();
    });
  }

  const btnThemeSettings = document.getElementById("btn-theme-settings");
  if (btnThemeSettings) {
    btnThemeSettings.addEventListener("click", (event) => {
      console.log("[popup] btn-theme-settings clicked");
      event.preventDefault();
      event.stopPropagation();
      navigateToThemeSettings();
    });
  }

  const btnSettings = document.getElementById("btn-settings");
  if (btnSettings) {
    btnSettings.addEventListener("click", (event) => {
      console.log("[popup] btn-settings clicked");
      event.preventDefault();
      event.stopPropagation();
      navigateToOptions();
    });
  }

  const btnDatabaseStats = document.getElementById("btn-database-stats");
  if (btnDatabaseStats) {
    btnDatabaseStats.addEventListener("click", (event) => {
      console.log("[popup] btn-database-stats clicked");
      event.preventDefault();
      event.stopPropagation();
      navigateToDatabaseStats();
    });
  }
}

export function initPopup(): void {
  if (typeof document === "undefined") {
    return;
  }
  initThemedPage("popup");
  bindButtons();
  void loadStatus();
}

if (typeof document !== "undefined") {
  initPopup();
}
