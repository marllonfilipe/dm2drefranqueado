import React, { useMemo, useState } from "react";
import { createRoot } from "react-dom/client";
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  ComposedChart,
  LabelList,
  Legend,
  Line,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import {
  BarChart3,
  BriefcaseBusiness,
  Calculator,
  ChevronDown,
  Database,
  Download,
  Edit3,
  Filter,
  LineChart,
  PieChart as PieChartIcon,
  RotateCcw,
  Search,
  SlidersHorizontal,
  Table2,
  TrendingUp,
  X,
} from "lucide-react";
import data from "./data/dashboard-data.json";
import "./styles.css";

const brand = {
  green: "#075C57",
  cyan: "#00A19A",
  yellow: "#F99D36",
  blue: "#1D71B8",
  blue2: "#1192B1",
};

const tabs = [
  { id: "executive", label: "Executivo", icon: BriefcaseBusiness },
  { id: "simulator", label: "Simulador", icon: SlidersHorizontal },
  { id: "dre", label: "DRE", icon: Table2 },
  { id: "investment", label: "Investimento", icon: PieChartIcon },
  { id: "assumptions", label: "Premissas", icon: Database },
];

const pageMeta = {
  executive: {
    title: "Visao executiva",
    description: "Acompanhe faturamento, custos, resultado e payback do cenario ativo.",
  },
  simulator: {
    title: "Simulador",
    description: "Modele premissas e despesas sem alterar a base original do Excel.",
  },
  dre: {
    title: "DRE",
    description: "Analise linhas, categorias e resultados mensais do demonstrativo.",
  },
  investment: {
    title: "Investimento",
    description: "Revise a composicao do investimento inicial e itens editaveis.",
  },
  assumptions: {
    title: "Premissas",
    description: "Compare dias uteis, atendimentos, ticket medio e faturamento.",
  },
};

const scenarioProfiles = {
  excel: { label: "Padrao Excel", revenue: 1, rh: 1, fixed: 1, variable: 1, tax: 1, franchising: 1 },
  custom: { label: "Cenario criado", revenue: 1, rh: 1, fixed: 1, variable: 1, tax: 1, franchising: 1 },
  conservative: { label: "Conservador", revenue: 0.9, rh: 1, fixed: 1.03, variable: 1.02, tax: 1, franchising: 1 },
  optimistic: { label: "Otimista", revenue: 1.12, rh: 1.02, fixed: 1.02, variable: 1.04, tax: 1, franchising: 1 },
};

const expenseFields = [
  { key: "rh", label: "RH", source: "(-) Despesas RH Contabil" },
  { key: "fixed", label: "Fixas", source: "(-) Despesas Fixas" },
  { key: "variable", label: "Variaveis", source: "(-) Despesas Variaveis" },
  { key: "tax", label: "Impostos", source: "(-) Impostos" },
  { key: "franchising", label: "Franchising", source: "(-) Despesa Franchising" },
];

const expenseLeafRows = data.dre.filter(isScenarioExpenseLeaf);
const expenseEditableRows = expenseLeafRows.filter((row) => !isLockedScenarioExpense(row));
const revenueDetailRows = data.dre.filter(
  (row) => row.category === "Receita" && !normalize(row.label).includes("faturamento total"),
);

const categories = ["Todos", ...Array.from(new Set(data.dre.map((row) => row.category)))];

const moneyFormatter = new Intl.NumberFormat("pt-BR", {
  style: "currency",
  currency: "BRL",
  maximumFractionDigits: 0,
});

const decimalMoneyFormatter = new Intl.NumberFormat("pt-BR", {
  style: "currency",
  currency: "BRL",
  maximumFractionDigits: 2,
});

const numberFormatter = new Intl.NumberFormat("pt-BR", { maximumFractionDigits: 2 });
const percentFormatter = new Intl.NumberFormat("pt-BR", { style: "percent", maximumFractionDigits: 1 });

function normalize(value) {
  return String(value)
    .replace(/Ã¡/g, "a")
    .replace(/Ã©/g, "e")
    .replace(/Ã­/g, "i")
    .replace(/Ã³/g, "o")
    .replace(/Ãº/g, "u")
    .replace(/Ã£/g, "a")
    .replace(/Ã§/g, "c")
    .replace(/Âº/g, "o")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-zA-Z0-9]+/g, " ")
    .toLowerCase()
    .trim();
}

function isScenarioExpenseLeaf(row) {
  const expenseCategories = ["RH", "Despesas Fixas", "Despesas Variaveis", "Impostos", "Franchising"];
  const label = normalize(row.label);
  if (!expenseCategories.includes(row.category)) return false;
  if (label.startsWith("despesas") || label.startsWith("impostos")) return false;
  if (label.includes("despesas rh contabil") || label.includes("despesas rh financeira")) return false;
  if (label.includes("despesas fixas") || label.includes("despesas variaveis") || label.includes("despesa franchising")) return false;
  return row.values.some((item) => typeof item.value === "number" && item.value !== 0);
}

function isRevenueRateExpense(row) {
  const label = normalize(row.label);
  return (
    label.includes("simples nacional suplementos") ||
    label.includes("simples nacional servicos") ||
    label.includes("verba de marketing") ||
    label.includes("comissao fdv") ||
    label.includes("taxas cartao") ||
    label.includes("royalties")
  );
}

function revenueRateBase(row, index, revenue) {
  const label = normalize(row.label);
  const excelRevenue = getMonthlyValue("Faturamento Total", index);

  if (label.includes("simples nacional suplementos")) {
    const excelBase = numericAssumption("base_suplementos", index, 0);
    const baseShare = excelRevenue ? excelBase / excelRevenue : 0;
    return revenue * baseShare;
  }

  if (label.includes("simples nacional servicos")) {
    const excelBase = numericAssumption("base_servicos", index, 0);
    const baseShare = excelRevenue ? excelBase / excelRevenue : 0;
    return revenue * baseShare;
  }

  return revenue;
}

function revenueRateBaseLabel(row) {
  const label = normalize(row.label);
  if (label.includes("simples nacional suplementos")) return " da base de suplementos";
  if (label.includes("simples nacional servicos")) return " da base de servicos";
  return " do faturamento";
}

function scenarioRevenueRateBase(row, revenue) {
  const label = normalize(row.label);
  if (label.includes("simples nacional suplementos")) return 0;
  if (label.includes("simples nacional servicos")) return revenue;
  return revenue;
}

function isValeTransport(row) {
  return normalize(row.label).includes("vale transporte");
}

function isLockedScenarioExpense(row) {
  const label = normalize(row.label);
  return isValeTransport(row) || label.includes("rentabilidade");
}

function isRevenueLine(row) {
  return row.category === "Receita";
}

function scenarioRevenueLineValue(row, index, protocolRevenue) {
  const label = normalize(row.label);
  if (label === "protocolos") return protocolRevenue;
  return 0;
}

function scenarioRevenueTotal(index, protocolRevenue) {
  return revenueDetailRows.reduce(
    (sum, row) => sum + scenarioRevenueLineValue(row, index, protocolRevenue),
    0,
  );
}

function defaultExpenseControlValue(row, index = 0) {
  if (!row) return 1;
  if (!isRevenueRateExpense(row)) return row.values[index]?.value || 0;

  const revenue = getMonthlyValue("Faturamento Total", index);
  const base = revenueRateBase(row, index, revenue);
  const value = row.values[index]?.value || 0;
  return base ? value / base : 0;
}

function expenseControlValue(row, controls, index = 0) {
  const value = controls.expenseItems[row.id];
  return Number.isFinite(value) ? value : defaultExpenseControlValue(row, index);
}

