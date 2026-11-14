/**
 * 云栖智慧牧场 · 数据与对象模型
 * ------------------------------------------------------------------
 * 一个纯前端、可持久化的数字孪生演示数据层：
 * 牛舍 / 环控设备 / 奶牛 / 产奶记录 / 健康记录 / 配种记录 / 巡检防疫工单
 */

export const APP_VERSION = 3;
export const STORAGE_KEY = 'misty-pasture-state-v3';

export const MILK_SESSIONS = ['早班', '午班', '晚班', '全天累计'];
export const HEALTH_STATUS = {
  healthy: { label: '健康', short: '健康', color: '#86dfc2', className: 'ok' },
  watch: { label: '观察', short: '观察', color: '#f0c77e', className: 'watch' },
  risk: { label: '风险', short: '风险', color: '#f08f7d', className: 'risk' },
};

export const METRIC_META = {
  temperature: { label: '温度', unit: '°C', icon: 'temperature', short: '温度' },
  humidity: { label: '湿度', unit: '%RH', icon: 'humidity', short: '湿度' },
  nh3: { label: '氨气', unit: 'ppm', icon: 'wind', short: '氨气' },
  light: { label: '光照', unit: 'lx', icon: 'light', short: '光照' },
};

export const DEVICE_META = {
  fan: { label: '循环风机', icon: 'fan', category: '通风降温' },
  exhaust: { label: '纵向排风', icon: 'fan', category: '通风换气' },
  mist: { label: '高压微雾', icon: 'mist', category: '降温加湿' },
  heater: { label: '保温灯组', icon: 'heater', category: '保温采暖' },
  light: { label: '补光灯', icon: 'bulb', category: '照明补光' },
  sensor: { label: '环境网关', icon: 'sensor', category: '数据采集' },
};

export const WORK_TYPE = {
  inspection: { label: '巡检验证', short: '巡检', icon: 'clipboard', color: '#87d8bb' },
  immunization: { label: '免疫防疫', short: '免疫', icon: 'shield', color: '#f0c77e' },
  medication: { label: '诊疗用药', short: '用药', icon: 'pill', color: '#f08f7d' },
};

export const WORK_STATUS = {
  pending: { label: '待执行', color: '#e6c27f' },
  in_progress: { label: '进行中', color: '#8fc7ff' },
  done: { label: '已完成', color: '#87d8bb' },
  canceled: { label: '已取消', color: '#a5aaa0' },
};

export const BARN_DEFS = [
  {
    barnId: 'B01',
    name: '晨露泌乳舍',
    en: 'MILKING HOUSE',
    population: 52,
    group: '泌乳牛',
    area: 860,
    accent: '#8fe0c5',
    description: '成年泌乳牛核心舍，配置风机、微雾、补光与智能环控网关。',
    thresholds: {
      tempLow: 16,
      tempHigh: 25.5,
      humidityLow: 45,
      humidityHigh: 76,
      nh3High: 15,
      lightLow: 120,
      lightHigh: 2100,
    },
  },
  {
    barnId: 'B02',
    name: '青禾成母舍',
    en: 'MATURE HERD',
    population: 48,
    group: '成母牛',
    area: 760,
    accent: '#a8c6ff',
    description: '泌乳牛与干奶牛混合舍，重点监测氨气与卧床舒适度。',
    thresholds: {
      tempLow: 15.5,
      tempHigh: 26,
      humidityLow: 42,
      humidityHigh: 78,
      nh3High: 15,
      lightLow: 100,
      lightHigh: 2200,
    },
  },
  {
    barnId: 'B03',
    name: '星芽犊牛舍',
    en: 'CALF NURSERY',
    population: 28,
    group: '犊牛 / 青年牛',
    area: 420,
    accent: '#f1c78d',
    description: '恒温穹顶犊牛岛，配置保温灯、柔光与空气循环。',
    thresholds: {
      tempLow: 18,
      tempHigh: 26,
      humidityLow: 45,
      humidityHigh: 72,
      nh3High: 10,
      lightLow: 80,
      lightHigh: 1850,
    },
  },
];

const DEVICE_TEMPLATES = [
  { type: 'fan', suffix: 'FAN', name: '循环风机', power: 1.5, running: false },
  { type: 'exhaust', suffix: 'EXH', name: '纵向排风', power: 2.2, running: false },
  { type: 'mist', suffix: 'MIST', name: '高压微雾', power: 0.9, running: false },
  { type: 'heater', suffix: 'HEAT', name: '保温灯组', power: 1.2, running: false },
  { type: 'light', suffix: 'LIGHT', name: '补光灯', power: 0.65, running: false },
  { type: 'sensor', suffix: 'GW', name: '环境采集网关', power: 0.02, running: true },
];

export const OBJECT_MODELS = [
  {
    key: 'barn',
    name: '牛舍物模型',
    en: 'Barn',
    icon: 'barn',
    color: '#8fe0c5',
    primary: 'barnId',
    relation: '1 座牛舍 → N 台设备 / N 头奶牛',
    description: '承载环境阈值与环控状态，是报警判定和联动的归属对象。',
    fields: [
      { key: 'barnId', label: '牛舍编号', type: 'String', pk: true, note: 'B01 / B02 / B03' },
      { key: 'name', label: '牛舍名称', type: 'String', note: '业务展示名称' },
      { key: 'temperature', label: '温度', type: 'Float / ℃', note: '环控网关实时上报' },
      { key: 'humidity', label: '湿度', type: 'Float / %RH', note: '环控网关实时上报' },
      { key: 'nh3', label: '氨气浓度', type: 'Float / ppm', note: '氨气传感器实时值' },
      { key: 'light', label: '光照强度', type: 'Float / lx', note: '光照传感器实时值' },
      { key: 'thresholds.*', label: '告警阈值', type: 'Object', note: '高低温、湿度、氨气、光照上下限' },
    ],
  },
  {
    key: 'device',
    name: '环控设备物模型',
    en: 'Device',
    icon: 'settings',
    color: '#a8c6ff',
    primary: 'deviceId',
    relation: 'N 台设备 → 1 座牛舍',
    description: '执行风机、微雾、保温、补光等动作，保留自动/手动模式与联动留痕。',
    fields: [
      { key: 'deviceId', label: '设备编号', type: 'String', pk: true, note: '如 D-B01-FAN' },
      { key: 'barnId', label: '所属牛舍', type: 'String / FK', note: '关联 Barn.barnId' },
      { key: 'type', label: '设备类型', type: 'Enum', note: 'fan / exhaust / mist / heater / light / sensor' },
      { key: 'mode', label: '控制模式', type: 'Enum', note: 'auto / manual' },
      { key: 'running', label: '运行状态', type: 'Boolean', note: '当前启停状态' },
      { key: 'linkedMetric', label: '联动指标', type: 'String', note: '温度 / 氨气 / 湿度 / 光照' },
      { key: 'powerKw', label: '额定功率', type: 'Float / kW', note: '用于环控能耗统计' },
    ],
  },
  {
    key: 'cow',
    name: '奶牛个体物模型',
    en: 'Cow',
    icon: 'cow',
    color: '#f0c77e',
    primary: 'earTag',
    relation: 'N 头奶牛 → 1 座牛舍；1 头奶牛 → N 条记录',
    description: '以耳标号作为全局唯一主键，关联健康、产奶、配种与工单。',
    fields: [
      { key: 'earTag', label: '耳标号', type: 'String', pk: true, note: '唯一主键，扫码 / 输入检索' },
      { key: 'name', label: '昵称', type: 'String', note: '牧场内部识别名' },
      { key: 'barnId', label: '所属牛舍', type: 'String / FK', note: '关联 Barn.barnId' },
      { key: 'ageMonths', label: '月龄', type: 'Float', note: '按月记录' },
      { key: 'parity', label: '胎次', type: 'Integer', note: '产胎次数' },
      { key: 'healthStatus', label: '健康状态', type: 'Enum', note: 'healthy / watch / risk' },
      { key: 'healthScore', label: '健康评分', type: 'Integer 0-100', note: '由体征与人工巡检综合计算' },
      { key: 'milkToday', label: '今日产奶', type: 'Float / L', note: '当日累计' },
    ],
  },
  {
    key: 'milk',
    name: '产奶表单模型',
    en: 'Milk Record',
    icon: 'milk',
    color: '#bfe9eb',
    primary: 'recordId',
    relation: 'N 条记录 → 1 头奶牛',
    description: '按耳标与挤奶时段记录单产、乳脂率、乳蛋白与质量等级。',
    fields: [
      { key: 'recordId', label: '记录编号', type: 'String', pk: true, note: '系统自动生成' },
      { key: 'earTag', label: '耳标号', type: 'String / FK', note: '关联 Cow.earTag' },
      { key: 'milkedAt', label: '挤奶时间', type: 'DateTime', note: '统一 yyyy-MM-dd HH:mm:ss' },
      { key: 'session', label: '班次', type: 'Enum', note: '早班 / 午班 / 晚班 / 全天累计' },
      { key: 'yield', label: '产奶量', type: 'Float / L', note: '本次或当日累计' },
      { key: 'fat', label: '乳脂率', type: 'Float / %', note: '质量分析' },
      { key: 'protein', label: '乳蛋白率', type: 'Float / %', note: '质量分析' },
      { key: 'quality', label: '品质等级', type: 'Enum', note: 'A+ / A / B' },
    ],
  },
  {
    key: 'health',
    name: '健康表单模型',
    en: 'Health Record',
    icon: 'heart',
    color: '#f08f7d',
    primary: 'recordId',
    relation: 'N 条记录 → 1 头奶牛',
    description: '汇总体温、反刍、活动量、跛行评分与巡检结论，支撑趋势判断。',
    fields: [
      { key: 'recordId', label: '记录编号', type: 'String', pk: true, note: '系统自动生成' },
      { key: 'earTag', label: '耳标号', type: 'String / FK', note: '关联 Cow.earTag' },
      { key: 'measuredAt', label: '采集时间', type: 'DateTime', note: 'IoT + 人工巡检' },
      { key: 'bodyTemp', label: '体温', type: 'Float / ℃', note: '正常 38.0–39.2' },
      { key: 'rumination', label: '反刍时长', type: 'Integer / min', note: '日累计' },
      { key: 'activity', label: '活动指数', type: 'Integer 0-100', note: '计步器折算' },
      { key: 'lameness', label: '跛行评分', type: 'Integer 0-3', note: '0 为正常' },
      { key: 'score', label: '健康评分', type: 'Integer 0-100', note: '综合评分' },
    ],
  },
  {
    key: 'breeding',
    name: '配种表单模型',
    en: 'Breeding Record',
    icon: 'spark',
    color: '#c4b6ff',
    primary: 'recordId',
    relation: 'N 条记录 → 1 头奶牛',
    description: '记录配种方式、冻精批次、技术员与复检结果，形成繁殖档案。',
    fields: [
      { key: 'recordId', label: '记录编号', type: 'String', pk: true, note: '系统自动生成' },
      { key: 'earTag', label: '耳标号', type: 'String / FK', note: '关联 Cow.earTag' },
      { key: 'bredAt', label: '配种日期', type: 'DateTime', note: '统一时间格式' },
      { key: 'method', label: '配种方式', type: 'Enum', note: '人工授精 / 胚胎移植' },
      { key: 'bull', label: '冻精 / 公牛编号', type: 'String', note: '批次追溯' },
      { key: 'result', label: '复检结果', type: 'Enum', note: '待复检 / 妊娠确认 / 未妊娠' },
      { key: 'expectedCalving', label: '预产期', type: 'Date', note: '自动预估' },
    ],
  },
  {
    key: 'work',
    name: '巡检 / 防疫工单模型',
    en: 'Work Order',
    icon: 'clipboard',
    color: '#e6c27f',
    primary: 'orderNo',
    relation: 'N 张工单 → 牛舍 / 奶牛',
    description: '覆盖巡检、免疫、用药全流程；每一步动作写入不可覆盖的审计时间线。',
    fields: [
      { key: 'orderNo', label: '工单号', type: 'String', pk: true, note: 'WO-日期-序号' },
      { key: 'type', label: '工单类型', type: 'Enum', note: 'inspection / immunization / medication' },
      { key: 'targetType', label: '对象类型', type: 'Enum', note: 'barn / group / cow' },
      { key: 'scheduledAt', label: '计划时间', type: 'DateTime', note: '排程执行' },
      { key: 'assignee', label: '执行人', type: 'String', note: '责任到人' },
      { key: 'status', label: '工单状态', type: 'Enum', note: 'pending / in_progress / done' },
      { key: 'trace[]', label: '审计轨迹', type: 'Array<Object>', note: '时间、操作人、动作、说明' },
      { key: 'meta', label: '免疫 / 用药信息', type: 'Object', note: '药品、批号、剂量、休药期' },
    ],
  },
];

