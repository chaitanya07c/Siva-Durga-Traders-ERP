import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

export function formatDate(dateVal: string | Date | null | undefined): string {
  if (!dateVal) return "-"
  try {
    const dateObj = typeof dateVal === 'string' ? new Date(dateVal) : dateVal
    if (isNaN(dateObj.getTime())) {
      // Fallback: if browser fails to parse, split YYYY-MM-DD
      const str = String(dateVal)
      const onlyDate = str.includes("T") ? str.split("T")[0] : str
      const parts = onlyDate.split("-")
      if (parts.length === 3) {
        return `${parts[2]}/${parts[1]}/${parts[0]}`
      }
      return str
    }
    const day = String(dateObj.getDate()).padStart(2, '0')
    const month = String(dateObj.getMonth() + 1).padStart(2, '0')
    const year = dateObj.getFullYear()
    return `${day}/${month}/${year}`
  } catch (e) {
    return String(dateVal)
  }
}

export function formatFilenameDate(dateVal: string | Date | null | undefined): string {
  if (!dateVal) {
    const d = new Date()
    const day = String(d.getDate()).padStart(2, '0')
    const month = String(d.getMonth() + 1).padStart(2, '0')
    const year = d.getFullYear()
    return `${day}-${month}-${year}`
  }
  const formatted = formatDate(dateVal)
  if (formatted === "-") {
    const d = new Date()
    const day = String(d.getDate()).padStart(2, '0')
    const month = String(d.getMonth() + 1).padStart(2, '0')
    const year = d.getFullYear()
    return `${day}-${month}-${year}`
  }
  return formatted.replace(/\//g, "-")
}
