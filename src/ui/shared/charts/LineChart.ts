/**
 * 折线图组件
 * 支持主题变量、高DPI、平滑曲线、鼠标悬浮交互
 */

import type { LineChartDataPoint, LineChartOptions } from './types.js';

export class LineChart {
  private canvas: HTMLCanvasElement;
  private ctx: CanvasRenderingContext2D;
  private options: Required<LineChartOptions>;
  private data: LineChartDataPoint[] = [];
  private resizeObserver: ResizeObserver;
  private rafId: number | null = null;

  // 交互状态
  private isHovered: boolean = false;
  private ballX: number = 0;
  private ballY: number = 0;
  private tooltipData: LineChartDataPoint | null = null;
  private nearestIdx: number = -1;

  // DOM 弹窗
  private tooltipEl: HTMLDivElement | null = null;

  // 绑定的事件处理器（用于清理）
  private boundMouseEnter: () => void;
  private boundMouseMove: (e: MouseEvent) => void;
  private boundMouseLeave: () => void;
  private boundClick: (e: MouseEvent) => void;

  // 缓存的渲染参数，供交互重绘用
  private cachedParams: {
    padding: { top: number; right: number; bottom: number; left: number };
    chartWidth: number;
    chartHeight: number;
    maxValue: number;
    lineColor: string;
    gridColor: string;
    textColor: string;
  } | null = null;

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

    // 创建 DOM 弹窗
    this.createTooltipElement();

    // 绑定事件处理器
    this.boundMouseEnter = () => this.onMouseEnter();
    this.boundMouseMove = (e) => this.onMouseMove(e);
    this.boundMouseLeave = () => this.onMouseLeave();
    this.boundClick = (e) => this.onClick(e);

    // 监听画布大小变化
    this.resizeObserver = new ResizeObserver(() => {
      this.render(this.data);
    });
    this.resizeObserver.observe(this.canvas);

