/**
 * 云栖智慧牧场 · 图表层
 * 使用本地 ECharts，风格与牧场玻璃 HUD 保持一致。
 */

const palette = {
  mint: '#8fe3c8',
  mintDeep: '#56baa0',
  gold: '#f0c987',
  coral: '#f18f7d',
  blue: '#93c7f2',
  lavender: '#c8baf2',
  cream: '#eadcc3',
  text: '#dce9df',
  muted: '#849b90',
  faint: '#5c7168',
  grid: 'rgba(215,235,221,.075)',
};

const font = '"Segoe UI", "Microsoft YaHei", "PingFang SC", sans-serif';

function hasECharts() {
  return typeof window !== 'undefined' && window.echarts;
}

function baseTooltip(extra = {}) {
  return {
    trigger: 'axis',
    backgroundColor: 'rgba(8, 20, 16, .93)',
    borderColor: 'rgba(207, 237, 222, .16)',
    borderWidth: 1,
    padding: [10, 13],
    textStyle: { color: '#e3eee6', fontSize: 12, fontFamily: font },
    axisPointer: {
      type: 'line',
      lineStyle: { color: 'rgba(183, 228, 208, .28)', width: 1, type: 'dashed' },
    },
    extraCssText: 'backdrop-filter: blur(14px); border-radius: 10px; box-shadow: 0 18px 40px rgba(0,0,0,.3);',
    ...extra,
  };
}

function axisLabel(extra = {}) {
  return {
    color: palette.muted,
    fontFamily: font,
    fontSize: 10,
    ...extra,
  };
}

function splitLine() {
  return {
    show: true,
    lineStyle: { color: palette.grid, width: 1, type: [4, 5] },
  };
}

function areaGradient(color, alpha = 0.26) {
  if (!hasECharts()) return 'rgba(0,0,0,0)';
  return new window.echarts.graphic.LinearGradient(0, 0, 0, 1, [
    { offset: 0, color: hexToRgba(color, alpha) },
    { offset: 0.55, color: hexToRgba(color, alpha * 0.4) },
    { offset: 1, color: hexToRgba(color, 0) },
  ]);
}

function hexToRgba(hex, alpha) {
  const normalized = hex.replace('#', '');
  const bigint = parseInt(normalized.length === 3 ? normalized.split('').map((c) => c + c).join('') : normalized, 16);
  const r = (bigint >> 16) & 255;
  const g = (bigint >> 8) & 255;
  const b = bigint & 255;
  return `rgba(${r},${g},${b},${alpha})`;
}

export class ChartHub {
  constructor() {
    this.charts = new Map();
    this.resizeObserver = null;
  }

  create(id, option) {
    if (!hasECharts()) return null;
    const el = document.getElementById(id);
    if (!el) return null;
    let chart = window.echarts.getInstanceByDom(el);
    if (!chart) chart = window.echarts.init(el, null, { renderer: 'canvas', devicePixelRatio: Math.min(window.devicePixelRatio || 1, 2) });
    chart.setOption(option, true);
    this.charts.set(id, chart);
    return chart;
  }

  get(id) {
    return this.charts.get(id) || null;
  }

  dispose(id) {
    const chart = this.charts.get(id);
    if (chart) {
      chart.dispose();
      this.charts.delete(id);
    }
  }

  disposeAll() {
    for (const chart of this.charts.values()) chart.dispose();
    this.charts.clear();
  }

  resizeAll() {
    requestAnimationFrame(() => {
      for (const chart of this.charts.values()) chart.resize();
    });
  }
}

