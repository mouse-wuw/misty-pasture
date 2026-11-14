const P = {
  dashboard: '<rect x="3" y="3" width="7" height="8" rx="1.5"/><rect x="14" y="3" width="7" height="5" rx="1.5"/><rect x="3" y="15" width="7" height="6" rx="1.5"/><rect x="14" y="12" width="7" height="9" rx="1.5"/>',
  barn: '<path d="M3 20h18M5 20V9l7-5 7 5v11"/><path d="M9 20v-6h6v6M3.5 8.6 12 3l8.5 5.6"/>',
  cow: '<path d="M7 8C5 8 4 7 4 5c0 0 2-.2 3 1M17 8c2 0 3-1 3-3 0 0-2-.2-3 1"/><path d="M6 10a6 4.5 0 0 1 12 0v3a4 4 0 0 1-4 4h-4a4 4 0 0 1-4-4z"/><path d="M9 16v3M15 16v3"/><circle cx="9.3" cy="10.3" r=".75" fill="currentColor" stroke="none"/><circle cx="14.7" cy="10.3" r=".75" fill="currentColor" stroke="none"/><path d="M10.5 14h3"/>',
  temperature: '<path d="M14 14.76V5a2 2 0 0 0-4 0v9.76a4 4 0 1 0 4 0Z"/><path d="M12 9v6.2"/>',
  humidity: '<path d="M12 3s6 6.3 6 10.5a6 6 0 0 1-12 0C6 9.3 12 3 12 3Z"/><path d="M9.5 14.2a2.5 2.5 0 0 0 2.5 2.5"/>',
  wind: '<path d="M3 8h11.5a2.5 2.5 0 1 0-2.5-2.5M3 12h16a2.5 2.5 0 1 1-2.5 2.5M3 16h8"/>',
  light: '<circle cx="12" cy="12" r="4"/><path d="M12 2v2M12 20v2M4.93 4.93l1.42 1.42M17.66 17.66l1.41 1.41M2 12h2M20 12h2M4.93 19.07l1.42-1.42M17.66 6.34l1.41-1.41"/>',
  sun: '<circle cx="12" cy="12" r="4"/><path d="M12 2v2M12 20v2M4.93 4.93l1.42 1.42M17.66 17.66l1.41 1.41M2 12h2M20 12h2M4.93 19.07l1.42-1.42M17.66 6.34l1.41-1.41"/>',
  moon: '<path d="M20.5 14.2A8.5 8.5 0 1 1 9.8 3.5a7 7 0 0 0 10.7 10.7Z"/><path d="M17 4h.01M20 7h.01"/>',
  sunrise: '<path d="M17 18a5 5 0 0 0-10 0M12 2v6M4.2 10.2l1.4 1.4M2 18h2M20 18h2M18.4 11.6l1.4-1.4M23 22H1M8 6l4-4 4 4"/>',
  sunset: '<path d="M17 18a5 5 0 0 0-10 0M12 8V2M4.2 10.2l1.4 1.4M2 18h2M20 18h2M18.4 11.6l1.4-1.4M23 22H1M16 2l-4 4-4-4"/>',
  bell: '<path d="M18 8a6 6 0 0 0-12 0c0 7-3 7-3 9h18c0-2-3-2-3-9ZM10.3 21a2 2 0 0 0 3.4 0"/>',
  settings: '<circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09a1.65 1.65 0 0 0-1.08-1.51 1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09a1.65 1.65 0 0 0 1.51-1.08 1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1Z"/>',
  heart: '<path d="M20.8 4.6a5.5 5.5 0 0 0-7.8 0L12 5.7l-1.1-1.1a5.5 5.5 0 0 0-7.8 7.8l1.1 1.1L12 21l7.8-7.5 1.1-1.1a5.5 5.5 0 0 0-.1-7.8Z"/>',
  milk: '<path d="M8 3h8v3l-1.2 2.2V21H9.2V8.2L8 6V3Z"/><path d="M8 8.5h8M10 12h4M10 15.5h4"/>',
  clipboard: '<rect x="5" y="4" width="14" height="17" rx="2"/><path d="M9 4V2h6v2M9 10h6M9 14h6M9 18h4"/>',
  chart: '<path d="M3 3v18h18"/><path d="m7 15 4-4 3 3 5-6"/>',
  activity: '<path d="M3 12h4l2.5-7 4 14 2.5-7H21"/>',
  cloud: '<path d="M17.5 19H7a4.5 4.5 0 1 1 .5-8.97A6 6 0 0 1 19 12.5 3.5 3.5 0 0 1 17.5 19Z"/>',
  fog: '<path d="M4 8h12a3 3 0 1 0-2.5-4.5M4 12h16M4 16h12M4 20h7"/>',
  spark: '<path d="m12 3 1.6 5.4L19 10l-5.4 1.6L12 17l-1.6-5.4L5 10l5.4-1.6L12 3Z"/><path d="m19 16 .8 2.2L22 19l-2.2.8L19 22l-.8-2.2L16 19l2.2-.8L19 16Z"/>',
  download: '<path d="M12 3v12M7 10l5 5 5-5M4 21h16"/>',
  print: '<path d="M6 9V3h12v6M6 18H4a2 2 0 0 1-2-2v-5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2h-2"/><rect x="6" y="14" width="12" height="8" rx="1"/><path d="M18 12h.01"/>',
  plus: '<path d="M12 5v14M5 12h14"/>',
  check: '<path d="m4 12.5 5 5L20 6.5"/>',
  checkCircle: '<circle cx="12" cy="12" r="9"/><path d="m8 12 2.5 2.5L16 9"/>',
  clock: '<circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/>',
  user: '<circle cx="12" cy="8" r="4"/><path d="M4 21a8 8 0 0 1 16 0"/>',
  shield: '<path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10Z"/><path d="m8.5 11.5 2.5 2.5 4.5-4.5"/>',
  pill: '<path d="m10.5 20.5-7-7a4.95 4.95 0 0 1 7-7l7 7a4.95 4.95 0 0 1-7 7Z"/><path d="m8.5 8.5 7 7"/>',
  syringe: '<path d="m18 2 4 4M17 3l4 4M19 7l-7.5 7.5M5 19l3.5-3.5M7 15l2 2M9 17l2 2M10.5 20.5l-3-3M4 20l-2 2"/>',
  arrowRight: '<path d="M4 12h16M14 6l6 6-6 6"/>',
  chevronDown: '<path d="m6 9 6 6 6-6"/>',
  chevronRight: '<path d="m9 6 6 6-6 6"/>',
  play: '<path d="m8 5 11 7-11 7V5Z"/>',
  pause: '<path d="M8 5v14M16 5v14"/>',
  rotate: '<path d="M21 12a9 9 0 1 1-2.6-6.4M21 3v6h-6"/>',
  reset: '<path d="M3 12a9 9 0 1 0 2.6-6.4M3 3v6h6"/>',
  layers: '<path d="m12 2 9 5-9 5-9-5 9-5Z"/><path d="m3 12 9 5 9-5M3 17l9 5 9-5"/>',
  eye: '<path d="M2 12s4-7 10-7 10 7 10 7-4 7-10 7S2 12 2 12Z"/><circle cx="12" cy="12" r="3"/>',
  calendar: '<rect x="3" y="5" width="18" height="16" rx="2"/><path d="M16 3v4M8 3v4M3 10h18"/>',
  search: '<circle cx="11" cy="11" r="7"/><path d="m20 20-4-4"/>',
  filter: '<path d="M3 5h18M6 12h12M10 19h4"/>',
  location: '<path d="M20 10c0 6-8 12-8 12S4 16 4 10a8 8 0 1 1 16 0Z"/><circle cx="12" cy="10" r="2.5"/>',
  fan: '<circle cx="12" cy="12" r="9"/><circle cx="12" cy="12" r="2"/><path d="M12 10c0-4 3-6 5-5 2 1 2 4-1 6M14 12c4 0 6 3 5 5-1 2-4 2-6-1M12 14c0 4-3 6-5 5-2-1-2-4 1-6M10 12C6 12 4 9 5 7c1-2 4-2 6 1"/>',
  heater: '<path d="M5 3h14M5 21h14M8 3v3M16 3v3M9 9c0 2 3 2 3 4s-2 2-2 4M14 9c0 2 2 2 2 4s-2 3-2 4"/><rect x="7" y="7" width="10" height="11" rx="2"/>',
  bulb: '<path d="M9 18h6M10 22h4M8 14a6 6 0 1 1 8 0c-1 .8-1 1.6-1 2H9c0-.4 0-1.2-1-2Z"/>',
  sensor: '<rect x="6" y="8" width="12" height="12" rx="2"/><path d="M9 8V5a3 3 0 0 1 6 0v3M12 12v4M10 14h4"/>',
  mist: '<path d="M5 17c2-2 4-2 6 0s4 2 6 0M5 21c2-2 4-2 6 0s4 2 6 0M12 3v6M8 5l1 2M16 5l-1 2"/>',
  link: '<path d="M10 13a5 5 0 0 0 7.5.5l3-3a5 5 0 0 0-7-7l-1.5 1.5M14 11a5 5 0 0 0-7.5-.5l-3 3a5 5 0 0 0 7 7L12 19"/>',
  leaf: '<path d="M20 4C11 4 4 8 4 15a5 5 0 0 0 5 5c7 0 11-7 11-16Z"/><path d="M4 21c2-5 6-9 12-12"/>',
  home: '<path d="M3 11 12 3l9 8v10H3V11Z"/><path d="M9 21v-7h6v7"/>',
  report: '<path d="M6 2h9l5 5v15H6V2Z"/><path d="M14 2v6h6M9 13h6M9 17h6M9 9h2"/>',
  flask: '<path d="M9 3h6M10 3v5l-6 10a2 2 0 0 0 1.8 3h12.4A2 2 0 0 0 20 18L14 8V3"/><path d="M7 16h10"/>',
  cattle: '<path d="M4 8c0 2 2 2 3 2h10c1 0 3 0 3-2M7 8v4m10-4v4M5 19v-3a7 7 0 0 1 14 0v3M9 19v2M15 19v2"/><circle cx="9" cy="13" r=".8" fill="currentColor" stroke="none"/><circle cx="15" cy="13" r=".8" fill="currentColor" stroke="none"/>',
  scale: '<path d="M12 3v18M5 7h14M5 7 2 14h6L5 7ZM19 7l-3 7h6l-3-7ZM8 21h8"/>',
  warning: '<path d="M10.3 3.6 1.8 18a2 2 0 0 0 1.7 3h17a2 2 0 0 0 1.7-3L13.7 3.6a2 2 0 0 0-3.4 0Z"/><path d="M12 9v4M12 17h.01"/>',
  info: '<circle cx="12" cy="12" r="9"/><path d="M12 11v5M12 8h.01"/>',
  close: '<path d="m5 5 14 14M19 5 5 19"/>',
  menu: '<path d="M3 6h18M3 12h18M3 18h18"/>',
  more: '<circle cx="5" cy="12" r="1" fill="currentColor"/><circle cx="12" cy="12" r="1" fill="currentColor"/><circle cx="19" cy="12" r="1" fill="currentColor"/>',
  trash: '<path d="M3 6h18M8 6V4h8v2M19 6l-1 15H6L5 6M10 10v7M14 10v7"/>',
  globe: '<circle cx="12" cy="12" r="9"/><path d="M3 12h18M12 3a15 15 0 0 1 0 18 15 15 0 0 1 0-18Z"/>',
  mountain: '<path d="m2 21 7-12 4 7 2-3 7 8H2Z"/><path d="m7 11 2 2 2-2"/>',
  playCircle: '<circle cx="12" cy="12" r="9"/><path d="m10 8 6 4-6 4V8Z"/>',
  windmill: '<path d="M12 22V9M12 9 6 4m6 5 6-5M9 22h6M8 9a4 4 0 0 1 8 0"/>',
  drop: '<path d="M12 2.7S5.5 9.3 5.5 14a6.5 6.5 0 0 0 13 0C18.5 9.3 12 2.7 12 2.7Z"/>',
  energy: '<path d="M13 2 4 14h7l-1 8 9-12h-7l1-8Z"/>',
  sparkle: '<path d="M12 2v5M12 17v5M2 12h5M17 12h5M5 5l3 3M16 16l3 3M19 5l-3 3M8 16l-3 3"/>',
  scan: '<path d="M3 7V4h3M17 4h3v3M21 17v3h-3M7 20H4v-3M7 9h10M7 12h10M7 15h6"/>',
  chartBar: '<path d="M3 3v18h18M7 16v-5M12 16V7M17 16v-8"/>',
  route: '<circle cx="5" cy="18" r="2"/><circle cx="19" cy="6" r="2"/><path d="M7 18h6a4 4 0 0 0 4-4V8"/>',
  thermometer: '<path d="M14 14.76V5a2 2 0 0 0-4 0v9.76a4 4 0 1 0 4 0Z"/>',
  menuAlt: '<path d="M4 6h16M4 12h10M4 18h16"/>',
  spinner: '<path d="M21 12a9 9 0 1 1-3-6.7"/>',
  arrowUp: '<path d="M12 19V5M6 11l6-6 6 6"/>',
  arrowDown: '<path d="M12 5v14M6 13l6 6 6-6"/>',
  circle: '<circle cx="12" cy="12" r="8"/>',
};

