/**
 * 折线图组件
 * 用于展示趋势数据的折线图
 */

import type { LineChartDataPoint, LineChartOptions } from './types.js';

export class LineChart {
  private canvas: HTMLCanvasElement;
  private ctx: CanvasRenderingContext2D;
  private options: Required<LineChartOptions>;
  private data: LineChartDataPoint[] = [];
  private resizeObserver: ResizeObserver;

  constructor(canvas: HTMLCanvasElement | string, options: LineChartOptions = {}) {
    this.canvas = typeof canvas === 'string'
      ? document.getElementById(canvas)! as HTMLCanvasElement
      : canvas;

    const ctx = this.canvas.getContext('2d');
    if (!ctx) {
      throw new Error('无法获取Canvas上下文');
    }
    this.ctx = ctx;

    // 设置默认选项
    this.options = {
      title: options.title ?? '',
      maxValue: options.maxValue ?? 0,
      lineColor: options.lineColor ?? 'var(--theme-primary)',
      pointColor: options.pointColor ?? 'var(--theme-primary)',
      gridColor: options.gridColor ?? 'var(--theme-border-primary)',
      showPoints: options.showPoints ?? true,
      showTooltip: options.showTooltip ?? true,
      onPointClick: options.onPointClick ?? (() => {})
    };

    // 监听画布大小变化
    this.resizeObserver = new ResizeObserver(() => {
      this.render(this.data);
    });
    this.resizeObserver.observe(this.canvas);

    // 添加鼠标交互
    this.setupInteraction();
  }

  /**
   * 渲染折线图
   */
  render(data: LineChartDataPoint[]): void {
    this.data = data;

    // 设置画布尺寸
    const rect = this.canvas.getBoundingClientRect();
    const dpr = window.devicePixelRatio || 1;
    this.canvas.width = rect.width * dpr;
    this.canvas.height = rect.height * dpr;
    this.ctx.scale(dpr, dpr);

    const width = rect.width;
    const height = rect.height;
    const padding = { top: 20, right: 20, bottom: 30, left: 50 };
    const chartWidth = width - padding.left - padding.right;
    const chartHeight = height - padding.top - padding.bottom;

    // 清空画布
    this.ctx.clearRect(0, 0, width, height);

    if (data.length === 0) {
      this.drawEmptyState(width, height);
      return;
    }

    // 计算数据范围
    const maxValue = this.options.maxValue || Math.max(...data.map(d => d.value), 1);
    const minValue = 0;

    // 绘制网格线和Y轴标签
    this.drawGridLines(chartHeight, chartWidth, padding, maxValue, minValue);

    // 绘制X轴标签
    this.drawXAxisLabels(data, chartWidth, chartHeight, padding);

    // 绘制折线
    this.drawLine(data, chartWidth, chartHeight, padding, maxValue);

    // 绘制数据点
    if (this.options.showPoints) {
      this.drawPoints(data, chartWidth, chartHeight, padding, maxValue);
    }
  }

  /**
   * 绘制网格线和Y轴标签
   */
  private drawGridLines(
    chartHeight: number,
    chartWidth: number,
    padding: { top: number; right: number; bottom: number; left: number },
    maxValue: number,
    minValue: number
  ): void {
    const gridCount = 4;
    this.ctx.strokeStyle = this.options.gridColor;
    this.ctx.lineWidth = 1;

    for (let i = 0; i <= gridCount; i++) {
      const y = padding.top + (chartHeight / gridCount) * i;

      // 绘制网格线
      this.ctx.beginPath();
      this.ctx.moveTo(padding.left, y);
      this.ctx.lineTo(this.canvas.width / window.devicePixelRatio - padding.right, y);
      this.ctx.stroke();

      // 绘制Y轴标签
      const value = maxValue - (maxValue / gridCount) * i;
      this.ctx.fillStyle = 'var(--theme-text-secondary)';
      this.ctx.font = '12px sans-serif';
      this.ctx.textAlign = 'right';
      this.ctx.fillText(this.formatSeconds(value), padding.left - 10, y + 4);
    }
  }