    // 添加鼠标交互
    this.canvas.addEventListener('mouseenter', this.boundMouseEnter);
    this.canvas.addEventListener('mousemove', this.boundMouseMove);
    this.canvas.addEventListener('mouseleave', this.boundMouseLeave);
    this.canvas.addEventListener('click', this.boundClick);
  }

  /**
   * 创建 DOM 弹窗元素
   */
  private createTooltipElement(): void {
    this.tooltipEl = document.createElement('div');
    this.tooltipEl.className = 'line-chart-tooltip';
    this.tooltipEl.style.cssText = `
      position: fixed;
      pointer-events: none;
      z-index: 10000;
      display: none;
      background: var(--theme-bg-inverse, #2c2c2c);
      color: var(--theme-text-inverse, #ffffff);
      padding: 6px 12px;
      border-radius: 8px;
      font-size: 12px;
      font-family: -apple-system, "PingFang SC", sans-serif;
      font-weight: 500;
      white-space: nowrap;
      box-shadow: 0 4px 16px rgba(0,0,0,0.25);
      transform: translate(-50%, -100%);
      line-height: 1.4;
    `;

    // 小三角箭头
    const arrow = document.createElement('div');
    arrow.style.cssText = `
      position: absolute;
      bottom: -5px;
      left: 50%;
      transform: translateX(-50%) rotate(45deg);
      width: 10px;
      height: 10px;
      background: var(--theme-bg-inverse, #2c2c2c);
      border-radius: 2px;
    `;
    this.tooltipEl.appendChild(arrow);

    document.body.appendChild(this.tooltipEl);
  }

  /**
   * 解析CSS变量为实际颜色值
   */
  private resolveColor(color: string): string {
    if (color.startsWith('var(')) {
      const varName = color.slice(4, -1).trim();
      return getComputedStyle(document.documentElement).getPropertyValue(varName).trim() || '#8b9dc3';
    }
    return color;
  }

  /**
   * 将十六进制颜色转换为rgba格式
   */
  private hexToRgba(hex: string, alpha: number): string {
    hex = hex.replace('#', '');
    if (hex.length === 3) {
      hex = hex.split('').map(c => c + c).join('');
    }
    const r = parseInt(hex.slice(0, 2), 16);
    const g = parseInt(hex.slice(2, 4), 16);
    const b = parseInt(hex.slice(4, 6), 16);
    return `rgba(${r}, ${g}, ${b}, ${alpha})`;
  }

  /**
   * 贝塞尔曲线求值：给定 t ∈ [0,1]，返回曲线上点的坐标
   * 控制点方案：共享中点 X，CP1.y = P0.y, CP2.y = P1.y
   */
  private evaluateBezier(
    t: number,
    x0: number, y0: number,
    x1: number, y1: number
  ): { x: number; y: number } {
    const midX = (x0 + x1) / 2;
    const u = 1 - t;

    // X(t) = (1-t)³·x0 + 3t(1-t)·midX + t³·x1
    const x = u * u * u * x0 + 3 * t * u * midX + t * t * t * x1;

    // Y(t) = (1-t)³·y0 + 3(1-t)²t·y0 + 3(1-t)t²·y1 + t³·y1
    // 简化: (1-t)²(1+2t)·y0 + t²(3-2t)·y1
    const y = u * u * (1 + 2 * t) * y0 + t * t * (3 - 2 * t) * y1;

    return { x, y };
  }

  /**
   * 二分查找 t 使得 X(t) ≈ targetX
   */
  private findBezierT(
    targetX: number,
    x0: number, x1: number
  ): number {
    const midX = (x0 + x1) / 2;
    let low = 0, high = 1;

    for (let iter = 0; iter < 30; iter++) {
      const t = (low + high) / 2;
      const u = 1 - t;
      const xt = u * u * u * x0 + 3 * t * u * midX + t * t * t * x1;
      if (xt < targetX) low = t;
      else high = t;
    }
    return (low + high) / 2;
  }

  /**
   * 获取鼠标 X 在曲线上的精确位置
   */
  private getCurvePosition(
    mouseX: number,
    data: LineChartDataPoint[],
    chartWidth: number,
    chartHeight: number,
    padding: { top: number; right: number; bottom: number; left: number },
    maxValue: number
  ): { bx: number; by: number; nearestIdx: number; nearestPoint: LineChartDataPoint } | null {
    if (data.length === 0) return null;

    const stepX = chartWidth / (data.length - 1 || 1);

    // 处理边界：鼠标在第一个点左边或最后一个点右边
    if (mouseX <= padding.left) {
      const x = padding.left;
      const y = padding.top + chartHeight - (data[0].value / maxValue) * chartHeight;
      return { bx: x, by: y, nearestIdx: 0, nearestPoint: data[0] };
    }
    if (mouseX >= padding.left + chartWidth) {
      const x = padding.left + chartWidth;
      const y = padding.top + chartHeight - (data[data.length - 1].value / maxValue) * chartHeight;
      return { bx: x, by: y, nearestIdx: data.length - 1, nearestPoint: data[data.length - 1] };
    }

    // 找到鼠标落在哪两个点之间
    let segIdx = 0;
    for (let i = 0; i < data.length - 1; i++) {
      const px = padding.left + stepX * i;
      if (mouseX >= px) {
        segIdx = i;
      }
    }

    const x0 = padding.left + stepX * segIdx;
    const x1 = x0 + stepX;
    const y0 = padding.top + chartHeight - (data[segIdx].value / maxValue) * chartHeight;
    const y1 = padding.top + chartHeight - (data[segIdx + 1].value / maxValue) * chartHeight;

    // 二分查找 t，然后计算精确 Y
    let t: number;
    if (mouseX <= x0) t = 0;
    else if (mouseX >= x1) t = 1;
    else t = this.findBezierT(mouseX, x0, x1);

    const pos = this.evaluateBezier(t, x0, y0, x1, y1);

    // 确定最近的数据点（用于弹窗显示）
    const midT = 0.5;
    let nearestIdx: number;
    if (t <= midT || segIdx === data.length - 2 && t <= 1) {
      nearestIdx = t <= midT ? segIdx : segIdx;
    } else {
      nearestIdx = segIdx + 1;
    }
    // 更精确：比较到两个端点的 X 距离
    const distToPrev = Math.abs(mouseX - x0);
    const distToNext = Math.abs(mouseX - x1);
    nearestIdx = distToPrev <= distToNext ? segIdx : Math.min(segIdx + 1, data.length - 1);

    return {
      bx: pos.x,
      by: pos.y,
      nearestIdx,
      nearestPoint: data[nearestIdx]
    };
  }

  /**
   * 渲染折线图
   */
  render(data: LineChartDataPoint[]): void {
    this.data = data;

    // 设置画布尺寸（高DPI）
    const rect = this.canvas.getBoundingClientRect();
    const dpr = window.devicePixelRatio || 1;
    this.canvas.width = rect.width * dpr;
    this.canvas.height = rect.height * dpr;
    this.ctx.scale(dpr, dpr);

    const width = rect.width;
    const height = rect.height;
    const padding = { top: 20, right: 20, bottom: 32, left: 52 };
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

    // 解析主题颜色
    const lineColor = this.resolveColor(this.options.lineColor);
    const gridColor = this.resolveColor(this.options.gridColor);
    const textColor = this.resolveColor('--theme-text-tertiary');

    // 缓存渲染参数
    this.cachedParams = { padding, chartWidth, chartHeight, maxValue, lineColor, gridColor, textColor };

    // 绘制网格线和Y轴标签
    this.drawGridLines(chartHeight, chartWidth, padding, maxValue, gridColor, textColor);

    // 绘制X轴标签
    this.drawXAxisLabels(data, chartWidth, chartHeight, padding, textColor);

    // 绘制渐变填充区域
    this.drawArea(data, chartWidth, chartHeight, padding, maxValue, lineColor);

    // 绘制折线
    this.drawLine(data, chartWidth, chartHeight, padding, maxValue, lineColor);

    // 绘制数据点
    if (this.options.showPoints) {
      this.drawPoints(data, chartWidth, chartHeight, padding, maxValue, lineColor);
    }

    // 绘制悬浮指示器（小球 + 竖线）
    if (this.isHovered && this.data.length > 0) {
      this.drawHoverIndicator(padding, lineColor);
    }
  }

  /**
   * 绘制悬浮指示器
   */
  private drawHoverIndicator(
    padding: { top: number; right: number; bottom: number; left: number },
    lineColor: string
  ): void {
    const { bx, by } = { bx: this.ballX, by: this.ballY };

    // 竖直虚线
    this.ctx.strokeStyle = this.hexToRgba(lineColor, 0.3);
    this.ctx.lineWidth = 1;
    this.ctx.setLineDash([4, 4]);
    this.ctx.beginPath();
    this.ctx.moveTo(bx, padding.top);
    this.ctx.lineTo(bx, padding.top + this.cachedParams!.chartHeight);
    this.ctx.stroke();
    this.ctx.setLineDash([]);

    // 外发光
    const glowGradient = this.ctx.createRadialGradient(bx, by, 0, bx, by, 14);
    glowGradient.addColorStop(0, this.hexToRgba(lineColor, 0.25));
    glowGradient.addColorStop(1, this.hexToRgba(lineColor, 0));
    this.ctx.fillStyle = glowGradient;
    this.ctx.beginPath();
    this.ctx.arc(bx, by, 14, 0, Math.PI * 2);
    this.ctx.fill();

    // 白色外圈
    this.ctx.shadowColor = this.hexToRgba(lineColor, 0.3);
    this.ctx.shadowBlur = 8;
    this.ctx.shadowOffsetX = 0;
    this.ctx.shadowOffsetY = 2;
    this.ctx.fillStyle = '#ffffff';
    this.ctx.beginPath();
    this.ctx.arc(bx, by, 8, 0, Math.PI * 2);
    this.ctx.fill();

    // 主题色内圈
    this.ctx.shadowColor = 'transparent';
    this.ctx.shadowBlur = 0;
    this.ctx.fillStyle = lineColor;
    this.ctx.beginPath();
    this.ctx.arc(bx, by, 5, 0, Math.PI * 2);
    this.ctx.fill();
  }

  /**
   * 更新 DOM 弹窗位置和内容
   */
  private updateTooltip(data: LineChartDataPoint, canvasX: number, canvasY: number): void {
    if (!this.tooltipEl) return;

    const canvasRect = this.canvas.getBoundingClientRect();
    const pageX = canvasRect.left + canvasX;
    const pageY = canvasRect.top + canvasY;

    const valueText = this.formatSeconds(data.value);
    this.tooltipEl.textContent = `${data.label}  ${valueText}`;

    // 重新添加箭头（textContent 会清除子元素）
    const arrow = document.createElement('div');
    arrow.style.cssText = `
      position: absolute;
      bottom: -5px;
      left: 50%;
      transform: translateX(-50%) rotate(45deg);
      width: 10px;
      height: 10px;
      background: var(--theme-bg-inverse, #2c2c2c);
      border-radius: 2px;
    `;
    this.tooltipEl.appendChild(arrow);

    // 定位：弹窗在球上方，水平居中
    // 使用 transform: translate(-50%, calc(-100% - 12px)) 让弹窗在球上方偏移 12px
    this.tooltipEl.style.transform = 'translate(-50%, calc(-100% - 12px))';
    this.tooltipEl.style.left = `${pageX}px`;
    this.tooltipEl.style.top = `${pageY}px`;
    this.tooltipEl.style.display = 'block';
  }

  /**
   * 隐藏弹窗
   */
  private hideTooltip(): void {
    if (this.tooltipEl) {
      this.tooltipEl.style.display = 'none';
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
    gridColor: string,
    textColor: string
  ): void {
    const gridCount = 4;

    for (let i = 0; i <= gridCount; i++) {
      const y = padding.top + (chartHeight / gridCount) * i;

      // 网格线
      this.ctx.strokeStyle = this.hexToRgba(gridColor, 0.5);
      this.ctx.lineWidth = 1;
      this.ctx.beginPath();
      this.ctx.moveTo(padding.left, y);
      this.ctx.lineTo(padding.left + chartWidth, y);
      this.ctx.stroke();

      // Y轴标签
      const value = maxValue - (maxValue / gridCount) * i;
      this.ctx.fillStyle = textColor;
      this.ctx.font = '11px -apple-system, "PingFang SC", sans-serif';
      this.ctx.textAlign = 'right';
      this.ctx.textBaseline = 'middle';
      this.ctx.fillText(this.formatSeconds(value), padding.left - 8, y);
    }
  }

  /**
   * 绘制X轴标签
   */
  private drawXAxisLabels(
    data: LineChartDataPoint[],
    chartWidth: number,
    chartHeight: number,
    padding: { top: number; right: number; bottom: number; left: number },
    textColor: string
  ): void {
    this.ctx.textAlign = 'center';
    this.ctx.textBaseline = 'top';
    this.ctx.fillStyle = textColor;
    this.ctx.font = '11px -apple-system, "PingFang SC", sans-serif';

    const stepX = chartWidth / (data.length - 1 || 1);
    const maxLabels = Math.max(1, Math.floor(chartWidth / 55));
    const step = Math.max(1, Math.ceil(data.length / maxLabels));

    for (let i = 0; i < data.length; i += step) {
      const x = padding.left + stepX * i;
      this.ctx.fillText(data[i].label, x, padding.top + chartHeight + 8);
    }
    // 保证最后一个标签显示
    if ((data.length - 1) % step !== 0) {
      this.ctx.fillText(
        data[data.length - 1].label,
        padding.left + chartWidth,
        padding.top + chartHeight + 8
      );
    }
  }

  /**
   * 绘制渐变填充区域
   */
  private drawArea(
    data: LineChartDataPoint[],
    chartWidth: number,
    chartHeight: number,
    padding: { top: number; right: number; bottom: number; left: number },
    maxValue: number,
    lineColor: string
  ): void {
    const stepX = chartWidth / (data.length - 1 || 1);

    const gradient = this.ctx.createLinearGradient(0, padding.top, 0, padding.top + chartHeight);
    gradient.addColorStop(0, this.hexToRgba(lineColor, 0.15));
    gradient.addColorStop(0.5, this.hexToRgba(lineColor, 0.06));
    gradient.addColorStop(1, this.hexToRgba(lineColor, 0));

    this.ctx.fillStyle = gradient;
    this.ctx.beginPath();
    this.ctx.moveTo(padding.left, padding.top + chartHeight);
    this.traceSmoothPath(data, chartWidth, chartHeight, padding, maxValue, stepX);
    this.ctx.lineTo(padding.left + chartWidth, padding.top + chartHeight);
    this.ctx.closePath();
    this.ctx.fill();
  }

  /**
   * 绘制平滑曲线路径
   */
  private traceSmoothPath(
    data: LineChartDataPoint[],
    chartWidth: number,
    chartHeight: number,
    padding: { top: number; right: number; bottom: number; left: number },
    maxValue: number,
    stepX: number
  ): void {
    for (let i = 0; i < data.length; i++) {
      const x = padding.left + stepX * i;
      const y = padding.top + chartHeight - (data[i].value / maxValue) * chartHeight;

      if (i === 0) {
        this.ctx.moveTo(x, y);
      } else {
        const prevX = padding.left + stepX * (i - 1);
        const prevY = padding.top + chartHeight - (data[i - 1].value / maxValue) * chartHeight;
        const cpx = prevX + (x - prevX) / 2;
        this.ctx.bezierCurveTo(cpx, prevY, cpx, y, x, y);
      }
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
    maxValue: number,
    lineColor: string
  ): void {
    const stepX = chartWidth / (data.length - 1 || 1);

    this.ctx.strokeStyle = lineColor;
    this.ctx.lineWidth = 2.5;
    this.ctx.lineCap = 'round';
    this.ctx.lineJoin = 'round';

    this.ctx.shadowColor = this.hexToRgba(lineColor, 0.3);
    this.ctx.shadowBlur = 8;
    this.ctx.shadowOffsetX = 0;
    this.ctx.shadowOffsetY = 2;

    this.ctx.beginPath();
    this.traceSmoothPath(data, chartWidth, chartHeight, padding, maxValue, stepX);
    this.ctx.stroke();

    this.ctx.shadowColor = 'transparent';
    this.ctx.shadowBlur = 0;
    this.ctx.shadowOffsetX = 0;
    this.ctx.shadowOffsetY = 0;
  }

  /**
   * 绘制数据点
   */
  private drawPoints(
    data: LineChartDataPoint[],
    chartWidth: number,
    chartHeight: number,
    padding: { top: number; right: number; bottom: number; left: number },
    maxValue: number,
    lineColor: string
  ): void {
    const stepX = chartWidth / (data.length - 1 || 1);

    for (let i = 0; i < data.length; i++) {
      const x = padding.left + stepX * i;
      const y = padding.top + chartHeight - (data[i].value / maxValue) * chartHeight;

      this.ctx.shadowColor = this.hexToRgba(lineColor, 0.2);
      this.ctx.shadowBlur = 4;
      this.ctx.shadowOffsetX = 0;
      this.ctx.shadowOffsetY = 1;

      this.ctx.fillStyle = '#ffffff';
      this.ctx.beginPath();
      this.ctx.arc(x, y, 5, 0, Math.PI * 2);
      this.ctx.fill();

      this.ctx.shadowColor = 'transparent';
      this.ctx.shadowBlur = 0;
      this.ctx.fillStyle = lineColor;
      this.ctx.beginPath();
      this.ctx.arc(x, y, 3, 0, Math.PI * 2);
      this.ctx.fill();
    }
  }

  /**
   * 绘制空状态
   */
  private drawEmptyState(width: number, height: number): void {
    const textColor = this.resolveColor('--theme-text-tertiary');
    this.ctx.fillStyle = textColor;
    this.ctx.font = '14px -apple-system, "PingFang SC", sans-serif';
    this.ctx.textAlign = 'center';
    this.ctx.textBaseline = 'middle';
    this.ctx.fillText('暂无数据', width / 2, height / 2);
  }

  /**
   * 鼠标进入
   */
  private onMouseEnter(): void {
    this.isHovered = true;
  }

  /**
   * 鼠标移动处理（连续贝塞尔曲线插值）
   */
  private onMouseMove(e: MouseEvent): void {
    if (!this.cachedParams || this.data.length === 0) return;

    const rect = this.canvas.getBoundingClientRect();
    const mouseX = e.clientX - rect.left;

    const { padding, chartWidth, chartHeight, maxValue } = this.cachedParams;

    const result = this.getCurvePosition(
      mouseX, this.data, chartWidth, chartHeight, padding, maxValue
    );

    if (!result) return;

    const { bx, by, nearestIdx, nearestPoint } = result;

    // 如果位置没变化，不重绘
    if (Math.abs(bx - this.ballX) < 0.5 && nearestIdx === this.nearestIdx) return;

    this.ballX = bx;
    this.ballY = by;
    this.nearestIdx = nearestIdx;
    this.tooltipData = nearestPoint;

    // 更新 DOM 弹窗
    this.updateTooltip(nearestPoint, bx, by);

    // 重绘画布
    if (this.rafId === null) {
      this.rafId = requestAnimationFrame(() => {
        this.rafId = null;
        this.render(this.data);
      });
    }
  }

  /**
   * 鼠标离开
   */
  private onMouseLeave(): void {
    this.isHovered = false;
    this.nearestIdx = -1;
    this.hideTooltip();

    if (this.rafId !== null) {
      cancelAnimationFrame(this.rafId);
      this.rafId = null;
    }
    this.render(this.data);
  }

  /**
   * 点击处理
   */
  private onClick(e: MouseEvent): void {
    if (!this.options.showTooltip || this.data.length === 0) return;

    const rect = this.canvas.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;

    if (!this.cachedParams) return;
    const { padding, chartWidth, chartHeight, maxValue } = this.cachedParams;
    const stepX = chartWidth / (this.data.length - 1 || 1);

    let closestIndex = -1;
    let closestDistance = Infinity;

    for (let i = 0; i < this.data.length; i++) {
      const pointX = padding.left + stepX * i;
      const pointY = padding.top + chartHeight - (this.data[i].value / maxValue) * chartHeight;
      const distance = Math.sqrt((x - pointX) ** 2 + (y - pointY) ** 2);

      if (distance < closestDistance && distance < 10) {
        closestDistance = distance;
        closestIndex = i;
      }
    }

    if (closestIndex !== -1) {
      this.options.onPointClick(this.data[closestIndex]);
    }
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
    this.canvas.removeEventListener('mouseenter', this.boundMouseEnter);
    this.canvas.removeEventListener('mousemove', this.boundMouseMove);
    this.canvas.removeEventListener('mouseleave', this.boundMouseLeave);
    this.canvas.removeEventListener('click', this.boundClick);
    if (this.rafId !== null) {
      cancelAnimationFrame(this.rafId);
    }
    if (this.tooltipEl && this.tooltipEl.parentNode) {
      this.tooltipEl.parentNode.removeChild(this.tooltipEl);
    }
  }
}
