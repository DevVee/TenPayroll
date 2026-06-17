// ─── Settings page — tab shell ────────────────────────────────────────────────
// Each tab lives in its own file under ./tabs/.
// Add new tabs here without touching any existing tab logic.
import { useState } from 'react'
import { Building2, Shield, Bell, Users, Layers } from 'lucide-react'
import { PageHeader } from '../../components/ui/PageHeader'
import { CompanyTab }     from './tabs/CompanyTab'
import { DepartmentsTab } from './tabs/DepartmentsTab'
import { PositionsTab }   from './tabs/PositionsTab'
import { DeductionsTab }  from './tabs/DeductionsTab'
import { PayrollTab }     from './tabs/PayrollTab'
import { ComponentsTab }  from './ComponentsTab'

const TABS = [
  {
    id:       'company',
    label:    'Company Info',
    icon:     Building2,
    subtitle: 'Business name, address, logo, and contact details',
  },
  {
    id:       'designations',
    label:    'Designations',
    icon:     Users,
    subtitle: 'Job titles and departments that structure your workforce',
  },
  {
    id:       'positions',
    label:    'Departments',
    icon:     Building2,
    subtitle: 'Organisational departments and their reporting structure',
  },
  {
    id:       'deductions',
    label:    'Deduction Rules',
    icon:     Shield,
    subtitle: 'SSS, PhilHealth, Pag-IBIG, and tax computation rules',
  },
  {
    id:       'payroll',
    label:    'Payroll Settings',
    icon:     Bell,
    subtitle: 'Pay frequency, cut-off dates, and pay-run defaults',
  },
  {
    id:       'components',
    label:    'Component Templates',
    icon:     Layers,
    subtitle: 'Reusable earnings and deduction components for payroll',
  },
]

export function Settings() {
  const [tab, setTab] = useState('company')

  const activeTab = TABS.find(t => t.id === tab)

  return (
    <div className="space-y-4">
      <PageHeader
        title="Settings"
        subtitle={activeTab?.subtitle}
      />

      {/* Tab bar */}
      <div className="tab-bar">
        {TABS.map(t => (
          <button
            key={t.id}
            onClick={() => setTab(t.id)}
            className={`tab-btn ${tab === t.id ? 'active' : ''}`}
          >
            <t.icon style={{ width: 13, height: 13 }} />
            {t.label}
          </button>
        ))}
      </div>

      {tab === 'company'      && <CompanyTab />}
      {tab === 'designations' && <DepartmentsTab />}
      {tab === 'positions'    && <PositionsTab />}
      {tab === 'deductions'   && <DeductionsTab />}
      {tab === 'payroll'      && <PayrollTab />}
      {tab === 'components'   && <ComponentsTab />}
    </div>
  )
}
