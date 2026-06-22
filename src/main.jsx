import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { createRoot } from "react-dom/client";
import { initializeApp } from "firebase/app";
import {
  createUserWithEmailAndPassword,
  getAuth,
  onAuthStateChanged,
  signInWithEmailAndPassword,
  signOut,
  updateProfile,
} from "firebase/auth";
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
  LogOut,
  LineChart,
  PieChart as PieChartIcon,
  ShieldCheck,
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
  { id: "dre", label: "PRE", icon: Table2 },
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
    title: "PRE",
    description: "Previsao de Resultados por linhas, categorias e periodos mensais.",
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
  initial: { label: "Cenario inicial", revenue: 1, expense: 1, growth: 0 },
  conservative: { label: "Conservador", revenue: 0.9, expense: 1.03, growth: 0.01 },
  optimistic: { label: "Otimista", revenue: 1.12, expense: 1.02, growth: 0.04 },
  simulated: { label: "Simulado", revenue: 1, expense: 1, growth: 0.02 },
};

const EVALUATION_TICKET = 180;
const SCENARIO_STORAGE_KEY = "dm2-dre-scenarios-v5";
const allowedEmailDomain = "@doutordm2franquias.com.br";
const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY || "AIzaSyDxgAqWLSBYm08wQdya7YsqtjALs2tEs2Q",
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN || "dm2-dre-franqueado.firebaseapp.com",
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID || "dm2-dre-franqueado",
  appId: import.meta.env.VITE_FIREBASE_APP_ID,
};
const firebaseReady = Boolean(firebaseConfig.apiKey);
const firebaseApp = firebaseReady ? initializeApp(firebaseConfig) : null;
const firebaseAuth = firebaseReady ? getAuth(firebaseApp) : null;

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
    label.includes("cmv protocolos") ||
    label.includes("cmv suplementos") ||
    label === "cmv produtos" ||
    label.includes("cmv produto b") ||
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

  if (label.includes("cmv protocolos")) return getMonthlyValue("Protocolos", index);
  if (label.includes("cmv suplementos") || label === "cmv produtos" || label.includes("cmv produto b")) {
    return (
      getMonthlyValue("Produtos Alimenticios", index) +
      getMonthlyValue("Suplementos Extras", index) +
      getMonthlyValue("Produto A", index) +
      getMonthlyValue("Produto B", index)
    );
  }

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
  if (label.includes("cmv protocolos")) return " da receita de protocolos";
  if (label.includes("cmv suplementos") || label === "cmv produtos" || label.includes("cmv produto b")) {
    return " da receita de suplementos";
  }
  if (label.includes("simples nacional suplementos")) return " da base de suplementos";
  if (label.includes("simples nacional servicos")) return " da base de servicos";
  return " do faturamento";
}

function scenarioRevenueRateBase(row, revenue, monthScenario) {
  const label = normalize(row.label);
  if (label.includes("cmv protocolos")) return monthScenario?.protocolRevenue || 0;
  if (label.includes("cmv suplementos") || label === "cmv produtos" || label.includes("cmv produto b")) {
    return monthScenario?.supplementRevenue || 0;
  }
  if (label.includes("simples nacional suplementos")) return monthScenario?.supplementRevenue || 0;
  if (label.includes("simples nacional servicos")) {
    return (monthScenario?.evaluationRevenue || 0) + (monthScenario?.protocolRevenue || 0);
  }
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

function scenarioRevenueLineValue(row, monthScenario) {
  const label = normalize(row.label);
  if (label === "protocolos") return monthScenario?.protocolRevenue || 0;
  if (label === "consultas") return monthScenario?.evaluationRevenue || 0;
  if (label.includes("suplementos extras")) return monthScenario?.supplementRevenue || 0;
  if (label.includes("produtos alimenticios") || label === "produto a" || label === "produto b") return 0;
  return 0;
}

function scenarioRevenueTotal(monthScenario) {
  return (
    (monthScenario?.evaluationRevenue || 0) +
    (monthScenario?.protocolRevenue || 0) +
    (monthScenario?.supplementRevenue || 0)
  );
}

function defaultExpenseControlValue(row, index = 0) {
  if (!row) return 1;
  if (!isRevenueRateExpense(row)) return row.values[index]?.value || 0;

  const explicitRate = String(row.label).match(/(\d+(?:[.,]\d+)?)\s*%/);
  if (explicitRate) return Number(explicitRate[1].replace(",", ".")) / 100;

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
  const protocolTicket = numericAssumption("ticket_medio", index, 5900);
  const protocolRevenue = getMonthlyValue("Protocolos", index);
  const evaluationRevenue = getMonthlyValue("Consultas", index);
  const supplementRevenue =
    getMonthlyValue("Produtos Alimenticios", index) +
    getMonthlyValue("Suplementos Extras", index) +
    getMonthlyValue("Produto A", index) +
    getMonthlyValue("Produto B", index);
  const days = 22;
  const evaluationCount = evaluationRevenue / EVALUATION_TICKET;

  return {
    month,
    days,
    evaluationsPerDay: days ? evaluationCount / days : 0,
    protocolSales: protocolTicket ? protocolRevenue / protocolTicket : 0,
    protocolTicket,
    supplementEnabled: supplementRevenue > 0,
    supplementQuantity: supplementRevenue > 0 ? 1 : 0,
    supplementTicket: supplementRevenue,
  };
});

const defaultInvestmentItems = data.investmentItems.map((item) => ({
  label: item.label,
  value: normalize(item.label).includes("taxa de franquia")
    ? 120000
    : item.value,
  color: item.color,
  locked: false,
  monthly: data.months.map((_, index) =>
    index === 0
      ? normalize(item.label).includes("taxa de franquia")
        ? 120000
        : item.value
      : 0,
  ),
}));

function buildScenarioControls(scenarioId) {
  const profile = scenarioProfiles[scenarioId];
  return {
    modified: scenarioId !== "initial",
    sourceScenario: scenarioId === "simulated" ? "initial" : scenarioId,
    growthRate: profile.growth,
    premises: defaultPremises.map((item) => ({
      ...item,
      evaluationsPerDay: item.evaluationsPerDay * profile.revenue,
      protocolSales: item.protocolSales * profile.revenue,
      supplementQuantity: item.supplementQuantity * profile.revenue,
    })),
    expenseItems: Object.fromEntries(
      expenseEditableRows.map((row) => {
        const value = defaultExpenseControlValue(row);
        return [row.id, isRevenueRateExpense(row) ? value : value * profile.expense];
      }),
    ),
    investmentItems: defaultInvestmentItems.map((item) => ({ ...item, monthly: [...item.monthly] })),
  };
}

const defaultScenarioControls = Object.fromEntries(
  Object.keys(scenarioProfiles).map((scenarioId) => [scenarioId, buildScenarioControls(scenarioId)]),
);

const defaultControls = defaultScenarioControls.initial;

function investmentTotal(items) {
  return items.reduce((sum, item) => sum + investmentItemTotal(item), 0);
}

function investmentItemTotal(item) {
  return (item.monthly || []).reduce((total, value) => total + (Number(value) || 0), 0);
}

