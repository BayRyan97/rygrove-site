import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import { format, parseISO } from 'date-fns';

interface TimeEntry {
  id: string;
  date: string;
  start_time: string;
  end_time: string;
  location: string;
  lunch_break: string | null;
  notes: string | null;
  created_at: string;
  user_id: string;
  full_name: string;
  is_full_day: boolean;
  work_type?: string[] | null;
  work_type_other?: string | null;
  rate?: number | null;
  expenses: {
    amount: number;
    description: string;
    receipt_url: string | null;
    retailer_id?: string | null;
    retailers?: { name: string } | null;
  }[];
}

interface ActivitySummary {
  totalHours: number;
  totalExpenses: number;
  uniqueLocations: Set<string>;
}

const calculateDuration = (start: string, end: string, lunchBreak: string | null) => {
  const startTime = parseISO(`2000-01-01T${start}`);
  const endTime = parseISO(`2000-01-01T${end}`);
  let minutes = Math.abs(endTime.getTime() - startTime.getTime()) / 60000;

  if (lunchBreak) {
    const [hours, mins] = lunchBreak.split(':').map(Number);
    minutes -= (hours * 60 + mins);
  }

  return minutes / 60;
};

const formatHours = (hours: number): string => {
  return Number.isInteger(hours) ? hours.toString() : hours.toFixed(1);
};

const formatCurrency = (amount: number): string => {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0
  }).format(amount);
};

const addHeader = (doc: jsPDF) => {
  const pageWidth = doc.internal.pageSize.getWidth();

  // Rygrove branding - matching site style (RY in blue-600, GROVE in blue-500)
  const xStart = 15;

  // "RY" in blue-600
  doc.setTextColor(37, 99, 235); // blue-600
  doc.setFontSize(28);
  doc.setFont('Helvetica', 'bold');
  doc.text('RY', xStart, 18);

  // "GROVE" in blue-500 (right after RY as one word)
  doc.setTextColor(59, 130, 246); // blue-500
  doc.text('GROVE', xStart + 13, 18);

  // Horizontal line
  doc.setDrawColor(37, 99, 235); // blue-600
  doc.setLineWidth(1);
  doc.line(15, 22, pageWidth - 15, 22);

  return 28; // Return Y position after header
};

const addSummaryCards = (
  doc: jsPDF,
  yPosition: number,
  summary: ActivitySummary,
  totalLaborCost: number,
  isSupervisor: boolean
) => {
  const pageWidth = doc.internal.pageSize.getWidth();
  const cardWidth = (pageWidth - 35) / 2;
  const cardHeight = 28;
  const cardGap = 5;

  const cards = [
    { label: 'Total Hours', value: formatHours(summary.totalHours) },
    { label: 'Total Expenses', value: formatCurrency(summary.totalExpenses) }
  ];

  if (!isSupervisor) {
    cards.push({ label: 'Labor Cost', value: formatCurrency(totalLaborCost) });
  }

  cards.push({ label: 'Locations', value: summary.uniqueLocations.size.toString() });

  // Draw cards in 2x2 grid
  let xPos = 15;
  let yPos = yPosition;

  cards.forEach((card, index) => {
    // Card background
    doc.setFillColor(249, 250, 251); // gray-50
    doc.setDrawColor(229, 231, 235); // gray-200
    doc.setLineWidth(0.5);
    doc.rect(xPos, yPos, cardWidth, cardHeight, 'FD');

    // Label
    doc.setFontSize(9);
    doc.setFont('Helvetica', 'normal');
    doc.setTextColor(107, 114, 128); // gray-600
    doc.text(card.label, xPos + 4, yPos + 8);

    // Value
    doc.setFontSize(18);
    doc.setFont('Helvetica', 'bold');
    doc.setTextColor(37, 99, 235); // blue-600
    doc.text(card.value, xPos + 4, yPos + 20);

    // Move to next position
    if ((index + 1) % 2 === 0) {
      xPos = 15;
      yPos += cardHeight + cardGap;
    } else {
      xPos += cardWidth + 5;
    }
  });

  return yPosition + (Math.ceil(cards.length / 2) * (cardHeight + cardGap)) + 5;
};


