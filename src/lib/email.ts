// ─── Email service — frontend wrapper for the send-email Edge Function ─────────
// All calls are fire-and-forget: email failures NEVER block user actions.
// The Edge Function holds the Resend API key server-side.
//
// Setup: supabase functions deploy send-email
//        supabase secrets set RESEND_API_KEY=<your-resend-api-key>
// ─────────────────────────────────────────────────────────────────────────────
import { supabase } from './supabase'
import type { LeaveRequest, OvertimeRequest, PayrollPeriod } from '../types'
import { ROLE_LABELS } from '../config/nav'
import type { UserRole } from '../types'

// ── Base styles shared across all email templates ─────────────────────────────
const BASE_CSS = `
  body { font-family: -apple-system, BlinkMacSystemFont, 'Inter', 'Segoe UI', sans-serif;
         background: #F4F5F7; margin: 0; padding: 32px 16px; color: #111827; }
  .wrap { max-width: 560px; margin: 0 auto; }
  .header { background: #0D0E14; border-radius: 12px 12px 0 0; padding: 20px 28px;
            display: flex; align-items: center; gap: 10px; }
  .logo { width: 28px; height: 28px; background: #DC2626; border-radius: 7px;
          display: inline-flex; align-items: center; justify-content: center;
          font-size: 14px; color: white; font-weight: 800; }
  .brand { font-size: 15px; font-weight: 800; color: #F1F5F9; letter-spacing: -0.02em; }
  .body { background: #fff; padding: 28px; border: 1px solid #E5E7EB;
          border-top: none; border-radius: 0 0 12px 12px; }
  .title { font-size: 18px; font-weight: 800; color: #111827; letter-spacing: -0.03em; margin: 0 0 8px; }
  .sub   { font-size: 13px; color: #6B7280; margin: 0 0 20px; line-height: 1.6; }
  .kv    { background: #F9FAFB; border: 1px solid #E5E7EB; border-radius: 8px;
           padding: 14px 16px; margin: 16px 0; }
  .kv-row { display: flex; justify-content: space-between; padding: 4px 0;
            border-bottom: 1px solid #F3F4F6; font-size: 12.5px; }
  .kv-row:last-child { border-bottom: none; }
  .kv-label { color: #6B7280; }
  .kv-value { font-weight: 600; color: #111827; }
  .badge-green  { display: inline-block; background: #ECFDF5; color: #059669; border: 1px solid #A7F3D0;
                  padding: 3px 10px; border-radius: 999px; font-size: 12px; font-weight: 600; }
  .badge-red    { display: inline-block; background: #FEF2F2; color: #DC2626; border: 1px solid #FECACA;
                  padding: 3px 10px; border-radius: 999px; font-size: 12px; font-weight: 600; }
  .badge-blue   { display: inline-block; background: #EFF6FF; color: #1D4ED8; border: 1px solid #BFDBFE;
                  padding: 3px 10px; border-radius: 999px; font-size: 12px; font-weight: 600; }
  .btn  { display: inline-block; background: #DC2626; color: white; text-decoration: none;
          padding: 10px 20px; border-radius: 8px; font-size: 13px; font-weight: 600; margin: 16px 0 0; }
  .footer { font-size: 11px; color: #9CA3AF; text-align: center; margin-top: 16px; }
`

function wrap(body: string) {
  return `<!DOCTYPE html><html><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<style>${BASE_CSS}</style></head><body>
<div class="wrap">
  <div class="header">
    <span class="logo">#</span>
    <span class="brand">TenPayroll</span>
  </div>
  <div class="body">${body}</div>
</div>
<p class="footer">This is an automated notification from TenPayroll · Ten Foundation Philippines Inc.</p>
</body></html>`
}

// ── Core send function ────────────────────────────────────────────────────────
async function sendEmail(to: string, subject: string, html: string, type: string): Promise<void> {
  if (!to) return
  try {
    const { error } = await supabase.functions.invoke('send-email', {
      body: { to, subject, html, type },
    })
    if (error) {
      console.warn(`[email] ${type} → ${to} failed:`, error.message)
    }
  } catch (err) {
    // Never throw — email is non-blocking
    console.warn(`[email] ${type} → ${to} exception:`, err)
  }
}

