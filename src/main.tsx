/**
 * @file script.js
 * @description F1 Indometrics: Mobile-First Financial Feasibility and Risk Analysis Model
 * An academic management and decision-support prototype for Indian Grand Prix promoter economics.
 * Features Monte Carlo probability simulation, multi-scenario comparisons, and touch-optimized controls.
 */

// ============================================================================
// 1. GLOBAL STATE & CONSTANTS
// ============================================================================

/**
 * Baseline Illustrative Assumptions (Academic Defaults)
 * Note: These are illustrative reference figures for simulation, not audited accounts.
 */
const DEFAULT_INPUTS = {
  ticketPrice: 8000,           // ₹8,000 average ticket price
  attendance: 50000,           // 50,000 expected paying attendees
  otherRevenue: 250000000,     // ₹25,00,00,000 (₹25 Crore) sponsorship & event revenue
  operatingCost: 600000000,    // ₹60,00,00,000 (₹60 Crore) event operating cost
  taxRate: 18,                 // 18% illustrative effective tax rate on ticket revenue
  localSpending: 15000         // ₹15,000 local attendee spending (external metric)
};

/**
 * Curated Alternative Example: Conservative Expansion Case
 */
const EXAMPLE_INPUTS = {
  ticketPrice: 9500,           // ₹9,500 premium tier average
  attendance: 62000,           // 62,000 attendance
  otherRevenue: 320000000,     // ₹32 Crore other commercial revenue
  operatingCost: 640000000,    // ₹64 Crore operating cost with additional logistics
  taxRate: 18,                 // 18% illustrative tax
  localSpending: 17500         // ₹17,500 attendee local spending
};

/**
 * Multi-scenario baseline data
 */
let scenariosData = {
  low: {
    name: "Low Case (Cautious)",
    ticketPrice: 6500,
    attendance: 38000,
    otherRevenue: 180000000,
    operatingCost: 650000000,
    taxRate: 18,
    localSpending: 12000
  },
  base: {
    name: "Base Case (Reference)",
    ticketPrice: 8000,
    attendance: 50000,
    otherRevenue: 250000000,
    operatingCost: 600000000,
    taxRate: 18,
    localSpending: 15000
  },
  high: {
    name: "High Case (Optimistic)",
    ticketPrice: 9500,
    attendance: 68000,
    otherRevenue: 350000000,
    operatingCost: 620000000,
    taxRate: 18,
    localSpending: 18000
  }
};

/**
 * Editable Assumptions Register dataset
 */
let assumptionsRegister = [
  {
    parameter: "Average Ticket Price",
    value: "₹8,000",
    unit: "INR / Ticket",
    rationale: "Illustrative blended average across general admission (₹3k) and grandstand/club (₹15k–₹35k).",
    confidence: "Illustrative"
  },
  {
    parameter: "Paying Attendance",
    value: "50,000",
    unit: "Spectators / Race Day",
    rationale: "Approximate historical race-day capacity utilization at Buddh International Circuit (BIC).",
    confidence: "Illustrative"
  },
  {
    parameter: "Sponsorship & Other Commercial Revenue",
    value: "₹25.00 Cr",
    unit: "INR",
    rationale: "Promoter-retained domestic sponsors, title rights, concessions, and vendor merchandise fees.",
    confidence: "Illustrative"
  },
  {
    parameter: "Event Operating Cost",
    value: "₹60.00 Cr",
    unit: "INR",
    rationale: "Operational logistics, circuit maintenance, track marshals, security, staging, and marketing.",
    confidence: "Illustrative"
  },
  {
    parameter: "Illustrative Effective Tax Rate",
    value: "18%",
    unit: "Percentage (%)",
    rationale: "Hypothetical GST/tax sensitivity baseline applied to ticket receipts. Not legal tax counsel.",
    confidence: "Illustrative"
  },
  {
    parameter: "Local Attendee Spending",
    value: "₹15,000",
    unit: "INR / Attendee",
    rationale: "Estimated regional spending on hotel stays, dining, and transit in Delhi-NCR/Greater Noida.",
    confidence: "Illustrative"
  },
  {
    parameter: "Formula 1 Sanction Fee (Omitted from Base OpCost)",
    value: "Variable ($25M–$50M USD)",
    unit: "USD / Contract",
    rationale: "Standard Formula One Group race sanction fee; often funded by state subsidies or private backers.",
    confidence: "Low"
  }
];

// Active sensitivity test variable
let activeSensitivityVar = "attendance";

// Chart instance references for clean destruction/re-rendering
let chartRevenueOutflow = null;
let chartScenarios = null;
let chartSensitivity = null;
let chartMonteCarlo = null;

// ============================================================================
// 2. NUMBER FORMATTING HELPERS (INDIAN NUMBERING SYSTEM)
// ============================================================================

/**
 * Formats a number into Indian Rupee currency format (e.g., ₹1,25,00,000)
 * Uses standard Intl.NumberFormat with 'en-IN'.
 * @param {number} amount
 * @returns {string} Formatted INR string
 */
function formatINR(amount) {
  if (amount === null || amount === undefined || isNaN(amount)) {
    return "₹0";
  }
  const isNegative = amount < 0;
  const absAmount = Math.abs(Math.round(amount));
  
  // Format with en-IN locale
  const formatted = new Intl.NumberFormat('en-IN', {
    maximumFractionDigits: 0
  }).format(absAmount);
  
  return (isNegative ? "-₹" : "₹") + formatted;
}

/**
 * Formats large amounts into readable Indian Lakh and Crore notation
 * @param {number} amount
 * @returns {string} e.g. "₹25.00 Cr" or "₹75.00 L" or "₹50,000"
 */
function formatLakhCrore(amount) {
  if (amount === null || amount === undefined || isNaN(amount)) {
    return "₹0";
  }
  const isNegative = amount < 0;
  const abs = Math.abs(amount);
  const sign = isNegative ? "-" : "";

  if (abs >= 10000000) {
    // 1 Crore = 10,000,000
    const cr = (abs / 10000000).toFixed(2);
    return `${sign}₹${cr} Cr`;
  } else if (abs >= 100000) {
    // 1 Lakh = 100,000
    const lk = (abs / 100000).toFixed(2);
    return `${sign}₹${lk} L`;
  } else {
    return formatINR(amount);
  }
}

/**
 * Formats integer attendee counts with Indian grouping commas (e.g. 50,000)
 * @param {number} num
 * @returns {string}
 */
function formatNumber(num) {
  if (num === null || num === undefined || isNaN(num)) return "0";
  return new Intl.NumberFormat('en-IN').format(Math.round(num));
}

// ============================================================================
// 3. CORE INPUT READING & VALIDATION FUNCTIONS
// ============================================================================

/**
 * Reads user inputs from DOM form elements.
 * @returns {Object} Raw numeric input values
 */
function readInputs() {
  return {
    ticketPrice: parseFloat(document.getElementById("input-ticket-price")?.value),
    attendance: parseFloat(document.getElementById("input-attendance")?.value),
    otherRevenue: parseFloat(document.getElementById("input-other-revenue")?.value),
    operatingCost: parseFloat(document.getElementById("input-operating-cost")?.value),
    taxRate: parseFloat(document.getElementById("input-tax-rate")?.value),
    localSpending: parseFloat(document.getElementById("input-local-spending")?.value)
  };
}

/**
 * Validates inputs against strict academic & economic rules.
 * Shows inline error messages and returns validation status.
 * @param {Object} inputs
 * @returns {Object} { isValid: boolean, errors: Object }
 */