export function milkTrendOption(series, { compare = true, unit = 'L', compact = false, secondarySeries = null } = {}) {
  const labels = series.map((d) => d.label);
  const values = series.map((d) => d.value);
  const avg = values.reduce((a, b) => a + b, 0) / Math.max(values.length, 1);
  const compareData = secondarySeries ? secondarySeries.map((d) => d.value) : null;
  return {
    animationDuration: 1100,
    animationEasing: 'cubicOut',
    grid: { left: compact ? 6 : 42, right: compact ? 6 : 30, top: compact ? 8 : 28, bottom: compact ? 6 : 26, containLabel: !compact },
    tooltip: baseTooltip({
      formatter: (params) => {
        const title = params[0]?.axisValueLabel || '';
        const rows = params.map((p) => {
          const color = p.color?.stops?.[0]?.color || p.color || palette.mint;
          return `<div style="display:flex;justify-content:space-between;gap:22px;margin-top:6px"><span><i style="display:inline-block;width:6px;height:6px;border-radius:50%;background:${color};margin-right:7px"></i>${p.seriesName}</span><b style="font-weight:600;color:#f6f0e1">${p.value}${unit === 'L' ? ' L' : unit}</b></div>`;
        }).join('');
        return `<div style="color:#a7bcb0;font-size:10px;letter-spacing:.06em">${title}</div>${rows}`;
      },
    }),
    legend: compact ? undefined : {
      show: compare,
      top: 0,
      right: 2,
      icon: 'circle',
      itemWidth: 6,
      itemHeight: 6,
      itemGap: 16,
      textStyle: { color: palette.muted, fontSize: 10, fontFamily: font },
      data: compare ? ['产奶总量', '趋势均值'] : [],
    },
    xAxis: {
      type: 'category',
      data: labels,
      boundaryGap: false,
      axisLine: { show: false },
      axisTick: { show: false },
      axisLabel: axisLabel({ interval: compact ? 2 : 'auto', color: compact ? palette.faint : palette.muted }),
    },
    yAxis: {
      type: 'value',
      scale: !compact,
      min: compact ? 'dataMin' : undefined,
      axisLine: { show: false },
      axisTick: { show: false },
      axisLabel: compact ? { show: false } : axisLabel({ formatter: (v) => `${v}` }),
      splitLine: compact ? { show: false } : splitLine(),
    },
    series: [
      {
        name: '产奶总量',
        type: 'line',
        data: values,
        smooth: 0.42,
        showSymbol: !compact,
        symbol: 'circle',
        symbolSize: 5,
        itemStyle: { color: palette.mint, borderColor: '#0d1c17', borderWidth: 2 },
        lineStyle: { width: compact ? 1.8 : 2.1, color: palette.mint, shadowBlur: 12, shadowColor: 'rgba(143,227,200,.22)' },
        areaStyle: { color: areaGradient(palette.mint, compact ? 0.24 : 0.2) },
        emphasis: { focus: 'series' },
      },
      ...(compare
        ? [
            {
              name: '趋势均值',
              type: 'line',
              data: values.map(() => Number(avg.toFixed(1))),
              smooth: false,
              showSymbol: false,
              lineStyle: { color: 'rgba(240,201,135,.55)', width: 1, type: [4, 5] },
              itemStyle: { color: palette.gold },
            },
          ]
        : []),
      ...(compareData
        ? [
            {
              name: '单产均值',
              type: 'line',
              data: compareData,
              smooth: 0.35,
              showSymbol: false,
              yAxisIndex: 0,
              lineStyle: { color: palette.gold, width: 1.6, type: [2, 4] },
              itemStyle: { color: palette.gold },
            },
          ]
        : []),
    ],
  };
}

export function healthDonutOption(distribution, { total = null, compact = false } = {}) {
  const sum = total ?? distribution.reduce((s, d) => s + d.value, 0);
  return {
    animationDuration: 1000,
    tooltip: baseTooltip({
      trigger: 'item',
      formatter: (p) => `<span style="color:${p.color}">●</span> ${p.name}<br/><b>${p.value}</b> 头 · ${sum ? ((p.value / sum) * 100).toFixed(1) : 0}%`,
    }),
    title: compact
      ? undefined
      : {
          text: String(sum),
          subtext: '在册牛只',
          left: 'center',
          top: '34%',
          textAlign: 'center',
          textStyle: { color: '#edf5ee', fontSize: 28, fontWeight: 500, fontFamily: font, letterSpacing: 0 },
          subtextStyle: { color: palette.muted, fontSize: 10, fontFamily: font, lineHeight: 22 },
        },
    series: [
      {
        type: 'pie',
        radius: compact ? ['65%', '88%'] : ['57%', '78%'],
        center: ['50%', compact ? '50%' : '47%'],
        avoidLabelOverlap: true,
        itemStyle: { borderColor: '#0b1813', borderWidth: 4, borderRadius: 6 },
        label: { show: false },
        labelLine: { show: false },
        emphasis: { scale: true, scaleSize: 4, itemStyle: { shadowBlur: 20, shadowColor: 'rgba(0,0,0,.35)' } },
        data: distribution.map((d) => ({ name: d.name, value: d.value, itemStyle: { color: d.color } })),
      },
    ],
  };
}

