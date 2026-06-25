"use client";

import { useMemo, useState } from "react";
import { formatCurrency, formatPercent } from "@/lib/format";

// Interactive cost-of-capital / DSCR calculator.
// Receives the latest tracked rates from the server page as props.

type Structure = "sba" | "conventional";

export interface CostOfCapitalProps {
  sbaRate: number | null; // sba_7a_effective, percent
  conventionalRate: number | null; // conventional_acq_rate, percent
}

const SBA_DEFAULT_TERM = 120; // months (~10yr)
const CONVENTIONAL_DEFAULT_TERM = 84; // months (~7yr)

// Fallback rates used only if the DB has no metric yet, so the tool still works.
const SBA_FALLBACK = 11.5;
const CONVENTIONAL_FALLBACK = 9.5;

function amortizedMonthlyPayment(
  principal: number,
  annualRatePct: number,
  months: number
): number {
  if (principal <= 0 || months <= 0) return 0;
  const r = annualRatePct / 12 / 100;
  if (r === 0) return principal / months;
  const pow = Math.pow(1 + r, months);
  return (principal * r * pow) / (pow - 1);
}

function NumberField({
  label,
  value,
  onChange,
  prefix,
  suffix,
  step = 1,
  min = 0,
}: {
  label: string;
  value: number;
  onChange: (n: number) => void;
  prefix?: string;
  suffix?: string;
  step?: number;
  min?: number;
}) {
  return (
    <label className="block">
      <span className="mb-1 block text-xs font-medium text-gray-500">
        {label}
      </span>
      <div className="flex items-center rounded-md border border-gray-200 bg-white focus-within:border-gray-950">
        {prefix ? (
          <span className="pl-3 text-sm text-gray-400">{prefix}</span>
        ) : null}
        <input
          type="number"
          value={Number.isFinite(value) ? value : 0}
          min={min}
          step={step}
          onChange={(e) => {
            const n = parseFloat(e.target.value);
            onChange(Number.isNaN(n) ? 0 : n);
          }}
          className="w-full bg-transparent px-3 py-2 text-sm text-gray-950 outline-none tnum"
        />
        {suffix ? (
          <span className="pr-3 text-sm text-gray-400">{suffix}</span>
        ) : null}
      </div>
    </label>
  );
}

function Output({
  label,
  value,
  emphasis = false,
}: {
  label: string;
  value: string;
  emphasis?: boolean;
}) {
  return (
    <div className="flex flex-col">
      <span className="text-[11px] font-medium uppercase tracking-[0.1em] text-gray-400">
        {label}
      </span>
      <span
        className={`mt-1 tnum tracking-tight text-gray-950 ${
          emphasis ? "text-3xl font-semibold" : "text-xl font-medium"
        }`}
      >
        {value}
      </span>
    </div>
  );
}

