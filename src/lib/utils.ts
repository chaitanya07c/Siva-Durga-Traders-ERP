import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

/**
 * Returns a local date string "YYYY-MM-DD" for a Date object without UTC timezone conversion shifts.
 */
export function toLocalDateString(dateVal: Date = new Date()): string {
  const year = dateVal.getFullYear()
  const month = String(dateVal.getMonth() + 1).padStart(2, '0')
  const day = String(dateVal.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}

/**
 * Returns "YYYY-MM-01" as start of month string for a given Date object.
 */
export function getStartOfMonthString(dateVal: Date = new Date()): string {
  const year = dateVal.getFullYear()
  const month = String(dateVal.getMonth() + 1).padStart(2, '0')
  return `${year}-${month}-01`
}

/**
 * Returns "YYYY-MM-DD" as end of month string for a given Date object.
 */
export function getEndOfMonthString(dateVal: Date = new Date()): string {
  const year = dateVal.getFullYear()
  const month = dateVal.getMonth()
  const daysInMonth = new Date(year, month + 1, 0).getDate()
  const m = String(month + 1).padStart(2, '0')
  const d = String(daysInMonth).padStart(2, '0')
  return `${year}-${m}-${d}`
}

/**
 * Calculates milliseconds remaining until the next local midnight (12:00:00 AM).
 */
export function getMsUntilNextMidnight(now: Date = new Date()): number {
  const nextMidnight = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1, 0, 0, 0, 0)
  return Math.max(100, nextMidnight.getTime() - now.getTime())
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

/**
 * Formats a raw string into standard Indian Vehicle Registration format: "AP 27 TX 3987"
 * Uppercases all letters and inserts spaces after State (2 letters), RTO (2 digits), and Series (1-2 letters).
 */
export function formatVehicleNumber(rawInput: string): string {
  if (!rawInput) return ""
  
  // Convert to uppercase and strip invalid characters except alphanumeric
  const clean = rawInput.toUpperCase().replace(/[^A-Z0-9]/g, "")
  if (!clean) return ""

  // State code: first 2 letters
  let state = ""
  let rest = clean

  const stateMatch = rest.match(/^[A-Z]{1,2}/)
  if (stateMatch) {
    state = stateMatch[0]
    rest = rest.slice(state.length)
  } else {
    return clean
  }

  if (rest.length === 0) return state

  // RTO code: next 2 digits
  let rto = ""
  const rtoMatch = rest.match(/^[0-9]{1,2}/)
  if (rtoMatch) {
    rto = rtoMatch[0]
    rest = rest.slice(rto.length)
  } else {
    return `${state} ${rest}`
  }

  if (rest.length === 0) return `${state} ${rto}`

  // Series: next 1 or 2 letters
  let series = ""
  const seriesMatch = rest.match(/^[A-Z]{1,2}/)
  if (seriesMatch) {
    series = seriesMatch[0]
    rest = rest.slice(series.length)
  } else {
    return `${state} ${rto} ${rest}`
  }

  if (rest.length === 0) return `${state} ${rto} ${series}`

  // Number: next 4 digits
  let num = ""
  const numMatch = rest.match(/^[0-9]{1,4}/)
  if (numMatch) {
    num = numMatch[0]
    rest = rest.slice(num.length)
  } else {
    return `${state} ${rto} ${series} ${rest}`
  }

  return `${state} ${rto} ${series} ${num}`.trim()
}

/**
 * Validates if a vehicle number matches the standard Indian vehicle registration format: "AP 27 TX 3987"
 */
export function isValidVehicleNumber(vehicleNumber: string): boolean {
  if (!vehicleNumber || !vehicleNumber.trim()) return true // Optional if empty
  const formatted = formatVehicleNumber(vehicleNumber)
  const pattern = /^[A-Z]{2}\s[0-9]{2}\s[A-Z]{1,2}\s[0-9]{4}$/
  return pattern.test(formatted)
}