export function groupHealthBarOption(groups) {
  const colors = { healthy: palette.mint, watch: palette.gold, risk: palette.coral };
  return {
    animationDuration: 900,
    grid: { left: 10, right: 18, top: 8, bottom: 0, containLabel: true },
    tooltip: baseTooltip({ trigger: 'axis', axisPointer: { type: 'shadow' } }),
    legend: {
      top: 0,
      right: 2,
      icon: 'roundRect',
      itemWidth: 8,
      itemHeight: 8,
      itemGap: 14,
      textStyle: { color: palette.muted, fontSize: 10, fontFamily: font },
      data: ['健康', '观察', '风险'],
    },
    xAxis: {
      type: 'value',
      axisLine: { show: false },
      axisTick: { show: false },
      axisLabel: { show: false },
      splitLine: { show: false },
    },
    yAxis: {
      type: 'category',
      data: groups.map((g) => g.group),
      axisLine: { show: false },
      axisTick: { show: false },
      axisLabel: axisLabel({ color: palette.muted, fontSize: 11 }),
    },
    series: [
      { name: '健康', type: 'bar', stack: 'total', barWidth: 10, data: groups.map((g) => g.healthy), itemStyle: { color: colors.healthy, borderRadius: [4, 0, 0, 4] } },
      { name: '观察', type: 'bar', stack: 'total', barWidth: 10, data: groups.map((g) => g.watch), itemStyle: { color: colors.watch } },
      { name: '风险', type: 'bar', stack: 'total', barWidth: 10, data: groups.map((g) => g.risk), itemStyle: { color: colors.risk, borderRadius: [0, 4, 4, 0] } },
    ],
  };
}

export function environmentTrendOption(data, activeMetric = 'temperature', { compact = false, thresholds = null } = {}) {
  const configs = {
    temperature: { name: '温度', color: palette.gold, unit: '°C', min: 12, max: 32, decimals: 1 },
    humidity: { name: '湿度', color: palette.blue, unit: '%RH', min: 28, max: 92, decimals: 1 },
    nh3: { name: '氨气', color: palette.coral, unit: 'ppm', min: 0, max: 24, decimals: 1 },
    light: { name: '光照', color: palette.mint, unit: 'lx', min: 0, max: 2000, decimals: 0 },
  };
  const cfg = configs[activeMetric] || configs.temperature;
  const marks = [];
  if (thresholds) {
    if (thresholds.high !== undefined && thresholds.high !== null) {
      marks.push({
        yAxis: thresholds.high,
        label: { formatter: `阈值 ${thresholds.high}${cfg.unit}`, color: palette.coral, fontSize: 9, position: 'insideEndTop' },
        lineStyle: { color: 'rgba(241,143,125,.55)', type: [3, 4], width: 1 },
      });
    }
    if (thresholds.low !== undefined && thresholds.low !== null) {
      marks.push({
        yAxis: thresholds.low,
        label: { formatter: `下限 ${thresholds.low}`, color: 'rgba(240,201,135,.7)', fontSize: 9, position: 'insideEndBottom' },
        lineStyle: { color: 'rgba(240,201,135,.32)', type: [3, 4], width: 1 },
      });
    }
  }
  return {
    animationDuration: 900,
    grid: { left: compact ? 4 : 42, right: compact ? 4 : 26, top: compact ? 4 : 24, bottom: compact ? 4 : 24, containLabel: !compact },
    tooltip: baseTooltip({
      formatter: (params) => {
        const p = params[0];
        return `<span style="color:${cfg.color}">●</span> ${p.axisValueLabel}<br/><b style="font-size:16px;font-weight:500">${p.value}</b> <span style="color:#9eb1a7;font-size:10px">${cfg.unit}</span>`;
      },
    }),
    xAxis: {
      type: 'category',
      data: data.map((d) => d.label),
      boundaryGap: false,
      axisLine: { show: false },
      axisTick: { show: false },
      axisLabel: axisLabel({ interval: compact ? 'auto' : Math.max(0, Math.floor(data.length / 8)), color: compact ? palette.faint : palette.muted }),
    },
    yAxis: {
      type: 'value',
      min: compact ? 'dataMin' : cfg.min,
      max: compact ? 'dataMax' : cfg.max,
      axisLine: { show: false },
      axisTick: { show: false },
      axisLabel: compact ? { show: false } : axisLabel({ formatter: `{value}${cfg.unit === 'lx' ? '' : ''}` }),
      splitLine: compact ? { show: false } : splitLine(),
    },
    series: [
      {
        name: cfg.name,
        type: 'line',
        data: data.map((d) => d[activeMetric]),
        smooth: 0.4,
        showSymbol: false,
        lineStyle: { width: 2, color: cfg.color, shadowBlur: 12, shadowColor: hexToRgba(cfg.color, 0.2) },
        areaStyle: { color: areaGradient(cfg.color, 0.22) },
        markLine: marks.length ? { silent: true, symbol: ['none', 'none'], data: marks } : undefined,
        itemStyle: { color: cfg.color },
      },
    ],
  };
}