export default function CostOfCapitalCalculator({
  sbaRate,
  conventionalRate,
}: CostOfCapitalProps) {
  const [dealSize, setDealSize] = useState(2_000_000);
  const [structure, setStructure] = useState<Structure>("sba");
  const [cashAtClosePct, setCashAtClosePct] = useState(10);
  const [sellerNotePct, setSellerNotePct] = useState(10);
  const [sbaTerm, setSbaTerm] = useState(SBA_DEFAULT_TERM);
  const [convTerm, setConvTerm] = useState(CONVENTIONAL_DEFAULT_TERM);
  const [ebitda, setEbitda] = useState(Math.round(2_000_000 / 4));

  const effectiveSba = sbaRate ?? SBA_FALLBACK;
  const effectiveConv = conventionalRate ?? CONVENTIONAL_FALLBACK;

  const result = useMemo(() => {
    const cashAtClose = (dealSize * cashAtClosePct) / 100;
    const sellerNote = (dealSize * sellerNotePct) / 100;
    const debt = Math.max(0, dealSize - cashAtClose - sellerNote);

    const rate = structure === "sba" ? effectiveSba : effectiveConv;
    const months = structure === "sba" ? sbaTerm : convTerm;

    const monthly = amortizedMonthlyPayment(debt, rate, months);
    const annual = monthly * 12;
    const dscr = annual > 0 ? ebitda / annual : null;

    return { cashAtClose, sellerNote, debt, rate, months, monthly, annual, dscr };
  }, [
    dealSize,
    cashAtClosePct,
    sellerNotePct,
    structure,
    effectiveSba,
    effectiveConv,
    sbaTerm,
    convTerm,
    ebitda,
  ]);

  const dscrPass = result.dscr != null && result.dscr >= 1.25;
  const dscrCaution = result.dscr != null && result.dscr < 1.25;

  const usingFallback =
    (structure === "sba" && sbaRate == null) ||
    (structure === "conventional" && conventionalRate == null);

  return (
    <div className="card overflow-hidden">
      <div className="grid grid-cols-1 lg:grid-cols-5">
        {/* Inputs */}
        <div className="border-b border-gray-200 p-5 lg:col-span-3 lg:border-b-0 lg:border-r">
          <div className="mb-4 flex items-center gap-3">
            <span className="text-xs font-medium uppercase tracking-[0.1em] text-gray-400">
              Structure
            </span>
            <div className="inline-flex rounded-md border border-gray-200 p-0.5">
              {(["sba", "conventional"] as Structure[]).map((s) => (
                <button
                  key={s}
                  type="button"
                  onClick={() => setStructure(s)}
                  className={`rounded px-3 py-1 text-sm transition-colors ${
                    structure === s
                      ? "bg-gray-950 text-white"
                      : "text-gray-500 hover:text-gray-950"
                  }`}
                >
                  {s === "sba" ? "SBA 7(a)" : "Conventional"}
                </button>
              ))}
            </div>
          </div>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <NumberField
              label="Deal Size"
              value={dealSize}
              onChange={(n) => setDealSize(n)}
              prefix="$"
              step={50_000}
            />
            <NumberField
              label="Assumed EBITDA"
              value={ebitda}
              onChange={(n) => setEbitda(n)}
              prefix="$"
              step={25_000}
            />
            <NumberField
              label="Cash at Close"
              value={cashAtClosePct}
              onChange={(n) => setCashAtClosePct(n)}
              suffix="%"
              step={1}
            />
            <NumberField
              label="Seller Note"
              value={sellerNotePct}
              onChange={(n) => setSellerNotePct(n)}
              suffix="%"
              step={1}
            />
            {structure === "sba" ? (
              <NumberField
                label="SBA Term"
                value={sbaTerm}
                onChange={(n) => setSbaTerm(n)}
                suffix="mo"
                step={12}
                min={12}
              />
            ) : (
              <NumberField
                label="Conventional Term"
                value={convTerm}
                onChange={(n) => setConvTerm(n)}
                suffix="mo"
                step={12}
                min={12}
              />
            )}
            <div className="flex flex-col justify-end">
              <span className="mb-1 block text-xs font-medium text-gray-500">
                Rate (tracked)
              </span>
              <div className="rounded-md border border-gray-200 bg-gray-100 px-3 py-2 text-sm text-gray-700 tnum">
                {formatPercent(result.rate)}
                {usingFallback ? (
                  <span className="ml-2 text-xs text-gray-400">
                    (default — no data yet)
                  </span>
                ) : null}
              </div>
            </div>
          </div>

          <div className="mt-4 grid grid-cols-3 gap-3 border-t border-gray-200 pt-4 text-sm">
            <div>
              <div className="text-[11px] uppercase tracking-wide text-gray-400">
                Cash at Close
              </div>
              <div className="tnum text-gray-700">
                {formatCurrency(result.cashAtClose)}
              </div>
            </div>
            <div>
              <div className="text-[11px] uppercase tracking-wide text-gray-400">
                Seller Note
              </div>
              <div className="tnum text-gray-700">
                {formatCurrency(result.sellerNote)}
              </div>
            </div>
            <div>
              <div className="text-[11px] uppercase tracking-wide text-gray-400">
                Debt Financed
              </div>
              <div className="tnum font-medium text-gray-950">
                {formatCurrency(result.debt)}
              </div>
            </div>
          </div>
        </div>

        {/* Outputs */}
        <div className="flex flex-col justify-between gap-6 bg-gray-100/50 p-5 lg:col-span-2">
          <div className="grid grid-cols-2 gap-5">
            <Output
              label="Monthly Debt Service"
              value={formatCurrency(result.monthly)}
              emphasis
            />
            <Output
              label="Annual Debt Service"
              value={formatCurrency(result.annual)}
            />
          </div>

          <div className="rounded-lg border border-gray-200 bg-white p-4">
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-medium uppercase tracking-[0.1em] text-gray-400">
                DSCR
              </span>
              {result.dscr != null ? (
                <span
                  className="rounded-full px-2 py-0.5 text-[11px] font-semibold uppercase tracking-wide text-white"
                  style={{
                    backgroundColor: dscrPass ? "var(--up)" : "var(--down)",
                  }}
                >
                  {dscrPass ? "Pass" : "Caution"}
                </span>
              ) : null}
            </div>
            <div
              className="mt-2 text-4xl font-semibold tracking-tight tnum"
              style={{
                color: dscrPass
                  ? "var(--up)"
                  : dscrCaution
                  ? "var(--down)"
                  : "var(--gray-950)",
              }}
            >
              {result.dscr != null ? `${result.dscr.toFixed(2)}x` : "—"}
            </div>
            <p className="mt-1 text-xs text-gray-500">
              Target ≥ 1.25x. EBITDA {formatCurrency(ebitda)} ÷ annual debt
              service.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