function isFranchiseFeeItem(item) {
  return normalize(item?.label).includes("taxa de franquia");
}

function investmentMonthlyTotal(items, index) {
  return items.reduce((sum, item) => sum + (Number(item.monthly?.[index]) || 0), 0);
}

function investmentMonthlyWithoutFranchiseFee(items, index) {
  return items
    .filter((item) => !isFranchiseFeeItem(item))
    .reduce((sum, item) => sum + (Number(item.monthly?.[index]) || 0), 0);
}

function setFranchiseFee(items, amount) {
  return items.map((item) => {
    if (!isFranchiseFeeItem(item)) return item;
    const currentTotal = investmentItemTotal(item);
    const monthly = currentTotal > 0
      ? item.monthly.map((value) => (Number(value) || 0) * (amount / currentTotal))
      : data.months.map((_, index) => (index === 0 ? amount : 0));
    return { ...item, value: amount, monthly };
  });
}

function scenarioExpenseLineValue(row, index, revenue, controls, monthScenario) {
  if (isValeTransport(row)) {
    const salaryRow = data.dre.find((item) => normalize(item.label) === "salarios");
    const salary = salaryRow ? scenarioExpenseLineValue(salaryRow, index, revenue, controls, monthScenario) : 0;
    return salary * 0.1;
  }

  if (isRevenueRateExpense(row)) {
    return scenarioRevenueRateBase(row, revenue, monthScenario) * expenseControlValue(row, controls, index);
  }

  return expenseControlValue(row, controls, index);
}

function scenarioExpenseGroupValue(category, index, revenue, controls, monthScenario) {
  return expenseLeafRows
    .filter((row) => row.category === category)
    .reduce((sum, row) => sum + scenarioExpenseLineValue(row, index, revenue, controls, monthScenario), 0);
}

function scenarioRhFinancialValue(index, revenue, controls, monthScenario) {
  return expenseLeafRows
    .filter((row) => {
      const label = normalize(row.label);
      return row.category === "RH" && !label.includes("provisao");
    })
    .reduce((sum, row) => sum + scenarioExpenseLineValue(row, index, revenue, controls, monthScenario), 0);
}

