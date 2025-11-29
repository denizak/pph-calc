// PPH Calculator Types
interface TaxCalculationResult {
    grossIncome: number;
    deductions: number;
    ptkp: number;
    taxableIncome: number;
    annualTax: number;
    monthlyTax: number;
    effectiveTaxRate: number;
    takeHomeAnnual: number;
    takeHomeMonthly: number;
}

interface PTKPRates {
    [key: string]: number;
}

// PTKP (Penghasilan Tidak Kena Pajak) rates for 2025
const PTKP_RATES: PTKPRates = {
    'TK': 54_000_000,      // Single
    'K1': 58_500_000,      // Married
    'K2': 63_000_000,      // Married + 1 Child
    'K3': 67_500_000,      // Married + 2 Children
};

// Progressive tax rates (Pasal 17)
interface TaxBracket {
    limit: number;
    rate: number;
}

const TAX_BRACKETS: TaxBracket[] = [
    { limit: 50_000_000, rate: 0.05 },      // 5%
    { limit: 250_000_000, rate: 0.15 },     // 15%
    { limit: 500_000_000, rate: 0.25 },     // 25%
    { limit: 5_000_000_000, rate: 0.30 },   // 30%
    { limit: Infinity, rate: 0.35 },        // 35%
];

class PPHCalculator {
    /**
     * Get PTKP (Non-taxable income) amount based on status
     */
    getPTKP(status: string): number {
        return PTKP_RATES[status] || PTKP_RATES['TK'];
    }

    /**
     * Calculate progressive tax using Pasal 17 rates
     */
    calculateProgressiveTax(pkp: number): number {
        if (pkp <= 0) return 0;

        let tax = 0;
        let previousLimit = 0;

        for (const bracket of TAX_BRACKETS) {
            const taxableInBracket = Math.min(pkp, bracket.limit) - previousLimit;

            if (taxableInBracket > 0) {
                tax += taxableInBracket * bracket.rate;
            }

            if (pkp <= bracket.limit) {
                break;
            }

            previousLimit = bracket.limit;
        }

        return tax;
    }

    /**
     * Calculate annual PPH
     */
    calculate(
        grossIncome: number,
        ptkpStatus: string,
        deductions: number = 0,
        workMonths: number = 12
    ): TaxCalculationResult {
        // Calculate PTKP for the working period
        const ptkp = (this.getPTKP(ptkpStatus) / 12) * workMonths;

        // Calculate PKP (Penghasilan Kena Pajak)
        const taxableIncome = Math.max(0, grossIncome - deductions - ptkp);

        // Calculate annual tax
        const annualTax = this.calculateProgressiveTax(taxableIncome);

        // Calculate monthly values
        const monthlyTax = annualTax / 12;
        const effectiveTaxRate = grossIncome > 0 ? (annualTax / grossIncome) * 100 : 0;

        // Calculate take-home pay
        const takeHomeAnnual = grossIncome - annualTax;
        const takeHomeMonthly = takeHomeAnnual / 12;

        return {
            grossIncome,
            deductions,
            ptkp,
            taxableIncome,
            annualTax,
            monthlyTax,
            effectiveTaxRate,
            takeHomeAnnual,
            takeHomeMonthly,
        };
    }
}

// Format currency for display
function formatCurrency(value: number): string {
    return new Intl.NumberFormat('id-ID', {
        style: 'currency',
        currency: 'IDR',
        minimumFractionDigits: 0,
        maximumFractionDigits: 0,
    }).format(value);
}

// Format percentage
function formatPercent(value: number): string {
    return new Intl. NumberFormat('id-ID', {
        style: 'percent',
        minimumFractionDigits: 2,
        maximumFractionDigits: 2,
    }).format(value / 100);
}

// Initialize calculator
const calculator = new PPHCalculator();

// Get DOM elements
const form = document.getElementById('taxForm') as HTMLFormElement;
const resultsDiv = document.getElementById('results') as HTMLDivElement;
const errorDiv = document.getElementById('error') as HTMLDivElement;

// Form inputs
const grossIncomeInput = document.getElementById('grossIncome') as HTMLInputElement;
const ptkpStatusInput = document.getElementById('ptkpStatus') as HTMLSelectElement;
const deductionsInput = document.getElementById('deductions') as HTMLInputElement;
const workMonthInput = document.getElementById('workMonth') as HTMLInputElement;

// Result display elements
const resultElements: { [key: string]: HTMLElement } = {
    'gross': document.getElementById('result-gross')!,
    'deductions': document.getElementById('result-deductions')!,
    'ptkp': document.getElementById('result-ptkp')!,
    'pkp': document.getElementById('result-pkp')!,
    'annual-tax': document.getElementById('result-annual-tax')!,
    'monthly-tax': document.getElementById('result-monthly-tax')! ,
    'tax-rate': document.getElementById('result-tax-rate')!,
    'take-home-annual': document.getElementById('result-take-home-annual')!,
    'take-home-monthly': document.getElementById('result-take-home-monthly')!,
};

/**
 * Display error message
 */
function showError(message: string): void {
    errorDiv.textContent = message;
    errorDiv.classList.add('show');
}

/**
 * Clear error message
 */
function clearError(): void {
    errorDiv.classList.remove('show');
    errorDiv.textContent = '';
}

/**
 * Display results
 */
function displayResults(result: TaxCalculationResult): void {
    resultElements['gross'].textContent = formatCurrency(result.grossIncome);
    resultElements['deductions'].textContent = formatCurrency(result.deductions);
    resultElements['ptkp'].textContent = formatCurrency(result.ptkp);
    resultElements['pkp'].textContent = formatCurrency(result.taxableIncome);
    resultElements['annual-tax'].textContent = formatCurrency(result.annualTax);
    resultElements['monthly-tax'].textContent = formatCurrency(result.monthlyTax);
    resultElements['tax-rate']. textContent = formatPercent(result.effectiveTaxRate);
    resultElements['take-home-annual'].textContent = formatCurrency(result.takeHomeAnnual);
    resultElements['take-home-monthly'].textContent = formatCurrency(result.takeHomeMonthly);

    resultsDiv.classList.add('show');
}

/**
 * Validate inputs
 */
function validateInputs(): boolean {
    const grossIncome = parseFloat(grossIncomeInput.value);

    if (isNaN(grossIncome) || grossIncome < 0) {
        showError('Please enter a valid gross income');
        return false;
    }

    if (grossIncome === 0) {
        showError('Gross income must be greater than 0');
        return false;
    }

    return true;
}

/**
 * Handle form submission
 */
form.addEventListener('submit', (e: Event) => {
    e.preventDefault();
    clearError();

    if (!validateInputs()) {
        resultsDiv.classList.remove('show');
        return;
    }

    const grossIncome = parseFloat(grossIncomeInput.value);
    const ptkpStatus = ptkpStatusInput.value;
    const deductions = parseFloat(deductionsInput.value) || 0;
    const workMonths = parseInt(workMonthInput.value) || 12;

    try {
        const result = calculator. calculate(
            grossIncome,
            ptkpStatus,
            deductions,
            workMonths
        );

        displayResults(result);
    } catch (error) {
        showError('An error occurred during calculation. Please try again.');
        console.error('Calculation error:', error);
    }
});

// Handle reset
form.addEventListener('reset', () => {
    clearError();
    resultsDiv.classList.remove('show');
});

// Clear error on input
[grossIncomeInput, deductionsInput, workMonthInput, ptkpStatusInput].forEach(input => {
    input.addEventListener('input', clearError);
});