function validateInputs(inputs) {
  const errors = {};

  // Clear previous inline error states
  document.querySelectorAll(".input-error-msg").forEach(el => {
    el.textContent = "";
    el.classList.remove("visible");
  });
  document.querySelectorAll(".form-input").forEach(el => el.classList.remove("input-error"));

  // 1. Ticket Price
  if (isNaN(inputs.ticketPrice) || inputs.ticketPrice === null) {
    errors.ticketPrice = "Average ticket price is required and must be a valid number.";
  } else if (inputs.ticketPrice <= 0) {
    errors.ticketPrice = "Average ticket price must be strictly greater than ₹0.";
  }

  // 2. Attendance
  if (isNaN(inputs.attendance) || inputs.attendance === null) {
    errors.attendance = "Paying attendance is required and must be a valid number.";
  } else if (inputs.attendance < 0) {
    errors.attendance = "Paying attendance cannot be negative.";
  }

  // 3. Sponsorship and other revenue
  if (isNaN(inputs.otherRevenue) || inputs.otherRevenue === null) {
    errors.otherRevenue = "Other event revenue is required and must be a valid number.";
  } else if (inputs.otherRevenue < 0) {
    errors.otherRevenue = "Other event revenue cannot be negative.";
  }

  // 4. Operating cost
  if (isNaN(inputs.operatingCost) || inputs.operatingCost === null) {
    errors.operatingCost = "Event operating cost is required and must be a valid number.";
  } else if (inputs.operatingCost < 0) {
    errors.operatingCost = "Event operating cost cannot be negative.";
  }

  // 5. Tax rate
  if (isNaN(inputs.taxRate) || inputs.taxRate === null) {
    errors.taxRate = "Effective tax rate is required and must be a valid number.";
  } else if (inputs.taxRate < 0 || inputs.taxRate > 100) {
    errors.taxRate = "Tax rate must be between 0% and 100%.";
  }

  // 6. Local spending
  if (isNaN(inputs.localSpending) || inputs.localSpending === null) {
    errors.localSpending = "Local spending per attendee is required.";
  } else if (inputs.localSpending < 0) {
    errors.localSpending = "Local spending cannot be negative.";
  }

  // Display errors if any
  const isValid = Object.keys(errors).length === 0;
  if (!isValid) {
    for (const [key, msg] of Object.entries(errors)) {
      const errorElement = document.getElementById(`error-${key}`);
      const inputElement = document.getElementById(`input-${key.replace(/([A-Z])/g, "-$1").toLowerCase()}`);
      if (errorElement) {
        errorElement.textContent = msg;
        errorElement.classList.add("visible");
      }
      if (inputElement) {
        inputElement.classList.add("input-error");
      }
    }
  }

  return { isValid, errors };
}

// ============================================================================
// 4. FINANCIAL CALCULATION ENGINE
// ============================================================================

/**
 * Calculates break-even attendance according to model specification:
 * estimatedBreakEvenAttendance = (operatingCost − otherEventRevenue) / (averageTicketPrice × (1 − taxRatePercent / 100))
 * 
 * Rules:
 * - If operatingCost <= otherEventRevenue, 0 tickets are needed.
 * - If denominator <= 0, break-even is not achievable through ticket sales.
 * - Rounds positive result UP to the next whole attendee (Math.ceil).
 * - Never returns a negative number.
 * 
 * @param {number} operatingCost 
 * @param {number} otherEventRevenue 
 * @param {number} averageTicketPrice 
 * @param {number} taxRatePercent 
 * @returns {Object} { breakEvenValue: number|null, status: string, explanation: string }
 */
function calculateBreakEvenAttendance(operatingCost, otherEventRevenue, averageTicketPrice, taxRatePercent) {
  // If non-ticket revenue already covers total operating costs:
  if (operatingCost <= otherEventRevenue) {
    return {
      breakEvenValue: 0,
      status: "Covered by Other Revenue",
      explanation: "Sponsorship and commercial revenues cover operating cost; 0 ticket sales required."
    };
  }

  // Effective net ticket contribution after illustrative tax per attendee
  const netContributionPerAttendee = averageTicketPrice * (1 - (taxRatePercent / 100));

  // Invalid denominator handling (e.g. 100% tax or 0 price)
  if (netContributionPerAttendee <= 0) {
    return {
      breakEvenValue: null,
      status: "Unachievable",
      explanation: "Net ticket contribution per attendee is zero or negative after modeled tax."
    };
  }

  const netFixedCostToCover = operatingCost - otherEventRevenue;
  const rawBreakEven = netFixedCostToCover / netContributionPerAttendee;

  if (rawBreakEven < 0) {
    return {
      breakEvenValue: 0,
      status: "Covered",
      explanation: "Non-ticket revenue fully offsets costs."
    };
  }

  // Round up to next whole attendee
  const breakEvenCeil = Math.ceil(rawBreakEven);

  return {
    breakEvenValue: breakEvenCeil,
    status: "Calculated",
    explanation: `Requires ${formatNumber(breakEvenCeil)} paying attendees to offset remaining fixed costs.`
  };
}

/**
 * Calculates complete financial results from validated inputs.
 * Uses strict formulas defined in project specification:
 * - ticketRevenue = averageTicketPrice × payingAttendance
 * - totalEventRevenue = ticketRevenue + otherEventRevenue
 * - illustrativeTax = ticketRevenue × (taxRatePercent / 100)
 * - modeledTotalOutflow = operatingCost + illustrativeTax
 * - estimatedNetResult = totalEventRevenue − modeledTotalOutflow
 * - estimatedLocalSpending = payingAttendance × localSpendingPerAttendee
 * 
 * @param {Object} inputs 
 * @returns {Object} Complete financial results
 */
function calculateFinancialResults(inputs) {
  const { ticketPrice, attendance, otherRevenue, operatingCost, taxRate, localSpending } = inputs;

  // 1. Primary Revenues
  const ticketRevenue = ticketPrice * attendance;
  const totalEventRevenue = ticketRevenue + otherRevenue;

  // 2. Modeled Outflows & Taxes
  const illustrativeTax = ticketRevenue * (taxRate / 100);
  const modeledTotalOutflow = operatingCost + illustrativeTax;

  // 3. Net Promoter Result (Surplus / Shortfall)
  const estimatedNetResult = totalEventRevenue - modeledTotalOutflow;

  // 4. External Local Spending (Segregated from promoter revenue)
  const estimatedLocalSpending = attendance * localSpending;

  // 5. Break-Even Attendance
  const breakEvenObj = calculateBreakEvenAttendance(operatingCost, otherRevenue, ticketPrice, taxRate);

  // 6. Net Profit Margin percentage
  const netMarginPercent = totalEventRevenue > 0 ? (estimatedNetResult / totalEventRevenue) * 100 : 0;

  // 7. Attendance vs Break-Even Delta
  let attendanceDelta = null;
  let attendanceDeltaPercent = null;
  if (breakEvenObj.breakEvenValue !== null) {
    attendanceDelta = attendance - breakEvenObj.breakEvenValue;
    attendanceDeltaPercent = breakEvenObj.breakEvenValue > 0
      ? (attendanceDelta / breakEvenObj.breakEvenValue) * 100
      : 100;
  }

  return {
    inputs: { ...inputs },
    ticketRevenue,
    otherRevenue,
    totalEventRevenue,
    illustrativeTax,
    operatingCost,
    modeledTotalOutflow,
    estimatedNetResult,
    estimatedLocalSpending,
    breakEven: breakEvenObj,
    netMarginPercent,
    attendanceDelta,
    attendanceDeltaPercent,
    isSurplus: estimatedNetResult >= 0
  };
}

// ============================================================================
// 5. MONTE CARLO STOCHASTIC RISK SIMULATION ENGINE
// ============================================================================

/**
 * Runs 500 stochastic simulation trials to evaluate the probability of achieving
 * an operational surplus (profit) under uncertain race-day attendance, ticket yield,
 * and cost variations.
 * 
 * Modeled Variances:
 * - Attendance: Normal distribution (StdDev ~15%)
 * - Ticket Yield: Uniform variation (±10%)
 * - Commercial Sponsorship: Uniform variation (±15%)
 * - Operating Costs: Asymmetric triangular variation (-10% to +25%)
 * 
 * @param {Object} inputs 
 * @param {number} iterations 
 * @returns {Object} Monte Carlo summary metrics
 */
