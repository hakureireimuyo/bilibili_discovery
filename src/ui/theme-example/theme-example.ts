
/**
 * 主题示例页面逻辑
 * 展示如何在页面中使用主题管理器
 */

import { themeManager, initThemedPage } from '../../themes/index.js';

/**
 * 主题示例页面类
 */
class ThemeExamplePage {
  private themeChangeListener: (theme: any) => void;

  constructor() {
    initThemedPage('theme-example');

    // 初始化主题变更监听器
    this.themeChangeListener = (theme) => {
      console.log('主题已切换:', theme);
      // 这里可以添加主题变更后的处理逻辑
      // 例如：更新图表颜色、重新渲染某些组件等
    };

    // 初始化页面
    this.init();
  }

  /**
   * 初始化页面
   */
  private init(): void {
    // 注册主题变更监听器
    themeManager.addChangeListener(this.themeChangeListener);

    // 应用当前主题
    this.applyCurrentTheme();

    // 添加示例交互
    this.addExampleInteractions();
  }

  /**
   * 应用当前主题
   */
  private applyCurrentTheme(): void {
    // 获取当前主题
    const currentTheme = themeManager.getCurrentTheme();
    console.log('当前主题:', currentTheme);

    // 主题变量已经通过主题管理器自动应用到DOM中
    // 这里可以添加额外的主题应用逻辑
    // 例如：更新图表颜色、重新渲染某些组件等
  }

  /**
   * 添加示例交互
   */
  private addExampleInteractions(): void {
    // 为所有按钮添加点击事件
    const buttons = document.querySelectorAll('.btn');
    buttons.forEach(button => {
      const btn = button as HTMLElement;
      btn.addEventListener('click', () => {
        console.log('按钮被点击:', btn.textContent);
      });
    });

    // 为输入框添加输入事件
    const inputs = document.querySelectorAll('.form-input');
    inputs.forEach(input => {
      const inputEl = input as HTMLInputElement;
      inputEl.addEventListener('input', (e) => {
        console.log('输入内容:', inputEl.value);
      });
    });
  }

  /**
   * 销毁页面
   */
  public destroy(): void {
    // 移除主题变更监听器
    themeManager.removeChangeListener(this.themeChangeListener);
  }
}

// 页面加载完成后初始化
document.addEventListener('DOMContentLoaded', () => {
  const page = new ThemeExamplePage();

  // 页面卸载时清理
  window.addEventListener('beforeunload', () => {
    page.destroy();
  });
});
