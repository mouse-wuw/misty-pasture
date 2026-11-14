/**
 * 云栖智慧牧场 · 应用编排
 * 连接 Three.js 场景、数字孪生数据、表单、工作流与大屏。
 */

import {
  APP_VERSION,
  MILK_SESSIONS,
  HEALTH_STATUS,
  METRIC_META,
  DEVICE_META,
  WORK_TYPE,
  WORK_STATUS,
  OBJECT_MODELS,
  STORAGE_KEY,
  pad,
  localDateKey,
  localDateTime,
  relativeDateLabel,
  formatNumber,
  uid,
  clamp,
  fmtClock,
  daylightLabel,
  metricThreshold,
  getMetricState,
  getBarnState,
  createDemoState,
  cowByTag,
  barnById,
  devicesForBarn,
  activeAlarms,
  computeMetrics,
  getTotalMilkSeries,
  getCowMilkSeries,
  getLatestCowHealth,
  getLatestCowMilk,
  getBarnEnvSeries,
  getHealthDistribution,
  getGroupHealthStats,
  getEnergyReport,
  buildReport,
  toCSV,
  getRecentRecords,
  searchCows,
  nextOrderNo,
  addAudit,
  saveState,
  loadState,
  applyLinkage,
  resolveEnvironmentAlarms,
  recordEnvironmentReading,
  advanceWorkOrder,
} from './data.js?v=2';
import { PastureScene } from './scene.js?v=2';
import {
  ChartHub,
  milkTrendOption,
  healthDonutOption,
  healthScoreOption,
  environmentTrendOption,
  energyOption,
  groupHealthBarOption,
  miniSparkline,
} from './charts.js?v=2';
import { icon, logoMark } from './icons.js?v=2';

/* ------------------------------------------------------------------ */
/* 基础                                                                */
/* ------------------------------------------------------------------ */

const $ = (selector, root = document) => root.querySelector(selector);
const $$ = (selector, root = document) => [...root.querySelectorAll(selector)];

