import { useNavigate } from 'react-router-dom'
import { ArrowRight, CheckCircle, Clock, FileText, Users, CreditCard } from 'lucide-react'
import { useAuthStore } from '../../store/authStore'
import { useEffect, useRef } from 'react'
import brand from '../../config/brand'

/* ─── Marquee items ────────────────────────────────────────────── */
const MARQUEE = [
  'SSS 2024 Tables', 'PhilHealth 5%', 'Pag-IBIG / HDMF', 'BIR TRAIN Law',
  'RFID Card Attendance', 'Overtime Pay', 'Night Differential', '13th Month Pay',
  'Leave Management', 'Payslip Generation', 'Government Remittances', 'Audit Logs',
]

function Marquee() {
  const items = [...MARQUEE, ...MARQUEE]
  return (
    <div style={{ overflow: 'hidden', borderTop: '1px solid #E2E8F0', borderBottom: '1px solid #E2E8F0', background: '#F8FAFC', padding: '14px 0' }}>
      <div style={{ display: 'flex', gap: 0, animation: 'marquee 28s linear infinite', width: 'max-content' }}>
        {items.map((item, i) => (
          <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '0 28px', whiteSpace: 'nowrap' }}>
            <div style={{ width: 5, height: 5, borderRadius: '50%', background: i % 3 === 0 ? '#DC2626' : i % 3 === 1 ? '#0D1B2A' : '#00AAFF', flexShrink: 0 }} />
            <span style={{ fontSize: 13, fontWeight: 500, color: '#374151' }}>{item}</span>
          </div>
        ))}
      </div>
    </div>
  )
}

function CountUp({ target, suffix = '' }: { target: number; suffix?: string }) {
  const ref = useRef<HTMLSpanElement>(null)
  useEffect(() => {
    let start = 0
    const step = Math.ceil(target / 40)
    const t = setInterval(() => {
      start = Math.min(start + step, target)
      if (ref.current) ref.current.textContent = start.toLocaleString() + suffix
      if (start >= target) clearInterval(t)
    }, 30)
    return () => clearInterval(t)
  }, [target, suffix])
  return <span ref={ref}>0{suffix}</span>
}

