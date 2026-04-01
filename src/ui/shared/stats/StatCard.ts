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
    card.style.background = 'var(--theme-bg-secondary)';
    card.style.borderRadius = '12px';
    card.style.padding = '16px';
    card.style.border = `1px solid var(--theme-border-primary)`;
    card.style.display = 'flex';
    card.style.flexDirection = 'column';
    card.style.gap = '8px';
    card.style.transition = 'transform 0.2s ease, box-shadow 0.2s ease';

    // 悬停效果
    if (this.options.enableHover) {
      card.addEventListener('mouseenter', () => {
        card.style.transform = 'translateY(-2px)';
        card.style.boxShadow = '0 6px 20px var(--theme-shadow-light)';
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
      const icon = document.createElement('div');
      icon.className = 'stat-card-icon';
      icon.textContent = data.icon;
      icon.style.fontSize = '24px';
      icon.style.marginBottom = '4px';
      card.appendChild(icon);
    }

    // 标签
    const label = document.createElement('div');
    label.className = 'stat-card-label';
    label.textContent = data.label;
    label.style.fontSize = '14px';
    label.style.color = 'var(--theme-text-secondary)';
    label.style.fontWeight = '500';
    card.appendChild(label);

    // 数值
    const value = document.createElement('div');
    value.className = 'stat-card-value';
    value.textContent = String(data.value);
    value.style.fontSize = '24px';
    value.style.fontWeight = '700';

    // 根据主题设置颜色
    if (data.theme) {
      value.style.color = `var(--theme-${data.theme})`;
    } else {
      value.style.color = 'var(--theme-text-primary)';
    }

    card.appendChild(value);

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