const ESCAPE_MAP = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#039;' };
const esc = (value = '') => String(value).replace(/[&<>"']/g, (char) => ESCAPE_MAP[char]);
const safeId = (value = '') => String(value).replace(/[^a-zA-Z0-9_-]/g, '');
const fmt = (value, digits = 0) => formatNumber(value, digits);
const timeOnly = (iso) => {
  if (!iso) return '—';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '—';
  return `${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}`;
};
const clockOnly = (iso) => {
  if (!iso) return '—';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '—';
  return `${pad(d.getHours())}:${pad(d.getMinutes())}`;
};
const dateOnly = (iso) => {
  if (!iso) return '—';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '—';
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
};
const inputDateTime = (date = new Date()) => {
  const d = date instanceof Date ? date : new Date(date);
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
};
const inputDate = (date = new Date()) => {
  const d = date instanceof Date ? date : new Date(date);
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
};
const todayKey = () => localDateKey(new Date());
const statusBadge = (statusKey, label) => {
  const meta = HEALTH_STATUS[statusKey] || HEALTH_STATUS.watch;
  return `<span class="status-badge ${meta.className}">${esc(label || meta.label)}</span>`;
};
const workflowBadge = (statusKey) => {
  const meta = WORK_STATUS[statusKey] || WORK_STATUS.pending;
  const cls = statusKey === 'done' ? 'ok' : statusKey === 'in_progress' ? 'watch' : 'neutral';
  return `<span class="status-badge ${cls}">${meta.label}</span>`;
};
const smallBtn = (label, action, options = {}) => {
  const attrs = Object.entries(options.attrs || {}).map(([key, value]) => `${key}="${esc(value)}"`).join(' ');
  return `<button class="btn ${options.className || 'btn-sm'}" type="button" data-action="${esc(action)}" ${attrs}>${options.icon ? icon(options.icon, 12) : ''}${esc(label)}</button>`;
};
const linkButton = (label, action, attrs = {}) => {
  const dataAttrs = Object.entries(attrs).map(([key, value]) => `data-${esc(key)}="${esc(value)}"`).join(' ');
  return `<button type="button" class="text-link" data-action="${esc(action)}" ${dataAttrs}>${esc(label)}${icon('arrowRight', 11)}</button>`;
};

const iconButton = (name, size = 16) => icon(name, size);
const metricIcon = (metric) => METRIC_META[metric]?.icon || 'leaf';

function iconLabel(name, label, size = 14) {
  return `<span class="icon-label">${icon(name, size)}<span>${esc(label)}</span></span>`;
}

function cowAvatar(cow, view = 'large') {
  if (!cow) return `<div class="cow-portrait"></div>`;
  const schemes = [
    { bg: '#506b54', fur: '#eee1cb', spot: '#675548', ear: '#d7a695', horn: '#d9c7a7' },
    { bg: '#4d5f52', fur: '#c99771', spot: '#f0dfc6', ear: '#d7a695', horn: '#e4d3b3' },
    { bg: '#465a54', fur: '#e4d7c2', spot: '#534c43', ear: '#d7a695', horn: '#e8d6b8' },
    { bg: '#5a624d', fur: '#cdb08d', spot: '#755746', ear: '#ddb09e', horn: '#e6d2b0' },
  ];
  const seed = [...(cow.earTag || '')].reduce((sum, c) => sum + c.charCodeAt(0), 0);
  const s = schemes[seed % schemes.length];
  const gradientId = `cow-grad-${safeId(cow.earTag)}-${view}`;
  const statusColor = cow.healthStatus === 'risk' ? '#f18f7d' : cow.healthStatus === 'watch' ? '#f0c987' : '#8fe3c8';
  return `<svg viewBox="0 0 100 100" fill="none" role="img" aria-label="${esc(cow.name)}">
    <defs>
      <radialGradient id="${gradientId}" cx="0" cy="0" r="1" gradientTransform="translate(30 20) rotate(45) scale(83)">
        <stop stop-color="${s.bg}" stop-opacity=".92"/><stop offset="1" stop-color="#0c1d16"/>
      </radialGradient>
      <linearGradient id="${gradientId}-fur" x1="36" y1="25" x2="63" y2="77"><stop stop-color="${s.fur}"/><stop offset="1" stop-color="${s.fur}" stop-opacity=".8"/></linearGradient>
    </defs>
    <circle cx="50" cy="50" r="48" fill="url(#${gradientId})"/>
    <circle cx="50" cy="50" r="48" stroke="${statusColor}" stroke-opacity=".18"/>
    <path d="M34 31c-5-7-12-8-16-4-4 5-1 11 8 11 5 0 8-3 8-7Z" fill="${s.fur}" stroke="rgba(30,30,20,.2)"/>
    <path d="M66 31c5-7 12-8 16-4 4 5 1 11-8 11-5 0-8-3-8-7Z" fill="${s.fur}" stroke="rgba(30,30,20,.2)"/>
    <path d="M33 34c0-14 8-23 17-23s17 9 17 23v20c0 13-8 22-17 22s-17-9-17-22V34Z" fill="url(#${gradientId}-fur)" stroke="rgba(36,35,28,.28)" stroke-width="1"/>
    <path d="M43 15c-1-4 1-7 3-8M57 15c1-4-1-7-3-8" stroke="${s.horn}" stroke-width="3" stroke-linecap="round"/>
    <path d="M35 36c1-10 5-15 11-17 1 5-1 13-6 18-2 2-4 1-5-1Z" fill="${s.spot}" opacity=".8"/>
    <path d="M65 47c4 1 6 5 5 10-1 5-4 9-8 9-2-4-1-12 3-19Z" fill="${s.spot}" opacity=".7"/>
    <ellipse cx="40" cy="48" rx="9" ry="10" fill="${s.fur}"/>
    <ellipse cx="60" cy="48" rx="9" ry="10" fill="${s.fur}"/>
    <ellipse cx="50" cy="62" rx="15" ry="12" fill="${s.ear}"/>
    <ellipse cx="45" cy="60" rx="3" ry="2" fill="rgba(85,48,45,.5)"/>
    <ellipse cx="55" cy="60" rx="3" ry="2" fill="rgba(85,48,45,.5)"/>
    <circle cx="41" cy="42" r="2.4" fill="#2d2a23"/>
    <circle cx="59" cy="42" r="2.4" fill="#2d2a23"/>
    <circle cx="41.8" cy="41.4" r=".8" fill="#fff8e9"/>
    <circle cx="59.8" cy="41.4" r=".8" fill="#fff8e9"/>
    <path d="M44 71c3 2 9 2 12 0" stroke="rgba(91,54,48,.65)" stroke-width="1.1" stroke-linecap="round"/>
    <rect x="61" y="33" width="7" height="10" rx="2" fill="#e8c56c" transform="rotate(12 64 38)"/>
    <circle cx="50" cy="73" r="1.3" fill="${statusColor}" opacity=".8"/>
  </svg>`;
}

/* ------------------------------------------------------------------ */
/* 应用状态                                                             */
/* ------------------------------------------------------------------ */

const chartHub = new ChartHub();
let state = loadState();
let scene = null;
let tickTimer = null;
let saveTimer = null;
let lastSavedAt = 0;
let bootFinished = false;
let demoDataWasReset = false;

state = state && state.version === APP_VERSION ? state : createDemoState();
if (!state.demoDate || state.demoDate !== localDateKey()) {
  state = createDemoState();
  demoDataWasReset = true;
}
state.settings = {
  autoControl: true,
  autoDaylight: true,
  autoRotate: false,
  labels: true,
  cowTags: false,
  fog: true,
  clouds: true,
  volumetric: true,
  tiltShift: true,
  fireflies: true,
  bloom: 0.24,
  exposure: 0.92,
  daylightSpeed: 1,
  simHour: 17.18,
  quality: 'auto',
  ...(state.settings || {}),
};

// 支持用地址参数强制档位，例如 ?q=smooth，方便在别的机器上快速验证
const QUALITY_PARAM = (() => {
  try {
    return new URLSearchParams(location.search).get('q');
  } catch (error) {
    return null;
  }
})();
if (QUALITY_PARAM && ['auto', 'ultra', 'high', 'balanced', 'smooth', 'minimal'].includes(QUALITY_PARAM)) {
  state.settings.quality = QUALITY_PARAM;
}
saveState(state);

const firstShowcase = state.cows.find((cow) => cow.showcase && cow.barnId === 'B01' && cow.healthStatus === 'healthy')
  || state.cows.find((cow) => cow.showcase)
  || state.cows[0];
const ui = {
  view: 'roam',
  selectedCow: firstShowcase?.earTag || null,
  selectedBarn: firstShowcase?.barnId || state.barns[0].barnId,
  envBarn: firstShowcase?.barnId || state.barns[0].barnId,
  envMetric: 'temperature',
  milkFilters: { query: '', barn: 'ALL', status: 'ALL', group: 'ALL' },
  milkPage: 0,
  recordTab: 'milk',
  recordScope: 'selected',
  auditFilter: 'ALL',
  reportType: 'production',
  reportDays: 7,
  modalOpen: false,
  alarmDrawerOpen: false,
  controlDrawerOpen: false,
  lastTime: null,
};

/* ------------------------------------------------------------------ */
/* 启动                                                                */
/* ------------------------------------------------------------------ */

function injectStaticIcons() {
  $('#brandMark').innerHTML = logoMark(34);
  $('#bootLogo').innerHTML = logoMark(76);
  $('#alarmBellIcon').innerHTML = icon('bell', 16);
  $('#controlGearIcon').innerHTML = icon('settings', 16);
  $('#headerPhaseIcon').innerHTML = icon('sunset', 14);
  $$('[data-icon]').forEach((el) => {
    el.innerHTML = icon(el.dataset.icon, 14);
  });
}

function setHeaderDate() {
  const d = new Date();
  const weekdays = ['周日', '周一', '周二', '周三', '周四', '周五', '周六'];
  $('#headerDate').textContent = `${d.getFullYear()}.${pad(d.getMonth() + 1)}.${pad(d.getDate())} · ${weekdays[d.getDay()]}`;
}

function setBootProgress(percent, status) {
  const progress = $('#bootProgress');
  const label = $('#bootPercent');
  if (progress) progress.style.width = `${Math.min(100, percent)}%`;
  if (label) label.textContent = `${Math.round(Math.min(100, percent))}%`;
  if (status) $('#bootStatus').textContent = status;
}

function finishBoot() {
  if (bootFinished) return;
  bootFinished = true;
  setBootProgress(100, '牧场已就绪 · 正在打开薄雾');
  setTimeout(() => {
    $('#bootScreen').classList.add('is-hidden');
    setTimeout(() => {
      const active = activeAlarms(state);
      if (active.length) {
        showToast({
          tone: active.some((a) => a.level === 'critical') ? 'danger' : 'warning',
          icon: 'warning',
          title: `环境越限 · ${active[0].barnId} ${METRIC_META[active[0].metric]?.label || ''}`,
          message: active[0].linkedAction ? `${active[0].message}，${active[0].linkedAction}。` : `${active[0].message}。请打开报警中心处理。`,
          duration: 7800,
        });
      }
      if (demoDataWasReset) {
        showToast({ tone: 'info', icon: 'spark', title: '演示数据已更新', message: '为保持今日数据一致，系统已生成一组新的牧场时序数据。' });
      }
    }, 600);
  }, 500);
}

function showError(message) {
  $('#errorScreen').hidden = false;
  $('#errorMessage').textContent = message || '请使用支持 WebGL 的现代浏览器，并刷新页面重试。';
  $('#bootScreen').classList.add('is-hidden');
}

function persist(force = false) {
  if (!state) return;
  const now = performance.now();
  if (!force && now - lastSavedAt < 15000) return;
  state.settings.simHour = state.settings.simHour ?? scene?.hour ?? 17;
  saveState(state);
  lastSavedAt = now;
}

function refreshGlobal({ view = false } = {}) {
  renderHeaderStatus();
  renderSidebar();
  renderFocusPanel();
  if (ui.alarmDrawerOpen) renderAlarmDrawer();
  if (view && ui.view !== 'roam') renderView();
}

function startApp() {
  injectStaticIcons();
  setHeaderDate();
  setBootProgress(12, '初始化牛舍与牛群物模型…');
  bindEvents();
  renderHeaderStatus();
  renderSidebar();
  renderFocusPanel();
  renderControlDrawer();
  renderAlarmDrawer();
  setTimeout(initializeScene, 110);
}

function initializeScene() {
  setBootProgress(36, '搭建牛舍、环控设备与微缩生态…');
  try {
    scene = new PastureScene({
      canvas: $('#sceneCanvas'),
      labelsEl: $('#sceneLabels'),
      state,
      onSelect: handleSceneSelection,
      onTime: handleTimeTick,
      onReady: finishBoot,
    });
    scene.init();
    window.__MISTY_PASTURE__ = { scene, getState: () => state, ui, chartHub };
    scene.setOptions({
      autoDaylight: state.settings.autoDaylight,
      autoRotate: state.settings.autoRotate,
      labels: state.settings.labels,
      cowTags: state.settings.cowTags,
      fog: state.settings.fog,
      clouds: state.settings.clouds,
      volumetric: state.settings.volumetric,
      tiltShift: state.settings.tiltShift,
      fireflies: state.settings.fireflies,
      bloom: state.settings.bloom,
      exposure: state.settings.exposure,
      daylightSpeed: state.settings.daylightSpeed,
      quality: state.settings.quality || 'auto',
    });
    startPerfMonitor();
    if (ui.selectedCow) {
      scene.setSelectedFromExternal('cow', ui.selectedCow);
      scene.showCowTag(ui.selectedCow);
    }
    setBootProgress(76, '点亮体积光、飘云与薄雾…');
    if (tickTimer) clearInterval(tickTimer);
    tickTimer = setInterval(runSimulationTick, 10000);
    if (saveTimer) clearInterval(saveTimer);
    saveTimer = setInterval(() => persist(true), 30000);
  } catch (error) {
    console.error(error);
    showError(error?.message || 'Three.js 场景初始化失败，请确认浏览器支持 WebGL 2。');
  }
}

/* ------------------------------------------------------------------ */
/* 事件                                                                */
/* ------------------------------------------------------------------ */

function bindEvents() {
  $('#alarmButton').addEventListener('click', () => {
    closeDrawer('control');
    openAlarmDrawer();
  });
  $('#controlButton').addEventListener('click', () => {
    if (ui.view !== 'roam') closeView();
    closeDrawer('alarm');
    openControlDrawer();
  });
  $('#closeViewButton').addEventListener('click', closeView);
  $('#modalRoot').addEventListener('click', (event) => {
    if (event.target.closest('[data-close-modal]')) closeModal();
  });
  $$('[data-close-drawer]').forEach((button) => {
    button.addEventListener('click', () => closeDrawer(button.dataset.closeDrawer));
  });

  document.addEventListener('click', handleDocumentClick);
  document.addEventListener('submit', handleFormSubmit);
  document.addEventListener('change', handleFormChange);
  document.addEventListener('input', handleRangeInput);
  document.addEventListener('keydown', (event) => {
    if (event.key !== 'Escape') return;
    if (ui.modalOpen) {
      closeModal();
    } else if (ui.controlDrawerOpen) {
      closeDrawer('control');
    } else if (ui.alarmDrawerOpen) {
      closeDrawer('alarm');
    } else if (ui.view !== 'roam') {
      closeView();
    }
  });
  window.addEventListener('beforeunload', () => persist(true));
  window.addEventListener('resize', () => chartHub.resizeAll());
  window.addEventListener('visibilitychange', () => {
    if (document.hidden) persist(true);
    scene?.setPaused(document.hidden || ui.view !== 'roam');
  });
}

function handleDocumentClick(event) {
  const closeDrawerButton = event.target.closest('[data-close-drawer]');
  if (closeDrawerButton) {
    closeDrawer(closeDrawerButton.dataset.closeDrawer);
    return;
  }
  if (event.target.closest('[data-close-modal]')) {
    closeModal();
    return;
  }
  const viewTarget = event.target.closest('[data-view]');
  if (viewTarget) {
    event.preventDefault();
    if (viewTarget.dataset.view === 'roam') closeView();
    else openView(viewTarget.dataset.view);
    return;
  }
  const actionTarget = event.target.closest('[data-action]');
  if (!actionTarget) return;
  event.preventDefault();
  handleAction(actionTarget.dataset.action, actionTarget);
}

function handleFormChange(event) {
  const target = event.target;
  if (target.matches('[name="workType"], [name="targetType"], [name="workGroup"]')) {
    updateWorkFormVisibility(target.closest('form'));
  }
  if (target.id === 'groupTarget' || target.name === 'groupTarget') {
    updateGroupHint(target.closest('form'));
  }
  if (target.id === 'workBarn') {
    updateWorkTargetOptions(target.closest('form'));
  }
  if (target.matches('[data-setting-select]')) {
    applySceneSetting(target.dataset.settingSelect, target.value);
  }
}

function handleRangeInput(event) {
  const input = event.target;
  if (input.id === 'timeRange') {
    const value = Number(input.value);
    state.settings.autoDaylight = false;
    scene?.setOptions({ autoDaylight: false });
    scene?.setHour(value);
    state.settings.simHour = value;
    const display = $('#controlClock');
    if (display) display.textContent = fmtClock(value);
    const phase = daylightLabel(value);
    const phaseEl = $('#controlPhase');
    if (phaseEl) phaseEl.textContent = phase.label;
    syncToggleElement('autoDaylight', false);
    return;
  }
  if (input.id === 'exposureRange') {
    const value = Number(input.value) / 100;
    state.settings.exposure = value;
    scene?.setOptions({ exposure: value });
    const display = $('#exposureValue');
    if (display) display.textContent = value.toFixed(2);
    return;
  }
  if (input.id === 'bloomRange') {
    const value = Number(input.value) / 100;
    state.settings.bloom = value;
    scene?.setOptions({ bloom: value });
    const display = $('#bloomValue');
    if (display) display.textContent = value.toFixed(2);
    return;
  }
  if (input.id === 'timeSpeedRange') {
    const value = Number(input.value);
    state.settings.daylightSpeed = value;
    scene?.setOptions({ daylightSpeed: value });
    const display = $('#speedValue');
    if (display) display.textContent = `${value.toFixed(1)}×`;
  }
}

/* ------------------------------------------------------------------ */
/* 核心动作                                                             */
/* ------------------------------------------------------------------ */

function handleAction(action, element) {
  const dataset = element.dataset;
  switch (action) {
    case 'select-env-barn':
      ui.envBarn = dataset.barn;
      ui.selectedBarn = dataset.barn;
      renderView();
      scene?.setSelectedFromExternal('barn', dataset.barn);
      break;
    case 'env-metric':
      ui.envMetric = dataset.metric;
      renderView();
      break;
    case 'focus-barn': {
      const barn = barnById(state, dataset.barn);
      ui.selectedBarn = dataset.barn;
      ui.envBarn = dataset.barn;
      scene?.select('barn', dataset.barn, true);
      renderSidebar();
      renderAlarmDrawer();
      if (barn) showToast({ tone: 'info', icon: 'location', title: `已聚焦 ${barn.barnId} · ${barn.name}`, message: `${barn.temperature.toFixed(1)}°C · 湿度 ${barn.humidity.toFixed(0)}% · NH₃ ${barn.nh3.toFixed(1)} ppm` });
      break;
    }
    case 'open-env':
      ui.envBarn = dataset.barn || ui.selectedBarn;
      openView('environment');
      break;
    case 'toggle-auto-control':
      toggleAutoControl();
      break;
    case 'toggle-setting':
      toggleSceneSetting(dataset.setting);
      break;
    case 'set-speed':
      state.settings.daylightSpeed = Number(dataset.speed);
      scene?.setOptions({ daylightSpeed: Number(dataset.speed) });
      renderControlDrawer();
      break;
    case 'set-quality':
      applyQualityChoice(dataset.quality);
      break;
    case 'focus-scene':
      scene?.focusTarget(dataset.target);
      closeDrawer('control');
      showToast({ tone: 'info', icon: 'eye', title: '视角已调整', message: dataset.target === 'overview' ? '回到微缩牧场全景。' : `正在聚焦 ${dataset.target}。` });
      break;
    case 'reset-view':
      scene?.focusTarget('overview');
      break;
    case 'reset-demo':
      openResetModal();
      break;
    case 'open-alarm-drawer':
      closeDrawer('control');
      openAlarmDrawer();
      break;
    case 'ack-alarm':
      acknowledgeAlarm(dataset.alarm);
      break;
    case 'link-alarm':
      linkAlarm(dataset.alarm);
      break;
    case 'resolve-alarm':
      resolveAlarmManually(dataset.alarm);
      break;
    case 'simulate-alert':
      injectDemoAlarm(dataset.barn);
      break;
    case 'refresh-view':
      renderView();
      showToast({ tone: 'success', icon: 'activity', title: '数据已刷新', message: '已同步最新环境采集与业务记录。' });
      break;
    case 'open-threshold':
      openThresholdModal(dataset.barn || ui.envBarn);
      break;
    case 'toggle-device':
      toggleDevice(dataset.device);
      break;
    case 'select-cow':
      selectCow(dataset.tag, { focus: true, rerender: ui.view !== 'roam' });
      break;
    case 'open-cow':
      ui.selectedCow = dataset.tag;
      scene?.setSelectedFromExternal('cow', dataset.tag);
      openView('milk');
      break;
    case 'open-form':
      openDataForm(dataset.form, { mode: dataset.mode, cow: dataset.cow || ui.selectedCow, workType: dataset.worktype });
      break;
    case 'switch-form-mode':
      switchFormMode(element.dataset.mode);
      break;
    case 'apply-milk-filter':
      applyMilkFilters();
      break;
    case 'page-cows':
      ui.milkPage = Math.max(0, Number(dataset.page));
      renderView();
      break;
    case 'select-cow-row':
      ui.selectedCow = dataset.tag;
      ui.recordScope = 'selected';
      scene?.setSelectedFromExternal('cow', dataset.tag);
      renderView();
      renderFocusPanel();
      break;
    case 'record-tab':
      ui.recordTab = dataset.tab;
      renderView();
      break;
    case 'record-scope':
      ui.recordScope = dataset.scope;
      renderView();
      break;
    case 'audit-filter':
      ui.auditFilter = dataset.filter;
      renderView();
      break;
    case 'report-type':
      ui.reportType = dataset.report;
      renderView();
      break;
    case 'report-days':
      ui.reportDays = Number(dataset.days);
      renderView();
      break;
    case 'export-csv':
      exportReportCSV();
      break;
    case 'print-report':
      printCurrentReport();
      break;
    case 'export-models':
      exportModels();
      break;
    case 'open-order':
      openOrderDetail(dataset.order);
      break;
    case 'start-order':
      startOrder(dataset.order);
      break;
    case 'complete-order':
      openCompleteOrderModal(dataset.order);
      break;
    case 'toggle-step':
      toggleOrderStep(dataset.order, Number(dataset.index));
      break;
    case 'open-alarm-center':
      openAlarmDrawer();
      break;
    case 'open-model':
      openModelDetail(dataset.model);
      break;
    case 'confirm-reset':
      localStorage.removeItem(STORAGE_KEY);
      location.reload();
      break;
    default:
      break;
  }
}

function handleSceneSelection(type, id) {
  if (type === 'cow') {
    ui.selectedCow = id;
    const cow = cowByTag(state, id);
    if (cow) {
      ui.selectedBarn = cow.barnId;
      renderFocusPanel();
      if (ui.view === 'milk') renderView();
      showToast({ tone: 'info', icon: 'cow', title: `${cow.earTag} · ${cow.name}`, message: `健康评分 ${cow.healthScore}，今日产奶 ${cow.milkToday.toFixed(1)} L。点击右侧可录入新记录。`, duration: 3400 });
    }
  } else if (type === 'barn') {
    ui.selectedBarn = id;
    ui.envBarn = id;
    renderSidebar();
    if (ui.alarmDrawerOpen) renderAlarmDrawer();
  }
}

function selectCow(tag, { focus = false, rerender = true } = {}) {
  const cow = cowByTag(state, tag);
  if (!cow) return;
  ui.selectedCow = tag;
  ui.selectedBarn = cow.barnId;
  if (scene) {
    scene.setSelectedFromExternal('cow', tag);
    if (focus) scene.focusCow(tag);
  }
  renderFocusPanel();
  renderSidebar();
  if (rerender) renderView();
}

function toggleAutoControl() {
  state.settings.autoControl = !state.settings.autoControl;
  persist(true);
  scene?.syncState(state);
  renderSidebar();
  if (ui.alarmDrawerOpen) renderAlarmDrawer();
  if (ui.view === 'environment' || ui.view === 'ops') renderView();
  showToast({
    tone: state.settings.autoControl ? 'success' : 'warning',
    icon: 'link',
    title: state.settings.autoControl ? '自动环控已开启' : '自动环控已暂停',
    message: state.settings.autoControl ? '环境越限时将自动联动排风、风机与微雾，并记录审计轨迹。' : '越限提示保留，但设备需要人工确认后联动。',
  });
}

function applySceneSetting(setting, value) {
  if (!setting) return;
  const bool = typeof value === 'boolean' ? value : value === 'true' || value === true;
  const next = ['bloom', 'exposure', 'daylightSpeed'].includes(setting) ? Number(value) : bool;
  state.settings[setting] = next;
  scene?.setOptions({ [setting]: next });
  persist(true);
  if (setting === 'autoDaylight') {
    syncToggleElement('autoDaylight', next);
    const slider = $('#timeRange');
    if (slider && scene) slider.value = scene.hour;
  }
  syncToggleElement(setting, next);
}

function toggleSceneSetting(setting) {
  const current = setting in state.settings ? state.settings[setting] : false;
  applySceneSetting(setting, !current);
  if (setting === 'cowTags') scene?.setOptions({ cowTags: !current });
  if (ui.view === 'roam') renderSidebar();
}

function syncToggleElement(setting, value) {
  const el = document.querySelector(`[data-action="toggle-setting"][data-setting="${setting}"]`);
  if (el) {
    el.classList.toggle('is-on', !!value);
    el.setAttribute('aria-checked', String(!!value));
  }
  const auto = document.querySelector('[data-action="toggle-auto-control"] .switch');
  if (auto) auto.classList.toggle('is-on', !!state.settings.autoControl);
}

/* ------------------------------------------------------------------ */
/* 头部、侧栏、焦点个体                                                 */
/* ------------------------------------------------------------------ */

function handleTimeTick(info) {
  ui.lastTime = info;
  state.settings.simHour = info.hour;
  const clock = $('#headerClock');
  if (clock) clock.textContent = info.clock;
  const phase = $('#headerPhase');
  if (phase) phase.textContent = info.phase;
  const phaseIcon = $('#headerPhaseIcon');
  if (phaseIcon) phaseIcon.innerHTML = icon(info.icon, 14);
  const mode = info.daylight < 0.18 ? 'night' : info.daylight < 0.57 ? 'dusk' : 'day';
  if (document.body.dataset.phase !== mode) document.body.dataset.phase = mode;
  const controlClock = $('#controlClock');
  if (controlClock) controlClock.textContent = info.clock;
  const controlPhase = $('#controlPhase');
  if (controlPhase) controlPhase.textContent = info.phase;
  const timeRange = $('#timeRange');
  if (timeRange && document.activeElement !== timeRange) timeRange.value = info.hour;
  const autoClock = $('#autoTimeState');
  if (autoClock) autoClock.textContent = info.auto ? '自动流转' : '手动时刻';
}

function renderHeaderStatus() {
  const active = activeAlarms(state);
  const count = active.length;
  const badge = $('#alarmCount');
  badge.hidden = count === 0;
  badge.textContent = String(Math.min(99, count));
  $('#alarmButton').classList.toggle('has-alert', count > 0);
  const date = new Date();
  const weekdays = ['周日', '周一', '周二', '周三', '周四', '周五', '周六'];
  $('#headerDate').textContent = `${date.getFullYear()}.${pad(date.getMonth() + 1)}.${pad(date.getDate())} · ${weekdays[date.getDay()]}`;
  const info = scene?.getPhaseInfo() || { ...daylightLabel(state.settings.simHour), clock: fmtClock(state.settings.simHour), daylight: 0.6 };
  $('#headerClock').textContent = info.clock;
  $('#headerPhase').textContent = info.phase;
  $('#headerPhaseIcon').innerHTML = icon(info.icon, 14);
}

function barnStatusText(barn) {
  const status = getBarnState(barn);
  if (status.level === 'risk') return { label: '越限', cls: 'is-danger' };
  if (status.level === 'watch') return { label: '关注', cls: 'is-warning' };
  return { label: '舒适', cls: '' };
}

function barWidth(value, max) {
  return `${clamp((value / max) * 100, 4, 100).toFixed(1)}%`;
}

function renderSidebar() {
  const panel = $('#overviewPanel');
  if (!panel) return;
  const metrics = computeMetrics(state);
  const active = activeAlarms(state);
  const primaryAlert = active[0];
  const latestLink = state.traceLogs.find((log) => ['联动', '告警'].includes(log.category));
  const auto = !!state.settings.autoControl;
  panel.innerHTML = `
    <div class="panel-topline">
      <span>LIVE PASTURE · 数字孪生</span>
      <span class="panel-live"><i></i>实时同步</span>
    </div>
    <div class="panel-title-row">
      <div>
        <h1 class="panel-title">云栖生态岛</h1>
        <p class="panel-subtitle">${state.weather.condition} · 外温 ${state.weather.outsideTemp.toFixed(1)}°C · 风速 ${state.weather.wind.toFixed(1)} m/s</p>
      </div>
      <button class="round-link" type="button" data-view="ops" aria-label="打开运营大屏">${icon('arrowRight', 13)}</button>
    </div>
    <div class="mini-kpis">
      <div class="mini-kpi" style="--accent:var(--mint)">
        <div class="mini-kpi-head"><span>在册存栏</span>${icon('cow', 14)}</div>
        <div class="mini-kpi-value"><strong>${fmt(metrics.totalCows)}</strong><span>头</span></div>
        <div class="mini-kpi-sub"><span>${metrics.milkingCows} 头泌乳牛</span><span>${state.barns.length} 栋牛舍</span></div>
      </div>
      <div class="mini-kpi" style="--accent:var(--gold)">
        <div class="mini-kpi-head"><span>今日产奶</span>${icon('milk', 14)}</div>
        <div class="mini-kpi-value"><strong>${fmt(metrics.totalMilk)}</strong><span>L</span></div>
        <div class="mini-kpi-sub"><span>单产 ${metrics.avgYield} L</span><span class="${metrics.milkDelta >= 0 ? 'delta-up' : 'delta-down'}">${metrics.milkDelta >= 0 ? '+' : ''}${metrics.milkDelta}%</span></div>
      </div>
      <div class="mini-kpi" style="--accent:var(--mint)">
        <div class="mini-kpi-head"><span>健康率</span>${icon('heart', 14)}</div>
        <div class="mini-kpi-value"><strong>${metrics.healthRate}</strong><span>%</span></div>
        <div class="mini-kpi-sub"><span>观察 ${metrics.watch}</span><span class="delta-down">风险 ${metrics.risk}</span></div>
      </div>
      <div class="mini-kpi" style="--accent:${metrics.compliance >= 95 ? 'var(--mint)' : 'var(--gold)'}">
        <div class="mini-kpi-head"><span>环境达标</span>${icon('leaf', 14)}</div>
        <div class="mini-kpi-value"><strong>${metrics.compliance}</strong><span>%</span></div>
        <div class="mini-kpi-sub"><span>告警 ${active.length}</span><span>今日 ${metrics.todayAlarms}</span></div>
      </div>
    </div>
    <div class="section-heading">
      <h3>${icon('barn', 13)} 牛舍环境</h3>
      <button class="section-action" type="button" data-view="environment">全部 ${icon('chevronRight', 11)}</button>
    </div>
    <div class="barn-list">
      ${state.barns.map((barn) => renderBarnCard(barn)).join('')}
    </div>
    <div class="auto-control-card">
      <div class="auto-control-main">
        <span class="auto-icon">${icon('link', 15)}</span>
        <div class="auto-copy">
          <strong>自动环控联动 <span class="status-badge ${auto ? 'ok' : 'neutral'}" style="font-size:7px">${auto ? 'ON' : 'OFF'}</span></strong>
          <span>${auto ? '越限自动联动风机 / 排风 / 微雾' : '越限后仅提示，等待人工确认'}</span>
        </div>
        <button class="switch ${auto ? 'is-on' : ''}" type="button" role="switch" aria-checked="${auto}" data-action="toggle-auto-control"><span></span></button>
      </div>
      <div class="auto-notice">
        ${icon(primaryAlert ? 'warning' : 'spark', 12)}
        <span>${primaryAlert ? `${primaryAlert.barnId} ${primaryAlert.title} · ${primaryAlert.linkedAction || '等待联动确认'}` : (latestLink ? `${latestLink.action} · ${timeOnly(latestLink.at)}` : '所有牛舍环境平稳，联动策略待命。')}</span>
      </div>
    </div>
    <div class="panel-footer">
      <button class="text-link" type="button" data-view="models">${icon('layers', 11)} 对象模型 · ${state.cows.length + state.devices.length + state.barns.length} 个实例</button>
      <span class="panel-footer-note">${daylightLabel(scene?.hour ?? state.settings.simHour).label.toUpperCase()} · ${state.demoDate}</span>
    </div>
  `;
}

function renderBarnCard(barn) {
  const status = barnStatusText(barn);
  const active = activeAlarms(state).filter((a) => a.barnId === barn.barnId).length;
  const tempRatio = clamp(((barn.temperature - 12) / 18) * 100, 3, 100);
  const humidityRatio = clamp((barn.humidity / 100) * 100, 3, 100);
  const nh3Limit = barn.thresholds.nh3High;
  return `<button class="barn-card ${status.cls}" type="button" data-action="focus-barn" data-barn="${barn.barnId}">
    <span class="barn-card-top">
      <span class="barn-card-name"><span class="barn-code">${barn.barnId}</span><span class="barn-name">${barn.name}</span></span>
      <span class="barn-status"><i></i>${status.label}${active ? ` · ${active} 告警` : ''}</span>
    </span>
    <span class="barn-metrics">
      <span class="barn-metric">
        <span class="barn-metric-label">温度</span>
        <span class="barn-metric-value">${barn.temperature.toFixed(1)}<small>°C</small></span>
        <span class="micro-bar"><span style="width:${tempRatio}%"></span></span>
      </span>
      <span class="barn-metric">
        <span class="barn-metric-label">湿度</span>
        <span class="barn-metric-value">${barn.humidity.toFixed(0)}<small>%</small></span>
        <span class="micro-bar"><span style="width:${humidityRatio}%"></span></span>
      </span>
      <span class="barn-metric">
        <span class="barn-metric-label">NH₃</span>
        <span class="barn-metric-value">${barn.nh3.toFixed(1)}<small>ppm</small></span>
        <span class="micro-bar"><span style="width:${barWidth(barn.nh3, nh3Limit * 1.2)}"></span></span>
      </span>
    </span>
  </button>`;
}

function renderFocusPanel() {
  const panel = $('#focusPanel');
  if (!panel) return;
  const cow = cowByTag(state, ui.selectedCow);
  if (!cow) {
    const metrics = computeMetrics(state);
    const riskCows = metrics.riskCows.slice(0, 4);
    panel.innerHTML = `
      <div class="panel-topline"><span>FOCUS · 个体档案</span><span class="panel-live"><i></i>BIOMETRIC</span></div>
      <div class="focus-heading"><h2>牛群健康脉搏</h2>${icon('heart', 15)}</div>
      <div class="herd-pulse">
        <div class="herd-pulse-ring" style="--rate:${metrics.healthRate}">
          <div class="herd-pulse-inner"><strong>${metrics.healthRate}<small style="font-size:9px">%</small></strong><span>健康率</span></div>
        </div>
        <p class="card-sub">${metrics.healthy} 头健康 · ${metrics.watch} 头观察 · ${metrics.risk} 头风险</p>
        <div class="herd-mini-list">
          ${riskCows.map((c) => `<button class="herd-mini-row" type="button" data-action="select-cow" data-tag="${c.earTag}"><span class="mini-dot"></span><span>${c.earTag} · ${c.name}</span><b>${c.healthScore}</b></button>`).join('')}
        </div>
        <button class="btn btn-soft btn-block" type="button" data-view="milk" style="margin-top:12px">${icon('scan', 13)} 查看牛群健康档案</button>
      </div>`;
    return;
  }
  const latestHealth = getLatestCowHealth(state, cow.earTag);
  const latestMilk = getLatestCowMilk(state, cow.earTag);
  const milkSeries = getCowMilkSeries(state, cow.earTag, 10);
  const condition = cow.condition || (cow.healthStatus === 'healthy' ? '体征平稳，采食与反刍正常' : '建议持续观察');
  const status = HEALTH_STATUS[cow.healthStatus] || HEALTH_STATUS.watch;
  const ruminationPct = clamp((cow.rumination / 620) * 100, 5, 100);
  const activityPct = clamp(cow.activity, 5, 100);
  const tempPct = clamp(((cow.bodyTemp - 37.6) / 2.4) * 100, 5, 100);
  panel.innerHTML = `
    <div class="panel-topline"><span>FOCUS · 个体档案</span><span class="panel-live"><i></i>EAR TAG ${esc(cow.earTag)}</span></div>
    <div class="focus-heading">
      <h2>今天的她</h2>
      <button class="round-link" type="button" data-action="open-cow" data-tag="${cow.earTag}" aria-label="打开完整档案">${icon('arrowRight', 13)}</button>
    </div>
    <div class="cow-identity">
      <div class="cow-portrait ${cow.healthStatus === 'risk' ? 'is-risk' : ''}">${cowAvatar(cow)}</div>
      <div class="cow-identity-copy">
        <div class="cow-name-row"><h3>${esc(cow.name)}</h3><span class="status-badge ${status.className}">${status.label}</span></div>
        <div class="cow-meta"><span>${cow.breed}</span><i></i><span>${cow.parity} 胎</span><i></i><span>${cow.ageMonths} 月龄</span></div>
        <div class="cow-meta" style="margin-top:3px"><span>${cow.barnId} · ${barnById(state, cow.barnId)?.name || ''}</span></div>
      </div>
    </div>
    <div class="cow-stat-grid">
      <div class="cow-stat"><span>今日产奶</span><strong>${cow.milkToday.toFixed(1)} <small>L</small></strong></div>
      <div class="cow-stat"><span>健康评分</span><strong>${cow.healthScore}<small>/100</small></strong></div>
      <div class="cow-stat"><span>最近体温</span><strong>${(latestHealth?.bodyTemp || cow.bodyTemp).toFixed(1)} <small>°C</small></strong></div>
    </div>
    <div class="spark-block">
      <div class="spark-head"><span>10 日产奶趋势 · ${latestMilk ? `最近 ${clockOnly(latestMilk.milkedAt)}` : '等待数据'}</span><span class="spark-value">${formatNumber(milkSeries[milkSeries.length - 1]?.value || 0, 1)}<small>L</small></span></div>
      ${miniSparkline(milkSeries, { width: 272, height: 38, color: '#8fe3c8', id: `focus-${cow.earTag}` })}
    </div>
    <div class="cow-signals">
      <div class="signal-row"><span>反刍</span><span class="micro-bar"><span style="width:${ruminationPct}%"></span></span><b>${cow.rumination} min</b></div>
      <div class="signal-row"><span>活动</span><span class="micro-bar"><span style="width:${activityPct}%"></span></span><b>${cow.activity}</b></div>
      <div class="signal-row"><span>体温</span><span class="micro-bar"><span style="width:${tempPct}%"></span></span><b>${cow.bodyTemp.toFixed(1)}°</b></div>
    </div>
    ${cow.healthStatus !== 'healthy' ? `<div class="condition-note">${icon('warning', 12)}<span>${esc(condition)} · 建议${cow.healthStatus === 'risk' ? '隔离复查并录入用药' : '持续观察，关注采食变化'}</span></div>` : ''}
    <div class="cow-actions">
      <button class="btn btn-primary" type="button" data-action="open-form" data-form="milk" data-cow="${cow.earTag}">${icon('milk', 12)} 记录产奶</button>
      <button class="btn" type="button" data-action="open-form" data-form="health" data-cow="${cow.earTag}">${icon('heart', 12)} 健康记录</button>
      <button class="btn btn-sm" type="button" data-action="open-form" data-form="breeding" data-cow="${cow.earTag}">${icon('spark', 11)} 配种记录</button>
      <button class="btn btn-sm" type="button" data-action="open-cow" data-tag="${cow.earTag}">${icon('clipboard', 11)} 完整档案</button>
    </div>
    <div class="section-heading" style="margin-top:15px">
      <h3>${icon('activity', 12)} 近期留痕</h3>
      <button class="section-action" type="button" data-view="work">全部 ${icon('chevronRight', 10)}</button>
    </div>
    <div class="herd-mini-list">
      ${state.traceLogs.slice(0, 3).map((log) => `<button class="herd-mini-row" type="button" data-view="work">
        <span class="mini-dot" style="background:${log.category === '用药' ? 'var(--coral)' : log.category === '免疫' ? 'var(--gold)' : log.category === '联动' ? 'var(--blue)' : 'var(--mint)'}"></span>
        <span style="overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${esc(log.action)}</span>
        <b style="color:var(--muted);font-size:8px">${clockOnly(log.at)}</b>
      </button>`).join('')}
    </div>
  `;
}

/* ------------------------------------------------------------------ */
/* 全屏视图                                                             */
/* ------------------------------------------------------------------ */

function setNavActive() {
  $$('#mainNav [data-view]').forEach((button) => {
    button.classList.toggle('is-active', button.dataset.view === ui.view);
  });
}

function openView(view) {
  if (view === 'roam') {
    closeView();
    return;
  }
  if (!['ops', 'environment', 'milk', 'work', 'reports', 'models'].includes(view)) return;
  ui.view = view;
  if (view === 'environment') ui.envBarn = ui.envBarn || ui.selectedBarn;
  setNavActive();
  closeDrawer('control');
  closeDrawer('alarm');
  document.body.classList.add('overlay-open');
  const overlay = $('#viewOverlay');
  overlay.classList.add('is-open');
  overlay.setAttribute('aria-hidden', 'false');
  scene?.setPaused(true);
  renderView();
}

function closeView() {
  ui.view = 'roam';
  setNavActive();
  document.body.classList.remove('overlay-open');
  const overlay = $('#viewOverlay');
  overlay.classList.remove('is-open');
  overlay.setAttribute('aria-hidden', 'true');
  chartHub.disposeAll();
  scene?.setPaused(false);
}

function renderView() {
  if (ui.view === 'roam') return;
  chartHub.disposeAll();
  const content = $('#viewContent');
  let html = '';
  if (ui.view === 'ops') html = renderOpsView();
  else if (ui.view === 'environment') html = renderEnvironmentView();
  else if (ui.view === 'milk') html = renderMilkView();
  else if (ui.view === 'work') html = renderWorkView();
  else if (ui.view === 'reports') html = renderReportsView();
  else if (ui.view === 'models') html = renderModelsView();
  content.innerHTML = html;
  content.scrollTop = 0;
  requestAnimationFrame(() => {
    mountCharts();
    chartHub.resizeAll();
  });
}

function viewHeader({ kicker, title, subtitle, actions = '', meta = '' }) {
  return `<div class="view-header">
    <div class="view-header-copy">
      <span class="view-eyebrow">${kicker}</span>
      <h1 class="view-title">${title}</h1>
      <p class="view-subtitle">${subtitle}</p>
    </div>
    <div class="view-actions">
      ${meta ? `<span class="view-meta"><i></i>${meta}</span>` : ''}
      ${actions}
    </div>
  </div>`;
}

function metricCard({ label, value, unit = '', iconName = 'activity', foot = '', accent = 'var(--mint)', delta = '' }) {
  return `<div class="metric-card" style="--accent:${accent}">
    <div class="metric-card-top"><span>${esc(label)}</span>${icon(iconName, 14)}</div>
    <div class="metric-number"><strong>${value}</strong>${unit ? `<span>${unit}</span>` : ''}</div>
    <div class="metric-foot">${delta ? `<b class="${String(delta).startsWith('-') ? 'down' : ''}">${delta}</b>` : ''}<span>${foot}</span></div>
  </div>`;
}

function cardHead({ iconName = 'chart', kicker = '', title, sub = '', actions = '' }) {
  return `<div class="card-head">
    <div class="card-head-left">
      <span class="card-kicker">${icon(iconName, 11)}${kicker}</span>
      <div class="card-title">${title}</div>
      ${sub ? `<div class="card-sub">${sub}</div>` : ''}
    </div>
    ${actions ? `<div class="card-actions">${actions}</div>` : ''}
  </div>`;
}

function alertItem(alarm, { compact = false } = {}) {
  const critical = alarm.level === 'critical';
  const meta = METRIC_META[alarm.metric] || { label: '环境' };
  return `<button class="alert-row ${critical ? 'is-critical' : 'is-warning'}" type="button" data-action="open-alarm-drawer">
    <span class="alert-icon">${icon(critical ? 'warning' : 'bell', 12)}</span>
    <span class="alert-copy"><strong>${esc(alarm.title)} · ${alarm.barnId}</strong><span>${esc(alarm.message)}</span>${alarm.linkedAction ? `<em>${esc(alarm.linkedAction)}</em>` : ''}</span>
    <time>${clockOnly(alarm.createdAt)}</time>
  </button>`;
}

function emptyState(iconName, title, sub) {
  return `<div class="empty-state">${icon(iconName, 24)}<strong>${esc(title)}</strong><span>${esc(sub)}</span></div>`;
}

/* ------------------------------------------------------------------ */
/* 运营大屏                                                             */
/* ------------------------------------------------------------------ */

function renderOpsView() {
  const metrics = computeMetrics(state);
  const barnRows = state.barns;
  const alerts = activeAlarms(state);
  const recentAlerts = [...state.alarms].sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt)).slice(0, 3);
  const healthDist = getHealthDistribution(state);
  const groups = getGroupHealthStats(state);
  const milkSeries = getTotalMilkSeries(state, 14);
  const energyRows = getEnergyReport(state).slice(-8);
  const pendingOrders = state.workOrders
    .filter((w) => w.status !== 'done' && w.status !== 'canceled')
    .sort((a, b) => new Date(a.scheduledAt) - new Date(b.scheduledAt))
    .slice(0, 4);
  const totalHealth = healthDist.reduce((s, d) => s + d.value, 0);
  const diseaseRisk = state.cows.filter((c) => c.healthStatus === 'risk').length;
  return `${viewHeader({
    kicker: '<span class="live-dot"></span> OPERATIONS · MISTY PASTURE / LIVE',
    title: '牧场<b style="font-weight:500;color:var(--mint)">运营大屏</b>',
    subtitle: `环抱在薄雾与晨光里的牧场，正在以另一种方式呼吸。将存栏、产奶、环境与健康放在同一张图景里，读懂每一个微小的变化。`,
    meta: `<i></i>数据同步 ${state.barns[0].temperature.toFixed(1)}°C · 薄雾`,
    actions: `<button class="btn" type="button" data-action="simulate-alert" data-barn="${ui.envBarn}">${icon('spark', 12)} 模拟环境异常</button><button class="btn btn-soft" type="button" data-action="open-alarm-drawer">${icon('bell', 12)} 告警中心</button>`,
  })}
  <div class="metric-ribbon">
    ${metricCard({ label: '在册存栏', value: fmt(metrics.totalCows), unit: '头', iconName: 'cow', foot: `${metrics.milkingCows} 头泌乳 · 3 栋牛舍`, accent: 'var(--mint)' })}
    ${metricCard({ label: '今日产奶', value: fmt(metrics.totalMilk), unit: 'L', iconName: 'milk', foot: `较昨日 ${metrics.milkDelta >= 0 ? '+' : ''}${metrics.milkDelta}%`, delta: metrics.milkDelta >= 0 ? `↑` : `↓`, accent: 'var(--gold)' })}
    ${metricCard({ label: '平均单产', value: metrics.avgYield, unit: 'L/头', iconName: 'scale', foot: '泌乳牛口径', accent: 'var(--blue)' })}
    ${metricCard({ label: '健康率', value: metrics.healthRate, unit: '%', iconName: 'heart', foot: `观察 ${metrics.watch} · 风险 ${diseaseRisk}`, accent: 'var(--mint)' })}
    ${metricCard({ label: '环境达标', value: metrics.compliance, unit: '%', iconName: 'leaf', foot: `活动告警 ${alerts.length} 条`, accent: alerts.length ? 'var(--gold)' : 'var(--mint)' })}
    ${metricCard({ label: '今日环控能耗', value: fmt(metrics.energyToday, 1), unit: 'kWh', iconName: 'energy', foot: `单位奶耗 ${metrics.totalMilk ? ((metrics.energyToday / metrics.totalMilk) * 1000).toFixed(1) : '0'} Wh/L`, accent: 'var(--lavender)' })}
  </div>
  <div class="dashboard-grid">
    <section class="card span-8">
      ${cardHead({ iconName: 'chart', kicker: 'PRODUCTION PULSE · 14 DAYS', title: '产奶趋势与单产心跳', sub: '每日产奶总量（L）与趋势均值', actions: `<button class="btn btn-sm" type="button" data-view="milk">产奶健康 ${icon('arrowRight', 11)}</button>` })}
      <div class="chart-wrap chart-lg"><div id="ops-milk-chart" class="chart-wrap" style="height:100%"></div></div>
      <div class="chart-legend"><span class="legend-item"><i></i>产奶总量</span><span class="legend-item gold"><i></i>趋势均值</span><span class="legend-item"><i style="background:var(--muted)"></i>乳脂率 ${metrics.fat}% · 乳蛋白率 ${metrics.protein}%</span></div>
    </section>
    <section class="card span-4 tint-mint">
      ${cardHead({ iconName: 'heart', kicker: 'HERD WELLBEING', title: '牛群健康结构', sub: `${totalHealth} 头在册牛只 · 实时健康画像`, actions: '<span class="status-badge ok">稳定</span>' })}
      <div style="height:196px"><div id="ops-health-chart" style="height:100%"></div></div>
      <div class="health-distribution">
        ${healthDist.map((d) => `<div class="distribution-row"><span>${d.name}</span><span class="distribution-bar"><span style="width:${totalHealth ? ((d.value / totalHealth) * 100).toFixed(0) : 0}%;background:${d.color}"></span></span><strong>${d.value}</strong></div>`).join('')}
      </div>
      ${metrics.riskCows.length ? `<div class="condition-note" style="margin:10px 0 0;padding:7px 8px">${icon('warning', 11)}<span>疾病关注 ${diseaseRisk} 头：${metrics.riskCows.slice(0, 2).map((c) => `${c.earTag} ${esc(c.condition || '待评估')}`).join(' · ')}${metrics.riskCows.length > 2 ? ' 等' : ''}</span></div>` : ''}
    </section>
    <section class="card span-4">
      ${cardHead({ iconName: 'barn', kicker: 'BARN MICROCLIMATE', title: '牛舍环境快照', sub: '温度 / 湿度 / 氨气实时读数', actions: `<button class="btn btn-sm" type="button" data-view="environment">监测 ${icon('arrowRight', 10)}</button>` })}
      <div class="env-snapshot-list">
        ${barnRows.map((barn) => {
          const st = getBarnState(barn);
          const cls = st.level === 'risk' ? 'is-danger' : st.level === 'watch' ? 'is-warning' : '';
          return `<button class="env-snapshot ${cls}" type="button" data-action="select-env-barn" data-barn="${barn.barnId}">
            <span class="env-snapshot-code">${barn.barnId}</span>
            <span class="env-snapshot-copy"><strong>${barn.name}</strong><span>${barn.temperature.toFixed(1)}°C · ${barn.humidity.toFixed(0)}% · NH₃ <b>${barn.nh3.toFixed(1)}</b> ppm</span></span>
            <span class="env-snapshot-meter"><span class="micro-bar"><span style="width:${barWidth(barn.nh3, barn.thresholds.nh3High * 1.2)}%;background:${barn.nh3 > barn.thresholds.nh3High ? 'var(--coral)' : 'var(--mint)'}"></span></span><span>${barn.light} lx</span></span>
          </button>`;
        }).join('')}
      </div>
    </section>
    <section class="card span-4">
      ${cardHead({ iconName: 'warning', kicker: 'ALERTS & LINKAGE', title: '当前环境告警', sub: alerts.length ? `${alerts.length} 条需要关注` : '所有牛舍均在阈值内', actions: `<button class="btn btn-sm" type="button" data-action="open-alarm-drawer">全部 ${icon('arrowRight', 10)}</button>` })}
      <div class="alert-list">
        ${alerts.length ? alerts.slice(0, 3).map((a) => alertItem(a)).join('') : emptyState('leaf', '环境平稳', '未发现越限指标，自动联动策略待命。')}
      </div>
    </section>
    <section class="card span-4">
      ${cardHead({ iconName: 'clipboard', kicker: 'WORKFLOW QUEUE', title: '巡检与防疫待办', sub: `${metrics.pendingWorks} 项待处理任务`, actions: `<button class="btn btn-sm" type="button" data-view="work">看板 ${icon('arrowRight', 10)}</button>` })}
      <div class="work-mini-list">
        ${pendingOrders.length ? pendingOrders.map((order) => `<button class="work-mini-row" type="button" data-action="open-order" data-order="${order.orderNo}"><span class="work-status-dot ${order.status}"></span><span>${esc(order.title)}</span><em>${esc(order.assignee)} · ${relativeDateLabel(order.scheduledAt)}</em></button>`).join('') : emptyState('checkCircle', '今日工单已清空', '所有巡检与防疫任务均已闭环。')}
      </div>
      <div class="auto-control-card" style="margin-top:11px">
        <div class="auto-control-main"><span class="auto-icon">${icon('link', 14)}</span><div class="auto-copy"><strong>自动环控 ${state.settings.autoControl ? '已开启' : '已暂停'}</strong><span>${alerts.length ? (alerts[0].linkedAction || '等待确认') : '联动策略正常'}</span></div><span class="status-badge ${state.settings.autoControl ? 'ok' : 'neutral'}">${state.settings.autoControl ? 'AUTO' : 'MANUAL'}</span></div>
      </div>
    </section>
    <section class="card span-7">
      ${cardHead({ iconName: 'energy', kicker: 'CONTROL ENERGY · 8 DAYS', title: '环控能耗结构', sub: '通风降温 / 照明补光 / 其他设备', actions: `<span class="view-meta">今日 ${fmt(metrics.energyToday, 1)} kWh</span><button class="btn btn-sm" type="button" data-view="reports">报表 ${icon('arrowRight', 10)}</button>` })}
      <div id="ops-energy-chart" class="chart-wrap" style="height:168px"></div>
    </section>
    <section class="card span-5">
      ${cardHead({ iconName: 'cow', kicker: 'HERD SEGMENTS', title: '分组健康与产奶', sub: '按生产阶段拆分的牛群结构', actions: '' })}
      <div id="ops-group-chart" class="chart-wrap" style="height:140px"></div>
      <div class="chart-legend">${groups.map((g) => `<span class="legend-item"><i style="background:${g.risk ? 'var(--coral)' : g.watch ? 'var(--gold)' : 'var(--mint)'}"></i>${g.group} · ${g.total} 头 · ${g.milk.toFixed(0)} L</span>`).join('')}</div>
    </section>
    <section class="card span-12" style="padding:12px 15px">
      <div style="display:flex;align-items:center;justify-content:space-between;gap:12px;flex-wrap:wrap">
        <div style="display:flex;align-items:center;gap:9px;color:var(--text-3);font-size:9px">${icon('spark', 14)}<span>运营洞察：${metrics.milkDelta >= 0 ? '今日产奶较昨日提升' : '今日产奶较昨日回落'} ${Math.abs(metrics.milkDelta)}%，${alerts.length ? `${alerts[0].barnId} ${alerts[0].title} 正在联动处理。` : '牛舍环境整体平稳。'}${diseaseRisk > 0 ? `  ${diseaseRisk} 头风险牛只已进入诊疗关注。` : ''}</span></div>
        <button class="btn btn-sm btn-soft" type="button" data-view="reports">${icon('report', 11)} 生成周期报表</button>
      </div>
    </section>
  </div>`;
}

