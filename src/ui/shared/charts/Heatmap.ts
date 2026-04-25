/**
 * 热力图组件
 * 用于展示年度观看数据的热力图，类似GitHub贡献图
 */

import type { HeatmapDataPoint, HeatmapOptions } from './types.js';

export class Heatmap {
  private container: HTMLElement;
  private options: Required<HeatmapOptions>;
  private todayKey: string;

  constructor(container: HTMLElement | string, options: HeatmapOptions = {}) {
    this.container = typeof container === 'string'
      ? document.getElementById(container)!
      : container;

    // 设置默认选项
    this.options = {
      maxSeconds: options.maxSeconds ?? 8 * 3600, // 默认8小时
      showTodayMarker: options.showTodayMarker ?? true,
      showTooltip: options.showTooltip ?? true,
      onCellClick: options.onCellClick ?? (() => {}),
      viewMode: 'year'
    };

    // 获取今天的日期
    const now = new Date();
    this.todayKey = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
  }

  /**
   * 渲染热力图
   */
  render(data: HeatmapDataPoint[]): void {
    this.container.innerHTML = '';
    this.renderYearView(data);
  }

  /**
   * 渲染年度视图
   */
  private renderYearView(data: HeatmapDataPoint[]): void {
    const now = new Date();
    const currentYear = now.getFullYear();

    // 创建主容器
    const mainContainer = document.createElement('div');
    mainContainer.style.position = 'relative';
    mainContainer.style.width = '100%';
    mainContainer.style.height = '100%';
    mainContainer.style.paddingLeft = '30px';
    mainContainer.style.paddingTop = '25px';
    mainContainer.style.display = 'flex';
    mainContainer.style.flexDirection = 'column';

    // 创建信息显示区域
    const infoContainer = document.createElement('div');
    infoContainer.className = 'heatmap-info-display';

    const dateLabel = document.createElement('span');
    dateLabel.textContent = '日期: ';
    const dateValue = document.createElement('span');
    dateValue.id = 'heatmap-date';
    dateValue.textContent = '请选择日期';

    const timeLabel = document.createElement('span');
    timeLabel.textContent = '观看时长: ';
    const timeValue = document.createElement('span');
    timeValue.id = 'heatmap-time';
    timeValue.textContent = '--:--:--';

    infoContainer.appendChild(dateLabel);
    infoContainer.appendChild(dateValue);
    infoContainer.appendChild(timeLabel);
    infoContainer.appendChild(timeValue);

    mainContainer.appendChild(infoContainer);

    // 添加星期标签
    const dayLabels = ['Mon', '', 'Wed', '', 'Fri', '', ''];
    const dayLabelsContainer = document.createElement('div');
    dayLabelsContainer.style.position = 'absolute';
    dayLabelsContainer.style.left = '0';
    dayLabelsContainer.style.top = '25px';
    dayLabelsContainer.style.height = 'calc(100% - 25px)';
    dayLabelsContainer.style.display = 'flex';
    dayLabelsContainer.style.flexDirection = 'column';
    dayLabelsContainer.style.justifyContent = 'space-between';
    dayLabelsContainer.style.paddingTop = '5px';
    
    dayLabels.forEach((label, index) => {
      if (label) {
        const dayLabel = document.createElement('div');
        dayLabel.className = 'heatmap-day-label';
        dayLabel.textContent = label;
        dayLabel.style.position = 'relative';
        dayLabelsContainer.appendChild(dayLabel);
      }
    });
    
    mainContainer.appendChild(dayLabelsContainer);

    // 添加月份标签
    const monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
    const startDate = new Date(currentYear, 0, 1);
    const endDate = new Date(currentYear, 11, 31);
    const totalWeeks = this.getWeekNumber(endDate) + 1;

    const monthLabelsContainer = document.createElement('div');
    monthLabelsContainer.style.position = 'absolute';
    monthLabelsContainer.style.left = '30px';
    monthLabelsContainer.style.top = '0';
    monthLabelsContainer.style.width = 'calc(100% - 30px)';
    monthLabelsContainer.style.height = '20px';
    monthLabelsContainer.style.display = 'flex';
    monthLabelsContainer.style.justifyContent = 'space-between';
    monthLabelsContainer.style.padding = '0 5px';

    monthNames.forEach((monthName, monthIndex) => {
      const monthDate = new Date(currentYear, monthIndex, 1);
      const weekNumber = this.getWeekNumber(monthDate);
      const monthLabel = document.createElement('div');
      monthLabel.className = 'heatmap-month-label';
      monthLabel.textContent = monthName;
      monthLabel.style.position = 'relative';
      monthLabel.style.left = `${(weekNumber / totalWeeks) * 100}%`;
      monthLabelsContainer.appendChild(monthLabel);
    });
    
    mainContainer.appendChild(monthLabelsContainer);

    // 创建热力图网格容器
    const gridContainer = document.createElement('div');
    gridContainer.className = 'heatmap-year-grid';
    gridContainer.style.flex = '1';
    gridContainer.style.paddingTop = '25px';

    // 计算需要显示的周数
    const startWeek = this.getWeekNumber(startDate);
    const weeksToShow = totalWeeks - startWeek + 1;

    // 创建每周的列
    for (let week = startWeek; week <= totalWeeks; week++) {
      const weekColumn = document.createElement('div');
      weekColumn.className = 'heatmap-week-column';
      weekColumn.style.flex = '1';
      weekColumn.style.minWidth = '12px';

      // 获取该周的所有日期
      const weekDates = this.getWeekDates(currentYear, week);

      // 为每一天创建单元格
      weekDates.forEach(date => {
        const dateKey = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
        const dataPoint = data.find(d => d.date === dateKey);
        const cell = this.createCell(dataPoint || { date: dateKey, seconds: 0, day: date.getDate() });
        weekColumn.appendChild(cell);
      });

      gridContainer.appendChild(weekColumn);
    }

    mainContainer.appendChild(gridContainer);
    this.container.appendChild(mainContainer);
  }