/* ------------------------------------------------------------------ */
/* 基础工具                                                             */
/* ------------------------------------------------------------------ */

export function pad(n, len = 2) {
  return String(n).padStart(len, '0');
}

export function localDateKey(date = new Date()) {
  const d = date instanceof Date ? date : new Date(date);
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

export function localDateTime(date = new Date()) {
  const d = date instanceof Date ? date : new Date(date);
  return `${localDateKey(d)} ${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`;
}

export function localDateTimeShort(date = new Date()) {
  const d = date instanceof Date ? date : new Date(date);
  return `${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

export function dateAt(daysAgo = 0, hour = 8, minute = 0, now = new Date()) {
  const d = new Date(now);
  d.setDate(d.getDate() - daysAgo);
  d.setHours(hour, minute, Math.floor(Math.random() * 40), 0);
  return d;
}

export function relativeDateLabel(date, now = new Date()) {
  const d = new Date(date);
  const n = new Date(now);
  const ds = new Date(d.getFullYear(), d.getMonth(), d.getDate());
  const ns = new Date(n.getFullYear(), n.getMonth(), n.getDate());
  const diff = Math.round((ns - ds) / 86400000);
  if (diff === 0) return '今天';
  if (diff === 1) return '昨天';
  if (diff === -1) return '明天';
  if (diff > 1 && diff < 7) return `${diff} 天前`;
  if (diff < -1 && diff > -7) return `${-diff} 天后`;
  return `${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

export function formatNumber(value, digits = 0) {
  if (value === null || value === undefined || Number.isNaN(Number(value))) return '—';
  return Number(value).toLocaleString('zh-CN', {
    minimumFractionDigits: digits,
    maximumFractionDigits: digits,
  });
}

export function uid(prefix = 'ID') {
  return `${prefix}-${Date.now().toString(36).toUpperCase()}-${Math.random().toString(36).slice(2, 6).toUpperCase()}`;
}

function round(value, digits = 1) {
  const p = 10 ** digits;
  return Math.round(value * p) / p;
}

export function mulberry32(seed) {
  let a = seed >>> 0;
  return function random() {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function pick(rng, arr) {
  return arr[Math.floor(rng() * arr.length)];
}

function between(rng, min, max, digits = 1) {
  return round(min + rng() * (max - min), digits);
}

export function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value));
}

export function fmtClock(hour) {
  const total = ((hour % 24) + 24) % 24;
  const h = Math.floor(total);
  const m = Math.floor((total - h) * 60);
  return `${pad(h)}:${pad(m)}`;
}

export function daylightLabel(hour) {
  const h = ((hour % 24) + 24) % 24;
  if (h < 5) return { label: '深夜', icon: 'moon' };
  if (h < 7) return { label: '黎明', icon: 'sunrise' };
  if (h < 11) return { label: '清晨', icon: 'sunrise' };
  if (h < 15) return { label: '正午', icon: 'sun' };
  if (h < 18.2) return { label: '午后', icon: 'sun' };
  if (h < 20) return { label: '黄昏', icon: 'sunset' };
  return { label: '夜晚', icon: 'moon' };
}

export function metricThreshold(barn, metric) {
  const t = barn.thresholds || {};
  if (metric === 'temperature') return { low: t.tempLow, high: t.tempHigh };
  if (metric === 'humidity') return { low: t.humidityLow, high: t.humidityHigh };
  if (metric === 'nh3') return { low: 0, high: t.nh3High };
  if (metric === 'light') return { low: t.lightLow, high: t.lightHigh };
  return { low: 0, high: 0 };
}

export function getMetricState(barn, metric) {
  const value = barn[metric];
  const { low, high } = metricThreshold(barn, metric);
  if (metric === 'light') {
    return value < low ? 'low' : value > high ? 'high' : 'ok';
  }
  if (value > high) return 'high';
  if (value < low) return 'low';
  return 'ok';
}

export function getBarnState(barn) {
  const states = ['temperature', 'humidity', 'nh3', 'light'].map((m) => getMetricState(barn, m));
  if (states.includes('high') || states.includes('low')) {
    const hasCritical = states.filter((s) => s !== 'ok').length > 1;
    return { level: hasCritical ? 'risk' : 'watch', label: hasCritical ? '需关注' : '越限', states };
  }
  return { level: 'ok', label: '舒适', states };
}

/* ------------------------------------------------------------------ */
/* 演示数据生成                                                          */
/* ------------------------------------------------------------------ */

const NAME_FIRST = ['晨', '露', '青', '云', '桃', '麦', '小', '山', '糖', '星', '苔', '月', '松', '米', '雪', '风', '花', '团', '晚', '雾', '溪', '栗', '奶', '草', '铃', '冬', '夏', '春', '秋', '蓝', '暖', '浅', '野', '糯', '柚', '盐', '棉', '薄', '澄', '雨'];
const NAME_SECOND = ['露', '风', '禾', '团', '云', '芽', '子', '糖', '星', '苔', '月', '雾', '溪', '栗', '铃', '冬', '夏', '欢', '喜', '满', '乐', '安', '然', '果', '花', '朵', '叶', '雪', '雨', '岚', '光', '粒', '豆', '茶', '糕', '酥', '圆', '野', '眠', '铃'];

function makeNamePool(rng) {
  const names = [];
  const seen = new Set();
  for (const a of NAME_FIRST) {
    for (const b of NAME_SECOND) {
      const n = a + b;
      if (!seen.has(n)) {
        seen.add(n);
        names.push(n);
      }
    }
  }
  // 轻量洗牌，避免相邻奶牛的名字过于相近
  for (let i = names.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [names[i], names[j]] = [names[j], names[i]];
  }
  return names;
}

const BREEDS = ['荷斯坦', '荷斯坦', '荷斯坦', '娟姗', '蒙贝利亚'];
const CONDITIONS = {
  watch: ['反刍偏弱', '热应激观察', '蹄部轻度不适', '采食量波动', '乳房炎观察'],
  risk: ['乳房炎疑似', '消化功能异常', '呼吸道风险', '蹄叶炎风险', '产后恢复偏慢'],
};

function buildCows(rng, now, names) {
  const cows = [];
  let nameIndex = 0;
  for (const def of BARN_DEFS) {
    for (let i = 0; i < def.population; i++) {
      const isCalf = def.barnId === 'B03' && i < 14;
      const isHeifer = def.barnId === 'B03' && i >= 14;
      const isDry = def.barnId === 'B02' && i >= 44;
      const group = isCalf ? '犊牛' : isHeifer ? '青年牛' : isDry ? '干奶牛' : '泌乳牛';
      const healthRoll = rng();
      const healthStatus = healthRoll < 0.79 ? 'healthy' : healthRoll < 0.94 ? 'watch' : 'risk';
      const healthScore = healthStatus === 'healthy'
        ? Math.round(between(rng, 88, 98, 0))
        : healthStatus === 'watch'
          ? Math.round(between(rng, 76, 87, 0))
          : Math.round(between(rng, 61, 74, 0));
      const ageMonths = isCalf
        ? Math.round(between(rng, 3, 9, 0))
        : isHeifer
          ? Math.round(between(rng, 12, 24, 0))
          : isDry
            ? Math.round(between(rng, 66, 96, 0))
            : Math.round(between(rng, 30, 74, 0));
      const parity = isCalf || isHeifer ? 0 : Math.max(1, Math.floor(ageMonths / 20));
      const weight = isCalf
        ? Math.round(between(rng, 90, 180, 0))
        : isHeifer
          ? Math.round(between(rng, 320, 460, 0))
          : Math.round(between(rng, 560, 690, 0));
      const basePotential = isCalf || isHeifer || isDry
        ? 0
        : round(21.6 + (healthScore - 60) * 0.17 + rng() * 7.2, 1);
      const earTag = `CN-${def.barnId.slice(1)}-${pad(i + 1, 3)}`;
      const condition = healthStatus === 'healthy' ? '' : pick(rng, CONDITIONS[healthStatus]);
      cows.push({
        earTag,
        name: names[nameIndex++] || `牛牛${nameIndex}`,
        barnId: def.barnId,
        group,
        breed: group === '犊牛' ? '荷斯坦' : pick(rng, BREEDS),
        sex: rng() > 0.5 ? '母' : '公',
        ageMonths,
        parity,
        weight,
        healthStatus,
        healthScore,
        condition,
        basePotential,
        milkToday: 0,
        milkYesterday: 0,
        daysInMilk: group === '泌乳牛' ? Math.round(between(rng, 34, 286, 0)) : 0,
        lastMilkAt: null,
        lastHealthAt: null,
        lastInspection: dateAt(Math.round(between(rng, 1, 9, 0)), 7, 20, now).toISOString(),
        rumination: healthStatus === 'risk' ? Math.round(between(rng, 360, 430, 0)) : Math.round(between(rng, 440, 570, 0)),
        activity: healthStatus === 'risk' ? Math.round(between(rng, 46, 63, 0)) : Math.round(between(rng, 69, 96, 0)),
        bodyTemp: healthStatus === 'risk' ? round(between(rng, 39.0, 39.8, 1), 1) : round(between(rng, 38.1, 39.0, 1), 1),
        lameness: healthStatus === 'risk' ? Math.round(between(rng, 1, 3, 0)) : healthStatus === 'watch' ? Math.round(between(rng, 0, 1, 0)) : 0,
        note: healthStatus === 'healthy' ? '体征平稳' : condition,
        showcase: false,
        scene: null,
      });
    }
  }
  return cows;
}

function assignShowcaseCows(cows) {
  // 3D 场景仅渲染代表性个体，其余牛只保留在档案与报表中
  const byBarn = {
    B01: cows.filter((c) => c.barnId === 'B01'),
    B02: cows.filter((c) => c.barnId === 'B02'),
    B03: cows.filter((c) => c.barnId === 'B03'),
  };
  const positions = [
    // B01 晨露泌乳舍（半开敞，可从正面看到）
    { cow: byBarn.B01[0], pos: [-5.42, 0.03, -1.72], rot: 0.28, scale: 1.02, wander: false },
    { cow: byBarn.B01[1], pos: [-3.9, 0.03, -1.38], rot: -0.42, scale: 1.04, wander: false },
    { cow: byBarn.B01[2], pos: [-2.48, 0.03, -2.05], rot: 0.82, scale: 0.98, wander: false },
    { cow: byBarn.B01[16], pos: [-5.0, 0.03, -3.1], rot: 1.7, scale: 1.06, wander: false },
    { cow: byBarn.B01[25], pos: [-1.48, 0.03, -1.42], rot: -1.15, scale: 1.0, wander: false },
    // B02 青禾成母舍（开敞棚）
    { cow: byBarn.B02[0], pos: [2.55, 0.03, -2.08], rot: 0.46, scale: 1.02, wander: false },
    { cow: byBarn.B02[1], pos: [4.05, 0.03, -1.48], rot: -0.22, scale: 1.05, wander: false },
    { cow: byBarn.B02[12], pos: [5.6, 0.03, -2.18], rot: 1.13, scale: 0.99, wander: false },
    { cow: byBarn.B02[31], pos: [6.65, 0.03, -3.15], rot: 2.3, scale: 1.01, wander: false },
    // 中央牧场散步
    { cow: byBarn.B01[5], pos: [-1.22, 0.03, 2.02], rot: 0.4, scale: 1.02, wander: true, range: 1.3 },
    { cow: byBarn.B02[4], pos: [1.3, 0.03, 3.25], rot: -0.74, scale: 1.04, wander: true, range: 1.05 },
    { cow: byBarn.B01[12], pos: [3.25, 0.03, 1.05], rot: 2.5, scale: 0.98, wander: false },
    { cow: byBarn.B01[22], pos: [-3.4, 0.03, 3.75], rot: 0.94, scale: 1.01, wander: false },
    // B03 星芽犊牛舍
    { cow: byBarn.B03[0], pos: [5.53, 0.03, 3.2], rot: 1.9, scale: 0.54, wander: false },
    { cow: byBarn.B03[1], pos: [6.38, 0.03, 3.85], rot: -0.38, scale: 0.5, wander: false },
    { cow: byBarn.B03[14], pos: [7.28, 0.03, 2.62], rot: 2.6, scale: 0.72, wander: false },
  ];
  for (const item of positions) {
    if (!item.cow) continue;
    item.cow.showcase = true;
    item.cow.scene = {
      x: item.pos[0],
      y: item.pos[1],
      z: item.pos[2],
      rotation: item.rot,
      scale: item.scale,
      wander: !!item.wander,
      range: item.range || 0.7,
      phase: Math.random() * Math.PI * 2,
    };
  }
  // 保证至少有一头风险牛在场景中，便于演示诊疗闭环
  const riskCow = byBarn.B02.find((c) => c.healthStatus === 'risk' && !c.showcase);
  if (riskCow) {
    riskCow.showcase = true;
    riskCow.scene = { x: 7.1, y: 0.03, z: -1.65, rotation: 2.1, scale: 0.98, wander: false, range: 0.6, phase: 1.2 };
  }
}

function buildMilkRecords(rng, cows, now) {
  const records = [];
  const milkingCows = cows.filter((c) => c.group === '泌乳牛');
  let seq = 0;
  for (let day = 13; day >= 0; day--) {
    const seasonal = 1 + Math.sin((13 - day) * 0.42) * 0.035 + (day === 0 ? 0.012 : 0);
    for (const cow of milkingCows) {
      const wobble = 0.9 + rng() * 0.19;
      const healthPenalty = cow.healthStatus === 'risk' ? 0.86 : cow.healthStatus === 'watch' ? 0.94 : 1;
      const yieldValue = Math.max(8, round(cow.basePotential * seasonal * wobble * healthPenalty, 1));
      const d = dateAt(day, day === 0 ? Math.min(new Date(now).getHours(), 15) : 6, 10 + Math.floor(rng() * 35), now);
      const record = {
        recordId: `MLK-${localDateKey(d).replaceAll('-', '')}-${pad(++seq, 5)}`,
        earTag: cow.earTag,
        barnId: cow.barnId,
        milkedAt: d.toISOString(),
        dateKey: localDateKey(d),
        session: '全天累计',
        yield: yieldValue,
        fat: round(between(rng, 3.52, 4.22, 1), 1),
        protein: round(between(rng, 3.02, 3.52, 1), 1),
        somaticCell: Math.round(between(rng, 80, 290, 0)),
        quality: yieldValue > 30 ? 'A+' : rng() > 0.08 ? 'A' : 'B',
        note: '挤奶台自动采集',
      };
      records.push(record);
      if (day === 0) {
        cow.milkToday = round(cow.milkToday + record.yield, 1);
        cow.lastMilkAt = record.milkedAt;
      } else if (day === 1) {
        cow.milkYesterday = round(cow.milkYesterday + record.yield, 1);
      }
    }
  }
  return records;
}

function scoreToStatus(score) {
  return score >= 88 ? 'healthy' : score >= 76 ? 'watch' : 'risk';
}

function buildHealthRecords(rng, cows, now) {
  const records = [];
  const inspectors = ['林野', '苏晚', '江屿', '宋栀', '陈牧'];
  let seq = 0;
  for (const cow of cows) {
    for (let day = 9; day >= 0; day--) {
      const trendPenalty = cow.healthStatus === 'risk' && day < 3 ? (3 - day) * 2.2 : 0;
      const score = clamp(Math.round(cow.healthScore + between(rng, -3, 3, 0) - trendPenalty), 52, 100);
      const d = dateAt(day, 6, 30 + Math.floor(rng() * 35), now);
      const rec = {
        recordId: `HLT-${localDateKey(d).replaceAll('-', '')}-${pad(++seq, 5)}`,
        earTag: cow.earTag,
        barnId: cow.barnId,
        measuredAt: d.toISOString(),
        dateKey: localDateKey(d),
        bodyTemp: round(clamp(cow.bodyTemp + between(rng, -0.25, 0.25, 2), 37.8, 40.2), 1),
        rumination: Math.round(clamp(cow.rumination + between(rng, -32, 32, 0), 320, 620)),
        activity: Math.round(clamp(cow.activity + between(rng, -7, 7, 0), 30, 100)),
        lameness: clamp(cow.lameness + (rng() > 0.92 ? 1 : 0), 0, 3),
        score,
        status: scoreToStatus(score),
        source: day === 0 ? 'IoT + 人工巡检' : 'IoT 自动采集',
        inspector: pick(rng, inspectors),
        notes: score < 76 ? `${cow.condition || '体征异常'}，建议隔离复查` : score < 88 ? `${cow.condition || '体征波动'}，持续观察` : '体征平稳，采食与反刍正常',
        followUp: score < 76,
      };
      records.push(rec);
      if (day === 0) cow.lastHealthAt = rec.measuredAt;
    }
  }
  return records;
}

function buildBreedingRecords(rng, cows, now) {
  const records = [];
  const eligible = cows.filter((c) => c.group === '泌乳牛' || c.group === '青年牛' || c.group === '干奶牛');
  const technicians = ['顾雪', '周楮', '沈川', '叶青'];
  const bulls = ['HOL-2318', 'HOL-2166', 'JER-0882', 'MBL-1149', 'HOL-2450'];
  let seq = 0;
  for (let i = 0; i < 26; i++) {
    const cow = eligible[Math.floor(rng() * eligible.length)];
    const daysAgo = Math.round(between(rng, 1, 18, 0));
    const d = dateAt(daysAgo, 9, 20, now);
    const result = rng() > 0.23 ? '待复检' : rng() > 0.45 ? '妊娠确认' : '未妊娠';
    const method = rng() > 0.94 ? '胚胎移植' : '人工授精';
    const expected = new Date(d);
    expected.setDate(expected.getDate() + 282);
    records.push({
      recordId: `BRD-${localDateKey(d).replaceAll('-', '')}-${pad(++seq, 3)}`,
      earTag: cow.earTag,
      barnId: cow.barnId,
      bredAt: d.toISOString(),
      dateKey: localDateKey(d),
      method,
      bull: pick(rng, bulls),
      technician: pick(rng, technicians),
      result,
      expectedCalving: expected.toISOString(),
      note: result === '妊娠确认' ? '复检已确认，进入妊娠期管理' : result === '未妊娠' ? '下一情期继续观察' : '等待 30 天复检',
    });
  }
  return records;
}

function buildDevices(rng, barns) {
  const devices = [];
  for (const barn of barns) {
    for (const tpl of DEVICE_TEMPLATES) {
      const isB02 = barn.barnId === 'B02';
      const running = tpl.type === 'sensor'
        ? true
        : isB02 && tpl.type === 'exhaust'
          ? true
          : tpl.type === 'light'
            ? barn.barnId === 'B01'
            : false;
      devices.push({
        deviceId: `D-${barn.barnId}-${tpl.suffix}`,
        barnId: barn.barnId,
        name: tpl.name,
        type: tpl.type,
        mode: 'auto',
        online: true,
        running,
        powerKw: tpl.power,
        linkedMetric: tpl.type === 'fan' || tpl.type === 'mist' ? 'temperature' : tpl.type === 'exhaust' ? 'nh3' : tpl.type === 'heater' ? 'temperature' : tpl.type === 'light' ? 'light' : null,
        runtimeHours: Math.round(between(rng, 1.6, 8.4, 1) * 10) / 10,
        energyKwh: Math.round(between(rng, 2.2, 16.8, 1) * 10) / 10,
        lastAction: '自动策略待命',
        lastActionAt: new Date().toISOString(),
        signal: Math.round(between(rng, 82, 99, 0)),
      });
    }
  }
  return devices;
}

function buildEnvironmentHistory(rng, barns, now) {
  const history = {};
  const currentHour = now.getHours() + now.getMinutes() / 60;
  for (const barn of barns) {
    const baseTemp = barn.barnId === 'B01' ? 22.2 : barn.barnId === 'B02' ? 22.9 : 23.5;
    const baseHum = barn.barnId === 'B01' ? 63 : barn.barnId === 'B02' ? 67 : 60;
    const baseNh3 = barn.barnId === 'B01' ? 7.1 : barn.barnId === 'B02' ? 9.2 : 4.8;
    const baseLight = barn.barnId === 'B01' ? 290 : barn.barnId === 'B02' ? 360 : 210;
    const points = [];
    for (let i = 23; i >= 0; i--) {
      const d = new Date(now);
      d.setHours(Math.floor(currentHour - i), i === 0 ? d.getMinutes() : 0, 0, 0);
      const h = ((currentHour - i) % 24 + 24) % 24;
      const diurnal = Math.sin(((h - 8) / 24) * Math.PI * 2);
      const day = h >= 6 && h <= 19 ? Math.sin(((h - 6) / 13) * Math.PI) : 0;
      const temp = round(baseTemp + diurnal * 2.45 + between(rng, -0.25, 0.25, 2), 1);
      const humidity = round(clamp(baseHum - diurnal * 6.2 + between(rng, -1.8, 1.8, 2), 38, 86), 1);
      const nh3 = round(Math.max(2.8, baseNh3 + (1 - day) * 1.6 + between(rng, -0.7, 0.7, 2)), 1);
      const light = Math.round(baseLight + day * (barn.barnId === 'B01' ? 520 : barn.barnId === 'B02' ? 700 : 280) + between(rng, -20, 20, 0));
      points.push({
        at: d.toISOString(),
        temperature: temp,
        humidity,
        nh3,
        light: Math.max(0, light),
        fan: day > 0.3,
        energy: round(between(rng, 0.4, 2.1, 2), 2),
      });
    }
    // 与当前值对齐，B02 保留一个可演示的氨气越限
    const last = points[points.length - 1];
    last.temperature = barn.temperature;
    last.humidity = barn.humidity;
    last.nh3 = barn.nh3;
    last.light = barn.light;
    history[barn.barnId] = points;
  }
  return history;
}

function buildEnergyHistory(rng, now) {
  const rows = [];
  for (let day = 13; day >= 0; day--) {
    const hvac = round(between(rng, 31, 46, 1), 1);
    const lighting = round(between(rng, 8, 14, 1), 1);
    const other = round(between(rng, 4.5, 7.2, 1), 1);
    rows.push({
      dateKey: localDateKey(dateAt(day, 12, 0, now)),
      hvac,
      lighting,
      other,
      total: round(hvac + lighting + other, 1),
    });
  }
  return rows;
}

function buildTraceLogs(rng, now, workOrders) {
  const logs = [
    {
      id: 'TRC-SEED-01',
      at: dateAt(0, 6, 42, now).toISOString(),
      category: '巡检',
      actor: '林野',
      action: '完成 B01 晨间巡舍',
      target: 'B01 · 晨露泌乳舍',
      detail: '卧床平整、饮水正常，4 项巡检点全部通过。',
    },
    {
      id: 'TRC-SEED-02',
      at: dateAt(0, 7, 15, now).toISOString(),
      category: '系统',
      actor: '自动环控',
      action: 'B02 排气联动已触发',
      target: 'D-B02-EXH',
      detail: '氨气连续 10 分钟超过 15 ppm，纵向排风自动开启。',
    },
    {
      id: 'TRC-SEED-03',
      at: dateAt(1, 15, 20, now).toISOString(),
      category: '用药',
      actor: '苏晚',
      action: '乳房炎隔离治疗 · 第 2 天',
      target: 'CN-02-017',
      detail: '头孢噻呋钠 2.2 mg/kg，肌肉注射，休药期 7 天。',
    },
    {
      id: 'TRC-SEED-04',
      at: dateAt(2, 9, 35, now).toISOString(),
      category: '免疫',
      actor: '江屿',
      action: '完成 B03 犊牛支原体免疫',
      target: 'B03 · 14 头犊牛',
      detail: '疫苗批号 MY-202610A，接种 14 头，无异常反应。',
    },
    {
      id: 'TRC-SEED-05',
      at: dateAt(3, 16, 10, now).toISOString(),
      category: '巡检',
      actor: '宋栀',
      action: '完成全群蹄浴',
      target: '泌乳牛 · 96 头',
      detail: '硫酸铜溶液 3%，蹄浴 2 次，异常 2 头已转诊疗。',
    },
  ];
  for (const order of workOrders) {
    for (const t of order.trace || []) {
      if (!logs.some((log) => log.id === t.id)) {
        logs.push({
          id: `TRC-${order.orderNo}-${logs.length}`,
          at: t.at,
          category: order.type === 'inspection' ? '巡检' : order.type === 'immunization' ? '免疫' : '用药',
          actor: t.actor,
          action: `${order.title} · ${t.action}`,
          target: order.targetLabel || order.orderNo,
          detail: t.detail || '',
          orderNo: order.orderNo,
        });
      }
    }
  }
  return logs.sort((a, b) => new Date(b.at) - new Date(a.at));
}

function buildWorkOrders(rng, now, cows) {
  const riskCow = cows.find((c) => c.healthStatus === 'risk' && c.barnId === 'B02') || cows.find((c) => c.healthStatus === 'risk');
  const today = localDateKey(now).replaceAll('-', '');
  const base = [
    {
      type: 'inspection',
      title: 'B01 晨间巡舍',
      targetType: 'barn',
      barnId: 'B01',
      targetLabel: 'B01 · 晨露泌乳舍',
      scheduledAt: dateAt(0, 6, 30, now).toISOString(),
      assignee: '林野',
      status: 'done',
      priority: 'normal',
      steps: [
        { label: '温湿度 / 氨气读表核对', done: true },
        { label: '卧床与饮水槽检查', done: true },
        { label: '牛群精神状态观察', done: true },
        { label: '异常牛只标记与上报', done: true },
      ],
      trace: [
        { at: dateAt(0, 6, 12, now).toISOString(), actor: '系统', action: '任务派发', detail: '自动排程生成' },
        { at: dateAt(0, 6, 35, now).toISOString(), actor: '林野', action: '开始巡检', detail: '定位签到 B01' },
        { at: dateAt(0, 6, 42, now).toISOString(), actor: '林野', action: '完成巡检', detail: '4/4 检查点通过，无异常' },
      ],
      meta: { location: 'B01 东侧通道', method: '现场巡检' },
    },
    {
      type: 'inspection',
      title: 'B02 氨气异常复核',
      targetType: 'barn',
      barnId: 'B02',
      targetLabel: 'B02 · 青禾成母舍',
      scheduledAt: dateAt(0, 15, 50, now).toISOString(),
      assignee: '苏晚',
      status: 'in_progress',
      priority: 'urgent',
      steps: [
        { label: '现场氨气读数复核', done: true },
        { label: '检查清粪与通风通道', done: true },
        { label: '确认排风联动状态', done: false },
        { label: '记录处置结果并闭环', done: false },
      ],
      trace: [
        { at: dateAt(0, 15, 55, now).toISOString(), actor: '系统', action: '越限触发工单', detail: 'NH₃ > 15 ppm，优先派发' },
        { at: dateAt(0, 16, 2, now).toISOString(), actor: '苏晚', action: '开始复核', detail: '现场便携仪读数 19.2 ppm' },
      ],
      meta: { location: 'B02 北侧清粪道', method: '便携式氨气仪' },
    },
    {
      type: 'inspection',
      title: 'B03 犊牛呼吸道巡检',
      targetType: 'group',
      barnId: 'B03',
      targetLabel: 'B03 · 14 头犊牛',
      scheduledAt: dateAt(0, 18, 0, now).toISOString(),
      assignee: '江屿',
      status: 'pending',
      priority: 'high',
      steps: [
        { label: '逐头测温与呼吸频率', done: false },
        { label: '检查鼻液与咳嗽情况', done: false },
        { label: '评估垫料干燥度', done: false },
        { label: '异常个体建档', done: false },
      ],
      trace: [{ at: dateAt(0, 8, 10, now).toISOString(), actor: '系统', action: '任务创建', detail: '基于季节防疫计划自动生成' }],
      meta: { sampleCount: 14, method: '个体逐检' },
    },
    {
      type: 'immunization',
      title: '秋季口蹄疫加强免疫',
      targetType: 'group',
      barnId: 'ALL',
      targetGroup: '泌乳牛',
      targetLabel: 'B01 + B02 · 泌乳牛 96 头',
      scheduledAt: dateAt(-1, 9, 0, now).toISOString(),
      assignee: '江屿',
      status: 'pending',
      priority: 'high',
      steps: [
        { label: '核对疫苗批号与冷链温度', done: false },
        { label: '健康筛查与禁忌症排查', done: false },
        { label: '分组接种并记录耳标', done: false },
        { label: '30 分钟过敏观察', done: false },
      ],
      trace: [{ at: dateAt(0, 9, 0, now).toISOString(), actor: '陈牧', action: '任务下发', detail: '秋季防疫计划第 3 批' }],
      meta: {
        product: '口蹄疫 O 型灭活疫苗',
        batchNo: 'FM-202610-08',
        dose: '2 ml / 头',
        route: '肌肉注射',
        withdrawalDays: 0,
        coldChain: '2–8 ℃ 合格',
      },
    },
    {
      type: 'medication',
      title: 'B02 乳房炎隔离治疗',
      targetType: 'cow',
      barnId: 'B02',
      targetCow: riskCow?.earTag,
      targetLabel: riskCow ? `${riskCow.earTag} · ${riskCow.name}` : 'B02 风险牛只',
      scheduledAt: dateAt(0, 11, 20, now).toISOString(),
      assignee: '苏晚',
      status: 'in_progress',
      priority: 'urgent',
      steps: [
        { label: '临床检查与乳样采集', done: true },
        { label: '隔离至单栏观察区', done: true },
        { label: '按疗程给药并记录批号', done: true },
        { label: '复查体细胞并解除隔离', done: false },
      ],
      trace: [
        { at: dateAt(0, 10, 40, now).toISOString(), actor: '苏晚', action: '工单创建', detail: '晨检发现右后乳区肿胀，体细胞偏高' },
        { at: dateAt(0, 11, 25, now).toISOString(), actor: '苏晚', action: '开始治疗', detail: '采乳样送检，隔离单栏 A-07' },
        { at: dateAt(0, 11, 48, now).toISOString(), actor: '苏晚', action: '用药记录', detail: '头孢噻呋钠 2.2 mg/kg，肌肉注射' },
      ],
      meta: {
        product: '头孢噻呋钠',
        batchNo: 'CF-202609-21',
        dose: '2.2 mg / kg',
        route: '肌肉注射',
        withdrawalDays: 7,
        diagnosis: '临床型乳房炎（右后乳区）',
      },
    },
    {
      type: 'inspection',
      title: 'B01 挤奶设备巡检',
      targetType: 'barn',
      barnId: 'B01',
      targetLabel: 'B01 · 挤奶厅',
      scheduledAt: dateAt(1, 14, 0, now).toISOString(),
      assignee: '宋栀',
      status: 'done',
      priority: 'normal',
      steps: [
        { label: '真空度与脉动频率', done: true },
        { label: '奶杯内衬磨损检查', done: true },
        { label: '清洗记录核对', done: true },
      ],
      trace: [
        { at: dateAt(1, 13, 50, now).toISOString(), actor: '宋栀', action: '开始巡检', detail: '' },
        { at: dateAt(1, 14, 18, now).toISOString(), actor: '宋栀', action: '完成巡检', detail: '设备运行正常，2 号奶杯内衬下次更换' },
      ],
      meta: { method: '设备点检', location: 'B01 挤奶厅' },
    },
    {
      type: 'medication',
      title: 'B03 犊牛腹泻复查',
      targetType: 'group',
      barnId: 'B03',
      targetGroup: '犊牛',
      targetLabel: 'B03 · 犊牛 14 头',
      scheduledAt: dateAt(0, 19, 20, now).toISOString(),
      assignee: '江屿',
      status: 'pending',
      priority: 'normal',
      steps: [
        { label: '粪便评分复查', done: false },
        { label: '补液与电解质记录', done: false },
        { label: '垫料更换确认', done: false },
      ],
      trace: [{ at: dateAt(0, 13, 40, now).toISOString(), actor: '江屿', action: '创建复查任务', detail: '3 头犊牛需持续观察' }],
      meta: { product: '口服补液盐', batchNo: 'ORS-202610-02', dose: '按需', withdrawalDays: 0 },
    },
    {
      type: 'inspection',
      title: 'B02 风机滤网清洁',
      targetType: 'barn',
      targetLabel: 'B02 · 纵向排风机组',
      barnId: 'B02',
      scheduledAt: dateAt(2, 10, 0, now).toISOString(),
      assignee: '苏晚',
      status: 'done',
      priority: 'normal',
      steps: [
        { label: '断电挂牌', done: true },
        { label: '滤网除尘与消毒', done: true },
        { label: '通电试运行', done: true },
      ],
      trace: [
        { at: dateAt(2, 9, 58, now).toISOString(), actor: '苏晚', action: '开始维护', detail: 'LOTO 断电' },
        { at: dateAt(2, 10, 25, now).toISOString(), actor: '苏晚', action: '完成维护', detail: '风量恢复正常，试运行 10 分钟' },
      ],
      meta: { method: '设备维护', location: 'B02 西侧风机房' },
    },
    {
      type: 'immunization',
      title: 'B03 犊牛支原体免疫',
      targetType: 'group',
      barnId: 'B03',
      targetGroup: '犊牛',
      targetLabel: 'B03 · 14 头犊牛',
      scheduledAt: dateAt(2, 9, 0, now).toISOString(),
      assignee: '江屿',
      status: 'done',
      priority: 'high',
      steps: [
        { label: '核对疫苗批号与冷链温度', done: true },
        { label: '健康筛查与禁忌症排查', done: true },
        { label: '分组接种并记录耳标', done: true },
        { label: '30 分钟过敏观察', done: true },
      ],
      trace: [
        { at: dateAt(2, 8, 52, now).toISOString(), actor: '江屿', action: '领取疫苗', detail: '冷链温度 4.2°C，批号 MY-202610A' },
        { at: dateAt(2, 9, 6, now).toISOString(), actor: '江屿', action: '开始免疫', detail: '14 头犊牛健康筛查通过' },
        { at: dateAt(2, 10, 15, now).toISOString(), actor: '江屿', action: '完成并观察', detail: '全部接种完成，30 分钟观察无异常' },
      ],
      meta: {
        product: '牛支原体灭活疫苗',
        batchNo: 'MY-202610A',
        dose: '2 ml / 头',
        route: '皮下注射',
        withdrawalDays: 0,
        observation: '30 分钟',
      },
    },
    {
      type: 'medication',
      title: 'B01 临床乳房炎疗程',
      targetType: 'cow',
      barnId: 'B01',
      targetCow: cows.find((c) => c.barnId === 'B01' && c.healthStatus === 'risk')?.earTag,
      targetLabel: cows.find((c) => c.barnId === 'B01' && c.healthStatus === 'risk')
        ? `${cows.find((c) => c.barnId === 'B01' && c.healthStatus === 'risk').earTag} · ${cows.find((c) => c.barnId === 'B01' && c.healthStatus === 'risk').name}`
        : 'B01 · 乳房炎个体',
      scheduledAt: dateAt(1, 15, 30, now).toISOString(),
      assignee: '苏晚',
      status: 'done',
      priority: 'high',
      steps: [
        { label: '临床检查与诊断复核', done: true },
        { label: '隔离保定并采集乳样', done: true },
        { label: '按剂量给药并记录批号', done: true },
        { label: '复查体细胞并解除隔离', done: true },
      ],
      trace: [
        { at: dateAt(1, 15, 10, now).toISOString(), actor: '苏晚', action: '开始治疗', detail: '右后乳区肿胀，体细胞 420k' },
        { at: dateAt(1, 16, 2, now).toISOString(), actor: '苏晚', action: '完成疗程并签字', detail: '头孢噻呋钠疗程结束，复查体细胞下降，解除隔离，休药期追踪至 7 日后' },
      ],
      meta: {
        product: '头孢噻呋钠',
        batchNo: 'CF-202609-14',
        dose: '2.2 mg / kg',
        route: '肌肉注射',
        withdrawalDays: 7,
        diagnosis: '临床型乳房炎',
      },
    },
  ];

  return base.map((order, i) => {
    const orderNo = `WO-${today}-${pad(i + 1, 3)}`;
    const trace = order.trace.map((t, idx) => ({ id: `${orderNo}-T${idx + 1}`, ...t }));
    const lastTraceAt = trace[trace.length - 1]?.at;
    return {
      orderNo,
      orderId: orderNo,
      createdAt: trace[0]?.at || new Date().toISOString(),
      ...order,
      trace,
      updatedAt: lastTraceAt || order.createdAt,
      completedAt: order.status === 'done' ? lastTraceAt : undefined,
    };
  });
}

function buildAlarms(rng, barns, devices, now) {
  return [
    {
      alarmId: `ALM-${Date.now().toString(36).toUpperCase()}-01`,
      code: 'ENV-NH3-01',
      barnId: 'B02',
      metric: 'nh3',
      level: 'warning',
      title: '氨气浓度越限',
      message: 'B02 青禾成母舍氨气浓度 19.4 ppm，已超过阈值 15 ppm',
      value: 19.4,
      threshold: 15,
      status: 'active',
      createdAt: dateAt(0, 15, 44, now).toISOString(),
      acknowledged: false,
      acknowledgedBy: null,
      resolvedAt: null,
      linkedDeviceId: 'D-B02-EXH',
      linkedAction: '已联动纵向排风',
      suggestion: '建议开启纵向排风并检查清粪通道，30 分钟后复核。',
    },
    {
      alarmId: `ALM-${Date.now().toString(36).toUpperCase()}-02`,
      code: 'ENV-TEMP-02',
      barnId: 'B01',
      metric: 'temperature',
      level: 'warning',
      title: '高温预警已恢复',
      message: 'B01 温度最高 26.1 ℃，开启风机与微雾后恢复正常',
      value: 26.1,
      threshold: 25.5,
      status: 'resolved',
      createdAt: dateAt(0, 13, 12, now).toISOString(),
      acknowledged: true,
      acknowledgedBy: '林野',
      resolvedAt: dateAt(0, 13, 41, now).toISOString(),
      linkedDeviceId: 'D-B01-FAN',
      linkedAction: '已联动循环风机 + 高压微雾',
      suggestion: '午间高温时段保持风机低速运行。',
    },
    {
      alarmId: `ALM-${Date.now().toString(36).toUpperCase()}-03`,
      code: 'ENV-LIGHT-03',
      barnId: 'B03',
      metric: 'light',
      level: 'info',
      title: '光照偏低已恢复',
      message: 'B03 补光灯自动开启，照度已恢复至 126 lx',
      value: 63,
      threshold: 80,
      status: 'resolved',
      createdAt: dateAt(1, 17, 30, now).toISOString(),
      acknowledged: true,
      acknowledgedBy: '系统',
      resolvedAt: dateAt(1, 17, 34, now).toISOString(),
      linkedDeviceId: 'D-B03-LIGHT',
      linkedAction: '已联动补光灯',
      suggestion: '黄昏提前 30 分钟开启柔光。',
    },
  ];
}

export function createDemoState(now = new Date()) {
  const rng = mulberry32(20261107);
  const cows = buildCows(rng, now, makeNamePool(rng));
  assignShowcaseCows(cows);
  const milkRecords = buildMilkRecords(rng, cows, now);
  const healthRecords = buildHealthRecords(rng, cows, now);
  const breedingRecords = buildBreedingRecords(rng, cows, now);
  const barns = BARN_DEFS.map((def, index) => {
    const base = {
      barnId: def.barnId,
      name: def.name,
      en: def.en,
      population: def.population,
      group: def.group,
      area: def.area,
      accent: def.accent,
      description: def.description,
      thresholds: { ...def.thresholds },
      temperature: [22.4, 23.2, 24.1][index],
      humidity: [63.5, 68.2, 60.8][index],
      nh3: [7.2, 19.4, 4.9][index],
      light: [610, 880, 438][index],
      powerKwh: [32.6, 41.2, 18.7][index],
      updatedAt: now.toISOString(),
    };
    return base;
  });
  // B02 的初始异常与告警保持一致
  barns[1].nh3 = 19.4;
  const devices = buildDevices(rng, barns);
  const workOrders = buildWorkOrders(rng, now, cows);
  const traceLogs = buildTraceLogs(rng, now, workOrders);
  const alarms = buildAlarms(rng, barns, devices, now);
  const state = {
    version: APP_VERSION,
    createdAt: now.toISOString(),
    demoDate: localDateKey(now),
    barns,
    cows,
    devices,
    milkRecords,
    healthRecords,
    breedingRecords,
    workOrders,
    alarms,
    traceLogs,
    environmentHistory: buildEnvironmentHistory(rng, barns, now),
    energyHistory: buildEnergyHistory(rng, now),
    settings: {
      autoControl: true,
      autoDaylight: true,
      autoRotate: false,
      labels: true,
      fog: true,
      clouds: true,
      volumetric: true,
      tiltShift: true,
      fireflies: true,
      bloom: 0.24,
      exposure: 0.92,
      daylightSpeed: 1,
      simHour: 17.18,
    },
    auditSequence: 1,
    lastSimulationAt: now.toISOString(),
    weather: { condition: '薄雾转晴', wind: 1.6, outsideTemp: 14.8, rainChance: 12 },
  };
  return state;
}

/* ------------------------------------------------------------------ */
/* 查询、统计与报表                                                      */
/* ------------------------------------------------------------------ */

export function cowByTag(state, earTag) {
  return state.cows.find((c) => c.earTag === earTag) || null;
}

export function barnById(state, barnId) {
  return state.barns.find((b) => b.barnId === barnId) || null;
}

export function devicesForBarn(state, barnId) {
  return state.devices.filter((d) => d.barnId === barnId);
}

export function activeAlarms(state) {
  return state.alarms.filter((a) => a.status === 'active');
}

export function todayMilkRecords(state, dateKey = localDateKey()) {
  return state.milkRecords.filter((r) => r.dateKey === dateKey);
}

export function computeMetrics(state, now = new Date()) {
  const today = localDateKey(now);
  const currentMilk = todayMilkRecords(state, today);
  const totalMilk = currentMilk.reduce((sum, r) => sum + Number(r.yield || 0), 0);
  const milkingCows = state.cows.filter((c) => c.group === '泌乳牛').length;
  const healthy = state.cows.filter((c) => c.healthStatus === 'healthy').length;
  const watch = state.cows.filter((c) => c.healthStatus === 'watch').length;
  const risk = state.cows.filter((c) => c.healthStatus === 'risk').length;
  const active = activeAlarms(state);
  const todayAlarms = state.alarms.filter((a) => a.createdAt && localDateKey(new Date(a.createdAt)) === today);
  const complianceChecks = state.barns.flatMap((b) => ['temperature', 'humidity', 'nh3', 'light'].map((m) => getMetricState(b, m)));
  const compliance = Math.round((complianceChecks.filter((s) => s === 'ok').length / complianceChecks.length) * 1000) / 10;
  const fat = currentMilk.length ? currentMilk.reduce((s, r) => s + Number(r.fat || 0), 0) / currentMilk.length : 0;
  const protein = currentMilk.length ? currentMilk.reduce((s, r) => s + Number(r.protein || 0), 0) / currentMilk.length : 0;
  const energyToday = state.energyHistory.find((e) => e.dateKey === today)?.total
    ?? state.energyHistory[state.energyHistory.length - 1]?.total
    ?? 0;
  const pendingWorks = state.workOrders.filter((w) => w.status !== 'done' && w.status !== 'canceled').length;
  const riskCows = state.cows.filter((c) => c.healthStatus === 'risk');
  const occupancy = state.barns.reduce((sum, b) => sum + (b.population || 0), 0);
  const weeklyTrend = getTotalMilkSeries(state, 7).map((d) => d.value);
  const yesterdayMilk = weeklyTrend.length > 1 ? weeklyTrend[weeklyTrend.length - 2] : 0;
  const milkDelta = yesterdayMilk ? ((totalMilk - yesterdayMilk) / yesterdayMilk) * 100 : 0;
  return {
    totalCows: state.cows.length,
    occupancy,
    milkingCows,
    totalMilk: round(totalMilk, 0),
    avgYield: milkingCows ? round(totalMilk / milkingCows, 1) : 0,
    yesterdayMilk: round(yesterdayMilk, 0),
    milkDelta: round(milkDelta, 1),
    healthy,
    watch,
    risk,
    healthRate: round(((healthy + watch) / state.cows.length) * 100, 1),
    activeAlarms: active.length,
    todayAlarms: todayAlarms.length,
    compliance,
    fat: round(fat, 2),
    protein: round(protein, 2),
    energyToday: round(energyToday, 1),
    pendingWorks,
    riskCows,
    today,
  };
}

export function getTotalMilkSeries(state, days = 14, now = new Date()) {
  const keys = [];
  for (let i = days - 1; i >= 0; i--) {
    const d = new Date(now);
    d.setDate(d.getDate() - i);
    keys.push(localDateKey(d));
  }
  const map = new Map(keys.map((k) => [k, 0]));
  for (const record of state.milkRecords) {
    if (map.has(record.dateKey)) map.set(record.dateKey, map.get(record.dateKey) + Number(record.yield || 0));
  }
  return keys.map((key) => ({
    dateKey: key,
    label: key.slice(5).replace('-', '/'),
    value: round(map.get(key), 1),
  }));
}

export function getAvgYieldSeries(state, days = 14, now = new Date()) {
  const total = getTotalMilkSeries(state, days, now);
  const milking = state.cows.filter((c) => c.group === '泌乳牛').length || 1;
  return total.map((d) => ({ ...d, value: round(d.value / milking, 1) }));
}

export function getBarnMilkToday(state, barnId) {
  const today = localDateKey();
  return round(
    state.milkRecords
      .filter((r) => r.barnId === barnId && r.dateKey === today)
      .reduce((sum, r) => sum + Number(r.yield || 0), 0),
    1,
  );
}

export function getCowMilkSeries(state, earTag, days = 14, now = new Date()) {
  const keys = [];
  for (let i = days - 1; i >= 0; i--) {
    const d = new Date(now);
    d.setDate(d.getDate() - i);
    keys.push(localDateKey(d));
  }
  const map = new Map(keys.map((k) => [k, 0]));
  for (const r of state.milkRecords) {
    if (r.earTag === earTag && map.has(r.dateKey)) map.set(r.dateKey, map.get(r.dateKey) + Number(r.yield || 0));
  }
  return keys.map((key) => ({
    dateKey: key,
    label: key.slice(5).replace('-', '/'),
    value: round(map.get(key), 1),
  }));
}

export function getCowHealthSeries(state, earTag, days = 10) {
  const records = state.healthRecords
    .filter((r) => r.earTag === earTag)
    .sort((a, b) => new Date(a.measuredAt) - new Date(b.measuredAt));
  return records.slice(-days).map((r) => ({
    dateKey: r.dateKey,
    label: r.dateKey.slice(5).replace('-', '/'),
    score: r.score,
    rumination: r.rumination,
    activity: r.activity,
    bodyTemp: r.bodyTemp,
  }));
}

export function getLatestCowHealth(state, earTag) {
  return state.healthRecords
    .filter((r) => r.earTag === earTag)
    .sort((a, b) => new Date(b.measuredAt) - new Date(a.measuredAt))[0] || null;
}

export function getLatestCowMilk(state, earTag) {
  return state.milkRecords
    .filter((r) => r.earTag === earTag)
    .sort((a, b) => new Date(b.milkedAt) - new Date(a.milkedAt))[0] || null;
}

export function getBarnEnvSeries(state, barnId, points = 24) {
  const hist = state.environmentHistory[barnId] || [];
  return hist.slice(-points).map((p) => ({
    at: p.at,
    label: p.at ? `${pad(new Date(p.at).getHours())}:${pad(new Date(p.at).getMinutes())}` : '',
    temperature: p.temperature,
    humidity: p.humidity,
    nh3: p.nh3,
    light: p.light,
    energy: p.energy,
  }));
}

export function getHealthDistribution(state) {
  const distribution = [
    { key: 'healthy', name: '健康', value: 0, color: '#86dfc2' },
    { key: 'watch', name: '观察', value: 0, color: '#f0c77e' },
    { key: 'risk', name: '风险', value: 0, color: '#f08f7d' },
  ];
  for (const cow of state.cows) {
    const row = distribution.find((d) => d.key === cow.healthStatus);
    if (row) row.value += 1;
  }
  return distribution;
}

export function getGroupHealthStats(state) {
  const groups = new Map();
  for (const cow of state.cows) {
    if (!groups.has(cow.group)) groups.set(cow.group, { group: cow.group, total: 0, healthy: 0, watch: 0, risk: 0, milk: 0 });
    const g = groups.get(cow.group);
    g.total += 1;
    g[cow.healthStatus] += 1;
    g.milk += Number(cow.milkToday || 0);
  }
  return [...groups.values()].map((g) => ({
    ...g,
    rate: round(((g.healthy / g.total) * 100) || 0, 1),
    milk: round(g.milk, 1),
  }));
}

export function getBarnStatusSummary(state) {
  return state.barns.map((barn) => {
    const devices = devicesForBarn(state, barn.barnId);
    const alarms = activeAlarms(state).filter((a) => a.barnId === barn.barnId);
    return {
      ...barn,
      status: getBarnState(barn),
      devices,
      activeDevices: devices.filter((d) => d.running).length,
      alarms,
      cows: state.cows.filter((c) => c.barnId === barn.barnId),
      milkToday: getBarnMilkToday(state, barn.barnId),
    };
  });
}

export function getEnergyReport(state) {
  return state.energyHistory.map((row) => ({
    ...row,
    label: row.dateKey.slice(5).replace('-', '/'),
    intensity: 0,
  }));
}

export function getHealthReportRows(state, days = 7, now = new Date()) {
  const keys = [];
  for (let i = days - 1; i >= 0; i--) {
    const d = new Date(now);
    d.setDate(d.getDate() - i);
    keys.push(localDateKey(d));
  }
  return keys.map((key) => {
    const health = state.healthRecords.filter((r) => r.dateKey === key);
    const milk = todayMilkRecords(state, key);
    const abnormal = health.filter((r) => r.score < 76).length;
    const followUps = health.filter((r) => r.followUp).length;
    return {
      dateKey: key,
      label: key.slice(5).replace('-', '/'),
      records: health.length,
      avgScore: health.length ? round(health.reduce((s, r) => s + r.score, 0) / health.length, 1) : 0,
      abnormal,
      followUps,
      avgRumination: health.length ? Math.round(health.reduce((s, r) => s + r.rumination, 0) / health.length) : 0,
      sampleMilk: round(milk.reduce((s, r) => s + Number(r.yield || 0), 0), 1),
    };
  });
}

export function buildReport(state, type = 'production', days = 7) {
  const now = new Date();
  const keys = [];
  for (let i = days - 1; i >= 0; i--) {
    const d = new Date(now);
    d.setDate(d.getDate() - i);
    keys.push(localDateKey(d));
  }
  if (type === 'production') {
    const rows = keys.map((key) => {
      const recs = state.milkRecords.filter((r) => r.dateKey === key);
      const total = recs.reduce((s, r) => s + Number(r.yield || 0), 0);
      const cows = new Set(recs.map((r) => r.earTag)).size;
      const fat = recs.length ? recs.reduce((s, r) => s + Number(r.fat || 0), 0) / recs.length : 0;
      const protein = recs.length ? recs.reduce((s, r) => s + Number(r.protein || 0), 0) / recs.length : 0;
      const gradeA = recs.filter((r) => r.quality === 'A+' || r.quality === 'A').length;
      return {
        date: key,
        totalMilk: round(total, 1),
        cows,
        avgYield: cows ? round(total / cows, 1) : 1,
        fat: round(fat, 2),
        protein: round(protein, 2),
        qualityRate: recs.length ? round((gradeA / recs.length) * 100, 1) : 0,
      };
    });
    const total = rows.reduce((s, r) => s + r.totalMilk, 0);
    return {
      type,
      title: '产奶统计报表',
      subtitle: '按日汇总 · 乳品质量与单产分析',
      headers: ['日期', '产奶量 (L)', '泌乳牛数', '单产 (L/头)', '乳脂率 (%)', '乳蛋白率 (%)', 'A 级占比'],
      rows: rows.map((r) => [r.date, formatNumber(r.totalMilk, 1), formatNumber(r.cows), formatNumber(r.avgYield, 1), r.fat.toFixed(2), r.protein.toFixed(2), `${r.qualityRate}%`]),
      rawRows: rows,
      summary: {
        totalMilk: round(total, 1),
        avgDay: round(total / Math.max(rows.length, 1), 1),
        avgYield: round(rows.reduce((s, r) => s + r.avgYield, 0) / Math.max(rows.length, 1), 1),
        milkPerCow: round(total / Math.max(state.cows.filter((c) => c.group === '泌乳牛').length, 1), 1),
      },
      series: rows.map((r) => ({ label: r.date.slice(5), value: r.totalMilk })),
    };
  }
  if (type === 'health') {
    const rows = getHealthReportRows(state, days, now);
    const immunizations = state.workOrders.filter((w) => w.type === 'immunization' && w.status === 'done').length;
    const medications = state.workOrders.filter((w) => w.type === 'medication' && w.status === 'done').length;
    const avgScore = state.cows.reduce((s, c) => s + c.healthScore, 0) / Math.max(state.cows.length, 1);
    return {
      type,
      title: '健康管理报表',
      subtitle: '体征趋势 · 异常干预 · 免疫用药闭环',
      headers: ['日期', '健康采集', '平均健康分', '异常记录', '需复查', '平均反刍 (min)', '产奶量 (L)'],
      rows: rows.map((r) => [r.dateKey, formatNumber(r.records), r.avgScore.toFixed(1), formatNumber(r.abnormal), formatNumber(r.followUps), formatNumber(r.avgRumination), formatNumber(r.sampleMilk, 1)]),
      rawRows: rows,
      summary: {
        avgScore: round(avgScore, 1),
        abnormal: state.cows.filter((c) => c.healthStatus === 'risk').length,
        immunization: immunizations,
        medication: medications,
        followUps: state.cows.filter((c) => c.healthStatus !== 'healthy').length,
      },
      series: rows.map((r) => ({ label: r.label, value: r.avgScore })),
    };
  }
  // energy
  const rows = keys.map((key) => {
    const row = state.energyHistory.find((r) => r.dateKey === key) || { hvac: 0, lighting: 0, other: 0, total: 0 };
    const milk = state.milkRecords.filter((r) => r.dateKey === key).reduce((s, r) => s + Number(r.yield || 0), 0);
    return {
      date: key,
      hvac: row.hvac,
      lighting: row.lighting,
      other: row.other,
      total: row.total,
      milk: round(milk, 1),
      perLiter: milk ? round((row.total / milk) * 1000, 1) : 0,
    };
  });
  const total = rows.reduce((s, r) => s + r.total, 0);
  const totalMilk = rows.reduce((s, r) => s + r.milk, 0);
  return {
    type: 'energy',
    title: '环控能耗统计报表',
    subtitle: '通风 / 照明 / 其他设备 · 单位奶耗',
    headers: ['日期', '通风降温 (kWh)', '照明补光 (kWh)', '其他 (kWh)', '总能耗 (kWh)', '产奶量 (L)', '单位奶耗 (Wh/L)'],
    rows: rows.map((r) => [r.date, r.hvac.toFixed(1), r.lighting.toFixed(1), r.other.toFixed(1), r.total.toFixed(1), formatNumber(r.milk, 1), r.perLiter.toFixed(1)]),
    rawRows: rows,
    summary: {
      totalEnergy: round(total, 1),
      avgDay: round(total / Math.max(rows.length, 1), 1),
      intensity: totalMilk ? round((total / totalMilk) * 1000, 1) : 0,
      lightingShare: round((rows.reduce((s, r) => s + r.lighting, 0) / Math.max(total, 1)) * 100, 1),
      saving: round(total * 0.061, 1),
    },
    series: rows.map((r) => ({ label: r.date.slice(5), value: r.total })),
  };
}

export function toCSV(report) {
  const lines = [];
  lines.push(`${report.title}`);
  lines.push(`统计区间,${report.rawRows[0]?.date || ''} 至 ${report.rawRows[report.rawRows.length - 1]?.date || ''}`);
  lines.push('');
  lines.push(report.headers.join(','));
  for (const row of report.rows) {
    lines.push(row.map((cell) => `"${String(cell).replaceAll('"', '""')}"`).join(','));
  }
  return '\uFEFF' + lines.join('\r\n');
}

export function getRecentRecords(state, type = 'milk', earTag = null, limit = 10) {
  if (type === 'milk') {
    return state.milkRecords
      .filter((r) => !earTag || r.earTag === earTag)
      .sort((a, b) => new Date(b.milkedAt) - new Date(a.milkedAt))
      .slice(0, limit);
  }
  if (type === 'health') {
    return state.healthRecords
      .filter((r) => !earTag || r.earTag === earTag)
      .sort((a, b) => new Date(b.measuredAt) - new Date(a.measuredAt))
      .slice(0, limit);
  }
  if (type === 'breeding') {
    return state.breedingRecords
      .filter((r) => !earTag || r.earTag === earTag)
      .sort((a, b) => new Date(b.bredAt) - new Date(a.bredAt))
      .slice(0, limit);
  }
  return [];
}

export function searchCows(state, { query = '', barnId = 'ALL', status = 'ALL', group = 'ALL' } = {}) {
  return state.cows.filter((cow) => {
    const keyword = query.trim().toLowerCase();
    const matchKeyword = !keyword || cow.earTag.toLowerCase().includes(keyword) || cow.name.includes(keyword);
    const matchBarn = barnId === 'ALL' || cow.barnId === barnId;
    const matchStatus = status === 'ALL' || cow.healthStatus === status;
    const matchGroup = group === 'ALL' || cow.group === group;
    return matchKeyword && matchBarn && matchStatus && matchGroup;
  });
}

export function nextOrderNo(state, date = new Date()) {
  const key = localDateKey(date).replaceAll('-', '');
  const existing = state.workOrders.filter((w) => w.orderNo.includes(key)).length;
  return `WO-${key}-${pad(existing + 1, 3)}`;
}

export function buildAuditEntry(category, action, detail, target = '') {
  return {
    id: uid('TRC'),
    at: new Date().toISOString(),
    category,
    actor: '牧场管理员',
    action,
    target,
    detail,
  };
}

export function addAudit(state, category, action, detail, target = '', actor = '牧场管理员') {
  state.traceLogs.unshift({
    id: uid('TRC'),
    at: new Date().toISOString(),
    category,
    actor,
    action,
    target,
    detail,
  });
}

export function saveState(state) {
  try {
    const clone = {
      ...state,
      environmentHistory: Object.fromEntries(
        Object.entries(state.environmentHistory).map(([k, arr]) => [k, arr.slice(-160)]),
      ),
    };
    localStorage.setItem(STORAGE_KEY, JSON.stringify(clone));
    return true;
  } catch (error) {
    console.warn('本地持久化失败，继续使用内存状态', error);
    return false;
  }
}

export function loadState() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const state = JSON.parse(raw);
    if (!state || state.version !== APP_VERSION) return null;
    return state;
  } catch {
    return null;
  }
}