/* ------------------------------------------------------------------ */
/* 环境监测                                                             */
/* ------------------------------------------------------------------ */

function gaugeAccent(metric, stateValue) {
  if (stateValue === 'high' || stateValue === 'low') return 'var(--coral)';
  return { temperature: 'var(--gold)', humidity: 'var(--blue)', nh3: 'var(--mint)', light: 'var(--mint)' }[metric] || 'var(--mint)';
}

function gaugePercent(metric, barn) {
  const val = barn[metric];
  const { low, high } = metricThreshold(barn, metric);
  if (metric === 'light') return clamp((val / Math.max(high, 1)) * 100, 3, 100);
  const floor = Math.max(0, (low ?? 0) - 8);
  const ceil = high * 1.15;
  return clamp(((val - floor) / Math.max(ceil - floor, 1)) * 100, 3, 100);
}

function renderGauge(metric, barn) {
  const meta = METRIC_META[metric];
  const stateValue = getMetricState(barn, metric);
  const range = metricThreshold(barn, metric);
  const label = stateValue === 'ok' ? '舒适范围' : stateValue === 'high' ? '高于阈值' : '低于下限';
  const display = metric === 'light' ? Math.round(barn.light) : Number(barn[metric]).toFixed(1);
  const unit = metric === 'light' ? 'lx' : metric === 'nh3' ? 'ppm' : metric === 'humidity' ? '%RH' : '°C';
  const pct = gaugePercent(metric, barn);
  const accent = gaugeAccent(metric, stateValue);
  return `<div class="gauge-card" style="--accent:${accent}">
    <div class="gauge-ring" style="--pct:${pct.toFixed(1)};--ring:${accent}">
      <div class="gauge-ring-inner"><strong>${display}</strong><span>${unit.replace('%RH', '%')}</span></div>
    </div>
    <div class="gauge-copy">
      <span>${icon(meta.icon, 11)} ${meta.label}</span>
      <div class="gauge-value">${display}<small>${unit}</small></div>
      <div class="gauge-range">参考 ${range.low ?? 0} – ${range.high ?? 0}${unit.replace('%RH', '%')}</div>
      <div class="gauge-status ${stateValue === 'ok' ? '' : stateValue === 'high' ? 'risk' : 'watch'}">${label}</div>
    </div>
  </div>`;
}

function renderEnvironmentView() {
  const barn = barnById(state, ui.envBarn) || state.barns[0];
  const barnDevices = devicesForBarn(state, barn.barnId);
  const envSeries = getBarnEnvSeries(state, barn.barnId, 36);
  const alarms = state.alarms.filter((a) => a.barnId === barn.barnId).sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt)).slice(0, 3);
  const allAlerts = activeAlarms(state);
  const metricMeta = METRIC_META[ui.envMetric];
  const threshold = metricThreshold(barn, ui.envMetric);
  const auto = state.settings.autoControl;
  const energ = getEnergyReport(state).slice(-8);
  const onlineSensor = barnDevices.find((d) => d.type === 'sensor');
  return `${viewHeader({
    kicker: '<span class="live-dot"></span> ENVIRONMENT · IOT SENSING / LIVE',
    title: '牛舍环境<b style="font-weight:500;color:var(--mint)">呼吸监测</b>',
    subtitle: '温度、湿度、氨气与光照在这里化作可被看见的空气。环控网关持续采样并同步趋势，越限时自动联动环控设备，并保留完整处置轨迹。',
    actions: `<button class="btn" type="button" data-action="simulate-alert" data-barn="${barn.barnId}">${icon('spark', 12)} 模拟环境越限</button><button class="btn" type="button" data-action="open-threshold" data-barn="${barn.barnId}">${icon('settings', 12)} 阈值设置</button><button class="btn btn-soft" type="button" data-action="refresh-view">${icon('activity', 12)} 刷新采集</button>`,
    meta: `<i></i>网关在线 ${barnDevices.filter((d) => d.type === 'sensor' && d.online).length}/1 · ${clockOnly(barn.updatedAt)}`,
  })}
  <div class="env-toolbar">
    <div class="env-barn-tabs">
      ${state.barns.map((b) => {
        const st = getBarnState(b);
        const cls = st.level === 'risk' ? 'is-danger' : st.level === 'watch' ? 'is-warning' : '';
        return `<button class="env-barn-tab ${b.barnId === barn.barnId ? 'is-active' : ''} ${cls}" type="button" data-action="select-env-barn" data-barn="${b.barnId}"><span class="tab-dot"></span>${b.barnId} · ${b.name}<span style="color:var(--muted);font-family:var(--mono);font-size:7px">${b.temperature.toFixed(1)}°</span></button>`;
      }).join('')}
    </div>
    <div class="env-toolbar-right">
      <span class="status-badge ${allAlerts.some((a) => a.barnId === barn.barnId) ? 'watch' : 'ok'}">${allAlerts.some((a) => a.barnId === barn.barnId) ? '环境需关注' : '环境平稳'}</span>
      <span class="view-meta">自动环控 <i style="background:${auto ? 'var(--mint)' : 'var(--gold)'}"></i>${auto ? 'ON' : 'MANUAL'}</span>
    </div>
  </div>
  <div class="gauge-grid">
    ${['temperature', 'humidity', 'nh3', 'light'].map((metric) => renderGauge(metric, barn)).join('')}
  </div>
  <div class="dashboard-grid">
    <section class="card span-8">
      ${cardHead({ iconName: 'chart', kicker: 'ENVIRONMENT TREND · 24 HOURS', title: `${barn.barnId} · ${metricMeta.label}趋势`, sub: `环控网关持续采样 · 时间轴为 24 小时移动窗口 · 报警阈值参考当前牛舍`, actions: `<div class="segmented">${['temperature', 'humidity', 'nh3', 'light'].map((m) => `<button class="${ui.envMetric === m ? 'is-active' : ''}" type="button" data-action="env-metric" data-metric="${m}">${METRIC_META[m].label}</button>`).join('')}</div>` })}
      <div id="env-main-chart" class="chart-wrap chart-lg"></div>
      <div class="chart-legend">
        <span class="legend-item"><i style="background:${gaugeAccent(ui.envMetric, getMetricState(barn, ui.envMetric))}"></i>${metricMeta.label}（${metricMeta.unit}）</span>
        <span class="legend-item coral"><i></i>阈值 ${threshold.high ?? '—'}${metricMeta.unit.replace('%RH', '%')}</span>
        <span class="legend-item gold"><i></i>下限 ${threshold.low ?? 0}${metricMeta.unit.replace('%RH', '%')}</span>
      </div>
    </section>
    <section class="card span-4">
      ${cardHead({ iconName: 'settings', kicker: 'ACTUATOR CONTROL', title: '环控设备联动', sub: `${barnDevices.filter((d) => d.running && d.type !== 'sensor').length} 台正在运行 · 点击开关可手动覆盖`, actions: `<span class="status-badge ${auto ? 'ok' : 'watch'}">${auto ? '自动策略' : '手动'}</span>` })}
      <div class="device-list">
        ${barnDevices.map((device) => `<div class="device-row ${device.running ? 'is-running' : ''}">
          <span class="device-icon">${icon(DEVICE_META[device.type]?.icon || 'settings', 13)}</span>
          <span class="device-info"><strong>${DEVICE_META[device.type]?.label || device.name} <em class="device-mode">${device.mode === 'auto' ? 'AUTO' : 'MANUAL'}</em></strong><span>${device.running ? '运行中' : '待机'} · ${device.powerKw} kW · ${device.lastAction || '策略待命'}</span></span>
          ${device.type === 'sensor' ? `<span class="status-badge ok">ONLINE</span>` : `<button class="switch ${device.running ? 'is-on' : ''}" type="button" role="switch" aria-checked="${device.running}" data-action="toggle-device" data-device="${device.deviceId}"><span></span></button>`}
        </div>`).join('')}
      </div>
      <div class="auto-control-card" style="margin-top:11px">
        <div class="auto-control-main"><span class="auto-icon">${icon('link', 14)}</span><div class="auto-copy"><strong>环境越限自动联动</strong><span>NH₃ / 温度 / 光照越限时执行策略</span></div><button class="switch ${auto ? 'is-on' : ''}" type="button" role="switch" aria-checked="${auto}" data-action="toggle-auto-control"><span></span></button></div>
      </div>
    </section>
    <section class="card span-7">
      ${cardHead({ iconName: 'warning', kicker: 'ALERT & RESPONSE', title: '实时告警与处置', sub: '确认告警、立即联动或标记恢复', actions: `<button class="btn btn-sm" type="button" data-action="open-alarm-drawer">全部告警 ${icon('arrowRight', 10)}</button>` })}
      <div class="alarm-list">
        ${alarms.length ? alarms.map((alarm) => `<div class="alarm-card ${alarm.level === 'critical' ? 'critical' : ''} ${alarm.status === 'resolved' ? 'resolved' : ''}">
          <div class="alarm-head">${icon('warning', 13)}<strong>${esc(alarm.title)} · ${alarm.barnId}</strong><time>${clockOnly(alarm.createdAt)}</time></div>
          <p class="alarm-desc">${esc(alarm.message)}${alarm.status === 'resolved' ? ' · 已恢复' : ''}${alarm.linkedAction ? ` · ${esc(alarm.linkedAction)}` : ''}</p>
          <div class="alarm-foot"><span class="alarm-linkage">${alarm.acknowledged ? '已确认收到' : '待确认'}${alarm.linkedDeviceId ? ` · ${esc(alarm.linkedDeviceId)}` : ''}</span><span class="alarm-actions">${alarm.status === 'active' && !alarm.acknowledged ? `<button class="btn btn-sm" type="button" data-action="ack-alarm" data-alarm="${alarm.alarmId}">确认</button>` : ''}${alarm.status === 'active' ? `<button class="btn btn-sm btn-soft" type="button" data-action="link-alarm" data-alarm="${alarm.alarmId}">联动</button><button class="btn btn-sm" type="button" data-action="resolve-alarm" data-alarm="${alarm.alarmId}">恢复</button>` : ''}</span></div>
        </div>`).join('') : emptyState('leaf', '当前没有环境告警', '所有传感器读数处于舒适区间。')}
      </div>
    </section>
    <section class="card span-5">
      ${cardHead({ iconName: 'link', kicker: 'LINKAGE STRATEGY', title: '联动策略提示', sub: '自动或人工触发的设备控制动作' })}
      <div class="strategy-list">
        <div class="strategy-item"><span class="strategy-icon">NH₃</span><div class="strategy-copy"><strong>氨气 > ${barn.thresholds.nh3High} ppm → 纵向排风</strong><span>同步检查清粪通道，30 分钟后复核，形成处置轨迹。</span></div></div>
        <div class="strategy-item"><span class="strategy-icon">TEMP</span><div class="strategy-copy"><strong>温度 > ${barn.thresholds.tempHigh}°C → 循环风机 + 微雾</strong><span>若湿度高于 ${barn.thresholds.humidityHigh}%，优先风机降温。</span></div></div>
        <div class="strategy-item"><span class="strategy-icon">LOW</span><div class="strategy-copy"><strong>温度 < ${barn.thresholds.tempLow}°C → 保温灯组</strong><span>犊牛舍优先执行，联动门窗密闭性巡检。</span></div></div>
        <div class="strategy-item"><span class="strategy-icon">LUX</span><div class="strategy-copy"><strong>光照 < ${barn.thresholds.lightLow} lx → 补光灯</strong><span>黄昏提前开启柔光，保证犊牛活动区照度。</span></div></div>
      </div>
      <div class="report-note" style="margin-top:11px">${icon('info', 12)}<span>当前自动环控为 <b style="color:${auto ? 'var(--mint)' : 'var(--gold)'}">${auto ? '开启' : '暂停'}</b>。${auto ? '新的越限告警将自动执行联动并写入留痕。' : '告警只做提示，需在右侧确认后手动联动。'}</span></div>
    </section>
    <section class="card span-7">
      ${cardHead({ iconName: 'energy', kicker: 'HVAC ENERGY', title: '环控能耗 · 近 8 日', sub: '通风降温、照明补光与其他设备分层统计', actions: `<span class="view-meta">今日 ${fmt(state.energyHistory[state.energyHistory.length - 1]?.total || 0, 1)} kWh</span>` })}
      <div id="env-energy-chart" class="chart-wrap" style="height:180px"></div>
    </section>
    <section class="card span-5">
      ${cardHead({ iconName: 'sensor', kicker: 'SENSOR HEALTH', title: '采集质量', sub: `${barn.barnId} 牛舍数据链路状态`, actions: `<span class="status-badge ok">链路正常</span>` })}
      <div class="audit-grid">
        <div class="audit-stat"><span>网关在线</span><strong>1 / 1</strong></div>
        <div class="audit-stat"><span>采样成功率</span><strong>99.8%</strong></div>
        <div class="audit-stat"><span>今日有效样本</span><strong>1,728</strong></div>
        <div class="audit-stat"><span>最近同步</span><strong>${clockOnly(barn.updatedAt)}</strong></div>
      </div>
      <div class="mini-trend-list" style="margin-top:10px">
        <div class="mini-trend-row"><span>信号</span><span class="micro-bar"><span style="width:${onlineSensor?.signal || 92}%"></span></span><b>${onlineSensor?.signal || 92}%</b></div>
        <div class="mini-trend-row"><span>温度</span><span class="micro-bar"><span style="width:${gaugePercent('temperature', barn).toFixed(0)}%;background:var(--gold)"></span></span><b>${barn.temperature.toFixed(1)}°C</b></div>
        <div class="mini-trend-row"><span>光照</span><span class="micro-bar"><span style="width:${gaugePercent('light', barn).toFixed(0)}%;background:var(--mint)"></span></span><b>${barn.light} lx</b></div>
      </div>
    </section>
  </div>`;
}