// Horizontal bar chart for location hours (no truncation)
const drawHorizontalBarChart = (
  doc: jsPDF,
  yPosition: number,
  entries: TimeEntry[],
  maxHeight: number
) => {
  const pageWidth = doc.internal.pageSize.getWidth();
  const chartX = 15;
  const labelX = chartX + 5; // extra left margin for labels
  const barStartX = chartX + 60; // move bars further right
  const chartWidth = pageWidth - barStartX - 15; // leave margin for labels and right edge
  const barHeight = 8;
  const barGap = 4;

  // Group by location
  const locationHours: { [location: string]: number } = {};
  entries.forEach(entry => {
    const hours = calculateDuration(entry.start_time, entry.end_time, entry.lunch_break);
    if (!locationHours[entry.location]) {
      locationHours[entry.location] = 0;
    }
    locationHours[entry.location] += hours;
  });

  const sortedLocations = Object.entries(locationHours)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 10); // Top 10 locations

  if (sortedLocations.length === 0) return yPosition;

  // Chart title
  doc.setFontSize(12);
  doc.setFont('Helvetica', 'bold');
  doc.setTextColor(17, 24, 39); // gray-900
  doc.text('Hours by Location', chartX, yPosition);
  yPosition += 8;

  const maxHours = Math.max(...sortedLocations.map(([, hours]) => hours));

  sortedLocations.forEach(([location, hours], index) => {
    const barY = yPosition + index * (barHeight + barGap);
    const barLen = (hours / maxHours) * chartWidth;
    // Draw bar
    doc.setFillColor(37, 99, 235); // blue-600
    doc.rect(barStartX, barY, barLen, barHeight, 'F');
    // Location label (no truncation, left-aligned, vertically centered)
    doc.setFontSize(9);
    doc.setFont('Helvetica', 'normal');
    doc.setTextColor(55, 65, 81); // gray-700
    doc.text(location, labelX, barY + barHeight / 2 + 3, { align: 'left' });
    // Hours value at end of bar
    doc.setFontSize(8);
    doc.setFont('Helvetica', 'bold');
    doc.setTextColor(37, 99, 235); // blue-600
    doc.text(formatHours(hours), barStartX + barLen + 4, barY + barHeight / 2 + 3, { align: 'left' });
  });

  return yPosition + sortedLocations.length * (barHeight + barGap) + 10;
};

