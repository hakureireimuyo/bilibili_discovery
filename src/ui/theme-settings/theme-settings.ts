/**
 * 主题设置页面逻辑
 * 提供固定组件预览与主题明暗切换。
 */

import { themeManager, ThemeConfig, ThemeType, initThemedPage } from '../../themes/index.js';

function getThemeMeta(): string {
  return '内置主题';
}

class ThemeSettingsPage {
  private themeGrid: HTMLElement;
  private modeButtons: NodeListOf<HTMLButtonElement>;
  private statusElement: HTMLElement;
  private currentTheme: ThemeConfig;
  private readonly currentThemeLabel: HTMLElement;

  constructor() {
    initThemedPage('theme-settings');

    this.themeGrid = document.getElementById('theme-grid')!;
    this.modeButtons = document.querySelectorAll('.mode-btn');
    this.statusElement = document.getElementById('status')!;
    this.currentThemeLabel = document.getElementById('current-theme-label')!;

    this.currentTheme = themeManager.getCurrentTheme();
    this.init();
  }

  private init(): void {
    this.renderThemeCards();
    this.syncCurrentThemeState();
    this.addEventListeners();
    this.setupThemeChangeListener();
  }

  private addEventListeners(): void {
    this.modeButtons.forEach(button => {
      button.addEventListener('click', () => {
        this.handleModeChange(button.dataset.mode as ThemeType);
      });
    });
  }

  private renderThemeCards(): void {
    const uniqueThemes = this.getUniqueThemes(themeManager.getAllThemes());
    this.themeGrid.innerHTML = '';

    uniqueThemes.forEach(theme => {
      this.themeGrid.appendChild(this.createThemeCard(theme));
    });
  }

  private getUniqueThemes(themes: ThemeConfig[]): ThemeConfig[] {
    const themeMap = new Map<string, ThemeConfig>();

    themes.forEach(theme => {
      if (theme.type === ThemeType.Light) {
        themeMap.set(String(theme.id), theme);
      }
    });

    return Array.from(themeMap.values());
  }

  private createThemeCard(theme: ThemeConfig): HTMLElement {
    const card = document.createElement('article');
    card.className = 'theme-card';
    card.dataset.themeId = String(theme.id);

    if (theme.id === this.currentTheme.id) {
      card.classList.add('active');
    }

    const header = document.createElement('div');
    header.className = 'theme-card-header';

    const titleWrap = document.createElement('div');
    titleWrap.className = 'theme-card-title';

    const name = document.createElement('div');
    name.className = 'theme-name';
    name.textContent = theme.name;

    const meta = document.createElement('div');
    meta.className = 'theme-meta';
    meta.textContent = getThemeMeta();

    titleWrap.appendChild(name);
    titleWrap.appendChild(meta);
    header.appendChild(titleWrap);

    const preview = this.createThemePreview(theme);

    const actions = document.createElement('div');
    actions.className = 'theme-card-actions';

    const applyButton = document.createElement('button');
    applyButton.type = 'button';
    applyButton.className = 'theme-action primary';
    applyButton.textContent = '应用主题';
    applyButton.addEventListener('click', (event) => {
      event.stopPropagation();
      this.applyTheme(theme);
    });

    const modeHint = document.createElement('button');
    modeHint.type = 'button';
    modeHint.className = 'theme-action secondary';
    modeHint.textContent = this.currentTheme.type === ThemeType.Dark ? '当前深色' : '当前浅色';
    modeHint.disabled = true;

    actions.appendChild(applyButton);
    actions.appendChild(modeHint);

    card.appendChild(header);
    card.appendChild(preview);
    card.appendChild(actions);

    card.addEventListener('click', () => {
      this.applyTheme(theme);
    });

    return card;
  }