function runMonteCarloSimulation(inputs, iterations = 500) {
  const outcomes = [];
  let profitCount = 0;

  // Pseudo-random Gaussian using Box-Muller transform
  function randomGaussian(mean = 0, stdev = 1) {
    const u = Math.max(1e-6, 1 - Math.random());
    const v = Math.random();
    const z = Math.sqrt(-2.0 * Math.log(u)) * Math.cos(2.0 * Math.PI * v);
    return mean + z * stdev;
  }

  for (let i = 0; i < iterations; i++) {
    // 1. Attendance variation: normal distribution constrained [0.4, 1.6]
    const attMultiplier = Math.max(0.4, Math.min(1.6, randomGaussian(1.0, 0.15)));
    const simAttendance = Math.round(inputs.attendance * attMultiplier);

    // 2. Ticket price variation: ±10%
    const priceMultiplier = 0.9 + Math.random() * 0.2;
    const simPrice = inputs.ticketPrice * priceMultiplier;

    // 3. Sponsorship variation: ±15%
    const sponsorMultiplier = 0.85 + Math.random() * 0.3;
    const simOtherRev = inputs.otherRevenue * sponsorMultiplier;

    // 4. Operating cost variation: -10% to +25%
    const costMultiplier = 0.9 + Math.random() * 0.35;
    const simCost = inputs.operatingCost * costMultiplier;

    // 5. Fixed tax rate
    const simTaxRate = inputs.taxRate;

    // Financial formulas
    const simTicketRev = simPrice * simAttendance;
    const simTotalRev = simTicketRev + simOtherRev;
    const simTax = simTicketRev * (simTaxRate / 100);
    const simOutflow = simCost + simTax;
    const simNet = simTotalRev - simOutflow;

    if (simNet >= 0) {
      profitCount++;
    }

    outcomes.push(simNet);
  }

  // Sort outcomes ascending
  outcomes.sort((a, b) => a - b);

  const profitProbability = (profitCount / iterations) * 100;
  const lossProbability = 100 - profitProbability;

  const p10Index = Math.floor(iterations * 0.10);
  const p50Index = Math.floor(iterations * 0.50);
  const p90Index = Math.floor(iterations * 0.90);

  const valAtRiskP10 = outcomes[p10Index];
  const medianOutcome = outcomes[p50Index];
  const upsideP90 = outcomes[p90Index];

  // Group into 7 histogram buckets for visual distribution
  const minVal = outcomes[0];
  const maxVal = outcomes[outcomes.length - 1];
  const bucketCount = 7;
  const bucketWidth = (maxVal - minVal) / bucketCount;
  const buckets = Array(bucketCount).fill(0);
  const bucketLabels = [];

  for (let b = 0; b < bucketCount; b++) {
    const bucketCenter = minVal + bucketWidth * (b + 0.5);
    bucketLabels.push(formatLakhCrore(bucketCenter));
  }

  outcomes.forEach(val => {
    let bIndex = Math.min(bucketCount - 1, Math.floor((val - minVal) / bucketWidth));
    if (bIndex < 0) bIndex = 0;
    buckets[bIndex]++;
  });

  return {
    iterations,
    profitProbability,
    lossProbability,
    valAtRiskP10,
    medianOutcome,
    upsideP90,
    bucketLabels,
    buckets,
    outcomes
  };
}

// ============================================================================
// 6. PLAIN-ENGLISH FINANCIAL ANALYSIS GENERATOR
// ============================================================================

/**
 * Generates an objective, academically grounded narrative explaining the result.
 * Highlights whether there is a surplus or shortfall, margins, break-even gap,
 * and key sensitivity drivers. Never hardcoded.
 * 
 * @param {Object} results 
 * @param {Object} mcResults 
 * @returns {string} HTML string containing explanatory paragraphs
 */
function generatePlainEnglishAnalysis(results, mcResults) {
  const { inputs, totalEventRevenue, modeledTotalOutflow, estimatedNetResult, breakEven, isSurplus, netMarginPercent, attendanceDelta } = results;
  
  const statusWord = isSurplus ? "modeled surplus" : "modeled shortfall";
  const absResultFormatted = formatLakhCrore(Math.abs(estimatedNetResult));
  const fullAmountFormatted = formatINR(Math.abs(estimatedNetResult));
  
  let p1 = `Under current illustrative baseline inputs, the race promoter generates an <strong>${statusWord} of ${absResultFormatted}</strong> (${fullAmountFormatted}), with an operational margin of <strong>${netMarginPercent.toFixed(1)}%</strong> on total modeled revenue of ${formatLakhCrore(totalEventRevenue)}.`;

  let p2 = "";
  if (breakEven.breakEvenValue !== null) {
    if (breakEven.breakEvenValue === 0) {
      p2 = `Because sponsorship and commercial revenues (${formatLakhCrore(inputs.otherRevenue)}) exceed operating costs (${formatLakhCrore(inputs.operatingCost)}), the event achieves break-even without gate receipts under these simplified assumptions.`;
    } else if (attendanceDelta >= 0) {
      const excessAttendees = formatNumber(attendanceDelta);
      p2 = `Expected attendance of <strong>${formatNumber(inputs.attendance)}</strong> exceeds the estimated break-even threshold of <strong>${formatNumber(breakEven.breakEvenValue)} attendees</strong> by ${excessAttendees} tickets (+${Math.abs(results.attendanceDeltaPercent).toFixed(1)}%), providing an attendance cushion against demand shocks.`;
    } else {
      const deficitAttendees = formatNumber(Math.abs(attendanceDelta));
      p2 = `Expected attendance of <strong>${formatNumber(inputs.attendance)}</strong> is <strong>${deficitAttendees} attendees below</strong> the estimated break-even threshold of <strong>${formatNumber(breakEven.breakEvenValue)}</strong> (-${Math.abs(results.attendanceDeltaPercent).toFixed(1)}%). To eliminate the deficit, the promoter would require higher attendance, higher average ticket yields, or expanded commercial partnerships.`;
    }
  } else {
    p2 = `Break-even could not be calculated because the net ticket contribution per attendee is zero or negative after modeled tax.`;
  }

  // Monte Carlo narrative
  let p3 = "";
  if (mcResults) {
    p3 = `<strong>Stochastic Risk:</strong> Across 500 simulated Monte Carlo trials incorporating attendance, pricing, and cost volatility, the <strong>probability of achieving a surplus is ${mcResults.profitProbability.toFixed(1)}%</strong> (Loss Probability: ${mcResults.lossProbability.toFixed(1)}%). The median simulated result is <strong>${formatLakhCrore(mcResults.medianOutcome)}</strong>, with a 10th percentile downside Value-at-Risk of <strong>${formatLakhCrore(mcResults.valAtRiskP10)}</strong>. External attendee spending of <strong>${formatLakhCrore(results.estimatedLocalSpending)}</strong> represents regional tourism activity, segregated from promoter returns.`;
  }

  return `<p>${p1}</p><p>${p2}</p><p>${p3}</p>`;
}

// ============================================================================
// 7. UI RENDERING FUNCTIONS
// ============================================================================

/**
 * Updates KPI cards, status banners, table rows, and dynamic narratives.
 * @param {Object} results 
 * @param {Object} mcResults 
 */