  /**
   * 绘制X轴标签
   */
  private drawXAxisLabels(
    data: LineChartDataPoint[],
    chartWidth: number,
    chartHeight: number,
    padding: { top: number; right: number; bottom: number; left: number }
  ): void {
    this.ctx.textAlign = 'center';
    this.ctx.fillStyle = 'var(--theme-text-secondary)';
    this.ctx.font = '12px sans-serif';

    const stepX = chartWidth / (data.length - 1 || 1);

    for (let i = 0; i < data.length; i++) {
      const x = padding.left + stepX * i;
      const label = data[i].label;
      this.ctx.fillText(label, x, this.canvas.height / window.devicePixelRatio - padding.bottom + 20);
    }
  }

  /**
   * 绘制折线
   */
  private drawLine(
    data: LineChartDataPoint[],
    chartWidth: number,
    chartHeight: number,
    padding: { top: number; right: number; bottom: number; left: number },
    maxValue: number
  ): void {
    const stepX = chartWidth / (data.length - 1 || 1);

    this.ctx.strokeStyle = this.options.lineColor;
    this.ctx.lineWidth = 2;
    this.ctx.beginPath();

    for (let i = 0; i < data.length; i++) {
      const x = padding.left + stepX * i;
      const y = padding.top + chartHeight - (data[i].value / maxValue) * chartHeight;

      if (i === 0) {
        this.ctx.moveTo(x, y);
      } else {
        this.ctx.lineTo(x, y);
      }
    }
    this.ctx.stroke();
  }

  /**
   * 绘制数据点
   */
  private drawPoints(
    data: LineChartDataPoint[],
    chartWidth: number,
    chartHeight: number,
    padding: { top: number; right: number; bottom: number; left: number },
    maxValue: number
  ): void {
    const stepX = chartWidth / (data.length - 1 || 1);

    this.ctx.fillStyle = this.options.pointColor;

    for (let i = 0; i < data.length; i++) {
      const x = padding.left + stepX * i;
      const y = padding.top + chartHeight - (data[i].value / maxValue) * chartHeight;

      this.ctx.beginPath();
      this.ctx.arc(x, y, 4, 0, Math.PI * 2);
      this.ctx.fill();
    }
  }

  /**
   * 绘制空状态
   */
  private drawEmptyState(width: number, height: number): void {
    this.ctx.fillStyle = 'var(--theme-text-tertiary)';
    this.ctx.font = '14px sans-serif';
    this.ctx.textAlign = 'center';
    this.ctx.fillText('暂无数据', width / 2, height / 2);
  }

  /**
   * 设置鼠标交互
   */
  private setupInteraction(): void {
    this.canvas.addEventListener('click', (e) => {
      if (!this.options.showTooltip || this.data.length === 0) return;

      const rect = this.canvas.getBoundingClientRect();
      const x = e.clientX - rect.left;
      const y = e.clientY - rect.top;

      const padding = { top: 20, right: 20, bottom: 30, left: 50 };
      const chartWidth = rect.width - padding.left - padding.right;
      const chartHeight = rect.height - padding.top - padding.bottom;
      const stepX = chartWidth / (this.data.length - 1 || 1);
      const maxValue = this.options.maxValue || Math.max(...this.data.map(d => d.value), 1);

      // 查找最近的数据点
      let closestIndex = -1;
      let closestDistance = Infinity;

      for (let i = 0; i < this.data.length; i++) {
        const pointX = padding.left + stepX * i;
        const pointY = padding.top + chartHeight - (this.data[i].value / maxValue) * chartHeight;
        const distance = Math.sqrt((x - pointX) ** 2 + (y - pointY) ** 2);

        if (distance < closestDistance && distance < 10) { // 10px点击范围
          closestDistance = distance;
          closestIndex = i;
        }
      }

      if (closestIndex !== -1) {
        this.options.onPointClick(this.data[closestIndex]);
      }
    });
  }

  /**
   * 格式化秒数为 HH:MM:SS 格式
   */
  private formatSeconds(total: number): string {
    const safe = Math.max(0, Math.floor(total));
    const hours = Math.floor(safe / 3600);
    const minutes = Math.floor((safe % 3600) / 60);
    const seconds = safe % 60;
    return `${hours}:${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;
  }

  /**
   * 销毁组件
   */
  destroy(): void {
    this.resizeObserver.disconnect();
    this.canvas.removeEventListener('click', () => {});
  }
}