/* ─── Component ────────────────────────────────────────────────── */
export function Landing() {
  const navigate = useNavigate()
  const user = useAuthStore(s => s.user)

  return (
    <div style={{ fontFamily: 'Inter, sans-serif', color: '#0D1B2A', background: '#fff', overflowX: 'hidden' }}>

      <style>{`
        @keyframes marquee { from { transform: translateX(0) } to { transform: translateX(-50%) } }
        @keyframes floatUp { from { opacity: 0; transform: translateY(24px) } to { opacity: 1; transform: translateY(0) } }
        @keyframes fadeIn { from { opacity: 0 } to { opacity: 1 } }
        .land-btn-primary { transition: background 0.15s, transform 0.12s, box-shadow 0.15s !important; }
        .land-btn-primary:hover { background: #B91C1C !important; transform: translateY(-1px) !important; box-shadow: 0 8px 24px rgba(220,38,38,0.35) !important; }
        .land-btn-ghost:hover { background: #F1F5F9 !important; }
        .feat-card:hover { transform: translateY(-3px); box-shadow: 0 12px 40px rgba(13,27,42,0.10) !important; }
        .feat-card { transition: transform 0.18s, box-shadow 0.18s; }
      `}</style>

      {/* ══ NAV ══════════════════════════════════════════════════════════ */}
      <nav style={{
        position: 'sticky', top: 0, zIndex: 100,
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        padding: '0 clamp(24px, 6vw, 80px)', height: 64,
        background: 'rgba(255,255,255,0.96)',
        backdropFilter: 'blur(20px)',
        borderBottom: '1px solid #EEF1F6',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, cursor: 'pointer' }} onClick={() => navigate('/')}>
          <img src={brand.logoUrl} alt={brand.appName} style={{ height: 36, width: 36, objectFit: 'contain' }} />
          <span style={{ fontWeight: 800, fontSize: 17, letterSpacing: '-0.03em', color: '#0D1B2A' }}>{brand.appName}</span>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          {user ? (
            <button className="land-btn-primary" onClick={() => navigate('/dashboard')} style={{ display: 'flex', alignItems: 'center', gap: 7, padding: '8px 20px', borderRadius: 8, background: '#DC2626', color: '#fff', fontWeight: 600, fontSize: 13.5, border: 'none', cursor: 'pointer' }}>
              Dashboard <ArrowRight style={{ width: 14, height: 14 }} />
            </button>
          ) : (
            <>
              <button className="land-btn-ghost" onClick={() => navigate('/kiosk')} style={{ padding: '7px 16px', borderRadius: 7, border: 'none', background: 'transparent', color: '#6B7280', fontWeight: 500, fontSize: 13.5, cursor: 'pointer' }}>Kiosk</button>
              <button className="land-btn-primary" onClick={() => navigate('/login')} style={{ padding: '8px 20px', borderRadius: 8, background: '#DC2626', color: '#fff', fontWeight: 600, fontSize: 13.5, border: 'none', cursor: 'pointer' }}>Sign in</button>
            </>
          )}
        </div>
      </nav>

      {/* ══ HERO ═════════════════════════════════════════════════════════ */}
      <section style={{ padding: 'clamp(60px,9vw,110px) clamp(24px,6vw,80px) 0', maxWidth: 1280, margin: '0 auto' }}>

        {/* Label pill */}
        <div style={{ display: 'inline-flex', alignItems: 'center', gap: 8, padding: '5px 14px 5px 8px', background: '#FEF2F2', border: '1px solid #FECACA', borderRadius: 999, marginBottom: 28 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 5, background: '#DC2626', borderRadius: 999, padding: '2px 8px' }}>
            <div style={{ width: 5, height: 5, borderRadius: '50%', background: '#fff' }} />
            <span style={{ fontSize: 10.5, fontWeight: 700, color: '#fff', letterSpacing: '0.04em' }}>NEW</span>
          </div>
          <span style={{ fontSize: 12.5, fontWeight: 500, color: '#DC2626' }}>RFID card attendance · now live</span>
        </div>

        {/* Headline — very editorial */}
        <h1 style={{
          fontSize: 'clamp(40px, 6.5vw, 82px)',
          fontWeight: 900, lineHeight: 1.02,
          letterSpacing: '-0.05em', color: '#0D1B2A',
          maxWidth: 820, marginBottom: 0,
        }}>
          HR &amp; Payroll<br />
          <span style={{ color: '#DC2626' }}>built right</span>{' '}
          <span style={{ color: '#9CA3AF', fontWeight: 300, fontStyle: 'italic' }}>for the</span><br />
          Philippines.
        </h1>

        {/* Subtext + CTA in a row */}
        <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'flex-end', gap: 'clamp(24px,4vw,56px)', marginTop: 28, marginBottom: 56 }}>
          <p style={{ fontSize: 'clamp(15px,1.8vw,18px)', color: '#6B7280', lineHeight: 1.7, maxWidth: 480, flex: '1 1 300px' }}>
            Automates SSS, PhilHealth, Pag-IBIG, and BIR TRAIN Law withholding. RFID attendance. Payslips. Leave management. One platform — no spreadsheets.
          </p>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 10, flexShrink: 0 }}>
            <button className="land-btn-primary" onClick={() => navigate(user ? '/dashboard' : '/login')} style={{
              display: 'flex', alignItems: 'center', gap: 8, padding: '13px 26px',
              borderRadius: 9, background: '#DC2626', color: '#fff',
              fontWeight: 700, fontSize: 15, border: 'none', cursor: 'pointer',
            }}>
              {user ? 'Go to Dashboard' : 'Sign in'} <ArrowRight style={{ width: 15, height: 15 }} />
            </button>
            <button className="land-btn-ghost" onClick={() => navigate('/kiosk')} style={{
              padding: '13px 24px', borderRadius: 9, background: '#F1F5F9',
              color: '#374151', fontWeight: 600, fontSize: 15, border: 'none', cursor: 'pointer',
            }}>
              View Kiosk
            </button>
          </div>
        </div>

        {/* Dashboard screenshot */}
        <div style={{
          position: 'relative',
          borderRadius: '16px 16px 0 0',
          overflow: 'hidden',
          border: '1px solid #E2E8F0',
          borderBottom: 'none',
          boxShadow: '0 -4px 0 0 #E2E8F0, 0 -40px 80px rgba(13,27,42,0.08)',
        }}>
          {/* Browser chrome */}
          <div style={{ height: 40, background: '#F8FAFC', borderBottom: '1px solid #E2E8F0', display: 'flex', alignItems: 'center', padding: '0 16px', gap: 8 }}>
            <div style={{ display: 'flex', gap: 6 }}>
              {['#EF4444', '#F59E0B', '#22C55E'].map(c => <div key={c} style={{ width: 10, height: 10, borderRadius: '50%', background: c }} />)}
            </div>
            <div style={{ flex: 1, maxWidth: 320, margin: '0 auto', height: 24, background: '#EEF1F6', borderRadius: 6, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <span style={{ fontSize: 10.5, color: '#94A3B8', fontWeight: 500 }}>app.tenpayroll.ph/dashboard</span>
            </div>
          </div>
          <img
            src="/dashboard.png"
            alt={`${brand.appName} Dashboard`}
            style={{ width: '100%', display: 'block' }}
          />
        </div>
      </section>

      {/* ══ MARQUEE ══════════════════════════════════════════════════════ */}
      <Marquee />

      {/* ══ STATS ROW ════════════════════════════════════════════════════ */}
      <section style={{ padding: 'clamp(56px,6vw,80px) clamp(24px,6vw,80px)', maxWidth: 1280, margin: '0 auto' }}>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: 1, background: '#E2E8F0', border: '1px solid #E2E8F0', borderRadius: 12, overflow: 'hidden' }}>
          {[
            { n: 100, suffix: '%', label: 'Philippine compliant' },
            { n: 4, suffix: ' gov\'t deductions', label: 'auto-computed' },
            { n: 5, suffix: ' roles', label: 'access control' },
            { n: 0, suffix: ' spreadsheets', label: 'needed' },
          ].map((s, i) => (
            <div key={i} style={{ background: '#fff', padding: 'clamp(24px,3vw,36px) clamp(20px,3vw,32px)' }}>
              <div style={{ fontSize: 'clamp(28px,3.5vw,42px)', fontWeight: 900, letterSpacing: '-0.05em', color: '#0D1B2A', lineHeight: 1 }}>
                <CountUp target={s.n} suffix={s.suffix} />
              </div>
              <div style={{ fontSize: 13, color: '#6B7280', marginTop: 6, fontWeight: 500 }}>{s.label}</div>
            </div>
          ))}
        </div>
      </section>

      {/* ══ ASYMMETRIC FEATURE GRID ══════════════════════════════════════ */}
      <section style={{ padding: '0 clamp(24px,6vw,80px) clamp(64px,7vw,96px)', maxWidth: 1280, margin: '0 auto' }}>

        {/* Section label */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 36 }}>
          <div style={{ height: 1, flex: 1, background: '#E2E8F0' }} />
          <span style={{ fontSize: 11.5, fontWeight: 700, color: '#94A3B8', textTransform: 'uppercase', letterSpacing: '0.14em', whiteSpace: 'nowrap' }}>What you get</span>
          <div style={{ height: 1, flex: 1, background: '#E2E8F0' }} />
        </div>

        {/* Grid: 1 wide left + 2 stacked right */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: 16 }}>

          {/* Big card — RFID Attendance */}
          <div className="feat-card" style={{
            gridRow: 'span 2', background: '#0D1B2A', borderRadius: 16,
            padding: 'clamp(28px,4vw,44px)', display: 'flex', flexDirection: 'column',
            border: '1px solid #1E3A5F', minHeight: 360,
          }}>
            <div style={{ width: 48, height: 48, borderRadius: 12, background: 'rgba(0,170,255,0.12)', border: '1px solid rgba(0,170,255,0.25)', display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: 20 }}>
              <CreditCard style={{ width: 22, height: 22, color: '#00AAFF' }} />
            </div>
            <h3 style={{ fontSize: 'clamp(20px,2.5vw,26px)', fontWeight: 800, letterSpacing: '-0.03em', color: '#F8FAFC', lineHeight: 1.2, marginBottom: 12 }}>
              RFID Card<br />Attendance
            </h3>
            <p style={{ fontSize: 14.5, color: '#475569', lineHeight: 1.7, flex: 1 }}>
              Employees tap their ID card. TenPayroll records the time, checks against their shift, computes grace period and late minutes — automatically. No PIN to remember, no buddy punching.
            </p>
            <div style={{ marginTop: 28, paddingTop: 24, borderTop: '1px solid rgba(255,255,255,0.07)' }}>
              <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                {['Grace period', 'Late detection', 'OT tracking', 'Night diff'].map(t => (
                  <span key={t} style={{ fontSize: 11.5, fontWeight: 600, color: '#00AAFF', padding: '4px 10px', background: 'rgba(0,170,255,0.08)', border: '1px solid rgba(0,170,255,0.15)', borderRadius: 999 }}>{t}</span>
                ))}
              </div>
            </div>
          </div>

          {/* Card — Philippine Payroll */}
          <div className="feat-card" style={{ background: '#F0F7FF', borderRadius: 16, padding: 'clamp(24px,3vw,36px)', border: '1px solid #C7D2FE', display: 'flex', flexDirection: 'column', gap: 12 }}>
            <div style={{ width: 44, height: 44, borderRadius: 11, background: '#DBEAFE', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <FileText style={{ width: 20, height: 20, color: '#4F46E5' }} />
            </div>
            <div>
              <h3 style={{ fontSize: 18, fontWeight: 800, letterSpacing: '-0.025em', color: '#0D1B2A', marginBottom: 8 }}>Philippine Payroll</h3>
              <p style={{ fontSize: 13.5, color: '#475569', lineHeight: 1.65 }}>SSS 2024, PhilHealth 5%, Pag-IBIG 2%, BIR TRAIN Law — computed per payroll run. Payslips generated in one click.</p>
            </div>
            <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginTop: 'auto' }}>
              {['SSS 2024', 'PhilHealth', 'Pag-IBIG', 'BIR TRAIN'].map(t => (
                <span key={t} style={{ fontSize: 11, fontWeight: 600, color: '#4F46E5', padding: '3px 9px', background: '#EEF2FF', border: '1px solid #C7D2FE', borderRadius: 999 }}>{t}</span>
              ))}
            </div>
          </div>

          {/* Card — HR & Leave */}
          <div className="feat-card" style={{ background: '#F0FDF4', borderRadius: 16, padding: 'clamp(24px,3vw,36px)', border: '1px solid #BBF7D0', display: 'flex', flexDirection: 'column', gap: 12 }}>
            <div style={{ width: 44, height: 44, borderRadius: 11, background: '#DCFCE7', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <Users style={{ width: 20, height: 20, color: '#059669' }} />
            </div>
            <div>
              <h3 style={{ fontSize: 18, fontWeight: 800, letterSpacing: '-0.025em', color: '#0D1B2A', marginBottom: 8 }}>HR & Leave Management</h3>
              <p style={{ fontSize: 13.5, color: '#475569', lineHeight: 1.65 }}>Full employee profiles, leave balances, overtime requests, and department approvals — in a clean, role-based interface.</p>
            </div>
            <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginTop: 'auto' }}>
              {['Vacation', 'Sick', 'Emergency', 'Overtime'].map(t => (
                <span key={t} style={{ fontSize: 11, fontWeight: 600, color: '#059669', padding: '3px 9px', background: '#ECFDF5', border: '1px solid #A7F3D0', borderRadius: 999 }}>{t}</span>
              ))}
            </div>
          </div>

        </div>

        {/* Second row — 3 equal smaller cards */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 16, marginTop: 16 }}>
          {[
            { icon: Clock, color: '#7C3AED', bg: '#F5F3FF', border: '#DDD6FE', title: 'Shift Management', desc: 'Define work shifts, grace minutes, rest days, and overtime thresholds per team.' },
            { icon: CheckCircle, color: '#D97706', bg: '#FFFBEB', border: '#FDE68A', title: 'Audit Logs', desc: 'Every action is logged — who did what, when, and what changed. Full traceability.' },
            { icon: FileText, color: '#0891B2', bg: '#ECFEFF', border: '#A5F3FC', title: 'Reports & Analytics', desc: 'Payroll summaries, headcount, attendance rates, and government contribution reports.' },
          ].map(c => {
            const Icon = c.icon
            return (
              <div key={c.title} className="feat-card" style={{ background: c.bg, borderRadius: 16, padding: 'clamp(20px,2.5vw,28px)', border: `1px solid ${c.border}`, display: 'flex', gap: 14 }}>
                <div style={{ width: 40, height: 40, borderRadius: 10, background: `${c.color}18`, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, marginTop: 2 }}>
                  <Icon style={{ width: 18, height: 18, color: c.color }} />
                </div>
                <div>
                  <h4 style={{ fontSize: 14, fontWeight: 700, color: '#0D1B2A', marginBottom: 6 }}>{c.title}</h4>
                  <p style={{ fontSize: 12.5, color: '#6B7280', lineHeight: 1.6 }}>{c.desc}</p>
                </div>
              </div>
            )
          })}
        </div>
      </section>

      {/* ══ PAYSLIP PREVIEW ══════════════════════════════════════════════ */}
      <section style={{ background: '#0D1B2A', padding: 'clamp(56px,7vw,90px) clamp(24px,6vw,80px)' }}>
        <div style={{ maxWidth: 1280, margin: '0 auto' }}>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 'clamp(40px,5vw,80px)', alignItems: 'center' }}>

            {/* Left copy */}
            <div>
              <p style={{ fontSize: 11.5, fontWeight: 700, color: '#00AAFF', textTransform: 'uppercase', letterSpacing: '0.14em', marginBottom: 14 }}>Payslip</p>
              <h2 style={{ fontSize: 'clamp(26px,3.5vw,44px)', fontWeight: 900, letterSpacing: '-0.04em', color: '#F8FAFC', lineHeight: 1.1, marginBottom: 16 }}>
                Payslips that look<br />like they mean it.
              </h2>
              <p style={{ fontSize: 15.5, color: '#475569', lineHeight: 1.7, marginBottom: 28 }}>
                Every pay run generates a clean, print-ready payslip with complete earnings, all government deductions, attendance summary, and contribution breakdown — BIR-compliant.
              </p>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                {[
                  'Gross pay breakdown with allowances',
                  'SSS, PhilHealth, Pag-IBIG employee & employer shares',
                  'BIR withholding tax (TRAIN Law)',
                  'Attendance summary — scheduled vs present days',
                  'Net pay clearly displayed — no ambiguity',
                ].map(item => (
                  <div key={item} style={{ display: 'flex', gap: 10, alignItems: 'flex-start' }}>
                    <CheckCircle style={{ width: 15, height: 15, color: '#22C55E', flexShrink: 0, marginTop: 2 }} />
                    <span style={{ fontSize: 13.5, color: '#94A3B8' }}>{item}</span>
                  </div>
                ))}
              </div>
            </div>

            {/* Right — payslip card (styled after the actual screenshot shared) */}
            <div style={{
              background: '#fff', borderRadius: 12,
              boxShadow: '0 32px 80px rgba(0,0,0,0.4)',
              overflow: 'hidden', border: '1px solid #E2E8F0',
            }}>
              {/* Header */}
              <div style={{ padding: '16px 20px', display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', borderBottom: '3px solid #4F46E5' }}>
                <div style={{ display: 'flex', gap: 12, alignItems: 'center' }}>
                  <div style={{ width: 36, height: 36, borderRadius: 8, background: '#4F46E5', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 900, color: '#fff', fontSize: 16 }}>T</div>
                  <div>
                    <p style={{ fontSize: 13, fontWeight: 700, color: '#0D1B2A' }}>Ten Foundation Philippines Inc.</p>
                    <p style={{ fontSize: 10.5, color: '#6B7280' }}>Makati City, Metro Manila</p>
                    <p style={{ fontSize: 10.5, color: '#6B7280' }}>hr@tenfoundation.ph</p>
                  </div>
                </div>
                <div style={{ textAlign: 'right' }}>
                  <div style={{ background: '#4F46E5', color: '#fff', fontSize: 9.5, fontWeight: 700, padding: '3px 8px', borderRadius: 4, letterSpacing: '0.05em', marginBottom: 6 }}>PAYSLIP</div>
                  <p style={{ fontSize: 10.5, fontWeight: 700, color: '#374151' }}>PAY-0102</p>
                  <p style={{ fontSize: 10, color: '#9CA3AF' }}>May 11 – May 26, 2026</p>
                  <p style={{ fontSize: 10, fontWeight: 600, color: '#374151' }}>Pay Date: May 31, 2026</p>
                </div>
              </div>

              {/* Employee info */}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px 20px', padding: '12px 20px', background: '#F8FAFC', borderBottom: '1px solid #E2E8F0' }}>
                {[
                  ['Employee Name', 'Maria Cruz Santos'], ['Employment Type', 'Regular'],
                  ['Employee No.', 'EMP-0001'], ['Pay Frequency', 'Bi-monthly'],
                  ['Department', 'Human Resources'], ['Tax Status', 'ME'],
                  ['Position', 'HR Manager'], ['Bank', 'BDO – 001234567890'],
                ].map(([l, v]) => (
                  <div key={l} style={{ display: 'flex', gap: 4 }}>
                    <span style={{ fontSize: 10, color: '#9CA3AF', minWidth: 80, flexShrink: 0 }}>{l}:</span>
                    <span style={{ fontSize: 10, fontWeight: 600, color: '#0D1B2A' }}>{v}</span>
                  </div>
                ))}
              </div>

              {/* Earnings + Deductions */}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', borderBottom: '1px solid #E2E8F0' }}>
                <div style={{ padding: '12px 20px', borderRight: '1px solid #E2E8F0' }}>
                  <p style={{ fontSize: 9.5, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.1em', color: '#374151', marginBottom: 8 }}>Earnings</p>
                  {[['Basic Pay', '₱24,062.50'], ['Overtime Pay', '₱2,960.94'], ['Transportation', '₱1,000.00'], ['Meal', '₱750.00']].map(([l, v]) => (
                    <div key={l} style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 5 }}>
                      <span style={{ fontSize: 11, color: '#374151' }}>{l}</span>
                      <span style={{ fontSize: 11, color: '#374151' }}>{v}</span>
                    </div>
                  ))}
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 8, paddingTop: 8, borderTop: '1px solid #E2E8F0' }}>
                    <span style={{ fontSize: 11.5, fontWeight: 700, color: '#0D1B2A' }}>Gross Pay</span>
                    <span style={{ fontSize: 11.5, fontWeight: 700, color: '#0D1B2A' }}>₱28,773.44</span>
                  </div>
                </div>
                <div style={{ padding: '12px 20px' }}>
                  <p style={{ fontSize: 9.5, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.1em', color: '#374151', marginBottom: 8 }}>Deductions</p>
                  {[['Absence', '−₱3,750.00'], ['SSS Contribution', '−₱810.00'], ['PhilHealth', '−₱687.50'], ['Pag-IBIG (HDMF)', '−₱100.00'], ['Withholding Tax', '−₱3,439.86']].map(([l, v]) => (
                    <div key={l} style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 5 }}>
                      <span style={{ fontSize: 11, color: '#374151' }}>{l}</span>
                      <span style={{ fontSize: 11, color: '#DC2626' }}>{v}</span>
                    </div>
                  ))}
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 8, paddingTop: 8, borderTop: '1px solid #E2E8F0' }}>
                    <span style={{ fontSize: 11.5, fontWeight: 700, color: '#DC2626' }}>Total Deductions</span>
                    <span style={{ fontSize: 11.5, fontWeight: 700, color: '#DC2626' }}>−₱8,787.36</span>
                  </div>
                </div>
              </div>

              {/* Net Pay */}
              <div style={{ padding: '14px 20px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: '#EEF2FF' }}>
                <div>
                  <p style={{ fontSize: 11, fontWeight: 700, color: '#4F46E5', textTransform: 'uppercase', letterSpacing: '0.06em' }}>Net Pay</p>
                  <p style={{ fontSize: 10, color: '#94A3B8', marginTop: 2 }}>₱28,773.44 gross − ₱8,787.36 deductions</p>
                </div>
                <span style={{ fontSize: 26, fontWeight: 900, color: '#4F46E5', letterSpacing: '-0.04em' }}>₱19,986.08</span>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ══ ROLE-BASED ACCESS ════════════════════════════════════════════ */}
      <section style={{ padding: 'clamp(56px,7vw,88px) clamp(24px,6vw,80px)' }}>
        <div style={{ maxWidth: 1280, margin: '0 auto' }}>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 'clamp(32px,5vw,72px)', alignItems: 'center' }}>
            <div style={{ flex: '1 1 340px' }}>
              <p style={{ fontSize: 11.5, fontWeight: 700, color: '#7C3AED', textTransform: 'uppercase', letterSpacing: '0.14em', marginBottom: 14 }}>Access Control</p>
              <h2 style={{ fontSize: 'clamp(26px,3.5vw,42px)', fontWeight: 900, letterSpacing: '-0.04em', color: '#0D1B2A', lineHeight: 1.1, marginBottom: 16 }}>
                Five roles.<br />Every level covered.
              </h2>
              <p style={{ fontSize: 15, color: '#6B7280', lineHeight: 1.7, marginBottom: 0 }}>
                Super Admin, HR Admin, Payroll Officer, Department Head, and Employee. Each role sees exactly what they need — nothing more, nothing less.
              </p>
            </div>
            <div style={{ flex: '1 1 320px', display: 'flex', flexDirection: 'column', gap: 10 }}>
              {[
                { role: 'Super Admin',     color: '#7C3AED', bg: '#F5F3FF', border: '#DDD6FE', desc: 'Full system access — settings, audit logs, all modules' },
                { role: 'HR Admin',        color: '#4F46E5', bg: '#EEF2FF', border: '#C7D2FE', desc: 'Employees, attendance, leaves, schedules' },
                { role: 'Payroll Officer', color: '#059669', bg: '#ECFDF5', border: '#A7F3D0', desc: 'Payroll runs, payslips, reports' },
                { role: 'Department Head', color: '#D97706', bg: '#FFFBEB', border: '#FDE68A', desc: 'Team attendance, leave & OT approvals' },
                { role: 'Employee',        color: '#6B7280', bg: '#F8FAFC', border: '#E2E8F0', desc: 'Own payslips and leave balance' },
              ].map(r => (
                <div key={r.role} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '12px 16px', background: r.bg, border: `1px solid ${r.border}`, borderRadius: 10 }}>
                  <div style={{ width: 8, height: 8, borderRadius: '50%', background: r.color, flexShrink: 0 }} />
                  <span style={{ fontSize: 13, fontWeight: 700, color: r.color, minWidth: 128, flexShrink: 0 }}>{r.role}</span>
                  <span style={{ fontSize: 12.5, color: '#6B7280' }}>{r.desc}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* ══ CTA ══════════════════════════════════════════════════════════ */}
      <section style={{ padding: 'clamp(56px,7vw,88px) clamp(24px,6vw,80px)', background: '#F8FAFC', borderTop: '1px solid #E2E8F0' }}>
        <div style={{ maxWidth: 760, margin: '0 auto', textAlign: 'center' }}>
          <img src={brand.logoUrl} alt={brand.appName} style={{ width: 56, height: 56, objectFit: 'contain', margin: '0 auto 20px', display: 'block' }} />
          <h2 style={{ fontSize: 'clamp(28px,4vw,52px)', fontWeight: 900, letterSpacing: '-0.045em', color: '#0D1B2A', lineHeight: 1.05, marginBottom: 16 }}>
            Ready to ditch<br />the spreadsheets?
          </h2>
          <p style={{ fontSize: 16, color: '#6B7280', lineHeight: 1.7, marginBottom: 36, maxWidth: 480, margin: '0 auto 36px' }}>
            Built exclusively for Ten Foundation Philippines Inc. — contact your system administrator to get access.
          </p>
          <div style={{ display: 'flex', gap: 12, justifyContent: 'center', flexWrap: 'wrap' }}>
            <button className="land-btn-primary" onClick={() => navigate(user ? '/dashboard' : '/login')} style={{
              display: 'flex', alignItems: 'center', gap: 8, padding: '14px 30px',
              borderRadius: 9, background: '#4F46E5', color: '#fff',
              fontWeight: 700, fontSize: 15, border: 'none', cursor: 'pointer',
            }}>
              {user ? 'Go to Dashboard' : `Sign in to ${brand.appName}`} <ArrowRight style={{ width: 15, height: 15 }} />
            </button>
            <button className="land-btn-ghost" onClick={() => navigate('/kiosk')} style={{
              padding: '14px 26px', borderRadius: 9, background: '#fff',
              color: '#374151', fontWeight: 600, fontSize: 15,
              border: '1px solid #D1D5DB', cursor: 'pointer',
            }}>
              RFID Kiosk
            </button>
          </div>
        </div>
      </section>

      {/* ══ FOOTER ═══════════════════════════════════════════════════════ */}
      <footer style={{
        display: 'flex', flexWrap: 'wrap', gap: 16,
        alignItems: 'center', justifyContent: 'space-between',
        padding: '22px clamp(24px,6vw,80px)',
        background: '#0D1B2A',
        borderTop: '1px solid #1E3A5F',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <img src={brand.logoUrl} alt={brand.appName} style={{ height: 24, width: 24, objectFit: 'contain' }} />
          <span style={{ fontSize: 13.5, fontWeight: 700, color: '#E2E8F0', letterSpacing: '-0.02em' }}>{brand.appName}</span>
          <span style={{ fontSize: 12, color: '#374151' }}>· Philippine HR & Payroll</span>
        </div>
        <p style={{ fontSize: 11.5, color: '#374151' }}>© {new Date().getFullYear()} {brand.appName} · Built for Filipino businesses</p>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px 18px' }}>
          {['PH Compliant', 'SSS 2024', 'PhilHealth 5%', 'BIR TRAIN Law'].map(t => (
            <span key={t} style={{ fontSize: 11.5, color: '#374151', fontWeight: 500 }}>{t}</span>
          ))}
        </div>
      </footer>
    </div>
  )
}
