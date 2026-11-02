import * as XLSX from 'xlsx';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';

export function exportToExcel(data: Record<string, any>[], fileName: string, sheetName = 'Feuille1') {
  const worksheet = XLSX.utils.json_to_sheet(data);
  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, worksheet, sheetName);
  XLSX.writeFile(workbook, `${fileName}.xlsx`);
}

export function exportTableToPdf(
  title: string,
  headers: string[],
  rows: (string | number)[][],
  fileName: string,
  subtitle?: string
) {
  const doc = new jsPDF({
    orientation: 'landscape',
    unit: 'mm',
    format: 'a4',
  });

  // Header banner
  doc.setFillColor(0, 128, 128); // Saninova teal
  doc.rect(0, 0, 297, 24, 'F');

  doc.setTextColor(255, 255, 255);
  doc.setFontSize(14);
  doc.setFont('helvetica', 'bold');
  doc.text('SANINOVA PROJECT HUB - PROJET AFGHS-PSI BÉNIN', 14, 11);

  doc.setFontSize(10);
  doc.setFont('helvetica', 'normal');
  doc.text(title.toUpperCase(), 14, 18);

  if (subtitle) {
    doc.setTextColor(50, 50, 50);
    doc.setFontSize(9);
    doc.text(subtitle, 14, 30);
  }

  const startY = subtitle ? 34 : 28;

  autoTable(doc, {
    head: [headers],
    body: rows,
    startY: startY,
    theme: 'grid',
    headStyles: {
      fillColor: [30, 58, 138], // Brand blue
      textColor: [255, 255, 255],
      fontStyle: 'bold',
      fontSize: 8,
    },
    styles: {
      fontSize: 8,
      cellPadding: 2.5,
    },
    alternateRowStyles: {
      fillColor: [248, 250, 252],
    },
    margin: { top: 25, right: 14, bottom: 15, left: 14 },
    didDrawPage: (data) => {
      // Footer
      doc.setFontSize(7);
      doc.setTextColor(150, 150, 150);
      const str = `Généré le ${new Date().toLocaleDateString('fr-FR')} - SaniNova Global Consulting | Page ${data.pageNumber}`;
      doc.text(str, 14, 205);
    },
  });

  doc.save(`${fileName}.pdf`);
}
