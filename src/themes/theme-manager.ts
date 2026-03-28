/**
 * 主题管理器核心实现
 * 负责管理主题的切换、通知和 CSS 变量应用。
 */

import {
  ThemeConfig,
  ThemeId,
  ThemeType,
  ThemeChangeListener,
  IThemeManager
} from './types.js';
import { themeConfigs } from './theme-configs.js';
import { buildThemeVariables } from './theme-variables.js';

class ThemeManager implements IThemeManager {
  private static instance: ThemeManager;
  private currentTheme: ThemeConfig;
  private readonly themes: ThemeConfig[];
  private listeners: Set<ThemeChangeListener> = new Set();
  private readonly storageKey = 'bili-discovery-theme';
  private syncChannel: BroadcastChannel | null = null;
  private isApplyingExternalTheme = false;

  private constructor() {
    this.themes = [...themeConfigs];

    const savedTheme = this.loadThemeFromStorage();
    this.currentTheme = savedTheme || this.themes[0];

    this.setupCrossPageSync();
    this.applyTheme(this.currentTheme);
  }

  public static getInstance(): ThemeManager {
    if (!ThemeManager.instance) {
      ThemeManager.instance = new ThemeManager();
    }
    return ThemeManager.instance;
  }

  public getCurrentTheme(): ThemeConfig {
    return this.currentTheme;
  }

  public setTheme(themeId: ThemeId, type?: ThemeType): void {
    let newTheme: ThemeConfig | undefined;

    if (type) {
      newTheme = this.themes.find(
        theme => theme.id === themeId && theme.type === type
      );
    } else {
      newTheme = this.themes.find(
        theme => theme.id === themeId && theme.type === this.currentTheme.type
      );

      if (!newTheme) {
        newTheme = this.themes.find(
          theme => theme.id === themeId && theme.type === ThemeType.Light
        );
      }
    }

    if (!newTheme) {
      console.warn(`主题 ${themeId} 未找到，使用默认主题`);
      newTheme = this.themes[0];
    }

    if (newTheme.id === this.currentTheme.id && newTheme.type === this.currentTheme.type) {
      return;
    }

    this.currentTheme = newTheme;
    this.saveThemeToStorage(newTheme);
    this.applyTheme(newTheme);
    this.notifyListeners(newTheme);
  }

  public getAllThemes(): ThemeConfig[] {
    return [...this.themes];
  }

  public addChangeListener(listener: ThemeChangeListener): void {
    this.listeners.add(listener);
  }

  public removeChangeListener(listener: ThemeChangeListener): void {
    this.listeners.delete(listener);
  }

  public getCSSVariables(): Record<string, string> {
    return buildThemeVariables(this.currentTheme);
  }

  private applyTheme(theme: ThemeConfig): void {
    const root = document.documentElement;
    const variables = buildThemeVariables(theme);

    Object.entries(variables).forEach(([key, value]) => {
      root.style.setProperty(key, value);
    });

    root.classList.remove('theme-light', 'theme-dark');
    root.classList.add(`theme-${theme.type}`);

    root.classList.remove(
      ...Array.from(new Set(this.themes.map(config => `theme-${config.id}`)))
    );
    root.classList.add(`theme-${theme.id}`);
  }

  private setupCrossPageSync(): void {
    if (typeof window === 'undefined') {
      return;
    }

    if (typeof BroadcastChannel !== 'undefined') {
      this.syncChannel = new BroadcastChannel(this.storageKey);
      this.syncChannel.addEventListener('message', (event) => {
        this.applyExternalThemeState(event.data);
      });
    }

    window.addEventListener('storage', (event) => {
      if (event.key === this.storageKey && event.newValue) {
        this.applyExternalThemeState(event.newValue);
      }
    });
  }

  private applyExternalThemeState(payload: unknown): void {
    if (this.isApplyingExternalTheme) {
      return;
    }

    const nextTheme = this.resolveStoredTheme(payload);
    if (!nextTheme) {
      return;
    }

    if (nextTheme.id === this.currentTheme.id && nextTheme.type === this.currentTheme.type) {
      return;
    }

    this.isApplyingExternalTheme = true;

    try {
      this.currentTheme = nextTheme;
      this.applyTheme(nextTheme);
      this.notifyListeners(nextTheme);
    } finally {
      this.isApplyingExternalTheme = false;
    }
  }

  private resolveStoredTheme(payload: unknown): ThemeConfig | null {
    try {
      const parsed = typeof payload === 'string' ? JSON.parse(payload) : payload;
      const id = parsed && typeof parsed === 'object' ? (parsed as { id?: ThemeId }).id : undefined;
      const type = parsed && typeof parsed === 'object' ? (parsed as { type?: ThemeType }).type : undefined;

      if (!id || !type) {
        return null;
      }

      return this.themes.find(theme => theme.id === id && theme.type === type) || null;
    } catch (error) {
      console.error('解析主题配置失败:', error);
      return null;
    }
  }

  private notifyListeners(theme: ThemeConfig): void {
    this.listeners.forEach(listener => {
      try {
        listener(theme);
      } catch (error) {
        console.error('主题变更监听器执行出错:', error);
      }
    });
  }

  private loadThemeFromStorage(): ThemeConfig | null {
    try {
      const stored = localStorage.getItem(this.storageKey);
      if (stored) {
        return this.resolveStoredTheme(stored);
      }
    } catch (error) {
      console.error('加载主题配置失败:', error);
    }

    return null;
  }

  private saveThemeToStorage(theme: ThemeConfig): void {
    try {
      const payload = JSON.stringify({ id: theme.id, type: theme.type });
      localStorage.setItem(this.storageKey, payload);

      if (!this.isApplyingExternalTheme) {
        this.syncChannel?.postMessage(payload);
      }
    } catch (error) {
      console.error('保存主题配置失败:', error);
    }
  }
}

export const themeManager = ThemeManager.getInstance();