// ── Template: Leave approved / rejected ───────────────────────────────────────
export async function emailLeaveDecision(
  leave: LeaveRequest,
  status: 'approved' | 'rejected',
  toEmail: string,
  reviewerName?: string,
  rejectionReason?: string,
): Promise<void> {
  const approved = status === 'approved'
  const html = wrap(`
    <p class="title">${approved ? '✅ Leave Request Approved' : '❌ Leave Request Declined'}</p>
    <p class="sub">Hi ${leave.employeeName}, your ${leave.leaveType} leave request has been <strong>${status}</strong>.</p>
    <div class="kv">
      <div class="kv-row"><span class="kv-label">Leave Type</span><span class="kv-value" style="text-transform:capitalize">${leave.leaveType}</span></div>
      <div class="kv-row"><span class="kv-label">Duration</span><span class="kv-value">${leave.startDate} – ${leave.endDate} (${leave.days} day${leave.days !== 1 ? 's' : ''})</span></div>
      <div class="kv-row"><span class="kv-label">Status</span><span class="${approved ? 'badge-green' : 'badge-red'}">${approved ? 'Approved' : 'Declined'}</span></div>
      ${reviewerName ? `<div class="kv-row"><span class="kv-label">Reviewed by</span><span class="kv-value">${reviewerName}</span></div>` : ''}
      ${!approved && rejectionReason ? `<div class="kv-row"><span class="kv-label">Reason</span><span class="kv-value">${rejectionReason}</span></div>` : ''}
    </div>
    ${!approved ? '<p style="font-size:13px;color:#6B7280">Please coordinate with your manager if you need to re-file your leave request.</p>' : ''}
  `)
  await sendEmail(toEmail, `Leave Request ${approved ? 'Approved' : 'Declined'} — ${leave.leaveType}`, html, 'leave')
}

// ── Template: Overtime approved / rejected ────────────────────────────────────
export async function emailOTDecision(
  ot: OvertimeRequest,
  status: 'approved' | 'rejected',
  toEmail: string,
  reviewerName?: string,
): Promise<void> {
  const approved = status === 'approved'
  const html = wrap(`
    <p class="title">${approved ? '✅ Overtime Request Approved' : '❌ Overtime Request Declined'}</p>
    <p class="sub">Hi ${ot.employeeName}, your overtime request has been <strong>${status}</strong>.</p>
    <div class="kv">
      <div class="kv-row"><span class="kv-label">Date</span><span class="kv-value">${ot.date}</span></div>
      <div class="kv-row"><span class="kv-label">Hours</span><span class="kv-value">${ot.hoursRequested}h</span></div>
      <div class="kv-row"><span class="kv-label">Type</span><span class="kv-value" style="text-transform:capitalize">${ot.overtimeType ?? 'Regular'}</span></div>
      <div class="kv-row"><span class="kv-label">Status</span><span class="${approved ? 'badge-green' : 'badge-red'}">${approved ? 'Approved' : 'Declined'}</span></div>
      ${reviewerName ? `<div class="kv-row"><span class="kv-label">Reviewed by</span><span class="kv-value">${reviewerName}</span></div>` : ''}
    </div>
  `)
  await sendEmail(toEmail, `Overtime Request ${approved ? 'Approved' : 'Declined'}`, html, 'ot')
}

// ── Template: Payslip available ───────────────────────────────────────────────
export async function emailPayslipReady(
  employee: { fullName: string; email: string },
  period: PayrollPeriod,
  netPay: number,
): Promise<void> {
  if (!employee.email) return
  const html = wrap(`
    <p class="title">💰 Your Payslip is Ready</p>
    <p class="sub">Hi ${employee.fullName}, your payslip for <strong>${period.periodNo}</strong> has been processed and is now available in TenPayroll.</p>
    <div class="kv">
      <div class="kv-row"><span class="kv-label">Pay Period</span><span class="kv-value">${period.startDate} – ${period.endDate}</span></div>
      <div class="kv-row"><span class="kv-label">Pay Date</span><span class="kv-value">${period.payDate}</span></div>
      <div class="kv-row"><span class="kv-label">Net Pay</span><span class="kv-value" style="color:#DC2626;font-size:16px">₱${netPay.toLocaleString('en-PH', { minimumFractionDigits: 2 })}</span></div>
    </div>
    <p style="font-size:13px;color:#6B7280">Log in to TenPayroll to view and download your full payslip.</p>
  `)
  await sendEmail(employee.email, `Payslip Ready — ${period.periodNo}`, html, 'payslip')
}

// ── Template: Welcome new user ────────────────────────────────────────────────
export async function emailWelcome(
  name: string,
  email: string,
  tempPassword: string,
  role: UserRole,
): Promise<void> {
  const roleLabel = ROLE_LABELS[role] ?? role
  const html = wrap(`
    <p class="title">👋 Welcome to TenPayroll</p>
    <p class="sub">Hi ${name}, your TenPayroll account has been created. Here are your login credentials:</p>
    <div class="kv">
      <div class="kv-row"><span class="kv-label">Email</span><span class="kv-value">${email}</span></div>
      <div class="kv-row"><span class="kv-label">Temporary Password</span><span class="kv-value" style="font-family:monospace;background:#F3F4F6;padding:2px 6px;border-radius:4px">${tempPassword}</span></div>
      <div class="kv-row"><span class="kv-label">Role</span><span class="badge-blue">${roleLabel}</span></div>
    </div>
    <p style="font-size:13px;color:#DC2626;font-weight:600">Please change your password after your first login.</p>
    <p style="font-size:13px;color:#6B7280">Use the "Forgot Password" link if you need to reset it at any time.</p>
  `)
  await sendEmail(email, 'Welcome to TenPayroll — Your Account is Ready', html, 'welcome')
}
