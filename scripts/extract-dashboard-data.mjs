import fs from "node:fs";
import path from "node:path";
import os from "node:os";
import XLSX from "xlsx";

const workbookPath =
  process.argv[2] ||
  path.join(os.homedir(), "Downloads", "DRE_Doutor DM2 Diabetes_2026_Marllon.xlsx");

const outputPath = path.join(process.cwd(), "src", "data", "dashboard-data.json");
const workbook = XLSX.readFile(workbookPath, { cellFormula: true, cellNF: true, cellStyles: false });

function aoa(sheetName) {
  const sheet = workbook.Sheets[sheetName];
  if (!sheet) throw new Error(`Aba nao encontrada: ${sheetName}`);
  return XLSX.utils.sheet_to_json(sheet, { header: 1, defval: null, raw: true, blankrows: true });
}

function cellAddress(rowIndex, colIndex) {
  return XLSX.utils.encode_cell({ r: rowIndex, c: colIndex });
}

function numberOrZero(value) {
  return typeof value === "number" && Number.isFinite(value) ? value : 0;
}

function cleanLabel(value) {
  const text = String(value ?? "").replace(/\s+/g, " ").trim();
  if (/[ÃÂ]/.test(text)) {
    return Buffer.from(text, "latin1").toString("utf8");
  }
  return text;
}

function normalizeKey(label) {
  return cleanLabel(label)
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-zA-Z0-9]+/g, "_")
    .replace(/^_|_$/g, "")
    .toLowerCase();
}

function valueTypeFor(label, context = "general") {
  const text = normalizeKey(label);
  if (text.includes("lucratividade") || text.includes("rentabilidade")) return "percent";
  if (context === "dre") return "currency";
  if (
    text.includes("recepcionista") ||
    text.includes("vendedor") ||
    text.includes("agendador") ||
    text.includes("estagiario") ||
    text.includes("biomedico") ||
    text.includes("dias_uteis") ||
    text.includes("protocolos") ||
    text.includes("consultas")
  ) {
    return "count";
  }
  if (
    text.includes("ticket") ||
    text.includes("faturamento") ||
    text.includes("despesa") ||
    text.includes("salario") ||
    text.includes("comissao") ||
    text.includes("imposto") ||
    text.includes("investimento") ||
    text.includes("retorno") ||
    text.includes("pay") ||
    text.includes("resultado") ||
    text.includes("royalties") ||
    text.includes("cmv") ||
    text.includes("aluguel") ||
    text.includes("iptu") ||
    text.includes("software") ||
    text.includes("contador") ||
    text.includes("marketing") ||
    text.includes("materiais") ||
    text.includes("produto") ||
    text.includes("suplemento") ||
    text.includes("base")
  ) {
    return "currency";
  }
  return "number";
}

function categoryFor(label, rowNumber) {
  const text = cleanLabel(label).toLowerCase();
  if (rowNumber >= 4 && rowNumber <= 10) return "Receita";
  if (rowNumber >= 12 && rowNumber <= 24) return "RH";
  if (rowNumber >= 25 && rowNumber <= 38) return "Despesas Fixas";
  if (rowNumber >= 39 && rowNumber <= 45) return "Despesas Variaveis";
  if (rowNumber >= 46 && rowNumber <= 48) return "Impostos";
  if (rowNumber >= 49 && rowNumber <= 50) return "Franchising";
  if (text.includes("resultado") || text.includes("lucratividade") || text.includes("pay")) return "Resultado";
  if (text.includes("investimento")) return "Investimento";
  return "Outros";
}

const dreRows = aoa("DRE");
const monthLabels = dreRows[2].slice(5, 17).map(cleanLabel);
const dre = [];

for (let r = 3; r < dreRows.length; r += 1) {
  const label = cleanLabel(dreRows[r][4]);
  const values = dreRows[r].slice(5, 17);
  const hasValues = values.some((value) => typeof value === "number");
  if (!label || !hasValues) continue;

  dre.push({
    id: normalizeKey(label),
    label,
    category: categoryFor(label, r + 1),
    valueType: valueTypeFor(label, "dre"),
    source: {
      sheet: "DRE",
      labelCell: `DRE!${cellAddress(r, 4)}`,
      valueRange: `DRE!${cellAddress(r, 5)}:${cellAddress(r, 16)}`,
      rowNumber: r + 1,
    },
    values: monthLabels.map((month, index) => ({
      month,
      value: numberOrZero(values[index]),
      cell: `DRE!${cellAddress(r, index + 5)}`,
    })),
  });
}

function rowByLabel(label) {
  return dre.find((row) => normalizeKey(row.label) === normalizeKey(label));
}