function optionalNumber(value) {
  if (value === "" || value === null || value === undefined) return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

function rowByLabel(label) {
  return data.dre.find((row) => normalize(row.label) === normalize(label));
}

function getMonthlyValue(label, index) {
  return rowByLabel(label)?.values[index]?.value ?? 0;
}

function assumptionById(id) {
  return data.assumptions.find((item) => item.id === id);
}

function numericAssumption(id, index, fallback) {
  const value = assumptionById(id)?.values[index]?.value;
  return typeof value === "number" && Number.isFinite(value) ? value : fallback;
}

function formatMoney(value) {
  return moneyFormatter.format(value || 0);
}

function formatCompactMoney(value) {
  if (Math.abs(value) >= 1000000) return `R$ ${(value / 1000000).toFixed(2).replace(".", ",")} mi`;
  if (Math.abs(value) >= 1000) return `R$ ${(value / 1000).toFixed(0).replace(".", ",")} mil`;
  return formatMoney(value);
}

function formatValue(value, type = "currency") {
  if (value === null || value === undefined || value === "") return "-";
  if (typeof value !== "number") return String(value);
  if (type === "percent") return percentFormatter.format(value);
  if (type === "count" || type === "number") return numberFormatter.format(value);
  return decimalMoneyFormatter.format(value);
}

function formatDreDisplay(row, value, monthScenario) {
  if (normalize(row.label).includes("lucratividade") && monthScenario) {
    return `${percentFormatter.format(value || 0)} | ${formatMoney(monthScenario.netResult)}`;
  }
  return formatValue(value, row.valueType);
}

function formatDreTotalDisplay(row, value, totalResult) {
  if (normalize(row.label).includes("lucratividade")) {
    return `${percentFormatter.format(value || 0)} | ${formatMoney(totalResult)}`;
  }
  return formatValue(value, row.valueType);
}

function formatLabelValue(value) {
  return formatCompactMoney(value);
}

function rangeIndexes(startMonth, endMonth) {
  const start = data.months.indexOf(startMonth);
  const end = data.months.indexOf(endMonth);
  return [Math.max(0, Math.min(start, end)), Math.max(start, end)];
}

function baseBreakdown(month, index) {
  return {
    month,
    revenue: getMonthlyValue("Faturamento Total", index),
    rh: getMonthlyValue("(-) Despesas RH Contabil", index),
    fixed: getMonthlyValue("(-) Despesas Fixas", index),
    variable: getMonthlyValue("(-) Despesas Variaveis", index),
    tax: getMonthlyValue("(-) Impostos", index),
    franchising: getMonthlyValue("(-) Despesa Franchising", index),
  };
}

const defaultPremises = data.months.map((month, index) => {
  const ticket = numericAssumption("ticket_medio", index, 5900);
  const days = 22;
  const revenue = getMonthlyValue("Faturamento Total", index);
  const attendances = ticket && days ? Math.round(revenue / ticket / days) : 0;
  return { month, days, attendances, ticket };
});

const defaultInvestmentItems = data.investmentItems.map((item) => ({
  label: item.label,
  value: item.value,
  color: item.color,
  locked: normalize(item.label).includes("taxa de franquia"),
}));

const defaultControls = {
  premises: defaultPremises,
  expenses: { rh: 1, fixed: 1, variable: 1, tax: 1, franchising: 1 },
  expenseItems: Object.fromEntries(expenseEditableRows.map((row) => [row.id, defaultExpenseControlValue(row)])),
  investmentItems: defaultInvestmentItems,
};

function investmentTotal(items) {
  return items.reduce((sum, item) => sum + (Number(item.value) || 0), 0);
}

function scenarioExpenseLineValue(row, index, revenue, controls) {
  if (isValeTransport(row)) {
    const salaryRow = data.dre.find((item) => normalize(item.label) === "salarios");
    const salary = salaryRow ? scenarioExpenseLineValue(salaryRow, index, revenue, controls) : 0;
    return salary * 0.1;
  }

  if (isRevenueRateExpense(row)) {
    return scenarioRevenueRateBase(row, revenue) * expenseControlValue(row, controls, index);
  }

  return expenseControlValue(row, controls, index);
}

function scenarioExpenseGroupValue(category, index, revenue, controls) {
  return expenseLeafRows
    .filter((row) => row.category === category)
    .reduce((sum, row) => sum + scenarioExpenseLineValue(row, index, revenue, controls), 0);
}

function scenarioRhFinancialValue(index, revenue, controls) {
  return expenseLeafRows
    .filter((row) => {
      const label = normalize(row.label);
      return row.category === "RH" && !label.includes("provisao");
    })
    .reduce((sum, row) => sum + scenarioExpenseLineValue(row, index, revenue, controls), 0);
}

function calculateScenario(months, indexes, controls, useExcelBase) {
  let cumulative = -investmentTotal(controls.investmentItems);
  const initialInvestment = investmentTotal(controls.investmentItems);

  return months.map((month, listIndex) => {
    const sourceIndex = indexes[listIndex];
    const base = baseBreakdown(month, sourceIndex);
    const premise = controls.premises[sourceIndex] || defaultPremises[sourceIndex];
    const protocolRevenue = premise.days * premise.attendances * premise.ticket;
    const revenue = useExcelBase ? base.revenue : scenarioRevenueTotal(sourceIndex, protocolRevenue);
    const rh = useExcelBase ? base.rh : scenarioExpenseGroupValue("RH", sourceIndex, revenue, controls);
    const rhFinancial = useExcelBase
      ? getMonthlyValue("(-) Despesas RH Financeira", sourceIndex)
      : scenarioRhFinancialValue(sourceIndex, revenue, controls);
    const fixed = useExcelBase ? base.fixed : scenarioExpenseGroupValue("Despesas Fixas", sourceIndex, revenue, controls);
    const variable = useExcelBase ? base.variable : scenarioExpenseGroupValue("Despesas Variaveis", sourceIndex, revenue, controls);
    const tax = useExcelBase ? base.tax : scenarioExpenseGroupValue("Impostos", sourceIndex, revenue, controls);
    const franchising = useExcelBase ? base.franchising : scenarioExpenseGroupValue("Franchising", sourceIndex, revenue, controls);
    const itemizedExpenses = rh + fixed + variable + tax + franchising;
    const expenses = useExcelBase ? getMonthlyValue("TOTAL DESPESAS", sourceIndex) : itemizedExpenses;
    const netResult = revenue - expenses;
    const rentability = initialInvestment ? netResult / initialInvestment : 0;
    cumulative += netResult;

    return {
      ...base,
      days: premise.days,
      attendances: premise.attendances,
      ticket: premise.ticket,
      initialInvestment: sourceIndex === 0 ? initialInvestment : 0,
      revenue,
      rh,
      rhFinancial,
      fixed,
      variable,
      tax,
      franchising,
      expenses,
      netResult,
      margin: revenue ? netResult / revenue : 0,
      rentability,
      cumulativeReturn: cumulative,
    };
  });
}

function scenarioDreValue(row, index, monthScenario, controls, useExcelBase) {
  const excelValue = row.values[index]?.value ?? 0;
  if (useExcelBase || !monthScenario) return excelValue;

  const label = normalize(row.label);
  const derivedRows = {
    [normalize("Faturamento Total")]: monthScenario.revenue,
    [normalize("(-) Despesas RH Contabil")]: monthScenario.rh,
    [normalize("(-) Despesas RH Financeira")]: monthScenario.rhFinancial,
    [normalize("(-) Despesas Fixas")]: monthScenario.fixed,
    [normalize("(-) Despesas Variaveis")]: monthScenario.variable,
    [normalize("(-) Impostos")]: monthScenario.tax,
    [normalize("(-) Despesa Franchising")]: monthScenario.franchising,
    [normalize("TOTAL DESPESAS")]: monthScenario.expenses,
    [normalize("RESULTADO LIQUIDO")]: monthScenario.netResult,
    [normalize("LUCRATIVIDADE (%)")]: monthScenario.margin,
    [normalize("INVESTIMENTO INICIAL")]: monthScenario.initialInvestment,
    [normalize("RETORNO IVESTIMENTO | PAY BACK")]: monthScenario.cumulativeReturn,
    [normalize("RETORNO INVESTIMENTO | PAY BACK")]: monthScenario.cumulativeReturn,
    [normalize("RENTABILIDADE (%)")]: monthScenario.rentability,
  };

  if (Object.prototype.hasOwnProperty.call(derivedRows, label)) {
    return derivedRows[label];
  }

  if (expenseLeafRows.some((expenseRow) => expenseRow.id === row.id)) {
    return scenarioExpenseLineValue(row, index, monthScenario.revenue, controls);
  }

  if (isRevenueLine(row)) {
    return scenarioRevenueLineValue(row, index, monthScenario.days * monthScenario.attendances * monthScenario.ticket);
  }

  return 0;
}

function sumBy(items, field) {
  return items.reduce((sum, item) => sum + (item[field] || 0), 0);
}

function presetControls(profile, current) {
  return {
    ...current,
    premises: current.premises.map((item) => ({
      ...item,
      attendances: Math.max(0, Math.round(item.attendances * profile.revenue)),
    })),
    expenses: {
      rh: profile.rh,
      fixed: profile.fixed,
      variable: profile.variable,
      tax: profile.tax,
      franchising: profile.franchising,
    },
    expenseItems: Object.fromEntries(
      Object.entries(current.expenseItems).map(([key, value]) => {
        const row = data.dre.find((item) => item.id === key);
        const currentValue = Number.isFinite(value) ? value : defaultExpenseControlValue(row);
        return [key, isRevenueRateExpense(row) ? currentValue : profile.fixed];
      }),
    ),
  };
}

function App() {
  const [activeTab, setActiveTab] = useState("executive");
  const [startMonth, setStartMonth] = useState(data.months[0]);
  const [endMonth, setEndMonth] = useState(data.months[data.months.length - 1]);
  const [category, setCategory] = useState("Todos");
  const [selectedLine, setSelectedLine] = useState("Todos");
  const [scenario, setScenario] = useState("excel");
  const [controls, setControls] = useState(defaultControls);
  const [editModal, setEditModal] = useState(null);

  const [startIndex, endIndex] = rangeIndexes(startMonth, endMonth);
  const visibleMonths = data.months.slice(startIndex, endIndex + 1);
  const visibleIndexes = visibleMonths.map((_, index) => startIndex + index);

  const scenarioMonthly = useMemo(
    () => calculateScenario(visibleMonths, visibleIndexes, controls, scenario === "excel"),
    [visibleMonths.join("|"), visibleIndexes.join("|"), controls, scenario],
  );
  const annualMonthly = useMemo(
    () => calculateScenario(data.months, data.months.map((_, index) => index), controls, scenario === "excel"),
    [controls, scenario],
  );

  const filteredRows = useMemo(
    () => data.dre.filter((row) => category === "Todos" || row.category === category),
    [category],
  );

  const selectedRow = data.dre.find((row) => row.label === selectedLine) || rowByLabel("Faturamento Total") || data.dre[0];
  const selectedLineData = selectedRow.values.slice(startIndex, endIndex + 1).map((item, index) => ({
    month: item.month,
    value: scenarioDreValue(selectedRow, startIndex + index, scenarioMonthly[index], controls, scenario === "excel"),
  }));
  const totals = {
    revenue: sumBy(scenarioMonthly, "revenue"),
    expenses: sumBy(scenarioMonthly, "expenses"),
    netResult: sumBy(scenarioMonthly, "netResult"),
    margin: sumBy(scenarioMonthly, "revenue")
      ? sumBy(scenarioMonthly, "netResult") / sumBy(scenarioMonthly, "revenue")
      : 0,
  };
  const paybackMonth = scenarioMonthly.find((month) => month.cumulativeReturn >= 0)?.month || "Apos o periodo";

  function changeScenario(nextScenario) {
    setScenario(nextScenario);
    if (nextScenario !== "excel" && nextScenario !== "custom") {
      setControls((current) => presetControls(scenarioProfiles[nextScenario], current));
    }
  }

  function openScenarioEditor() {
    setScenario("custom");
    setEditModal("scenario");
  }

  function openExpenseEditor() {
    setScenario("custom");
    setEditModal("expenses");
  }

  function openPremiseEditor() {
    setScenario("custom");
    setEditModal("premises");
  }

  function exportPdf() {
    window.print();
  }

  const topAction = {
    simulator: { label: "Editar cenario", action: openScenarioEditor },
    dre: { label: "Editar DRE", action: openExpenseEditor },
    assumptions: { label: "Editar premissas", action: openPremiseEditor },
  }[activeTab];

  return (
    <main className="app-shell">
      <aside className="sidebar">
        <div className="brand-block">
          <img src="/assets/doutor-dm2-logo-dark.png" alt="Doutor DM2" />
        </div>
        <nav className="nav-list" aria-label="Navegacao da dashboard">
          {tabs.map((tab) => {
            const Icon = tab.icon;
            return (
              <button
                className={`nav-item ${activeTab === tab.id ? "active" : ""}`}
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
              >
                <Icon size={17} />
                <span>{tab.label}</span>
              </button>
            );
          })}
        </nav>
      </aside>

      <section className="content">
        <header className="topbar">
          <div>
            <h1>{pageMeta[activeTab].title}</h1>
            <p>{pageMeta[activeTab].description}</p>
          </div>
          <div className="topbar-actions">
            {topAction && (
              <button className="ghost-button" onClick={topAction.action}>
                <Edit3 size={16} />
                {topAction.label}
              </button>
            )}
            <button className="print-button" onClick={exportPdf}>
              <Download size={16} />
              Baixar PDF
            </button>
          </div>
        </header>

        <Filters
          startMonth={startMonth}
          endMonth={endMonth}
          category={category}
          scenario={scenario}
          setStartMonth={setStartMonth}
          setEndMonth={setEndMonth}
          setCategory={setCategory}
          setScenario={changeScenario}
        />
        <AnnualPrintReport monthly={annualMonthly} controls={controls} scenario={scenario} />

        {activeTab === "executive" && (
          <ExecutiveView
            monthly={scenarioMonthly}
            totals={totals}
            paybackMonth={paybackMonth}
            selectedRow={selectedRow}
            selectedLineData={selectedLineData}
          />
        )}
        {activeTab === "simulator" && (
          <SimulatorView
            monthly={scenarioMonthly}
            totals={totals}
            paybackMonth={paybackMonth}
            scenario={scenario}
            controls={controls}
            setControls={setControls}
            openEditor={openScenarioEditor}
          />
        )}
        {activeTab === "dre" && (
          <DreView
            rows={filteredRows}
            selectedRow={selectedRow}
            selectedLineData={selectedLineData}
            startIndex={startIndex}
            endIndex={endIndex}
            scenarioMonthly={scenarioMonthly}
            scenario={scenario}
            controls={controls}
            selectedLine={selectedLine}
            setSelectedLine={setSelectedLine}
            category={category}
            setCategory={setCategory}
            openEditor={openExpenseEditor}
          />
        )}
        {activeTab === "investment" && (
          <InvestmentView controls={controls} setControls={setControls} openEditor={() => setEditModal("investment")} />
        )}
        {activeTab === "assumptions" && (
          <AssumptionsView
            controls={controls}
            monthly={scenarioMonthly}
            setControls={setControls}
            startIndex={startIndex}
            endIndex={endIndex}
            openEditor={openPremiseEditor}
          />
        )}
      </section>

      {editModal === "scenario" && (
        <ScenarioModal mode="full" controls={controls} setControls={setControls} onClose={() => setEditModal(null)} />
      )}
      {editModal === "expenses" && (
        <ScenarioModal mode="expenses" controls={controls} setControls={setControls} onClose={() => setEditModal(null)} />
      )}
      {editModal === "premises" && (
        <ScenarioModal mode="premises" controls={controls} setControls={setControls} onClose={() => setEditModal(null)} />
      )}
      {editModal === "investment" && (
        <InvestmentModal controls={controls} setControls={setControls} onClose={() => setEditModal(null)} />
      )}
    </main>
  );
}

function Filters(props) {
  return (
    <section className="filter-bar" aria-label="Filtros principais">
      <FilterSelect icon={Filter} label="Inicio" value={props.startMonth} onChange={props.setStartMonth}>
        {data.months.map((month) => (
          <option key={month}>{month}</option>
        ))}
      </FilterSelect>
      <FilterSelect icon={Filter} label="Fim" value={props.endMonth} onChange={props.setEndMonth}>
        {data.months.map((month) => (
          <option key={month}>{month}</option>
        ))}
      </FilterSelect>
      <FilterSelect icon={Calculator} label="Cenario" value={props.scenario} onChange={props.setScenario}>
        {Object.entries(scenarioProfiles).map(([id, profile]) => (
          <option key={id} value={id}>
            {profile.label}
          </option>
        ))}
      </FilterSelect>
    </section>
  );
}

function FilterSelect({ icon: Icon, label, value, onChange, children }) {
  return (
    <label className="filter-control">
      <span>
        <Icon size={14} />
        {label}
      </span>
      <div className="select-wrap">
        <select value={value} onChange={(event) => onChange(event.target.value)}>
          {children}
        </select>
        <ChevronDown size={14} />
      </div>
    </label>
  );
}

function ExecutiveView({ monthly, totals, paybackMonth, selectedRow, selectedLineData }) {
  const costRatio = totals.revenue ? totals.expenses / totals.revenue : 0;
  const kpis = [
    { label: "Investimento", value: formatMoney(data.kpis.initialInvestment), tone: "neutral" },
    { label: "Faturamento", value: formatCompactMoney(totals.revenue), tone: "positive" },
    { label: "Resultado", value: formatCompactMoney(totals.netResult), tone: totals.netResult >= 0 ? "positive" : "negative" },
    { label: "Payback", value: paybackMonth, tone: "neutral" },
  ];

  return (
    <div className="view-grid">
      <section className="kpi-grid">
        {kpis.map((kpi) => (
          <article className={`metric-card ${kpi.tone}`} key={kpi.label}>
            <span>{kpi.label}</span>
            <strong>{kpi.value}</strong>
          </article>
        ))}
      </section>
      <section className="panel wide">
        <PanelTitle icon={TrendingUp} title="Trajetoria financeira" />
        <div className="relation-strip">
          <span>Custos = {percentFormatter.format(costRatio)} do faturamento no periodo.</span>
          <span>Resultado = faturamento - despesas totais.</span>
        </div>
        <div className="chart-large">
          <ResponsiveContainer>
            <ComposedChart data={monthly}>
              <CartesianGrid strokeDasharray="3 3" stroke="#D8E5EA" />
              <XAxis dataKey="month" tick={{ fill: "#075C57", fontSize: 11 }} />
              <YAxis tickFormatter={formatCompactMoney} tick={{ fill: "#075C57", fontSize: 11 }} />
              <Tooltip content={<MoneyTooltip />} />
              <Legend />
              <Bar dataKey="revenue" name="Faturamento" fill={brand.green} radius={[4, 4, 0, 0]}>
                <LabelList dataKey="revenue" position="top" formatter={formatLabelValue} className="bar-label" />
              </Bar>
              <Bar dataKey="expenses" name="Despesas" fill={brand.blue2} radius={[4, 4, 0, 0]}>
                <LabelList dataKey="expenses" position="top" formatter={formatLabelValue} className="bar-label" />
              </Bar>
              <Line type="monotone" dataKey="netResult" name="Resultado" stroke={brand.yellow} strokeWidth={3} />
            </ComposedChart>
          </ResponsiveContainer>
        </div>
      </section>
      <section className="panel">
        <PanelTitle icon={LineChart} title={selectedRow.label} />
        <div className="chart-medium">
          <ResponsiveContainer>
            <AreaChart data={selectedLineData}>
              <CartesianGrid strokeDasharray="3 3" stroke="#D8E5EA" />
              <XAxis dataKey="month" tick={{ fill: "#075C57", fontSize: 11 }} />
              <YAxis tickFormatter={formatCompactMoney} tick={{ fill: "#075C57", fontSize: 11 }} />
              <Tooltip content={<LineTooltip row={selectedRow} />} />
              <Area type="monotone" dataKey="value" name={selectedRow.label} fill="#E3FBFB" stroke={brand.blue} />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      </section>
      <ValidationPanel />
    </div>
  );
}

function SimulatorView({ monthly, totals, paybackMonth, scenario, setControls, openEditor }) {
  return (
    <div className="view-grid">
      <section className="panel wide">
        <div className="panel-actions">
          <PanelTitle icon={Calculator} title="Simulador" />
          <div className="button-row">
            <button className="ghost-button" onClick={openEditor}>
              <Edit3 size={16} />
              Editar cenario
            </button>
            <button className="ghost-button" onClick={() => setControls(defaultControls)}>
              <RotateCcw size={16} />
              Reset
            </button>
          </div>
        </div>
        <div className="scenario-strip">
          <span>Base: {scenarioProfiles[scenario].label}</span>
          <span>Editar cenario aplica um mes-base aos 12 meses</span>
          <span>PDF mostra o ano completo</span>
        </div>
      </section>
      <section className="kpi-grid wide">
        <article className="metric-card positive">
          <span>Cenario</span>
          <strong>{scenarioProfiles[scenario].label}</strong>
        </article>
        <article className="metric-card positive">
          <span>Receita</span>
          <strong>{formatCompactMoney(totals.revenue)}</strong>
        </article>
        <article className={`metric-card ${totals.netResult >= 0 ? "positive" : "negative"}`}>
          <span>Resultado</span>
          <strong>{formatCompactMoney(totals.netResult)}</strong>
        </article>
        <article className="metric-card neutral">
          <span>Margem / Payback</span>
          <strong>
            {percentFormatter.format(totals.margin)} | {paybackMonth}
          </strong>
        </article>
      </section>
      <section className="panel wide">
        <PanelTitle icon={BarChart3} title="Cenario calculado" />
        <div className="chart-large">
          <ResponsiveContainer>
            <ComposedChart data={monthly}>
              <CartesianGrid strokeDasharray="3 3" stroke="#D8E5EA" />
              <XAxis dataKey="month" tick={{ fill: "#075C57", fontSize: 11 }} />
              <YAxis tickFormatter={formatCompactMoney} tick={{ fill: "#075C57", fontSize: 11 }} />
              <Tooltip content={<MoneyTooltip />} />
              <Legend />
              <Bar dataKey="revenue" name="Faturamento" fill={brand.green} radius={[4, 4, 0, 0]}>
                <LabelList dataKey="revenue" position="top" formatter={formatLabelValue} className="bar-label" />
              </Bar>
              <Bar dataKey="expenses" name="Despesas" fill={brand.blue2} radius={[4, 4, 0, 0]}>
                <LabelList dataKey="expenses" position="top" formatter={formatLabelValue} className="bar-label" />
              </Bar>
              <Line dataKey="cumulativeReturn" name="Retorno acumulado" stroke={brand.yellow} strokeWidth={3} />
            </ComposedChart>
          </ResponsiveContainer>
        </div>
      </section>
      <MonthlyScenarioTable monthly={monthly} />
    </div>
  );
}

function PremiseGrid({ controls, setControls, months, compact = false }) {
  const indexes = months.map((month) => data.months.indexOf(month));
  return (
    <div className={`premise-grid ${compact ? "compact-premise-grid" : ""}`}>
      {indexes.map((index) => {
        const item = controls.premises[index];
        return (
          <div className="premise-card" key={item.month}>
            <strong>{item.month}</strong>
            <ScenarioNumber label="Dias uteis" value={item.days} onChange={(value) => updatePremise(setControls, index, "days", value)} />
            <ScenarioNumber
              label="Atendimentos/dia"
              value={item.attendances}
              onChange={(value) => updatePremise(setControls, index, "attendances", value)}
            />
            <ScenarioNumber
              label="Ticket medio"
              value={item.ticket}
              step={100}
              money
              onChange={(value) => updatePremise(setControls, index, "ticket", value)}
            />
          </div>
        );
      })}
    </div>
  );
}

function updatePremise(setControls, index, key, value) {
  setControls((current) => ({
    ...current,
    premises: current.premises.map((item, itemIndex) =>
      itemIndex === index ? { ...item, [key]: Math.max(0, Number(value) || 0) } : item,
    ),
  }));
}

function ScenarioNumber({ label, value, onChange, step = 1, money = false, disabled = false, blankMode = false }) {
  const displayValue = blankMode ? value : Math.round(value || 0);
  return (
    <label className="scenario-number">
      <span>{label}</span>
      <input
        type="number"
        value={displayValue}
        placeholder="Digite aqui"
        step={step}
        disabled={disabled}
        onChange={(event) => onChange(blankMode ? event.target.value : Number(event.target.value || 0))}
      />
      {money && !blankMode && <small>{formatMoney(value)}</small>}
    </label>
  );
}

function MonthlyScenarioTable({ monthly }) {
  return (
    <section className="panel wide">
      <PanelTitle icon={Table2} title="Detalhe mensal" />
      <div className="table-wrap compact">
        <table>
          <thead>
            <tr>
              <th>Mes</th>
              <th>Dias</th>
              <th>Atend.</th>
              <th>Ticket</th>
              <th>Receita</th>
              <th>Despesas</th>
              <th>Resultado</th>
              <th>Margem</th>
            </tr>
          </thead>
          <tbody>
            {monthly.map((row) => (
              <tr key={row.month}>
                <td>{row.month}</td>
                <td>{numberFormatter.format(row.days)}</td>
                <td>{numberFormatter.format(row.attendances)}</td>
                <td>{formatMoney(row.ticket)}</td>
                <td>{formatMoney(row.revenue)}</td>
                <td>{formatMoney(row.expenses)}</td>
                <td>{formatMoney(row.netResult)}</td>
                <td>{percentFormatter.format(row.margin)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}

function DreView({
  rows,
  selectedRow,
  selectedLineData,
  startIndex,
  endIndex,
  scenarioMonthly,
  scenario,
  controls,
  selectedLine,
  setSelectedLine,
  category,
  setCategory,
  openEditor,
}) {
  const [searchTerm, setSearchTerm] = useState("");
  const [sortMode, setSortMode] = useState("default");
  const [page, setPage] = useState(1);
  const visibleMonths = data.months.slice(startIndex, endIndex + 1);
  const isAllLines = selectedLine === "Todos";
  const searchedRows = (isAllLines ? rows : rows.filter((row) => row.label === selectedLine)).filter((row) =>
    normalize(`${row.label} ${row.category}`).includes(normalize(searchTerm)),
  );
  const visibleRows = searchedRows.slice().sort((a, b) => {
    if (sortMode === "label") return a.label.localeCompare(b.label);
    if (sortMode === "category") return a.category.localeCompare(b.category);
    return 0;
  });
  const pageSize = 14;
  const totalPages = Math.max(1, Math.ceil(visibleRows.length / pageSize));
  const currentPage = Math.min(page, totalPages);
  const pagedRows = visibleRows.slice((currentPage - 1) * pageSize, currentPage * pageSize);
  const chartData = selectedLineData;
  const useExcelBase = scenario === "excel";

  return (
    <div className="view-grid">
      <section className="panel wide">
        <div className="panel-actions">
          <PanelTitle icon={Table2} title="DRE" />
          <div className="button-row">
            <label className="search-control">
              <Search size={14} />
              <input
                value={searchTerm}
                placeholder="Buscar"
                onChange={(event) => {
                  setSearchTerm(event.target.value);
                  setPage(1);
                }}
              />
            </label>
            <FilterSelect icon={BarChart3} label="Categoria" value={category} onChange={setCategory}>
              {categories.map((item) => (
                <option key={item}>{item}</option>
              ))}
            </FilterSelect>
            <FilterSelect icon={LineChart} label="Linha DRE" value={selectedLine} onChange={setSelectedLine}>
              <option value="Todos">Todos</option>
              {rows.map((row) => (
                <option key={row.label}>{row.label}</option>
              ))}
            </FilterSelect>
            <FilterSelect icon={Filter} label="Ordenar" value={sortMode} onChange={setSortMode}>
              <option value="default">Padrao</option>
              <option value="label">Descricao</option>
              <option value="category">Categoria</option>
            </FilterSelect>
            <button className="ghost-button" onClick={openEditor}>
              <Edit3 size={16} />
              Editar despesas
            </button>
          </div>
        </div>
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>Descricao</th>
                <th>Categoria</th>
                {visibleMonths.map((month) => (
                  <th key={month}>{month}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {pagedRows.map((row) => (
                <tr key={row.label} className={row.label === selectedRow.label ? "highlight-row" : ""}>
                  <td>
                    <strong>{row.label}</strong>
                  </td>
                  <td>{row.category}</td>
                  {visibleMonths.map((month, monthIndex) => (
                    <td key={`${row.label}-${month}`}>
                      {formatDreDisplay(
                        row,
                        scenarioDreValue(row, startIndex + monthIndex, scenarioMonthly[monthIndex], controls, useExcelBase),
                        scenarioMonthly[monthIndex],
                      )}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <div className="table-footer">
          <span>{visibleRows.length} linhas</span>
          <div>
            <button className="ghost-button" disabled={currentPage <= 1} onClick={() => setPage((value) => Math.max(1, value - 1))}>
              Anterior
            </button>
            <span>Pagina {currentPage} de {totalPages}</span>
            <button className="ghost-button" disabled={currentPage >= totalPages} onClick={() => setPage((value) => Math.min(totalPages, value + 1))}>
              Proxima
            </button>
          </div>
        </div>
      </section>
      {!isAllLines && (
        <section className="panel wide">
          <PanelTitle icon={LineChart} title={selectedRow.label} />
          <div className="chart-medium">
            <ResponsiveContainer>
              <BarChart data={chartData}>
                <CartesianGrid strokeDasharray="3 3" stroke="#D8E5EA" />
                <XAxis dataKey="month" tick={{ fill: "#075C57", fontSize: 11 }} />
                <YAxis tickFormatter={(value) => formatChartValue(value, selectedRow.valueType)} tick={{ fill: "#075C57", fontSize: 11 }} />
                <Tooltip content={<LineTooltip row={selectedRow} />} />
                <Bar dataKey="value" fill={brand.blue} radius={[6, 6, 0, 0]}>
                  <LabelList dataKey="value" position="top" formatter={(value) => formatChartValue(value, selectedRow.valueType)} className="bar-label" />
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </section>
      )}
    </div>
  );
}

function InvestmentView({ controls, setControls, openEditor }) {
  const items = controls.investmentItems;
  const topItems = items.slice().sort((a, b) => b.value - a.value).slice(0, 12);
  const total = investmentTotal(items);
  const franchiseFee = items.find((item) => item.locked)?.value || 0;
  const editableTotal = total - franchiseFee;
  return (
    <div className="investment-layout">
      <section className="investment-hero">
        <div>
          <span>Investimento inicial</span>
          <strong>{formatMoney(total)}</strong>
        </div>
        <button className="ghost-button" onClick={openEditor}>
          <Edit3 size={16} />
          Editar
        </button>
      </section>
      <section className="investment-summary-grid">
        <article>
          <span>Taxa de franquia fixa</span>
          <strong>{formatMoney(franchiseFee)}</strong>
          <small>{percentFormatter.format(total ? franchiseFee / total : 0)} do total</small>
        </article>
        <article>
          <span>Itens editaveis</span>
          <strong>{formatMoney(editableTotal)}</strong>
          <small>{items.filter((item) => !item.locked).length} itens</small>
        </article>
        <article>
          <span>Maior item</span>
          <strong>{topItems[0]?.label || "-"}</strong>
          <small>{formatMoney(topItems[0]?.value || 0)}</small>
        </article>
      </section>
      <section className="investment-composition panel wide">
        <div className="panel-actions">
          <PanelTitle icon={PieChartIcon} title="Composicao do investimento" />
        </div>
        <div className="investment-composition-grid">
          <div className="investment-donut">
            <ResponsiveContainer>
              <PieChart>
                <Pie data={topItems} dataKey="value" nameKey="label" outerRadius={96} innerRadius={64} paddingAngle={2}>
                  {topItems.map((item) => (
                    <Cell key={item.label} fill={item.color} />
                  ))}
                </Pie>
                <Tooltip formatter={(value) => formatMoney(value)} />
              </PieChart>
            </ResponsiveContainer>
            <div className="donut-center">
              <span>Total</span>
              <strong>{formatCompactMoney(total)}</strong>
            </div>
          </div>
          <InvestmentLegend items={topItems} total={total} />
        </div>
      </section>
      <section className="panel wide">
        <PanelTitle icon={BarChart3} title="Ranking de investimento" />
        <InvestmentBars items={topItems} total={total} />
      </section>
    </div>
  );
}

function InvestmentLegend({ items, total }) {
  return (
    <div className="investment-legend-list">
      {items.map((item) => (
        <div className={item.locked ? "locked" : ""} key={item.label}>
          <i style={{ background: item.color }} />
          <span>{item.label}</span>
          <strong>{percentFormatter.format(total ? item.value / total : 0)}</strong>
        </div>
      ))}
    </div>
  );
}

function InvestmentBars({ items, total }) {
  const max = Math.max(...items.map((item) => item.value), 1);
  return (
    <div className="investment-bars">
      {items.map((item, index) => (
        <div className="investment-bar" key={item.label}>
          <div>
            <strong>{index + 1}. {item.label}</strong>
            <span>
              {formatMoney(item.value)}
              <small>{percentFormatter.format(total ? item.value / total : 0)}</small>
            </span>
          </div>
          <div className="bar-track">
            <i style={{ width: `${Math.max(5, (item.value / max) * 100)}%`, background: item.color }} />
          </div>
        </div>
      ))}
    </div>
  );
}

function AssumptionsView({ monthly, openEditor }) {
  const [premiseFilter, setPremiseFilter] = useState("Todos");
  const premiseChart = monthly.map((item) => ({
    month: item.month,
    days: item.days,
    revenue: item.revenue,
    attendances: item.attendances,
    ticket: item.ticket,
  }));
  const premiseRows = [
    { key: "days", label: "Dias uteis", type: "count" },
    { key: "attendances", label: "Atendimentos/dia", type: "count" },
    { key: "ticket", label: "Ticket medio", type: "currency" },
    { key: "revenue", label: "Faturamento", type: "currency" },
  ];
  const selectedPremiseRow = premiseRows.find((item) => item.key === premiseFilter) || premiseRows[3];
  const premiseTickFormatter = selectedPremiseRow.type === "count" ? numberFormatter.format : formatCompactMoney;
  const visiblePremiseRows = premiseFilter === "Todos" ? premiseRows : [selectedPremiseRow];

  return (
    <div className="view-grid">
      <section className="panel wide">
        <div className="panel-actions">
          <PanelTitle icon={Database} title="Premissas" />
          <div className="button-row">
            <FilterSelect icon={Filter} label="Tipo" value={premiseFilter} onChange={setPremiseFilter}>
              <option value="Todos">Todos</option>
              <option value="days">Dias uteis</option>
              <option value="revenue">Faturamento</option>
              <option value="attendances">Atendimentos</option>
              <option value="ticket">Ticket medio</option>
            </FilterSelect>
            <button className="ghost-button" onClick={openEditor}>
              <Edit3 size={16} />
              Editar premissas
            </button>
          </div>
        </div>
        <div className="chart-medium">
          <ResponsiveContainer>
            <ComposedChart data={premiseChart}>
              <CartesianGrid strokeDasharray="3 3" stroke="#D8E5EA" />
              <XAxis dataKey="month" tick={{ fill: "#075C57", fontSize: 11 }} />
              <YAxis
                yAxisId="main"
                tickFormatter={premiseFilter === "Todos" ? formatCompactMoney : premiseTickFormatter}
                tick={{ fill: "#075C57", fontSize: 11 }}
              />
              <Tooltip content={<PremiseTooltip type={premiseFilter} />} />
              <Legend />
              {premiseFilter === "Todos" && (
                <Bar yAxisId="main" dataKey="revenue" name="Faturamento" fill={brand.green} radius={[4, 4, 0, 0]}>
                  <LabelList dataKey="revenue" position="top" formatter={formatLabelValue} className="bar-label" />
                </Bar>
              )}
              {premiseFilter === "days" && (
                <Bar yAxisId="main" dataKey="days" name="Dias uteis" fill={brand.cyan} radius={[4, 4, 0, 0]}>
                  <LabelList dataKey="days" position="top" formatter={numberFormatter.format} className="bar-label" />
                </Bar>
              )}
              {premiseFilter === "revenue" && (
                <Bar yAxisId="main" dataKey="revenue" name="Faturamento" fill={brand.green} radius={[4, 4, 0, 0]}>
                  <LabelList dataKey="revenue" position="top" formatter={formatLabelValue} className="bar-label" />
                </Bar>
              )}
              {premiseFilter === "attendances" && (
                <Bar yAxisId="main" dataKey="attendances" name="Atendimentos/dia" fill={brand.blue2} radius={[4, 4, 0, 0]}>
                  <LabelList dataKey="attendances" position="top" formatter={numberFormatter.format} className="bar-label" />
                </Bar>
              )}
              {premiseFilter === "ticket" && (
                <Bar yAxisId="main" dataKey="ticket" name="Ticket medio" fill={brand.yellow} radius={[4, 4, 0, 0]}>
                  <LabelList dataKey="ticket" position="top" formatter={formatLabelValue} className="bar-label" />
                </Bar>
              )}
            </ComposedChart>
          </ResponsiveContainer>
        </div>
        <div className="table-wrap compact premise-table">
          <table>
            <thead>
              <tr>
                <th>Premissa</th>
                {premiseChart.map((item) => (
                  <th key={item.month}>{item.month}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {visiblePremiseRows.map((row) => (
                <tr key={row.key}>
                  <td><strong>{row.label}</strong></td>
                  {premiseChart.map((item) => (
                    <td key={item.month}>{formatValue(item[row.key], row.type)}</td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
      <ValidationPanel />
    </div>
  );
}

function ScenarioModal({ mode = "full", controls, setControls, onClose }) {
  const [draft, setDraft] = useState({
    expenses: {},
    base: { days: "", attendances: "", ticket: "" },
  });
  const showExpenses = mode === "full" || mode === "expenses";
  const showPremises = mode === "full" || mode === "premises";
  const title = mode === "expenses" ? "Editar despesas" : mode === "premises" ? "Editar premissas" : "Editar cenario";

  function applyDraft() {
    setControls((current) => {
      const nextExpenseItems = { ...current.expenseItems };
      if (showExpenses) {
        expenseEditableRows.forEach((row) => {
          const value = optionalNumber(draft.expenses[row.id]);
          nextExpenseItems[row.id] = isRevenueRateExpense(row)
            ? Math.max(0, value ?? 0) / 100
            : Math.max(0, value ?? 0);
        });
      }

      const days = optionalNumber(draft.base.days);
      const attendances = optionalNumber(draft.base.attendances);
      const ticket = optionalNumber(draft.base.ticket);
      const nextPremises = showPremises
        ? current.premises.map((item) => ({
            ...item,
            days: Math.max(0, days ?? 0),
            attendances: Math.max(0, attendances ?? 0),
            ticket: Math.max(0, ticket ?? 0),
          }))
        : current.premises;

      return { ...current, expenseItems: nextExpenseItems, premises: nextPremises };
    });
    onClose();
  }

  return (
    <div className="modal-backdrop" role="dialog" aria-modal="true">
      <div className="modal">
        <div className="modal-head">
          <PanelTitle icon={Edit3} title={title} />
          <button className="icon-button" onClick={onClose} aria-label="Fechar">
            <X size={18} />
          </button>
        </div>
        {showExpenses && (
          <div className="modal-section">
            <h3>Gastos DRE</h3>
            <div className="edit-grid expense-item-grid">
              {expenseEditableRows.map((row) => (
                <label className="editable-control" key={row.id}>
                  <span>{row.label}</span>
                  <input
                    type="number"
                    value={draft.expenses[row.id] || ""}
                    placeholder="Digite aqui"
                    min="0"
                    step="1"
                    onChange={(event) =>
                      setDraft((current) => ({
                        ...current,
                        expenses: { ...current.expenses, [row.id]: event.target.value },
                      }))
                    }
                  />
                  <b>
                    {draft.expenses[row.id] !== undefined && draft.expenses[row.id] !== ""
                      ? isRevenueRateExpense(row)
                        ? `${draft.expenses[row.id]}%`
                        : formatMoney(Number(draft.expenses[row.id]) || 0)
                      : isRevenueRateExpense(row)
                        ? `Atual: ${numberFormatter.format(expenseControlValue(row, controls) * 100)}%`
                        : `Atual: ${formatMoney(expenseControlValue(row, controls))}`}
                    {isRevenueRateExpense(row) ? revenueRateBaseLabel(row) : ""}
                  </b>
                </label>
              ))}
            </div>
          </div>
        )}
        {showPremises && (
          <div className="modal-section">
            <h3>Faturamento</h3>
            <div className="edit-grid three">
              <ScenarioNumber
                label="Dias uteis"
                value={draft.base.days}
                blankMode
                onChange={(value) => setDraft((current) => ({ ...current, base: { ...current.base, days: value } }))}
              />
              <ScenarioNumber
                label="Atendimentos/dia"
                value={draft.base.attendances}
                blankMode
                onChange={(value) => setDraft((current) => ({ ...current, base: { ...current.base, attendances: value } }))}
              />
              <ScenarioNumber
                label="Ticket medio"
                value={draft.base.ticket}
                step={100}
                blankMode
                onChange={(value) => setDraft((current) => ({ ...current, base: { ...current.base, ticket: value } }))}
              />
            </div>
          </div>
        )}
        <div className="modal-actions">
          <button className="ghost-button" onClick={() => setControls(defaultControls)}>
            <RotateCcw size={16} />
            Reset
          </button>
          <button className="print-button" onClick={applyDraft}>Aplicar</button>
        </div>
      </div>
    </div>
  );
}

function InvestmentModal({ controls, setControls, onClose }) {
  const lockedItems = controls.investmentItems.filter((item) => item.locked);
  const editableItems = controls.investmentItems.filter((item) => !item.locked);
  const orderedItems = [...lockedItems, ...editableItems];

  return (
    <div className="modal-backdrop" role="dialog" aria-modal="true">
      <div className="modal modal-narrow">
        <div className="modal-head">
          <PanelTitle icon={PieChartIcon} title="Editar investimento" />
          <button className="icon-button" onClick={onClose} aria-label="Fechar">
            <X size={18} />
          </button>
        </div>
        <div className="investment-modal-summary">
          <span>Total do investimento</span>
          <strong>{formatMoney(investmentTotal(controls.investmentItems))}</strong>
        </div>
        <div className="investment-edit-list">
          {orderedItems.map((item) => {
            const index = controls.investmentItems.findIndex((currentItem) => currentItem.label === item.label);
            return (
            <ScenarioNumber
              key={item.label}
              label={item.locked ? `${item.label} (fixo)` : item.label}
              value={item.value}
              step={1000}
              money
              disabled={item.locked}
              onChange={(value) =>
                setControls((current) => ({
                  ...current,
                  investmentItems: current.investmentItems.map((currentItem, currentIndex) =>
                    currentIndex === index ? { ...currentItem, value } : currentItem,
                  ),
                }))
              }
            />
            );
          })}
        </div>
        <div className="modal-actions">
          <button className="print-button" onClick={onClose}>Aplicar</button>
        </div>
      </div>
    </div>
  );
}

function AnnualPrintReport({ monthly, controls, scenario }) {
  const totalRevenue = sumBy(monthly, "revenue");
  const totalExpenses = sumBy(monthly, "expenses");
  const totalResult = sumBy(monthly, "netResult");
  const investment = investmentTotal(controls.investmentItems);
  const useExcelBase = scenario === "excel";
  const detailedDreRows = data.dre.map((row) => {
    const values = monthly.map((month, index) => scenarioDreValue(row, index, month, controls, useExcelBase));
    const numericValues = values.filter((value) => typeof value === "number" && Number.isFinite(value));
    return {
      row,
      values,
      total:
        row.valueType === "percent"
          ? numericValues.reduce((sum, value) => sum + value, 0) / Math.max(1, numericValues.length)
          : numericValues.reduce((sum, value) => sum + value, 0),
    };
  });
  const topInvestmentItems = controls.investmentItems.slice().sort((a, b) => b.value - a.value).slice(0, 10);

  return (
    <section className="print-report">
      <div className="print-cover">
        <img src="/assets/doutor-dm2-logo-dark.png" alt="Doutor DM2" />
        <h1>Relatorio financeiro anual</h1>
        <p>{scenarioProfiles[scenario].label}</p>
      </div>
      <div className="print-kpis">
        <div><span>Faturamento</span><strong>{formatMoney(totalRevenue)}</strong></div>
        <div><span>Despesas</span><strong>{formatMoney(totalExpenses)}</strong></div>
        <div><span>Resultado</span><strong>{formatMoney(totalResult)}</strong></div>
        <div><span>Investimento</span><strong>{formatMoney(investment)}</strong></div>
      </div>

      <PrintMonthlyChart title="Faturamento x despesas" data={monthly} />

      <PrintTable title="DRE mensal">
        <thead>
          <tr>
            <th>Mes</th>
            <th>Receita</th>
            <th>Despesas</th>
            <th>Resultado</th>
            <th>Margem</th>
            <th>Retorno</th>
          </tr>
        </thead>
        <tbody>
          {monthly.map((item) => (
            <tr key={item.month}>
              <td>{item.month}</td>
              <td>{formatMoney(item.revenue)}</td>
              <td>{formatMoney(item.expenses)}</td>
              <td>{formatMoney(item.netResult)}</td>
              <td>{percentFormatter.format(item.margin)}</td>
              <td>{formatMoney(item.cumulativeReturn)}</td>
            </tr>
          ))}
        </tbody>
      </PrintTable>

      <PrintTable title="Detalhamento completo DRE" className="page-break allow-break wide-print-table">
        <thead>
          <tr>
            <th>Linha DRE</th>
            <th>Categoria</th>
            {monthly.map((item) => (
              <th key={item.month}>{item.month}</th>
            ))}
            <th>Total</th>
          </tr>
        </thead>
        <tbody>
          {detailedDreRows.map(({ row, values, total }) => (
            <tr key={row.id}>
              <td>{row.label}</td>
              <td>{row.category}</td>
              {values.map((value, index) => (
                <td key={`${row.id}-${monthly[index].month}`}>{formatDreDisplay(row, value, monthly[index])}</td>
              ))}
              <td>{formatDreTotalDisplay(row, total, totalResult)}</td>
            </tr>
          ))}
        </tbody>
      </PrintTable>

      <PrintPremiseChart data={monthly} />

      <PrintTable title="Premissas do cenario">
        <thead>
          <tr>
            <th>Mes</th>
            <th>Dias uteis</th>
            <th>Atend./dia</th>
            <th>Ticket medio</th>
            <th>Faturamento</th>
          </tr>
        </thead>
        <tbody>
          {monthly.map((item) => (
            <tr key={item.month}>
              <td>{item.month}</td>
              <td>{item.days}</td>
              <td>{item.attendances}</td>
              <td>{formatMoney(item.ticket)}</td>
              <td>{formatMoney(item.revenue)}</td>
            </tr>
          ))}
        </tbody>
      </PrintTable>

      <PrintInvestmentChart items={topInvestmentItems} />

      <PrintTable title="Estimativa de investimento">
        <thead>
          <tr>
            <th>Item</th>
            <th>Valor</th>
          </tr>
        </thead>
        <tbody>
          {controls.investmentItems.map((item) => (
            <tr key={item.label}>
              <td>{item.locked ? `${item.label} (fixo)` : item.label}</td>
              <td>{formatMoney(item.value)}</td>
            </tr>
          ))}
        </tbody>
      </PrintTable>
    </section>
  );
}

function PrintMonthlyChart({ title, data }) {
  const max = Math.max(...data.flatMap((item) => [item.revenue, item.expenses]), 1);

  return (
    <div className="print-section">
      <h2>{title}</h2>
      <div className="print-chart-grid">
        {data.map((item) => (
          <div className="print-chart-column" key={item.month}>
            <div className="print-chart-bars">
              <span
                className="print-bar revenue"
                style={{ height: `${Math.max(8, (item.revenue / max) * 100)}%` }}
              />
              <span
                className="print-bar expense"
                style={{ height: `${Math.max(8, (item.expenses / max) * 100)}%` }}
              />
            </div>
            <strong>{item.month}</strong>
            <small>{formatCompactMoney(item.revenue)}</small>
          </div>
        ))}
      </div>
      <div className="print-legend">
        <span><i className="revenue" />Faturamento</span>
        <span><i className="expense" />Despesas</span>
      </div>
    </div>
  );
}

function PrintPremiseChart({ data }) {
  const max = Math.max(...data.map((item) => item.revenue), 1);

  return (
    <div className="print-section page-break">
      <h2>Premissas e faturamento</h2>
      <div className="print-premise-chart">
        {data.map((item) => (
          <div className="print-premise-row" key={item.month}>
            <span>{item.month}</span>
            <div>
              <i style={{ width: `${Math.max(5, (item.revenue / max) * 100)}%` }} />
            </div>
            <strong>{item.days} dias | {item.attendances} atend. | {formatCompactMoney(item.revenue)}</strong>
          </div>
        ))}
      </div>
    </div>
  );
}

function PrintInvestmentChart({ items }) {
  const max = Math.max(...items.map((item) => item.value), 1);

  return (
    <div className="print-section page-break">
      <h2>Composicao do investimento</h2>
      <div className="print-investment-chart">
        {items.map((item) => (
          <div className="print-investment-row" key={item.label}>
            <span>{item.label}</span>
            <div>
              <i
                style={{
                  width: `${Math.max(5, (item.value / max) * 100)}%`,
                  background: item.color,
                  borderTopColor: item.color,
                }}
              />
            </div>
            <strong>{formatMoney(item.value)}</strong>
          </div>
        ))}
      </div>
    </div>
  );
}

function PrintTable({ title, children, className = "" }) {
  return (
    <div className={`print-section ${className}`}>
      <h2>{title}</h2>
      <table>{children}</table>
    </div>
  );
}

function ValidationPanel() {
  return (
    <section className="panel">
      <PanelTitle icon={Database} title="Base Excel" />
      <div className="validation-list">
        {data.validation.map((item) => (
          <div className="validation-item" key={item.metric}>
            <strong>{item.metric}</strong>
            <span>{typeof item.value === "number" ? formatValue(item.value, "currency") : item.value}</span>
          </div>
        ))}
      </div>
    </section>
  );
}

function PanelTitle({ icon: Icon, title }) {
  return (
    <div className="panel-title">
      <div className="panel-icon">
        <Icon size={16} />
      </div>
      <h2>{title}</h2>
    </div>
  );
}

function formatChartValue(value, type) {
  if (type === "percent") return percentFormatter.format(value);
  if (type === "count" || type === "number") return numberFormatter.format(value);
  return formatCompactMoney(value);
}

function MoneyTooltip({ active, payload, label }) {
  if (!active || !payload?.length) return null;
  return (
    <div className="tooltip">
      <strong>{label}</strong>
      {payload.map((item) => (
        <span key={item.dataKey}>
          {item.name}: {formatMoney(item.value)}
        </span>
      ))}
    </div>
  );
}

function PremiseTooltip({ active, payload, label, type }) {
  if (!active || !payload?.length) return null;
  const item = payload[0];
  const value = type === "attendances" || type === "days" ? numberFormatter.format(item.value) : formatMoney(item.value);
  return (
    <div className="tooltip">
      <strong>{label}</strong>
      <span>
        {item.name}: {value}
      </span>
    </div>
  );
}

function LineTooltip({ active, payload, row }) {
  if (!active || !payload?.length) return null;
  return (
    <div className="tooltip">
      <strong>{payload[0].payload.month}</strong>
      <span>
        {row.label}: {formatValue(payload[0].value, row.valueType)}
      </span>
    </div>
  );
}

createRoot(document.getElementById("root")).render(<App />);
