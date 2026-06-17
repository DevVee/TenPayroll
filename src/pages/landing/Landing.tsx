import { useNavigate } from 'react-router-dom'
import { ArrowRight, CheckCircle, Clock, FileText, Users, CreditCard, Shield } from 'lucide-react'
import { useAuthStore } from '../../store/authStore'
import { useEffect, useRef } from 'react'
import brand from '../../config/brand'

/* ─── Scroll marquee ────────────────────────────────────────── */
const FEATURES = [
  'SSS 2024 Tables', 'PhilHealth 5%', 'Pag-IBIG / HDMF', 'BIR TRAIN Law',
  'RFID Card Attendance', 'Overtime Pay', 'Night Differential', '13th Month Pay',
  'Leave Management', 'Payslip Generation', 'Government Remittances', 'Audit Logs',
]
function Marquee() {
  const items = [...FEATURES, ...FEATURES]
  return (
    <div style={{ overflow: 'hidden', borderTop: '1px solid #E2E8F0', borderBottom: '1px solid #E2E8F0', background: '#F8FAFC', padding: '13px 0' }}>
      <div style={{ display: 'flex', animation: 'marquee 30s linear infinite', width: 'max-content' }}>
        {items.map((item, i) => (
          <span key={i} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '0 28px', whiteSpace: 'nowrap' }}>
            <span style={{ width: 4, height: 4, borderRadius: '50%', background: i % 3 === 0 ? '#1C3172' : i % 3 === 1 ? '#2563EB' : '#06B6D4', display: 'inline-block', flexShrink: 0 }} />
            <span style={{ fontSize: 12.5, fontWeight: 500, color: '#374151' }}>{item}</span>
          </span>
        ))}
      </div>
    </div>
  )
}

/* ─── Count-up number ───────────────────────────────────────── */
function CountUp({ target, suffix = '' }: { target: number; suffix?: string }) {
  const ref = useRef<HTMLSpanElement>(null)
  useEffect(() => {
    let v = 0
    const step = Math.ceil(target / 40)
    const t = setInterval(() => {
      v = Math.min(v + step, target)
      if (ref.current) ref.current.textContent = v.toLocaleString() + suffix
      if (v >= target) clearInterval(t)
    }, 30)
    return () => clearInterval(t)
  }, [target, suffix])
  return <span ref={ref}>0{suffix}</span>
}