const revenueRow = rowByLabel("Faturamento Total");
const expenseRow = rowByLabel("TOTAL DESPESAS");
const netRow = rowByLabel("RESULTADO LÍQUIDO");
const marginRow = rowByLabel("LUCRATIVIDADE (%)");
const investmentRow = rowByLabel("INVESTIMENTO INICIAL");
const paybackRow = rowByLabel("RETORNO IVESTIMENTO | PAY BACK");

const monthly = monthLabels.map((month, index) => ({
  month,
  revenue: revenueRow?.values[index]?.value ?? 0,
  expenses: expenseRow?.values[index]?.value ?? 0,
  netResult: netRow?.values[index]?.value ?? 0,
  margin: marginRow?.values[index]?.value ?? 0,
  cumulativeReturn: paybackRow?.values[index]?.value ?? 0,
}));

const totalRevenue = monthly.reduce((sum, item) => sum + item.revenue, 0);
const totalExpenses = monthly.reduce((sum, item) => sum + item.expenses, 0);
const totalNetResult = monthly.reduce((sum, item) => sum + item.netResult, 0);
const initialInvestment = investmentRow?.values.find((item) => item.value)?.value ?? 0;
const bestMonth = monthly.reduce((best, item) => (item.revenue > best.revenue ? item : best), monthly[0]);
const paybackMonth = monthly.find((item) => item.cumulativeReturn >= 0)?.month ?? "Após 12 meses";

const investmentRows = aoa("ESTIMATIVA DE INVESTIMENTO");
const investmentItems = [];
for (let r = 0; r < investmentRows.length; r += 1) {
  const label = cleanLabel(investmentRows[r][2]);
  const value = investmentRows[r][3];
  if (!label || typeof value !== "number" || !Number.isFinite(value) || value === 0) continue;
  investmentItems.push({
    label,
    value,
    color: ["#075C57", "#00A19A", "#12C2C2", "#F99D36", "#1D71B8", "#1192B1", "#12E8E8"][
      investmentItems.length % 7
    ],
    source: {
      sheet: "ESTIMATIVA DE INVESTIMENTO",
      labelCell: `ESTIMATIVA DE INVESTIMENTO!${cellAddress(r, 2)}`,
      valueCell: `ESTIMATIVA DE INVESTIMENTO!${cellAddress(r, 3)}`,
      rowNumber: r + 1,
    },
  });
}

const baseRows = aoa("BASE");
const baseMonths = baseRows[4].slice(3, 15).map(cleanLabel);
const assumptions = [];
for (let r = 0; r < baseRows.length; r += 1) {
  const label = cleanLabel(baseRows[r][1]);
  const values = baseRows[r].slice(3, 15);
  if (!label || !values.some((value) => value !== null && value !== "")) continue;
  assumptions.push({
    id: normalizeKey(label),
    label,
    valueType: valueTypeFor(label),
    source: {
      sheet: "BASE",
      labelCell: `BASE!${cellAddress(r, 1)}`,
      valueRange: `BASE!${cellAddress(r, 3)}:${cellAddress(r, 14)}`,
      rowNumber: r + 1,
    },
    values: baseMonths.map((month, index) => ({
      month,
      value: values[index],
      cell: `BASE!${cellAddress(r, index + 3)}`,
    })),
  });
}

const data = {
  generatedAt: new Date().toISOString(),
  workbook: {
    fileName: path.basename(workbookPath),
    sourcePath: workbookPath,
    sheets: workbook.SheetNames,
  },
  months: monthLabels,
  kpis: {
    initialInvestment,
    totalRevenue,
    totalExpenses,
    totalNetResult,
    weightedMargin: totalRevenue ? totalNetResult / totalRevenue : 0,
    bestMonth: bestMonth?.month,
    bestMonthRevenue: bestMonth?.revenue,
    paybackMonth,
  },
  monthly,
  dre,
  investmentItems,
  assumptions,
  validation: [
    {
      metric: "Faturamento acumulado 12 meses",
      value: totalRevenue,
      source: revenueRow?.source.valueRange,
      status: "OK",
    },
    {
      metric: "Resultado liquido acumulado",
      value: totalNetResult,
      source: netRow?.source.valueRange,
      status: "OK",
    },
    {
      metric: "Investimento inicial",
      value: initialInvestment,
      source: investmentRow?.values.find((item) => item.value)?.cell,
      status: "OK",
    },
    {
      metric: "Payback",
      value: paybackMonth,
      source: paybackRow?.source.valueRange,
      status: "OK",
    },
  ],
};

fs.mkdirSync(path.dirname(outputPath), { recursive: true });
fs.writeFileSync(outputPath, `${JSON.stringify(data, null, 2)}\n`, "utf8");
console.log(`Dados extraidos de ${workbookPath}`);
console.log(`Arquivo gerado: ${outputPath}`);
