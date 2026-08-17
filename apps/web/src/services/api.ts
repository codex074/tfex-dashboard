/**
 * Thin API client over the Fastify backend. All responses are wrapped in
 * `{ data }` and errors use the standard `{ error: { code, message } }` shape.
 */

const BASE_URL = import.meta.env.VITE_API_URL ?? "/api";
export const AUTH_TOKEN_KEY = "tfex.authToken";

export interface ApiErrorBody {
  error: { code: string; message: string };
}

export class ApiClientError extends Error {
  readonly code: string;
  readonly status: number;

  constructor(status: number, code: string, message: string) {
    super(message);
    this.name = "ApiClientError";
    this.status = status;
    this.code = code;
  }
}

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const token = typeof window === "undefined" ? null : window.localStorage.getItem(AUTH_TOKEN_KEY);
  const res = await fetch(`${BASE_URL}${path}`, {
    ...init,
    headers: {
      "Content-Type": "application/json",
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...(init?.headers ?? {}),
    },
  });

  if (!res.ok) {
    let body: ApiErrorBody | null = null;
    try {
      body = (await res.json()) as ApiErrorBody;
    } catch {
      // ignore parse errors
    }
    throw new ApiClientError(
      res.status,
      body?.error.code ?? "INTERNAL_ERROR",
      body?.error.message ?? "Request failed",
    );
  }

  const json = (await res.json()) as { data: T };
  return json.data;
}

function qs(params: Record<string, string | number | undefined>): string {
  const search = new URLSearchParams();
  for (const [key, value] of Object.entries(params)) {
    if (value !== undefined && value !== "") {
      search.set(key, String(value));
    }
  }
  const s = search.toString();
  return s ? `?${s}` : "";
}

export const api = {
  get<T>(path: string, params?: Record<string, string | number | undefined>) {
    return request<T>(`${path}${params ? qs(params) : ""}`);
  },
  post<T>(path: string, body?: unknown) {
    return request<T>(path, { method: "POST", body: JSON.stringify(body ?? {}) });
  },
  put<T>(path: string, body?: unknown) {
    return request<T>(path, { method: "PUT", body: JSON.stringify(body ?? {}) });
  },
  patch<T>(path: string, body?: unknown) {
    return request<T>(path, { method: "PATCH", body: JSON.stringify(body ?? {}) });
  },
  delete<T>(path: string) {
    return request<T>(path, { method: "DELETE" });
  },
};

export interface Account {
  id: number;
  name: string;
  brokerId: number | null;
  accountNumber: string | null;
  accountType: string;
  currency: string;
  initialCapital: string;
  isActive: boolean;
  deletedAt: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface Broker { id: number; name: string; shortName: string }
export interface Instrument { id: number; code: string; name: string; isActive: boolean }
export interface AuthUser { id: number; email: string; displayName: string; role: "ADMIN" | "USER"; isActive: boolean }
export interface UserPreferences { brokers: Broker[]; instruments: Instrument[] }
export interface InstrumentContractSpec { id: number; instrumentFamily: string; multiplier: string; tickSize: string; initialMarginRate: string | null; maintenanceMarginRate: string | null; effectiveDate: string; isActive: boolean }
export interface BrokerContractTerm { id: number; brokerId: number; instrumentFamily: string; initialMargin: string; maintenanceMargin: string; commission: string; tradingFee: string; clearingFee: string; regulatoryFee: string; vat: string; otherFee: string; effectiveDate: string; isActive: boolean }

export interface AccountSummary {
  account: Account;
  cashBalance: string;
  equityBalance: string;
  totalDeposits: string;
  totalWithdrawals: string;
  netCapitalFlow: string;
  netTradingProfit: string;
  realizedPnl: string;
  unrealizedPnl: string;
}

export interface DashboardSummary {
  portfolioEquity: string;
  cashBalance: string;
  netTradingPnl: string;
  realizedPnl: string;
  unrealizedPnl: string;
  totalDeposits: string;
  totalWithdrawals: string;
  netCapitalFlow: string;
  totalFees: string;
  winRate: number;
  profitFactor: number | null;
  expectancy: string;
  totalTrades: number;
  maxDrawdown: number | null;
  notionalExposure: string;
  effectiveLeverage: number | null;
  marginUsed: string;
  marginUtilization: number | null;
}

export interface Trade {
  id: number;
  accountId: number;
  instrument: string;
  direction: string;
  openedAt: string | null;
  closedAt: string | null;
  status: string;
  totalEntryQuantity: number;
  totalExitQuantity: number;
  averageEntryPrice: string | null;
  averageExitPrice: string | null;
  grossPnl: string;
  totalFees: string;
  netPnl: string;
  unrealizedPnl: string | null;
  holdingDurationSeconds: number | null;
  holdingDays: number | null;
  strategyId: number | null;
  createdAt: string;
  updatedAt: string;
}

export interface BrokerTransaction {
  id: number;
  accountId: number;
  tradeDate: string;
  tradeTime: string | null;
  instrument: string;
  contractMonth: string | null;
  side: string;
  action: string;
  quantity: number;
  price: string | null;
  costPrice: string | null;
  commission: string | null;
  tradingFee: string | null;
  clearingFee: string | null;
  regulatoryFee: string | null;
  vat: string | null;
  otherFee: string | null;
  totalFee: string | null;
  realizedPnl: string | null;
  brokerReference: string | null;
  source: string;
  sourceDocumentId: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface TradeDetail extends Trade {
  transactions: BrokerTransaction[];
}

export interface CashTransaction {
  id: number;
  accountId: number;
  type: string;
  transactionDate: string;
  amount: string;
  reference: string | null;
  paymentMethod: string | null;
  note: string | null;
  attachmentId: number | null;
  createdAt: string;
  updatedAt: string;
}

export interface CashFlowSummary {
  totalDeposits: string;
  totalWithdrawals: string;
  totalInterest: string;
  totalAdjustments: string;
  netCapitalFlow: string;
}

export interface AnalyticsSummary {
  totalTrades: number;
  winningTrades: number;
  losingTrades: number;
  breakEvenTrades: number;
  winRate: number;
  grossProfit: string;
  grossLoss: string;
  netProfit: string;
  averageWin: string;
  averageLoss: string;
  largestWin: string;
  largestLoss: string;
  profitFactor: number | null;
  expectancy: string;
  totalFees: string;
  totalContracts: number;
}

export interface GroupedMetric {
  key: string;
  trades: number;
  contracts: number;
  winRate: number;
  grossPnl: string;
  fees: string;
  netPnl: string;
  profitFactor: number | null;
  expectancy: string;
  averageWin: string;
  averageLoss: string;
}

export interface EquityPoint {
  date: string;
  equity: string;
  drawdown: number;
}

export interface EquityCurve {
  points: EquityPoint[];
  currentDrawdown: number | null;
  maxDrawdown: number | null;
  peakEquity: string;
  troughEquity: string;
}

export interface Position {
  id: number;
  accountId: number;
  instrument: string;
  direction: string;
  quantity: number;
  averagePrice: string;
  marketPrice: string | null;
  unrealizedPnl: string;
  marginUsed: string;
  updatedAt: string;
}

export interface Strategy {
  id: number;
  name: string;
  description: string | null;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}