function renderResults(results, mcResults) {
  // 1. Status Banner
  const banner = document.getElementById("status-banner");
  const bannerBadge = document.getElementById("status-indicator-badge");
  const bannerHeadline = document.getElementById("status-text-headline");
  const bannerSubline = document.getElementById("status-text-subline");
  const bannerAmount = document.getElementById("status-amount-val");

  if (banner) {
    banner.classList.remove("surplus", "shortfall");
    if (results.isSurplus) {
      banner.classList.add("surplus");
      if (bannerBadge) bannerBadge.textContent = "+";
      if (bannerHeadline) bannerHeadline.textContent = "Estimated Modeled Surplus";
      if (bannerSubline) bannerSubline.textContent = "Revenues exceed modeled outflows under current assumptions";
    } else {
      banner.classList.add("shortfall");
      if (bannerBadge) bannerBadge.textContent = "−";
      if (bannerHeadline) bannerHeadline.textContent = "Estimated Modeled Shortfall";
      if (bannerSubline) bannerSubline.textContent = "Modeled outflows exceed total event revenue";
    }
    if (bannerAmount) bannerAmount.textContent = formatINR(results.estimatedNetResult);
  }

  // 2. Primary KPI Cards
  const elTotalRev = document.getElementById("kpi-total-revenue");
  const elTotalRevSub = document.getElementById("kpi-total-revenue-sub");
  if (elTotalRev) elTotalRev.textContent = formatLakhCrore(results.totalEventRevenue);
  if (elTotalRevSub) elTotalRevSub.textContent = formatINR(results.totalEventRevenue);

  const elTotalOutflow = document.getElementById("kpi-total-outflow");
  const elTotalOutflowSub = document.getElementById("kpi-total-outflow-sub");
  if (elTotalOutflow) elTotalOutflow.textContent = formatLakhCrore(results.modeledTotalOutflow);
  if (elTotalOutflowSub) elTotalOutflowSub.textContent = formatINR(results.modeledTotalOutflow);

  const elNet = document.getElementById("kpi-net-result");
  const elNetSub = document.getElementById("kpi-net-result-sub");
  if (elNet) {
    elNet.textContent = formatLakhCrore(results.estimatedNetResult);
    elNet.classList.remove("text-surplus", "text-shortfall");
    elNet.classList.add(results.isSurplus ? "text-surplus" : "text-shortfall");
  }
  if (elNetSub) elNetSub.textContent = formatINR(results.estimatedNetResult);

  const elBreakEven = document.getElementById("kpi-breakeven");
  const elBreakEvenSub = document.getElementById("kpi-breakeven-sub");
  if (elBreakEven) {
    if (results.breakEven.breakEvenValue !== null) {
      elBreakEven.textContent = formatNumber(results.breakEven.breakEvenValue);
      if (elBreakEvenSub) {
        if (results.attendanceDelta !== null) {
          const deltaSign = results.attendanceDelta >= 0 ? "+" : "";
          elBreakEvenSub.textContent = `Gap: ${deltaSign}${formatNumber(results.attendanceDelta)} attendees`;
        } else {
          elBreakEvenSub.textContent = results.breakEven.status;
        }
      }
    } else {
      elBreakEven.textContent = "N/A";
      if (elBreakEvenSub) elBreakEvenSub.textContent = "Net contribution ≤ 0";
    }
  }

  const elLocal = document.getElementById("kpi-local-spending");
  const elLocalSub = document.getElementById("kpi-local-spending-sub");
  if (elLocal) elLocal.textContent = formatLakhCrore(results.estimatedLocalSpending);
  if (elLocalSub) elLocalSub.textContent = `${formatINR(results.estimatedLocalSpending)} (External)`;

  const elMargin = document.getElementById("kpi-margin");
  const elMarginSub = document.getElementById("kpi-margin-sub");
  if (elMargin) {
    elMargin.textContent = `${results.netMarginPercent.toFixed(1)}%`;
    elMargin.classList.remove("text-surplus", "text-shortfall");
    elMargin.classList.add(results.isSurplus ? "text-surplus" : "text-shortfall");
  }
  if (elMarginSub) elMarginSub.textContent = results.isSurplus ? "Operating Surplus" : "Operating Deficit";

  // 3. Detailed Breakdown Table
  const updateCell = (id, text) => {
    const el = document.getElementById(id);
    if (el) el.textContent = text;
  };

  updateCell("table-ticket-rev", formatINR(results.ticketRevenue));
  updateCell("table-ticket-rev-scale", formatLakhCrore(results.ticketRevenue));
  
  updateCell("table-other-rev", formatINR(results.otherRevenue));
  updateCell("table-other-rev-scale", formatLakhCrore(results.otherRevenue));

  updateCell("table-total-rev", formatINR(results.totalEventRevenue));
  updateCell("table-total-rev-scale", formatLakhCrore(results.totalEventRevenue));

  updateCell("table-operating-cost", formatINR(results.operatingCost));
  updateCell("table-operating-cost-scale", formatLakhCrore(results.operatingCost));

  updateCell("table-tax-outflow", formatINR(results.illustrativeTax));
  updateCell("table-tax-outflow-scale", formatLakhCrore(results.illustrativeTax));

  updateCell("table-total-outflow", formatINR(results.modeledTotalOutflow));
  updateCell("table-total-outflow-scale", formatLakhCrore(results.modeledTotalOutflow));

  updateCell("table-net-result", formatINR(results.estimatedNetResult));
  updateCell("table-net-result-scale", formatLakhCrore(results.estimatedNetResult));

  updateCell("table-local-spend", formatINR(results.estimatedLocalSpending));
  updateCell("table-local-spend-scale", formatLakhCrore(results.estimatedLocalSpending));

  // 4. Dynamic Narrative
  const narrativeBox = document.getElementById("dynamic-analysis-narrative");
  if (narrativeBox) {
    narrativeBox.innerHTML = generatePlainEnglishAnalysis(results, mcResults);
  }

  // 5. Update Home Snapshot Cards
  renderHomeSnapshot(results, mcResults);

  // 6. Update Accordion summary tags
  updateAccordionHeaders(results.inputs);

  // 7. Update input previews
  updateInputPreviews(results.inputs);
}

/**
 * Updates the Home View quick snapshot metric cards.
 * @param {Object} results 
 * @param {Object} mcResults 
 */
function renderHomeSnapshot(results, mcResults) {
  const homeNetVal = document.getElementById("home-kpi-net-val");
  const homeNetSub = document.getElementById("home-kpi-net-sub");
  if (homeNetVal) {
    homeNetVal.textContent = formatLakhCrore(results.estimatedNetResult);
    homeNetVal.classList.remove("text-surplus", "text-shortfall");
    homeNetVal.classList.add(results.isSurplus ? "text-surplus" : "text-shortfall");
  }
  if (homeNetSub) {
    homeNetSub.textContent = results.isSurplus ? "Operating Surplus" : "Operating Deficit";
  }

  const homeBreakEvenVal = document.getElementById("home-kpi-breakeven-val");
  const homeBreakEvenSub = document.getElementById("home-kpi-breakeven-sub");
  if (homeBreakEvenVal) {
    if (results.breakEven.breakEvenValue !== null) {
      homeBreakEvenVal.textContent = `${formatNumber(results.breakEven.breakEvenValue)}`;
      if (homeBreakEvenSub) {
        homeBreakEvenSub.textContent = `Current: ${formatNumber(results.inputs.attendance)} attendees`;
      }
    } else {
      homeBreakEvenVal.textContent = "N/A";
      if (homeBreakEvenSub) homeBreakEvenSub.textContent = "Net contribution ≤ 0";
    }
  }

  const homeProbVal = document.getElementById("home-kpi-prob-val");
  const homeProbSub = document.getElementById("home-kpi-prob-sub");
  if (homeProbVal && mcResults) {
    homeProbVal.textContent = `${mcResults.profitProbability.toFixed(1)}%`;
    homeProbVal.classList.remove("text-surplus", "text-shortfall");
    homeProbVal.classList.add(mcResults.profitProbability >= 50 ? "text-surplus" : "text-shortfall");
    if (homeProbSub) {
      homeProbSub.textContent = `Loss Risk: ${mcResults.lossProbability.toFixed(1)}%`;
    }
  }
}

/**
 * Updates small helper hints and previews beneath inputs (e.g., showing Crore/Lakh conversion live)
 * @param {Object} inputs 
 */
function updateInputPreviews(inputs) {
  const previewOther = document.getElementById("preview-other-revenue");
  if (previewOther) previewOther.textContent = formatLakhCrore(inputs.otherRevenue);

  const previewCost = document.getElementById("preview-operating-cost");
  if (previewCost) previewCost.textContent = formatLakhCrore(inputs.operatingCost);

  const sliderAttendance = document.getElementById("slider-attendance");
  if (sliderAttendance) sliderAttendance.value = inputs.attendance;
}

/**
 * Updates compact summary pills inside simulator accordion headers.
 * @param {Object} inputs 
 */
function updateAccordionHeaders(inputs) {
  const tag1 = document.getElementById("accordion-tag-ticketing");
  if (tag1) tag1.textContent = `${formatINR(inputs.ticketPrice)} · ${formatNumber(inputs.attendance)}`;

  const tag2 = document.getElementById("accordion-tag-promoter");
  if (tag2) tag2.textContent = `Rev: ${formatLakhCrore(inputs.otherRevenue)} · Cost: ${formatLakhCrore(inputs.operatingCost)}`;

  const tag3 = document.getElementById("accordion-tag-fiscal");
  if (tag3) tag3.textContent = `Tax: ${inputs.taxRate}% · Spend: ${formatINR(inputs.localSpending)}`;
}

// ============================================================================
// 8. MONTE CARLO RISK UI RENDERING & CHARTS
// ============================================================================

/**
 * Renders the Monte Carlo probability gauges, cards, and stochastic histogram.
 * @param {Object} mcResults 
 */
function renderMonteCarlo(mcResults) {
  if (!mcResults) return;

  // Profit Probability percentage
  const probVal = document.getElementById("mc-profit-prob");
  if (probVal) {
    probVal.textContent = `${mcResults.profitProbability.toFixed(1)}%`;
    probVal.classList.remove("text-surplus", "text-shortfall");
    probVal.classList.add(mcResults.profitProbability >= 50 ? "text-surplus" : "text-shortfall");
  }

  // Loss Probability percentage
  const lossVal = document.getElementById("mc-loss-prob");
  if (lossVal) lossVal.textContent = `${mcResults.lossProbability.toFixed(1)}%`;

  // Segmented Bar Fill
  const barProfit = document.getElementById("mc-meter-profit");
  if (barProfit) barProfit.style.width = `${mcResults.profitProbability}%`;

  const barLoss = document.getElementById("mc-meter-loss");
  if (barLoss) barLoss.style.width = `${mcResults.lossProbability}%`;

  // Metric cards
  const elMedian = document.getElementById("mc-median-result");
  if (elMedian) {
    elMedian.textContent = formatLakhCrore(mcResults.medianOutcome);
    elMedian.classList.remove("text-surplus", "text-shortfall");
    elMedian.classList.add(mcResults.medianOutcome >= 0 ? "text-surplus" : "text-shortfall");
  }

  const elVaR = document.getElementById("mc-var-p10");
  if (elVaR) {
    elVaR.textContent = formatLakhCrore(mcResults.valAtRiskP10);
    elVaR.classList.remove("text-surplus", "text-shortfall");
    elVaR.classList.add(mcResults.valAtRiskP10 >= 0 ? "text-surplus" : "text-shortfall");
  }

  const elUpside = document.getElementById("mc-upside-p90");
  if (elUpside) {
    elUpside.textContent = formatLakhCrore(mcResults.upsideP90);
  }

  // Render Monte Carlo Histogram Chart
  renderMonteCarloChart(mcResults);
}