  /**
   * 获取指定年份和周数的所有日期
   */
  private getWeekDates(year: number, weekNumber: number): Date[] {
    const dates: Date[] = [];
    const firstDayOfYear = new Date(year, 0, 1);
    const daysOffset = (weekNumber * 7) - firstDayOfYear.getDay() - 6;
    const startDate = new Date(year, 0, 1 + daysOffset);

    for (let i = 0; i < 7; i++) {
      const date = new Date(startDate);
      date.setDate(startDate.getDate() + i);
      if (date.getFullYear() === year) {
        dates.push(date);
      } else {
        dates.push(new Date(year, 0, 1)); // 填充空白
      }
    }

    return dates;
  }

  /**
   * 获取日期所在的周数（0-52）
   */
  private getWeekNumber(date: Date): number {
    const d = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()));
    const dayNum = d.getUTCDay() || 7;
    d.setUTCDate(d.getUTCDate() + 4 - dayNum);
    const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
    const weekNo = Math.ceil((((d.getTime() - yearStart.getTime()) / 86400000) + 1) / 7);
    return Math.min(weekNo - 1, 52);
  }

  /**
   * 创建热力图单元格
   */
  private createCell(point: HeatmapDataPoint): HTMLElement {
    const cell = document.createElement('div');
    cell.className = 'heatmap-cell';

    // 设置背景色（基于等比级数映射）
    if (point.date) {
      cell.style.backgroundColor = this.getHeatmapColorBySeconds(point.seconds);

      // 标记今天
      if (this.options.showTodayMarker && point.date === this.todayKey) {
        cell.style.outline = '2px solid var(--theme-warning)';
      }

      // 添加点击事件
      cell.addEventListener('click', () => {
        this.options.onCellClick(point.date, point.seconds);
      });

      // 添加悬停事件，更新信息显示区域
      if (this.options.showTooltip) {


        cell.addEventListener('mouseenter', () => {
          const dateElement = document.getElementById('heatmap-date');
          const timeElement = document.getElementById('heatmap-time');
          if (dateElement && timeElement) {
            dateElement.textContent = point.date;
            timeElement.textContent = this.formatSeconds(point.seconds);
          }
        });
      }
    }

    return cell;
  }

  /**
   * 解析热力图颜色变量为实际十六进制值
   */
  private resolveHeatmapColors(): string[] {
    const vars = [
      '--theme-heatmap-level0',
      '--theme-heatmap-level1',
      '--theme-heatmap-level2',
      '--theme-heatmap-level3',
      '--theme-heatmap-level4',
      '--theme-heatmap-level5'
    ];
    const fallbacks = ['#ebedf0', '#b6e3ff', '#54aeff', '#0969da', '#0a3069', '#002d6b'];
    return vars.map((v, i) => {
      const val = getComputedStyle(document.documentElement).getPropertyValue(v).trim();
      return val || fallbacks[i];
    });
  }

  /**
   * 十六进制颜色转 RGB 分量
   */
  private hexToRgb(hex: string): { r: number; g: number; b: number } {
    hex = hex.replace('#', '');
    if (hex.length === 3) {
      hex = hex.split('').map(c => c + c).join('');
    }
    return {
      r: parseInt(hex.slice(0, 2), 16),
      g: parseInt(hex.slice(2, 4), 16),
      b: parseInt(hex.slice(4, 6), 16)
    };
  }

  /**
   * 在两个 RGB 颜色之间线性插值
   */
  private interpolateRgb(
    c1: { r: number; g: number; b: number },
    c2: { r: number; g: number; b: number },
    t: number
  ): string {
    const r = Math.round(c1.r + (c2.r - c1.r) * t);
    const g = Math.round(c1.g + (c2.g - c1.g) * t);
    const b = Math.round(c1.b + (c2.b - c1.b) * t);
    return `rgb(${r}, ${g}, ${b})`;
  }

  /**
   * 根据观看秒数获取热力图颜色（等比级数阈值 + RGB 连续插值）
   *
   * 每个颜色层级对应的时间阈值为等比数列：2048 × 2^(n-1) 秒
   *   层级 0: 0s
   *   层级 1: 2,048s (~34min)
   *   层级 2: 4,096s (~1h 8min)
   *   层级 3: 8,192s (~2h 16min)
   *   层级 4: 16,384s (~4h 33min)
   *   层级 5: 32,768s (~9h 6min)
   *   层级 6: 65,536s (~18h 12min) — 极值覆盖，复用 level5 颜色
   *
   * 在两个阈值之间时，颜色在相邻两个色值之间线性插值，实现连续过渡
   */
  private getHeatmapColorBySeconds(seconds: number): string {
    const thresholds = [0, 2048, 4096, 8192, 16384, 32768, 65536];
    const colors = this.resolveHeatmapColors();

    // 边界处理
    if (seconds <= 0) return colors[0];
    if (seconds >= thresholds[thresholds.length - 1]) return colors[colors.length - 1];

    // 找到所在区间
    let segIdx = 0;
    for (let i = 0; i < thresholds.length - 1; i++) {
      if (seconds >= thresholds[i] && seconds < thresholds[i + 1]) {
        segIdx = i;
        break;
      }
    }

    // 区间内线性插值
    const lower = thresholds[segIdx];
    const upper = thresholds[segIdx + 1];
    const t = (seconds - lower) / (upper - lower);

    const c1 = this.hexToRgb(colors[segIdx]);
    const c2 = this.hexToRgb(colors[Math.min(segIdx + 1, colors.length - 1)]);

    return this.interpolateRgb(c1, c2, t);
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
    this.container.innerHTML = '';
  }
}
