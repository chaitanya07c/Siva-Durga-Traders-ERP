import jsPDF from "jspdf"
import "jspdf-autotable"
import { toast } from "sonner"

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
    balanceAmount: number
    partialPaid: number
    status: string
  }
  filename: string
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
    const summaryHeight = 31
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

    // Row 1
    doc.setFont("helvetica", "bold")
    doc.setFontSize(9.5)
    doc.setTextColor(50, 50, 50)
    doc.text("Overall Amount", 50, summaryY + 12.5)
    doc.text(`Rs ${formatInr(data.paymentSummary.overallAmount || 0)}`, 160, summaryY + 12.5, { align: "right" })
    doc.line(45, summaryY + 15, 165, summaryY + 15)

    // Row 2
    doc.setTextColor(180, 0, 0)
    doc.text("Balance Amount", 50, summaryY + 20.5)
    doc.text(`Rs ${formatInr(data.paymentSummary.balanceAmount || 0)}`, 160, summaryY + 20.5, { align: "right" })
    doc.line(45, summaryY + 23, 165, summaryY + 23)

    if (data.paymentSummary.status === 'Completed') {
      doc.setTextColor(21, 128, 61)
    } else {
      doc.setTextColor(180, 100, 0)
    }
    doc.text("Payment Status", 50, summaryY + 28.5)
    doc.text(data.paymentSummary.status, 160, summaryY + 28.5, { align: "right" })

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
