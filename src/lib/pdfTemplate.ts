import jsPDF from "jspdf"
import "jspdf-autotable"
import { toast } from "sonner"
import { formatDate } from "./utils"

const formatInr = (value: number) => new Intl.NumberFormat('en-IN').format(value)

export const formatQuantity = (name: string, quantity: number) => {
  const WEIGHT_ITEMS = ["Glass", "White Glass", "Colour Glass", "Atta", "Plastic", "Plastic Cover", "Iron"]
  return WEIGHT_ITEMS.includes(name) ? `${quantity} Kg` : `${quantity}`
}

export type PDFItem = { name: string, quantity: number, rate: number, total: number }

export type PDFBillData = {
  metadataLeft: string[]
  metadataRight: string[]
  items: PDFItem[]
  grandTotal: number
}

export type PDFDocumentData = {
  title: string
  subHeader: string
  bills: PDFBillData[]
  paymentSummary: {
    overallAmount: number
    advanceAmount?: number
    balanceAmount: number
    partialPaid: number
    status: string
    paymentHistory?: { date: string, amount: number, remarks?: string }[]
  }
  filename: string
}

const drawRupeeValue = (doc: jsPDF, amount: number, x: number, y: number, r: number, g: number, b: number) => {
  const amountStr = formatInr(amount || 0)
  const textWidth = doc.getTextWidth(amountStr)
  const rupeeWidth = 1.6
  const spacing = 0.4
  const rupeeX = x - textWidth - rupeeWidth - spacing
  
  const originalLineWidth = doc.getLineWidth()
  const originalDrawColor = doc.getDrawColor()
  
  doc.setLineWidth(0.22)
  doc.setDrawColor(r, g, b)
  
  // Top bar
  doc.line(rupeeX, y - 2.4, rupeeX + 1.8, y - 2.4)
  // Middle bar
  doc.line(rupeeX, y - 1.6, rupeeX + 1.4, y - 1.6)
  // Vertical stem
  doc.line(rupeeX + 0.4, y - 2.4, rupeeX + 0.4, y - 1.1)
  // Loop
  doc.line(rupeeX + 0.4, y - 2.4, rupeeX + 1.2, y - 2.0)
  doc.line(rupeeX + 1.2, y - 2.0, rupeeX + 0.4, y - 1.6)
  // Slash
  doc.line(rupeeX + 0.5, y - 1.6, rupeeX + 1.4, y)
  
  doc.setLineWidth(originalLineWidth)
  doc.setDrawColor(originalDrawColor)
  doc.text(amountStr, x, y, { align: "right" })
}

const drawStatusBadge = (doc: jsPDF, statusStr: string, xRight: number, yCenter: number) => {
  let textR = 180, textG = 100, textB = 0
  let bgR = 254, bgG = 243, bgB = 199 // amber
  let displayStr = statusStr

  if (statusStr === 'Completed' || statusStr === 'Completed Paid') {
    displayStr = 'Completed'
    textR = 21; textG = 128; textB = 61 // green
    bgR = 220; bgG = 252; bgB = 231
  } else if (statusStr === 'Partial Payment' || statusStr === 'Partial Paid') {
    displayStr = 'Partial Payment'
    textR = 194; textG = 65; textB = 12 // orange
    bgR = 255; bgG = 237; bgB = 213
  } else {
    displayStr = 'Pending'
    textR = 180; textG = 100; textB = 0 // amber
    bgR = 254; bgG = 243; bgB = 199
  }

  doc.setFont("helvetica", "bold")
  doc.setFontSize(8.5)
  const textWidth = doc.getTextWidth(displayStr)
  const padX = 3
  const badgeW = textWidth + padX * 2
  const badgeH = 4.2
  const badgeX = xRight - badgeW
  const badgeY = yCenter - badgeH / 2 - 0.2

  const oldFillColor = doc.getFillColor()
  const oldTextColor = doc.getTextColor()

  doc.setFillColor(bgR, bgG, bgB)
  doc.roundedRect(badgeX, badgeY, badgeW, badgeH, 1, 1, "F")
  
  doc.setTextColor(textR, textG, textB)
  doc.text(displayStr, badgeX + padX, yCenter + 0.9)

  doc.setFillColor(oldFillColor)
  doc.setTextColor(oldTextColor)
}

