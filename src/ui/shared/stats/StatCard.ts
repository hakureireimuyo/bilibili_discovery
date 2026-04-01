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

    // 设置卡片样式
    card.style.background = 'linear-gradient(145deg, var(--theme-bg-secondary) 0%, var(--theme-bg-tertiary) 100%)';
    card.style.borderRadius = '16px';
    card.style.padding = '20px';
    card.style.border = `1px solid var(--theme-border-primary)`;
    card.style.display = 'flex';
    card.style.flexDirection = 'column';
    card.style.gap = '12px';
    card.style.transition = 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)';
    card.style.position = 'relative';
    card.style.overflow = 'hidden';

    // 添加顶部装饰条
    const topBar = document.createElement('div');
    topBar.style.cssText = `
      position: absolute;
      top: 0;
      left: 0;
      right: 0;
      height: 3px;
      background: linear-gradient(90deg, var(--theme-${data.theme || 'primary'}) 0%, var(--theme-secondary) 100%);
      opacity: 0.8;
    `;
    card.appendChild(topBar);

    // 悬停效果
    if (this.options.enableHover) {
      card.addEventListener('mouseenter', () => {
        card.style.transform = 'translateY(-4px) scale(1.02)';
        card.style.boxShadow = '0 8px 24px var(--theme-shadow-medium), 0 0 0 1px var(--theme-border-secondary)';
      });
      card.addEventListener('mouseleave', () => {
        card.style.transform = '';
        card.style.boxShadow = '';
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
        width: 48px;
        height: 48px;
        border-radius: 12px;
        background: linear-gradient(135deg, var(--theme-${data.theme || 'primary'}) 0%, var(--theme-secondary) 100%);
        display: flex;
        align-items: center;
        justify-content: center;
        margin-bottom: 4px;
        box-shadow: 0 4px 12px var(--theme-shadow-light);
      `;

      const icon = document.createElement('div');
      icon.className = 'stat-card-icon';
      icon.textContent = data.icon;
      icon.style.cssText = `
        font-size: 24px;
        color: var(--theme-text-inverse);
      `;
      iconWrapper.appendChild(icon);
      card.appendChild(iconWrapper);
    }

    // 标签
    const label = document.createElement('div');
    label.className = 'stat-card-label';
    label.textContent = data.label;
    label.style.cssText = `
      font-size: 14px;
      color: var(--theme-text-secondary);
      font-weight: 500;
      letter-spacing: 0.3px;
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
      font-size: 28px;
      font-weight: 700;
      background: linear-gradient(135deg, var(--theme-${data.theme || 'primary'}) 0%, var(--theme-secondary) 100%);
      -webkit-background-clip: text;
      -webkit-text-fill-color: transparent;
      background-clip: text;
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
