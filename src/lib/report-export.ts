import { fmt } from "@/lib/pricing";

export type ReportExportInput = {
  practiceName: string;
  scopeLabel: string;
  monthName: string;
  year: number;
  month: number;
  proposalsSent: number;
  invisalignOrders: number;
  conversionPct: number | null;
  avgOrderPence: number;
  invisalignIncomePence: number;
  proposals: Array<{ patientName: string; email: string; amountPence: number; staff: string }>;
  orders: Array<{ patientName: string; email: string; amountPence: number; staff: string }>;
  payments: Array<{
    patientName: string;
    email: string;
    type: string;
    amountPence: number;
    paidAt: string;
  }>;
};

function pct(n: number | null) {
  return n === null ? "—" : `${n}%`;
}

/** Flat rows for CSV / Excel — automated Invisalign metrics only. */
export function reportExportRows(d: ReportExportInput): string[][] {
  const rows: string[][] = [
    [d.practiceName],
    ["Monthly Invisalign report (automated — not editable)"],
    ["Scope", d.scopeLabel],
    ["Period", d.monthName],
    [
      "Exported",
      new Date().toLocaleString("en-GB", {
        day: "numeric",
        month: "short",
        year: "numeric",
        hour: "2-digit",
        minute: "2-digit",
      }),
    ],
    [],
    ["SUMMARY"],
    ["Metric", "Value"],
    ["Proposals sent", String(d.proposalsSent)],
    ["Invisalign orders", String(d.invisalignOrders)],
    ["Conversion rate (orders ÷ proposals)", pct(d.conversionPct)],
    ["Average revenue per patient (new orders)", d.avgOrderPence ? fmt(d.avgOrderPence) : "—"],
    ["Income collected this month", fmt(d.invisalignIncomePence)],
    [],
    ["PROPOSALS SENT"],
    ["Patient", "Email", "Treatment value", "Staff"],
  ];

  if (d.proposals.length === 0) {
    rows.push(["No proposals this month", "", "", ""]);
  } else {
    for (const p of d.proposals) {
      rows.push([p.patientName, p.email, fmt(p.amountPence), p.staff]);
    }
  }

  rows.push([], ["ORDERS"], ["Patient", "Email", "Treatment value", "Staff"]);
  if (d.orders.length === 0) {
    rows.push(["No orders this month", "", "", ""]);
  } else {
    for (const o of d.orders) {
      rows.push([o.patientName, o.email, fmt(o.amountPence), o.staff]);
    }
  }

  rows.push([], ["PAYMENTS COLLECTED"], ["Patient", "Email", "Type", "Amount", "Paid at"]);
  if (d.payments.length === 0) {
    rows.push(["No payments this month", "", "", "", ""]);
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
  return "\uFEFF" + rows.map((r) => r.map(csvEscape).join(",")).join("\r\n");
}

function xmlEscape(s: string) {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}

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
 <Worksheet ss:Name="${xmlEscape(sheetName.slice(0, 31))}">
  <Table>${cells}</Table>
 </Worksheet>
</Workbook>`;
}

function htmlEscape(s: string) {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

/** Printable HTML for “Save as PDF” for management. */
export function reportToPdfHtml(d: ReportExportInput): string {
  const row = (cells: string[]) =>
    `<tr>${cells.map((c) => `<td>${htmlEscape(c)}</td>`).join("")}</tr>`;
  return `<!DOCTYPE html>
<html lang="en-GB">
<head>
<meta charset="utf-8"/>
<title>${htmlEscape(d.practiceName)} — ${htmlEscape(d.monthName)}</title>
<style>
  body{font-family:Calibri,Arial,sans-serif;color:#16202E;margin:32px;font-size:13px}
  h1{font-size:22px;margin:0 0 4px}
  .sub{color:#5C6a79;margin-bottom:20px}
  .grid{display:grid;grid-template-columns:repeat(4,1fr);gap:12px;margin:18px 0}
  .stat{border:1px solid #E1E7EE;border-radius:10px;padding:14px}
  .stat b{display:block;font-size:20px;margin-bottom:4px}
  table{width:100%;border-collapse:collapse;margin:14px 0 22px}
  th,td{border-bottom:1px solid #EEF2F6;padding:8px 6px;text-align:left}
  th{font-size:11px;text-transform:uppercase;letter-spacing:.04em;color:#8A96A5}
  h2{font-size:15px;margin:22px 0 8px}
  .lock{background:#F4FCFA;border:1px solid #CFEDE5;color:#0B7A6E;padding:10px 12px;border-radius:8px;font-weight:600}
  @media print{body{margin:12mm}.noprint{display:none}}
</style>
</head>
<body>
  <button class="noprint" onclick="window.print()" style="padding:10px 16px;margin-bottom:16px;cursor:pointer;background:#0E9384;color:#fff;border:none;border-radius:8px;font-weight:700">Print / Save as PDF</button>
  <h1>${htmlEscape(d.practiceName)}</h1>
  <div class="sub">Monthly Invisalign report · ${htmlEscape(d.monthName)} · ${htmlEscape(d.scopeLabel)}</div>
  <div class="lock">Automated from live records — not editable</div>
  <div class="grid">
    <div class="stat"><b>${d.proposalsSent}</b>Proposals sent</div>
    <div class="stat"><b>${d.invisalignOrders}</b>Orders</div>
    <div class="stat"><b>${htmlEscape(pct(d.conversionPct))}</b>Conversion</div>
    <div class="stat"><b>${htmlEscape(d.avgOrderPence ? fmt(d.avgOrderPence) : "—")}</b>Avg revenue / patient</div>
  </div>
  <h2>Proposals sent</h2>
  <table><thead><tr><th>Patient</th><th>Email</th><th>Value</th><th>Staff</th></tr></thead><tbody>
  ${d.proposals.length ? d.proposals.map((p) => row([p.patientName, p.email, fmt(p.amountPence), p.staff])).join("") : row(["None", "", "", ""])}
  </tbody></table>
  <h2>Orders</h2>
  <table><thead><tr><th>Patient</th><th>Email</th><th>Value</th><th>Staff</th></tr></thead><tbody>
  ${d.orders.length ? d.orders.map((o) => row([o.patientName, o.email, fmt(o.amountPence), o.staff])).join("") : row(["None", "", "", ""])}
  </tbody></table>
  <p style="color:#8A96A5">Income collected this month: <strong>${htmlEscape(fmt(d.invisalignIncomePence))}</strong></p>
  <script>window.addEventListener('load',()=>{ if(location.search.includes('autoprint=1')) setTimeout(()=>window.print(),400); });</script>
</body></html>`;
}
