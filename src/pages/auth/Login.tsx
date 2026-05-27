import { useState, useEffect } from "react"
import { useNavigate } from "react-router-dom"
import { motion, AnimatePresence } from "framer-motion"
import { Eye, EyeOff, LogIn, Users, Clock, Banknote, BarChart2, ChevronRight } from "lucide-react"
import { apiLogin } from "../../lib/db"
import { useAuthStore } from "../../store/authStore"
import { brand } from "../../config/brand"

const FEATURES = [
  { icon: Users,     title: "Employee Management",  desc: "Complete HR profiles, departments & positions" },
  { icon: Clock,     title: "Attendance Tracking",  desc: "Real-time kiosk, PIN & RFID check-in/out" },
  { icon: Banknote,  title: "Automated Payroll",    desc: "Philippine-compliant payslips in minutes" },
  { icon: BarChart2, title: "Reports & Analytics",  desc: "Insights on workforce, costs & compliance" },
]

export function Login() {
  const navigate = useNavigate()
  const { login, user, isLoading } = useAuthStore()
  const [email,   setEmail]   = useState("")
  const [password,setPassword]= useState("")
  const [showPw,  setShowPw]  = useState(false)
  const [loading, setLoading] = useState(false)
  const [error,   setError]   = useState("")

  // Only redirect once session restoration is complete — prevents flash
  useEffect(() => {
    if (!isLoading && user) navigate("/dashboard", { replace: true })
  }, [isLoading, user, navigate])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!email || !password) { setError("Please enter your email and password."); return }
    setLoading(true); setError("")
    try {
      const u = await apiLogin(email.trim().toLowerCase(), password)
      login(u)
      navigate("/dashboard", { replace: true })
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Login failed")
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen flex">
      {/* Left hero */}
      <div
        className="hidden lg:flex lg:w-[52%] flex-col relative overflow-hidden"
        style={{ background: "linear-gradient(135deg, #450a0a 0%, #7f1d1d 40%, #991b1b 100%)" }}
      >
        <div style={{
          position: "absolute", inset: 0, opacity: 0.06,
          backgroundImage: "linear-gradient(rgba(255,255,255,0.5) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.5) 1px, transparent 1px)",
          backgroundSize: "40px 40px",
        }} />
        <div style={{ position: "absolute", top: -100, left: -100, width: 400, height: 400, borderRadius: "50%", background: "rgba(220,38,38,0.25)", filter: "blur(80px)" }} />
        <div style={{ position: "absolute", bottom: -80, right: -80, width: 350, height: 350, borderRadius: "50%", background: "rgba(185,28,28,0.20)", filter: "blur(80px)" }} />

        <div className="relative z-10 flex flex-col h-full p-12">
          <div className="flex items-center gap-3 mb-auto">
            <img src={brand.logoUrl} alt={brand.appName} style={{ width: 36, height: 36, objectFit: "contain" }} />
            <div>
              <p style={{ fontSize: 20, fontWeight: 800, color: "#fff", letterSpacing: "-0.03em", lineHeight: 1 }}>{brand.appName}</p>
              <p style={{ fontSize: 11, color: "rgba(255,255,255,0.5)", fontWeight: 500, marginTop: 2 }}>{brand.appTagline}</p>
            </div>
          </div>

          <div className="py-10">
            <motion.h1
              initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5 }}
              style={{ fontSize: 38, fontWeight: 900, color: "#fff", letterSpacing: "-0.04em", lineHeight: 1.15, marginBottom: 16 }}
            >
              Modern HR & Payroll<br />for the{" "}
              <span style={{ background: "linear-gradient(90deg, #FCA5A5, #FCD34D)", WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent" }}>
                Philippines.
              </span>
            </motion.h1>
            <motion.p
              initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5, delay: 0.1 }}
              style={{ fontSize: 15, color: "rgba(255,255,255,0.65)", lineHeight: 1.6, maxWidth: 380 }}
            >
              Everything your HR team needs — attendance, payroll, leaves, and reports — in one clean dashboard.
            </motion.p>
          </div>

          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ duration: 0.5, delay: 0.2 }} className="space-y-4 mb-10">
            {FEATURES.map((f, i) => (
              <motion.div key={f.title} initial={{ opacity: 0, x: -12 }} animate={{ opacity: 1, x: 0 }} transition={{ duration: 0.35, delay: 0.25 + i * 0.07 }} className="flex items-start gap-3">
                <div style={{ width: 36, height: 36, borderRadius: 10, background: "rgba(255,255,255,0.1)", border: "1px solid rgba(255,255,255,0.12)", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                  <f.icon style={{ width: 16, height: 16, color: "#FCA5A5" }} />
                </div>
                <div>
                  <p style={{ fontSize: 13.5, fontWeight: 600, color: "#fff", letterSpacing: "-0.01em" }}>{f.title}</p>
                  <p style={{ fontSize: 12, color: "rgba(255,255,255,0.5)", marginTop: 1 }}>{f.desc}</p>
                </div>
              </motion.div>
            ))}
          </motion.div>

          <p style={{ fontSize: 11.5, color: "rgba(255,255,255,0.3)" }}>{new Date().getFullYear()} {brand.appName} Enterprise HR Platform</p>
        </div>
      </div>

      {/* Right form */}
      <div className="flex-1 flex flex-col items-center justify-center px-6 py-12" style={{ background: "#F8FAFC" }}>
        <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.35 }} style={{ width: "100%", maxWidth: 400 }}>
          <div className="flex items-center gap-2.5 mb-8 lg:hidden">
            <img src={brand.logoUrl} alt={brand.appName} style={{ width: 32, height: 32, objectFit: "contain" }} />
            <p style={{ fontSize: 20, fontWeight: 800, color: "#0F172A", letterSpacing: "-0.03em" }}>{brand.appName}</p>
          </div>

          <div className="mb-8">
            <h2 style={{ fontSize: 26, fontWeight: 800, color: "#0F172A", letterSpacing: "-0.04em", marginBottom: 6 }}>Welcome back</h2>
            <p style={{ fontSize: 14, color: "#64748B" }}>Sign in to your {brand.appName} account</p>
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="form-label">Email address</label>
              <input type="email" value={email} onChange={e => setEmail(e.target.value)} placeholder="you@company.com" className="input-base" autoComplete="email" />
            </div>
            <div>
              <div className="flex items-center justify-between mb-1">
                <label className="form-label" style={{ marginBottom: 0 }}>Password</label>
                <button
                  type="button"
                  onClick={() => navigate("/forgot-password")}
                  style={{ fontSize: 12, color: '#64748B', background: 'none', border: 'none', cursor: 'pointer', fontWeight: 500 }}
                  onMouseEnter={e => ((e.currentTarget as HTMLElement).style.color = '#DC2626')}
                  onMouseLeave={e => ((e.currentTarget as HTMLElement).style.color = '#64748B')}
                >
                  Forgot password?
                </button>
              </div>
              <div className="relative">
                <input type={showPw ? "text" : "password"} value={password} onChange={e => setPassword(e.target.value)} placeholder="Enter password" className="input-base" style={{ paddingRight: 44 }} autoComplete="current-password" />
                <button type="button" onClick={() => setShowPw(v => !v)} style={{ position: "absolute", right: 12, top: "50%", transform: "translateY(-50%)", color: "#94A3B8", background: "none", border: "none", cursor: "pointer" }}>
                  {showPw ? <EyeOff style={{ width: 15, height: 15 }} /> : <Eye style={{ width: 15, height: 15 }} />}
                </button>
              </div>
            </div>

            <AnimatePresence>
              {error && (
                <motion.div initial={{ opacity: 0, y: -4 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} className="alert-danger" style={{ fontSize: 13 }}>
                  {error}
                </motion.div>
              )}
            </AnimatePresence>

            <button type="submit" disabled={loading} className="btn btn-primary w-full" style={{ height: 42, fontSize: 14.5, fontWeight: 600 }}>
              {loading ? <span className="spinner spinner-sm" style={{ borderColor: "rgba(255,255,255,0.3)", borderTopColor: "#fff" }} /> : <><LogIn style={{ width: 16, height: 16 }} />Sign In</>}
            </button>
          </form>

          <div className="mt-6 text-center">
            <button onClick={() => navigate("/kiosk")} className="inline-flex items-center gap-1.5 transition-colors" style={{ fontSize: 13, color: "#64748B", fontWeight: 500, background: "none", border: "none", cursor: "pointer" }} onMouseEnter={e => ((e.currentTarget as HTMLElement).style.color = "#DC2626")} onMouseLeave={e => ((e.currentTarget as HTMLElement).style.color = "#64748B")}>
              Open Employee Kiosk <ChevronRight style={{ width: 14, height: 14 }} />
            </button>
          </div>
        </motion.div>
      </div>
    </div>
  )
}
