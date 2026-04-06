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

    // 计算最大值（如果未指定）
    const maxSeconds = this.options.maxSeconds || Math.max(...data.map(d => d.seconds), 1);

    // 渲染年度热力图
    this.renderYearView(data, maxSeconds);
  }

  /**
   * 渲染年度视图
   */
  private renderYearView(data: HeatmapDataPoint[], maxSeconds: number): void {
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
        const cell = this.createCell(dataPoint || { date: dateKey, seconds: 0, day: date.getDate() }, maxSeconds);
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
  private createCell(point: HeatmapDataPoint, maxSeconds: number): HTMLElement {
    const cell = document.createElement('div');
    cell.className = 'heatmap-cell';

    // 设置背景色
    if (point.date) {
      const ratio = Math.min(point.seconds / maxSeconds, 1);
      cell.style.backgroundColor = this.getHeatmapColor(ratio);

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
   * 获取热力图颜色
   */
  private getHeatmapColor(ratio: number): string {
    // 使用主题中的热力图颜色
    const colors = [
      'var(--theme-heatmap-level0)', // 0%
      'var(--theme-heatmap-level1)', // 1-20%
      'var(--theme-heatmap-level2)', // 21-40%
      'var(--theme-heatmap-level3)', // 41-60%
      'var(--theme-heatmap-level4)', // 61-80%
      'var(--theme-heatmap-level5)'  // 81-100%
    ];

    const index = Math.min(Math.floor(ratio * (colors.length - 1)), colors.length - 1);
    return colors[index];
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