export function multiEnvOption(data, thresholds = null) {
  return {
    animationDuration: 900,
    grid: { left: 36, right: 40, top: 32, bottom: 28 },
    tooltip: baseTooltip(),
    legend: {
      top: 0,
      right: 0,
      icon: 'circle',
      itemWidth: 6,
      itemHeight: 6,
      itemGap: 14,
      textStyle: { color: palette.muted, fontSize: 10, fontFamily: font },
      data: ['温度', '湿度', '氨气'],
    },
    xAxis: {
      type: 'category',
      data: data.map((d) => d.label),
      boundaryGap: false,
      axisLine: { show: false },
      axisTick: { show: false },
      axisLabel: axisLabel({ interval: Math.max(0, Math.floor(data.length / 8)) }),
    },
    yAxis: [
      {
        type: 'value',
        scale: true,
        axisLine: { show: false },
        axisTick: { show: false },
        axisLabel: axisLabel({ formatter: '{value}°' }),
        splitLine: splitLine(),
      },
      {
        type: 'value',
        min: 0,
        max: 100,
        axisLine: { show: false },
        axisTick: { show: false },
        axisLabel: axisLabel({ formatter: '{value}%' }),
        splitLine: { show: false },
      },
      {
        type: 'value',
        min: 0,
        max: thresholds?.nh3High ? Math.max(24, thresholds.nh3High * 1.6) : 24,
        axisLine: { show: false },
        axisTick: { show: false },
        axisLabel: { show: false },
        splitLine: { show: false },
      },
    ],
    series: [
      {
        name: '温度',
        type: 'line',
        data: data.map((d) => d.temperature),
        smooth: 0.35,
        showSymbol: false,
        lineStyle: { color: palette.gold, width: 1.8 },
        itemStyle: { color: palette.gold },
      },
      {
        name: '湿度',
        type: 'line',
        yAxisIndex: 1,
        data: data.map((d) => d.humidity),
        smooth: 0.35,
        showSymbol: false,
        lineStyle: { color: palette.blue, width: 1.5, type: [4, 4] },
        itemStyle: { color: palette.blue },
      },
      {
        name: '氨气',
        type: 'line',
        yAxisIndex: 2,
        data: data.map((d) => d.nh3),
        smooth: 0.35,
        showSymbol: false,
        lineStyle: { color: palette.coral, width: 1.3, opacity: 0.8 },
        areaStyle: { color: areaGradient(palette.coral, 0.08) },
        itemStyle: { color: palette.coral },
      },
    ],
  };
}