export const generateProfessionalPDF = async (
  data: PDFDocumentData, 
  action: 'download' | 'print' | 'blob'
): Promise<Blob | undefined> => {
  const toastId = toast.loading("Generating PDF...")
  try {
    const doc = new jsPDF()
    let y = 42

    const drawHeader = () => {
      doc.setFont("helvetica", "bold")
      doc.setFontSize(22)
      doc.setTextColor(30, 60, 90)
      doc.text("SIVA DURGA TRADERS", 15, 20)
      
      doc.setFontSize(8.5)
      doc.setTextColor(100, 110, 120)
      doc.text(data.subHeader, 15, 25)
      
      doc.setFontSize(10)
      doc.setFont("helvetica", "normal")
      doc.setTextColor(60, 70, 80)
      doc.text("G.Ravi Kumar(Chinni) | Ph.No: 9949835054", 15, 30)
      
      doc.setFont("helvetica", "bold")
      doc.setFontSize(16)
      doc.setTextColor(30, 60, 150)
      doc.text(data.title, 195, 20, { align: "right" })
      
      doc.setDrawColor(200, 205, 210)
      doc.setLineWidth(0.8)
      doc.line(15, 33, 195, 33)
    }

    drawHeader()

    data.bills.forEach((bill) => {
      const displayItems = bill.items.filter(item => item && item.quantity > 0 && item.total > 0)
      const tableHeight = 8 + (displayItems.length * 7)
      const metadataHeight = Math.max(bill.metadataLeft.length, bill.metadataRight.length) * 5 + 5
      const billHeight = metadataHeight + tableHeight + 10

      if (y + billHeight > 275) {
        doc.addPage()
        drawHeader()
        y = 42
      }

      // Draw Metadata
      doc.setFont("helvetica", "bold")
      doc.setFontSize(11)
      doc.setTextColor(30, 30, 30)
      doc.text(bill.metadataLeft[0] || '', 15, y)
      doc.text(bill.metadataRight[0] || '', 195, y, { align: "right" })

      doc.setFont("helvetica", "normal")
      doc.setFontSize(9)
      doc.setTextColor(100, 110, 120)
      
      for (let i = 1; i < bill.metadataLeft.length; i++) {
        doc.text(bill.metadataLeft[i] || '', 15, y + (i * 5))
      }
      for (let i = 1; i < bill.metadataRight.length; i++) {
        const text = bill.metadataRight[i] || ''
        if (text.startsWith("Date:")) {
          doc.text(text, 170, y + (i * 5))
        } else {
          doc.text(text, 195, y + (i * 5), { align: "right" })
        }
      }

      // Draw Table
      let tableY = y + Math.max(bill.metadataLeft.length, bill.metadataRight.length) * 5 + 5
      doc.setFillColor(65, 80, 100)
      doc.rect(15, tableY, 180, 8, "F")

      doc.setFont("helvetica", "bold")
      doc.setFontSize(9)
      doc.setTextColor(255, 255, 255)
      doc.text("No", 17, tableY + 5.5)
      doc.text("CATEGORY", 27, tableY + 5.5)
      doc.text("QUANTITY", 120, tableY + 5.5, { align: "right" })
      doc.text("RATE", 155, tableY + 5.5, { align: "right" })
      doc.text("AMOUNT", 193, tableY + 5.5, { align: "right" })

      // Draw Table Rows
      doc.setFont("helvetica", "normal")
      doc.setFontSize(9.5)
      doc.setTextColor(50, 50, 50)
      
      displayItems.forEach((item, i) => {
        const rowY = tableY + 8 + (i * 7)
        if (i % 2 === 1) {
          doc.setFillColor(248, 250, 252)
          doc.rect(15, rowY, 180, 7, "F")
        }
        
        doc.setDrawColor(230, 235, 240)
        doc.setLineWidth(0.3)
        doc.line(15, rowY + 7, 195, rowY + 7)

        doc.text(String(i + 1), 17, rowY + 5)
        doc.text(item.name, 27, rowY + 5)
        doc.text(formatQuantity(item.name, item.quantity), 120, rowY + 5, { align: "right" })
        doc.text(`Rs ${formatInr(item.rate || 0)}`, 155, rowY + 5, { align: "right" })
        doc.text(`Rs ${formatInr(item.total || 0)}`, 193, rowY + 5, { align: "right" })
      })

      // Vertical & Border lines
      const totalTableHeight = 8 + (displayItems.length * 7)
      doc.setDrawColor(210, 215, 220)
      doc.setLineWidth(0.3)
      doc.line(15, tableY, 15, tableY + totalTableHeight)
      doc.line(25, tableY, 25, tableY + totalTableHeight)
      doc.line(100, tableY, 100, tableY + totalTableHeight)
      doc.line(135, tableY, 135, tableY + totalTableHeight)
      doc.line(165, tableY, 165, tableY + totalTableHeight)
      doc.line(195, tableY, 195, tableY + totalTableHeight)
      doc.line(15, tableY, 195, tableY) 
      doc.line(15, tableY + totalTableHeight, 195, tableY + totalTableHeight) 

      // Grand Total
      const grandTotalY = tableY + totalTableHeight + 6
      doc.setFont("helvetica", "bold")
      doc.setFontSize(11)
      doc.setTextColor(30, 30, 30)
      doc.text("GRAND TOTAL:", 155, grandTotalY, { align: "right" })
      doc.text(`Rs ${formatInr(bill.grandTotal || 0)}`, 193, grandTotalY, { align: "right" })

      y = grandTotalY + 10
    })

    // Payment Summary
    const isPartial = data.paymentSummary.status === 'Partial Payment' || data.paymentSummary.status === 'Partial Paid'
    const paymentHistory = data.paymentSummary.paymentHistory || []

    if (!isPartial || paymentHistory.length === 0) {
      const summaryHeight = 26.5
      if (y + summaryHeight > 280) {
        doc.addPage()
        drawHeader()
        y = 42
      }

      const summaryY = y + 5
      doc.setDrawColor(210, 220, 235)
      doc.setFillColor(255, 255, 255)
      doc.setLineWidth(0.4)
      doc.roundedRect(45, summaryY, 120, summaryHeight, 4, 4, "FD")

      doc.setFillColor(245, 247, 250)
      doc.rect(45, summaryY, 120, 7, "FD")
      doc.setFont("helvetica", "bold")
      doc.setFontSize(10)
      doc.setTextColor(40, 50, 70)
      doc.text("PAYMENT SUMMARY", 105, summaryY + 5, { align: "center" })

      doc.setDrawColor(225, 230, 238)
      doc.setLineWidth(0.3)

      let curY = summaryY + 7

      // Row 1: Overall Amount
      doc.setFont("helvetica", "bold")
      doc.setFontSize(9.5)
      doc.setTextColor(50, 50, 50)
      doc.text("Overall Amount", 50, curY + 4.5)
      doc.text(`Rs ${formatInr(data.paymentSummary.overallAmount || 0)}`, 160, curY + 4.5, { align: "right" })
      doc.line(45, curY + 6.5, 165, curY + 6.5)

      // Row 2: Balance Amount
      curY += 6.5
      doc.setTextColor(180, 0, 0)
      doc.text("Balance Amount", 50, curY + 4.5)
      doc.text(`Rs ${formatInr(data.paymentSummary.balanceAmount || 0)}`, 160, curY + 4.5, { align: "right" })
      doc.line(45, curY + 6.5, 165, curY + 6.5)

      // Row 3: Payment Status
      curY += 6.5
      doc.setFont("helvetica", "bold")
      doc.setTextColor(50, 50, 50)
      doc.text("Payment Status", 50, curY + 4.5)
      drawStatusBadge(doc, data.paymentSummary.status, 160, curY + 3.25)
      
      y = summaryY + summaryHeight
    } else {
      const isMultiple = paymentHistory.length > 1

      if (!isMultiple) {
        // Case A: Single Partial Payment (5 rows)
        const summaryHeight = 39.5
        if (y + summaryHeight > 280) {
          doc.addPage()
          drawHeader()
          y = 42
        }

        const summaryY = y + 5
        doc.setDrawColor(210, 220, 235)
        doc.setFillColor(255, 255, 255)
        doc.setLineWidth(0.4)
        doc.roundedRect(45, summaryY, 120, summaryHeight, 4, 4, "FD")

        doc.setFillColor(245, 247, 250)
        doc.rect(45, summaryY, 120, 7, "FD")
        doc.setFont("helvetica", "bold")
        doc.setFontSize(10)
        doc.setTextColor(40, 50, 70)
        doc.text("PAYMENT SUMMARY", 105, summaryY + 5, { align: "center" })

        let curY = summaryY + 7

        // 1. Status
        doc.setFont("helvetica", "bold")
        doc.setFontSize(9.5)
        doc.setTextColor(50, 50, 50)
        doc.text("Status", 50, curY + 4.5)
        drawStatusBadge(doc, "Partial Payment", 160, curY + 3.25)

        doc.setDrawColor(225, 230, 238)
        doc.setLineWidth(0.3)
        doc.line(45, curY + 6.5, 165, curY + 6.5)

        // 2. Payment Date
        curY += 6.5
        doc.setFont("helvetica", "bold")
        doc.setTextColor(50, 50, 50)
        doc.text("Payment Date", 50, curY + 4.5)
        doc.setFont("helvetica", "normal")
        doc.setTextColor(80, 80, 80)
        const singleDate = paymentHistory.length > 0 ? paymentHistory[0].date : (data.paymentSummary as any).paymentDate
        doc.text(formatDate(singleDate), 160, curY + 4.5, { align: "right" })

        doc.setDrawColor(225, 230, 238)
        doc.setLineWidth(0.3)
        doc.line(45, curY + 6.5, 165, curY + 6.5)

        // 3. Overall Bill Amount
        curY += 6.5
        doc.setFont("helvetica", "bold")
        doc.setTextColor(50, 50, 50)
        doc.text("Overall Bill Amount", 50, curY + 4.5)
        drawRupeeValue(doc, data.paymentSummary.overallAmount, 160, curY + 4.5, 50, 50, 50)

        doc.setDrawColor(225, 230, 238)
        doc.setLineWidth(0.3)
        doc.line(45, curY + 6.5, 165, curY + 6.5)

        // 4. Partial Amount Paid
        curY += 6.5
        doc.setFont("helvetica", "bold")
        doc.setTextColor(50, 50, 50)
        doc.text("Partial Amount Paid", 50, curY + 4.5)
        const singleAmount = paymentHistory.length > 0 ? paymentHistory[0].amount : data.paymentSummary.partialPaid
        drawRupeeValue(doc, singleAmount, 160, curY + 4.5, 21, 128, 61)

        doc.setDrawColor(225, 230, 238)
        doc.setLineWidth(0.3)
        doc.line(45, curY + 6.5, 165, curY + 6.5)

        // 5. Balance Amount
        curY += 6.5
        doc.setFont("helvetica", "bold")
        doc.setTextColor(180, 0, 0)
        doc.text("Balance Amount", 50, curY + 4.5)
        drawRupeeValue(doc, data.paymentSummary.balanceAmount, 160, curY + 4.5, 180, 0, 0)

        y = summaryY + summaryHeight
      } else {
        // Case B: Multiple Partial Payments (5 + N rows)
        const N = paymentHistory.length
        const summaryHeight = 7 + ((5 + N) * 6.5)

        if (y + summaryHeight > 280) {
          doc.addPage()
          drawHeader()
          y = 42
        }

        const summaryY = y + 5
        doc.setDrawColor(210, 220, 235)
        doc.setFillColor(255, 255, 255)
        doc.setLineWidth(0.4)
        doc.roundedRect(45, summaryY, 120, summaryHeight, 4, 4, "FD")

        doc.setFillColor(245, 247, 250)
        doc.rect(45, summaryY, 120, 7, "FD")
        doc.setFont("helvetica", "bold")
        doc.setFontSize(10)
        doc.setTextColor(40, 50, 70)
        doc.text("PAYMENT SUMMARY", 105, summaryY + 5, { align: "center" })

        let curY = summaryY + 7

        // 1. Status
        doc.setFont("helvetica", "bold")
        doc.setFontSize(9.5)
        doc.setTextColor(50, 50, 50)
        doc.text("Status", 50, curY + 4.5)
        drawStatusBadge(doc, "Partial Payment", 160, curY + 3.25)

        doc.setDrawColor(225, 230, 238)
        doc.setLineWidth(0.3)
        doc.line(45, curY + 6.5, 165, curY + 6.5)

        // 2. Payment History Section Title
        curY += 6.5
        doc.setFont("helvetica", "bold")
        doc.setFontSize(9.5)
        doc.setTextColor(40, 50, 70)
        doc.text("Payment History", 50, curY + 4.5)

        doc.setDrawColor(225, 230, 238)
        doc.setLineWidth(0.3)
        doc.line(45, curY + 6.5, 165, curY + 6.5)

        // 3. Payment History Headers
        curY += 6.5
        doc.setFont("helvetica", "bold")
        doc.setFontSize(8.5)
        doc.setTextColor(100, 110, 120)
        doc.text("Payment Date", 50, curY + 4.5)
        doc.text("Amount Paid", 160, curY + 4.5, { align: "right" })

        doc.setDrawColor(225, 230, 238)
        doc.setLineWidth(0.3)
        doc.line(45, curY + 6.5, 165, curY + 6.5)

        // 4. Payment History Rows (N rows)
        doc.setFont("helvetica", "normal")
        doc.setFontSize(9)
        doc.setTextColor(80, 80, 80)
        paymentHistory.forEach((record) => {
          curY += 6.5
          const formattedDate = formatDate(record.date)
          doc.text(formattedDate, 50, curY + 4.5)
          drawRupeeValue(doc, record.amount, 160, curY + 4.5, 21, 128, 61)
          
          doc.setDrawColor(225, 230, 238)
          doc.setLineWidth(0.3)
          doc.line(45, curY + 6.5, 165, curY + 6.5)
        })

        // 5. Overall Bill Amount
        curY += 6.5
        doc.setFont("helvetica", "bold")
        doc.setFontSize(9.5)
        doc.setTextColor(50, 50, 50)
        doc.text("Overall Bill Amount", 50, curY + 4.5)
        drawRupeeValue(doc, data.paymentSummary.overallAmount, 160, curY + 4.5, 50, 50, 50)

        doc.setDrawColor(225, 230, 238)
        doc.setLineWidth(0.3)
        doc.line(45, curY + 6.5, 165, curY + 6.5)

        // 6. Balance Amount
        curY += 6.5
        doc.setFont("helvetica", "bold")
        doc.setFontSize(9.5)
        doc.setTextColor(180, 0, 0)
        doc.text("Balance Amount", 50, curY + 4.5)
        drawRupeeValue(doc, data.paymentSummary.balanceAmount, 160, curY + 4.5, 180, 0, 0)

        y = summaryY + summaryHeight
      }
    }

    toast.dismiss(toastId)
    if (action === 'download') {
      doc.save(data.filename)
    } else if (action === 'print') {
      doc.autoPrint()
      window.open(doc.output('bloburl'), '_blank')
    } else if (action === 'blob') {
      return doc.output('blob')
    }
  } catch (error) {
    console.error("Failed to generate PDF:", error)
    toast.dismiss(toastId)
    toast.error("Error generating document")
  }
}