export const generateActivityPDF = (
  entries: TimeEntry[],
  summary: ActivitySummary,
  startDate: string,
  endDate: string,
  personName: string,
  location: string,
  isSupervisor: boolean
) => {
  const doc = new jsPDF({
    orientation: 'portrait',
    unit: 'mm',
    format: 'letter'
  });

  const pageHeight = doc.internal.pageSize.getHeight();

  // ===== PAGE 1: SUMMARY =====
  let yPosition = addHeader(doc);
  yPosition += 5;

  // Date range and filters
  doc.setFontSize(11);
  doc.setFont('Helvetica', 'bold');
  doc.setTextColor(17, 24, 39); // gray-900
  const dateRangeText = `${format(parseISO(startDate), 'MMM d, yyyy')} – ${format(parseISO(endDate), 'MMM d, yyyy')}`;
  doc.text(dateRangeText, 15, yPosition);
  yPosition += 6;

  // Applied filters
  if (personName || location) {
    doc.setFontSize(9);
    doc.setFont('Helvetica', 'normal');
    doc.setTextColor(107, 114, 128); // gray-600
    let filterText = 'Filters: ';
    if (personName) filterText += `Employee: ${personName}`;
    if (location) filterText += `${personName ? ' • ' : ''}Location: ${location}`;
    doc.text(filterText, 15, yPosition);
    yPosition += 5;
  }

  yPosition += 3;


  // Expanded summary metrics
  const uniqueEmployees = new Set(entries.map(e => e.full_name)).size;
  const totalEntries = entries.length;
  const dateSpanDays = Math.max(1, Math.ceil((parseISO(endDate).getTime() - parseISO(startDate).getTime()) / (1000 * 60 * 60 * 24)));
  const avgHoursPerDay = summary.totalHours / dateSpanDays;

  // 3-column grid (6 cards)
  const cards = [
    { label: 'Total Hours', value: formatHours(summary.totalHours) },
    { label: 'Total Expenses', value: formatCurrency(summary.totalExpenses) },
    { label: 'Labor Cost', value: formatCurrency(entries.reduce((total, entry) => {
      const hours = calculateDuration(entry.start_time, entry.end_time, entry.lunch_break);
      const rate = entry.rate || 0;
      return total + (hours * rate);
    }, 0)) },
    { label: 'Employees', value: uniqueEmployees.toString() },
    { label: 'Entries', value: totalEntries.toString() },
    { label: 'Avg Hours/Day', value: formatHours(avgHoursPerDay) }
  ];
  let xPos = 15;
  let yPosCards = yPosition;
  const colWidth = (doc.internal.pageSize.getWidth() - 30) / 3;
  const cardHeight = 22;
  const cardGap = 5;
  cards.forEach((card, idx) => {
    doc.setFillColor(249, 250, 251); // gray-50
    doc.setDrawColor(229, 231, 235); // gray-200
    doc.setLineWidth(0.5);
    doc.rect(xPos, yPosCards, colWidth, cardHeight, 'FD');
    doc.setFontSize(9);
    doc.setFont('Helvetica', 'normal');
    doc.setTextColor(107, 114, 128); // gray-600
    doc.text(card.label, xPos + 4, yPosCards + 8);
    doc.setFontSize(15);
    doc.setFont('Helvetica', 'bold');
    doc.setTextColor(37, 99, 235); // blue-600
    doc.text(card.value, xPos + 4, yPosCards + 18);
    xPos += colWidth + cardGap;
    if ((idx + 1) % 3 === 0) {
      xPos = 15;
      yPosCards += cardHeight + cardGap;
    }
  });
  yPosition = yPosCards + 5;

  // Top contributors section
  // Top 3 employees by hours
  const employeeHours: { [name: string]: number } = {};
  entries.forEach(entry => {
    const hours = calculateDuration(entry.start_time, entry.end_time, entry.lunch_break);
    employeeHours[entry.full_name] = (employeeHours[entry.full_name] || 0) + hours;
  });
  const topEmployees = Object.entries(employeeHours)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 3);
  if (topEmployees.length > 0) {
    doc.setFontSize(11);
    doc.setFont('Helvetica', 'bold');
    doc.setTextColor(17, 24, 39); // gray-900
    doc.text('Top Contributors', 15, yPosition);
    yPosition += 7;
    doc.setFontSize(9);
    doc.setFont('Helvetica', 'normal');
    doc.setTextColor(55, 65, 81); // gray-700
    topEmployees.forEach(([name, hours], idx) => {
      const pct = ((hours / summary.totalHours) * 100).toFixed(1);
      doc.text(`${name}: ${formatHours(hours)} hrs (${pct}%)`, 15, yPosition + idx * 5);
    });
    yPosition += topEmployees.length * 5 + 3;
  }

  // Horizontal bar chart
  yPosition = drawHorizontalBarChart(doc, yPosition, entries, 70);

  // ===== PAGE 2: DETAILED BREAKDOWN =====
  doc.addPage();
  
  // Header on new page
  yPosition = addHeader(doc);
  yPosition += 5;

  // Section title
  doc.setFontSize(12);
  doc.setFont('Helvetica', 'bold');
  doc.setTextColor(17, 24, 39); // gray-900
  doc.text('Detailed Breakdown by Location', 15, yPosition);
  yPosition += 8;

  // Group entries by person → location
  const groupedData: { [person: string]: { [location: string]: TimeEntry[] } } = {};

  entries.forEach(entry => {
    if (!groupedData[entry.full_name]) {
      groupedData[entry.full_name] = {};
    }
    if (!groupedData[entry.full_name][entry.location]) {
      groupedData[entry.full_name][entry.location] = [];
    }
    groupedData[entry.full_name][entry.location].push(entry);
  });

  // Create table data
  const tableHeaders = ['Employee', 'Location', 'Entries', 'Hours', 'Expenses'];
  if (!isSupervisor) {
    tableHeaders.push('Labor Cost');
  }

  const tableRows: (string | number)[][] = [];

  Object.keys(groupedData)
    .sort()
    .forEach(personName => {
      const locations = groupedData[personName];
      Object.keys(locations)
        .sort()
        .forEach(loc => {
          const locEntries = locations[loc];
          const locHours = locEntries.reduce(
            (sum, entry) => sum + calculateDuration(entry.start_time, entry.end_time, entry.lunch_break),
            0
          );
          const locExpenses = locEntries.reduce(
            (sum, entry) => sum + (entry.expenses?.reduce((s, exp) => s + exp.amount, 0) || 0),
            0
          );
          const locLaborCost = locEntries.reduce(
            (sum, entry) => {
              const hours = calculateDuration(entry.start_time, entry.end_time, entry.lunch_break);
              const rate = entry.rate || 0;
              return sum + (hours * rate);
            },
            0
          );

          const row: (string | number)[] = [
            personName,
            loc,
            locEntries.length.toString(),
            formatHours(locHours),
            formatCurrency(locExpenses)
          ];
          if (!isSupervisor) {
            row.push(formatCurrency(locLaborCost));
          }
          tableRows.push(row);
        });
    });

  // Add table
  autoTable(doc, {
    head: [tableHeaders],
    body: tableRows,
    startY: yPosition,
    margin: { left: 15, right: 15, top: 10, bottom: 25 },
    styles: {
      fontSize: 9,
      cellPadding: 5,
      textColor: 55,
      lineColor: 229,
      fillColor: 255,
      halign: 'left'
    },
    headStyles: {
      fillColor: [37, 99, 235], // blue-600
      textColor: 255,
      fontStyle: 'bold',
      halign: 'left'
    },
    alternateRowStyles: {
      fillColor: [249, 250, 251] // gray-50
    },
    columnStyles: {
      2: { halign: 'center' }, // Entries
      3: { halign: 'right' }, // Hours
      4: { halign: 'right' }, // Expenses
      5: { halign: 'right' } // Labor Cost (if shown)
    },
    didDrawPage: (data) => {
      // Footer on all pages
      const pageCount = doc.getNumberOfPages();
      const footerY = pageHeight - 8;

      doc.setFontSize(8);
      doc.setTextColor(156, 163, 175); // gray-400
      doc.text(
        `Generated on ${format(new Date(), 'MMM d, yyyy')} | Page ${data.pageNumber} of ${pageCount}`,
        15,
        footerY
      );
    }
  });

  // ===== PAGE 3: EXPENSES PAGE =====
  // Collect all expenses from entries
  const allExpenses: Array<{
    date: string;
    employee: string;
    location: string;
    description: string;
    retailer: string;
    amount: number;
    receipt_url: string | null;
  }> = [];

  entries.forEach(entry => {
    if (entry.expenses && entry.expenses.length > 0) {
      entry.expenses.forEach(expense => {
        allExpenses.push({
          date: entry.date,
          employee: entry.full_name,
          location: entry.location,
          description: expense.description,
          retailer: expense.retailers?.name || 'N/A',
          amount: expense.amount,
          receipt_url: expense.receipt_url
        });
      });
    }
  });

  // Only add expenses page if there are expenses
  if (allExpenses.length > 0) {
    doc.addPage();
    
    // Header on new page
    yPosition = addHeader(doc);
    yPosition += 5;

    // Section title
    doc.setFontSize(12);
    doc.setFont('Helvetica', 'bold');
    doc.setTextColor(17, 24, 39); // gray-900
    doc.text('Expense Details', 15, yPosition);
    yPosition += 4;

    // Subtitle with total expenses
    doc.setFontSize(10);
    doc.setFont('Helvetica', 'normal');
    doc.setTextColor(107, 114, 128); // gray-600
    doc.text(`Total: ${formatCurrency(summary.totalExpenses)} (${allExpenses.length} expense${allExpenses.length === 1 ? '' : 's'})`, 15, yPosition);
    yPosition += 8;

    // Sort expenses by date (most recent first)
    allExpenses.sort((a, b) => b.date.localeCompare(a.date));

    // Create expenses table
    const expenseHeaders = ['Date', 'Employee', 'Location', 'Retailer', 'Description', 'Amount'];
    const expenseRows: (string | number)[][] = allExpenses.map(expense => [
      format(parseISO(expense.date), 'MM/dd/yyyy'),
      expense.employee,
      expense.location,
      expense.retailer,
      expense.description,
      formatCurrency(expense.amount)
    ]);

    // Add total row
    expenseRows.push([
      { content: 'TOTAL', colSpan: 5, styles: { fontStyle: 'bold', halign: 'right' } },
      { content: formatCurrency(summary.totalExpenses), styles: { fontStyle: 'bold', fillColor: [249, 250, 251] } }
    ] as any);

    // Add table
    autoTable(doc, {
      head: [expenseHeaders],
      body: expenseRows,
      startY: yPosition,
      margin: { left: 15, right: 15, top: 10, bottom: 25 },
      styles: {
        fontSize: 8,
        cellPadding: 4,
        textColor: 55,
        lineColor: 229,
        fillColor: 255,
        halign: 'left',
        overflow: 'linebreak'
      },
      headStyles: {
        fillColor: [37, 99, 235], // blue-600
        textColor: 255,
        fontStyle: 'bold',
        halign: 'left'
      },
      alternateRowStyles: {
        fillColor: [249, 250, 251] // gray-50
      },
      columnStyles: {
        0: { cellWidth: 22 }, // Date
        1: { cellWidth: 30 }, // Employee
        2: { cellWidth: 35 }, // Location
        3: { cellWidth: 30 }, // Retailer
        4: { cellWidth: 50 }, // Description
        5: { halign: 'right', cellWidth: 25 } // Amount
      },
      didDrawPage: (data) => {
        // Footer on all pages
        const pageCount = doc.getNumberOfPages();
        const footerY = pageHeight - 8;

        doc.setFontSize(8);
        doc.setTextColor(156, 163, 175); // gray-400
        doc.text(
          `Generated on ${format(new Date(), 'MMM d, yyyy')} | Page ${data.pageNumber} of ${pageCount}`,
          15,
          footerY
        );
      }
    });
  }

  // Generate filename with date and time down to the second
  const now = new Date();
  const dateTimeStr = format(now, 'yyyy-MM-dd_HH-mm-ss');
  const dateRange = `${format(parseISO(startDate), 'MMM-d')}-${format(parseISO(endDate), 'MMM-d-yyyy')}`;
  let filename = 'Activity-Report';
  if (personName) filename += `-${personName}`;
  if (location) filename += `-${location}`;
  filename += `-${dateRange}-${dateTimeStr}.pdf`;

  doc.save(filename);
};

