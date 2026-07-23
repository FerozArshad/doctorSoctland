import { fmt } from "@/lib/pricing";

export type ReportExportInput = {
  practiceName: string;
  adminName: string;
  adminEmail: string;
  monthName: string;
  year: number;
  month: number;
  invisalignOrders: number;
  invisalignIncomePence: number;
  avgOrderPence: number;
  consultsSeen: number;
  consultsProceeded: number;
  bondingConsults: number;
  bondingProceeded: number;
  bondingIncomePence: number;
  veneerConsults: number;
  veneerProceeded: number;
  veneerIncomePence: number;
  notes: string;
  filedAt: string | null;
  payments: Array<{
    patientName: string;
    email: string;
    type: string;
    amountPence: number;
    paidAt: string;
  }>;
};

function pct(part: number, whole: number) {
  return whole > 0 ? `${Math.round((100 * part) / whole)}%` : "—";
}

function avg(pence: number, n: number) {
  return n > 0 ? fmt(Math.round(pence / n)) : "—";
}

/** Flat rows for CSV / Excel — sectioned summary then payment detail. */
export function reportExportRows(d: ReportExportInput): string[][] {
  const rows: string[][] = [
    [d.practiceName],
    ["Monthly performance report"],
    ["Coordinator", d.adminName],
    ["Email", d.adminEmail],
    ["Period", d.monthName],
    ["Filed", d.filedAt || "Not filed yet"],
    ["Exported", new Date().toLocaleString("en-GB", { day: "numeric", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" })],
    [],
    ["INVISALIGN"],
    ["Metric", "Value"],
    ["Orders (patients who went ahead)", String(d.invisalignOrders)],
    ["Income collected", fmt(d.invisalignIncomePence)],
    ["Average treatment value (new orders)", d.avgOrderPence ? fmt(d.avgOrderPence) : "—"],
    ["Consults seen", String(d.consultsSeen)],
    ["Consults proceeded", String(d.consultsProceeded)],
    ["Consult conversion", pct(d.consultsProceeded, d.consultsSeen)],
    [],
    ["COMPOSITE BONDING"],
    ["Metric", "Value"],
    ["Consults seen", String(d.bondingConsults)],
    ["Went ahead", String(d.bondingProceeded)],
    ["Income", fmt(d.bondingIncomePence)],
    ["Avg per bonding patient", avg(d.bondingIncomePence, d.bondingProceeded)],
    ["Conversion", pct(d.bondingProceeded, d.bondingConsults)],
    [],
    ["VENEERS"],
    ["Metric", "Value"],
    ["Consults seen", String(d.veneerConsults)],
    ["Went ahead", String(d.veneerProceeded)],
    ["Income", fmt(d.veneerIncomePence)],
    ["Avg per veneer patient", avg(d.veneerIncomePence, d.veneerProceeded)],
    ["Conversion", pct(d.veneerProceeded, d.veneerConsults)],
    [],
    ["TOTAL OTHER INCOME (bonding + veneers)", fmt(d.bondingIncomePence + d.veneerIncomePence)],
    [],
    ["NOTES"],
    [d.notes || "—"],
    [],
    ["PAYMENTS COLLECTED THIS MONTH"],
    ["Patient", "Email", "Type", "Amount", "Paid at"],
  ];

  if (d.payments.length === 0) {
    rows.push(["No payments recorded this month", "", "", "", ""]);
  } else {
    for (const p of d.payments) {
      rows.push([p.patientName, p.email, p.type, fmt(p.amountPence), p.paidAt]);
    }
  }

  return rows;
}

function csvEscape(cell: string) {
  if (/[",\n\r]/.test(cell)) return `"${cell.replace(/"/g, '""')}"`;
  return cell;
}

export function rowsToCsv(rows: string[][]): string {
  // BOM so Excel opens UTF-8 correctly (GBP £, names, etc.)
  return "\uFEFF" + rows.map((r) => r.map(csvEscape).join(",")).join("\r\n");
}

function xmlEscape(s: string) {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}

/** SpreadsheetML — opens cleanly in Excel / Google Sheets as .xls */
export function rowsToExcelXml(rows: string[][], sheetName: string): string {
  const cells = rows
    .map(
      (row) =>
        `<Row>${row
          .map((c) => `<Cell><Data ss:Type="String">${xmlEscape(c)}</Data></Cell>`)
          .join("")}</Row>`
    )
    .join("");

  return `<?xml version="1.0"?>
<?mso-application progid="Excel.Sheet"?>
<Workbook xmlns="urn:schemas-microsoft-com:office:spreadsheet"
 xmlns:o="urn:schemas-microsoft-com:office:office"
 xmlns:x="urn:schemas-microsoft-com:office:excel"
 xmlns:ss="urn:schemas-microsoft-com:office:spreadsheet"
 xmlns:html="http://www.w3.org/TR/REC-html40">
 <DocumentProperties xmlns="urn:schemas-microsoft-com:office:office">
  <Title>Dental Scotland monthly report</Title>
  <Author>Dental Scotland</Author>
 </DocumentProperties>
 <Styles>
  <Style ss:ID="Default" ss:Name="Normal">
   <Alignment ss:Vertical="Center"/>
   <Font ss:FontName="Calibri" ss:Size="11"/>
  </Style>
  <Style ss:ID="Header">
   <Font ss:FontName="Calibri" ss:Size="14" ss:Bold="1" ss:Color="#0B1828"/>
  </Style>
  <Style ss:ID="Section">
   <Font ss:FontName="Calibri" ss:Size="11" ss:Bold="1" ss:Color="#0B7A6E"/>
  </Style>
 </Styles>
 <Worksheet ss:Name="${xmlEscape(sheetName.slice(0, 31))}">
  <Table>${cells}</Table>
 </Worksheet>
</Workbook>`;
}