/**
 * Renders the stochastic distribution chart for Monte Carlo trials.
 * @param {Object} mcResults 
 */
function renderMonteCarloChart(mcResults) {
  const canvas = document.getElementById("chart-monte-carlo");
  if (!canvas || typeof Chart === "undefined") {
    renderFallbackMonteCarlo(mcResults);
    return;
  }

  if (chartMonteCarlo) {
    chartMonteCarlo.destroy();
  }

  const ctx = canvas.getContext("2d");
  chartMonteCarlo = new Chart(ctx, {
    type: "bar",
    data: {
      labels: mcResults.bucketLabels,
      datasets: [{
        label: "Trial Frequency",
        data: mcResults.buckets,
        backgroundColor: mcResults.buckets.map((_, i) => {
          return i >= Math.floor(mcResults.bucketLabels.length / 2)
            ? "rgba(16, 185, 129, 0.75)"
            : "rgba(239, 68, 68, 0.75)";
        }),
        borderRadius: 4
      }]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: { display: false },
        tooltip: {
          callbacks: {
            label: function(ctx) {
              return `${ctx.raw} trials in this outcome bracket`;
            }
          }
        }
      },
      scales: {
        x: {
          grid: { display: false },
          ticks: { color: "#94a3b8", font: { size: 10, family: "'Inter', sans-serif" } }
        },
        y: {
          grid: { color: "#262c3a" },
          ticks: { color: "#94a3b8", font: { size: 10 } },
          title: { display: true, text: "Frequency (Trials)", color: "#94a3b8", font: { size: 10 } }
        }
      }
    }
  });
}

function renderFallbackMonteCarlo(mcResults) {
  const box = document.getElementById("fallback-monte-carlo");
  if (!box) return;
  box.innerHTML = `
    <div style="font-size:0.75rem; color:#94a3b8;">
      500 Stochastic Iterations Summary: Profit Probability is <strong>${mcResults.profitProbability.toFixed(1)}%</strong>, Median Outcome: <strong>${formatLakhCrore(mcResults.medianOutcome)}</strong>, 10th Percentile Downside (VaR): <strong>${formatLakhCrore(mcResults.valAtRiskP10)}</strong>.
    </div>
  `;
}

// ============================================================================
// 9. CHART RENDERING & FALLBACK ENGINE
// ============================================================================

/**
 * Safely renders or updates Chart.js charts.
 * If Chart.js library is not available, switches to accessible HTML/SVG fallbacks.
 * Prevents memory leaks by destroying previous instances.
 * 
 * @param {Object} results 
 */
function renderCharts(results) {
  const chartAvailable = typeof Chart !== "undefined";

  document.querySelectorAll(".chart-fallback-box").forEach(el => {
    el.style.display = chartAvailable ? "none" : "flex";
  });
  document.querySelectorAll(".chart-canvas").forEach(el => {
    el.style.display = chartAvailable ? "block" : "none";
  });

  if (!chartAvailable) {
    renderFallbackCharts(results);
    return;
  }

  const chartTextColor = "#94a3b8";
  const chartGridColor = "#262c3a";
  const chartFont = { family: "'Inter', sans-serif", size: 10 };

  // ----------------------------------------------------
  // Chart 1: Revenue vs Outflow Breakdown
  // ----------------------------------------------------
  const canvasRevOutflow = document.getElementById("chart-revenue-outflow");
  if (canvasRevOutflow) {
    if (chartRevenueOutflow) {
      chartRevenueOutflow.destroy();
    }

    const ctx = canvasRevOutflow.getContext("2d");
    chartRevenueOutflow = new Chart(ctx, {
      type: "bar",
      data: {
        labels: ["Revenues", "Outflows"],
        datasets: [
          {
            label: "Ticket Revenue",
            data: [results.ticketRevenue / 10000000, 0], // In Crores
            backgroundColor: "#38bdf8",
            stack: "Stack 0"
          },
          {
            label: "Sponsorship",
            data: [results.otherRevenue / 10000000, 0],
            backgroundColor: "#818cf8",
            stack: "Stack 0"
          },
          {
            label: "Operating Cost",
            data: [0, results.operatingCost / 10000000],
            backgroundColor: "#f59e0b",
            stack: "Stack 1"
          },
          {
            label: "Illustrative Tax",
            data: [0, results.illustrativeTax / 10000000],
            backgroundColor: "#ef4444",
            stack: "Stack 1"
          }
        ]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: {
            position: "bottom",
            labels: { color: chartTextColor, font: chartFont, boxWidth: 10 }
          },
          tooltip: {
            callbacks: {
              label: function(context) {
                return `${context.dataset.label}: ₹${context.raw.toFixed(2)} Cr`;
              }
            }
          }
        },
        scales: {
          x: {
            grid: { display: false },
            ticks: { color: chartTextColor, font: chartFont }
          },
          y: {
            grid: { color: chartGridColor },
            ticks: {
              color: chartTextColor,
              font: chartFont,
              callback: function(val) { return `₹${val} Cr`; }
            },
            title: {
              display: true,
              text: "₹ Crore",
              color: chartTextColor,
              font: { size: 9 }
            }
          }
        }
      }
    });
  }

  // Render scenarios and sensitivity charts
  renderScenarioChart();
  renderSensitivityChart();
}

/**
 * Fallback chart renderer when Chart.js cannot be loaded (e.g. offline browser)
 * @param {Object} results 
 */
function renderFallbackCharts(results) {
  const container = document.getElementById("fallback-revenue-outflow");
  if (!container) return;

  const maxVal = Math.max(results.totalEventRevenue, results.modeledTotalOutflow, 1);
  const revPct = Math.min(100, (results.totalEventRevenue / maxVal) * 100).toFixed(1);
  const outPct = Math.min(100, (results.modeledTotalOutflow / maxVal) * 100).toFixed(1);

  container.innerHTML = `
    <div class="chart-fallback-notice">Lightweight Graphical Fallback:</div>
    <div class="fallback-bar-group">
      <div class="fallback-bar-label">
        <span>Total Modeled Revenue</span>
        <strong>${formatLakhCrore(results.totalEventRevenue)}</strong>
      </div>
      <div class="fallback-bar-track">
        <div class="fallback-bar-fill" style="width: ${revPct}%; background-color: #38bdf8;"></div>
      </div>
    </div>
    <div class="fallback-bar-group">
      <div class="fallback-bar-label">
        <span>Total Modeled Outflow</span>
        <strong>${formatLakhCrore(results.modeledTotalOutflow)}</strong>
      </div>
      <div class="fallback-bar-track">
        <div class="fallback-bar-fill" style="width: ${outPct}%; background-color: #f59e0b;"></div>
      </div>
    </div>
  `;
}

// ============================================================================
// 10. SCENARIO ANALYSIS ENGINE
// ============================================================================

/**
 * Calculates results for Low, Base, and High cases using the EXACT same
 * validated calculation engine function to avoid formula duplication.
 * @returns {Object} { low: Object, base: Object, high: Object }
 */
function calculateScenarioResults() {
  return {
    low: calculateFinancialResults(scenariosData.low),
    base: calculateFinancialResults(scenariosData.base),
    high: calculateFinancialResults(scenariosData.high)
  };
}

/**
 * Renders the scenario comparison table and mini-card summaries.
 */
