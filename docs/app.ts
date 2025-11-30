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

    /**
     * Calculate PPh 21
     */
    calculatePPH21(
        brutoMonthly: number,
        monthsPaid: number,
        pensionContribution: number,
        zakatDonation: number,
        ptkpStatus: string
    ): TaxCalculationResult {
        // Simplified PPh 21 calculation
        // In a real implementation, this would use the libpph library
        const brutoAnnual = brutoMonthly * monthsPaid;
        const ptkp = this.getPTKP(ptkpStatus);
        const biayaJabatan = Math.min(brutoAnnual * 0.05, 6_000_000);
        const netto = brutoAnnual - biayaJabatan - (pensionContribution * monthsPaid) - zakatDonation;
        const pkp = Math.max(0, netto - ptkp);
        const annualTax = this.calculateProgressiveTax(pkp);
        
        return {
            grossIncome: brutoAnnual,
            deductions: biayaJabatan + (pensionContribution * monthsPaid) + zakatDonation,
            ptkp,
            taxableIncome: pkp,
            annualTax,
            monthlyTax: annualTax / 12,
            effectiveTaxRate: (annualTax / brutoAnnual) * 100,
            takeHomeAnnual: brutoAnnual - annualTax,
            takeHomeMonthly: (brutoAnnual - annualTax) / 12,
        };
    }

    /**
     * Calculate PPh 22
     */
    calculatePPH22(dpp: number, rate: number): TaxCalculationResult {
        const tax = dpp * (rate / 100);
        return {
            grossIncome: dpp,
            deductions: 0,
            ptkp: 0,
            taxableIncome: dpp,
            annualTax: tax,
            monthlyTax: tax / 12,
            effectiveTaxRate: rate,
            takeHomeAnnual: dpp - tax,
            takeHomeMonthly: (dpp - tax) / 12,
        };
    }

    /**
     * Calculate PPh 23
     */
    calculatePPH23(bruto: number, rate: number): TaxCalculationResult {
        const tax = bruto * (rate / 100);
        return {
            grossIncome: bruto,
            deductions: 0,
            ptkp: 0,
            taxableIncome: bruto,
            annualTax: tax,
            monthlyTax: tax / 12,
            effectiveTaxRate: rate,
            takeHomeAnnual: bruto - tax,
            takeHomeMonthly: (bruto - tax) / 12,
        };
    }

    /**
     * Calculate PPh Final Pasal 4(2)
     */
    calculatePPH42(bruto: number, rate: number): TaxCalculationResult {
        const tax = bruto * (rate / 100);
        return {
            grossIncome: bruto,
            deductions: 0,
            ptkp: 0,
            taxableIncome: bruto,
            annualTax: tax,
            monthlyTax: tax / 12,
            effectiveTaxRate: rate,
            takeHomeAnnual: bruto - tax,
            takeHomeMonthly: (bruto - tax) / 12,
        };
    }

    /**
     * Calculate PPN
     */
    calculatePPN(dpp: number, rate: number, mode: number): TaxCalculationResult {
        let tax: number;
        if (mode === 1) { // Inclusive
            tax = dpp - (dpp / (1 + rate / 100));
        } else { // Exclusive
            tax = dpp * (rate / 100);
        }
        
        return {
            grossIncome: dpp + tax,
            deductions: 0,
            ptkp: 0,
            taxableIncome: dpp,
            annualTax: tax,
            monthlyTax: tax / 12,
            effectiveTaxRate: (tax / dpp) * 100,
            takeHomeAnnual: dpp,
            takeHomeMonthly: dpp / 12,
        };
    }

    /**
     * Calculate PPnBM
     */
    calculatePPnBM(dpp: number, ppnRate: number, ppnbmRate: number): TaxCalculationResult {
        const ppn = dpp * (ppnRate / 100);
        const ppnbm = dpp * (ppnbmRate / 100);
        const totalTax = ppn + ppnbm;
        
        return {
            grossIncome: dpp + totalTax,
            deductions: 0,
            ptkp: 0,
            taxableIncome: dpp,
            annualTax: totalTax,
            monthlyTax: totalTax / 12,
            effectiveTaxRate: (totalTax / dpp) * 100,
            takeHomeAnnual: dpp,
            takeHomeMonthly: dpp / 12,
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

// Initialize calculator
const calculator = new PPHCalculator();

// Get DOM elements
const form = document.getElementById('taxForm') as HTMLFormElement;
const resultsDiv = document.getElementById('results') as HTMLDivElement;
const errorDiv = document.getElementById('error') as HTMLDivElement;

// Form inputs
const taxTypeInput = document.getElementById('taxType') as HTMLSelectElement;
const ptkpStatusInput = document.getElementById('ptkpStatus') as HTMLSelectElement;
const deductionsInput = document.getElementById('deductions') as HTMLInputElement;
const workMonthInput = document.getElementById('workMonth') as HTMLInputElement;

// PPh 21 specific inputs
const brutoMonthlyInput = document.getElementById('brutoMonthly') as HTMLInputElement;
const monthsPaidInput = document.getElementById('monthsPaid') as HTMLInputElement;
const pensionContributionInput = document.getElementById('pensionContribution') as HTMLInputElement;
const zakatDonationInput = document.getElementById('zakatDonation') as HTMLInputElement;

// PPh 22 specific inputs
const dpp22Input = document.getElementById('dpp22') as HTMLInputElement;
const rate22Input = document.getElementById('rate22') as HTMLInputElement;

// PPh 23 specific inputs
const bruto23Input = document.getElementById('bruto23') as HTMLInputElement;
const rate23Input = document.getElementById('rate23') as HTMLInputElement;

// PPh 4(2) specific inputs
const bruto42Input = document.getElementById('bruto42') as HTMLInputElement;
const rate42Input = document.getElementById('rate42') as HTMLInputElement;

// PPN specific inputs
const dppPpnInput = document.getElementById('dppPpn') as HTMLInputElement;
const ratePpnInput = document.getElementById('ratePpn') as HTMLInputElement;
const ppnModeInput = document.getElementById('ppnMode') as HTMLSelectElement;

// PPnBM specific inputs
const dppPpnbmInput = document.getElementById('dppPpnbm') as HTMLInputElement;
const ratePpnPpnbmInput = document.getElementById('ratePpnPpnbm') as HTMLInputElement;
const ratePpnbmInput = document.getElementById('ratePpnbm') as HTMLInputElement;

// Dynamic field containers
const pph21Fields = document.getElementById('pph21-fields') as HTMLElement;
const pph22Fields = document.getElementById('pph22-fields') as HTMLElement;
const pph23Fields = document.getElementById('pph23-fields') as HTMLElement;
const pph42Fields = document.getElementById('pph42-fields') as HTMLElement;
const ppnFields = document.getElementById('ppn-fields') as HTMLElement;
const ppnbmFields = document.getElementById('ppnbm-fields') as HTMLElement;

// Result display elements
const resultElements: { [key: string]: HTMLElement } = {
    'gross': document.getElementById('result-gross')!,
    'deductions': document.getElementById('result-deductions')!,
    'ptkp': document.getElementById('result-ptkp')!,
    'pkp': document.getElementById('result-pkp')!,
    'annual-tax': document.getElementById('result-annual-tax')!,
    'monthly-tax': document.getElementById('result-monthly-tax')!,
    'tax-rate': document.getElementById('result-tax-rate')!,
    'take-home-annual': document.getElementById('result-take-home-annual')!,
    'take-home-monthly': document.getElementById('result-take-home-monthly')!,
};

/**
 * Show/hide dynamic fields based on tax type
 */
function toggleDynamicFields(): void {
    const taxType = taxTypeInput.value;
    
    // Hide all dynamic fields
    pph21Fields.classList.remove('show');
    pph22Fields.classList.remove('show');
    pph23Fields.classList.remove('show');
    pph42Fields.classList.remove('show');
    ppnFields.classList.remove('show');
    ppnbmFields.classList.remove('show');
    
    // Show relevant fields
    switch (taxType) {
        case 'pph21':
            pph21Fields.classList.add('show');
            break;
        case 'pph22':
            pph22Fields.classList.add('show');
            break;
        case 'pph23':
            pph23Fields.classList.add('show');
            break;
        case 'pph42':
            pph42Fields.classList.add('show');
            break;
        case 'ppn':
            ppnFields.classList.add('show');
            break;
        case 'ppnbm':
            ppnbmFields.classList.add('show');
            break;
    }
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
 * Display results
 */
function displayResults(result: TaxCalculationResult): void {
    resultElements['gross'].textContent = formatCurrency(result.grossIncome);
    resultElements['deductions'].textContent = formatCurrency(result.deductions);
    resultElements['ptkp'].textContent = formatCurrency(result.ptkp);
    resultElements['pkp'].textContent = formatCurrency(result.taxableIncome);
    resultElements['annual-tax'].textContent = formatCurrency(result.annualTax);
    resultElements['monthly-tax'].textContent = formatCurrency(result.monthlyTax);
    resultElements['tax-rate'].textContent = formatPercent(result.effectiveTaxRate);
    resultElements['take-home-annual'].textContent = formatCurrency(result.takeHomeAnnual);
    resultElements['take-home-monthly'].textContent = formatCurrency(result.takeHomeMonthly);

    resultsDiv.classList.add('show');
}

/**
 * Validate inputs
 */
function validateInputs(): boolean {
    const taxType = taxTypeInput.value;
    let isValid = true;

    // Clear previous errors
    clearError();

    // Common validations
    if (taxType === 'pph21') {
        const brutoMonthly = parseFloat(brutoMonthlyInput.value);
        if (isNaN(brutoMonthly) || brutoMonthly <= 0) {
            showError('Please enter a valid bruto monthly income');
            return false;
        }
    } else if (taxType === 'pph22') {
        const dpp = parseFloat(dpp22Input.value);
        const rate = parseFloat(rate22Input.value);
        if (isNaN(dpp) || dpp <= 0) {
            showError('Please enter a valid DPP');
            return false;
        }
        if (isNaN(rate) || rate <= 0) {
            showError('Please enter a valid tax rate');
            return false;
        }
    } else if (taxType === 'pph23') {
        const bruto = parseFloat(bruto23Input.value);
        const rate = parseFloat(rate23Input.value);
        if (isNaN(bruto) || bruto <= 0) {
            showError('Please enter a valid bruto income');
            return false;
        }
        if (isNaN(rate) || rate <= 0) {
            showError('Please enter a valid tax rate');
            return false;
        }
    } else if (taxType === 'pph42') {
        const bruto = parseFloat(bruto42Input.value);
        const rate = parseFloat(rate42Input.value);
        if (isNaN(bruto) || bruto <= 0) {
            showError('Please enter a valid bruto income');
            return false;
        }
        if (isNaN(rate) || rate <= 0) {
            showError('Please enter a valid tax rate');
            return false;
        }
    } else if (taxType === 'ppn') {
        const dpp = parseFloat(dppPpnInput.value);
        const rate = parseFloat(ratePpnInput.value);
        if (isNaN(dpp) || dpp <= 0) {
            showError('Please enter a valid DPP');
            return false;
        }
        if (isNaN(rate) || rate <= 0) {
            showError('Please enter a valid PPN rate');
            return false;
        }
    } else if (taxType === 'ppnbm') {
        const dpp = parseFloat(dppPpnbmInput.value);
        const ppnRate = parseFloat(ratePpnPpnbmInput.value);
        const ppnbmRate = parseFloat(ratePpnbmInput.value);
        if (isNaN(dpp) || dpp <= 0) {
            showError('Please enter a valid DPP');
            return false;
        }
        if (isNaN(ppnRate) || ppnRate <= 0) {
            showError('Please enter a valid PPN rate');
            return false;
        }
        if (isNaN(ppnbmRate) || ppnbmRate <= 0) {
            showError('Please enter a valid PPnBM rate');
            return false;
        }
    }

    return isValid;
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

    const taxType = taxTypeInput.value;
    const ptkpStatus = ptkpStatusInput.value;

    let result: TaxCalculationResult;

    try {
        switch (taxType) {
            case 'pph21':
                const brutoMonthly = parseFloat(brutoMonthlyInput.value);
                const monthsPaid = parseInt(monthsPaidInput.value) || 12;
                const pensionContribution = parseFloat(pensionContributionInput.value) || 0;
                const zakatDonation = parseFloat(zakatDonationInput.value) || 0;
                
                result = calculator.calculatePPH21(
                    brutoMonthly,
                    monthsPaid,
                    pensionContribution,
                    zakatDonation,
                    ptkpStatus
                );
                break;
            
            case 'pph22':
                const dpp22 = parseFloat(dpp22Input.value);
                const rate22 = parseFloat(rate22Input.value) / 100;
                result = calculator.calculatePPH22(dpp22, rate22);
                break;
            
            case 'pph23':
                const bruto23 = parseFloat(bruto23Input.value);
                const rate23 = parseFloat(rate23Input.value) / 100;
                result = calculator.calculatePPH23(bruto23, rate23);
                break;
            
            case 'pph42':
                const bruto42 = parseFloat(bruto42Input.value);
                const rate42 = parseFloat(rate42Input.value) / 100;
                result = calculator.calculatePPH42(bruto42, rate42);
                break;
            
            case 'ppn':
                const dppPpn = parseFloat(dppPpnInput.value);
                const ratePpn = parseFloat(ratePpnInput.value) / 100;
                const ppnMode = parseInt(ppnModeInput.value);
                result = calculator.calculatePPN(dppPpn, ratePpn, ppnMode);
                break;
            
            case 'ppnbm':
                const dppPpnbm = parseFloat(dppPpnbmInput.value);
                const ratePpnPpnbm = parseFloat(ratePpnPpnbmInput.value) / 100;
                const ratePpnbm = parseFloat(ratePpnbmInput.value) / 100;
                result = calculator.calculatePPnBM(dppPpnbm, ratePpnPpnbm, ratePpnbm);
                break;
            
            default:
                showError('Invalid tax type selected');
                resultsDiv.classList.remove('show');
                return;
        }

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
    // Reset dynamic fields visibility
    setTimeout(() => {
        toggleDynamicFields();
    }, 0);
});

// Clear error on input
[deductionsInput, workMonthInput, ptkpStatusInput].forEach(input => {
    input.addEventListener('input', clearError);
});

// Toggle dynamic fields when tax type changes
taxTypeInput.addEventListener('change', toggleDynamicFields);

// Initialize dynamic fields visibility
toggleDynamicFields();
