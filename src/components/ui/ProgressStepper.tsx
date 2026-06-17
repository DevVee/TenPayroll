import { Check } from 'lucide-react'

interface Step {
  label: string
  description?: string
}

interface Props {
  steps: Step[]
  currentStep: number  // 0-indexed
  orientation?: 'horizontal' | 'vertical'
}

export function ProgressStepper({ steps, currentStep, orientation = 'horizontal' }: Props) {
  if (orientation === 'vertical') {
    return (
      <div className="flex flex-col" style={{ gap: 0 }}>
        {steps.map((step, i) => {
          const isDone    = i < currentStep
          const isActive  = i === currentStep
          const isFuture  = i > currentStep
          const isLast    = i === steps.length - 1

          return (
            <div key={i} className="flex gap-3" style={{ minHeight: isLast ? 40 : 56 }}>
              {/* Line + circle column */}
              <div className="flex flex-col items-center" style={{ width: 28, flexShrink: 0 }}>
                {/* Circle */}
                <div
                  style={{
                    width: 28,
                    height: 28,
                    borderRadius: '50%',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    flexShrink: 0,
                    fontSize: 11,
                    fontWeight: 700,
                    transition: 'all 0.2s',
                    ...(isDone ? {
                      background: '#4F46E5',
                      border: '2px solid #4F46E5',
                      color: 'white',
                    } : isActive ? {
                      background: '#4F46E5',
                      border: '2px solid #4F46E5',
                      color: 'white',
                      boxShadow: '0 0 0 3px rgba(79,70,229,0.15)',
                    } : {
                      background: 'white',
                      border: '2px solid #E2E8F0',
                      color: '#94A3B8',
                    }),
                  }}
                >
                  {isDone
                    ? <Check style={{ width: 13, height: 13 }} />
                    : <span>{i + 1}</span>
                  }
                </div>

                {/* Connector line */}
                {!isLast && (
                  <div
                    style={{
                      flex: 1,
                      width: 2,
                      marginTop: 4,
                      background: isDone ? '#4F46E5' : '#E2E8F0',
                      borderRadius: 1,
                      transition: 'background 0.2s',
                      minHeight: 24,
                    }}
                  />
                )}
              </div>

              {/* Label column */}
              <div style={{ paddingTop: 4, paddingBottom: isLast ? 0 : 20 }}>
                <p
                  style={{
                    fontSize: 13,
                    fontWeight: isActive ? 600 : 500,
                    color: isFuture ? '#94A3B8' : '#0F172A',
                    letterSpacing: '-0.01em',
                    lineHeight: 1,
                  }}
                >
                  {step.label}
                </p>
                {step.description && (
                  <p
                    style={{
                      fontSize: 11,
                      color: '#94A3B8',
                      marginTop: 3,
                    }}
                  >
                    {step.description}
                  </p>
                )}
              </div>
            </div>
          )
        })}
      </div>
    )
  }

  // ── Horizontal ──
  return (
    <div className="flex items-center gap-0">
      {steps.map((step, i) => {
        const isDone   = i < currentStep
        const isActive = i === currentStep
        const isFuture = i > currentStep
        const isLast   = i === steps.length - 1

        return (
          <div key={i} className="flex items-center" style={{ flex: isLast ? 'none' : 1 }}>
            <div className="flex flex-col items-center gap-1.5">
              <div
                style={{
                  width: 26,
                  height: 26,
                  borderRadius: '50%',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  flexShrink: 0,
                  fontSize: 11,
                  fontWeight: 700,
                  transition: 'all 0.2s',
                  ...(isDone ? {
                    background: '#4F46E5',
                    border: '2px solid #4F46E5',
                    color: 'white',
                  } : isActive ? {
                    background: '#4F46E5',
                    border: '2px solid #4F46E5',
                    color: 'white',
                    boxShadow: '0 0 0 3px rgba(79,70,229,0.15)',
                  } : {
                    background: 'white',
                    border: '2px solid #E2E8F0',
                    color: '#94A3B8',
                  }),
                }}
              >
                {isDone
                  ? <Check style={{ width: 12, height: 12 }} />
                  : <span>{i + 1}</span>
                }
              </div>
              <span
                style={{
                  fontSize: 11,
                  fontWeight: isActive ? 600 : 500,
                  color: isFuture ? '#94A3B8' : '#0F172A',
                  whiteSpace: 'nowrap',
                  letterSpacing: '-0.01em',
                }}
              >
                {step.label}
              </span>
            </div>

            {/* Connector */}
            {!isLast && (
              <div
                style={{
                  flex: 1,
                  height: 2,
                  margin: '-14px 4px 0',
                  background: isDone ? '#4F46E5' : '#E2E8F0',
                  borderRadius: 1,
                  transition: 'background 0.2s',
                  minWidth: 16,
                }}
              />
            )}
          </div>
        )
      })}
    </div>
  )
}