export function resetState() {
  localStorage.removeItem(STORAGE_KEY);
}

/* ------------------------------------------------------------------ */
/* 业务动作：越限判定、联动、工单流转                                   */
/* ------------------------------------------------------------------ */

export function evaluateThresholds(state) {
  const findings = [];
  for (const barn of state.barns) {
    for (const metric of ['temperature', 'humidity', 'nh3', 'light']) {
      const stateValue = getMetricState(barn, metric);
      if (stateValue === 'ok') continue;
      const threshold = metricThreshold(barn, metric);
      const value = barn[metric];
      const isLow = stateValue === 'low';
      const limit = isLow ? threshold.low : threshold.high;
      const diffRatio = isLow ? (limit - value) / Math.max(limit, 1) : (value - limit) / Math.max(limit, 1);
      const level = diffRatio > 0.12 ? 'critical' : 'warning';
      findings.push({ barn, metric, isLow, value, limit, level });
    }
  }
  return findings;
}

export function linkedDeviceFor(barnId, metric, state) {
  const barnDevices = state.devices.filter((d) => d.barnId === barnId && d.type !== 'sensor');
  if (metric === 'nh3') return barnDevices.find((d) => d.type === 'exhaust') || barnDevices.find((d) => d.type === 'fan');
  if (metric === 'temperature') return barnDevices.find((d) => d.type === 'fan') || barnDevices.find((d) => d.type === 'mist');
  if (metric === 'humidity') return barnDevices.find((d) => d.type === 'exhaust') || barnDevices.find((d) => d.type === 'fan');
  if (metric === 'light') return barnDevices.find((d) => d.type === 'light');
  return null;
}