/* ------------------------------------------------------------------ */
/* 产奶健康                                                             */
/* ------------------------------------------------------------------ */

function filteredCowList() {
  const f = ui.milkFilters;
  return searchCows(state, { query: f.query, barnId: f.barn, status: f.status, group: f.group });
}

function renderMilkView() {
  const metrics = computeMetrics(state);
  const distribution = getHealthDistribution(state);
  const groups = getGroupHealthStats(state);
  const selected = cowByTag(state, ui.selectedCow) || state.cows.find((c) => c.showcase) || state.cows[0];
  if (selected) ui.selectedCow = selected.earTag;
  const series = getTotalMilkSeries(state, 14);
  const cowSeries = getCowMilkSeries(state, selected?.earTag, 10);
  const cowHealth = getLatestCowHealth(state, selected?.earTag);
  const cows = filteredCowList();
  const pageSize = 9;
  const pageCount = Math.max(1, Math.ceil(cows.length / pageSize));
  ui.milkPage = clamp(ui.milkPage, 0, pageCount - 1);
  const pageCows = cows.slice(ui.milkPage * pageSize, ui.milkPage * pageSize + pageSize);
  const records = currentRecordRows(selected?.earTag);
  const tab = ui.recordTab;
  const recordTabs = {
    milk: { label: '产奶记录', header: ['时间', '耳标', '班次', '产奶量', '乳脂 / 乳蛋白', '品质'], rows: records.milk },
    health: { label: '健康记录', header: ['时间', '耳标', '体温', '反刍', '健康分', '结论'], rows: records.health },
    breeding: { label: '配种记录', header: ['时间', '耳标', '方式', '冻精 / 公牛', '复检结果', '预产期'], rows: records.breeding },
  };
  const activeTab = recordTabs[tab] || recordTabs.milk;
  const groupsHtml = groups.map((g) => `<div class="distribution-row"><span>${g.group}</span><span class="distribution-bar"><span style="width:${g.rate}%;background:var(--mint)"></span></span><strong>${g.healthy}/${g.total}</strong></div>`).join('');
  return `${viewHeader({
    kicker: '<span class="live-dot"></span> MILK & HEALTH · INDIVIDUAL FILE',
    title: '产奶与健康<b style="font-weight:500;color:var(--mint)">个体档案</b>',
    subtitle: '用耳标串联一头奶牛的产奶、健康与繁殖历史。个体与分组均可录入，趋势会自动汇入经营报表与数字孪生场景。',
    actions: `<span class="view-meta"><i></i>${formatNumber(metrics.totalMilk)} L · ${metrics.healthRate}% 健康</span><button class="btn" type="button" data-action="open-form" data-form="health">${icon('heart', 12)} 健康记录</button><button class="btn" type="button" data-action="open-form" data-form="breeding">${icon('spark', 12)} 配种记录</button><button class="btn" type="button" data-action="open-form" data-form="milk" data-mode="group">${icon('layers', 12)} 分组录入</button><button class="btn btn-primary" type="button" data-action="open-form" data-form="milk">${icon('plus', 12)} 新增产奶</button>`,
  })}
  <div class="metric-ribbon">
    ${metricCard({ label: '今日产奶', value: fmt(metrics.totalMilk), unit: 'L', iconName: 'milk', foot: `${metrics.milkDelta >= 0 ? '+' : ''}${metrics.milkDelta}% vs 昨日`, accent: 'var(--gold)' })}
    ${metricCard({ label: '平均单产', value: metrics.avgYield, unit: 'L/头', iconName: 'scale', foot: '按 96 头泌乳牛计', accent: 'var(--mint)' })}
    ${metricCard({ label: '乳脂率', value: metrics.fat.toFixed(2), unit: '%', iconName: 'drop', foot: '自动采集均值', accent: 'var(--gold)' })}
    ${metricCard({ label: '乳蛋白率', value: metrics.protein.toFixed(2), unit: '%', iconName: 'flask', foot: '质量样本', accent: 'var(--blue)' })}
    ${metricCard({ label: '健康率', value: metrics.healthRate, unit: '%', iconName: 'heart', foot: `${metrics.healthy} 头健康 · ${metrics.watch} 头观察`, accent: 'var(--mint)' })}
    ${metricCard({ label: '风险牛只', value: metrics.risk, unit: '头', iconName: 'warning', foot: '建议优先巡诊', accent: 'var(--coral)' })}
  </div>
  <div class="dashboard-grid">
    <section class="card span-8">
      ${cardHead({ iconName: 'chart', kicker: 'PRODUCTION TREND · 14 DAYS', title: '全群产奶趋势', sub: '每日产奶量与趋势均值 · 支持单头奶牛档案联动', actions: `<span class="view-meta">乳脂 ${metrics.fat}% · 蛋白 ${metrics.protein}%</span>` })}
      <div id="mh-milk-chart" class="chart-wrap chart-md"></div>
    </section>
    <section class="card span-4 tint-mint">
      ${cardHead({ iconName: 'heart', kicker: 'HEALTH DISTRIBUTION', title: '健康画像', sub: '128 头在册牛只的实时状态' })}
      <div style="height:152px"><div id="mh-health-chart" style="height:100%"></div></div>
      <div class="health-distribution">${distribution.map((d) => `<div class="distribution-row"><span>${d.name}</span><span class="distribution-bar"><span style="width:${(d.value / 128) * 100}%;background:${d.color}"></span></span><strong>${d.value}</strong></div>`).join('')}</div>
      <div style="margin-top:8px;padding-top:8px;border-top:1px solid var(--line-soft)">${groupsHtml}</div>
    </section>
    <section class="card span-8">
      ${cardHead({ iconName: 'cow', kicker: 'HERD REGISTRY', title: '奶牛个体档案', sub: `筛选出 ${cows.length} 头 · 点击行查看个体详情`, actions: `<button class="btn btn-sm" type="button" data-action="open-form" data-form="milk" data-mode="group">${icon('layers', 11)} 分组录入</button>` })}
      <form class="filter-bar" id="milkFilterForm" style="margin-bottom:9px;padding:7px 9px">
        <div class="filter-left">
          <span class="filter-label">FILTER</span>
          <input class="input-compact" name="query" placeholder="耳标 / 昵称" value="${esc(ui.milkFilters.query)}" />
          <select class="select-compact" name="barn">${['ALL', ...state.barns.map((b) => b.barnId)].map((id) => `<option value="${id}" ${ui.milkFilters.barn === id ? 'selected' : ''}>${id === 'ALL' ? '全部牛舍' : id}</option>`).join('')}</select>
          <select class="select-compact" name="group">${['ALL', '泌乳牛', '干奶牛', '青年牛', '犊牛'].map((group) => `<option value="${group}" ${ui.milkFilters.group === group ? 'selected' : ''}>${group === 'ALL' ? '全部阶段' : group}</option>`).join('')}</select>
          <select class="select-compact" name="status">${['ALL', 'healthy', 'watch', 'risk'].map((status) => `<option value="${status}" ${ui.milkFilters.status === status ? 'selected' : ''}>${status === 'ALL' ? '全部健康状态' : HEALTH_STATUS[status].label}</option>`).join('')}</select>
          <button class="btn btn-sm btn-soft" type="submit">筛选</button>
        </div>
      </form>
      <div class="table-wrap" style="max-height:302px">
        <table class="data-table">
          <thead><tr><th>耳标 / 昵称</th><th>牛舍</th><th>阶段</th><th class="align-right">今日产奶</th><th class="align-right">健康分</th><th>状态</th><th></th></tr></thead>
          <tbody>
            ${pageCows.length ? pageCows.map((cow) => `<tr data-action="select-cow-row" data-tag="${cow.earTag}" class="${cow.earTag === ui.selectedCow ? 'is-selected' : ''}">
              <td><strong>${esc(cow.name)}</strong><span class="cell-muted" style="display:block;font-size:7px">${cow.earTag}</span></td>
              <td>${cow.barnId}</td><td>${cow.group}</td>
              <td class="align-right"><span class="cell-value">${cow.milkToday.toFixed(1)}</span> <span class="cell-muted">L</span></td>
              <td class="align-right"><span class="cell-value">${cow.healthScore}</span></td>
              <td>${statusBadge(cow.healthStatus)}</td>
              <td><span class="row-action">详情</span></td>
            </tr>`).join('') : `<tr><td colspan="7">${emptyState('search', '没有匹配的奶牛', '调整筛选条件后再试。')}</td></tr>`}
          </tbody>
        </table>
      </div>
      <div class="table-footer"><span>显示 ${cows.length ? ui.milkPage * pageSize + 1 : 0}–${Math.min(cows.length, (ui.milkPage + 1) * pageSize)} / ${cows.length} 头</span><span class="pager"><button type="button" data-action="page-cows" data-page="${ui.milkPage - 1}" ${ui.milkPage <= 0 ? 'disabled' : ''}>${icon('chevronRight', 10)}</button><span>${ui.milkPage + 1} / ${pageCount}</span><button type="button" data-action="page-cows" data-page="${ui.milkPage + 1}" ${ui.milkPage >= pageCount - 1 ? 'disabled' : ''} style="transform:rotate(180deg)">${icon('chevronRight', 10)}</button></span></div>
    </section>
    <section class="card span-4">
      ${cardHead({ iconName: 'cow', kicker: 'FOCUS COW', title: '当前个体', sub: '点击左侧表格切换奶牛', actions: `<span class="status-badge ${HEALTH_STATUS[selected?.healthStatus]?.className || 'neutral'}">${HEALTH_STATUS[selected?.healthStatus]?.label || '—'}</span>` })}
      ${selected ? `<div class="detail-hero">
        <div class="cow-portrait ${selected.healthStatus === 'risk' ? 'is-risk' : ''}">${cowAvatar(selected)}</div>
        <div class="detail-hero-copy"><h3>${esc(selected.name)}</h3><span>${selected.earTag} · ${selected.barnId} · ${selected.breed}</span><div class="cow-meta" style="margin-top:4px"><span>${selected.group}</span><i></i><span>${selected.parity} 胎</span><i></i><span>${selected.ageMonths} 月龄</span></div></div>
        <div class="score-ring" style="--pct:${selected.healthScore}"><div class="score-ring-inner"><strong>${selected.healthScore}</strong><span>HEALTH</span></div></div>
      </div>
      <div class="detail-stats">
        <div class="detail-stat"><span>今日产奶</span><strong>${selected.milkToday.toFixed(1)} <small>L</small></strong></div>
        <div class="detail-stat"><span>反刍时长</span><strong>${cowHealth?.rumination || selected.rumination} <small>min</small></strong></div>
        <div class="detail-stat"><span>活动指数</span><strong>${cowHealth?.activity || selected.activity}</strong></div>
      </div>
      ${miniSparkline(cowSeries, { width: 280, height: 40, color: '#f0c987', id: `mh-${selected.earTag}` })}
      <div class="condition-note">${icon(selected.healthStatus === 'healthy' ? 'checkCircle' : 'warning', 12)}<span>${esc(selected.condition || '体征平稳，反刍与采食正常。')} ${cowHealth ? `最近巡检 ${timeOnly(cowHealth.measuredAt)}。` : ''}</span></div>
      <div class="btn-row"><button class="btn btn-sm btn-soft" type="button" data-action="open-form" data-form="milk" data-cow="${selected.earTag}">${icon('milk', 11)} 产奶</button><button class="btn btn-sm" type="button" data-action="open-form" data-form="health" data-cow="${selected.earTag}">${icon('heart', 11)} 健康</button><button class="btn btn-sm" type="button" data-action="open-form" data-form="breeding" data-cow="${selected.earTag}">${icon('spark', 11)} 配种</button></div>` : emptyState('cow', '选择一头奶牛', '从名单中选择个体查看完整档案')}
    </section>
    <section class="card span-12">
      ${cardHead({ iconName: 'clipboard', kicker: 'RECORD LEDGER', title: `${activeTab.label}`, sub: ui.recordScope === 'selected' ? `当前牛只 · ${selected?.earTag || '未选择'}` : '全群最近记录', actions: `<div class="record-tabs" style="margin:0"><button class="record-tab ${tab === 'milk' ? 'is-active' : ''}" type="button" data-action="record-tab" data-tab="milk">产奶</button><button class="record-tab ${tab === 'health' ? 'is-active' : ''}" type="button" data-action="record-tab" data-tab="health">健康</button><button class="record-tab ${tab === 'breeding' ? 'is-active' : ''}" type="button" data-action="record-tab" data-tab="breeding">配种</button></div><div class="segmented"><button type="button" class="${ui.recordScope === 'selected' ? 'is-active' : ''}" data-action="record-scope" data-scope="selected">当前牛只</button><button type="button" class="${ui.recordScope === 'all' ? 'is-active' : ''}" data-action="record-scope" data-scope="all">全群</button></div>` })}
      <div class="table-wrap">
        <table class="data-table">
          <thead><tr>${activeTab.header.map((h) => `<th>${h}</th>`).join('')}</tr></thead>
          <tbody>${activeTab.rows.length ? activeTab.rows.map((row) => `<tr>${row.map((cell) => `<td>${cell}</td>`).join('')}</tr>`).join('') : `<tr><td colspan="${activeTab.header.length}">${emptyState('clipboard', '暂无记录', '在右上角新增一条记录，趋势图会立即更新。')}</td></tr>`}</tbody>
        </table>
      </div>
    </section>
  </div>`;
}

function currentRecordRows(selectedTag) {
  const all = ui.recordScope === 'all';
  const milk = getRecentRecords(state, 'milk', all ? null : selectedTag, 10);
  const health = getRecentRecords(state, 'health', all ? null : selectedTag, 10);
  const breeding = getRecentRecords(state, 'breeding', all ? null : selectedTag, 10);
  return {
    milk: milk.map((r) => [timeOnly(r.milkedAt), `<span class="cell-muted">${r.earTag}</span>`, r.session, `<span class="cell-value">${Number(r.yield).toFixed(1)} L</span>`, `${r.fat}% / ${r.protein}%`, `<span class="status-badge ${r.quality === 'B' ? 'watch' : 'ok'}">${r.quality}</span>`]),
    health: health.map((r) => [timeOnly(r.measuredAt), `<span class="cell-muted">${r.earTag}</span>`, `${r.bodyTemp}°C`, `${r.rumination} min`, `<span class="cell-value">${r.score}</span>`, `${statusBadge(r.status)}<span class="cell-muted" style="margin-left:5px">${esc(r.notes).slice(0, 22)}</span>`]),
    breeding: breeding.map((r) => [timeOnly(r.bredAt), `<span class="cell-muted">${r.earTag}</span>`, r.method, r.bull, `<span class="status-badge ${r.result === '妊娠确认' ? 'ok' : r.result === '未妊娠' ? 'risk' : 'watch'}">${r.result}</span>`, dateOnly(r.expectedCalving)]),
  };
}

/* ------------------------------------------------------------------ */
/* 防疫巡检                                                             */
/* ------------------------------------------------------------------ */

function renderWorkView() {
  const pendings = state.workOrders.filter((w) => w.status === 'pending');
  const progress = state.workOrders.filter((w) => w.status === 'in_progress');
  const done = state.workOrders.filter((w) => w.status === 'done');
  const audits = [...state.traceLogs]
    .filter((log) => {
      if (ui.auditFilter === 'ALL') return ['巡检', '免疫', '用药', '联动', '产奶', '健康', '配种'].includes(log.category);
      return log.category === ui.auditFilter;
    })
    .sort((a, b) => new Date(b.at) - new Date(a.at))
    .slice(0, 8);
  const today = todayKey();
  const activeMed = state.workOrders.filter((w) => w.type === 'medication' && w.status !== 'done');
  const activeImmune = state.workOrders.filter((w) => w.type === 'immunization' && w.status !== 'done');
  const metrics = computeMetrics(state);
  return `${viewHeader({
    kicker: '<span class="live-dot"></span> INSPECTION & BIOSECURITY · TRACEABLE',
    title: '巡场、防疫与<b style="font-weight:500;color:var(--mint)">工作流</b>',
    subtitle: '从一次晨间巡舍，到一支疫苗的冷链温度。每一次执行、勾选、签字与用药都拥有时间戳，形成真正可追溯的牧场安全网。',
    actions: `<button class="btn" type="button" data-action="open-form" data-form="work" data-worktype="immunization">${icon('shield', 12)} 免疫 / 用药登记</button><button class="btn btn-primary" type="button" data-action="open-form" data-form="work" data-worktype="inspection">${icon('plus', 12)} 新建巡检任务</button>`,
    meta: `<i></i>${pendings.length + progress.length} 项进行中 · 今日已完成 ${done.filter((w) => w.completedAt && localDateKey(new Date(w.completedAt)) === today).length}`,
  })}
  <div class="metric-ribbon">
    ${metricCard({ label: '待执行', value: pendings.length, unit: '项', iconName: 'clock', foot: '按计划排程', accent: 'var(--gold)' })}
    ${metricCard({ label: '进行中', value: progress.length, unit: '项', iconName: 'activity', foot: '需要现场确认', accent: 'var(--blue)' })}
    ${metricCard({ label: '已完成', value: done.length, unit: '项', iconName: 'checkCircle', foot: '含历史已归档工单', accent: 'var(--mint)' })}
    ${metricCard({ label: '免疫待执行', value: activeImmune.length, unit: '批', iconName: 'shield', foot: `${state.workOrders.filter((w) => w.type === 'immunization' && w.status === 'done').length} 批已归档`, accent: 'var(--gold)' })}
    ${metricCard({ label: '诊疗用药', value: activeMed.length, unit: '例', iconName: 'pill', foot: '含休药期追踪', accent: 'var(--coral)' })}
    ${metricCard({ label: '风险牛只', value: metrics.risk, unit: '头', iconName: 'warning', foot: '已进入健康观察', accent: 'var(--coral)' })}
  </div>
  <div class="dashboard-grid">
    <section class="card span-12" style="padding:12px 14px">
      <div class="kanban">
        ${renderKanbanColumn('pending', pendings)}
        ${renderKanbanColumn('in_progress', progress)}
        ${renderKanbanColumn('done', done)}
      </div>
    </section>
    <section class="card span-7">
      ${cardHead({ iconName: 'route', kicker: 'AUDIT TRAIL · IMMUTABLE LOG', title: '全链路留痕', sub: '每次巡检、免疫、用药与联动动作都会写入时间线', actions: `<div class="segmented"><button class="${ui.auditFilter === 'ALL' ? 'is-active' : ''}" type="button" data-action="audit-filter" data-filter="ALL">全部</button><button class="${ui.auditFilter === '巡检' ? 'is-active' : ''}" type="button" data-action="audit-filter" data-filter="巡检">巡检</button><button class="${ui.auditFilter === '免疫' ? 'is-active' : ''}" type="button" data-action="audit-filter" data-filter="免疫">免疫</button><button class="${ui.auditFilter === '用药' ? 'is-active' : ''}" type="button" data-action="audit-filter" data-filter="用药">用药</button></div>` })}
      <div class="timeline">
        ${audits.length ? audits.map((log) => `<div class="timeline-item" data-type="${esc(log.category)}">
          <span class="timeline-dot"></span>
          <div class="timeline-content"><div class="timeline-topline"><strong>${esc(log.action)}</strong><time>${timeOnly(log.at)}</time></div><p>${esc(log.detail)}</p><em>${esc(log.actor)} · ${esc(log.target)}${log.orderNo ? ` · ${esc(log.orderNo)}` : ''}</em></div>
        </div>`).join('') : emptyState('clipboard', '暂无审计记录', '完成一次巡检或用药登记，留痕会出现在这里。')}
      </div>
    </section>
    <section class="card span-5">
      ${cardHead({ iconName: 'shield', kicker: 'BIO-SECURITY COMPLIANCE', title: '防疫与用药合规', sub: '批号、剂量、休药期与观察期' })}
      <div class="audit-grid">
        <div class="audit-stat"><span>疫苗批次在册</span><strong>${state.workOrders.filter((w) => w.type === 'immunization').length}</strong></div>
        <div class="audit-stat"><span>用药记录</span><strong>${state.workOrders.filter((w) => w.type === 'medication').length}</strong></div>
        <div class="audit-stat"><span>休药期追踪</span><strong>${activeMed.length ? '进行中' : '正常'}</strong></div>
        <div class="audit-stat"><span>审计轨迹</span><strong>${state.traceLogs.length}</strong></div>
      </div>
      <div class="strategy-list" style="margin-top:12px">
        <div class="strategy-item"><span class="strategy-icon">01</span><div class="strategy-copy"><strong>今日免疫建议</strong><span>秋季口蹄疫加强免疫，执行前需完成体温筛查与冷链温度核对。</span></div></div>
        <div class="strategy-item"><span class="strategy-icon">02</span><div class="strategy-copy"><strong>用药安全</strong><span>头孢噻呋钠休药期 7 天；乳品须在休药期结束后方可进入挤奶流程。</span></div></div>
        <div class="strategy-item"><span class="strategy-icon">03</span><div class="strategy-copy"><strong>巡检闭环</strong><span>所有待执行任务须在现场签到，完成后自动归档并生成执行人签名。</span></div></div>
      </div>
      <button class="btn btn-soft btn-block" type="button" data-action="open-form" data-form="work" data-worktype="medication" style="margin-top:12px">${icon('pill', 12)} 新增用药记录</button>
    </section>
  </div>`;
}

function renderKanbanColumn(statusKey, orders) {
  const status = WORK_STATUS[statusKey];
  const list = statusKey === 'done' ? [...orders].sort((a, b) => new Date(b.completedAt || b.updatedAt) - new Date(a.completedAt || a.updatedAt)).slice(0, 5) : orders;
  return `<div class="kanban-column" data-status="${statusKey}">
    <div class="kanban-head"><span class="kanban-dot"></span><strong>${status.label}</strong><span>${orders.length}</span></div>
    <div class="kanban-list">
      ${list.length ? list.map((order) => renderWorkCard(order)).join('') : emptyState('checkCircle', '这里很安静', '暂时没有任务。')}
    </div>
  </div>`;
}

function renderWorkCard(order) {
  const type = WORK_TYPE[order.type] || WORK_TYPE.inspection;
  const dueLabel = relativeDateLabel(order.scheduledAt);
  return `<button class="work-card" type="button" data-action="open-order" data-order="${order.orderNo}">
    <span class="work-card-top"><span class="work-type ${order.type}">${icon(type.icon, 10)}${type.short}</span><span class="work-priority ${order.priority === 'urgent' ? 'urgent' : ''}">${order.priority === 'urgent' ? '紧急' : order.priority === 'high' ? '优先' : '常规'}</span></span>
    <span class="work-card-title">${esc(order.title)}</span>
    <span class="work-card-meta"><span>${icon('location', 9)} ${esc(order.targetLabel || order.barnId)}</span><span>${icon('user', 9)} ${esc(order.assignee)}</span></span>
    <span class="work-card-footer"><time>${order.status === 'done' ? `完成 ${timeOnly(order.completedAt)}` : `计划 ${dueLabel} ${clockOnly(order.scheduledAt)}`}</time><span class="row-action">查看</span></span>
  </button>`;
}

