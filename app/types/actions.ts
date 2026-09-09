export type RecordAction = {
  label: string
  icon?: string
  to?: string
  target?: '_blank'
  disabled?: boolean
  description?: string
  action?: () => unknown | Promise<unknown>
  destructive?: boolean
  confirmation?: {
    message: string
    label?: string
    modal?: boolean
  }
}