export function alarmTitleFor(metric, isLow) {
  if (metric === 'temperature') return isLow ? '低温预警' : '高温预警';
  if (metric === 'humidity') return isLow ? '湿度偏低' : '湿度偏高';
  if (metric === 'nh3') return '氨气浓度越限';
  if (metric === 'light') return isLow ? '光照偏低' : '光照过强';
  return '环境越限';
}

/**
 * 将采集值写入历史，并返回新产生的告警（去重）。
 * 注意：此函数不直接修改设备的 running；由应用层决定是否自动联动。
 */
export function recordEnvironmentReading(state, barn, reading) {
  const now = new Date();
  barn.temperature = round(reading.temperature, 1);
  barn.humidity = round(reading.humidity, 1);
  barn.nh3 = round(reading.nh3, 1);
  barn.light = Math.round(reading.light);
  barn.updatedAt = now.toISOString();
  if (!state.environmentHistory[barn.barnId]) state.environmentHistory[barn.barnId] = [];
  const points = state.environmentHistory[barn.barnId];
  const last = points[points.length - 1];
  if (!last || Date.now() - new Date(last.at).getTime() > 8000) {
    points.push({
      at: now.toISOString(),
      temperature: barn.temperature,
      humidity: barn.humidity,
      nh3: barn.nh3,
      light: barn.light,
      energy: round(Math.random() * 1.6 + 0.4, 2),
    });
    if (points.length > 160) points.splice(0, points.length - 160);
  } else {
    Object.assign(last, {
      temperature: barn.temperature,
      humidity: barn.humidity,
      nh3: barn.nh3,
      light: barn.light,
    });
  }
  const created = [];
  const today = localDateKey(now);
  for (const finding of evaluateThresholds(state)) {
    if (finding.barn.barnId !== barn.barnId) continue;
    const { metric, isLow, value, limit, level } = finding;
    const already = state.alarms.find(
      (a) => a.barnId === barn.barnId && a.metric === metric && a.status === 'active',
    );
    if (already) continue;
    const linkedDevice = linkedDeviceFor(barn.barnId, metric, state);
    const alarm = {
      alarmId: uid('ALM'),
      code: `ENV-${metric.toUpperCase()}-${state.alarms.length + 1}`,
      barnId: barn.barnId,
      metric,
      level,
      title: alarmTitleFor(metric, isLow),
      message: `${barn.name} ${METRIC_META[metric].label} ${value}${METRIC_META[metric].unit}，${isLow ? '低于下限' : '超过阈值'} ${limit}${METRIC_META[metric].unit}`,
      value,
      threshold: limit,
      status: 'active',
      createdAt: now.toISOString(),
      dateKey: today,
      acknowledged: false,
      acknowledgedBy: null,
      resolvedAt: null,
      linkedDeviceId: linkedDevice?.deviceId || null,
      linkedAction: null,
      suggestion: buildLinkSuggestion(metric, isLow),
      isManual: false,
    };
    state.alarms.unshift(alarm);
    created.push(alarm);
  }
  return created;
}