/* ─── Hero dashboard mockup (JSX, not SVG) ──────────────────── */
function HeroMockup() {
  const statCards = [
    { label: 'Total Employees', value: '156',    sub: '+12 this month',   color: '#1C3172', bg: '#EFF6FF', border: '#BFDBFE' },
    { label: 'Monthly Payroll',  value: '₱1.24M', sub: 'May 2026 run',     color: '#059669', bg: '#ECFDF5', border: '#A7F3D0' },
    { label: 'Present Today',    value: '148',    sub: '94.9% attendance', color: '#D97706', bg: '#FFFBEB', border: '#FDE68A' },
    { label: 'Leave Requests',   value: '7',      sub: '3 pending',        color: '#7C3AED', bg: '#F5F3FF', border: '#DDD6FE' },
  ]
  const bars = [
    { label: 'Jan', pct: 72,  active: false },
    { label: 'Feb', pct: 81,  active: false },
    { label: 'Mar', pct: 76,  active: false },
    { label: 'Apr', pct: 88,  active: false },
    { label: 'May', pct: 100, active: true  },
    { label: 'Jun', pct: 38,  active: false, dim: true },
  ]
  const slips = [
    { name: 'M. Cruz Santos',  dept: 'HR',      net: '₱19,986', paid: true  },
    { name: 'J. Reyes Cruz',   dept: 'IT',      net: '₱22,450', paid: true  },
    { name: 'A. Liza Santos',  dept: 'Finance', net: '₱18,200', paid: false },
  ]

  return (
    <div style={{ userSelect: 'none', pointerEvents: 'none' }}>

      {/* Browser chrome */}
      <div style={{
        borderRadius: '12px 12px 0 0',
        border: '1px solid #E2E8F0', borderBottom: 'none',
        overflow: 'hidden',
        boxShadow: '0 8px 48px rgba(28,49,114,0.13)',
      }}>
        {/* Title bar */}
        <div style={{ height: 38, background: '#F1F5F9', borderBottom: '1px solid #E2E8F0', display: 'flex', alignItems: 'center', padding: '0 12px', gap: 8 }}>
          <div style={{ display: 'flex', gap: 5 }}>
            {['#EF4444','#F59E0B','#22C55E'].map(c => (
              <div key={c} style={{ width: 9, height: 9, borderRadius: '50%', background: c }} />
            ))}
          </div>
          <div style={{ flex: 1, maxWidth: 260, margin: '0 auto', height: 20, background: '#E2E8F0', borderRadius: 4, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <span style={{ fontSize: 9.5, color: '#94A3B8', fontWeight: 500 }}>app.tenpayroll.ph/dashboard</span>
          </div>
        </div>

        {/* App layout */}
        <div style={{ display: 'flex', background: '#F8FAFC', minHeight: 340 }}>

          {/* Sidebar */}
          <div style={{ width: 168, background: '#0D1225', flexShrink: 0, padding: '12px 0' }}>
            {/* Logo in sidebar */}
            <div style={{ display: 'flex', alignItems: 'center', gap: 7, padding: '4px 14px 12px' }}>
              <img src={brand.logoUrl} alt={brand.appName} style={{ height: 22, width: 'auto' }} />
              <span style={{ fontSize: 11, fontWeight: 800, color: 'white', letterSpacing: '-0.03em' }}>{brand.appName}</span>
            </div>
            {[
              { label: 'Dashboard',  active: true  },
              { label: 'Employees',  active: false },
              { label: 'Attendance', active: false },
              { label: 'Payroll',    active: false },
              { label: 'Leaves',     active: false },
              { label: 'Reports',    active: false },
            ].map(n => (
              <div key={n.label} style={{
                padding: '7px 14px', fontSize: 10.5, fontWeight: n.active ? 600 : 400,
                color: n.active ? '#E2E8F0' : '#475569',
                background: n.active ? 'rgba(37,99,235,0.15)' : 'transparent',
                borderLeft: n.active ? '2px solid #2563EB' : '2px solid transparent',
                cursor: 'default',
              }}>
                {n.label}
              </div>
            ))}
          </div>

          {/* Main area */}
          <div style={{ flex: 1, padding: 14, overflow: 'hidden' }}>

            {/* Top bar */}
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
              <div>
                <div style={{ fontSize: 12, fontWeight: 700, color: '#0D1B2A' }}>Good morning, Sarah 👋</div>
                <div style={{ fontSize: 9.5, color: '#94A3B8', marginTop: 1 }}>June 3, 2026  ·  Tuesday</div>
              </div>
              <div style={{ width: 28, height: 28, borderRadius: '50%', background: '#1C3172', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 11, fontWeight: 700, color: 'white' }}>S</div>
            </div>

            {/* Stat cards */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 8, marginBottom: 10 }}>
              {statCards.map(s => (
                <div key={s.label} style={{ background: 'white', borderRadius: 7, padding: '10px 11px', border: `1px solid ${s.border}` }}>
                  <div style={{ fontSize: 18, fontWeight: 900, color: s.color, letterSpacing: '-0.04em', lineHeight: 1 }}>{s.value}</div>
                  <div style={{ fontSize: 9, fontWeight: 600, color: '#374151', marginTop: 3, marginBottom: 2 }}>{s.label}</div>
                  <div style={{ fontSize: 8.5, color: '#9CA3AF' }}>{s.sub}</div>
                </div>
              ))}
            </div>

            {/* Charts row */}
            <div style={{ display: 'grid', gridTemplateColumns: '3fr 2fr', gap: 8 }}>

              {/* Bar chart */}
              <div style={{ background: 'white', borderRadius: 7, padding: '10px 12px', border: '1px solid #E2E8F0' }}>
                <div style={{ fontSize: 10, fontWeight: 700, color: '#0D1B2A', marginBottom: 10 }}>Payroll Runs 2026</div>
                <div style={{ display: 'flex', alignItems: 'flex-end', gap: 5, height: 56 }}>
                  {bars.map(b => (
                    <div key={b.label} style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4 }}>
                      <div style={{
                        width: '100%', height: `${b.pct}%`,
                        background: b.active ? '#1C3172' : b.dim ? '#DBEAFE' : '#BFDBFE',
                        borderRadius: '3px 3px 0 0',
                        opacity: b.dim ? 0.6 : 1,
                      }} />
                      <span style={{ fontSize: 7.5, color: '#9CA3AF' }}>{b.label}</span>
                    </div>
                  ))}
                </div>
              </div>

              {/* Recent payslips */}
              <div style={{ background: 'white', borderRadius: 7, padding: '10px 12px', border: '1px solid #E2E8F0' }}>
                <div style={{ fontSize: 10, fontWeight: 700, color: '#0D1B2A', marginBottom: 8 }}>Recent Payslips</div>
                {slips.map((p, i) => (
                  <div key={p.name} style={{
                    display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                    paddingBottom: i < slips.length - 1 ? 7 : 0,
                    marginBottom: i < slips.length - 1 ? 7 : 0,
                    borderBottom: i < slips.length - 1 ? '1px solid #F1F5F9' : 'none',
                  }}>
                    <div>
                      <div style={{ fontSize: 9.5, fontWeight: 600, color: '#0D1B2A' }}>{p.name}</div>
                      <div style={{ fontSize: 8.5, color: '#94A3B8' }}>{p.dept} · {p.net}</div>
                    </div>
                    <span style={{
                      fontSize: 8, fontWeight: 700, padding: '2px 7px', borderRadius: 999,
                      color: p.paid ? '#059669' : '#D97706',
                      background: p.paid ? '#ECFDF5' : '#FFFBEB',
                    }}>
                      {p.paid ? 'Paid' : 'Pending'}
                    </span>
                  </div>
                ))}
              </div>

            </div>
          </div>
        </div>
      </div>

      {/* Compliance badges */}
      <div style={{ display: 'flex', gap: 6, marginTop: 10, flexWrap: 'wrap' }}>
        {[
          { label: 'SSS 2024',      color: '#1C3172', bg: '#EFF6FF' },
          { label: 'PhilHealth 5%', color: '#059669', bg: '#ECFDF5' },
          { label: 'Pag-IBIG 2%',  color: '#D97706', bg: '#FFFBEB' },
          { label: 'BIR TRAIN',    color: '#7C3AED', bg: '#F5F3FF' },
          { label: 'Night Diff',   color: '#0891B2', bg: '#ECFEFF' },
          { label: '13th Month',   color: '#DB2777', bg: '#FDF2F8' },
        ].map(b => (
          <span key={b.label} style={{
            fontSize: 11, fontWeight: 600, color: b.color, background: b.bg,
            padding: '4px 11px', borderRadius: 999, border: `1px solid ${b.color}25`,
          }}>
            {b.label}
          </span>
        ))}
      </div>
    </div>
  )
}