function calculateScenario(months, indexes, controls, useExcelBase) {
  let cumulative = 0;
  const initialInvestment = investmentTotal(controls.investmentItems);

  return months.map((month, listIndex) => {
    const sourceIndex = indexes[listIndex];
    const base = baseBreakdown(month, sourceIndex);
    const premise = controls.premises[sourceIndex] || defaultPremises[sourceIndex];
    const evaluationCount = premise.days * premise.evaluationsPerDay;
    const evaluationRevenue = useExcelBase ? getMonthlyValue("Consultas", sourceIndex) : evaluationCount * EVALUATION_TICKET;
    const protocolRevenue = useExcelBase
      ? getMonthlyValue("Protocolos", sourceIndex)
      : premise.protocolSales * premise.protocolTicket;
    const supplementRevenue = useExcelBase
      ? getMonthlyValue("Produtos Alimenticios", sourceIndex) +
        getMonthlyValue("Suplementos Extras", sourceIndex) +
        getMonthlyValue("Produto A", sourceIndex) +
        getMonthlyValue("Produto B", sourceIndex)
      : premise.supplementEnabled
        ? premise.supplementQuantity * premise.supplementTicket
        : 0;
    const revenueParts = { evaluationRevenue, protocolRevenue, supplementRevenue };
    const revenue = useExcelBase ? base.revenue : scenarioRevenueTotal(revenueParts);
    const rh = useExcelBase ? base.rh : scenarioExpenseGroupValue("RH", sourceIndex, revenue, controls, revenueParts);
    const rhFinancial = useExcelBase
      ? getMonthlyValue("(-) Despesas RH Financeira", sourceIndex)
      : scenarioRhFinancialValue(sourceIndex, revenue, controls, revenueParts);
    const fixed = useExcelBase ? base.fixed : scenarioExpenseGroupValue("Despesas Fixas", sourceIndex, revenue, controls, revenueParts);
    const variable = useExcelBase ? base.variable : scenarioExpenseGroupValue("Despesas Variaveis", sourceIndex, revenue, controls, revenueParts);
    const tax = useExcelBase ? base.tax : scenarioExpenseGroupValue("Impostos", sourceIndex, revenue, controls, revenueParts);
    const franchising = useExcelBase ? base.franchising : scenarioExpenseGroupValue("Franchising", sourceIndex, revenue, controls, revenueParts);
    const itemizedExpenses = rh + fixed + variable + tax + franchising;
    const expenses = useExcelBase ? getMonthlyValue("TOTAL DESPESAS", sourceIndex) : itemizedExpenses;
    const netResult = revenue - expenses;
    const rentability = initialInvestment ? netResult / initialInvestment : 0;
    const investmentOutflow = investmentMonthlyTotal(controls.investmentItems, sourceIndex);
    const preInvestmentOutflow = investmentMonthlyWithoutFranchiseFee(controls.investmentItems, sourceIndex);
    cumulative += netResult - investmentOutflow;

    return {
      ...base,
      days: premise.days,
      evaluationsPerDay: premise.evaluationsPerDay,
      evaluationCount,
      evaluationTicket: EVALUATION_TICKET,
      evaluationRevenue,
      protocolSales: premise.protocolSales,
      protocolTicket: premise.protocolTicket,
      protocolRevenue,
      supplementEnabled: premise.supplementEnabled,
      supplementQuantity: premise.supplementQuantity,
      supplementTicket: premise.supplementTicket,
      supplementRevenue,
      initialInvestment: preInvestmentOutflow,
      investmentOutflow,
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
  if (!monthScenario) return excelValue;

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

  if (useExcelBase) {
    const investmentRows = [
      normalize("INVESTIMENTO INICIAL"),
      normalize("RETORNO IVESTIMENTO | PAY BACK"),
      normalize("RETORNO INVESTIMENTO | PAY BACK"),
      normalize("RENTABILIDADE (%)"),
    ];
    return investmentRows.includes(label) ? derivedRows[label] : excelValue;
  }

  if (Object.prototype.hasOwnProperty.call(derivedRows, label)) {
    return derivedRows[label];
  }

  if (expenseLeafRows.some((expenseRow) => expenseRow.id === row.id)) {
    return scenarioExpenseLineValue(row, index, monthScenario.revenue, controls, monthScenario);
  }

  if (isRevenueLine(row)) {
    return scenarioRevenueLineValue(row, monthScenario);
  }

  return 0;
}

function sumBy(items, field) {
  return items.reduce((sum, item) => sum + (item[field] || 0), 0);
}

function cloneScenarioControls(value) {
  return JSON.parse(JSON.stringify(value));
}

function mergeScenarioControls(saved = {}) {
  return Object.fromEntries(
    Object.keys(scenarioProfiles).map((scenarioId) => {
      const fallback = buildScenarioControls(scenarioId);
      const candidate = saved[scenarioId];
      if (!candidate) return [scenarioId, fallback];
      return [
        scenarioId,
        {
          ...fallback,
          ...candidate,
          premises: data.months.map((_, index) => ({ ...fallback.premises[index], ...candidate.premises?.[index] })),
          expenseItems: { ...fallback.expenseItems, ...candidate.expenseItems },
          investmentItems: fallback.investmentItems.map((item, index) => ({
            ...item,
            ...candidate.investmentItems?.[index],
            monthly: candidate.investmentItems?.[index]?.monthly || item.monthly,
          })),
        },
      ];
    }),
  );
}

function DashboardApp({ authUser, userProfile, refreshProfile, onSignOut }) {
  const [activeTab, setActiveTab] = useState("executive");
  const [startMonth, setStartMonth] = useState(data.months[0]);
  const [endMonth, setEndMonth] = useState(data.months[data.months.length - 1]);
  const [category, setCategory] = useState("Todos");
  const [selectedLine, setSelectedLine] = useState("Todos");
  const [scenario, setScenario] = useState("initial");
  const [scenarioControls, setScenarioControls] = useState(() => {
    try {
      const saved = JSON.parse(window.localStorage.getItem(SCENARIO_STORAGE_KEY) || "null");
      return mergeScenarioControls(saved || defaultScenarioControls);
    } catch {
      return mergeScenarioControls(defaultScenarioControls);
    }
  });
  const [editModal, setEditModal] = useState(null);
  const [userModal, setUserModal] = useState(null);
  const [archiveModal, setArchiveModal] = useState(false);
  const [printSnapshot, setPrintSnapshot] = useState(null);
  const persistenceReady = useRef(false);
  const controls = scenarioControls[scenario];
  const useExcelBase = scenario === "initial" && !controls.modified;

  const apiFetch = useCallback(
    async (url, options = {}) => {
      const token = await authUser.getIdToken();
      return fetch(url, {
        ...options,
        headers: {
          ...(options.headers || {}),
          Authorization: `Bearer ${token}`,
        },
      });
    },
    [authUser],
  );

  const setControls = useCallback(
    (updater) => {
      setScenarioControls((current) => {
        const active = current[scenario];
        const next = typeof updater === "function" ? updater(active) : updater;
        return { ...current, [scenario]: next };
      });
    },
    [scenario],
  );

  useEffect(() => {
    let cancelled = false;
    apiFetch("/api/scenarios")
      .then((response) => (response.ok ? response.json() : null))
      .then((saved) => {
        if (!cancelled && saved?.scenarios) setScenarioControls(mergeScenarioControls(saved.scenarios));
      })
      .catch(() => null)
      .finally(() => {
        persistenceReady.current = true;
      });
    return () => {
      cancelled = true;
    };
  }, [apiFetch]);

  useEffect(() => {
    window.localStorage.setItem(SCENARIO_STORAGE_KEY, JSON.stringify(scenarioControls));
    if (!persistenceReady.current) return undefined;
    const timeout = window.setTimeout(() => {
      apiFetch("/api/scenarios", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ scenarios: scenarioControls }),
      }).catch(() => null);
    }, 700);
    return () => window.clearTimeout(timeout);
  }, [scenarioControls, apiFetch]);

  const [startIndex, endIndex] = rangeIndexes(startMonth, endMonth);
  const visibleMonths = data.months.slice(startIndex, endIndex + 1);
  const visibleIndexes = visibleMonths.map((_, index) => startIndex + index);

  const scenarioMonthly = useMemo(
    () => calculateScenario(visibleMonths, visibleIndexes, controls, useExcelBase),
    [visibleMonths.join("|"), visibleIndexes.join("|"), controls, useExcelBase],
  );
  const annualMonthly = useMemo(
    () => calculateScenario(data.months, data.months.map((_, index) => index), controls, useExcelBase),
    [controls, useExcelBase],
  );

  const filteredRows = useMemo(
    () => data.dre.filter((row) => category === "Todos" || row.category === category),
    [category],
  );

  const selectedRow = data.dre.find((row) => row.label === selectedLine) || rowByLabel("Faturamento Total") || data.dre[0];
  const selectedLineData = selectedRow.values.slice(startIndex, endIndex + 1).map((item, index) => ({
    month: item.month,
    value: scenarioDreValue(selectedRow, startIndex + index, scenarioMonthly[index], controls, useExcelBase),
  }));
  const totals = {
    investment: investmentTotal(controls.investmentItems),
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
  }

  function openEditableScenario(modal) {
    if (scenario === "initial") {
      setScenarioControls((current) => ({
        ...current,
        simulated: {
          ...cloneScenarioControls(current.initial),
          modified: true,
          sourceScenario: "initial",
        },
      }));
      setScenario("simulated");
    }
    setEditModal(modal);
  }

  function openScenarioEditor() {
    openEditableScenario("scenario");
  }

  function openExpenseEditor() {
    openEditableScenario("expenses");
  }

  function openPremiseEditor() {
    openEditableScenario("premises");
  }

  function openInvestmentEditor() {
    setEditModal("investment");
  }

  function resetScenario() {
    setScenarioControls((current) => ({ ...current, [scenario]: buildScenarioControls(scenario) }));
  }

  async function exportPdf(snapshot = null) {
    if (snapshot) {
      setPrintSnapshot(snapshot);
      window.setTimeout(() => {
        window.print();
        window.setTimeout(() => setPrintSnapshot(null), 300);
      }, 120);
      return;
    }

    apiFetch("/api/scenario-snapshots", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        scenario,
        controls,
        monthly: annualMonthly,
        totals,
        useExcelBase,
      }),
    }).catch(() => null);

    window.print();
  }

  const topAction = {
    simulator: { label: "Editar cenario", action: openScenarioEditor },
    dre: { label: "Editar PRE", action: openExpenseEditor },
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
            <button className="print-button" onClick={() => exportPdf()}>
              <Download size={16} />
              Baixar PDF
            </button>
            <button className="ghost-button" onClick={() => setArchiveModal(true)}>
              <Search size={16} />
              Simulações
            </button>
            <button className="ghost-button" onClick={() => setUserModal("users")}>
              <ShieldCheck size={16} />
              Gestão
            </button>
            <div className="user-chip">
              <button className="profile-trigger" onClick={() => setUserModal("users")}>
                {userProfile.name || authUser.displayName || authUser.email}
              </button>
              <button aria-label="Sair" onClick={onSignOut}>
                <LogOut size={15} />
              </button>
            </div>
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
        {!printSnapshot && <AnnualPrintReport monthly={annualMonthly} controls={controls} scenario={scenario} useExcelBase={useExcelBase} />}
        {printSnapshot && (
          <AnnualPrintReport
            monthly={printSnapshot.monthly}
            controls={printSnapshot.controls}
            scenario={printSnapshot.scenario}
            useExcelBase={printSnapshot.useExcelBase}
          />
        )}

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
            resetScenario={resetScenario}
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
            useExcelBase={useExcelBase}
            controls={controls}
            selectedLine={selectedLine}
            setSelectedLine={setSelectedLine}
            category={category}
            setCategory={setCategory}
            openEditor={openExpenseEditor}
          />
        )}
        {activeTab === "investment" && (
          <InvestmentView controls={controls} setControls={setControls} openEditor={openInvestmentEditor} />
        )}
        {activeTab === "assumptions" && (
          <AssumptionsView
            controls={controls}
            monthly={annualMonthly}
            setControls={setControls}
            startIndex={startIndex}
            endIndex={endIndex}
            openEditor={openPremiseEditor}
          />
        )}
      </section>

      {editModal === "scenario" && (
        <ScenarioModal mode="full" scenario={scenario} scenarioControls={scenarioControls} controls={controls} setControls={setControls} onClose={() => setEditModal(null)} />
      )}
      {editModal === "expenses" && (
        <ScenarioModal mode="expenses" scenario={scenario} scenarioControls={scenarioControls} controls={controls} setControls={setControls} onClose={() => setEditModal(null)} />
      )}
      {editModal === "premises" && (
        <ScenarioModal mode="premises" scenario={scenario} scenarioControls={scenarioControls} controls={controls} setControls={setControls} onClose={() => setEditModal(null)} />
      )}
      {editModal === "investment" && (
        <InvestmentModal controls={controls} setControls={setControls} onClose={() => setEditModal(null)} />
      )}
      {userModal === "users" && (
        <UserManagementModal apiFetch={apiFetch} onClose={() => { setUserModal(null); refreshProfile(); }} />
      )}
      {archiveModal && (
        <SimulationArchiveModal apiFetch={apiFetch} onClose={() => setArchiveModal(false)} onPrint={exportPdf} />
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
    { label: "Investimento", value: formatMoney(totals.investment), tone: "neutral" },
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
            <ComposedChart data={monthly} margin={{ top: 30, right: 20, left: 12, bottom: 8 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#D8E5EA" />
              <XAxis dataKey="month" interval={0} tick={{ fill: "#075C57", fontSize: 11 }} />
              <YAxis yAxisId="main" domain={[0, (maximum) => maximum * 1.18]} tickFormatter={formatCompactMoney} tick={{ fill: "#075C57", fontSize: 11 }} />
              <Tooltip content={<MoneyTooltip />} />
              <Legend />
              <Bar yAxisId="main" dataKey="revenue" name="Faturamento" fill={brand.green} radius={[4, 4, 0, 0]}>
                <LabelList dataKey="revenue" position="top" formatter={formatLabelValue} className="bar-label" />
              </Bar>
              <Bar yAxisId="main" dataKey="expenses" name="Despesas" fill={brand.blue2} radius={[4, 4, 0, 0]}>
                <LabelList dataKey="expenses" position="top" formatter={formatLabelValue} className="bar-label" />
              </Bar>
              <Line yAxisId="main" type="monotone" dataKey="netResult" name="Resultado" stroke={brand.yellow} strokeWidth={3} />
            </ComposedChart>
          </ResponsiveContainer>
        </div>
      </section>
      <section className="panel">
        <PanelTitle icon={LineChart} title={selectedRow.label} />
        <div className="chart-medium">
          <ResponsiveContainer>
            <AreaChart data={selectedLineData} margin={{ top: 18, right: 20, left: 12, bottom: 8 }}>
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

function SimulatorView({ monthly, totals, paybackMonth, scenario, resetScenario, openEditor }) {
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
            <button className="ghost-button" onClick={resetScenario}>
              <RotateCcw size={16} />
              Reset
            </button>
          </div>
        </div>
        <div className="scenario-strip">
          <span>Base: {scenarioProfiles[scenario].label}</span>
          <span>Edicao salva no cenario selecionado</span>
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
            <ComposedChart data={monthly} margin={{ top: 30, right: 20, left: 12, bottom: 8 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#D8E5EA" />
              <XAxis dataKey="month" interval={0} tick={{ fill: "#075C57", fontSize: 11 }} />
              <YAxis yAxisId="main" domain={[0, (maximum) => maximum * 1.18]} tickFormatter={formatCompactMoney} tick={{ fill: "#075C57", fontSize: 11 }} />
              <YAxis yAxisId="return" orientation="right" hide domain={[(minimum) => minimum * 1.08, (maximum) => maximum * 1.08]} />
              <Tooltip content={<MoneyTooltip />} />
              <Legend />
              <Bar yAxisId="main" dataKey="revenue" name="Faturamento" fill={brand.green} radius={[4, 4, 0, 0]}>
                <LabelList dataKey="revenue" position="top" formatter={formatLabelValue} className="bar-label" />
              </Bar>
              <Bar yAxisId="main" dataKey="expenses" name="Despesas" fill={brand.blue2} radius={[4, 4, 0, 0]}>
                <LabelList dataKey="expenses" position="top" formatter={formatLabelValue} className="bar-label" />
              </Bar>
              <Line yAxisId="return" dataKey="cumulativeReturn" name="Retorno acumulado" stroke={brand.yellow} strokeWidth={3} />
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
              label="Avaliacoes/dia"
              value={item.evaluationsPerDay}
              onChange={(value) => updatePremise(setControls, index, "evaluationsPerDay", value)}
            />
            <ScenarioNumber
              label="Vendas de protocolos"
              value={item.protocolSales}
              onChange={(value) => updatePremise(setControls, index, "protocolSales", value)}
            />
            <ScenarioNumber
              label="Ticket protocolo"
              value={item.protocolTicket}
              step={100}
              money
              onChange={(value) => updatePremise(setControls, index, "protocolTicket", value)}
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
              <th>Avaliacoes</th>
              <th>Receita avaliacoes</th>
              <th>Protocolos</th>
              <th>Ticket protocolo</th>
              <th>Receita protocolos</th>
              <th>Suplementos</th>
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
                <td>{numberFormatter.format(row.evaluationCount)}</td>
                <td>{formatMoney(row.evaluationRevenue)}</td>
                <td>{numberFormatter.format(row.protocolSales)}</td>
                <td>{formatMoney(row.protocolTicket)}</td>
                <td>{formatMoney(row.protocolRevenue)}</td>
                <td>{formatMoney(row.supplementRevenue)}</td>
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
  useExcelBase,
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
  return (
    <div className="view-grid">
      <section className="panel wide">
        <div className="panel-actions">
          <PanelTitle icon={Table2} title="PRE" />
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
            <FilterSelect icon={LineChart} label="Linha PRE" value={selectedLine} onChange={setSelectedLine}>
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
              <BarChart data={chartData} margin={{ top: 28, right: 18, left: 12, bottom: 8 }}>
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
  const [monthFilter, setMonthFilter] = useState("all");
  const items = controls.investmentItems;
  const displayItems = items.map((item) => ({
    ...item,
    value: monthFilter === "all" ? investmentItemTotal(item) : Number(item.monthly?.[Number(monthFilter)]) || 0,
  }));
  const topItems = displayItems
    .filter((item) => !isFranchiseFeeItem(item))
    .sort((a, b) => b.value - a.value);
  const total = investmentTotal(items);
  const displayedTotal = topItems.reduce((sum, item) => sum + item.value, 0);
  const franchiseFee = investmentItemTotal(items.find(isFranchiseFeeItem) || { monthly: [] });
  const editableTotal = total - franchiseFee;
  const changeFranchiseFee = (amount) => {
    setControls((current) => ({
      ...current,
      investmentItems: setFranchiseFee(current.investmentItems, amount),
    }));
  };
  return (
    <div className="investment-layout">
      <section className="investment-hero">
        <div>
          <span>Investimento inicial</span>
          <strong>{formatMoney(total)}</strong>
        </div>
        <div className="investment-hero-actions">
          <div className="segmented-control" role="group" aria-label="Taxa de franquia">
            <button className={Math.round(franchiseFee) === 120000 ? "active" : ""} onClick={() => changeFranchiseFee(120000)}>
              R$ 120 mil
            </button>
            <button className={Math.round(franchiseFee) === 80000 ? "active" : ""} onClick={() => changeFranchiseFee(80000)}>
              R$ 80 mil
            </button>
          </div>
          <button className="ghost-button" onClick={openEditor}>
            <Edit3 size={16} />
            Editar
          </button>
        </div>
      </section>
      <section className="investment-summary-grid">
        <article>
          <span>Taxa de franquia</span>
          <strong>{formatMoney(franchiseFee)}</strong>
          <small>{percentFormatter.format(total ? franchiseFee / total : 0)} do total</small>
        </article>
        <article>
          <span>Demais investimentos</span>
          <strong>{formatMoney(editableTotal)}</strong>
          <small>{items.length - 1} outros itens</small>
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
          <FilterSelect icon={Filter} label="Periodo" value={monthFilter} onChange={setMonthFilter}>
            <option value="all">Todos os meses</option>
            {data.months.map((month, index) => <option key={month} value={index}>{month}</option>)}
          </FilterSelect>
        </div>
        <div className="investment-composition-grid">
          <div className="investment-donut">
            <ResponsiveContainer>
              <PieChart>
                <Pie data={topItems.filter((item) => item.value > 0)} dataKey="value" nameKey="label" outerRadius={96} innerRadius={64} paddingAngle={2}>
                  {topItems.map((item) => (
                    <Cell key={item.label} fill={item.color} />
                  ))}
                </Pie>
                <Tooltip formatter={(value) => formatMoney(value)} />
              </PieChart>
            </ResponsiveContainer>
            <div className="donut-center">
              <span>Total</span>
              <strong>{formatCompactMoney(displayedTotal)}</strong>
            </div>
          </div>
          <InvestmentLegend items={topItems} total={displayedTotal} />
        </div>
      </section>
      <section className="panel wide">
        <PanelTitle icon={BarChart3} title="Ranking de investimento" />
        <InvestmentBars items={topItems} total={displayedTotal} />
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
  const [page, setPage] = useState(0);
  const premiseChart = monthly.slice(page * 6, page * 6 + 6);
  const premiseRows = [
    { key: "days", label: "Dias uteis", type: "count" },
    { key: "evaluationsPerDay", label: "Avaliacoes/dia", type: "count", group: "evaluations" },
    { key: "evaluationCount", label: "Avaliacoes no mes", type: "count", group: "evaluations" },
    { key: "evaluationRevenue", label: "Receita de avaliacoes", type: "currency", group: "evaluations" },
    { key: "protocolSales", label: "Protocolos vendidos", type: "count", group: "protocols" },
    { key: "protocolTicket", label: "Ticket medio do protocolo", type: "currency", group: "protocols" },
    { key: "protocolRevenue", label: "Receita de protocolos", type: "currency", group: "protocols" },
    { key: "supplementQuantity", label: "Quantidade de suplementos", type: "count", group: "supplements" },
    { key: "supplementTicket", label: "Ticket medio dos suplementos", type: "currency", group: "supplements" },
    { key: "supplementRevenue", label: "Receita de suplementos", type: "currency", group: "supplements" },
    { key: "revenue", label: "Faturamento", type: "currency" },
  ];
  const visiblePremiseRows = premiseFilter === "Todos"
    ? premiseRows
    : premiseRows.filter((item) => item.group === premiseFilter || item.key === premiseFilter);

  return (
    <div className="view-grid">
      <section className="panel wide">
        <div className="panel-actions">
          <PanelTitle icon={Database} title="Premissas" />
          <div className="button-row">
            <FilterSelect icon={Filter} label="Tipo" value={premiseFilter} onChange={setPremiseFilter}>
              <option value="Todos">Todos</option>
              <option value="evaluations">Avaliacoes</option>
              <option value="protocols">Protocolos</option>
              <option value="supplements">Suplementos</option>
              <option value="revenue">Faturamento</option>
            </FilterSelect>
            <button className="ghost-button" onClick={openEditor}>
              <Edit3 size={16} />
              Editar premissas
            </button>
          </div>
        </div>
        <div className="chart-medium">
          <ResponsiveContainer>
            <ComposedChart data={premiseChart} margin={{ top: 28, right: 18, left: 12, bottom: 8 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#D8E5EA" />
              <XAxis dataKey="month" interval={0} tick={{ fill: "#075C57", fontSize: 11 }} />
              <YAxis
                yAxisId="main"
                tickFormatter={formatCompactMoney}
                tick={{ fill: "#075C57", fontSize: 11 }}
                domain={[0, (maximum) => maximum * 1.18]}
              />
              <Tooltip content={<PremiseTooltip type={premiseFilter} />} />
              <Legend />
              {(premiseFilter === "Todos" || premiseFilter === "evaluations") && (
                <Bar yAxisId="main" stackId="revenue" dataKey="evaluationRevenue" name="Avaliacoes" fill={brand.blue} radius={[3, 3, 0, 0]}>
                  <LabelList dataKey="evaluationRevenue" position="center" formatter={formatLabelValue} className="bar-label bar-label-light" />
                </Bar>
              )}
              {(premiseFilter === "Todos" || premiseFilter === "protocols") && (
                <Bar yAxisId="main" stackId="revenue" dataKey="protocolRevenue" name="Protocolos" fill={brand.green} radius={[3, 3, 0, 0]}>
                  <LabelList dataKey="protocolRevenue" position="center" formatter={formatLabelValue} className="bar-label bar-label-light" />
                </Bar>
              )}
              {(premiseFilter === "Todos" || premiseFilter === "supplements") && (
                <Bar yAxisId="main" stackId="revenue" dataKey="supplementRevenue" name="Suplementos" fill={brand.cyan} radius={[3, 3, 0, 0]}>
                  <LabelList dataKey="supplementRevenue" position="center" formatter={formatLabelValue} className="bar-label bar-label-light" />
                </Bar>
              )}
              {premiseFilter === "revenue" && (
                <Bar yAxisId="main" dataKey="revenue" name="Faturamento" fill={brand.green} radius={[4, 4, 0, 0]}>
                  <LabelList dataKey="revenue" position="top" formatter={formatLabelValue} className="bar-label" />
                </Bar>
              )}
              {premiseFilter === "Todos" && <Line yAxisId="main" dataKey="revenue" name="Faturamento total" stroke={brand.yellow} strokeWidth={3} />}
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
        <div className="table-footer">
          <span>Meses {page * 6 + 1} a {Math.min(page * 6 + 6, monthly.length)}</span>
          <div>
            <button className="ghost-button" disabled={page === 0} onClick={() => setPage(0)}>1-6</button>
            <button className="ghost-button" disabled={page === 1} onClick={() => setPage(1)}>7-12</button>
          </div>
        </div>
      </section>
      <ValidationPanel />
    </div>
  );
}

function ScenarioModal({ mode = "full", scenario, scenarioControls, controls, setControls, onClose }) {
  const draftFromControls = (source) => ({
    sourceScenario: source.sourceScenario || scenario,
    growthRate: (source.growthRate || 0) * 100,
    expenses: Object.fromEntries(
      expenseEditableRows.map((row) => [
        row.id,
        isRevenueRateExpense(row)
          ? Number((expenseControlValue(row, source) * 100).toFixed(3))
          : Number(expenseControlValue(row, source).toFixed(2)),
      ]),
    ),
    base: { ...source.premises[0] },
  });
  const [draft, setDraft] = useState(() => draftFromControls(controls));
  const showExpenses = mode === "full" || mode === "expenses";
  const showPremises = mode === "full" || mode === "premises";
  const title = mode === "expenses" ? "Editar despesas" : mode === "premises" ? "Editar premissas" : "Editar cenario";

  function changeSourceScenario(sourceScenario) {
    const source = scenarioControls[sourceScenario] || controls;
    setDraft({ ...draftFromControls(source), sourceScenario });
  }

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

      const days = optionalNumber(draft.base.days) ?? 0;
      const evaluationsPerDay = optionalNumber(draft.base.evaluationsPerDay) ?? 0;
      const protocolSales = optionalNumber(draft.base.protocolSales) ?? 0;
      const protocolTicket = optionalNumber(draft.base.protocolTicket) ?? 0;
      const supplementQuantity = optionalNumber(draft.base.supplementQuantity) ?? 0;
      const supplementTicket = optionalNumber(draft.base.supplementTicket) ?? 0;
      const growthRate = Math.max(-99, optionalNumber(draft.growthRate) ?? 0) / 100;
      const nextPremises = showPremises
        ? current.premises.map((item, index) => {
          const growthFactor = Math.pow(1 + growthRate, index);
          return {
            ...item,
            days: Math.max(0, days),
            evaluationsPerDay: Math.max(0, evaluationsPerDay * growthFactor),
            protocolSales: Math.max(0, protocolSales * growthFactor),
            protocolTicket: Math.max(0, protocolTicket),
            supplementEnabled: Boolean(draft.base.supplementEnabled),
            supplementQuantity: Math.max(0, supplementQuantity * growthFactor),
            supplementTicket: Math.max(0, supplementTicket),
          };
        })
        : current.premises;

      return {
        ...current,
        modified: true,
        sourceScenario: draft.sourceScenario,
        growthRate,
        expenseItems: nextExpenseItems,
        premises: nextPremises,
      };
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
        {scenario === "simulated" && mode === "full" && (
          <div className="modal-section compact-section">
            <FilterSelect icon={Calculator} label="Base do simulado" value={draft.sourceScenario} onChange={changeSourceScenario}>
              <option value="initial">Cenario inicial</option>
              <option value="conservative">Conservador</option>
              <option value="optimistic">Otimista</option>
            </FilterSelect>
          </div>
        )}
        {showExpenses && (
          <div className="modal-section">
            <h3>Gastos PRE</h3>
            <div className="edit-grid expense-item-grid">
              {expenseEditableRows.map((row) => (
                <label className="editable-control" key={row.id}>
                  <span>{row.label}</span>
                  <input
                    type="number"
                    value={draft.expenses[row.id] ?? ""}
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
            <div className="edit-grid four">
              <ScenarioNumber
                label="Dias uteis"
                value={draft.base.days}
                blankMode
                onChange={(value) => setDraft((current) => ({ ...current, base: { ...current.base, days: value } }))}
              />
              <ScenarioNumber
                label="Avaliacoes/dia"
                value={draft.base.evaluationsPerDay}
                blankMode
                onChange={(value) => setDraft((current) => ({ ...current, base: { ...current.base, evaluationsPerDay: value } }))}
              />
              <ScenarioNumber
                label="Valor da avaliacao"
                value={EVALUATION_TICKET}
                money
                disabled
                onChange={() => null}
              />
              <ScenarioNumber
                label="Protocolos vendidos/mes"
                value={draft.base.protocolSales}
                blankMode
                onChange={(value) => setDraft((current) => ({ ...current, base: { ...current.base, protocolSales: value } }))}
              />
              <ScenarioNumber
                label="Ticket medio do protocolo"
                value={draft.base.protocolTicket}
                step={100}
                blankMode
                onChange={(value) => setDraft((current) => ({ ...current, base: { ...current.base, protocolTicket: value } }))}
              />
              <ScenarioNumber
                label="Crescimento mensal (%)"
                value={draft.growthRate}
                step={0.1}
                blankMode
                onChange={(value) => setDraft((current) => ({ ...current, growthRate: value }))}
              />
            </div>
            <label className="toggle-control">
              <input
                type="checkbox"
                checked={Boolean(draft.base.supplementEnabled)}
                onChange={(event) => setDraft((current) => ({ ...current, base: { ...current.base, supplementEnabled: event.target.checked } }))}
              />
              <span>Incluir suplementos no faturamento</span>
            </label>
            {draft.base.supplementEnabled && (
              <div className="edit-grid two">
                <ScenarioNumber
                  label="Quantidade mensal de suplementos"
                  value={draft.base.supplementQuantity}
                  blankMode
                  onChange={(value) => setDraft((current) => ({ ...current, base: { ...current.base, supplementQuantity: value } }))}
                />
                <ScenarioNumber
                  label="Ticket medio dos suplementos"
                  value={draft.base.supplementTicket}
                  step={10}
                  blankMode
                  onChange={(value) => setDraft((current) => ({ ...current, base: { ...current.base, supplementTicket: value } }))}
                />
              </div>
            )}
          </div>
        )}
        <div className="modal-actions">
          <button className="ghost-button" onClick={() => { setControls(buildScenarioControls(scenario)); onClose(); }}>
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
  const [monthIndex, setMonthIndex] = useState(0);
  const orderedItems = controls.investmentItems;

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
        <div className="modal-section compact-section">
          <FilterSelect icon={Filter} label="Mes do desembolso" value={String(monthIndex)} onChange={(value) => setMonthIndex(Number(value))}>
            {data.months.map((month, index) => <option key={month} value={index}>{month}</option>)}
          </FilterSelect>
        </div>
        <div className="investment-edit-list">
          {orderedItems.map((item) => {
            const index = controls.investmentItems.findIndex((currentItem) => currentItem.label === item.label);
            return (
            <ScenarioNumber
              key={item.label}
              label={item.label}
              value={item.monthly?.[monthIndex] || 0}
              step={1000}
              money
              onChange={(value) =>
                setControls((current) => ({
                  ...current,
                  investmentItems: current.investmentItems.map((currentItem, currentIndex) =>
                    currentIndex === index
                      ? {
                          ...currentItem,
                          monthly: currentItem.monthly.map((monthValue, currentMonth) =>
                            currentMonth === monthIndex ? value : monthValue,
                          ),
                        }
                      : currentItem,
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

function AnnualPrintReport({ monthly, controls, scenario, useExcelBase }) {
  const totalRevenue = sumBy(monthly, "revenue");
  const totalExpenses = sumBy(monthly, "expenses");
  const totalResult = sumBy(monthly, "netResult");
  const investment = investmentTotal(controls.investmentItems);
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
  const topInvestmentItems = controls.investmentItems
    .filter((item) => !isFranchiseFeeItem(item))
    .map((item) => ({ ...item, value: investmentItemTotal(item) }))
    .sort((a, b) => b.value - a.value)
    .slice(0, 10);

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

      <PrintTable title="PRE mensal">
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

      <PrintTable title="Detalhamento completo PRE" className="page-break allow-break wide-print-table">
        <thead>
          <tr>
            <th>Linha PRE</th>
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
            <th>Avaliacoes</th>
            <th>Receita aval.</th>
            <th>Protocolos</th>
            <th>Ticket protocolo</th>
            <th>Receita protocolos</th>
            <th>Receita suplementos</th>
            <th>Faturamento</th>
          </tr>
        </thead>
        <tbody>
          {monthly.map((item) => (
            <tr key={item.month}>
              <td>{item.month}</td>
              <td>{item.days}</td>
              <td>{numberFormatter.format(item.evaluationCount)}</td>
              <td>{formatMoney(item.evaluationRevenue)}</td>
              <td>{numberFormatter.format(item.protocolSales)}</td>
              <td>{formatMoney(item.protocolTicket)}</td>
              <td>{formatMoney(item.protocolRevenue)}</td>
              <td>{formatMoney(item.supplementRevenue)}</td>
              <td>{formatMoney(item.revenue)}</td>
            </tr>
          ))}
        </tbody>
      </PrintTable>

      <PrintInvestmentChart items={topInvestmentItems} />

      <PrintTable title="Estimativa de investimento" className="page-break allow-break wide-print-table">
        <thead>
          <tr>
            <th>Item</th>
            {data.months.map((month) => <th key={month}>{month}</th>)}
            <th>Total</th>
          </tr>
        </thead>
        <tbody>
          {controls.investmentItems.map((item) => (
            <tr key={item.label}>
              <td>{item.label}</td>
              {item.monthly.map((value, index) => <td key={`${item.label}-${index}`}>{formatMoney(value)}</td>)}
              <td>{formatMoney(investmentItemTotal(item))}</td>
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
            <strong>
              {numberFormatter.format(item.evaluationCount)} aval. | {numberFormatter.format(item.protocolSales)} protocolos | {formatCompactMoney(item.revenue)}
            </strong>
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
  return (
    <div className="tooltip">
      <strong>{label}</strong>
      {payload.map((item) => (
        <span key={item.dataKey}>{item.name}: {formatMoney(item.value)}</span>
      ))}
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

function App() {
  const [authUser, setAuthUser] = useState(null);
  const [userProfile, setUserProfile] = useState(null);
  const [authLoading, setAuthLoading] = useState(true);
  const [profileLoading, setProfileLoading] = useState(false);
  const [authMessage, setAuthMessage] = useState("");

  const loadProfile = useCallback(async (user) => {
    if (!user) return null;
    setProfileLoading(true);
    try {
      const token = await user.getIdToken();
      const response = await fetch("/api/me", { headers: { Authorization: `Bearer ${token}` } });
      const payload = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(payload.error || "Nao foi possivel carregar o perfil");
      setUserProfile(payload.user);
      return payload.user;
    } catch (error) {
      setAuthMessage(error.message);
      setUserProfile(null);
      return null;
    } finally {
      setProfileLoading(false);
    }
  }, []);

  useEffect(() => {
    if (!firebaseAuth) {
      setAuthLoading(false);
      return undefined;
    }

    return onAuthStateChanged(firebaseAuth, async (user) => {
      setAuthUser(user);
      setAuthMessage("");
      if (user) await loadProfile(user);
      else setUserProfile(null);
      setAuthLoading(false);
    });
  }, [loadProfile]);

  async function handleSignOut() {
    if (firebaseAuth) await signOut(firebaseAuth);
    setAuthUser(null);
    setUserProfile(null);
  }

  if (!firebaseReady) {
    return (
      <AuthLayout>
        <div className="auth-card">
          <span className="auth-eyebrow">Firebase Auth</span>
          <h1>Configuração pendente</h1>
          <p>Defina `VITE_FIREBASE_API_KEY` no Cloud Run para ativar login e cadastro do projeto dm2-dre-franqueado.</p>
        </div>
      </AuthLayout>
    );
  }

  if (authLoading || profileLoading) {
    return (
      <AuthLayout>
        <div className="auth-card">
          <span className="auth-eyebrow">Doutor DM2</span>
          <h1>Carregando acesso</h1>
          <p>Validando credenciais e permissoes.</p>
        </div>
      </AuthLayout>
    );
  }

  if (!authUser) {
    return <LoginScreen message={authMessage} onMessage={setAuthMessage} />;
  }

  if (userProfile?.status !== "approved") {
    return (
      <AuthLayout>
        <div className="auth-card">
          <span className="auth-eyebrow">Acesso pendente</span>
          <h1>Cadastro aguardando aprovação</h1>
          <p>Seu acesso com {authUser.email} foi registrado e precisa ser aprovado na Gestão de usuários.</p>
          <button className="print-button full-button" onClick={handleSignOut}>
            Sair
          </button>
        </div>
      </AuthLayout>
    );
  }

  return (
    <DashboardApp
      authUser={authUser}
      userProfile={userProfile}
      refreshProfile={() => loadProfile(authUser)}
      onSignOut={handleSignOut}
    />
  );
}

function AuthLayout({ children }) {
  return (
    <main className="auth-shell">
      <section className="auth-visual">
        <img src="/assets/doutor-dm2-logo-dark.png" alt="Doutor DM2" />
      </section>
      <section className="auth-panel">{children}</section>
    </main>
  );
}

function LoginScreen({ message, onMessage }) {
  const [mode, setMode] = useState("login");
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);

  async function submit(event) {
    event.preventDefault();
    onMessage("");
    const normalizedEmail = email.trim().toLowerCase();
    if (!normalizedEmail.endsWith(allowedEmailDomain)) {
      onMessage(`Use apenas e-mails do dominio ${allowedEmailDomain}.`);
      return;
    }

    setLoading(true);
    try {
      if (mode === "login") {
        await signInWithEmailAndPassword(firebaseAuth, normalizedEmail, password);
      } else {
        const credential = await createUserWithEmailAndPassword(firebaseAuth, normalizedEmail, password);
        if (name.trim()) await updateProfile(credential.user, { displayName: name.trim() });
        const token = await credential.user.getIdToken();
        await fetch("/api/register-profile", {
          method: "POST",
          headers: { Authorization: `Bearer ${token}` },
        });
      }
    } catch (error) {
      onMessage(authErrorMessage(error));
    } finally {
      setLoading(false);
    }
  }

  return (
    <AuthLayout>
      <form className="auth-card" onSubmit={submit}>
        <span className="auth-eyebrow">Doutor DM2 Franquias</span>
        <h1>{mode === "login" ? "Entrar na plataforma" : "Solicitar cadastro"}</h1>
        <p>{mode === "login" ? "Acesse com seu e-mail corporativo aprovado." : "Cadastros novos ficam pendentes para aprovação da gestão."}</p>

        {mode === "register" && (
          <label className="auth-field">
            Nome
            <input value={name} onChange={(event) => setName(event.target.value)} placeholder="Digite aqui" />
          </label>
        )}
        <label className="auth-field">
          E-mail
          <input type="email" value={email} onChange={(event) => setEmail(event.target.value)} placeholder="Digite aqui" required />
        </label>
        <label className="auth-field">
          Senha
          <input type="password" value={password} onChange={(event) => setPassword(event.target.value)} placeholder="Digite aqui" minLength={6} required />
        </label>

        {message && <div className="auth-alert">{message}</div>}

        <button className="print-button full-button" disabled={loading}>
          {loading ? "Validando..." : mode === "login" ? "Entrar" : "Cadastrar para aprovação"}
        </button>
        <button
          type="button"
          className="auth-switch"
          onClick={() => {
            onMessage("");
            setMode(mode === "login" ? "register" : "login");
          }}
        >
          {mode === "login" ? "Solicitar novo cadastro" : "Já tenho acesso"}
        </button>
      </form>
    </AuthLayout>
  );
}

function UserManagementModal({ apiFetch, onClose }) {
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [query, setQuery] = useState("");
  const [error, setError] = useState("");

  const loadUsers = useCallback(() => {
    setLoading(true);
    setError("");
    apiFetch("/api/users")
      .then(async (response) => {
        const payload = await response.json().catch(() => ({}));
        if (!response.ok) throw new Error(payload.error || "Acesso indisponivel");
        return payload;
      })
      .then((payload) => setUsers(payload.users || []))
      .catch((requestError) => {
        setUsers([]);
        setError(requestError.message);
      })
      .finally(() => setLoading(false));
  }, [apiFetch]);

  useEffect(loadUsers, [loadUsers]);

  async function updateUser(uid, update) {
    await apiFetch(`/api/users/${uid}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(update),
    });
    loadUsers();
  }

  const visibleUsers = users.filter((user) => `${user.name} ${user.email} ${user.status}`.toLowerCase().includes(query.toLowerCase()));

  return (
    <div className="modal-backdrop" role="dialog" aria-modal="true">
      <div className="modal">
        <div className="modal-head">
          <div>
            <h2>Gestão de usuários</h2>
            <p>Aprove acessos do domínio {allowedEmailDomain}.</p>
          </div>
          <button className="ghost-button" onClick={onClose}><X size={16} /> Fechar</button>
        </div>
        <label className="search-control modal-search">
          <Search size={15} />
          <input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Buscar usuário" />
        </label>
        {error && (
          <div className="modal-state">
            <strong>Gestão restrita</strong>
            <span>{error}. Peça para um administrador aprovar seu perfil como admin.</span>
          </div>
        )}
        <div className="user-table">
          {loading && !error && <span>Carregando usuários...</span>}
          {!loading && !error && visibleUsers.map((user) => (
            <div className="user-row" key={user.uid}>
              <div>
                <strong>{user.name || user.email}</strong>
                <span>{user.email}</span>
              </div>
              <small className={`status-pill ${user.status}`}>{statusLabel(user.status)} · {user.role}</small>
              <div className="button-row">
                <button className="ghost-button" onClick={() => updateUser(user.uid, { status: "approved" })}>Aprovar</button>
                <button className="ghost-button" onClick={() => updateUser(user.uid, { status: "rejected" })}>Rejeitar</button>
                <button className="ghost-button" onClick={() => updateUser(user.uid, { role: user.role === "admin" ? "user" : "admin" })}>
                  {user.role === "admin" ? "Remover admin" : "Tornar admin"}
                </button>
              </div>
            </div>
          ))}
          {!loading && !error && !visibleUsers.length && <span>Nenhum usuário encontrado.</span>}
        </div>
      </div>
    </div>
  );
}

function SimulationArchiveModal({ apiFetch, onClose, onPrint }) {
  const [snapshots, setSnapshots] = useState([]);
  const [query, setQuery] = useState("");
  const [selected, setSelected] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    apiFetch("/api/scenario-snapshots")
      .then((response) => (response.ok ? response.json() : { snapshots: [] }))
      .then((payload) => setSnapshots(payload.snapshots || []))
      .finally(() => setLoading(false));
  }, [apiFetch]);

  const visibleSnapshots = snapshots.filter((item) =>
    `${item.title} ${item.createdBy} ${scenarioProfiles[item.scenario]?.label || item.scenario}`.toLowerCase().includes(query.toLowerCase()),
  );

  return (
    <div className="modal-backdrop" role="dialog" aria-modal="true">
      <div className="modal">
        <div className="modal-head">
          <div>
            <h2>Simulações salvas</h2>
            <p>Busque cenários emitidos e gere o PDF novamente.</p>
          </div>
          <button className="ghost-button" onClick={onClose}><X size={16} /> Fechar</button>
        </div>
        <label className="search-control modal-search">
          <Search size={15} />
          <input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Buscar simulação" />
        </label>
        <div className="archive-layout">
          <div className="archive-list">
            {loading && <span>Carregando simulações...</span>}
            {!loading && visibleSnapshots.map((item) => (
              <button className={`archive-item ${selected?.id === item.id ? "active" : ""}`} key={item.id} onClick={() => setSelected(item)}>
                <strong>{scenarioProfiles[item.scenario]?.label || item.scenario}</strong>
                <span>{item.createdBy}</span>
                <small>{item.createdAt ? new Date(item.createdAt).toLocaleString("pt-BR") : "Sem data"}</small>
              </button>
            ))}
            {!loading && !visibleSnapshots.length && <span>Nenhuma simulação encontrada.</span>}
          </div>
          <div className="archive-preview">
            {selected ? (
              <>
                <div className="archive-kpis">
                  <div><span>Faturamento</span><strong>{formatMoney(selected.totals?.revenue || 0)}</strong></div>
                  <div><span>Resultado</span><strong>{formatMoney(selected.totals?.netResult || 0)}</strong></div>
                  <div><span>Investimento</span><strong>{formatMoney(selected.totals?.investment || 0)}</strong></div>
                </div>
                <button className="print-button" onClick={() => onPrint(selected)}>
                  <Download size={16} />
                  Baixar PDF
                </button>
              </>
            ) : (
              <p>Selecione uma simulação para visualizar o resumo e baixar novamente.</p>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

function statusLabel(status) {
  return { approved: "Aprovado", pending: "Pendente", rejected: "Rejeitado" }[status] || status;
}

function authErrorMessage(error) {
  const code = error?.code || "";
  if (code.includes("auth/invalid-credential")) return "E-mail ou senha inválidos.";
  if (code.includes("auth/email-already-in-use")) return "Este e-mail já foi cadastrado.";
  if (code.includes("auth/weak-password")) return "Use uma senha com pelo menos 6 caracteres.";
  if (code.includes("auth/operation-not-allowed")) return "Ative o provedor E-mail/Senha no Firebase Auth.";
  return error?.message || "Não foi possível autenticar.";
}

createRoot(document.getElementById("root")).render(<App />);
