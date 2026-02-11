export const getFirstNameTerm = (name: string) => {
  const parts = name.trim().split(/\s+/).filter(Boolean)
  if (!parts.length) return ''
  if (parts[0]?.toLowerCase() === 'the') {
    return parts[1] || ''
  }
  return parts[0] || ''
}