export type PDFTableDocumentData = {
  title: string
  subHeader: string
  filename: string
  orientation?: "portrait" | "landscape"
  metadata?: string[] // Optional metadata array to print below header
  tableHead: string[][]
  tableBody: any[][]
}

export const generateTablePDF = async (
  data: PDFTableDocumentData, 
  action: 'download' | 'print'
): Promise<void> => {
  const toastId = toast.loading("Generating PDF...")
  try {
    const doc = new jsPDF({ orientation: data.orientation || 'portrait' })
    
    const drawHeader = () => {
      doc.setFont("helvetica", "bold")
      doc.setFontSize(22)
      doc.setTextColor(30, 60, 90)
      doc.text("SIVA DURGA TRADERS", 15, 20)
      
      doc.setFontSize(8.5)
      doc.setTextColor(100, 110, 120)
      doc.text(data.subHeader, 15, 25)
      
      doc.setFontSize(10)
      doc.setFont("helvetica", "normal")
      doc.setTextColor(60, 70, 80)
      doc.text("G.Ravi Kumar(Chinni) | Ph.No: 9949835054", 15, 30)
      
      doc.setFont("helvetica", "bold")
      doc.setFontSize(16)
      doc.setTextColor(30, 60, 150)
      const titleX = data.orientation === 'landscape' ? 282 : 195
      doc.text(data.title, titleX, 20, { align: "right" })
      
      doc.setDrawColor(200, 205, 210)
      doc.setLineWidth(0.8)
      doc.line(15, 33, titleX, 33)
    }

    drawHeader()

    let y = 42

    if (data.metadata && data.metadata.length > 0) {
      doc.setFont("helvetica", "bold")
      doc.setFontSize(11)
      doc.setTextColor(30, 30, 30)
      doc.text(data.metadata[0], 15, y)

      doc.setFont("helvetica", "normal")
      doc.setFontSize(9)
      doc.setTextColor(100, 110, 120)
      for (let i = 1; i < data.metadata.length; i++) {
        doc.text(data.metadata[i], 15, y + (i * 5))
      }
      y += (data.metadata.length * 5) + 5
    }

    // @ts-ignore
    doc.autoTable({
      head: data.tableHead,
      body: data.tableBody,
      startY: y,
      theme: 'plain',
      headStyles: {
        fillColor: [65, 80, 100],
        textColor: [255, 255, 255],
        fontStyle: 'bold',
        fontSize: 9
      },
      bodyStyles: {
        fontSize: 9.5,
        textColor: [50, 50, 50]
      },
      alternateRowStyles: {
        fillColor: [248, 250, 252]
      },
      tableLineColor: [210, 215, 220],
      tableLineWidth: 0.3,
      styles: {
        lineColor: [230, 235, 240],
        lineWidth: 0.3
      },
      margin: { left: 15, right: 15 }
    })

    toast.dismiss(toastId)
    if (action === 'download') {
      doc.save(data.filename)
    } else if (action === 'print') {
      doc.autoPrint()
      window.open(doc.output('bloburl'), '_blank')
    }
  } catch (error) {
    console.error("Failed to generate Table PDF:", error)
    toast.dismiss(toastId)
    toast.error("Error generating document")
  }
}