/* ------------------------------------------------------------------ */
/* 报表中心                                                             */
/* ------------------------------------------------------------------ */

function renderReportsView() {
  const report = buildReport(state, ui.reportType, ui.reportDays);
  const summaryMap = {
    production: [
      ['区间总产奶', `${fmt(report.summary.totalMilk, 1)}`, 'L', '来自挤奶台汇总'],
      ['日均产奶', `${fmt(report.summary.avgDay, 1)}`, 'L', `近 ${ui.reportDays} 日`],
      ['平均单产', `${fmt(report.summary.avgYield, 1)}`, 'L/头', '泌乳牛口径'],
      ['全群头均产奶', `${fmt(report.summary.milkPerCow, 1)}`, 'L/头', '按全群折算'],
    ],
    health: [
      ['平均健康分', `${fmt(report.summary.avgScore, 1)}`, '分', 'IoT + 人工巡检'],
      ['风险牛只', `${report.summary.abnormal}`, '头', '需要干预'],
      ['免疫完成', `${report.summary.immunization}`, '批', '本期已归档'],
      ['用药记录', `${report.summary.medication}`, '例', '含休药期追踪'],
    ],
    energy: [
      ['统计总能耗', `${fmt(report.summary.totalEnergy, 1)}`, 'kWh', '通风 / 照明 / 其他'],
      ['日均能耗', `${fmt(report.summary.avgDay, 1)}`, 'kWh', '环控设备合计'],
      ['单位奶耗', `${fmt(report.summary.intensity, 1)}`, 'Wh/L', '能效核心指标'],
      ['照明占比', `${fmt(report.summary.lightingShare, 1)}`, '%', '补光与夜间照明'],
    ],
  };
  const summary = summaryMap[ui.reportType] || summaryMap.production;
  const insight = ui.reportType === 'production'
    ? `本期累计产奶 ${fmt(report.summary.totalMilk, 1)} L，日均 ${fmt(report.summary.avgDay, 1)} L。乳脂率稳定在 ${report.rawRows[report.rawRows.length - 1]?.fat ?? '—'}% 附近，建议保持当前挤奶节律并关注单产波动。`
    : ui.reportType === 'health'
      ? `本期平均健康分 ${report.summary.avgScore}，共有 ${report.summary.followUps} 头牛只处于观察或风险状态。免疫完成 ${report.summary.immunization} 批，用药 ${report.summary.medication} 例，建议优先跟踪休药期牛只。`
      : `本期总能耗 ${fmt(report.summary.totalEnergy, 1)} kWh，单位奶耗 ${fmt(report.summary.intensity, 1)} Wh/L。照明能耗占 ${report.summary.lightingShare}%，夜间补光可结合日出日落曲线进一步优化。`;
  return `${viewHeader({
    kicker: '<span class="live-dot"></span> REPORTS · PASTURE INTELLIGENCE',
    title: '牧场<b style="font-weight:500;color:var(--mint)">统计报表</b>',
    subtitle: '产奶、健康与环控能耗的周期性业务切片。调整时间范围与报表类型，导出 CSV 或打印为一份可归档的牧场报告。',
    actions: `<button class="btn" type="button" data-action="print-report">${icon('print', 12)} 打印报表</button><button class="btn btn-primary" type="button" data-action="export-csv">${icon('download', 12)} 导出 CSV</button>`,
    meta: `<i></i>${report.rawRows[0]?.date || report.rawRows[0]?.dateKey || ''} 至 ${report.rawRows[report.rawRows.length - 1]?.date || report.rawRows[report.rawRows.length - 1]?.dateKey || ''}`,
  })}
  <div class="report-toolbar">
    <div class="report-tabs">
      <button class="report-tab ${ui.reportType === 'production' ? 'is-active' : ''}" type="button" data-action="report-type" data-report="production">${icon('milk', 12)} 产量报表</button>
      <button class="report-tab ${ui.reportType === 'health' ? 'is-active' : ''}" type="button" data-action="report-type" data-report="health">${icon('heart', 12)} 健康报表</button>
      <button class="report-tab ${ui.reportType === 'energy' ? 'is-active' : ''}" type="button" data-action="report-type" data-report="energy">${icon('energy', 12)} 环控能耗</button>
    </div>
    <div class="btn-row">
      ${[7, 14].map((days) => `<button class="chip ${ui.reportDays === days ? 'is-active' : ''}" type="button" data-action="report-days" data-days="${days}">近 ${days} 天</button>`).join('')}
      <span class="filter-label">REPORT RANGE</span>
    </div>
  </div>
  <div class="report-summary">
    ${summary.map(([label, value, unit, foot]) => `<div class="report-stat"><span>${label}</span><strong>${value} <small>${unit}</small></strong><em>${foot}</em></div>`).join('')}
  </div>
  <div class="dashboard-grid">
    <section class="card span-8">
      ${cardHead({ iconName: 'chart', kicker: 'ANALYTICS VIEW', title: report.title, sub: report.subtitle, actions: `<span class="view-meta">${ui.reportDays} 天 · ${clockOnly(new Date().toISOString())} 生成</span>` })}
      <div id="report-chart" class="chart-wrap chart-lg"></div>
    </section>
    <section class="card span-4">
      ${cardHead({ iconName: 'spark', kicker: 'INSIGHT NOTE', title: '经营洞察', sub: '基于当前所选区间的自动解读' })}
      <div class="report-note">${icon('spark', 12)}<span>${insight}</span></div>
      <div class="summary-bar" style="margin-top:14px">
        <div class="summary-segment" style="flex:${Math.max(25, 52)};background:var(--mint)">健康 ${state.cows.filter((c) => c.healthStatus === 'healthy').length}</div>
        <div class="summary-segment" style="flex:${Math.max(14, 22)};background:var(--gold)">观察 ${state.cows.filter((c) => c.healthStatus === 'watch').length}</div>
        <div class="summary-segment" style="flex:${Math.max(9, 12)};background:var(--coral)">风险 ${state.cows.filter((c) => c.healthStatus === 'risk').length}</div>
      </div>
      <div class="chart-legend" style="margin-top:8px"><span class="legend-item"><i></i>健康</span><span class="legend-item gold"><i></i>观察</span><span class="legend-item coral"><i></i>风险</span></div>
      <div style="margin-top:15px;padding-top:12px;border-top:1px solid var(--line-soft)">
        <div class="section-heading"><h3>${icon('info', 12)} 报表说明</h3></div>
        <p style="color:var(--text-3);font-size:8.5px;line-height:1.7">产奶数据来自挤奶台自动采集，健康指标融合 IoT 体征与人工巡检。环控能耗按设备额定功率与运行时长估算，可用于对比不同环控策略的能效表现。</p>
      </div>
      <div class="btn-row" style="margin-top:12px"><button class="btn btn-sm" type="button" data-action="export-csv">${icon('download', 11)} CSV</button><button class="btn btn-sm" type="button" data-action="print-report">${icon('print', 11)} 打印 / PDF</button></div>
    </section>
    <section class="card span-12">
      ${cardHead({ iconName: 'report', kicker: 'DETAILED LEDGER', title: '明细数据', sub: `${report.title} · ${ui.reportDays} 天记录`, actions: `<span class="view-meta">${report.rows.length} 行</span>` })}
      <div class="table-wrap">
        <table class="data-table report-table">
          <thead><tr>${report.headers.map((h) => `<th>${esc(h)}</th>`).join('')}</tr></thead>
          <tbody>${report.rows.map((row) => `<tr>${row.map((cell) => `<td>${esc(cell)}</td>`).join('')}</tr>`).join('')}</tbody>
        </table>
      </div>
    </section>
  </div>`;
}

/* ------------------------------------------------------------------ */
/* 对象模型                                                             */
/* ------------------------------------------------------------------ */

function renderModelsView() {
  const counts = {
    barn: state.barns.length,
    device: state.devices.length,
    cow: state.cows.length,
    milk: state.milkRecords.length,
    health: state.healthRecords.length,
    breeding: state.breedingRecords.length,
    work: state.workOrders.length,
  };
  const nodes = [
    { key: 'barn', style: 'left:16%;top:21%' },
    { key: 'device', style: 'left:83%;top:17%' },
    { key: 'cow', style: 'left:12%;top:66%' },
    { key: 'milk', style: 'left:88%;top:56%' },
    { key: 'health', style: 'left:29%;top:89%' },
    { key: 'breeding', style: 'left:56%;top:93%' },
    { key: 'work', style: 'left:51%;top:7%' },
  ];
  return `${viewHeader({
    kicker: '<span class="live-dot"></span> DIGITAL TWIN · OBJECT MODELING',
    title: '牛舍与奶牛<b style="font-weight:500;color:var(--mint)">对象模型</b>',
    subtitle: '把牧场拆解成可计算的对象：牛舍、环控设备、奶牛、产奶与健康记录、工单。所有页面、图表与场景都读取同一套字段，避免“各看各的数据”。',
    actions: `<span class="view-meta"><i></i>${OBJECT_MODELS.length} 个物模型 · ${Object.values(counts).reduce((a, b) => a + b, 0)} 个实例</span><button class="btn" type="button" data-action="export-models">${icon('download', 12)} 导出模型</button>`,
  })}
  <div class="model-overview">
    <section class="card model-graph-card">
      <div class="card-kicker">${icon('layers', 11)} RELATION TOPOLOGY</div>
      <div class="model-graph">
        <div class="graph-core">${icon('leaf', 20)}<strong>数字孪生</strong><span>MISTY CORE</span></div>
        ${nodes.map((node) => {
          const model = OBJECT_MODELS.find((m) => m.key === node.key);
          return `<button class="graph-node" type="button" style="${node.style};--node-color:${model.color}" data-action="open-model" data-model="${node.key}">${icon(model.icon, 11)}<strong>${model.name.replace('物模型', '').replace('表单模型', '')}</strong><em>${counts[node.key]}</em></button>`;
        }).join('')}
      </div>
    </section>
    <section class="card model-stats-card">
      <div class="card-kicker">${icon('activity', 11)} INSTANCE COUNT</div>
      <div class="card-title">模型实例与关系</div>
      <div class="card-sub">业务表单自动归属到实体对象</div>
      <div class="model-stat-grid" style="margin-top:12px">
        <div class="model-stat"><span>牛舍对象</span><strong>${counts.barn}</strong><em>→ ${counts.device} 台设备</em></div>
        <div class="model-stat"><span>奶牛主键</span><strong>${counts.cow}</strong><em>耳标唯一</em></div>
        <div class="model-stat"><span>产奶记录</span><strong>${fmt(counts.milk)}</strong><em>时间序列</em></div>
        <div class="model-stat"><span>健康记录</span><strong>${fmt(counts.health)}</strong><em>体征 + 巡检</em></div>
        <div class="model-stat"><span>配种记录</span><strong>${counts.breeding}</strong><em>繁殖档案</em></div>
        <div class="model-stat"><span>工作流工单</span><strong>${counts.work}</strong><em>含审计轨迹</em></div>
      </div>
      <div class="model-relation" style="margin-top:11px">${icon('link', 11)} Barn 1:N Device · Barn 1:N Cow · Cow 1:N Records · WorkOrder N:N Cow</div>
    </section>
  </div>
  <div class="model-grid">
    ${OBJECT_MODELS.map((model) => `<section class="model-card" style="--model-color:${model.color}">
      <div class="model-card-head">
        <div class="model-title-row"><span class="model-icon">${icon(model.icon, 14)}</span><div><strong>${model.name}</strong><span>${model.en} · ${model.fields.length} FIELDS</span></div></div>
        <span class="model-instances">${fmt(counts[model.key] || 0)} 实例</span>
      </div>
      <p class="model-desc">${model.description}</p>
      <div class="model-fields">
        ${model.fields.map((field) => `<div class="field-row"><span class="field-key">${esc(field.key)}${field.pk ? '<span class="pk-chip">PK</span>' : ''}</span><span class="field-label">${esc(field.label)}</span><span class="field-type">${esc(field.type)}</span></div>`).join('')}
      </div>
      <div class="model-relation">${icon('link', 11)} ${esc(model.relation)}</div>
    </section>`).join('')}
  </div>`;
}

/* ------------------------------------------------------------------ */
/* 图表挂载                                                             */
/* ------------------------------------------------------------------ */

function mountCharts() {
  const metrics = computeMetrics(state);
  if (ui.view === 'ops') {
    const milk = getTotalMilkSeries(state, 14);
    chartHub.create('ops-milk-chart', milkTrendOption(milk, { compare: true, unit: 'L' }));
    chartHub.create('ops-health-chart', healthDonutOption(getHealthDistribution(state), { total: state.cows.length }));
    chartHub.create('ops-energy-chart', energyOption(getEnergyReport(state).slice(-8), { compact: false }));
    chartHub.create('ops-group-chart', groupHealthBarOption(getGroupHealthStats(state)));
  } else if (ui.view === 'environment') {
    const barn = barnById(state, ui.envBarn) || state.barns[0];
    const series = getBarnEnvSeries(state, barn.barnId, 36);
    chartHub.create('env-main-chart', environmentTrendOption(series, ui.envMetric, {
      compact: false,
      thresholds: metricThreshold(barn, ui.envMetric),
    }));
    chartHub.create('env-energy-chart', energyOption(getEnergyReport(state).slice(-8), { compact: false }));
  } else if (ui.view === 'milk') {
    const selected = cowByTag(state, ui.selectedCow);
    chartHub.create('mh-milk-chart', milkTrendOption(getTotalMilkSeries(state, 14), { compare: true, unit: 'L' }));
    chartHub.create('mh-health-chart', healthDonutOption(getHealthDistribution(state), { total: state.cows.length, compact: true }));
  } else if (ui.view === 'reports') {
    const report = buildReport(state, ui.reportType, ui.reportDays);
    if (ui.reportType === 'production') {
      chartHub.create('report-chart', milkTrendOption(report.series, { compare: true, unit: 'L' }));
    } else if (ui.reportType === 'health') {
      chartHub.create('report-chart', healthScoreOption(report.series.map((r) => ({ label: r.label, score: r.value }))));
    } else {
      chartHub.create('report-chart', energyOption(report.rawRows.map((r) => ({ label: r.date.slice(5), hvac: r.hvac, lighting: r.lighting, other: r.other })), { compact: false }));
    }
  }
}

/* ------------------------------------------------------------------ */
/* 性能：画质档位 + 帧率读数                                             */
/* ------------------------------------------------------------------ */

const QUALITY_CHOICES = [
  ['auto', '自动'],
  ['ultra', '极致'],
  ['high', '高'],
  ['balanced', '均衡'],
  ['smooth', '流畅'],
  ['minimal', '极简'],
];

const PERF_HUD_ON = (() => {
  try {
    return new URLSearchParams(location.search).has('perf') || location.hash === '#perf';
  } catch (error) {
    return false;
  }
})();

let perfTimer = null;
let perfHudEl = null;

function applyQualityChoice(value) {
  const quality = QUALITY_CHOICES.some(([key]) => key === value) ? value : 'auto';
  state.settings.quality = quality;
  scene?.setOptions({ quality });
  persist(true);
  const perf = scene?.getPerf?.();
  renderControlDrawer();
  showToast({
    tone: 'info',
    icon: 'dashboard',
    title: quality === 'auto' ? '已切回自动画质' : `已切换到「${perf?.label || quality}」画质`,
    message: quality === 'auto'
      ? '帧率低于 46 时自动降一档，稳定 56 以上再尝试升回。'
      : '档位立即生效，并会记住你的选择。',
  });
}

function qualitySwitcher() {
  const current = String(state.settings.quality || 'auto');
  return `<div class="quality-options">${QUALITY_CHOICES
    .map(([key, label]) => `<button class="${current === key ? 'is-active' : ''}" type="button" data-action="set-quality" data-quality="${key}">${label}</button>`)
    .join('')}</div>`;
}

function renderPerfSection() {
  const perf = scene?.getPerf?.() || { fps: 0, calls: 0, label: '高', auto: true, dpr: 1, size: '—', gpu: '' };
  return `
    <section class="control-section">
      <div class="control-section-head"><h3>${icon('dashboard', 13)} 性能画质</h3><span id="perfMode">${perf.auto ? '自动调节' : '手动档位'}</span></div>
      <div class="perf-grid">
        <div class="perf-cell"><span>实时帧率</span><b id="perfFps">${perf.fps || '--'}</b><em>FPS</em></div>
        <div class="perf-cell"><span>当前档位</span><b id="perfLevel">${perf.label}</b><em id="perfDpr">×${Number(perf.dpr || 1).toFixed(2)}</em></div>
        <div class="perf-cell"><span>绘制调用</span><b id="perfCalls">${perf.calls || '--'}</b><em id="perfSize">${perf.size || '—'}</em></div>
      </div>
      ${qualitySwitcher()}
      ${perf.software ? '<div class="perf-warn">检测到浏览器正在用软件渲染（硬件加速被关闭）。在 Edge 设置里开启「使用图形加速」并重启浏览器，帧率通常能提升 5～10 倍。</div>' : ''}
      <div class="form-hint" style="margin-top:8px">${perf.gpu ? `当前显卡：${esc(perf.gpu)}` : '自动档会按实时帧率降低分辨率与阴影开销。'}</div>
    </section>`;
}

function startPerfMonitor() {
  if (perfTimer) clearInterval(perfTimer);
  perfTimer = setInterval(updatePerfReadout, 650);
  updatePerfReadout();
}

function ensurePerfHud() {
  if (!PERF_HUD_ON || perfHudEl) return;
  perfHudEl = document.createElement('div');
  perfHudEl.className = 'perf-hud';
  perfHudEl.innerHTML = '<b>--</b><span>FPS</span><em></em>';
  document.body.appendChild(perfHudEl);

  const reportError = (message) => {
    if (!perfHudEl) return;
    perfHudEl.dataset.error = message;
    const meta = perfHudEl.querySelector('em');
    if (meta) meta.textContent = String(message).slice(0, 120);
  };
  window.addEventListener('error', (event) => reportError(event.message || 'script error'));
  window.addEventListener('unhandledrejection', (event) => reportError(event.reason?.message || String(event.reason)));
}

function updatePerfReadout() {
  if (!scene || typeof scene.getPerf !== 'function') return;
  const perf = scene.getPerf();
  const fps = perf.fps || 0;
  const setText = (id, value) => {
    const el = document.getElementById(id);
    if (el && el.textContent !== String(value)) el.textContent = String(value);
  };
  setText('perfFps', fps || '--');
  setText('perfLevel', perf.label || '—');
  setText('perfDpr', `×${Number(perf.dpr || 1).toFixed(2)}`);
  setText('perfCalls', perf.calls || '--');
  setText('perfSize', perf.size || '—');
  const mode = document.getElementById('perfMode');
  if (mode) setText('perfMode', perf.auto ? '自动调节' : '手动档位');
  document.body.dataset.quality = perf.level || '';

  if (PERF_HUD_ON) {
    ensurePerfHud();
    if (perfHudEl) {
      const fpsEl = perfHudEl.querySelector('b');
      const metaEl = perfHudEl.querySelector('em');
      if (fpsEl) fpsEl.textContent = String(fps || '--');
      if (metaEl && !perfHudEl.dataset.error) {
        metaEl.textContent = `${perf.label}${perf.auto ? '·auto' : '·fixed'} · q=${state.settings.quality} · ${perf.dpr}× · ${perf.calls}c · ${perf.gpuShort || '?'}`;
      }
      const title = `云栖智慧牧场 · Misty Pasture · ${fps} FPS ${perf.label}${perf.auto ? ' auto' : ''}`;
      if (document.title !== title) document.title = title;
    }
  }
}

/* ------------------------------------------------------------------ */
/* 场景控制台                                                           */
/* ------------------------------------------------------------------ */

function sceneToggle(setting, label, desc) {
  const on = !!state.settings[setting];
  return `<div class="control-row"><div class="control-row-copy"><strong>${label}</strong><span>${desc}</span></div><button class="switch ${on ? 'is-on' : ''}" type="button" role="switch" aria-checked="${on}" data-action="toggle-setting" data-setting="${setting}"><span></span></button></div>`;
}

function renderControlDrawer() {
  const body = $('#controlBody');
  if (!body) return;
  const info = scene?.getPhaseInfo() || { hour: state.settings.simHour, clock: fmtClock(state.settings.simHour), phase: daylightLabel(state.settings.simHour).label };
  body.innerHTML = `
    <section class="control-section">
      <div class="control-section-head"><h3>${icon('sun', 13)} 自然时序</h3><span id="autoTimeState">${state.settings.autoDaylight ? '自动流转' : '手动时刻'}</span></div>
      <div class="time-readout"><strong id="controlClock">${info.clock}</strong><span id="controlPhase">${info.phase}</span></div>
      <input type="range" id="timeRange" min="0" max="24" step="0.05" value="${info.hour}" aria-label="牧场模拟时间" />
      <div class="range-field-head" style="margin-top:3px"><span>00:00 · 夜晚</span><span>06:00 黎明</span><span>12:00 正午</span><span>18:00 黄昏</span></div>
      ${sceneToggle('autoDaylight', '自动昼夜流转', '光影、窗灯与星空随时间缓慢过渡')}
      <div class="control-divider"></div>
      <div class="control-row"><div class="control-row-copy"><strong>流速</strong><span>一天在 ${state.settings.daylightSpeed === 0.5 ? '约 40' : state.settings.daylightSpeed === 2 ? '约 10' : '约 20'} 分钟内走完</span></div><div class="speed-options">${[0.5, 1, 2].map((speed) => `<button class="${Number(state.settings.daylightSpeed) === speed ? 'is-active' : ''}" type="button" data-action="set-speed" data-speed="${speed}">${speed}×</button>`).join('')}</div></div>
      <div class="form-hint" style="margin-top:8px">拖动时间轴将暂停自动昼夜，便于定格一束光。</div>
    </section>
    <section class="control-section">
      <div class="control-section-head"><h3>${icon('cloud', 13)} 光影氛围</h3><span>ATMOSPHERE</span></div>
      ${sceneToggle('fog', '薄雾层', '岛缘与草地之间的低伏雾带')}
      ${sceneToggle('clouds', '漂浮云朵', '缓慢漂移的微缩云团')}
      ${sceneToggle('volumetric', '体积光', '从云层斜落入牧场的柔光柱')}
      ${sceneToggle('tiltShift', '移轴景深', '模拟微距摄影的焦外柔化')}
      ${sceneToggle('fireflies', '萤火微粒', '夜间漂浮的微光与星点')}
      ${sceneToggle('labels', '场景标签', '牛舍状态浮标与指标')}
      ${sceneToggle('cowTags', '全部耳标', '显示场景中每头奶牛的耳标')}
      <div class="range-field"><div class="range-field-head"><span>曝光</span><b id="exposureValue">${Number(state.settings.exposure).toFixed(2)}</b></div><input type="range" id="exposureRange" min="60" max="150" step="1" value="${Math.round(state.settings.exposure * 100)}" /></div>
      <div class="range-field"><div class="range-field-head"><span>泛光强度</span><b id="bloomValue">${Number(state.settings.bloom).toFixed(2)}</b></div><input type="range" id="bloomRange" min="0" max="80" step="1" value="${Math.round(state.settings.bloom * 100)}" /></div>
    </section>
    <section class="control-section">
      <div class="control-section-head"><h3>${icon('rotate', 13)} 镜头</h3><span>CAMERA</span></div>
      ${sceneToggle('autoRotate', '自动环绕', '让镜头以极慢的速度绕岛旋转')}
      <div class="focus-grid" style="margin-top:10px">
        <button class="focus-button" type="button" data-action="focus-scene" data-target="overview">${icon('mountain', 12)} 牧场全景</button>
        <button class="focus-button" type="button" data-action="focus-scene" data-target="cows">${icon('cow', 12)} 牛群草地</button>
        <button class="focus-button" type="button" data-action="focus-scene" data-target="B01">${icon('barn', 12)} B01 泌乳舍</button>
        <button class="focus-button" type="button" data-action="focus-scene" data-target="B02">${icon('barn', 12)} B02 成母舍</button>
        <button class="focus-button" type="button" data-action="focus-scene" data-target="B03">${icon('barn', 12)} B03 星芽舍</button>
        <button class="focus-button" type="button" data-action="reset-view">${icon('reset', 12)} 重置视角</button>
      </div>
    </section>
    ${renderPerfSection()}
    <section class="control-section">
      <div class="control-section-head"><h3>${icon('settings', 13)} 演示数据</h3><span>DEMO</span></div>
      <div class="control-row"><div class="control-row-copy"><strong>数据采集间隔</strong><span>环境遥测 10 秒 / 本地持久化 30 秒</span></div><span class="status-badge ok">运行中</span></div>
      <div class="control-row"><div class="control-row-copy"><strong>本地存储</strong><span>录入的数据与场景设置保存在当前浏览器</span></div><span class="status-badge neutral">${new Date(state.createdAt).toLocaleDateString('zh-CN')}</span></div>
      <button class="btn btn-danger btn-block" type="button" data-action="reset-demo" style="margin-top:10px">${icon('reset', 12)} 重置演示数据</button>
      <div class="control-footer-note">${icon('info', 11)}<span>微缩场景中的所有读数仅用于教学演示；动物模型与业务数据为虚构。场景会持续缓慢呼吸，让时间真正可见。</span></div>
    </section>`;
}

