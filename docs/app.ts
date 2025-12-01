// PPH Calculator Types

// Tax Type Enum
enum TaxType {
    PPH21 = 'pph21',
    PPH22 = 'pph22',
    PPH23 = 'pph23',
    PPH4_2 = 'pph4_2',
    PPN = 'ppn',
    PPNBM = 'ppnbm'
}

// PPh 21 Types
interface PPH21Result {
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

// PPh 22 Types (Import/Export Withholding Tax)
interface PPH22Result {
    dpp: number;
    rate: number;
    tax: number;
}

// PPh 23 Types (Service Withholding Tax)
interface PPH23Result {
    grossIncome: number;
    rate: number;
    tax: number;
}

// PPh 4(2) Types (Final Income Tax)
interface PPH42Result {
    grossIncome: number;
    rate: number;
    tax: number;
}

// PPN Types (Value Added Tax)
enum PPNMode {
    EXCLUSIVE = 'exclusive',
    INCLUSIVE = 'inclusive'
}

interface PPNResult {
    dpp: number;
    rate: number;
    mode: PPNMode;
    ppn: number;
    total: number;
}

// PPNBM Types (Luxury Goods Sales Tax)
interface PPNBMResult {
    dpp: number;
    ppnRate: number;
    ppnbmRate: number;
    ppn: number;
    ppnbm: number;
    total: number;
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

class PPH21Calculator {
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
     * Calculate annual PPH 21
     */
    calculate(
        grossIncome: number,
        ptkpStatus: string,
        deductions: number = 0,
        workMonths: number = 12
    ): PPH21Result {
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

class PPH22Calculator {
    /**
     * Calculate PPh 22 (Import/Export Withholding Tax)
     * Formula: Tax = DPP × Rate
     */
    calculate(dpp: number, rate: number): PPH22Result {
        const tax = dpp * (rate / 100);

        return {
            dpp,
            rate,
            tax,
        };
    }
}

class PPH23Calculator {
    /**
     * Calculate PPh 23 (Service Withholding Tax)
     * Formula: Tax = Gross Income × Rate
     */
    calculate(grossIncome: number, rate: number): PPH23Result {
        const tax = grossIncome * (rate / 100);

        return {
            grossIncome,
            rate,
            tax,
        };
    }
}

class PPH42Calculator {
    /**
     * Calculate PPh Final Pasal 4(2) (Final Income Tax)
     * Formula: Tax = Gross Income × Rate
     */
    calculate(grossIncome: number, rate: number): PPH42Result {
        const tax = grossIncome * (rate / 100);

        return {
            grossIncome,
            rate,
            tax,
        };
    }
}

class PPNCalculator {
    /**
     * Calculate PPN (Value Added Tax)
     * Exclusive: PPN = DPP × Rate, Total = DPP + PPN
     * Inclusive: DPP = Total / (1 + Rate), PPN = Total - DPP
     */
    calculate(amount: number, rate: number, mode: PPNMode): PPNResult {
        let dpp: number;
        let ppn: number;
        let total: number;

        if (mode === PPNMode.EXCLUSIVE) {
            // Amount is DPP (before tax)
            dpp = amount;
            ppn = dpp * (rate / 100);
            total = dpp + ppn;
        } else {
            // Amount is Total (after tax, inclusive)
            total = amount;
            dpp = total / (1 + rate / 100);
            ppn = total - dpp;
        }

        return {
            dpp,
            rate,
            mode,
            ppn,
            total,
        };
    }
}

class PPNBMCalculator {
    /**
     * Calculate PPNBM (Luxury Goods Sales Tax)
     * Formula: PPN = DPP × PPN Rate
     *          PPNBM = DPP × PPNBM Rate
     *          Total = DPP + PPN + PPNBM
     */
    calculate(dpp: number, ppnRate: number, ppnbmRate: number): PPNBMResult {
        const ppn = dpp * (ppnRate / 100);
        const ppnbm = dpp * (ppnbmRate / 100);
        const total = dpp + ppn + ppnbm;

        return {
            dpp,
            ppnRate,
            ppnbmRate,
            ppn,
            ppnbm,
            total,
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
    return new Intl.NumberFormat('id-ID', {
        style: 'percent',
        minimumFractionDigits: 2,
        maximumFractionDigits: 2,
    }).format(value / 100);
}

// Initialize calculators
const pph21Calculator = new PPH21Calculator();
const pph22Calculator = new PPH22Calculator();
const pph23Calculator = new PPH23Calculator();
const pph42Calculator = new PPH42Calculator();
const ppnCalculator = new PPNCalculator();
const ppnbmCalculator = new PPNBMCalculator();

// Get DOM elements
const taxTypeSelect = document.getElementById('taxType') as HTMLSelectElement;
const form = document.getElementById('taxForm') as HTMLFormElement;
const resultsDiv = document.getElementById('results') as HTMLDivElement;
const errorDiv = document.getElementById('error') as HTMLDivElement;

// Form field containers
const pph21Fields = document.getElementById('pph21-fields') as HTMLDivElement;
const pph22Fields = document.getElementById('pph22-fields') as HTMLDivElement;
const pph23Fields = document.getElementById('pph23-fields') as HTMLDivElement;
const pph42Fields = document.getElementById('pph42-fields') as HTMLDivElement;
const ppnFields = document.getElementById('ppn-fields') as HTMLDivElement;
const ppnbmFields = document.getElementById('ppnbm-fields') as HTMLDivElement;

// Results containers
const pph21Results = document.getElementById('pph21-results') as HTMLDivElement;
const pph22Results = document.getElementById('pph22-results') as HTMLDivElement;
const pph23Results = document.getElementById('pph23-results') as HTMLDivElement;
const pph42Results = document.getElementById('pph42-results') as HTMLDivElement;
const ppnResults = document.getElementById('ppn-results') as HTMLDivElement;
const ppnbmResults = document.getElementById('ppnbm-results') as HTMLDivElement;

/**
 * Show/hide form fields based on selected tax type
 */
function updateFormFields(): void {
    const selectedType = taxTypeSelect.value as TaxType;

    // Hide all field containers
    [pph21Fields, pph22Fields, pph23Fields, pph42Fields, ppnFields, ppnbmFields].forEach(el => {
        el.style.display = 'none';
    });

    // Show selected field container
    switch (selectedType) {
        case TaxType.PPH21:
            pph21Fields.style.display = 'block';
            break;
        case TaxType.PPH22:
            pph22Fields.style.display = 'block';
            break;
        case TaxType.PPH23:
            pph23Fields.style.display = 'block';
            break;
        case TaxType.PPH4_2:
            pph42Fields.style.display = 'block';
            break;
        case TaxType.PPN:
            ppnFields.style.display = 'block';
            break;
        case TaxType.PPNBM:
            ppnbmFields.style.display = 'block';
            break;
    }

    // Hide results
    resultsDiv.classList.remove('show');
    clearError();
}

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
 * Display PPh 21 results
 */
function displayPPH21Results(result: PPH21Result): void {
    // Hide all result containers
    [pph21Results, pph22Results, pph23Results, pph42Results, ppnResults, ppnbmResults].forEach(el => {
        el.style.display = 'none';
    });

    // Show PPh 21 results
    pph21Results.style.display = 'block';

    document.getElementById('result-gross')!.textContent = formatCurrency(result.grossIncome);
    document.getElementById('result-deductions')!.textContent = formatCurrency(result.deductions);
    document.getElementById('result-ptkp')!.textContent = formatCurrency(result.ptkp);
    document.getElementById('result-pkp')!.textContent = formatCurrency(result.taxableIncome);
    document.getElementById('result-annual-tax')!.textContent = formatCurrency(result.annualTax);
    document.getElementById('result-monthly-tax')!.textContent = formatCurrency(result.monthlyTax);
    document.getElementById('result-tax-rate')!.textContent = formatPercent(result.effectiveTaxRate);
    document.getElementById('result-take-home-annual')!.textContent = formatCurrency(result.takeHomeAnnual);
    document.getElementById('result-take-home-monthly')!.textContent = formatCurrency(result.takeHomeMonthly);

    resultsDiv.classList.add('show');
}

/**
 * Display PPh 22 results
 */
function displayPPH22Results(result: PPH22Result): void {
    [pph21Results, pph22Results, pph23Results, pph42Results, ppnResults, ppnbmResults].forEach(el => {
        el.style.display = 'none';
    });

    pph22Results.style.display = 'block';

    document.getElementById('result-pph22-dpp')!.textContent = formatCurrency(result.dpp);
    document.getElementById('result-pph22-rate')!.textContent = formatPercent(result.rate);
    document.getElementById('result-pph22-tax')!.textContent = formatCurrency(result.tax);

    resultsDiv.classList.add('show');
}

/**
 * Display PPh 23 results
 */
function displayPPH23Results(result: PPH23Result): void {
    [pph21Results, pph22Results, pph23Results, pph42Results, ppnResults, ppnbmResults].forEach(el => {
        el.style.display = 'none';
    });

    pph23Results.style.display = 'block';

    document.getElementById('result-pph23-gross')!.textContent = formatCurrency(result.grossIncome);
    document.getElementById('result-pph23-rate')!.textContent = formatPercent(result.rate);
    document.getElementById('result-pph23-tax')!.textContent = formatCurrency(result.tax);

    resultsDiv.classList.add('show');
}

/**
 * Display PPh 4(2) results
 */
function displayPPH42Results(result: PPH42Result): void {
    [pph21Results, pph22Results, pph23Results, pph42Results, ppnResults, ppnbmResults].forEach(el => {
        el.style.display = 'none';
    });

    pph42Results.style.display = 'block';

    document.getElementById('result-pph42-gross')!.textContent = formatCurrency(result.grossIncome);
    document.getElementById('result-pph42-rate')!.textContent = formatPercent(result.rate);
    document.getElementById('result-pph42-tax')!.textContent = formatCurrency(result.tax);

    resultsDiv.classList.add('show');
}

/**
 * Display PPN results
 */
function displayPPNResults(result: PPNResult): void {
    [pph21Results, pph22Results, pph23Results, pph42Results, ppnResults, ppnbmResults].forEach(el => {
        el.style.display = 'none';
    });

    ppnResults.style.display = 'block';

    document.getElementById('result-ppn-dpp')!.textContent = formatCurrency(result.dpp);
    document.getElementById('result-ppn-rate')!.textContent = formatPercent(result.rate);
    document.getElementById('result-ppn-mode')!.textContent = result.mode === PPNMode.EXCLUSIVE ? 'Exclusive' : 'Inclusive';
    document.getElementById('result-ppn-ppn')!.textContent = formatCurrency(result.ppn);
    document.getElementById('result-ppn-total')!.textContent = formatCurrency(result.total);

    resultsDiv.classList.add('show');
}

/**
 * Display PPNBM results
 */
function displayPPNBMResults(result: PPNBMResult): void {
    [pph21Results, pph22Results, pph23Results, pph42Results, ppnResults, ppnbmResults].forEach(el => {
        el.style.display = 'none';
    });

    ppnbmResults.style.display = 'block';

    document.getElementById('result-ppnbm-dpp')!.textContent = formatCurrency(result.dpp);
    document.getElementById('result-ppnbm-ppn-rate')!.textContent = formatPercent(result.ppnRate);
    document.getElementById('result-ppnbm-ppnbm-rate')!.textContent = formatPercent(result.ppnbmRate);
    document.getElementById('result-ppnbm-ppn')!.textContent = formatCurrency(result.ppn);
    document.getElementById('result-ppnbm-ppnbm')!.textContent = formatCurrency(result.ppnbm);
    document.getElementById('result-ppnbm-total')!.textContent = formatCurrency(result.total);

    resultsDiv.classList.add('show');
}

/**
 * Handle form submission
 */
form.addEventListener('submit', (e: Event) => {
    e.preventDefault();
    clearError();

    const selectedType = taxTypeSelect.value as TaxType;

    try {
        switch (selectedType) {
            case TaxType.PPH21: {
                const grossIncome = parseFloat((document.getElementById('grossIncome') as HTMLInputElement).value);
                const ptkpStatus = (document.getElementById('ptkpStatus') as HTMLSelectElement).value;
                const deductions = parseFloat((document.getElementById('deductions') as HTMLInputElement).value) || 0;
                const workMonths = parseInt((document.getElementById('workMonth') as HTMLInputElement).value) || 12;

                if (isNaN(grossIncome) || grossIncome <= 0) {
                    showError('Please enter a valid gross income');
                    return;
                }

                const result = pph21Calculator.calculate(grossIncome, ptkpStatus, deductions, workMonths);
                displayPPH21Results(result);
                break;
            }

            case TaxType.PPH22: {
                const dpp = parseFloat((document.getElementById('pph22Dpp') as HTMLInputElement).value);
                const rate = parseFloat((document.getElementById('pph22Rate') as HTMLInputElement).value);

                if (isNaN(dpp) || dpp <= 0) {
                    showError('Please enter a valid DPP');
                    return;
                }
                if (isNaN(rate) || rate < 0) {
                    showError('Please enter a valid rate');
                    return;
                }

                const result = pph22Calculator.calculate(dpp, rate);
                displayPPH22Results(result);
                break;
            }

            case TaxType.PPH23: {
                const grossIncome = parseFloat((document.getElementById('pph23Gross') as HTMLInputElement).value);
                const rate = parseFloat((document.getElementById('pph23Rate') as HTMLInputElement).value);

                if (isNaN(grossIncome) || grossIncome <= 0) {
                    showError('Please enter a valid gross income');
                    return;
                }
                if (isNaN(rate) || rate < 0) {
                    showError('Please enter a valid rate');
                    return;
                }

                const result = pph23Calculator.calculate(grossIncome, rate);
                displayPPH23Results(result);
                break;
            }

            case TaxType.PPH4_2: {
                const grossIncome = parseFloat((document.getElementById('pph42Gross') as HTMLInputElement).value);
                const rate = parseFloat((document.getElementById('pph42Rate') as HTMLInputElement).value);

                if (isNaN(grossIncome) || grossIncome <= 0) {
                    showError('Please enter a valid gross income');
                    return;
                }
                if (isNaN(rate) || rate < 0) {
                    showError('Please enter a valid rate');
                    return;
                }

                const result = pph42Calculator.calculate(grossIncome, rate);
                displayPPH42Results(result);
                break;
            }

            case TaxType.PPN: {
                const amount = parseFloat((document.getElementById('ppnAmount') as HTMLInputElement).value);
                const rate = parseFloat((document.getElementById('ppnRate') as HTMLInputElement).value);
                const mode = (document.getElementById('ppnMode') as HTMLSelectElement).value as PPNMode;

                if (isNaN(amount) || amount <= 0) {
                    showError('Please enter a valid amount');
                    return;
                }
                if (isNaN(rate) || rate < 0) {
                    showError('Please enter a valid rate');
                    return;
                }

                const result = ppnCalculator.calculate(amount, rate, mode);
                displayPPNResults(result);
                break;
            }

            case TaxType.PPNBM: {
                const dpp = parseFloat((document.getElementById('ppnbmDpp') as HTMLInputElement).value);
                const ppnRate = parseFloat((document.getElementById('ppnbmPpnRate') as HTMLInputElement).value);
                const ppnbmRate = parseFloat((document.getElementById('ppnbmPpnbmRate') as HTMLInputElement).value);

                if (isNaN(dpp) || dpp <= 0) {
                    showError('Please enter a valid DPP');
                    return;
                }
                if (isNaN(ppnRate) || ppnRate < 0) {
                    showError('Please enter a valid PPN rate');
                    return;
                }
                if (isNaN(ppnbmRate) || ppnbmRate < 0) {
                    showError('Please enter a valid PPNBM rate');
                    return;
                }

                const result = ppnbmCalculator.calculate(dpp, ppnRate, ppnbmRate);
                displayPPNBMResults(result);
                break;
            }
        }
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

// Handle tax type change
taxTypeSelect.addEventListener('change', updateFormFields);

// Initialize form fields on page load
updateFormFields();