export function buildLinkSuggestion(metric, isLow) {
  if (metric === 'temperature' && !isLow) return '建议联动循环风机与高压微雾，快速降低体感温度。';
  if (metric === 'temperature' && isLow) return '建议联动保温灯组并检查门窗密闭性。';
  if (metric === 'nh3') return '建议联动纵向排风，清理粪道并提高换气次数。';
  if (metric === 'humidity' && !isLow) return '建议联动排风除湿，检查饮水器与排水沟。';
  if (metric === 'humidity' && isLow) return '建议联动微雾加湿，观察牛只呼吸道状态。';
  if (metric === 'light' && isLow) return '建议联动补光灯，保持犊牛活动区照度。';
  return '建议检查环控设备运行状态。';
}

export function applyLinkage(state, alarm, actor = '自动环控') {
  const device = state.devices.find((d) => d.deviceId === alarm.linkedDeviceId);
  if (!device) return null;
  const wasRunning = device.running;
  device.running = true;
  device.mode = 'auto';
  device.lastAction = `联动响应 · ${alarm.title}`;
  device.lastActionAt = new Date().toISOString();
  alarm.linkedAction = wasRunning ? `确认 ${device.name} 持续运行` : `已联动 ${device.name}`;
  alarm.acknowledged = true;
  alarm.acknowledgedBy = actor;
  const log = buildAuditEntry('联动', `${device.name} 联动启动`, `${alarm.title}：${alarm.suggestion}`, `${alarm.barnId} · ${device.name}`);
  log.actor = actor;
  state.traceLogs.unshift(log);
  return device;
}