function openControlDrawer() {
  renderControlDrawer();
  const drawer = $('#controlDrawer');
  drawer.classList.add('is-open');
  drawer.setAttribute('aria-hidden', 'false');
  ui.controlDrawerOpen = true;
}

function closeDrawer(name) {
  const map = { control: 'controlDrawer', alarm: 'alarmDrawer' };
  const el = document.getElementById(map[name]);
  if (el) {
    el.classList.remove('is-open');
    el.setAttribute('aria-hidden', 'true');
  }
  if (name === 'control') ui.controlDrawerOpen = false;
  if (name === 'alarm') ui.alarmDrawerOpen = false;
}

/* ------------------------------------------------------------------ */
/* 告警中心 & 自动联动                                                  */
/* ------------------------------------------------------------------ */

function openAlarmDrawer() {
  closeDrawer('control');
  const drawer = $('#alarmDrawer');
  renderAlarmDrawer();
  drawer.classList.add('is-open');
  drawer.setAttribute('aria-hidden', 'false');
  ui.alarmDrawerOpen = true;
}

function renderAlarmDrawer() {
  const body = $('#alarmBody');
  if (!body) return;
  const active = [...activeAlarms(state)].sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
  const resolved = state.alarms.filter((a) => a.status === 'resolved').sort((a, b) => new Date(b.resolvedAt || b.createdAt) - new Date(a.resolvedAt || a.createdAt)).slice(0, 3);
  const critical = active.some((a) => a.level === 'critical');
  body.innerHTML = `
    <div class="auto-link-info">
      <span style="color:var(--mint)">${icon('link', 14)}</span>
      <span>自动环控联动</span>
      <button class="switch ${state.settings.autoControl ? 'is-on' : ''}" type="button" role="switch" aria-checked="${state.settings.autoControl}" data-action="toggle-auto-control"><span></span></button>
    </div>
    <div class="alarm-summary ${critical ? 'has-critical' : ''}">
      <span class="alarm-summary-icon">${icon(critical ? 'warning' : active.length ? 'bell' : 'leaf', 15)}</span>
      <div class="alarm-summary-copy"><strong>${active.length ? `${active.length} 条活动告警` : '环境平稳'}</strong><span>${active.length ? '环控联动与处置轨迹均会留痕' : '最近没有新的环境越限，牛舍呼吸平顺。'}</span></div>
      <button class="btn btn-sm" type="button" data-action="simulate-alert" data-barn="${ui.envBarn}">模拟越限</button>
    </div>
    <div class="alarm-section-title"><span>ACTIVE ALERTS</span><span>${active.length} ACTIVE</span></div>
    ${active.length ? active.map((alarm) => {
      const criticalCls = alarm.level === 'critical' ? 'critical' : '';
      return `<div class="alarm-detail ${criticalCls}">
        <div class="alarm-head">${icon('warning', 13)}<strong>${esc(alarm.title)} · ${esc(alarm.barnId)}</strong><time>${clockOnly(alarm.createdAt)}</time></div>
        <p>${esc(alarm.message)}</p>
        <div class="alarm-suggestion">${icon('spark', 10)} ${esc(alarm.suggestion || '')}</div>
        <div class="med-meta">${alarm.linkedAction ? `<span class="med-chip">联动 <b>${esc(alarm.linkedAction)}</b></span>` : '<span class="med-chip">联动 <b>待触发</b></span>'}<span class="med-chip">级别 <b>${alarm.level === 'critical' ? '严重' : '关注'}</b></span>${alarm.acknowledged ? '<span class="med-chip">状态 <b>已确认</b></span>' : ''}</div>
        <div class="alarm-detail-actions">
          ${!alarm.acknowledged ? `<button class="btn btn-sm" type="button" data-action="ack-alarm" data-alarm="${alarm.alarmId}">${icon('check', 10)} 确认收到</button>` : ''}
          <button class="btn btn-sm btn-soft" type="button" data-action="link-alarm" data-alarm="${alarm.alarmId}">${icon('link', 10)} 立即联动</button>
          <button class="btn btn-sm" type="button" data-action="resolve-alarm" data-alarm="${alarm.alarmId}">标记恢复</button>
          <button class="btn btn-sm" type="button" data-action="open-env" data-barn="${alarm.barnId}">环境详情</button>
        </div>
      </div>`;
    }).join('') : emptyState('leaf', '此刻没有环境告警', '所有指标都落在阈值内。你也可以注入一次越限，观察自动联动与留痕。')}
    <div class="alarm-section-title" style="margin-top:16px"><span>RECENTLY RESOLVED</span><span>${resolved.length} RECENT</span></div>
    <div class="alert-list">
      ${resolved.length ? resolved.map((alarm) => `<div class="alarm-card resolved">
        <div class="alarm-head">${icon('checkCircle', 13)}<strong>${esc(alarm.title)} · ${alarm.barnId}</strong><time>${clockOnly(alarm.resolvedAt || alarm.createdAt)}</time></div>
        <p class="alarm-desc">${esc(alarm.message)} · 已恢复正常</p>
        <div class="alarm-foot"><span class="alarm-linkage">${esc(alarm.linkedAction || '处置完成')}</span><span style="color:var(--muted);font-size:7.5px">${esc(alarm.acknowledgedBy || '系统')}</span></div>
      </div>`).join('') : emptyState('clock', '还没有恢复记录', '告警恢复后会保留在这里。')}
    </div>
    <div class="form-footer" style="margin-top:16px;padding-top:12px"><span class="form-footer-note">${icon('info', 11)} 越限判定以当前牛舍阈值配置为准。</span><button class="btn btn-sm" type="button" data-action="open-form" data-form="threshold" data-barn="${ui.envBarn}">阈值设置</button></div>
  `;
}

function acknowledgeAlarm(alarmId) {
  const alarm = state.alarms.find((a) => a.alarmId === alarmId);
  if (!alarm || alarm.status !== 'active') return;
  alarm.acknowledged = true;
  alarm.acknowledgedBy = '牧场管理员';
  addAudit(state, '告警', `确认告警 · ${alarm.title}`, alarm.message, `${alarm.barnId} · 环境告警中心`, '牧场管理员');
  persist(true);
  renderAlarmDrawer();
  renderSidebar();
  if (ui.view === 'environment' || ui.view === 'ops') renderView();
  showToast({ tone: 'success', icon: 'checkCircle', title: '告警已确认', message: `${alarm.barnId} ${alarm.title} 已记录人工确认，仍保留在活动告警中。` });
}

function linkAlarm(alarmId) {
  const alarm = state.alarms.find((a) => a.alarmId === alarmId);
  if (!alarm || alarm.status !== 'active') return;
  if (!alarm.linkedDeviceId) {
    showToast({ tone: 'info', icon: 'info', title: '暂无对应设备', message: '该告警未绑定环控设备，请手动检查牛舍。' });
    return;
  }
  const device = applyLinkage(state, alarm);
  if (!device) {
    showToast({ tone: 'warning', icon: 'warning', title: '设备不可用', message: '联动设备未找到或离线。' });
    return;
  }
  activateSecondaryDevices(alarm);
  persist(true);
  scene?.syncState(state);
  renderAlarmDrawer();
  renderSidebar();
  if (ui.view === 'environment' || ui.view === 'ops') renderView();
  showToast({ tone: 'warning', icon: 'link', title: '环控联动已执行', message: `${alarm.barnId} ${alarm.title} → ${device.name} 已开启，处置已写入审计轨迹。` });
}

function activateSecondaryDevices(alarm) {
  const devices = state.devices.filter((d) => d.barnId === alarm.barnId && d.type !== 'sensor');
  const changes = [];
  if (alarm.metric === 'temperature' && Number(alarm.value) > Number(alarm.threshold)) {
    for (const type of ['fan', 'mist']) {
      const device = devices.find((d) => d.type === type);
      if (device && device.mode === 'auto' && !device.running) {
        device.running = true;
        device.lastAction = `联动响应 · ${alarm.title}`;
        device.lastActionAt = new Date().toISOString();
        changes.push(device);
      }
    }
  } else if (alarm.metric === 'nh3') {
    for (const type of ['exhaust', 'fan']) {
      const device = devices.find((d) => d.type === type);
      if (device && device.mode === 'auto' && !device.running) {
        device.running = true;
        device.lastAction = `联动响应 · ${alarm.title}`;
        device.lastActionAt = new Date().toISOString();
        changes.push(device);
      }
    }
  } else if (alarm.metric === 'light' && Number(alarm.value) < Number(alarm.threshold)) {
    const light = devices.find((d) => d.type === 'light');
    if (light && light.mode === 'auto' && !light.running) {
      light.running = true;
      light.lastAction = '联动响应 · 光照偏低';
      light.lastActionAt = new Date().toISOString();
      changes.push(light);
    }
  }
  if (changes.length) {
    alarm.linkedAction = `${alarm.linkedAction || '已联动'} · ${changes.map((d) => d.name).join(' / ')}`;
    addAudit(state, '联动', '追加联动设备启动', changes.map((d) => d.name).join('、'), `${alarm.barnId} · ${alarm.title}`, '自动环控');
  }
}

function resolveAlarmManually(alarmId) {
  const alarm = state.alarms.find((a) => a.alarmId === alarmId);
  if (!alarm || alarm.status !== 'active') return;
  alarm.status = 'resolved';
  alarm.resolvedAt = new Date().toISOString();
  alarm.acknowledged = true;
  alarm.acknowledgedBy = '牧场管理员';
  addAudit(state, '告警', `人工标记恢复 · ${alarm.title}`, `现场复核后确认 ${alarm.barnId} 环境恢复正常。`, alarm.barnId, '牧场管理员');
  persist(true);
  scene?.syncState(state);
  renderAlarmDrawer();
  renderSidebar();
  renderHeaderStatus();
  if (ui.view === 'environment' || ui.view === 'ops') renderView();
  showToast({ tone: 'success', icon: 'checkCircle', title: '告警已恢复', message: `${alarm.barnId} ${alarm.title} 已转入恢复记录，处置已留痕。` });
}

function injectDemoAlarm(barnId) {
  const barn = barnById(state, barnId) || state.barns[0];
  const activeMetrics = activeAlarms(state).filter((a) => a.barnId === barn.barnId).map((a) => a.metric);
  const candidates = ['nh3', 'temperature', 'humidity', 'light'].filter((m) => !activeMetrics.includes(m));
  const metric = candidates[0] || 'nh3';
  let message;
  if (metric === 'temperature') {
    barn.temperature = Math.max(barn.temperature, barn.thresholds.tempHigh + 1.8);
    message = '温度';
  } else if (metric === 'humidity') {
    barn.humidity = Math.min(90, barn.thresholds.humidityHigh + 7);
    message = '湿度';
  } else if (metric === 'light') {
    barn.light = Math.max(18, barn.thresholds.lightLow - 55);
    message = '光照';
  } else {
    barn.nh3 = Math.max(barn.nh3, barn.thresholds.nh3High + 3.2);
    message = '氨气';
  }
  barn.updatedAt = new Date().toISOString();
  const created = recordEnvironmentReading(state, barn, {
    temperature: barn.temperature,
    humidity: barn.humidity,
    nh3: barn.nh3,
    light: barn.light,
  });
  processNewAlarms(created, { source: 'simulation' });
  if (!created.length) {
    showToast({ tone: 'info', icon: 'info', title: '模拟越限已注入', message: `${barn.barnId} 的${message}已超过阈值，但该指标已有活动告警。` });
  }
  persist(true);
  scene?.syncState(state);
  renderHeaderStatus();
  renderSidebar();
  renderFocusPanel();
  if (ui.alarmDrawerOpen) renderAlarmDrawer();
  if (ui.view === 'environment' || ui.view === 'ops') renderView();
}

function processNewAlarms(alarms, { source = 'sensor' } = {}) {
  if (!alarms.length) return;
  for (const alarm of alarms) {
    addAudit(state, '告警', `${alarm.title} · ${alarm.barnId}`, alarm.message, `${alarm.barnId} · 环境采集`, '系统');
    if (state.settings.autoControl && alarm.linkedDeviceId) {
      const device = applyLinkage(state, alarm);
      activateSecondaryDevices(alarm);
      if (!document.hidden) {
        showToast({
          tone: 'warning',
          icon: 'link',
          title: `环境越限 · ${alarm.barnId} ${alarm.title}`,
          message: `${alarm.message}${device ? `，已自动联动 ${device.name}` : ''}。处置已写入审计轨迹。`,
          duration: 7600,
        });
      }
    } else if (!document.hidden) {
      showToast({
        tone: 'danger',
        icon: 'warning',
        title: `环境越限 · ${alarm.barnId} ${alarm.title}`,
        message: `${alarm.message}。自动环控已暂停，请在告警中心确认后联动。`,
        duration: 7600,
      });
    }
  }
}

/* ------------------------------------------------------------------ */
/* 遥测模拟                                                             */
/* ------------------------------------------------------------------ */

function runSimulationTick() {
  if (!state) return;
  const info = scene?.getPhaseInfo() || { hour: state.settings.simHour, daylight: 0.55 };
  const hour = info.hour;
  const daylight = info.daylight;
  const newAlarms = [];
  const resolvedAlarms = [];
  const daily = state.energyHistory.find((row) => row.dateKey === todayKey());
  for (const barn of state.barns) {
    const barnDevices = devicesForBarn(state, barn.barnId);
    const fan = barnDevices.find((d) => d.type === 'fan');
    const exhaust = barnDevices.find((d) => d.type === 'exhaust');
    const mist = barnDevices.find((d) => d.type === 'mist');
    const heater = barnDevices.find((d) => d.type === 'heater');
    const light = barnDevices.find((d) => d.type === 'light');
    const diurnal = Math.sin(((hour - 8) / 24) * Math.PI * 2);
    const baseTemp = barn.barnId === 'B01' ? 21.8 : barn.barnId === 'B02' ? 22.1 : 22.7;
    const targetTemp = baseTemp + diurnal * 2.2 + (fan?.running ? -0.85 : 0) + (mist?.running ? -0.75 : 0) + (heater?.running ? 0.9 : 0);
    const targetHumidity = 64 - diurnal * 5.5 + (mist?.running ? 4.8 : 0) + (exhaust?.running ? -2.8 : 0);
    const targetNh3 = (barn.barnId === 'B01' ? 6.8 : barn.barnId === 'B02' ? 8.8 : 4.5) + (1 - daylight) * 1.2 - (exhaust?.running ? 3.8 : 0) - (fan?.running ? 0.8 : 0);
    const targetLight = daylight * 1100 + 220 + (light?.running ? 270 : 0) + (barn.barnId === 'B03' ? 80 : 0);
    const temp = clamp(barn.temperature + (targetTemp - barn.temperature) * 0.15 + (Math.random() - 0.5) * 0.28, 10, 34);
    const humidity = clamp(barn.humidity + (targetHumidity - barn.humidity) * 0.14 + (Math.random() - 0.5) * 0.9, 30, 90);
    const nh3 = clamp(barn.nh3 + (targetNh3 - barn.nh3) * 0.065 + (Math.random() - 0.5) * 0.26, 1.2, 30);
    const lightValue = clamp(barn.light + (targetLight - barn.light) * 0.2 + (Math.random() - 0.5) * 16, 0, 2200);
    const created = recordEnvironmentReading(state, barn, { temperature: temp, humidity, nh3, light: lightValue });
    newAlarms.push(...created);
    const resolved = resolveEnvironmentAlarms(state, barn);
    resolvedAlarms.push(...resolved);
    for (const device of barnDevices) {
      if (!device.running) continue;
      const increment = device.powerKw * 0.055;
      device.energyKwh = Number((device.energyKwh + increment).toFixed(2));
      barn.powerKwh = Number((barn.powerKwh + increment).toFixed(2));
      if (daily) {
        if (device.type === 'light') daily.lighting = Number((daily.lighting + increment).toFixed(2));
        else if (device.type !== 'sensor') daily.hvac = Number((daily.hvac + increment).toFixed(2));
        else daily.other = Number((daily.other + increment).toFixed(2));
        daily.total = Number((daily.hvac + daily.lighting + daily.other).toFixed(2));
      }
    }
  }
  state.weather.outsideTemp = Number((13.6 + Math.sin(((hour - 8) / 24) * Math.PI * 2) * 4.2 + (Math.random() - 0.5) * 0.3).toFixed(1));
  state.weather.wind = Number((1.1 + Math.random() * 1.2).toFixed(1));
  if (newAlarms.length) processNewAlarms(newAlarms);
  for (const alarm of resolvedAlarms) {
    addAudit(state, '告警', `${alarm.title} · 自动恢复`, `${alarm.barnId} 指标回到阈值范围，告警转入恢复记录。`, alarm.barnId, '系统');
    if (!document.hidden) {
      showToast({ tone: 'success', icon: 'checkCircle', title: '环境已恢复', message: `${alarm.barnId} ${alarm.title} 已回到舒适区间。`, duration: 4200 });
    }
  }
  state.lastSimulationAt = new Date().toISOString();
  state.settings.simHour = hour;
  scene?.syncState(state);
  renderHeaderStatus();
  renderSidebar();
  renderFocusPanel();
  if (ui.alarmDrawerOpen) renderAlarmDrawer();
  // 实时数字在侧栏与场景标签更新；大屏保留当前滚动位置与图表交互，
  // 用户可按“刷新采集”同步趋势图，避免遥测采集打断正在阅读的页面。
  persist();
}

/* ------------------------------------------------------------------ */
/* Toast                                                               */
/* ------------------------------------------------------------------ */

function showToast({ tone = 'info', title, message = '', icon: iconName = 'spark', duration = 4600 }) {
  const stack = $('#toastStack');
  if (!stack) return;
  const el = document.createElement('div');
  el.className = `toast ${tone}`;
  el.innerHTML = `<span class="toast-icon">${icon(iconName, 13)}</span><div class="toast-copy"><strong>${esc(title)}</strong>${message ? `<p>${esc(message)}</p>` : ''}</div><button class="toast-close" type="button" aria-label="关闭提示">${icon('close', 11)}</button>`;
  stack.prepend(el);
  while (stack.children.length > 4) stack.lastElementChild?.remove();
  const remove = () => {
    el.classList.add('is-leaving');
    setTimeout(() => el.remove(), 300);
  };
  el.querySelector('.toast-close')?.addEventListener('click', remove);
  setTimeout(remove, duration);
}

/* ------------------------------------------------------------------ */
/* 通用弹窗                                                             */
/* ------------------------------------------------------------------ */

function openModal({ title, kicker = 'PASTURE WORKFLOW', subtitle = '', body = '', size = '' }) {
  $('#modalKicker').textContent = kicker;
  $('#modalTitle').textContent = title;
  $('#modalSubtitle').textContent = subtitle;
  $('#modalBody').innerHTML = body;
  const panel = $('#modalRoot .modal-panel');
  panel.classList.toggle('is-wide', size === 'wide');
  panel.classList.toggle('is-narrow', size === 'narrow');
  $('#modalRoot').classList.add('is-open');
  $('#modalRoot').setAttribute('aria-hidden', 'false');
  ui.modalOpen = true;
}

function closeModal() {
  $('#modalRoot').classList.remove('is-open');
  $('#modalRoot').setAttribute('aria-hidden', 'true');
  ui.modalOpen = false;
}

function openResetModal() {
  openModal({
    title: '重置演示数据？',
    kicker: 'RESET DEMO · LOCAL STORAGE',
    subtitle: '这会清除当前浏览器中所有录入的产奶、健康、配种与工单记录，并重新生成今日演示数据。',
    size: 'narrow',
    body: `<div class="form-note warning">${icon('warning', 12)}<span>场景设置、自动环控状态与审计轨迹也将一并恢复初始值。此操作不可撤销。</span></div>
      <div class="form-footer"><span class="form-footer-note">仅影响当前浏览器 · 不涉及任何真实牧场数据</span><div class="form-footer-actions"><button class="btn" type="button" data-close-modal>取消</button><button class="btn btn-danger" type="button" data-action="confirm-reset">${icon('reset', 12)} 确认重置</button></div></div>`,
  });
}

/* ------------------------------------------------------------------ */
/* 业务录入表单                                                         */
/* ------------------------------------------------------------------ */

const FORM_META = {
  milk: { title: '产奶记录', kicker: 'MILK RECORD · FORM', subtitle: '单头或分组录入挤奶量，趋势与 KPI 会即时更新。', icon: 'milk' },
  health: { title: '健康记录', kicker: 'HEALTH RECORD · FORM', subtitle: '记录体征、反刍与巡检判断，更新个体健康画像。', icon: 'heart' },
  breeding: { title: '配种记录', kicker: 'BREEDING RECORD · FORM', subtitle: '补全繁殖档案，支持个体与同期发情分组。', icon: 'spark' },
  work: { title: '新建巡检 / 防疫工单', kicker: 'WORK ORDER · FORM', subtitle: '指定对象、执行人与计划时间，所有操作自动留痕。', icon: 'clipboard' },
  threshold: { title: '环境阈值设置', kicker: 'ENVIRONMENT THRESHOLD · FORM', subtitle: '更新告警上下限，下一轮采集按新阈值判定。', icon: 'settings' },
};

function cowOptions(selectedTag) {
  return state.barns.map((barn) => `<optgroup label="${barn.barnId} · ${barn.name}">${state.cows.filter((c) => c.barnId === barn.barnId).map((cow) => `<option value="${cow.earTag}" ${cow.earTag === selectedTag ? 'selected' : ''}>${cow.earTag} · ${esc(cow.name)}（${HEALTH_STATUS[cow.healthStatus].label}）</option>`).join('')}</optgroup>`).join('');
}

function groupOptions(type) {
  const categories = new Map();
  for (const cow of state.cows) {
    if (type === 'milk' && cow.group !== '泌乳牛') continue;
    const key = `${cow.barnId}|${cow.group}`;
    categories.set(key, (categories.get(key) || 0) + 1);
  }
  return [...categories.entries()].map(([key, count]) => {
    const [barnId, group] = key.split('|');
    return `<option value="${key}">${barnId} · ${group}（${count} 头）</option>`;
  }).join('');
}