export function icon(name, size = 18, className = '') {
  const path = P[name] || P.circle;
  return `<svg class="icon ${className}" width="${size}" height="${size}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${path}</svg>`;
}

export function logoMark(size = 40) {
  return `<svg class="logo-mark" width="${size}" height="${size}" viewBox="0 0 48 48" fill="none" aria-hidden="true">
    <defs>
      <linearGradient id="logo-grad" x1="8" y1="6" x2="40" y2="42" gradientUnits="userSpaceOnUse">
        <stop stop-color="#c9efd9"/><stop offset=".5" stop-color="#85d8bb"/><stop offset="1" stop-color="#e6c489"/>
      </linearGradient>
    </defs>
    <path d="M24 4.5c8.8 0 16 6.6 16 15.1 0 9.6-8.5 17.9-16 23.4-7.5-5.5-16-13.8-16-23.4 0-8.5 7.2-15.1 16-15.1Z" stroke="url(#logo-grad)" stroke-width="1.4"/>
    <path d="M13.5 26.5c3.3 0 6.5-1.5 8.2-4.3.8-1.3 1.1-2.6 1-3.8" stroke="url(#logo-grad)" stroke-width="1.3" stroke-linecap="round"/>
    <path d="M24 35c-2-3.3-2.8-7.3-1.4-10.9 1.1-2.8 3.4-4.4 6.1-5.2 1.2 4.5.4 10.1-4.7 16.1Z" stroke="url(#logo-grad)" stroke-width="1.4" stroke-linejoin="round"/>
    <path d="M23.8 34.9c1.4-3 1.6-6.6.5-9.8" stroke="url(#logo-grad)" stroke-width="1.1" stroke-linecap="round"/>
    <circle cx="24" cy="17.3" r="1.6" fill="#dff4e5"/>
    <path d="M18.5 38.6c3.4 1.3 7.2 1.2 10.6-.1" stroke="url(#logo-grad)" stroke-width=".8" opacity=".55" stroke-linecap="round"/>
  </svg>`;
}