/* ─── Main page ─────────────────────────────────────────────── */
export function Landing() {
  const navigate = useNavigate()
  const user = useAuthStore(s => s.user)

  return (
    <div style={{ fontFamily: '"Plus Jakarta Sans", Inter, sans-serif', color: '#0D1B2A', background: '#fff', overflowX: 'hidden' }}>

      <style>{`
        @keyframes marquee { from { transform: translateX(0) } to { transform: translateX(-50%) } }
        .lp-btn { transition: opacity 0.15s, transform 0.12s, box-shadow 0.15s; border: none; cursor: pointer; font-family: inherit; }
        .lp-btn:hover { opacity: 0.88; transform: translateY(-1px); }
        .lp-card { transition: transform 0.18s, box-shadow 0.18s; }
        .lp-card:hover { transform: translateY(-3px); box-shadow: 0 12px 40px rgba(13,27,42,0.10) !important; }
      `}</style>

      {/* ── Nav ─────────────────────────────────────────────────── */}
      <nav style={{
        position: 'sticky', top: 0, zIndex: 100,
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        padding: '0 clamp(20px, 5vw, 72px)', height: 62,
        background: 'rgba(255,255,255,0.95)',
        backdropFilter: 'blur(16px)',
        borderBottom: '1px solid #EEF1F6',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 9, cursor: 'pointer' }} onClick={() => navigate('/')}>
          <img src={brand.logoUrl} alt={brand.appName} style={{ height: 34, width: 'auto' }} />
          <span style={{ fontWeight: 800, fontSize: 16, letterSpacing: '-0.03em', color: '#0D1B2A' }}>{brand.appName}</span>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          {user ? (
            <button className="lp-btn" onClick={() => navigate('/dashboard')} style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '8px 18px', borderRadius: 8, background: '#1C3172', color: '#fff', fontWeight: 600, fontSize: 13 }}>
              Dashboard <ArrowRight size={13} />
            </button>
          ) : (
            <>
              <button className="lp-btn" onClick={() => navigate('/kiosk')} style={{ padding: '7px 15px', borderRadius: 7, background: 'transparent', color: '#6B7280', fontWeight: 500, fontSize: 13 }}>Kiosk</button>
              <button className="lp-btn" onClick={() => navigate('/login')} style={{ padding: '8px 18px', borderRadius: 8, background: '#1C3172', color: '#fff', fontWeight: 600, fontSize: 13 }}>Sign in</button>
            </>
          )}
        </div>
      </nav>

      {/* ── Hero ────────────────────────────────────────────────── */}
      <section style={{ padding: 'clamp(56px,8vw,100px) clamp(20px,5vw,72px) 0', maxWidth: 1200, margin: '0 auto' }}>

        {/* Badge */}
        <div style={{ display: 'inline-flex', alignItems: 'center', gap: 7, padding: '4px 13px 4px 7px', background: '#EFF6FF', border: '1px solid #BFDBFE', borderRadius: 999, marginBottom: 24 }}>
          <span style={{ background: '#1C3172', borderRadius: 999, padding: '2px 8px', fontSize: 10, fontWeight: 700, color: '#fff', letterSpacing: '0.05em' }}>NEW</span>
          <span style={{ fontSize: 12, fontWeight: 500, color: '#1C3172' }}>RFID card attendance · now live</span>
        </div>

        {/* Headline */}
        <h1 style={{
          fontSize: 'clamp(38px, 6vw, 78px)',
          fontWeight: 900, lineHeight: 1.03,
          letterSpacing: '-0.05em', color: '#0D1B2A',
          maxWidth: 780, marginBottom: 0,
        }}>
          HR &amp; Payroll<br />
          <span style={{ color: '#1C3172' }}>built right</span>{' '}
          <span style={{ color: '#9CA3AF', fontWeight: 300, fontStyle: 'italic' }}>for the</span><br />
          Philippines.
        </h1>

        {/* Sub + CTAs */}
        <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'flex-end', gap: 'clamp(20px,4vw,52px)', marginTop: 24, marginBottom: 52 }}>
          <p style={{ fontSize: 'clamp(14px,1.6vw,17px)', color: '#6B7280', lineHeight: 1.75, maxWidth: 460, flex: '1 1 280px', margin: 0 }}>
            Automates SSS, PhilHealth, Pag-IBIG, and BIR TRAIN Law. RFID attendance. Payslips. Leave management. One platform — no spreadsheets.
          </p>
          <div style={{ display: 'flex', gap: 9, flexWrap: 'wrap', flexShrink: 0 }}>
            <button className="lp-btn" onClick={() => navigate(user ? '/dashboard' : '/login')} style={{
              display: 'flex', alignItems: 'center', gap: 7, padding: '12px 24px',
              borderRadius: 9, background: '#1C3172', color: '#fff', fontWeight: 700, fontSize: 14,
            }}>
              {user ? 'Go to Dashboard' : 'Sign in'} <ArrowRight size={14} />
            </button>
            <button className="lp-btn" onClick={() => navigate('/kiosk')} style={{
              padding: '12px 22px', borderRadius: 9, background: '#F1F5F9',
              color: '#374151', fontWeight: 600, fontSize: 14,
            }}>
              View Kiosk
            </button>
          </div>
        </div>

        {/* Dashboard mockup */}
        <HeroMockup />
      </section>

      {/* ── Marquee ─────────────────────────────────────────────── */}
      <div style={{ marginTop: 40 }}>
        <Marquee />
      </div>

      {/* ── Stats ───────────────────────────────────────────────── */}
      <section style={{ padding: 'clamp(52px,6vw,76px) clamp(20px,5vw,72px)', maxWidth: 1200, margin: '0 auto' }}>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(170px, 1fr))', gap: 1, background: '#E2E8F0', border: '1px solid #E2E8F0', borderRadius: 12, overflow: 'hidden' }}>
          {[
            { n: 100, suffix: '%',            label: 'Philippine compliant' },
            { n: 4,   suffix: ' gov\'t rules', label: 'auto-computed'        },
            { n: 5,   suffix: ' roles',        label: 'access control'       },
            { n: 0,   suffix: ' spreadsheets', label: 'needed'               },
          ].map((s, i) => (
            <div key={i} style={{ background: '#fff', padding: 'clamp(22px,3vw,34px) clamp(18px,3vw,30px)' }}>
              <div style={{ fontSize: 'clamp(26px,3.2vw,40px)', fontWeight: 900, letterSpacing: '-0.05em', color: '#1C3172', lineHeight: 1 }}>
                <CountUp target={s.n} suffix={s.suffix} />
              </div>
              <div style={{ fontSize: 12.5, color: '#6B7280', marginTop: 6, fontWeight: 500 }}>{s.label}</div>
            </div>
          ))}
        </div>
      </section>

      {/* ── Features ────────────────────────────────────────────── */}
      <section style={{ padding: '0 clamp(20px,5vw,72px) clamp(60px,7vw,90px)', maxWidth: 1200, margin: '0 auto' }}>

        <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 32 }}>
          <div style={{ height: 1, flex: 1, background: '#E2E8F0' }} />
          <span style={{ fontSize: 11, fontWeight: 700, color: '#94A3B8', textTransform: 'uppercase', letterSpacing: '0.14em', whiteSpace: 'nowrap' }}>What you get</span>
          <div style={{ height: 1, flex: 1, background: '#E2E8F0' }} />
        </div>

        {/* Top row: big card + 2 stacked */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: 14 }}>

          <div className="lp-card" style={{
            gridRow: 'span 2', background: '#0D1225', borderRadius: 14,
            padding: 'clamp(26px,4vw,40px)', display: 'flex', flexDirection: 'column',
            border: '1px solid #1E3A5F', minHeight: 340,
          }}>
            <div style={{ width: 44, height: 44, borderRadius: 11, background: 'rgba(37,99,235,0.12)', border: '1px solid rgba(37,99,235,0.2)', display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: 18 }}>
              <CreditCard size={20} color="#60A5FA" />
            </div>
            <h3 style={{ fontSize: 'clamp(18px,2.2vw,24px)', fontWeight: 800, letterSpacing: '-0.03em', color: '#F8FAFC', lineHeight: 1.25, marginBottom: 10 }}>
              RFID Card Attendance
            </h3>
            <p style={{ fontSize: 14, color: '#475569', lineHeight: 1.7, flex: 1 }}>
              Employees tap their ID card. TenPayroll records the time, checks against their shift, and computes grace period and late minutes automatically. No PIN to remember, no buddy punching.
            </p>
            <div style={{ marginTop: 24, paddingTop: 20, borderTop: '1px solid rgba(255,255,255,0.06)', display: 'flex', gap: 7, flexWrap: 'wrap' }}>
              {['Grace period', 'Late detection', 'OT tracking', 'Night diff'].map(t => (
                <span key={t} style={{ fontSize: 11, fontWeight: 600, color: '#60A5FA', padding: '3px 9px', background: 'rgba(37,99,235,0.08)', border: '1px solid rgba(37,99,235,0.18)', borderRadius: 999 }}>{t}</span>
              ))}
            </div>
          </div>

          <div className="lp-card" style={{ background: '#EFF6FF', borderRadius: 14, padding: 'clamp(22px,3vw,32px)', border: '1px solid #BFDBFE', display: 'flex', flexDirection: 'column', gap: 10 }}>
            <div style={{ width: 42, height: 42, borderRadius: 10, background: '#DBEAFE', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <FileText size={19} color="#1C3172" />
            </div>
            <div>
              <h3 style={{ fontSize: 17, fontWeight: 800, letterSpacing: '-0.025em', color: '#0D1B2A', marginBottom: 6 }}>Philippine Payroll</h3>
              <p style={{ fontSize: 13, color: '#475569', lineHeight: 1.65 }}>SSS 2024, PhilHealth 5%, Pag-IBIG 2%, BIR TRAIN Law — all computed per run. Payslips in one click.</p>
            </div>
            <div style={{ display: 'flex', gap: 5, flexWrap: 'wrap', marginTop: 'auto' }}>
              {['SSS 2024', 'PhilHealth', 'Pag-IBIG', 'BIR TRAIN'].map(t => (
                <span key={t} style={{ fontSize: 10.5, fontWeight: 600, color: '#1C3172', padding: '3px 8px', background: 'white', border: '1px solid #BFDBFE', borderRadius: 999 }}>{t}</span>
              ))}
            </div>
          </div>

          <div className="lp-card" style={{ background: '#F0FDF4', borderRadius: 14, padding: 'clamp(22px,3vw,32px)', border: '1px solid #BBF7D0', display: 'flex', flexDirection: 'column', gap: 10 }}>
            <div style={{ width: 42, height: 42, borderRadius: 10, background: '#DCFCE7', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <Users size={19} color="#059669" />
            </div>
            <div>
              <h3 style={{ fontSize: 17, fontWeight: 800, letterSpacing: '-0.025em', color: '#0D1B2A', marginBottom: 6 }}>HR & Leave Management</h3>
              <p style={{ fontSize: 13, color: '#475569', lineHeight: 1.65 }}>Employee profiles, leave balances, overtime requests, and department approvals in one clean interface.</p>
            </div>
            <div style={{ display: 'flex', gap: 5, flexWrap: 'wrap', marginTop: 'auto' }}>
              {['Vacation', 'Sick Leave', 'Emergency', 'Overtime'].map(t => (
                <span key={t} style={{ fontSize: 10.5, fontWeight: 600, color: '#059669', padding: '3px 8px', background: 'white', border: '1px solid #A7F3D0', borderRadius: 999 }}>{t}</span>
              ))}
            </div>
          </div>
        </div>

        {/* Bottom row: 3 cards */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 14, marginTop: 14 }}>
          {[
            { Icon: Clock,       color: '#7C3AED', bg: '#F5F3FF', border: '#DDD6FE', title: 'Shift Management',    desc: 'Define shifts, grace minutes, rest days, and overtime thresholds per team.' },
            { Icon: Shield,      color: '#D97706', bg: '#FFFBEB', border: '#FDE68A', title: 'Audit Logs',          desc: 'Every action logged — who did what, when, and what changed. Full traceability.' },
            { Icon: FileText,    color: '#0891B2', bg: '#ECFEFF', border: '#A5F3FC', title: 'Reports & Analytics', desc: 'Payroll summaries, headcount, attendance rates, and contribution reports.' },
          ].map(({ Icon, ...c }) => (
            <div key={c.title} className="lp-card" style={{ background: c.bg, borderRadius: 14, padding: 'clamp(18px,2.5vw,26px)', border: `1px solid ${c.border}`, display: 'flex', gap: 12 }}>
              <div style={{ width: 38, height: 38, borderRadius: 9, background: `${c.color}18`, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, marginTop: 1 }}>
                <Icon size={17} color={c.color} />
              </div>
              <div>
                <h4 style={{ fontSize: 13.5, fontWeight: 700, color: '#0D1B2A', marginBottom: 5 }}>{c.title}</h4>
                <p style={{ fontSize: 12.5, color: '#6B7280', lineHeight: 1.6 }}>{c.desc}</p>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* ── Payslip preview ─────────────────────────────────────── */}
      <section style={{ background: '#0D1225', padding: 'clamp(52px,7vw,84px) clamp(20px,5vw,72px)' }}>
        <div style={{ maxWidth: 1200, margin: '0 auto', display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 'clamp(36px,5vw,72px)', alignItems: 'center' }}>

          <div>
            <p style={{ fontSize: 11, fontWeight: 700, color: '#60A5FA', textTransform: 'uppercase', letterSpacing: '0.14em', marginBottom: 12 }}>Payslip</p>
            <h2 style={{ fontSize: 'clamp(24px,3.2vw,42px)', fontWeight: 900, letterSpacing: '-0.04em', color: '#F8FAFC', lineHeight: 1.12, marginBottom: 14 }}>
              Payslips that look<br />like they mean it.
            </h2>
            <p style={{ fontSize: 15, color: '#475569', lineHeight: 1.75, marginBottom: 24 }}>
              Every pay run generates a clean, print-ready payslip with earnings, all government deductions, attendance summary, and BIR-compliant withholding.
            </p>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 9 }}>
              {[
                'Gross pay breakdown with allowances',
                'SSS, PhilHealth, Pag-IBIG employee & employer shares',
                'BIR withholding tax (TRAIN Law)',
                'Attendance summary — scheduled vs present days',
                'Net pay clearly displayed — no ambiguity',
              ].map(item => (
                <div key={item} style={{ display: 'flex', gap: 9, alignItems: 'flex-start' }}>
                  <CheckCircle size={14} color="#22C55E" style={{ flexShrink: 0, marginTop: 2 }} />
                  <span style={{ fontSize: 13, color: '#94A3B8' }}>{item}</span>
                </div>
              ))}
            </div>
          </div>

          {/* Payslip card */}
          <div style={{ background: '#fff', borderRadius: 12, boxShadow: '0 28px 72px rgba(0,0,0,0.45)', overflow: 'hidden', border: '1px solid #E2E8F0' }}>
            <div style={{ padding: '14px 18px', display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', borderBottom: '3px solid #1C3172' }}>
              <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
                <img src={brand.logoUrl} alt={brand.appName} style={{ height: 34, width: 'auto' }} />
                <div>
                  <p style={{ fontSize: 12.5, fontWeight: 700, color: '#0D1B2A' }}>Ten Foundation Philippines Inc.</p>
                  <p style={{ fontSize: 10, color: '#6B7280' }}>Makati City, Metro Manila</p>
                </div>
              </div>
              <div style={{ textAlign: 'right' }}>
                <div style={{ background: '#1C3172', color: '#fff', fontSize: 9, fontWeight: 700, padding: '2px 7px', borderRadius: 3, letterSpacing: '0.05em', marginBottom: 5 }}>PAYSLIP</div>
                <p style={{ fontSize: 10, fontWeight: 700, color: '#374151' }}>PAY-0102</p>
                <p style={{ fontSize: 9.5, color: '#9CA3AF' }}>May 11 – May 26, 2026</p>
              </div>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '7px 18px', padding: '10px 18px', background: '#F8FAFC', borderBottom: '1px solid #E2E8F0' }}>
              {[
                ['Employee', 'Maria Cruz Santos'], ['Employment', 'Regular'],
                ['Emp. No.', 'EMP-0001'],          ['Frequency', 'Bi-monthly'],
                ['Dept.',    'Human Resources'],   ['Tax Status', 'ME'],
              ].map(([l, v]) => (
                <div key={l} style={{ display: 'flex', gap: 4 }}>
                  <span style={{ fontSize: 9.5, color: '#9CA3AF', minWidth: 72, flexShrink: 0 }}>{l}:</span>
                  <span style={{ fontSize: 9.5, fontWeight: 600, color: '#0D1B2A' }}>{v}</span>
                </div>
              ))}
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', borderBottom: '1px solid #E2E8F0' }}>
              <div style={{ padding: '10px 18px', borderRight: '1px solid #E2E8F0' }}>
                <p style={{ fontSize: 9, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em', color: '#374151', marginBottom: 7 }}>Earnings</p>
                {[['Basic Pay','₱24,062.50'],['Overtime','₱2,960.94'],['Transport','₱1,000.00'],['Meal','₱750.00']].map(([l,v])=>(
                  <div key={l} style={{ display:'flex', justifyContent:'space-between', marginBottom:4 }}>
                    <span style={{ fontSize:10.5, color:'#374151' }}>{l}</span>
                    <span style={{ fontSize:10.5, color:'#374151' }}>{v}</span>
                  </div>
                ))}
                <div style={{ display:'flex', justifyContent:'space-between', marginTop:7, paddingTop:7, borderTop:'1px solid #E2E8F0' }}>
                  <span style={{ fontSize:11, fontWeight:700, color:'#0D1B2A' }}>Gross Pay</span>
                  <span style={{ fontSize:11, fontWeight:700, color:'#0D1B2A' }}>₱28,773.44</span>
                </div>
              </div>
              <div style={{ padding: '10px 18px' }}>
                <p style={{ fontSize:9, fontWeight:700, textTransform:'uppercase', letterSpacing:'0.08em', color:'#374151', marginBottom:7 }}>Deductions</p>
                {[['Absence','−₱3,750.00'],['SSS','−₱810.00'],['PhilHealth','−₱687.50'],['Pag-IBIG','−₱100.00'],['Withholding','−₱3,439.86']].map(([l,v])=>(
                  <div key={l} style={{ display:'flex', justifyContent:'space-between', marginBottom:4 }}>
                    <span style={{ fontSize:10.5, color:'#374151' }}>{l}</span>
                    <span style={{ fontSize:10.5, color:'#DC2626' }}>{v}</span>
                  </div>
                ))}
                <div style={{ display:'flex', justifyContent:'space-between', marginTop:7, paddingTop:7, borderTop:'1px solid #E2E8F0' }}>
                  <span style={{ fontSize:11, fontWeight:700, color:'#DC2626' }}>Total Deductions</span>
                  <span style={{ fontSize:11, fontWeight:700, color:'#DC2626' }}>−₱8,787.36</span>
                </div>
              </div>
            </div>

            <div style={{ padding:'13px 18px', display:'flex', justifyContent:'space-between', alignItems:'center', background:'#EFF6FF' }}>
              <div>
                <p style={{ fontSize:10.5, fontWeight:700, color:'#1C3172', textTransform:'uppercase', letterSpacing:'0.06em' }}>Net Pay</p>
                <p style={{ fontSize:9.5, color:'#94A3B8', marginTop:2 }}>₱28,773.44 gross − ₱8,787.36 deductions</p>
              </div>
              <span style={{ fontSize:24, fontWeight:900, color:'#1C3172', letterSpacing:'-0.04em' }}>₱19,986.08</span>
            </div>
          </div>
        </div>
      </section>

      {/* ── Access control ──────────────────────────────────────── */}
      <section style={{ padding: 'clamp(52px,7vw,80px) clamp(20px,5vw,72px)' }}>
        <div style={{ maxWidth: 1200, margin: '0 auto', display: 'flex', flexWrap: 'wrap', gap: 'clamp(28px,5vw,64px)', alignItems: 'center' }}>
          <div style={{ flex: '1 1 320px' }}>
            <p style={{ fontSize: 11, fontWeight: 700, color: '#7C3AED', textTransform: 'uppercase', letterSpacing: '0.14em', marginBottom: 12 }}>Access Control</p>
            <h2 style={{ fontSize: 'clamp(24px,3.2vw,40px)', fontWeight: 900, letterSpacing: '-0.04em', color: '#0D1B2A', lineHeight: 1.12, marginBottom: 14 }}>
              Five roles.<br />Every level covered.
            </h2>
            <p style={{ fontSize: 14.5, color: '#6B7280', lineHeight: 1.75 }}>
              Super Admin, HR Admin, Payroll Officer, Department Head, and Employee — each sees exactly what they need, nothing more.
            </p>
          </div>
          <div style={{ flex: '1 1 300px', display: 'flex', flexDirection: 'column', gap: 8 }}>
            {[
              { role: 'Super Admin',     color: '#7C3AED', bg: '#F5F3FF', border: '#DDD6FE', desc: 'Full system access — settings, audit logs, all modules' },
              { role: 'HR Admin',        color: '#1C3172', bg: '#EFF6FF', border: '#BFDBFE', desc: 'Employees, attendance, leaves, schedules' },
              { role: 'Payroll Officer', color: '#059669', bg: '#ECFDF5', border: '#A7F3D0', desc: 'Payroll runs, payslips, reports' },
              { role: 'Department Head', color: '#D97706', bg: '#FFFBEB', border: '#FDE68A', desc: 'Team attendance, leave & OT approvals' },
              { role: 'Employee',        color: '#6B7280', bg: '#F8FAFC', border: '#E2E8F0', desc: 'Own payslips and leave balance' },
            ].map(r => (
              <div key={r.role} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '10px 14px', background: r.bg, border: `1px solid ${r.border}`, borderRadius: 9 }}>
                <div style={{ width: 7, height: 7, borderRadius: '50%', background: r.color, flexShrink: 0 }} />
                <span style={{ fontSize: 12.5, fontWeight: 700, color: r.color, minWidth: 118, flexShrink: 0 }}>{r.role}</span>
                <span style={{ fontSize: 12, color: '#6B7280' }}>{r.desc}</span>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── CTA ─────────────────────────────────────────────────── */}
      <section style={{ padding: 'clamp(52px,7vw,80px) clamp(20px,5vw,72px)', background: '#F8FAFC', borderTop: '1px solid #E2E8F0' }}>
        <div style={{ maxWidth: 680, margin: '0 auto', textAlign: 'center' }}>
          <img src={brand.logoUrl} alt={brand.appName} style={{ height: 52, width: 'auto', margin: '0 auto 18px', display: 'block' }} />
          <h2 style={{ fontSize: 'clamp(26px,3.8vw,48px)', fontWeight: 900, letterSpacing: '-0.045em', color: '#0D1B2A', lineHeight: 1.07, marginBottom: 14 }}>
            Ready to ditch<br />the spreadsheets?
          </h2>
          <p style={{ fontSize: 15.5, color: '#6B7280', lineHeight: 1.75, marginBottom: 32, maxWidth: 440, margin: '0 auto 32px' }}>
            Built for Ten Foundation Philippines Inc. — contact your system administrator to get access.
          </p>
          <div style={{ display: 'flex', gap: 10, justifyContent: 'center', flexWrap: 'wrap' }}>
            <button className="lp-btn" onClick={() => navigate(user ? '/dashboard' : '/login')} style={{
              display: 'flex', alignItems: 'center', gap: 7, padding: '13px 28px',
              borderRadius: 9, background: '#1C3172', color: '#fff', fontWeight: 700, fontSize: 15,
            }}>
              {user ? 'Go to Dashboard' : `Sign in to ${brand.appName}`} <ArrowRight size={14} />
            </button>
            <button className="lp-btn" onClick={() => navigate('/kiosk')} style={{
              padding: '13px 24px', borderRadius: 9, background: '#fff',
              color: '#374151', fontWeight: 600, fontSize: 15, border: '1px solid #D1D5DB',
            }}>
              RFID Kiosk
            </button>
          </div>
        </div>
      </section>

      {/* ── Footer ──────────────────────────────────────────────── */}
      <footer style={{ background: '#0D1225', borderTop: '1px solid #1E2D4F' }}>

        {/* Main row */}
        <div style={{
          display: 'flex', flexWrap: 'wrap', gap: 14, alignItems: 'center', justifyContent: 'space-between',
          padding: '20px clamp(20px,5vw,72px)',
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <img src={brand.logoUrl} alt={brand.appName} style={{ height: 22, width: 'auto' }} />
            <span style={{ fontSize: 13, fontWeight: 700, color: '#E2E8F0', letterSpacing: '-0.02em' }}>{brand.appName}</span>
            <span style={{ fontSize: 11.5, color: '#374151' }}>· Philippine HR & Payroll</span>
          </div>
          <p style={{ fontSize: 11.5, color: '#374151' }}>© {new Date().getFullYear()} {brand.appName} · Built for Filipino businesses</p>
          <div style={{ display: 'flex', gap: 16, flexWrap: 'wrap' }}>
            {['PH Compliant', 'SSS 2024', 'PhilHealth 5%', 'BIR TRAIN Law'].map(t => (
              <span key={t} style={{ fontSize: 11, color: '#374151', fontWeight: 500 }}>{t}</span>
            ))}
          </div>
        </div>

        {/* Developer credit */}
        <div style={{ borderTop: '1px solid #151F35', padding: '10px clamp(20px,5vw,72px)', display: 'flex', justifyContent: 'center', gap: 6, alignItems: 'center' }}>
          <span style={{ fontSize: 10.5, color: '#253552' }}>Designed &amp; developed by</span>
          <span style={{ fontSize: 10.5, fontWeight: 600, color: '#2E4470' }}>Prince Arvee F. Avena</span>
          <span style={{ fontSize: 10.5, color: '#1E2D45' }}>·</span>
          <span style={{ fontSize: 10.5, color: '#253552' }}>BS Computer Science, Magna Cum Laude</span>
        </div>

      </footer>

    </div>
  )
}