function sessionNow() {
  const h = new Date().getHours();
  if (h < 11) return '早班';
  if (h < 16) return '午班';
  if (h < 21) return '晚班';
  return '全天累计';
}

function openDataForm(type, { mode, cow, workType } = {}) {
  if (type === 'threshold') {
    openThresholdModal(ui.envBarn);
    return;
  }
  const meta = FORM_META[type];
  if (!meta) return;
  const selectedCow = cowByTag(state, cow || ui.selectedCow) || state.cows.find((c) => c.showcase) || state.cows[0];
  const modeValue = type === 'work' ? 'individual' : (mode === 'group' ? 'group' : 'individual');
  const body = type === 'work' ? workFormMarkup(workType || 'inspection') : recordFormMarkup(type, modeValue, selectedCow);
  openModal({ title: meta.title, kicker: meta.kicker, subtitle: meta.subtitle, body, size: type === 'work' ? 'wide' : '' });
  if (type !== 'work') {
    switchFormMode(modeValue);
    if (modeValue === 'group') updateGroupHint($('#recordForm'));
  } else {
    updateWorkFormVisibility($('#workForm'));
  }
}

function recordFormMarkup(type, mode, selectedCow) {
  const selectedHealth = HEALTH_STATUS[selectedCow?.healthStatus] || HEALTH_STATUS.healthy;
  const commonTargets = `
    <div data-mode-panel="individual" class="${mode === 'individual' ? '' : 'is-hidden'}">
      <div class="form-grid">
        <div class="form-field span-2"><label>对象奶牛 <b>*</b><em>耳标号是唯一主键</em></label><select class="form-control" name="cowTag" id="recordCow" ${mode === 'individual' ? '' : 'disabled'}>${cowOptions(selectedCow?.earTag)}</select></div>
      </div>
    </div>
    <div data-mode-panel="group" class="${mode === 'group' ? '' : 'is-hidden'}">
      <div class="form-grid">
        <div class="form-field span-2"><label>批量对象 <b>*</b><em>同名记录将写入组内每头奶牛</em></label><select class="form-control" name="groupTarget" id="groupTarget" ${mode === 'group' ? '' : 'disabled'}>${groupOptions(type)}</select></div>
      </div>
      <div class="form-hint" id="groupHint" style="margin-top:5px">选择分组后，将批量生成对应牛只记录。</div>
    </div>`;
  let fields = '';
  if (type === 'milk') {
    fields = `<div class="form-grid">
      <div class="form-field"><label>挤奶时间 <b>*</b></label><input class="form-control" type="datetime-local" name="milkedAt" value="${inputDateTime()}" required /></div>
      <div class="form-field"><label>班次</label><select class="form-control" name="session">${MILK_SESSIONS.map((s) => `<option ${s === sessionNow() ? 'selected' : ''}>${s}</option>`).join('')}</select></div>
      <div class="form-field"><label>产奶量 (L) <b>*</b><em>单头口径</em></label><input class="form-control" type="number" name="yield" min="0.1" max="70" step="0.1" value="${selectedCow?.milkToday > 0 ? Number((selectedCow.milkToday / 1.2).toFixed(1)) : 26.5}" required /></div>
      <div class="form-field"><label>品质等级</label><select class="form-control" name="quality"><option>A+</option><option selected>A</option><option>B</option></select></div>
      <div class="form-field"><label>乳脂率 (%)</label><input class="form-control" type="number" name="fat" min="0" max="10" step="0.01" value="3.86" /></div>
      <div class="form-field"><label>乳蛋白率 (%)</label><input class="form-control" type="number" name="protein" min="0" max="10" step="0.01" value="3.26" /></div>
      <div class="form-field span-2"><label>记录备注</label><textarea class="form-control" name="note" placeholder="例如：右后乳区观察、挤奶设备状态…"></textarea></div>
    </div>`;
  } else if (type === 'health') {
    const defaultScore = selectedCow?.healthScore ?? 88;
    fields = `<div class="form-grid">
      <div class="form-field"><label>采集时间 <b>*</b></label><input class="form-control" type="datetime-local" name="measuredAt" value="${inputDateTime()}" required /></div>
      <div class="form-field"><label>健康状态</label><select class="form-control" name="healthStatus">${Object.entries(HEALTH_STATUS).map(([key, value]) => `<option value="${key}" ${key === selectedCow?.healthStatus ? 'selected' : ''}>${value.label}</option>`).join('')}</select></div>
      <div class="form-field"><label>健康评分 <b>*</b><em>0–100</em></label><input class="form-control" type="number" name="score" min="0" max="100" step="1" value="${defaultScore}" required /></div>
      <div class="form-field"><label>体温 (°C)</label><input class="form-control" type="number" name="bodyTemp" min="35" max="43" step="0.1" value="${selectedCow?.bodyTemp || 38.6}" /></div>
      <div class="form-field"><label>反刍时长 (min)</label><input class="form-control" type="number" name="rumination" min="0" max="900" step="1" value="${selectedCow?.rumination || 480}" /></div>
      <div class="form-field"><label>活动指数</label><input class="form-control" type="number" name="activity" min="0" max="100" step="1" value="${selectedCow?.activity || 82}" /></div>
      <div class="form-field"><label>跛行评分</label><select class="form-control" name="lameness">${[0, 1, 2, 3].map((n) => `<option ${n === selectedCow?.lameness ? 'selected' : ''}>${n}</option>`).join('')}</select></div>
      <div class="form-field"><label>复查提醒</label><label class="checkbox-row" style="height:34px"><input type="checkbox" name="followUp" ${selectedCow?.healthStatus === 'risk' ? 'checked' : ''} /> 24 小时后复查</label></div>
      <div class="form-field span-2"><label>巡检结论</label><textarea class="form-control" name="notes" placeholder="采食、反刍、乳房、蹄部及精神状态…">${esc(selectedCow?.condition || '')}</textarea></div>
    </div>`;
  } else if (type === 'breeding') {
    const expected = new Date();
    expected.setDate(expected.getDate() + 282);
    fields = `<div class="form-grid">
      <div class="form-field"><label>配种日期 <b>*</b></label><input class="form-control" type="date" name="bredAt" value="${inputDate()}" required /></div>
      <div class="form-field"><label>配种方式</label><select class="form-control" name="method"><option>人工授精</option><option>胚胎移植</option></select></div>
      <div class="form-field"><label>冻精 / 公牛编号</label><input class="form-control" type="text" name="bull" value="HOL-2318" /></div>
      <div class="form-field"><label>技术员</label><select class="form-control" name="technician"><option>顾雪</option><option>周楮</option><option>沈川</option><option>叶青</option></select></div>
      <div class="form-field"><label>复检结果</label><select class="form-control" name="result"><option>待复检</option><option>妊娠确认</option><option>未妊娠</option></select></div>
      <div class="form-field"><label>预产期</label><input class="form-control" type="date" name="expectedCalving" value="${inputDate(expected)}" /></div>
      <div class="form-field span-2"><label>备注</label><textarea class="form-control" name="note" placeholder="同期发情、复检安排或注意事项…"></textarea></div>
    </div>`;
  }
  return `<form id="recordForm" data-form-type="${type}">
    <input type="hidden" name="mode" value="${mode}" />
    <div class="form-mode-tabs">
      <button class="${mode === 'individual' ? 'is-active' : ''}" type="button" data-action="switch-form-mode" data-mode="individual">个体录入</button>
      <button class="${mode === 'group' ? 'is-active' : ''}" type="button" data-action="switch-form-mode" data-mode="group">分组录入</button>
    </div>
    <div class="form-section"><div class="form-section-title">记录对象</div>${commonTargets}</div>
    <div class="form-section"><div class="form-section-title">${type === 'milk' ? '挤奶与质量' : type === 'health' ? '体征与巡检' : '繁殖信息'}</div>${fields}</div>
    <div class="form-note">${icon('info', 12)}<span>${mode === 'group' ? '分组模式将把同一份记录写入所选分组中的每头奶牛，并分别生成唯一记录编号。' : '记录保存后将立即汇入趋势、报表与数字孪生档案，并自动追加审计轨迹。'}</span></div>
    <div class="form-footer"><span class="form-footer-note">必填项标记为 <b style="color:var(--coral)">*</b> · 时间为牧场本地时间</span><div class="form-footer-actions"><button class="btn" type="button" data-close-modal>取消</button><button class="btn btn-primary" type="submit">${icon('check', 12)} 保存记录</button></div></div>
  </form>`;
}

function switchFormMode(mode) {
  const form = $('#recordForm');
  if (!form) return;
  const hidden = form.querySelector('[name="mode"]');
  if (hidden) hidden.value = mode;
  form.querySelectorAll('.form-mode-tabs button').forEach((button) => {
    button.classList.toggle('is-active', button.dataset.mode === mode);
  });
  form.querySelectorAll('[data-mode-panel]').forEach((panel) => {
    panel.classList.toggle('is-hidden', panel.dataset.modePanel !== mode);
  });
  const cowSelect = form.querySelector('[name="cowTag"]');
  const groupSelect = form.querySelector('[name="groupTarget"]');
  if (cowSelect) cowSelect.disabled = mode !== 'individual';
  if (groupSelect) groupSelect.disabled = mode !== 'group';
  updateGroupHint(form);
}

function updateGroupHint(form) {
  if (!form) return;
  const groupTarget = form.querySelector('[name="groupTarget"]');
  const hint = form.querySelector('#groupHint');
  if (!groupTarget || !hint) return;
  const [barnId, group] = groupTarget.value.split('|');
  const count = state.cows.filter((cow) => cow.barnId === barnId && cow.group === group).length;
  hint.textContent = `将为此分组中的 ${count} 头奶牛分别生成记录。`;
}

function workStepsFor(type) {
  if (type === 'immunization') return ['核对疫苗批号与冷链温度', '健康筛查与禁忌症排查', '分组接种并记录耳标', '30 分钟过敏观察'];
  if (type === 'medication') return ['临床检查与诊断复核', '隔离保定并采集乳样', '按剂量给药并记录批号', '复查体细胞并解除隔离'];
  return ['温湿度 / 氨气读表核对', '卧床、饮水与采食检查', '牛群精神状态观察', '异常牛只标记与上报'];
}

function workFormMarkup(initialType) {
  const type = ['inspection', 'immunization', 'medication'].includes(initialType) ? initialType : 'inspection';
  return `<form id="workForm" data-form-type="work">
    <div class="form-section"><div class="form-section-title">工单类型</div>
      <div class="radio-chips">
        ${Object.entries(WORK_TYPE).map(([key, meta]) => `<label class="radio-chip"><input type="radio" name="workType" value="${key}" ${key === type ? 'checked' : ''} /><span>${icon(meta.icon, 11)} ${meta.label}</span></label>`).join('')}
      </div>
    </div>
    <div class="form-section"><div class="form-section-title">任务内容</div>
      <div class="form-grid">
        <div class="form-field span-2"><label>工单标题 <b>*</b></label><input class="form-control" type="text" name="title" placeholder="例如：B01 晚间巡舍与卧床检查" required /></div>
        <div class="form-field"><label>牛舍 / 区域</label><select class="form-control" name="barnId" id="workBarn">${state.barns.map((b) => `<option value="${b.barnId}">${b.barnId} · ${b.name}</option>`).join('')}</select></div>
        <div class="form-field"><label>对象类型</label><select class="form-control" name="targetType" id="workTargetType"><option value="barn">整栋牛舍</option><option value="group">生产分组</option><option value="cow">单头奶牛</option></select></div>
        <div class="form-field is-hidden" data-work-target="group"><label>生产分组</label><select class="form-control" name="workGroup">${['泌乳牛', '干奶牛', '青年牛', '犊牛'].map((g) => `<option>${g}</option>`).join('')}</select></div>
        <div class="form-field span-2 is-hidden" data-work-target="cow"><label>奶牛对象</label><select class="form-control" name="workCow">${cowOptions(ui.selectedCow)}</select></div>
        <div class="form-field"><label>计划执行时间 <b>*</b></label><input class="form-control" type="datetime-local" name="scheduledAt" value="${inputDateTime(new Date(Date.now() + 2 * 3600000))}" required /></div>
        <div class="form-field"><label>执行人</label><select class="form-control" name="assignee"><option>牧场管理员</option><option>林野</option><option>苏晚</option><option>江屿</option><option>宋栀</option><option>陈牧</option></select></div>
        <div class="form-field"><label>优先级</label><select class="form-control" name="priority"><option value="normal">常规</option><option value="high">优先</option><option value="urgent">紧急</option></select></div>
        <div class="form-field"><label>工单说明</label><input class="form-control" type="text" name="description" placeholder="现场重点、注意事项或关联告警…" /></div>
        <div class="form-field span-2"><label>执行清单</label><div class="form-note">${icon('clipboard', 12)}<span>${workStepsFor(type).map((s, i) => `${i + 1}. ${esc(s)}`).join('　')}</span></div></div>
      </div>
    </div>
    <div class="form-section" data-work-medical>
      <div class="form-section-title">免疫 / 用药信息</div>
      <div class="form-grid cols-3">
        <div class="form-field"><label>药品 / 疫苗名称 <b>*</b></label><input class="form-control" type="text" name="product" placeholder="例如：口蹄疫 O 型灭活疫苗" /></div>
        <div class="form-field"><label>批号</label><input class="form-control" type="text" name="batchNo" placeholder="批号便于追溯" /></div>
        <div class="form-field"><label>剂量</label><input class="form-control" type="text" name="dose" placeholder="2 ml / 头" /></div>
        <div class="form-field"><label>给药途径</label><select class="form-control" name="route"><option>肌肉注射</option><option>皮下注射</option><option>口服</option><option>局部外用</option></select></div>
        <div class="form-field"><label>休药期 (天)</label><input class="form-control" type="number" name="withdrawalDays" min="0" max="90" step="1" value="0" /></div>
        <div class="form-field"><label>过敏观察</label><select class="form-control" name="observation"><option>30 分钟</option><option>60 分钟</option><option>无需观察</option></select></div>
      </div>
    </div>
    <div class="form-note">${icon('info', 12)}<span>创建工单后将生成审计轨迹；执行人可在“防疫巡检”看板中签到、勾选步骤并完成签字。免疫 / 用药完成时会自动写入疫苗批号或休药期留痕。</span></div>
    <div class="form-footer"><span class="form-footer-note">提交后进入“待执行”队列</span><div class="form-footer-actions"><button class="btn" type="button" data-close-modal>取消</button><button class="btn btn-primary" type="submit">${icon('plus', 12)} 创建工单</button></div></div>
  </form>`;
}

function updateWorkFormVisibility(form) {
  if (!form || form.id !== 'workForm') return;
  const selectedType = form.querySelector('input[name="workType"]:checked')?.value || 'inspection';
  const targetType = form.querySelector('[name="targetType"]')?.value || 'barn';
  form.querySelectorAll('.radio-chip input[name="workType"]').forEach((input) => {
    input.closest('.radio-chip')?.classList.toggle('is-selected', input.checked);
  });
  form.querySelectorAll('[data-work-target]').forEach((field) => {
    field.classList.toggle('is-hidden', field.dataset.workTarget !== targetType);
  });
  form.querySelectorAll('[data-work-medical]').forEach((field) => {
    field.classList.toggle('is-hidden', selectedType === 'inspection');
  });
  const title = form.querySelector('[name="title"]');
  if (title) {
    title.placeholder = selectedType === 'inspection'
      ? '例如：B01 晚间巡舍与卧床检查'
      : selectedType === 'immunization'
        ? '例如：秋季口蹄疫加强免疫'
        : '例如：B02 乳房炎隔离治疗';
  }
  const product = form.querySelector('[name="product"]');
  const batch = form.querySelector('[name="batchNo"]');
  if (product) product.placeholder = selectedType === 'immunization' ? '例如：口蹄疫 O 型灭活疫苗' : '例如：头孢噻呋钠';
  if (batch) batch.placeholder = selectedType === 'immunization' ? '例如：FM-202610-08' : '例如：CF-202609-21';
  const note = form.querySelector('.form-note:last-of-type span');
  if (note && targetType === 'group') {
    const barnId = form.querySelector('[name="barnId"]')?.value;
    const group = form.querySelector('[name="workGroup"]')?.value;
    const count = state.cows.filter((c) => c.barnId === barnId && c.group === group).length;
    note.textContent = `将对 ${barnId} · ${group} 的 ${count} 头奶牛生成工单目标。提交后进入“待执行”队列，所有操作都会留痕。`;
  }
}

function updateWorkTargetOptions(form) {
  if (!form || form.id !== 'workForm') return;
  const barnId = form.querySelector('[name="barnId"]')?.value;
  const groupSelect = form.querySelector('[name="workGroup"]');
  if (groupSelect) {
    const groups = [...new Set(state.cows.filter((c) => c.barnId === barnId).map((c) => c.group))];
    groupSelect.innerHTML = groups.map((g) => `<option>${g}</option>`).join('');
  }
  const cowSelect = form.querySelector('[name="workCow"]');
  if (cowSelect) {
    const cows = state.cows.filter((c) => c.barnId === barnId);
    cowSelect.innerHTML = cows.map((c) => `<option value="${c.earTag}">${c.earTag} · ${esc(c.name)}</option>`).join('');
  }
  updateWorkFormVisibility(form);
}

function openThresholdModal(barnId) {
  const barn = barnById(state, barnId) || state.barns[0];
  const t = barn.thresholds;
  openModal({
    title: `${barn.barnId} · ${barn.name}`,
    kicker: 'ENVIRONMENT THRESHOLD · FORM',
    subtitle: '调整阈值后，下一轮环境采集将使用新的判定边界，并自动记录变更审计。',
    body: `<form id="thresholdForm" data-barn="${barn.barnId}">
      <div class="form-section"><div class="form-section-title">环境告警阈值</div>
        <div class="form-grid cols-3">
          <div class="form-field"><label>温度下限 (°C)</label><input class="form-control" type="number" name="tempLow" min="-10" max="30" step="0.1" value="${t.tempLow}" /></div>
          <div class="form-field"><label>温度上限 (°C)</label><input class="form-control" type="number" name="tempHigh" min="0" max="45" step="0.1" value="${t.tempHigh}" /></div>
          <div class="form-field"><label>氨气上限 (ppm)</label><input class="form-control" type="number" name="nh3High" min="1" max="80" step="0.1" value="${t.nh3High}" /></div>
          <div class="form-field"><label>湿度下限 (%)</label><input class="form-control" type="number" name="humidityLow" min="0" max="100" step="1" value="${t.humidityLow}" /></div>
          <div class="form-field"><label>湿度上限 (%)</label><input class="form-control" type="number" name="humidityHigh" min="0" max="100" step="1" value="${t.humidityHigh}" /></div>
          <div class="form-field"><label>光照下限 (lx)</label><input class="form-control" type="number" name="lightLow" min="0" max="10000" step="5" value="${t.lightLow}" /></div>
          <div class="form-field"><label>光照上限 (lx)</label><input class="form-control" type="number" name="lightHigh" min="0" max="50000" step="10" value="${t.lightHigh}" /></div>
        </div>
      </div>
      <div class="form-note warning">${icon('warning', 12)}<span>更严格的阈值会导致更多告警与联动；请根据牛舍类型与季节合理设置。犊牛舍温度下限建议不低于 18°C。</span></div>
      <div class="form-footer"><span class="form-footer-note">当前采集值会立即按新阈值重新判定</span><div class="form-footer-actions"><button class="btn" type="button" data-close-modal>取消</button><button class="btn btn-primary" type="submit">${icon('check', 12)} 保存阈值</button></div></div>
    </form>`,
    size: 'narrow',
  });
}

function applyMilkFilters() {
  const form = $('#milkFilterForm');
  if (!form) return;
  const fd = new FormData(form);
  ui.milkFilters = {
    query: String(fd.get('query') || '').trim(),
    barn: String(fd.get('barn') || 'ALL'),
    group: String(fd.get('group') || 'ALL'),
    status: String(fd.get('status') || 'ALL'),
  };
  ui.milkPage = 0;
  renderView();
}

function handleFormSubmit(event) {
  const form = event.target;
  if (!(form instanceof HTMLFormElement)) return;
  if (form.id === 'milkFilterForm') {
    event.preventDefault();
    applyMilkFilters();
    return;
  }
  if (!['recordForm', 'workForm', 'thresholdForm', 'completeOrderForm'].includes(form.id)) return;
  event.preventDefault();
  if (form.id === 'recordForm') submitRecordForm(form);
  else if (form.id === 'workForm') submitWorkForm(form);
  else if (form.id === 'thresholdForm') submitThresholdForm(form);
  else if (form.id === 'completeOrderForm') submitCompleteOrder(form);
}

function getRecordTargets(form) {
  const mode = form.querySelector('[name="mode"]')?.value || 'individual';
  if (mode === 'group') {
    const value = form.querySelector('[name="groupTarget"]')?.value || '';
    const [barnId, group] = value.split('|');
    return state.cows.filter((cow) => cow.barnId === barnId && cow.group === group);
  }
  const tag = form.querySelector('[name="cowTag"]')?.value;
  const cow = cowByTag(state, tag);
  return cow ? [cow] : [];
}

