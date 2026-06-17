// ─── Brand Configuration — swap this file per client/deployment ──────────────
// To white-label: update the values below, swap logo, done. No code changes needed.

export interface ThemeTokens {
  primary: string
  primaryLight: string
  primaryMid: string
  sidebar: {
    bg: string
    border: string
    text: string
    textHover: string
    textActive: string
    hoverBg: string
    activeBg: string
    activeBorder: string
    section: string
    childText: string
    childHover: string
    childActive: string
  }
}

export interface ModuleConfig {
  employees: boolean
  attendance: boolean
  payroll: boolean
  leaves: boolean
  overtime: boolean
  schedules: boolean
  reports: boolean
  audit: boolean
  kiosk: boolean
  landing: boolean
}

export interface FeatureFlags {
  rfidKiosk: boolean
  pinKiosk: boolean
  darkMode: boolean
  multiCurrency: boolean
  advancedReports: boolean
  exportPDF: boolean
  exportExcel: boolean
}

export interface BrandConfig {
  // ── Identity ──────────────────────────────────────────────────────────────
  appName: string
  appTagline: string
  logoUrl: string
  faviconUrl: string
  version: string

  // ── Company defaults (overridden by DB settings) ──────────────────────────
  defaultCompanyName: string

  // ── Theme ─────────────────────────────────────────────────────────────────
  theme: ThemeTokens

  // ── Locale / Region ───────────────────────────────────────────────────────
  country: string
  currency: string
  currencySymbol: string
  dateFormat: string
  timezone: string
  locale: string

  // ── Modules ───────────────────────────────────────────────────────────────
  modules: ModuleConfig

  // ── Features ──────────────────────────────────────────────────────────────
  features: FeatureFlags

  // ── Support / Contact ────────────────────────────────────────────────────
  supportEmail: string
  documentationUrl: string
}

// ─── TenPayroll — Ten Foundation Philippines Inc. ─────────────────────────────
export const brand: BrandConfig = {
  appName:            'TenPayroll',
  appTagline:         'HR & Payroll System',
  logoUrl:            '/Logo.png',
  faviconUrl:         '/favicon.png',
  version:            '2.0.0',

  defaultCompanyName: 'Ten Foundation Philippines Inc.',

  theme: {
    primary:      '#5B5FC7',   // indigo
    primaryLight: '#EEEEFF',   // indigo-50
    primaryMid:   '#C5C7F4',   // indigo-200
    sidebar: {
      bg:           '#0D0E14',
      border:       'rgba(255,255,255,0.06)',
      text:         '#94A3B8',
      textHover:    '#CBD5E1',
      textActive:   '#E2E8F0',
      hoverBg:      'rgba(255,255,255,0.05)',
      activeBg:     'rgba(91,95,199,0.12)',
      activeBorder: '#5B5FC7',
      section:      'rgba(255,255,255,0.25)',
      childText:    '#64748B',
      childHover:   '#94A3B8',
      childActive:  '#A5A8F0',
    },
  },

  country:        'PH',
  currency:       'PHP',
  currencySymbol: '₱',
  dateFormat:     'MMM D, YYYY',
  timezone:       'Asia/Manila',
  locale:         'en-PH',

  modules: {
    employees:  true,
    attendance: true,
    payroll:    true,
    leaves:     true,
    overtime:   true,
    schedules:  true,
    reports:    true,
    audit:      true,
    kiosk:      true,
    landing:    true,
  },

  features: {
    rfidKiosk:       true,
    pinKiosk:        true,
    darkMode:        false,
    multiCurrency:   false,
    advancedReports: true,
    exportPDF:       true,
    exportExcel:     false,
  },

  supportEmail:      'support@tenfoundation.ph',
  documentationUrl:  'https://tenfoundation.ph',
}

export default brand