function renderScenarioTable() {
  const scenarioResults = calculateScenarioResults();
  const tableBody = document.getElementById("scenario-table-body");
  if (!tableBody) return;

  const rows = [
    { key: "low", label: "Low Case (Cautious)", res: scenarioResults.low, data: scenariosData.low },
    { key: "base", label: "Base Case (Reference)", res: scenarioResults.base, data: scenariosData.base },
    { key: "high", label: "High Case (Optimistic)", res: scenarioResults.high, data: scenariosData.high }
  ];

  tableBody.innerHTML = rows.map(({ key, label, res, data }) => {
    const netClass = res.isSurplus ? "text-surplus" : "text-shortfall";
    const netSign = res.isSurplus ? "+" : "";
    const breakEvenText = res.breakEven.breakEvenValue !== null ? formatNumber(res.breakEven.breakEvenValue) : "N/A";

    return `
      <tr class="${key === 'base' ? 'highlight-base' : ''}">
        <td><strong>${label}</strong></td>
        <td class="col-right">${formatNumber(data.attendance)}</td>
        <td class="col-right">${formatINR(data.ticketPrice)}</td>
        <td class="col-right">${formatLakhCrore(res.totalEventRevenue)}</td>
        <td class="col-right">${formatLakhCrore(res.modeledTotalOutflow)}</td>
        <td class="col-right ${netClass}"><strong>${netSign}${formatLakhCrore(res.estimatedNetResult)}</strong></td>
        <td class="col-right">${breakEvenText}</td>
      </tr>
    `;
  }).join("");

  // Update mini cards inside scenario editor
  for (const [caseKey, res] of Object.entries(scenarioResults)) {
    const summaryEl = document.getElementById(`scenario-${caseKey}-summary`);
    if (summaryEl) {
      summaryEl.innerHTML = `
        <div class="scenario-summary-line">
          <span>Total Revenue:</span>
          <strong>${formatLakhCrore(res.totalEventRevenue)}</strong>
        </div>
        <div class="scenario-summary-line">
          <span>Modeled Outflow:</span>
          <strong>${formatLakhCrore(res.modeledTotalOutflow)}</strong>
        </div>
        <div class="scenario-summary-line bold ${res.isSurplus ? 'text-surplus' : 'text-shortfall'}">
          <span>Net Result:</span>
          <strong>${res.isSurplus ? '+' : ''}${formatLakhCrore(res.estimatedNetResult)}</strong>
        </div>
        <div class="scenario-summary-line">
          <span>Break-Even:</span>
          <span>${res.breakEven.breakEvenValue !== null ? formatNumber(res.breakEven.breakEvenValue) + ' fans' : 'N/A'}</span>
        </div>
      `;
    }
  }

  // Also update scenario chart
  renderScenarioChart();
}

/**
 * Renders the multi-scenario bar chart comparing net results.
 */
function renderScenarioChart() {
  const canvas = document.getElementById("chart-scenarios");
  if (!canvas || typeof Chart === "undefined") return;

  const scenarioResults = calculateScenarioResults();
  if (chartScenarios) {
    chartScenarios.destroy();
  }

  const ctx = canvas.getContext("2d");
  const dataValues = [
    scenarioResults.low.estimatedNetResult / 10000000,
    scenarioResults.base.estimatedNetResult / 10000000,
    scenarioResults.high.estimatedNetResult / 10000000
  ];

  const colors = dataValues.map(val => val >= 0 ? "#10b981" : "#ef4444");

  chartScenarios = new Chart(ctx, {
    type: "bar",
    data: {
      labels: ["Low Case", "Base Case", "High Case"],
      datasets: [{
        label: "Net Result (₹ Crore)",
        data: dataValues,
        backgroundColor: colors,
        borderRadius: 4
      }]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: { display: false },
        tooltip: {
          callbacks: {
            label: function(ctx) {
              const sign = ctx.raw >= 0 ? "+" : "";
              return `Net Result: ${sign}₹${ctx.raw.toFixed(2)} Cr`;
            }
          }
        }
      },
      scales: {
        x: {
          grid: { display: false },
          ticks: { color: "#94a3b8", font: { size: 10, family: "'Inter', sans-serif" } }
        },
        y: {
          grid: { color: "#262c3a" },
          ticks: {
            color: "#94a3b8",
            font: { size: 10 },
            callback: function(val) { return `₹${val} Cr`; }
          },
          title: {
            display: true,
            text: "Net Result in ₹ Crore",
            color: "#94a3b8",
            font: { size: 9 }
          }
        }
      }
    }
  });
}

/**
 * Handles live edits inside the scenario editor cards.
 * @param {string} scenarioKey 'low' | 'base' | 'high'
 * @param {string} fieldKey 
 * @param {number} value 
 */
function updateScenarioInput(scenarioKey, fieldKey, value) {
  if (isNaN(value) || value < 0) return;
  if (scenariosData[scenarioKey]) {
    scenariosData[scenarioKey][fieldKey] = value;
    renderScenarioTable();
  }
}

// ============================================================================
// 11. SENSITIVITY ANALYSIS (ONE-VARIABLE-AT-A-TIME TESTING)
// ============================================================================

/**
 * Generates sensitivity test points for a single variable while holding others fixed.
 * Deterministic scenario analysis - not a statistical probability model.
 * 
 * @param {string} varKey 'attendance' | 'ticketPrice' | 'operatingCost' | 'taxRate'
 * @returns {Array} Array of test result objects
 */
function calculateSensitivityData(varKey) {
  const currentInputs = readInputs();
  const base = {
    ticketPrice: isNaN(currentInputs.ticketPrice) ? DEFAULT_INPUTS.ticketPrice : currentInputs.ticketPrice,
    attendance: isNaN(currentInputs.attendance) ? DEFAULT_INPUTS.attendance : currentInputs.attendance,
    otherRevenue: isNaN(currentInputs.otherRevenue) ? DEFAULT_INPUTS.otherRevenue : currentInputs.otherRevenue,
    operatingCost: isNaN(currentInputs.operatingCost) ? DEFAULT_INPUTS.operatingCost : currentInputs.operatingCost,
    taxRate: isNaN(currentInputs.taxRate) ? DEFAULT_INPUTS.taxRate : currentInputs.taxRate,
    localSpending: isNaN(currentInputs.localSpending) ? DEFAULT_INPUTS.localSpending : currentInputs.localSpending
  };

  const steps = [];

  if (varKey === "attendance") {
    const multipliers = [0.6, 0.8, 0.9, 1.0, 1.1, 1.2, 1.4];
    multipliers.forEach(m => {
      const testVal = Math.round(base.attendance * m);
      const testInput = { ...base, attendance: testVal };
      const res = calculateFinancialResults(testInput);
      steps.push({
        label: `${m === 1.0 ? 'Base' : (m > 1 ? '+' : '') + Math.round((m - 1) * 100) + '%'} (${formatNumber(testVal)})`,
        rawVal: testVal,
        res
      });
    });
  } else if (varKey === "ticketPrice") {
    const multipliers = [0.6, 0.8, 0.9, 1.0, 1.1, 1.2, 1.4];
    multipliers.forEach(m => {
      const testVal = Math.round(base.ticketPrice * m);
      const testInput = { ...base, ticketPrice: testVal };
      const res = calculateFinancialResults(testInput);
      steps.push({
        label: `${m === 1.0 ? 'Base' : (m > 1 ? '+' : '') + Math.round((m - 1) * 100) + '%'} (${formatINR(testVal)})`,
        rawVal: testVal,
        res
      });
    });
  } else if (varKey === "operatingCost") {
    const multipliers = [0.7, 0.85, 1.0, 1.15, 1.3, 1.5];
    multipliers.forEach(m => {
      const testVal = Math.round(base.operatingCost * m);
      const testInput = { ...base, operatingCost: testVal };
      const res = calculateFinancialResults(testInput);
      steps.push({
        label: `${m === 1.0 ? 'Base' : (m > 1 ? '+' : '') + Math.round((m - 1) * 100) + '%'} (${formatLakhCrore(testVal)})`,
        rawVal: testVal,
        res
      });
    });
  } else if (varKey === "taxRate") {
    const testRates = [0, 5, 12, 18, 28];
    testRates.forEach(rate => {
      const testInput = { ...base, taxRate: rate };
      const res = calculateFinancialResults(testInput);
      steps.push({
        label: `${rate}% Rate ${rate === base.taxRate ? '(Current)' : ''}`,
        rawVal: rate,
        res
      });
    });
  }

  return steps;
}

/**
 * Renders sensitivity table and triggers sensitivity chart.
 * @param {string} varKey 
 */