interface EstimateRow {
  id: string;
  item: string;
  cost: number;
}

interface EstimateData {
  jobName: string;
  rows: EstimateRow[];
  overheadPercentage: number;
  subtotal: number;
  overheadAmount: number;
  total: number;
}

export const generateEstimatePDF = (estimateData: EstimateData) => {
  const doc = new jsPDF();
  const pageWidth = doc.internal.pageSize.getWidth();

  // Add header with Rygrove branding
  const xStart = 15;
  
  // "RY" in blue-600
  doc.setTextColor(37, 99, 235); // blue-600
  doc.setFontSize(28);
  doc.setFont('Helvetica', 'bold');
  doc.text('RY', xStart, 18);
  
  // "GROVE" in blue-500
  doc.setTextColor(59, 130, 246); // blue-500
  doc.text('GROVE', xStart + 13, 18);
  
  // Horizontal line
  doc.setDrawColor(37, 99, 235); // blue-600
  doc.setLineWidth(1);
  doc.line(15, 22, pageWidth - 15, 22);

  // Add address
  let yPosition = 28;
  doc.setFontSize(9);
  doc.setFont('Helvetica', 'normal');
  doc.setTextColor(107, 114, 128); // gray-600
  doc.text('27 Carpenter St, Glen Cove, NY 11542', 15, yPosition);

  // Add "Estimate: Job Name" title
  yPosition += 10;
  doc.setFontSize(14);
  doc.setFont('Helvetica', 'bold');
  doc.setTextColor(37, 99, 235); // blue-600
  const estimateLabel = 'Estimate: ';
  doc.text(estimateLabel, 15, yPosition);
  
  // Get width of "Estimate: " to position job name right after it
  const labelWidth = doc.getTextWidth(estimateLabel);
  doc.setTextColor(31, 41, 55); // gray-800
  doc.text(estimateData.jobName, 15 + labelWidth, yPosition);

  // Add date
  yPosition += 7;
  doc.setFontSize(9);
  doc.setFont('Helvetica', 'normal');
  doc.setTextColor(107, 114, 128); // gray-600
  doc.text(`Prepared: ${format(new Date(), 'MMMM d, yyyy')}`, 15, yPosition);

  yPosition += 10;

  // Create table for estimate items
  const tableData = estimateData.rows
    .filter(row => row.item.trim() !== '' || row.cost > 0)
    .map(row => [
      row.item,
      formatCurrency(row.cost)
    ]);

  autoTable(doc, {
    startY: yPosition,
    head: [['Item', 'Cost']],
    body: tableData,
    theme: 'grid',
    headStyles: {
      fillColor: [37, 99, 235], // blue-600
      textColor: [255, 255, 255],
      fontSize: 11,
      fontStyle: 'bold',
      halign: 'center'
    },
    bodyStyles: {
      fontSize: 10,
      textColor: [31, 41, 55], // gray-800
    },
    columnStyles: {
      0: { cellWidth: pageWidth - 70, halign: 'left' },
      1: { cellWidth: 40, halign: 'right' }
    },
    alternateRowStyles: {
      fillColor: [249, 250, 251] // gray-50
    },
    margin: { left: 15, right: 15 },
  });

  // Get final Y position after table
  yPosition = (doc as any).lastAutoTable.finalY + 5;

  // Add summary section
  const summaryData = [
    ['Overhead & Profit (' + estimateData.overheadPercentage + '%)', formatCurrency(estimateData.overheadAmount)],
    ['TOTAL', formatCurrency(estimateData.total)]
  ];

  autoTable(doc, {
    startY: yPosition,
    body: summaryData,
    theme: 'plain',
    bodyStyles: {
      fontSize: 12,
      fontStyle: 'bold',
      textColor: [31, 41, 55], // gray-800
    },
    columnStyles: {
      0: { cellWidth: pageWidth - 70, halign: 'left' },
      1: { cellWidth: 40, halign: 'right' }
    },
    didParseCell: function(data) {
      if (data.row.index === summaryData.length - 1) {
        // Style the total row
        data.cell.styles.fillColor = [240, 253, 244]; // green-50
        data.cell.styles.textColor = [21, 128, 61]; // green-700
        data.cell.styles.fontSize = 12;
        data.cell.styles.fontStyle = 'bold';
      } else {
        // Style the overhead row
        data.cell.styles.fillColor = [239, 246, 255]; // blue-50
        data.cell.styles.fontSize = 12;
      }
    },
    margin: { left: 15, right: 15 },
  });

  // Add footer
  const pageHeight = doc.internal.pageSize.getHeight();
  const footerY = pageHeight - 15;
  
  doc.setFontSize(8);
  doc.setFont('Helvetica', 'normal');
  doc.setTextColor(156, 163, 175); // gray-400
  doc.text(
    'This estimate is valid for 30 days from the date of preparation.',
    15,
    footerY
  );

  // Generate filename
  const filename = `${estimateData.jobName.replace(/[^a-z0-9]/gi, '_')}_Estimate.pdf`;
  doc.save(filename);
};

