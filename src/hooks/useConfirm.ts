import { useUIStore } from '../store/uiStore'

interface ConfirmOptions {
  title: string
  description?: string
  confirmLabel?: string
  cancelLabel?: string
  variant?: 'default' | 'destructive'
}

export function useConfirm() {
  const { openConfirm, closeConfirm } = useUIStore()

  const confirm = (opts: ConfirmOptions): Promise<boolean> => {
    return new Promise((resolve) => {
      openConfirm({
        ...opts,
        resolve: (value: boolean) => {
          closeConfirm()
          resolve(value)
        },
      })
    })
  }

  return { confirm }
}