function renderSensitivity(varKey) {
  activeSensitivityVar = varKey || activeSensitivityVar;
  const tableBody = document.getElementById("sensitivity-table-body");
  if (!tableBody) return;

  const data = calculateSensitivityData(activeSensitivityVar);

  tableBody.innerHTML = data.map(item => {
    const res = item.res;
    const netSign = res.isSurplus ? "+" : "";
    const netClass = res.isSurplus ? "text-surplus" : "text-shortfall";
    const breakEvenDisplay = res.breakEven.breakEvenValue !== null ? formatNumber(res.breakEven.breakEvenValue) : "N/A";

    return `
      <tr>
        <td><strong>${item.label}</strong></td>
        <td class="col-right">${formatLakhCrore(res.totalEventRevenue)}</td>
        <td class="col-right">${formatLakhCrore(res.modeledTotalOutflow)}</td>
        <td class="col-right ${netClass}"><strong>${netSign}${formatLakhCrore(res.estimatedNetResult)}</strong></td>
        <td class="col-right">${breakEvenDisplay}</td>
      </tr>
    `;
  }).join("");

  renderSensitivityChart();
}

/**
 * Renders the sensitivity curve chart.
 */
function renderSensitivityChart() {
  const canvas = document.getElementById("chart-sensitivity");
  if (!canvas || typeof Chart === "undefined") return;

  if (chartSensitivity) {
    chartSensitivity.destroy();
  }

  const data = calculateSensitivityData(activeSensitivityVar);
  const labels = data.map(d => d.label.split(" ")[0]);
  const netValues = data.map(d => d.res.estimatedNetResult / 10000000); // In Crores

  const ctx = canvas.getContext("2d");
  chartSensitivity = new Chart(ctx, {
    type: "line",
    data: {
      labels,
      datasets: [{
        label: "Estimated Net Result (₹ Crore)",
        data: netValues,
        borderColor: "#e10600",
        backgroundColor: "rgba(225, 6, 0, 0.1)",
        borderWidth: 2,
        tension: 0.2,
        fill: true,
        pointBackgroundColor: netValues.map(v => v >= 0 ? "#10b981" : "#ef4444"),
        pointRadius: 4
      }]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: { display: false },
        tooltip: {
          callbacks: {
            label: function(ctx) {
              const sign = ctx.raw >= 0 ? "+" : "";
              return `Net Result: ${sign}₹${ctx.raw.toFixed(2)} Cr`;
            }
          }
        }
      },
      scales: {
        x: {
          grid: { color: "#1c2230" },
          ticks: { color: "#94a3b8", font: { size: 10, family: "'Inter', sans-serif" } }
        },
        y: {
          grid: { color: "#262c3a" },
          ticks: {
            color: "#94a3b8",
            font: { size: 10 },
            callback: function(val) { return `₹${val} Cr`; }
          },
          title: {
            display: true,
            text: "Net Result in ₹ Crore",
            color: "#94a3b8",
            font: { size: 9 }
          }
        }
      }
    }
  });
}

// ============================================================================
// 12. ASSUMPTIONS REGISTER TABLE
// ============================================================================

/**
 * Renders the editable assumptions register.
 */
function renderAssumptionsRegister() {
  const tbody = document.getElementById("assumptions-register-body");
  if (!tbody) return;

  tbody.innerHTML = assumptionsRegister.map((item) => {
    let confClass = "confidence-illustrative";
    if (item.confidence === "Low") confClass = "confidence-low";
    if (item.confidence === "Medium") confClass = "confidence-medium";
    if (item.confidence === "High") confClass = "confidence-high";

    return `
      <tr>
        <td><strong>${item.parameter}</strong></td>
        <td><code>${item.value}</code></td>
        <td>${item.unit}</td>
        <td><span class="confidence-badge ${confClass}">${item.confidence}</span></td>
        <td><small>${item.rationale}</small></td>
      </tr>
    `;
  }).join("");
}

// ============================================================================
// 13. EXPORT & PRINT FUNCTIONS
// ============================================================================

/**
 * Exports current inputs, calculated outputs, and scenario comparison as a downloadable CSV.
 * Includes illustrative disclaimer notice.
 */
function exportResultsCSV() {
  const rawInputs = readInputs();
  const validation = validateInputs(rawInputs);
  if (!validation.isValid) {
    showToast("Cannot export: Please fix invalid input values first.");
    return;
  }

  const results = calculateFinancialResults(rawInputs);
  const now = new Date().toISOString();

  let csvContent = "data:text/csv;charset=utf-8,";
  csvContent += "F1 Indometrics: Indian Grand Prix Financial Feasibility Model\n";
  csvContent += `Generated On,${now}\n`;
  csvContent += "Type,Academic Decision-Support Prototype (Educational)\n";
  csvContent += "Disclaimer,All figures are illustrative assumptions and not audited accounts.\n\n";

  csvContent += "--- CURRENT SIMULATOR INPUTS ---\n";
  csvContent += "Parameter,Value,Unit,Note\n";
  csvContent += `Average Ticket Price,${results.inputs.ticketPrice},INR,Illustrative assumption\n`;
  csvContent += `Expected Paying Attendance,${results.inputs.attendance},Attendees,Illustrative assumption\n`;
  csvContent += `Sponsorship & Other Revenue,${results.inputs.otherRevenue},INR,Promoter commercial receipts\n`;
  csvContent += `Event Operating Cost,${results.inputs.operatingCost},INR,Promoter logistics and staging\n`;
  csvContent += `Illustrative Effective Tax Rate,${results.inputs.taxRate},Percent,Sensitivity assumption on ticket receipts\n`;
  csvContent += `Estimated Local Spending Per Attendee,${results.inputs.localSpending},INR,External visitor expenditure\n\n`;

  csvContent += "--- FINANCIAL RESULTS & KPIS ---\n";
  csvContent += "Metric,Amount (INR),Readable Scale,Status\n";
  csvContent += `Ticket Revenue,${results.ticketRevenue},${formatLakhCrore(results.ticketRevenue)},Organiser Revenue\n`;
  csvContent += `Other Commercial Revenue,${results.otherRevenue},${formatLakhCrore(results.otherRevenue)},Organiser Revenue\n`;
  csvContent += `Total Modeled Event Revenue,${results.totalEventRevenue},${formatLakhCrore(results.totalEventRevenue)},Gross Revenue\n`;
  csvContent += `Operating Cost,${results.operatingCost},${formatLakhCrore(results.operatingCost)},Direct Cost\n`;
  csvContent += `Illustrative Tax Outflow,${results.illustrativeTax},${formatLakhCrore(results.illustrativeTax)},Modeled Tax\n`;
  csvContent += `Modeled Total Outflow,${results.modeledTotalOutflow},${formatLakhCrore(results.modeledTotalOutflow)},Total Outflow\n`;
  csvContent += `Estimated Net Result,${results.estimatedNetResult},${formatLakhCrore(results.estimatedNetResult)},${results.isSurplus ? 'Surplus' : 'Shortfall'}\n`;
  csvContent += `Break-Even Attendance,${results.breakEven.breakEvenValue !== null ? results.breakEven.breakEvenValue : 'N/A'},Attendees,${results.breakEven.status}\n`;
  csvContent += `External Attendee Local Spending,${results.estimatedLocalSpending},${formatLakhCrore(results.estimatedLocalSpending)},Segregated Local Impact\n\n`;

  csvContent += "--- SCENARIO COMPARISON ---\n";
  csvContent += "Scenario,Attendance,Ticket Price,Total Revenue (INR),Total Outflow (INR),Net Result (INR),Break-Even\n";
  const scenarios = calculateScenarioResults();
  for (const [key, sRes] of Object.entries(scenarios)) {
    const sData = scenariosData[key];
    csvContent += `${sData.name},${sData.attendance},${sData.ticketPrice},${sRes.totalEventRevenue},${sRes.modeledTotalOutflow},${sRes.estimatedNetResult},${sRes.breakEven.breakEvenValue || 'N/A'}\n`;
  }

  const encodedUri = encodeURI(csvContent);
  const link = document.createElement("a");
  link.setAttribute("href", encodedUri);
  link.setAttribute("download", `F1_Indometrics_Feasibility_Report_${Date.now()}.csv`);
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);

  showToast("CSV report generated and downloaded.");
}

/**
 * Triggers the browser's native print / PDF dialog with clean print styling.
 */
function printReport() {
  const rawInputs = readInputs();
  const validation = validateInputs(rawInputs);
  if (!validation.isValid) {
    showToast("Please correct input errors before printing.");
    return;
  }
  window.print();
}

/**
 * Displays a lightweight toast notification in the UI.
 * @param {string} msg 
 */
function showToast(msg) {
  let toast = document.getElementById("app-toast");
  if (!toast) {
    toast = document.createElement("div");
    toast.id = "app-toast";
    toast.className = "toast-notice";
    document.body.appendChild(toast);
  }
  toast.textContent = msg;
  toast.classList.add("show");
  setTimeout(() => {
    toast.classList.remove("show");
  }, 2800);
}