export function energyOption(rows, { compact = false } = {}) {
  const labels = rows.map((r) => r.label || r.dateKey?.slice(5).replace('-', '/'));
  return {
    animationDuration: 900,
    grid: { left: compact ? 4 : 38, right: compact ? 4 : 24, top: compact ? 4 : 28, bottom: compact ? 4 : 26, containLabel: !compact },
    tooltip: baseTooltip({ trigger: 'axis', axisPointer: { type: 'shadow' } }),
    legend: compact ? undefined : {
      top: 0,
      right: 0,
      itemWidth: 8,
      itemHeight: 8,
      icon: 'roundRect',
      itemGap: 14,
      textStyle: { color: palette.muted, fontSize: 10, fontFamily: font },
      data: ['通风降温', '照明补光', '其他'],
    },
    xAxis: {
      type: 'category',
      data: labels,
      axisLine: { show: false },
      axisTick: { show: false },
      axisLabel: compact ? { show: false } : axisLabel({ interval: Math.max(0, Math.floor(labels.length / 7)) }),
    },
    yAxis: {
      type: 'value',
      axisLine: { show: false },
      axisTick: { show: false },
      axisLabel: compact ? { show: false } : axisLabel({ formatter: '{value} kWh' }),
      splitLine: compact ? { show: false } : splitLine(),
    },
    series: [
      { name: '通风降温', type: 'bar', stack: 'energy', barWidth: compact ? 6 : 10, data: rows.map((r) => r.hvac), itemStyle: { color: palette.mint, borderRadius: [4, 4, 0, 0] } },
      { name: '照明补光', type: 'bar', stack: 'energy', barWidth: compact ? 6 : 10, data: rows.map((r) => r.lighting), itemStyle: { color: palette.gold } },
      { name: '其他', type: 'bar', stack: 'energy', barWidth: compact ? 6 : 10, data: rows.map((r) => r.other), itemStyle: { color: palette.blue, borderRadius: [4, 4, 0, 0] } },
    ],
  };
}

export function productionBarnOption(barns, values) {
  return {
    animationDuration: 900,
    grid: { left: 8, right: 8, top: 22, bottom: 4, containLabel: true },
    tooltip: baseTooltip({ trigger: 'axis', axisPointer: { type: 'shadow' }, formatter: (params) => `${params[0]?.name}<br/><b>${params[0]?.value} L</b>` }),
    xAxis: {
      type: 'category',
      data: barns,
      axisLine: { show: false },
      axisTick: { show: false },
      axisLabel: axisLabel({ color: palette.muted, fontSize: 10 }),
    },
    yAxis: { type: 'value', show: false },
    series: [
      {
        type: 'bar',
        barWidth: 18,
        data: values.map((v, i) => ({
          value: v,
          itemStyle: {
            borderRadius: [6, 6, 2, 2],
            color: i === 0 ? palette.mint : i === 1 ? palette.gold : palette.lavender,
          },
        })),
        label: {
          show: true,
          position: 'top',
          color: palette.muted,
          fontSize: 9,
          fontFamily: font,
          formatter: ({ value }) => `${value}`,
        },
      },
    ],
  };
}

export function singleMetricBars(rows, { color = palette.mint, unit = '' } = {}) {
  return {
    animationDuration: 900,
    grid: { left: 8, right: 12, top: 18, bottom: 2, containLabel: true },
    tooltip: baseTooltip({ trigger: 'axis', axisPointer: { type: 'shadow' }, formatter: (params) => `${params[0]?.name}<br/><b>${params[0]?.value}${unit}</b>` }),
    xAxis: {
      type: 'category',
      data: rows.map((r) => r.name),
      axisLine: { show: false },
      axisTick: { show: false },
      axisLabel: axisLabel({ fontSize: 9 }),
    },
    yAxis: { type: 'value', show: false },
    series: [
      {
        type: 'bar',
        barWidth: 12,
        data: rows.map((r) => r.value),
        itemStyle: { color, borderRadius: [5, 5, 2, 2], opacity: 0.86 },
        label: { show: true, position: 'top', color: palette.muted, fontSize: 9, fontFamily: font, formatter: `{c}${unit}` },
      },
    ],
  };
}