// Client-facing invoice interface
interface InvoiceEntry {
  id: string;
  date: string;
  start_time: string;
  end_time: string;
  full_name: string;
  is_full_day: boolean;
  lunch_break: string | null;
  expenses: {
    amount: number;
    description: string;
    retailer_name?: string;
  }[];
}

interface StandaloneExpense {
  date: string;
  description: string;
  retailer_name?: string;
  amount: number;
}

interface InvoiceData {
  location: string;
  startDate: string;
  endDate: string;
  entries: InvoiceEntry[];
  standaloneExpenses: StandaloneExpense[];
  laborTotal: number;
  expenseTotal: number;
  grandTotal: number;
  totalHours: number;
}

export const generateClientInvoicePDF = (invoiceData: InvoiceData) => {
  const doc = new jsPDF({
    orientation: 'portrait',
    unit: 'mm',
    format: 'letter'
  });

  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();

  // Add header with Rygrove branding
  let yPosition = addHeader(doc);
  yPosition += 5;

  // Company address
  doc.setFontSize(9);
  doc.setFont('Helvetica', 'normal');
  doc.setTextColor(107, 114, 128); // gray-600
  doc.text('27 Carpenter St, Glen Cove, NY 11542', 15, yPosition);
  yPosition += 8;

  // Invoice title and job info
  doc.setFontSize(16);
  doc.setFont('Helvetica', 'bold');
  doc.setTextColor(37, 99, 235); // blue-600
  doc.text('INVOICE', 15, yPosition);
  yPosition += 10;

  // Job details
  doc.setFontSize(11);
  doc.setFont('Helvetica', 'bold');
  doc.setTextColor(17, 24, 39); // gray-900
  doc.text(`Job: ${invoiceData.location}`, 15, yPosition);
  yPosition += 6;

  doc.setFontSize(9);
  doc.setFont('Helvetica', 'normal');
  doc.setTextColor(107, 114, 128); // gray-600
  const dateRangeText = `Period: ${format(parseISO(invoiceData.startDate), 'MMM d, yyyy')} - ${format(parseISO(invoiceData.endDate), 'MMM d, yyyy')}`;
  doc.text(dateRangeText, 15, yPosition);
  yPosition += 5;

  doc.text(`Invoice Date: ${format(new Date(), 'MMMM d, yyyy')}`, 15, yPosition);
  yPosition += 10;

  // Labor summary section
  doc.setFontSize(12);
  doc.setFont('Helvetica', 'bold');
  doc.setTextColor(17, 24, 39); // gray-900
  doc.text('Labor Summary', 15, yPosition);
  yPosition += 8;

  // Group entries by employee
  const employeeHours: { [name: string]: number } = {};
  invoiceData.entries.forEach(entry => {
    const hours = calculateDuration(entry.start_time, entry.end_time, entry.lunch_break);
    employeeHours[entry.full_name] = (employeeHours[entry.full_name] || 0) + hours;
  });

  // Create labor table (NO RATES)
  const laborHeaders = ['Employee', 'Hours'];
  const laborRows: string[][] = [];

  Object.entries(employeeHours)
    .sort((a, b) => a[0].localeCompare(b[0]))
    .forEach(([name, hours]) => {
      laborRows.push([name, formatHours(hours)]);
    });

  // Add total row
  laborRows.push([
    { content: 'Total Labor', styles: { fontStyle: 'bold' } },
    { content: formatCurrency(invoiceData.laborTotal), styles: { fontStyle: 'bold', fillColor: [249, 250, 251] } }
  ] as any);

  autoTable(doc, {
    head: [laborHeaders],
    body: laborRows,
    startY: yPosition,
    margin: { left: 15, right: 15 },
    styles: {
      fontSize: 9,
      cellPadding: 5,
      textColor: 55,
      lineColor: 229,
      fillColor: 255,
      halign: 'left'
    },
    headStyles: {
      fillColor: [37, 99, 235], // blue-600
      textColor: 255,
      fontStyle: 'bold'
    },
    alternateRowStyles: {
      fillColor: [249, 250, 251] // gray-50
    },
    columnStyles: {
      0: { cellWidth: pageWidth - 60 },
      1: { halign: 'right', cellWidth: 30 }
    }
  });

  yPosition = (doc as any).lastAutoTable.finalY + 10;

  // Expenses section (if any)
  const allExpenses: Array<{
    date: string;
    description: string;
    retailer: string;
    amount: number;
  }> = [];

  // Collect expenses from entries
  invoiceData.entries.forEach(entry => {
    if (entry.expenses && entry.expenses.length > 0) {
      entry.expenses.forEach(expense => {
        allExpenses.push({
          date: entry.date,
          description: expense.description,
          retailer: expense.retailer_name || 'N/A',
          amount: expense.amount
        });
      });
    }
  });

  // Add standalone expenses
  invoiceData.standaloneExpenses.forEach(expense => {
    allExpenses.push({
      date: expense.date,
      description: expense.description,
      retailer: expense.retailer_name || 'N/A',
      amount: expense.amount
    });
  });

  if (allExpenses.length > 0) {
    doc.setFontSize(12);
    doc.setFont('Helvetica', 'bold');
    doc.setTextColor(17, 24, 39); // gray-900
    doc.text('Expenses', 15, yPosition);
    yPosition += 8;

    // Sort expenses by date
    allExpenses.sort((a, b) => a.date.localeCompare(b.date));

    const expenseHeaders = ['Date', 'Retailer', 'Description', 'Amount'];
    const expenseRows: (string | number)[][] = allExpenses.map(expense => [
      format(parseISO(expense.date), 'MM/dd/yyyy'),
      expense.retailer,
      expense.description,
      formatCurrency(expense.amount)
    ]);

    // Add total row
    expenseRows.push([
      { content: 'Total Expenses', colSpan: 3, styles: { fontStyle: 'bold', halign: 'right' } },
      { content: formatCurrency(invoiceData.expenseTotal), styles: { fontStyle: 'bold', fillColor: [249, 250, 251] } }
    ] as any);

    autoTable(doc, {
      head: [expenseHeaders],
      body: expenseRows,
      startY: yPosition,
      margin: { left: 15, right: 15 },
      styles: {
        fontSize: 8,
        cellPadding: 4,
        textColor: 55,
        lineColor: 229,
        fillColor: 255,
        halign: 'left',
        overflow: 'linebreak'
      },
      headStyles: {
        fillColor: [37, 99, 235], // blue-600
        textColor: 255,
        fontStyle: 'bold',
        halign: 'left'
      },
      alternateRowStyles: {
        fillColor: [249, 250, 251] // gray-50
      },
      columnStyles: {
        0: { cellWidth: 25 },
        1: { cellWidth: 35 },
        2: { cellWidth: 75 },
        3: { halign: 'right', cellWidth: 30 }
      }
    });

    yPosition = (doc as any).lastAutoTable.finalY + 10;
  }

  // Grand Total
  doc.setFillColor(37, 99, 235); // blue-600
  doc.rect(15, yPosition, pageWidth - 30, 15, 'F');

  doc.setFontSize(14);
  doc.setFont('Helvetica', 'bold');
  doc.setTextColor(255, 255, 255); // white
  doc.text('TOTAL DUE', 20, yPosition + 10);
  doc.text(formatCurrency(invoiceData.grandTotal), pageWidth - 20, yPosition + 10, { align: 'right' });

  yPosition += 20;

  // Payment terms (optional)
  if (yPosition < pageHeight - 40) {
    doc.setFontSize(9);
    doc.setFont('Helvetica', 'normal');
    doc.setTextColor(107, 114, 128); // gray-600
    doc.text('Payment is due within 30 days of invoice date.', 15, yPosition);
    yPosition += 5;
    doc.text('Thank you for your business!', 15, yPosition);
  }

  // Footer
  const footerY = pageHeight - 8;
  doc.setFontSize(8);
  doc.setTextColor(156, 163, 175); // gray-400
  doc.text(
    `Invoice generated ${format(new Date(), 'MMM d, yyyy')}`,
    15,
    footerY
  );

  // Generate filename
  const dateStr = format(new Date(), 'yyyy-MM-dd');
  const filename = `Invoice-${invoiceData.location.replace(/[^a-z0-9]/gi, '_')}-${dateStr}.pdf`;
  doc.save(filename);
};