export function resolveEnvironmentAlarms(state, barn) {
  const resolved = [];
  for (const alarm of state.alarms) {
    if (alarm.status !== 'active' || alarm.barnId !== barn.barnId) continue;
    if (getMetricState(barn, alarm.metric) === 'ok') {
      // 连续两次回到安全区间才自动恢复，避免传感器抖动造成告警闪烁。
      alarm.normalStreak = Number(alarm.normalStreak || 0) + 1;
      if (alarm.normalStreak >= 2) {
        alarm.status = 'resolved';
        alarm.resolvedAt = new Date().toISOString();
        resolved.push(alarm);
      }
    } else {
      alarm.normalStreak = 0;
    }
  }
  return resolved;
}

export function advanceWorkOrder(state, orderNo, action, detail = '', actor = '牧场管理员') {
  const order = state.workOrders.find((w) => w.orderNo === orderNo);
  if (!order) return null;
  const now = new Date().toISOString();
  if (action === 'start' && order.status === 'pending') {
    order.status = 'in_progress';
    order.trace.push({ id: uid('WT'), at: now, actor, action: '开始执行', detail: detail || '已到达现场并开始作业' });
  } else if (action === 'complete' && order.status !== 'done') {
    order.status = 'done';
    order.completedAt = now;
    order.trace.push({ id: uid('WT'), at: now, actor, action: '完成并签字', detail: detail || '任务完成，资料归档' });
    order.steps = order.steps.map((step) => ({ ...step, done: true }));
    if (order.type === 'immunization' || order.type === 'medication') {
      state.traceLogs.unshift({
        id: uid('TRC'),
        at: now,
        category: order.type === 'immunization' ? '免疫' : '用药',
        actor,
        action: `${order.title} · 已完成`,
        target: order.targetLabel,
        detail: `${order.meta?.product || ''} ${order.meta?.batchNo ? `批号 ${order.meta.batchNo}` : ''} ${order.meta?.dose || ''} ${order.meta?.withdrawalDays != null ? `休药期 ${order.meta.withdrawalDays} 天` : ''}`.trim(),
        orderNo: order.orderNo,
      });
    }
  } else if (action === 'step') {
    const stepIndex = Number(detail);
    if (order.steps[stepIndex]) {
      order.steps[stepIndex].done = !order.steps[stepIndex].done;
      order.trace.push({
        id: uid('WT'),
        at: now,
        actor,
        action: order.steps[stepIndex].done ? '勾选检查项' : '取消检查项',
        detail: order.steps[stepIndex].label,
      });
    }
  } else if (action === 'note' && detail) {
    order.trace.push({ id: uid('WT'), at: now, actor, action: '补充记录', detail });
  }
  order.updatedAt = now;
  if (action === 'start' || action === 'complete' || action === 'note') {
    state.traceLogs.unshift({
      id: uid('TRC'),
      at: now,
      category: order.type === 'inspection' ? '巡检' : order.type === 'immunization' ? '免疫' : '用药',
      actor,
      action: `${order.title} · ${action === 'start' ? '开始执行' : action === 'complete' ? '已完成' : '补充记录'}`,
      target: order.targetLabel,
      detail: detail || '',
      orderNo: order.orderNo,
    });
  }
  return order;
}