export function healthScoreOption(series) {
  return {
    animationDuration: 900,
    grid: { left: 34, right: 20, top: 20, bottom: 22 },
    tooltip: baseTooltip({ formatter: (params) => `${params[0]?.axisValueLabel}<br/><b>健康评分 ${params[0]?.value}</b>` }),
    xAxis: {
      type: 'category',
      data: series.map((d) => d.label),
      boundaryGap: false,
      axisLine: { show: false },
      axisTick: { show: false },
      axisLabel: axisLabel({ fontSize: 9, interval: 1 }),
    },
    yAxis: {
      type: 'value',
      min: 50,
      max: 100,
      axisLine: { show: false },
      axisTick: { show: false },
      axisLabel: axisLabel({ fontSize: 9 }),
      splitLine: splitLine(),
    },
    series: [
      {
        type: 'line',
        data: series.map((d) => d.score),
        smooth: 0.4,
        showSymbol: false,
        lineStyle: { color: palette.coral, width: 1.8 },
        areaStyle: { color: areaGradient(palette.coral, 0.16) },
        markLine: {
          silent: true,
          symbol: ['none', 'none'],
          data: [{ yAxis: 88, lineStyle: { color: 'rgba(143,227,200,.4)', type: [3, 4] }, label: { formatter: '健康线', color: palette.mint, fontSize: 9 } }],
        },
      },
    ],
  };
}

export function miniSparkline(data, { width = 160, height = 42, color = palette.mint, strokeWidth = 1.7, id = 'spark' } = {}) {
  const values = data.map((d) => (typeof d === 'number' ? d : d.value));
  if (!values.length) return '';
  const min = Math.min(...values);
  const max = Math.max(...values);
  const range = max - min || 1;
  const stepX = width / Math.max(values.length - 1, 1);
  const points = values.map((v, i) => {
    const x = i * stepX;
    const y = height - 4 - ((v - min) / range) * (height - 8);
    return [x, y];
  });
  const path = points.map(([x, y], i) => `${i === 0 ? 'M' : 'L'}${x.toFixed(1)},${y.toFixed(1)}`).join(' ');
  const areaPath = `${path} L${width},${height} L0,${height} Z`;
  const safeId = `grad-${id.replace(/[^a-zA-Z0-9_-]/g, '')}`;
  return `<svg class="sparkline" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}" fill="none" preserveAspectRatio="none">
    <defs><linearGradient id="${safeId}" x1="0" y1="0" x2="0" y2="1"><stop stop-color="${color}" stop-opacity=".28"/><stop offset="1" stop-color="${color}" stop-opacity="0"/></linearGradient></defs>
    <path d="${areaPath}" fill="url(#${safeId})"/>
    <path d="${path}" stroke="${color}" stroke-width="${strokeWidth}" stroke-linecap="round" stroke-linejoin="round"/>
    <circle cx="${points[points.length - 1][0]}" cy="${points[points.length - 1][1]}" r="2.2" fill="${color}" stroke="#0c1b15" stroke-width="1.2"/>
  </svg>`;
}

export function barTrendOption(labels, values, { color = palette.mint, unit = '' } = {}) {
  return {
    animationDuration: 900,
    grid: { left: 34, right: 18, top: 16, bottom: 22 },
    tooltip: baseTooltip({ trigger: 'axis', axisPointer: { type: 'shadow' } }),
    xAxis: {
      type: 'category',
      data: labels,
      axisLine: { show: false },
      axisTick: { show: false },
      axisLabel: axisLabel({ fontSize: 9 }),
    },
    yAxis: { type: 'value', axisLine: { show: false }, axisTick: { show: false }, axisLabel: axisLabel({ fontSize: 9 }), splitLine: splitLine() },
    series: [
      {
        type: 'bar',
        data: values,
        barWidth: 10,
        itemStyle: { color: areaGradient(color, 0.8), borderRadius: [4, 4, 1, 1] },
        label: { show: false },
      },
    ],
  };
}

export { palette as chartPalette };