function submitRecordForm(form) {
  const type = form.dataset.formType;
  const fd = new FormData(form);
  const mode = String(fd.get('mode') || 'individual');
  let targets = getRecordTargets(form);
  if (type === 'milk') targets = targets.filter((cow) => cow.group === '泌乳牛');
  if (!targets.length) {
    showToast({ tone: 'danger', icon: 'warning', title: '没有可写入的牛只', message: type === 'milk' ? '产奶记录只能写入泌乳牛分组，请重新选择。' : '请检查对象选择。' });
    return;
  }
  const createdAt = new Date().toISOString();
  let auditCategory = '产奶';
  let auditAction = '';
  let summary = '';
  if (type === 'milk') {
    const yieldValue = Number(fd.get('yield'));
    if (!Number.isFinite(yieldValue) || yieldValue <= 0) {
      showToast({ tone: 'danger', icon: 'warning', title: '产奶量无效', message: '请输入大于 0 的产奶量。' });
      return;
    }
    const milkedAt = new Date(String(fd.get('milkedAt'))).toISOString();
    const dateKey = localDateKey(new Date(milkedAt));
    const session = String(fd.get('session') || '全天累计');
    const quality = String(fd.get('quality') || 'A');
    for (const cow of targets) {
      const record = {
        recordId: uid('MLK'),
        earTag: cow.earTag,
        barnId: cow.barnId,
        milkedAt,
        dateKey,
        session,
        yield: yieldValue,
        fat: Number(fd.get('fat') || 3.8),
        protein: Number(fd.get('protein') || 3.2),
        somaticCell: Math.round(90 + Math.random() * 130),
        quality,
        note: String(fd.get('note') || '人工录入'),
        source: '人工录入',
      };
      state.milkRecords.unshift(record);
      if (dateKey === todayKey()) cow.milkToday = Number((cow.milkToday + yieldValue).toFixed(1));
      cow.lastMilkAt = milkedAt;
    }
    auditCategory = '产奶';
    auditAction = mode === 'group' ? '批量录入产奶记录' : '录入单头产奶记录';
    summary = `${targets.length} 头 × ${yieldValue.toFixed(1)} L · ${session}`;
  } else if (type === 'health') {
    const score = clamp(Number(fd.get('score') || 80), 0, 100);
    const healthStatus = String(fd.get('healthStatus') || (score >= 88 ? 'healthy' : score >= 76 ? 'watch' : 'risk'));
    const measuredAt = new Date(String(fd.get('measuredAt'))).toISOString();
    for (const cow of targets) {
      const record = {
        recordId: uid('HLT'),
        earTag: cow.earTag,
        barnId: cow.barnId,
        measuredAt,
        dateKey: localDateKey(new Date(measuredAt)),
        bodyTemp: Number(fd.get('bodyTemp') || 38.6),
        rumination: Number(fd.get('rumination') || 480),
        activity: Number(fd.get('activity') || 82),
        lameness: Number(fd.get('lameness') || 0),
        score,
        status: healthStatus,
        source: '人工巡检录入',
        inspector: '牧场管理员',
        notes: String(fd.get('notes') || ''),
        followUp: Boolean(fd.get('followUp')),
      };
      state.healthRecords.unshift(record);
      cow.healthStatus = healthStatus;
      cow.healthScore = score;
      cow.bodyTemp = record.bodyTemp;
      cow.rumination = record.rumination;
      cow.activity = record.activity;
      cow.lameness = record.lameness;
      cow.condition = record.notes || cow.condition;
      cow.note = record.notes;
      cow.lastHealthAt = measuredAt;
      cow.lastInspection = measuredAt;
    }
    auditCategory = '健康';
    auditAction = mode === 'group' ? '批量录入健康巡检' : '录入健康巡检记录';
    summary = `${targets.length} 头 · 评分 ${score} · ${HEALTH_STATUS[healthStatus]?.label || ''}`;
  } else if (type === 'breeding') {
    const bredAt = new Date(String(fd.get('bredAt'))).toISOString();
    const expected = fd.get('expectedCalving') ? new Date(String(fd.get('expectedCalving'))).toISOString() : null;
    for (const cow of targets) {
      const record = {
        recordId: uid('BRD'),
        earTag: cow.earTag,
        barnId: cow.barnId,
        bredAt,
        dateKey: localDateKey(new Date(bredAt)),
        method: String(fd.get('method') || '人工授精'),
        bull: String(fd.get('bull') || ''),
        technician: String(fd.get('technician') || '牧场管理员'),
        result: String(fd.get('result') || '待复检'),
        expectedCalving: expected,
        note: String(fd.get('note') || ''),
      };
      state.breedingRecords.unshift(record);
    }
    auditCategory = '配种';
    auditAction = mode === 'group' ? '批量配种登记' : '配种登记';
    summary = `${targets.length} 头 · ${fd.get('method')} · ${fd.get('result')}`;
  }
  addAudit(state, auditCategory, auditAction, summary, mode === 'group' ? String(fd.get('groupTarget') || '分组') : targets[0].earTag, '牧场管理员');
  persist(true);
  scene?.syncState(state);
  closeModal();
  refreshGlobal({ view: true });
  showToast({ tone: 'success', icon: 'checkCircle', title: `${targets.length} 条记录已保存`, message: `${summary}，趋势与经营指标已更新。` });
}

function submitWorkForm(form) {
  const fd = new FormData(form);
  const type = String(fd.get('workType') || 'inspection');
  const title = String(fd.get('title') || '').trim();
  if (!title) {
    showToast({ tone: 'danger', icon: 'warning', title: '工单标题为空', message: '请填写清晰的执行主题。' });
    return;
  }
  const targetType = String(fd.get('targetType') || 'barn');
  let barnId = String(fd.get('barnId') || 'B01');
  let barn = barnById(state, barnId) || state.barns[0];
  let targetLabel = `${barn.barnId} · ${barn.name}`;
  let targetCow = null;
  let targetGroup = null;
  if (targetType === 'group') {
    targetGroup = String(fd.get('workGroup') || '泌乳牛');
    const count = state.cows.filter((c) => c.barnId === barnId && c.group === targetGroup).length;
    targetLabel = `${barnId} · ${targetGroup} ${count} 头`;
  } else if (targetType === 'cow') {
    const cow = cowByTag(state, String(fd.get('workCow') || ''));
    if (!cow) {
      showToast({ tone: 'danger', icon: 'warning', title: '奶牛对象无效', message: '请重新选择奶牛。' });
      return;
    }
    targetCow = cow.earTag;
    barnId = cow.barnId;
    barn = barnById(state, barnId) || barn;
    targetLabel = `${cow.earTag} · ${cow.name}`;
  }
  if ((type === 'immunization' || type === 'medication') && !String(fd.get('product') || '').trim()) {
    showToast({ tone: 'danger', icon: 'warning', title: '缺少药品信息', message: '免疫或用药工单必须填写药品 / 疫苗名称。' });
    return;
  }
  const scheduledAt = new Date(String(fd.get('scheduledAt'))).toISOString();
  const now = new Date().toISOString();
  const orderNo = nextOrderNo(state);
  const steps = workStepsFor(type).map((label) => ({ label, done: false }));
  const meta = type === 'inspection'
    ? { method: '现场巡检', location: barnId }
    : {
        product: String(fd.get('product') || ''),
        batchNo: String(fd.get('batchNo') || ''),
        dose: String(fd.get('dose') || ''),
        route: String(fd.get('route') || ''),
        withdrawalDays: Number(fd.get('withdrawalDays') || 0),
        observation: String(fd.get('observation') || ''),
      };
  const order = {
    orderNo,
    orderId: orderNo,
    type,
    title,
    targetType,
    barnId,
    targetGroup,
    targetCow,
    targetLabel,
    scheduledAt,
    assignee: String(fd.get('assignee') || '牧场管理员'),
    status: 'pending',
    priority: String(fd.get('priority') || 'normal'),
    steps,
    trace: [{ id: uid('WT'), at: now, actor: '牧场管理员', action: '创建工单', detail: String(fd.get('description') || '由牧场管理端创建') }],
    meta,
    description: String(fd.get('description') || ''),
    createdAt: now,
    updatedAt: now,
  };
  state.workOrders.unshift(order);
  addAudit(state, type === 'inspection' ? '巡检' : type === 'immunization' ? '免疫' : '用药', `创建工单 · ${title}`, `${targetLabel} · ${order.assignee} · 计划 ${timeOnly(scheduledAt)}`, orderNo, '牧场管理员');
  persist(true);
  closeModal();
  refreshGlobal();
  if (ui.view !== 'work') openView('work');
  else renderView();
  showToast({ tone: 'success', icon: 'checkCircle', title: '工单已创建', message: `${orderNo} 已进入待执行队列，审计轨迹初始记录已生成。` });
}

function submitThresholdForm(form) {
  const fd = new FormData(form);
  const barn = barnById(state, form.dataset.barn);
  if (!barn) return;
  const next = {
    tempLow: Number(fd.get('tempLow')),
    tempHigh: Number(fd.get('tempHigh')),
    humidityLow: Number(fd.get('humidityLow')),
    humidityHigh: Number(fd.get('humidityHigh')),
    nh3High: Number(fd.get('nh3High')),
    lightLow: Number(fd.get('lightLow')),
    lightHigh: Number(fd.get('lightHigh')),
  };
  if (next.tempLow >= next.tempHigh || next.humidityLow >= next.humidityHigh) {
    showToast({ tone: 'danger', icon: 'warning', title: '阈值区间不合法', message: '温度与湿度的下限必须低于上限。' });
    return;
  }
  const before = { ...barn.thresholds };
  barn.thresholds = next;
  addAudit(state, '环境', '更新告警阈值', `温度 ${before.tempLow}–${before.tempHigh} → ${next.tempLow}–${next.tempHigh}；NH₃ ≤ ${next.nh3High} ppm`, `${barn.barnId} · ${barn.name}`, '牧场管理员');
  persist(true);
  closeModal();
  refreshGlobal({ view: true });
  showToast({ tone: 'success', icon: 'checkCircle', title: '阈值已更新', message: `${barn.barnId} 将在下一次采集时按新阈值判定。` });
}

/* ------------------------------------------------------------------ */
/* 工单详情与流转                                                       */
/* ------------------------------------------------------------------ */

function openOrderDetail(orderNo) {
  const order = state.workOrders.find((w) => w.orderNo === orderNo);
  if (!order) return;
  const type = WORK_TYPE[order.type] || WORK_TYPE.inspection;
  const status = WORK_STATUS[order.status] || WORK_STATUS.pending;
  const isMed = order.type === 'immunization' || order.type === 'medication';
  const metaChips = isMed && order.meta ? [
    order.meta.product && `<span class="med-chip">药品 <b>${esc(order.meta.product)}</b></span>`,
    order.meta.batchNo && `<span class="med-chip">批号 <b>${esc(order.meta.batchNo)}</b></span>`,
    order.meta.dose && `<span class="med-chip">剂量 <b>${esc(order.meta.dose)}</b></span>`,
    order.meta.route && `<span class="med-chip">途径 <b>${esc(order.meta.route)}</b></span>`,
    order.meta.withdrawalDays !== undefined && `<span class="med-chip">休药期 <b>${esc(order.meta.withdrawalDays)} 天</b></span>`,
    order.meta.observation && `<span class="med-chip">观察 <b>${esc(order.meta.observation)}</b></span>`,
  ].filter(Boolean).join('') : '';
  const actions = order.status === 'pending'
    ? `<button class="btn" type="button" data-close-modal>关闭</button><button class="btn btn-primary" type="button" data-action="start-order" data-order="${order.orderNo}">${icon('play', 12)} 开始执行</button>`
    : order.status === 'in_progress'
      ? `<button class="btn" type="button" data-close-modal>关闭</button><button class="btn btn-primary" type="button" data-action="complete-order" data-order="${order.orderNo}">${icon('check', 12)} 完成并签字</button>`
      : `<button class="btn" type="button" data-close-modal>关闭</button><span class="status-badge ok">已归档</span>`;
  openModal({
    title: order.title,
    kicker: `${order.orderNo} · ${type.label.toUpperCase()}`,
    subtitle: `${order.targetLabel} · ${status.label} · 执行人 ${order.assignee}`,
    size: 'wide',
    body: `<div class="order-detail-meta">
      <div class="detail-meta-item"><span>对象 / 区域</span><strong>${esc(order.targetLabel)}</strong></div>
      <div class="detail-meta-item"><span>计划时间</span><strong>${timeOnly(order.scheduledAt)}</strong></div>
      <div class="detail-meta-item"><span>执行人</span><strong>${esc(order.assignee)}</strong></div>
      <div class="detail-meta-item"><span>状态 / 优先级</span><strong>${status.label} · ${order.priority === 'urgent' ? '紧急' : order.priority === 'high' ? '优先' : '常规'}</strong></div>
    </div>
    ${isMed ? `<div class="med-meta" style="margin-bottom:14px">${metaChips || '<span class="med-chip">待补充用药信息</span>'}</div>` : ''}
    <div class="form-section-title">执行清单 <span style="color:var(--muted);font-weight:400">${order.status === 'done' ? '（已归档，不可修改）' : '（点击勾选，自动留痕）'}</span></div>
    <div class="order-steps">
      ${order.steps.map((step, index) => `<button class="step-row ${step.done ? 'done' : ''}" type="button" ${order.status === 'done' ? 'disabled' : `data-action="toggle-step" data-order="${order.orderNo}" data-index="${index}"`}><span class="step-check ${step.done ? 'done' : ''}">${step.done ? icon('check', 9) : ''}</span><span>${esc(step.label)}</span><em class="step-time">${step.done ? '已完成' : '待执行'}</em></button>`).join('')}
    </div>
    <div class="form-section-title">审计轨迹</div>
    <div class="trace-timeline">
      ${order.trace.map((t) => `<div class="trace-item"><span class="trace-dot"></span><div><strong>${esc(t.action)}<time>${timeOnly(t.at)}</time></strong><p>${esc(t.detail || '')}</p><em>${esc(t.actor || '系统')}</em></div></div>`).join('')}
    </div>
    ${order.description ? `<div class="form-note" style="margin-top:12px">${icon('info', 12)}<span>${esc(order.description)}</span></div>` : ''}
    <div class="form-footer"><span class="form-footer-note">${isMed ? '完成时需要确认批号与休药期。' : '完成操作会写入执行人与时间。'}</span><div class="form-footer-actions">${actions}</div></div>`,
  });
}

function startOrder(orderNo) {
  const order = state.workOrders.find((w) => w.orderNo === orderNo);
  if (!order || order.status !== 'pending') return;
  advanceWorkOrder(state, orderNo, 'start', '执行人已到达现场并开始作业', '牧场管理员');
  persist(true);
  renderView();
  openOrderDetail(orderNo);
  showToast({ tone: 'info', icon: 'playCircle', title: '工单已开始', message: `${orderNo} 已进入进行中状态，现场签到已留痕。` });
}

function toggleOrderStep(orderNo, index) {
  const order = state.workOrders.find((w) => w.orderNo === orderNo);
  if (!order) return;
  advanceWorkOrder(state, orderNo, 'step', String(index), '牧场管理员');
  persist(true);
  renderView();
  openOrderDetail(orderNo);
}

function openCompleteOrderModal(orderNo) {
  const order = state.workOrders.find((w) => w.orderNo === orderNo);
  if (!order) return;
  const isMed = order.type === 'immunization' || order.type === 'medication';
  const undone = order.steps.filter((step) => !step.done);
  openModal({
    title: '完成并签字归档',
    kicker: `${order.orderNo} · SIGN OFF`,
    subtitle: `${order.title} · ${order.targetLabel}`,
    size: 'narrow',
    body: `<form id="completeOrderForm" data-order="${order.orderNo}">
      ${isMed ? `<div class="med-meta" style="margin-bottom:12px"><span class="med-chip">药品 <b>${esc(order.meta?.product || '—')}</b></span><span class="med-chip">批号 <b>${esc(order.meta?.batchNo || '—')}</b></span><span class="med-chip">休药期 <b>${esc(order.meta?.withdrawalDays ?? 0)} 天</b></span></div>` : ''}
      ${undone.length ? `<div class="form-note warning" style="margin-bottom:12px">${icon('warning', 12)}<span>仍有 ${undone.length} 个执行步骤未勾选，需返回工单详情全部完成后才能签字归档：${undone.map((s) => esc(s.label)).join('、')}</span></div>` : ''}
      <div class="form-section"><div class="form-section-title">执行说明</div><div class="form-grid"><div class="form-field span-2"><label>完成说明 <b>*</b></label><textarea class="form-control" name="note" placeholder="记录现场结果、异常情况或后续安排…" required></textarea></div></div></div>
      ${isMed ? `<label class="checkbox-row" style="margin:9px 0"><input type="checkbox" name="safety" required /> 已核对批号 / 剂量 / 休药期，并完成过敏观察</label>` : ''}
      <label class="checkbox-row" style="margin:9px 0"><input type="checkbox" name="confirm" required /> 我确认以上执行信息真实，签名将写入审计轨迹</label>
      <div class="form-footer"><span class="form-footer-note">操作人：牧场管理员</span><div class="form-footer-actions"><button class="btn" type="button" data-close-modal>取消</button><button class="btn btn-primary" type="submit" ${undone.length ? 'disabled' : ''}>${icon('check', 12)} 提交归档</button></div></div>
    </form>`,
  });
}

function submitCompleteOrder(form) {
  const fd = new FormData(form);
  const note = String(fd.get('note') || '').trim();
  if (!note || !fd.get('confirm')) {
    showToast({ tone: 'danger', icon: 'warning', title: '请补充完成信息', message: '需要填写执行说明并确认签字。' });
    return;
  }
  if (form.querySelector('[name="safety"]') && !fd.get('safety')) {
    showToast({ tone: 'danger', icon: 'warning', title: '安全核对未完成', message: '免疫 / 用药归档前必须完成安全核对。' });
    return;
  }
  const orderNo = form.dataset.order;
  const order = state.workOrders.find((w) => w.orderNo === orderNo);
  if (order && order.steps.some((step) => !step.done)) {
    showToast({ tone: 'danger', icon: 'warning', title: '还有步骤未完成', message: '请先回到工单详情完成所有执行步骤，再签字归档。' });
    return;
  }
  advanceWorkOrder(state, orderNo, 'complete', note, '牧场管理员');
  persist(true);
  closeModal();
  refreshGlobal({ view: ui.view === 'work' });
  if (ui.view !== 'work') openView('work');
  else renderView();
  showToast({ tone: 'success', icon: 'checkCircle', title: '工单已签字归档', message: `${order?.title || orderNo} 已完成，签字与执行轨迹已写入审计记录。` });
}

/* ------------------------------------------------------------------ */
/* 报表导出 / 打印 / 模型导出                                            */
/* ------------------------------------------------------------------ */

function downloadBlob(content, filename, mime = 'text/plain;charset=utf-8') {
  const blob = new Blob([content], { type: mime });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  link.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1200);
}

function exportReportCSV() {
  const report = buildReport(state, ui.reportType, ui.reportDays);
  const csv = toCSV(report);
  const suffix = report.rawRows[report.rawRows.length - 1]?.date || report.rawRows[report.rawRows.length - 1]?.dateKey || todayKey();
  downloadBlob(csv, `云栖牧场_${report.title}_${suffix}.csv`, 'text/csv;charset=utf-8');
  showToast({ tone: 'success', icon: 'download', title: 'CSV 已导出', message: `${report.title} · ${ui.reportDays} 天数据已下载。` });
}

function printCurrentReport() {
  const report = buildReport(state, ui.reportType, ui.reportDays);
  const summaryRows = report.type === 'production'
    ? [['区间总产奶', `${formatNumber(report.summary.totalMilk, 1)} L`], ['日均产奶', `${formatNumber(report.summary.avgDay, 1)} L`], ['平均单产', `${report.summary.avgYield} L/头`], ['全群折算', `${report.summary.milkPerCow} L/头`]]
    : report.type === 'health'
      ? [['平均健康分', `${report.summary.avgScore} 分`], ['风险牛只', `${report.summary.abnormal} 头`], ['免疫完成', `${report.summary.immunization} 批`], ['用药记录', `${report.summary.medication} 例`]]
      : [['统计总能耗', `${formatNumber(report.summary.totalEnergy, 1)} kWh`], ['日均能耗', `${formatNumber(report.summary.avgDay, 1)} kWh`], ['单位奶耗', `${report.summary.intensity} Wh/L`], ['照明占比', `${report.summary.lightingShare}%`]];
  if (report.type === 'production') summaryRows[3][0] = '全群头均产奶';
  const printArea = $('#printArea');
  printArea.innerHTML = `<div class="print-doc">
    <div class="print-head">
      <div><div class="print-brand">云栖智慧牧场</div><div class="print-kicker">MISTY PASTURE · DIGITAL TWIN REPORT</div></div>
      <div class="print-head-right">生成时间：${localDateTime(new Date())}<br/>统计区间：${report.rawRows[0]?.date || report.rawRows[0]?.dateKey || ''} 至 ${report.rawRows[report.rawRows.length - 1]?.date || report.rawRows[report.rawRows.length - 1]?.dateKey || ''}<br/>数据来源：IoT 环境采集 / 挤奶台 / 人工巡检</div>
    </div>
    <h1 class="print-title">${report.title}</h1>
    <p class="print-subtitle">${report.subtitle} · ${ui.reportDays} 天</p>
    <div class="print-summary">${summaryRows.map(([label, value]) => `<div class="print-stat"><span>${label}</span><strong>${value}</strong></div>`).join('')}</div>
    <table class="print-table"><thead><tr>${report.headers.map((h) => `<th>${esc(h)}</th>`).join('')}</tr></thead><tbody>${report.rows.map((row) => `<tr>${row.map((cell) => `<td>${esc(cell)}</td>`).join('')}</tr>`).join('')}</tbody></table>
    <div class="print-foot"><span>云栖智慧牧场 · 环境与健康数字孪生</span><span>本报表由系统自动生成 · 仅供教学演示使用</span></div>
  </div>`;
  setTimeout(() => window.print(), 120);
  window.onafterprint = () => {
    printArea.innerHTML = '';
    window.onafterprint = null;
  };
}

function exportModels() {
  const counts = {
    barn: state.barns.length,
    device: state.devices.length,
    cow: state.cows.length,
    milk: state.milkRecords.length,
    health: state.healthRecords.length,
    breeding: state.breedingRecords.length,
    work: state.workOrders.length,
  };
  const payload = {
    product: '云栖智慧牧场 · Misty Pasture',
    schemaVersion: APP_VERSION,
    exportedAt: new Date().toISOString(),
    models: OBJECT_MODELS.map((model) => ({ ...model, instanceCount: counts[model.key] || 0 })),
    relationships: [
      'Barn 1 : N Device',
      'Barn 1 : N Cow',
      'Cow 1 : N MilkRecord',
      'Cow 1 : N HealthRecord',
      'Cow 1 : N BreedingRecord',
      'Cow N : N WorkOrder',
    ],
  };
  downloadBlob(JSON.stringify(payload, null, 2), `云栖牧场_对象模型_${todayKey()}.json`, 'application/json;charset=utf-8');
  showToast({ tone: 'success', icon: 'download', title: '对象模型已导出', message: '包含 7 个物模型、字段定义与实例数量。' });
}

function openModelDetail(key) {
  const model = OBJECT_MODELS.find((m) => m.key === key);
  if (!model) return;
  const counts = { barn: state.barns.length, device: state.devices.length, cow: state.cows.length, milk: state.milkRecords.length, health: state.healthRecords.length, breeding: state.breedingRecords.length, work: state.workOrders.length };
  openModal({
    title: model.name,
    kicker: `OBJECT MODEL · ${model.en.toUpperCase()}`,
    subtitle: model.description,
    size: 'wide',
    body: `<div class="order-detail-meta">
      <div class="detail-meta-item"><span>主键</span><strong>${model.primary}</strong></div>
      <div class="detail-meta-item"><span>实例数量</span><strong>${formatNumber(counts[model.key] || 0)}</strong></div>
      <div class="detail-meta-item"><span>关系</span><strong>${esc(model.relation)}</strong></div>
      <div class="detail-meta-item"><span>字段数量</span><strong>${model.fields.length}</strong></div>
    </div>
    <div class="table-wrap"><table class="data-table"><thead><tr><th>字段标识符</th><th>字段名称</th><th>数据类型</th><th>说明</th></tr></thead><tbody>${model.fields.map((f) => `<tr><td class="cell-muted">${esc(f.key)}${f.pk ? '<span class="pk-chip">PK</span>' : ''}</td><td>${esc(f.label)}</td><td>${esc(f.type)}</td><td>${esc(f.note)}</td></tr>`).join('')}</tbody></table></div>
    <div class="form-footer"><span class="form-footer-note">对象模型是页面、图表与三维场景共用的语义层。</span><div class="form-footer-actions"><button class="btn" type="button" data-close-modal>关闭</button></div></div>`,
  });
}

/* ------------------------------------------------------------------ */
/* 设备与演示动作                                                       */
/* ------------------------------------------------------------------ */

function toggleDevice(deviceId) {
  const device = state.devices.find((d) => d.deviceId === deviceId);
  if (!device) return;
  device.running = !device.running;
  device.mode = 'manual';
  device.lastAction = device.running ? '人工开启' : '人工关闭';
  device.lastActionAt = new Date().toISOString();
  addAudit(state, '设备', `${device.running ? '开启' : '关闭'} ${device.name}`, `${device.barnId} · 人工覆盖自动环控`, device.deviceId, '牧场管理员');
  persist(true);
  scene?.syncState(state);
  renderSidebar();
  if (ui.view === 'environment') renderView();
  if (ui.view === 'ops') renderView();
  showToast({ tone: device.running ? 'success' : 'info', icon: device.running ? 'activity' : 'pause', title: `${device.name}已${device.running ? '开启' : '关闭'}`, message: `${device.barnId} · 手动控制已覆盖自动策略，并写入设备审计。` });
}

// 兼容演示按钮在无活动告警时的反馈：创建一条新的环境越限记录
// 若已有相同指标的活动告警，则只给出提示，不重复生成。

/* ------------------------------------------------------------------ */
/* 启动应用                                                             */
/* ------------------------------------------------------------------ */

startApp();