  private createThemePreview(theme: ThemeConfig): HTMLElement {
    const colors = theme.colors;
    const preview = document.createElement('div');
    preview.className = 'theme-preview';
    preview.style.background = `linear-gradient(180deg, ${colors.background.secondary} 0%, ${colors.background.primary} 100%)`;

    const windowEl = document.createElement('div');
    windowEl.className = 'preview-window';
    windowEl.style.background = colors.background.primary;
    windowEl.style.boxShadow = `0 12px 24px ${colors.shadow.light}`;

    const toolbar = document.createElement('div');
    toolbar.className = 'preview-toolbar';
    toolbar.style.background = colors.primary;
    toolbar.style.color = colors.text.inverse;

    const dots = document.createElement('div');
    dots.className = 'preview-dots';
    dots.innerHTML = '<span></span><span></span><span></span>';

    const chip = document.createElement('span');
    chip.className = 'preview-chip';
    chip.textContent = theme.type === ThemeType.Light ? '浅色' : '深色';
    chip.style.background = theme.type === ThemeType.Light ? 'rgba(255,255,255,0.22)' : 'rgba(255,255,255,0.12)';
    chip.style.color = colors.text.inverse;

    toolbar.appendChild(dots);
    toolbar.appendChild(chip);

    const body = document.createElement('div');
    body.className = 'preview-body';
    body.style.background = colors.background.primary;

    const hero = document.createElement('div');
    hero.className = 'preview-hero';

    const title = document.createElement('span');
    title.className = 'preview-line is-title';
    title.style.background = colors.text.primary;

    const copy1 = document.createElement('span');
    copy1.className = 'preview-line is-copy';
    copy1.style.background = theme.type === ThemeType.Light ? 'rgba(91, 100, 117, 0.45)' : 'rgba(203, 211, 225, 0.42)';

    const copy2 = document.createElement('span');
    copy2.className = 'preview-line is-copy short';
    copy2.style.background = theme.type === ThemeType.Light ? 'rgba(156, 163, 175, 0.35)' : 'rgba(150, 162, 181, 0.3)';

    hero.appendChild(title);
    hero.appendChild(copy1);
    hero.appendChild(copy2);

    const metrics = document.createElement('div');
    metrics.className = 'preview-metrics';

    ['主色层级', '强调色'].forEach((label, index) => {
      const stat = document.createElement('div');
      stat.className = 'preview-stat';
      stat.style.background = colors.background.tertiary;

      const statLabel = document.createElement('span');
      statLabel.className = 'preview-stat-label';
      statLabel.textContent = label;
      statLabel.style.color = colors.text.secondary;

      const statValue = document.createElement('span');
      statValue.className = 'preview-stat-value';
      statValue.textContent = index === 0 ? '稳定' : '突出';
      statValue.style.color = index === 0 ? colors.primary : colors.accent;

      stat.appendChild(statLabel);
      stat.appendChild(statValue);
      metrics.appendChild(stat);
    });

    const actions = document.createElement('div');
    actions.className = 'preview-actions';

    const primaryBtn = document.createElement('div');
    primaryBtn.className = 'preview-button';
    primaryBtn.style.background = colors.primary;

    const secondaryBtn = document.createElement('div');
    secondaryBtn.className = 'preview-button';
    secondaryBtn.style.background = colors.secondary;

    actions.appendChild(primaryBtn);
    actions.appendChild(secondaryBtn);

    const swatches = document.createElement('div');
    swatches.className = 'preview-swatches';
    [colors.primary, colors.secondary, colors.accent, colors.success, colors.warning].forEach(color => {
      const swatch = document.createElement('span');
      swatch.className = 'preview-swatch';
      swatch.style.background = color;
      swatches.appendChild(swatch);
    });

    body.appendChild(hero);
    body.appendChild(metrics);
    body.appendChild(actions);
    body.appendChild(swatches);

    windowEl.appendChild(toolbar);
    windowEl.appendChild(body);
    preview.appendChild(windowEl);

    return preview;
  }

  private applyTheme(theme: ThemeConfig): void {
    themeManager.setTheme(theme.id, this.currentTheme.type);
    this.showStatus(`已切换到「${theme.name}」`, 'success');
  }

  private handleModeChange(mode: ThemeType): void {
    themeManager.setTheme(this.currentTheme.id, mode);
    this.showStatus(mode === ThemeType.Dark ? '已切换到深色模式' : '已切换到浅色模式', 'success');
  }

  private syncCurrentThemeState(): void {
    this.currentTheme = themeManager.getCurrentTheme();
    this.currentThemeLabel.textContent = `${this.currentTheme.name} · ${this.currentTheme.type === ThemeType.Dark ? '深色' : '浅色'}`;

    this.modeButtons.forEach(button => {
      button.classList.toggle('active', button.dataset.mode === this.currentTheme.type);
    });

    const cards = this.themeGrid.querySelectorAll<HTMLElement>('.theme-card');
    cards.forEach(card => {
      card.classList.toggle('active', card.dataset.themeId === String(this.currentTheme.id));
      const secondaryButton = card.querySelector<HTMLButtonElement>('.theme-action.secondary');
      if (secondaryButton) {
        secondaryButton.textContent = this.currentTheme.type === ThemeType.Dark ? '当前深色' : '当前浅色';
      }
    });
  }

  private setupThemeChangeListener(): void {
    themeManager.addChangeListener((theme) => {
      this.currentTheme = theme;
      this.renderThemeCards();
      this.syncCurrentThemeState();
    });
  }

  private showStatus(message: string, type: 'success' | 'error'): void {
    this.statusElement.textContent = message;
    this.statusElement.className = `status ${type}`;
  }
}

document.addEventListener('DOMContentLoaded', () => {
  new ThemeSettingsPage();
});
