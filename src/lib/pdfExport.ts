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

const drawBarChart = (
  doc: jsPDF,
  yPosition: number,
  entries: TimeEntry[],
  maxHeight: number
) => {
  const pageWidth = doc.internal.pageSize.getWidth();
  const chartWidth = pageWidth - 30;
  const chartHeight = maxHeight;
  const chartX = 15;

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
    .slice(0, 6); // Top 6 locations

  if (sortedLocations.length === 0) return yPosition;

  // Chart title
  doc.setFontSize(12);
  doc.setFont('Helvetica', 'bold');
  doc.setTextColor(17, 24, 39); // gray-900
  doc.text('Hours by Location', chartX, yPosition);

  yPosition += 8;

  const maxHours = Math.max(...sortedLocations.map(([, hours]) => hours));
  const barWidth = chartWidth / sortedLocations.length;
  const barGap = 2;
  const maxBarHeight = chartHeight - 25;

  const colors = [
    [37, 99, 235], // blue-600
    [59, 130, 246], // blue-500
    [96, 165, 250], // blue-400
    [147, 197, 253], // blue-300
    [191, 219, 254], // blue-200
    [219, 234, 254]  // blue-100
  ];

  sortedLocations.forEach(([location, hours], index) => {
    const barHeight = (hours / maxHours) * maxBarHeight;
    const barX = chartX + index * barWidth + barGap;
    const barY = yPosition + maxBarHeight - barHeight;

    // Draw bar
    const color = colors[index % colors.length];
    doc.setFillColor(color[0], color[1], color[2]);
    doc.rect(barX, barY, barWidth - barGap * 2, barHeight, 'F');

    // Label
    doc.setFontSize(8);
    doc.setFont('Helvetica', 'normal');
    doc.setTextColor(55, 65, 81); // gray-700
    const locationText = location.length > 10 ? location.substring(0, 10) + '...' : location;
    doc.text(locationText, barX + (barWidth - barGap * 2) / 2, yPosition + maxBarHeight + 5, {
      align: 'center',
      maxWidth: barWidth - barGap * 2
    });

    // Value on top of bar
    doc.setFontSize(7);
    doc.setFont('Helvetica', 'bold');
    doc.setTextColor(37, 99, 235); // blue-600
    doc.text(formatHours(hours), barX + (barWidth - barGap * 2) / 2, barY - 2, { align: 'center' });
  });

  // Y-axis line
  doc.setDrawColor(229, 231, 235); // gray-200
  doc.setLineWidth(0.5);
  doc.line(chartX, yPosition, chartX, yPosition + maxBarHeight);

  return yPosition + maxBarHeight + 15;
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

  // Summary cards
  yPosition = addSummaryCards(doc, yPosition, summary, entries.reduce((total, entry) => {
    const hours = calculateDuration(entry.start_time, entry.end_time, entry.lunch_break);
    const rate = entry.rate || 0;
    return total + (hours * rate);
  }, 0), isSupervisor);

  // Chart
  yPosition = drawBarChart(doc, yPosition, entries, 50);

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

  // Generate filename
  const dateRange = `${format(parseISO(startDate), 'MMM-d')}-${format(parseISO(endDate), 'MMM-d-yyyy')}`;
  let filename = 'Activity-Report';
  if (personName) filename += `-${personName}`;
  if (location) filename += `-${location}`;
  filename += `-${dateRange}.pdf`;

  doc.save(filename);
};