// ============================================================================
// 14. USER ACTION CONTROLLERS & MOBILE INTERACTIVITY
// ============================================================================

/**
 * Performs feasibility calculation and executes Monte Carlo risk simulation.
 */
function handleCalculateFeasibility() {
  const inputs = readInputs();
  const validation = validateInputs(inputs);

  if (!validation.isValid) {
    showToast("Please resolve highlighted validation errors.");
    return false;
  }

  // 1. Deterministic baseline calculations
  const results = calculateFinancialResults(inputs);

  // 2. Monte Carlo 500-trial stochastic risk simulation
  const mcResults = runMonteCarloSimulation(inputs, 500);

  // 3. Render all UI modules
  renderResults(results, mcResults);
  renderCharts(results);
  renderMonteCarlo(mcResults);
  renderSensitivity(activeSensitivityVar);

  showToast("Simulation & Monte Carlo recalculated.");
  return true;
}

/**
 * Resets inputs to documented baseline default assumptions.
 */
function resetInputs() {
  document.getElementById("input-ticket-price").value = DEFAULT_INPUTS.ticketPrice;
  document.getElementById("input-attendance").value = DEFAULT_INPUTS.attendance;
  document.getElementById("input-other-revenue").value = DEFAULT_INPUTS.otherRevenue;
  document.getElementById("input-operating-cost").value = DEFAULT_INPUTS.operatingCost;
  document.getElementById("input-tax-rate").value = DEFAULT_INPUTS.taxRate;
  document.getElementById("input-local-spending").value = DEFAULT_INPUTS.localSpending;

  handleCalculateFeasibility();
  showToast("Reset all inputs to baseline default assumptions.");
}

/**
 * Loads the curated Conservative Expansion example values.
 */
function loadExampleValues() {
  document.getElementById("input-ticket-price").value = EXAMPLE_INPUTS.ticketPrice;
  document.getElementById("input-attendance").value = EXAMPLE_INPUTS.attendance;
  document.getElementById("input-other-revenue").value = EXAMPLE_INPUTS.otherRevenue;
  document.getElementById("input-operating-cost").value = EXAMPLE_INPUTS.operatingCost;
  document.getElementById("input-tax-rate").value = EXAMPLE_INPUTS.taxRate;
  document.getElementById("input-local-spending").value = EXAMPLE_INPUTS.localSpending;

  handleCalculateFeasibility();
  showToast("Loaded Conservative Expansion case example.");
}

/**
 * Smoothly scrolls to a specified target element on mobile or desktop.
 * @param {string} targetId 
 */
function scrollToSection(targetId) {
  const target = document.getElementById(targetId);
  if (target) {
    target.scrollIntoView({ behavior: "smooth" });
  }
}

/**
 * Sets up collapsible accordion cards in the simulator.
 */
function setupCollapsibleAccordions() {
  document.querySelectorAll(".accordion-toggle-btn").forEach(btn => {
    btn.addEventListener("click", () => {
      const panel = btn.nextElementSibling;
      const isExpanded = btn.getAttribute("aria-expanded") === "true";
      
      btn.setAttribute("aria-expanded", !isExpanded);
      if (panel) {
        panel.classList.toggle("collapsed", isExpanded);
      }
      btn.classList.toggle("active", !isExpanded);
    });
  });

  // Expand all / Collapse all button
  const toggleAllBtn = document.getElementById("btn-toggle-all-accordions");
  if (toggleAllBtn) {
    let allOpen = true;
    toggleAllBtn.addEventListener("click", () => {
      allOpen = !allOpen;
      document.querySelectorAll(".accordion-toggle-btn").forEach(btn => {
        btn.setAttribute("aria-expanded", allOpen);
        const panel = btn.nextElementSibling;
        if (panel) {
          panel.classList.toggle("collapsed", !allOpen);
        }
        btn.classList.toggle("active", allOpen);
      });
      toggleAllBtn.textContent = allOpen ? "Collapse All" : "Expand All";
    });
  }
}

/**
 * Configures the mobile bottom navigation bar and active tab highlight.
 */
function setupMobileNavigation() {
  const navItems = document.querySelectorAll(".bottom-nav-item, .header-nav-link");

  function setActiveNav(targetId) {
    navItems.forEach(item => {
      const href = item.getAttribute("href")?.replace("#", "");
      if (href === targetId) {
        item.classList.add("active");
      } else {
        item.classList.remove("active");
      }
    });
  }

  navItems.forEach(item => {
    item.addEventListener("click", (e) => {
      e.preventDefault();
      const targetId = item.getAttribute("href")?.replace("#", "");
      if (targetId) {
        scrollToSection(targetId);
        setActiveNav(targetId);
      }
    });
  });

  // IntersectionObserver to auto-update active tab as user scrolls
  const observerOptions = {
    root: null,
    rootMargin: "-20% 0px -60% 0px",
    threshold: 0
  };

  const sectionObserver = new IntersectionObserver((entries) => {
    entries.forEach(entry => {
      if (entry.isIntersecting) {
        const id = entry.target.id;
        setActiveNav(id);
      }
    });
  }, observerOptions);

  ["view-home", "view-simulator", "view-results", "view-risk"].forEach(id => {
    const el = document.getElementById(id);
    if (el) sectionObserver.observe(el);
  });
}

// ============================================================================
// 15. INITIALIZATION & EVENT LISTENERS
// ============================================================================

function initApp() {
  // Bind primary action buttons
  document.getElementById("btn-calculate")?.addEventListener("click", handleCalculateFeasibility);
  document.getElementById("btn-hero-run")?.addEventListener("click", () => {
    handleCalculateFeasibility();
    scrollToSection("view-results");
  });
  document.getElementById("btn-hero-simulator")?.addEventListener("click", () => {
    scrollToSection("view-simulator");
  });
  document.getElementById("btn-hero-risk")?.addEventListener("click", () => {
    scrollToSection("view-risk");
  });

  document.getElementById("btn-reset")?.addEventListener("click", resetInputs);
  document.getElementById("btn-load-example")?.addEventListener("click", loadExampleValues);
  document.getElementById("btn-hero-example")?.addEventListener("click", loadExampleValues);
  document.getElementById("btn-compare-scenarios")?.addEventListener("click", () => {
    scrollToSection("view-risk");
  });
  document.getElementById("btn-export-csv")?.addEventListener("click", exportResultsCSV);
  document.getElementById("btn-print-report")?.addEventListener("click", printReport);

  // Sync attendance slider with input
  const inputAttendance = document.getElementById("input-attendance");
  const sliderAttendance = document.getElementById("slider-attendance");
  if (inputAttendance && sliderAttendance) {
    sliderAttendance.addEventListener("input", (e) => {
      inputAttendance.value = e.target.value;
      const inputs = readInputs();
      updateInputPreviews(inputs);
    });
    inputAttendance.addEventListener("input", (e) => {
      sliderAttendance.value = e.target.value;
      const inputs = readInputs();
      updateInputPreviews(inputs);
    });
  }

  // Live input formatting preview updates on typing
  const liveInputs = [
    "input-ticket-price", "input-attendance", "input-other-revenue",
    "input-operating-cost", "input-tax-rate", "input-local-spending"
  ];
  liveInputs.forEach(id => {
    document.getElementById(id)?.addEventListener("input", () => {
      const inputs = readInputs();
      updateInputPreviews(inputs);
      updateAccordionHeaders(inputs);
    });
  });

  // Scenario editor field listeners
  document.querySelectorAll(".scenario-input").forEach(input => {
    input.addEventListener("input", (e) => {
      const scenario = e.target.dataset.scenario;
      const field = e.target.dataset.field;
      const val = parseFloat(e.target.value);
      updateScenarioInput(scenario, field, val);
    });
  });

  // Sensitivity tab switcher
  document.querySelectorAll(".sensitivity-tab-btn").forEach(btn => {
    btn.addEventListener("click", (e) => {
      document.querySelectorAll(".sensitivity-tab-btn").forEach(b => b.classList.remove("active"));
      e.target.classList.add("active");
      const varKey = e.target.dataset.var;
      renderSensitivity(varKey);
    });
  });

  // Setup mobile navigation and collapsible panels
  setupMobileNavigation();
  setupCollapsibleAccordions();

  // Initial tables and default calculation
  renderScenarioTable();
  renderAssumptionsRegister();
  handleCalculateFeasibility();
}

// Kick off when DOM is ready
if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", initApp);
} else {
  initApp();
}
