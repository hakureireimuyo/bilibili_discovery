/**
 * 统计卡片组件
 * 用于展示统计数据的卡片
 */

import type { StatCardData, StatCardOptions } from './types.js';

export class StatCard {
  private container: HTMLElement;
  private options: Required<StatCardOptions>;

  constructor(container: HTMLElement | string, options: StatCardOptions = {}) {
    this.container = typeof container === 'string'
      ? document.getElementById(container)!
      : container;

    // 设置默认选项
    this.options = {
      showIcon: options.showIcon ?? false,
      enableHover: options.enableHover ?? true,
      onClick: options.onClick ?? (() => {})
    };
  }

  /**
   * 渲染统计卡片
   */
  render(data: StatCardData): void {
    this.container.innerHTML = '';

    const card = document.createElement('div');
    card.className = 'stat-card';

    const themeVar = data.theme || 'primary';

    // 设置卡片样式
    card.style.cssText = `
      background: color-mix(in srgb, var(--theme-bg-primary), transparent var(--theme-glass-transparency));
      backdrop-filter: blur(var(--theme-glass-blur));
      -webkit-backdrop-filter: blur(var(--theme-glass-blur));
      border-radius: 12px;
      padding: 16px 18px;
      border: 1px solid var(--theme-border-primary);
      display: flex;
      flex-direction: column;
      gap: 6px;
      transition: box-shadow 0.2s ease, border-color 0.2s ease;
      position: relative;
      overflow: hidden;
    `;

    // 左侧主题色装饰条
    const accent = document.createElement('div');
    accent.style.cssText = `
      position: absolute;
      top: 0;
      left: 0;
      bottom: 0;
      width: 3px;
      background: var(--theme-${themeVar});
      border-radius: 0 2px 2px 0;
    `;
    card.appendChild(accent);

    // 悬停效果
    if (this.options.enableHover) {
      card.addEventListener('mouseenter', () => {
        card.style.boxShadow = '0 4px 16px var(--theme-shadow-light)';
        card.style.borderColor = 'var(--theme-border-secondary)';
      });
      card.addEventListener('mouseleave', () => {
        card.style.boxShadow = '';
        card.style.borderColor = '';
      });
    }

    // 点击事件
    if (this.options.onClick) {
      card.style.cursor = 'pointer';
      card.addEventListener('click', this.options.onClick);
    }

    // 图标
    if (this.options.showIcon && data.icon) {
      const iconWrapper = document.createElement('div');
      iconWrapper.className = 'stat-card-icon-wrapper';
      iconWrapper.style.cssText = `
        width: 32px;
        height: 32px;
        border-radius: 8px;
        background: var(--theme-${themeVar}-soft);
        display: flex;
        align-items: center;
        justify-content: center;
        margin-bottom: 4px;
      `;

      const icon = document.createElement('div');
      icon.className = 'stat-card-icon';
      icon.textContent = data.icon;
      icon.style.cssText = `
        font-size: 16px;
        color: var(--theme-${themeVar});
      `;
      iconWrapper.appendChild(icon);
      card.appendChild(iconWrapper);
    }

    // 标签
    const label = document.createElement('div');
    label.className = 'stat-card-label';
    label.textContent = data.label;
    label.style.cssText = `
      font-size: 12px;
      color: var(--theme-text-tertiary);
      font-weight: 500;
      letter-spacing: 0.02em;
      text-transform: uppercase;
    `;
    card.appendChild(label);

    // 数值
    const valueWrapper = document.createElement('div');
    valueWrapper.className = 'stat-card-value-wrapper';
    valueWrapper.style.cssText = `
      display: flex;
      align-items: baseline;
      gap: 6px;
    `;

    const value = document.createElement('div');
    value.className = 'stat-card-value';
    value.textContent = String(data.value);
    value.style.cssText = `
      font-size: 24px;
      font-weight: 700;
      color: var(--theme-text-primary);
      line-height: 1.2;
      font-variant-numeric: tabular-nums;
    `;

    valueWrapper.appendChild(value);
    card.appendChild(valueWrapper);

    this.container.appendChild(card);
  }

  /**
   * 更新卡片数据
   */
  update(data: Partial<StatCardData>): void {
    const label = this.container.querySelector('.stat-card-label') as HTMLElement;
    const value = this.container.querySelector('.stat-card-value') as HTMLElement;

    if (data.label && label) {
      label.textContent = data.label;
    }
    if (data.value !== undefined && value) {
      value.textContent = String(data.value);
    }
  }

  /**
   * 销毁组件
   */
  destroy(): void {
    this.container.innerHTML = '';
  }
}
