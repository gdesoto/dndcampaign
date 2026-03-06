export const useFormatBytes = () => {
  const formatBytes = (value: number) => {
    if (!value) return '0 B'
    const units = ['B', 'KB', 'MB', 'GB']
    let size = value
    let unitIndex = 0

    while (size >= 1024 && unitIndex < units.length - 1) {
      size /= 1024
      unitIndex += 1
    }

    return `${size.toFixed(size >= 10 ? 0 : 1)} ${units[unitIndex]}`
  }

  return { formatBytes }
}
