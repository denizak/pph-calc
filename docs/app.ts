import Decimal from './decimal.js';

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

// PPh 21 Enums
enum PPh21Scheme {
    TRADITIONAL = 'traditional',
    TER = 'ter'
}

enum PPh21TERCategory {
    A = 'A',
    B = 'B',
    C = 'C'
}

// PPh 21 Types
interface PPh21Bonus {
    name: string;
    amount: number;
    month: number; // 1-12
}

interface PPh21DetailedResult {
    grossMonthly: number;
    grossAnnual: number;
    bonusTotal: number;
    bonuses: PPh21Bonus[];
    workMonths: number;

    // Deductions
    biayaJabatan: number;
    pensionAnnual: number;
    zakatDonation: number;
    totalDeductions: number;

    // PTKP and PKP
    nettoAnnual: number;
    ptkp: number;
    pkp: number;

    // Tax calculation
    scheme: PPh21Scheme;
    terCategory?: PPh21TERCategory;
    annualTax: number;
    monthlyTax: number;
    effectiveTaxRate: number;

    // TER specific
    terPaid?: number;
    month12Adjustment?: number;
    monthlyBreakdown?: {
        month: number;
        income: number;
        terRate: number;
        tax: number;
        hasBonus: boolean;
        bonusNames?: string;
    }[];

    // Take-home
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

// TER (Tarif Efektif Rata-rata) Rate Tables
// Simplified TER rates based on monthly gross income
// These are approximations - the real tables are more detailed
interface TERBracket {
    minIncome: number;
    maxIncome: number;
    rateA: number; // Category A
    rateB: number; // Category B
    rateC: number; // Category C
}

const TER_MONTHLY_RATES: TERBracket[] = [
    { minIncome: 0, maxIncome: 5_000_000, rateA: 0.0000, rateB: 0.0000, rateC: 0.0000 },
    { minIncome: 5_000_001, maxIncome: 6_000_000, rateA: 0.0025, rateB: 0.0050, rateC: 0.0075 },
    { minIncome: 6_000_001, maxIncome: 7_000_000, rateA: 0.0050, rateB: 0.0075, rateC: 0.0100 },
    { minIncome: 7_000_001, maxIncome: 8_000_000, rateA: 0.0075, rateB: 0.0100, rateC: 0.0125 },
    { minIncome: 8_000_001, maxIncome: 10_000_000, rateA: 0.0100, rateB: 0.0150, rateC: 0.0200 },
    { minIncome: 10_000_001, maxIncome: 15_000_000, rateA: 0.0200, rateB: 0.0300, rateC: 0.0400 },
    { minIncome: 15_000_001, maxIncome: 25_000_000, rateA: 0.0400, rateB: 0.0600, rateC: 0.0800 },
    { minIncome: 25_000_001, maxIncome: 50_000_000, rateA: 0.0800, rateB: 0.1200, rateC: 0.1600 },
    { minIncome: 50_000_001, maxIncome: Infinity, rateA: 0.1500, rateB: 0.2000, rateC: 0.2500 },
];

class PPH21Calculator {
    /**
     * Get PTKP (Non-taxable income) amount based on status
     */
    getPTKP(status: string): Decimal {
        return new Decimal(PTKP_RATES[status] || PTKP_RATES['TK']);
    }

    /**
     * Calculate progressive tax using Pasal 17 rates
     */
    calculateProgressiveTax(pkp: Decimal): Decimal {
        if (pkp.lte(0)) return new Decimal(0);

        let tax = new Decimal(0);
        let previousLimit = new Decimal(0);

        for (const bracket of TAX_BRACKETS) {
            const limit = new Decimal(bracket.limit);
            const rate = new Decimal(bracket.rate);
            const taxableInBracket = Decimal.min(pkp, limit).minus(previousLimit);

            if (taxableInBracket.gt(0)) {
                tax = tax.plus(taxableInBracket.times(rate));
            }

            if (pkp.lte(limit)) {
                break;
            }

            previousLimit = limit;
        }

        return tax;
    }

    /**
     * Get TER rate for monthly income and category
     */
    getTERRate(monthlyIncome: Decimal, category: PPh21TERCategory): Decimal {
        for (const bracket of TER_MONTHLY_RATES) {
            if (monthlyIncome.gte(bracket.minIncome) && monthlyIncome.lte(bracket.maxIncome)) {
                switch (category) {
                    case PPh21TERCategory.A:
                        return new Decimal(bracket.rateA);
                    case PPh21TERCategory.B:
                        return new Decimal(bracket.rateB);
                    case PPh21TERCategory.C:
                        return new Decimal(bracket.rateC);
                }
            }
        }
        // Default to highest rate if not found
        return new Decimal(category === PPh21TERCategory.A ? 0.15 : category === PPh21TERCategory.B ? 0.20 : 0.25);
    }

    /**
     * Calculate biaya jabatan (position allowance): 5% of gross, max 6 million
     */
    calculateBiayaJabatan(grossAnnual: Decimal): Decimal {
        const biaya = grossAnnual.times(0.05);
        return Decimal.min(biaya, 6_000_000);
    }

    /**
     * Round down to nearest thousand
     */
    roundDownThousand(value: Decimal): Decimal {
        return value.dividedBy(1000).floor().times(1000);
    }

    /**
     * Calculate PPh 21 with full details
     */
    calculate(
        grossMonthlyInput: number,
        ptkpStatus: string,
        workMonthsInput: number = 12,
        scheme: PPh21Scheme = PPh21Scheme.TRADITIONAL,
        terCategory: PPh21TERCategory = PPh21TERCategory.B,
        pensionMonthlyInput: number = 0,
        zakatAnnualInput: number = 0,
        bonuses: PPh21Bonus[] = []
    ): PPh21DetailedResult {
        const grossMonthly = new Decimal(grossMonthlyInput);
        const workMonths = Math.max(1, Math.min(12, workMonthsInput));
        const pensionMonthly = new Decimal(pensionMonthlyInput);
        const zakatAnnual = new Decimal(zakatAnnualInput);

        // Calculate gross annual from salary
        const grossFromSalary = grossMonthly.times(workMonths);

        // Calculate total bonuses
        const bonusTotal = bonuses.reduce((sum, bonus) => sum.plus(bonus.amount), new Decimal(0));
        const grossAnnual = grossFromSalary.plus(bonusTotal);

        // Calculate annual pension contributions
        const pensionAnnual = pensionMonthly.times(workMonths);

        // Calculate deductions
        const biayaJabatan = this.calculateBiayaJabatan(grossAnnual);
        const totalDeductions = biayaJabatan.plus(pensionAnnual).plus(zakatAnnual);

        // Calculate netto
        const nettoAnnual = grossAnnual.minus(totalDeductions);

        // Get PTKP
        const ptkp = this.getPTKP(ptkpStatus);

        // Calculate PKP (rounded down to thousand)
        const pkp = this.roundDownThousand(Decimal.max(0, nettoAnnual.minus(ptkp)));

        let annualTax: Decimal;
        let terPaid: Decimal | undefined;
        let month12Adjustment: Decimal | undefined;
        let monthlyBreakdown: PPh21DetailedResult['monthlyBreakdown'] | undefined;

        if (scheme === PPh21Scheme.TER) {
            // TER Scheme: Month-by-month calculation
            monthlyBreakdown = [];
            terPaid = new Decimal(0);

            // Initialize monthly income array
            const monthlyIncome: Decimal[] = new Array(12).fill(new Decimal(0));
            for (let i = 0; i < workMonths; i++) {
                monthlyIncome[i] = grossMonthly;
            }

            // Add bonuses to appropriate months
            for (const bonus of bonuses) {
                const monthIndex = bonus.month - 1; // Convert to 0-indexed
                if (monthIndex >= 0 && monthIndex < 12 && monthIndex < workMonths) {
                    monthlyIncome[monthIndex] = monthlyIncome[monthIndex].plus(bonus.amount);
                }
            }

            // Calculate TER for months 1-11 only
            for (let i = 0; i < 11 && i < workMonths; i++) {
                const income = monthlyIncome[i];
                const terRate = this.getTERRate(income, terCategory);
                const monthTax = income.times(terRate);

                // Check if this month has bonuses
                const monthBonuses = bonuses.filter(b => b.month === i + 1);
                const hasBonus = monthBonuses.length > 0;
                const bonusNames = monthBonuses.map(b => b.name).join(', ');

                monthlyBreakdown.push({
                    month: i + 1,
                    income: income.toNumber(),
                    terRate: terRate.toNumber(),
                    tax: monthTax.toNumber(),
                    hasBonus,
                    bonusNames: hasBonus ? bonusNames : undefined
                });

                terPaid = terPaid.plus(monthTax);
            }

            // Calculate annual progressive tax
            annualTax = this.calculateProgressiveTax(pkp);

            // Month 12 adjustment
            month12Adjustment = annualTax.minus(terPaid);

        } else {
            // Traditional Scheme: Simple annual progressive tax
            annualTax = this.calculateProgressiveTax(pkp);
        }

        // Calculate monthly tax and take-home
        const monthlyTax = annualTax.dividedBy(12);
        const effectiveTaxRate = grossAnnual.gt(0) ? annualTax.dividedBy(grossAnnual).times(100) : new Decimal(0);
        const takeHomeAnnual = grossAnnual.minus(annualTax);
        const takeHomeMonthly = takeHomeAnnual.dividedBy(12);

        return {
            grossMonthly: grossMonthly.toNumber(),
            grossAnnual: grossAnnual.toNumber(),
            bonusTotal: bonusTotal.toNumber(),
            bonuses,
            workMonths,
            biayaJabatan: biayaJabatan.toNumber(),
            pensionAnnual: pensionAnnual.toNumber(),
            zakatDonation: zakatAnnual.toNumber(),
            totalDeductions: totalDeductions.toNumber(),
            nettoAnnual: nettoAnnual.toNumber(),
            ptkp: ptkp.toNumber(),
            pkp: pkp.toNumber(),
            scheme,
            terCategory: scheme === PPh21Scheme.TER ? terCategory : undefined,
            annualTax: annualTax.toNumber(),
            monthlyTax: monthlyTax.toNumber(),
            effectiveTaxRate: effectiveTaxRate.toNumber(),
            terPaid: terPaid ? terPaid.toNumber() : undefined,
            month12Adjustment: month12Adjustment ? month12Adjustment.toNumber() : undefined,
            monthlyBreakdown,
            takeHomeAnnual: takeHomeAnnual.toNumber(),
            takeHomeMonthly: takeHomeMonthly.toNumber(),
        };
    }
}

class PPH22Calculator {
    /**
     * Calculate PPh 22 (Import/Export Withholding Tax)
     * Formula: Tax = DPP × Rate
     */
    calculate(dppInput: number, rateInput: number): PPH22Result {
        const dpp = new Decimal(dppInput);
        const rate = new Decimal(rateInput);
        const tax = dpp.times(rate.dividedBy(100));

        return {
            dpp: dpp.toNumber(),
            rate: rate.toNumber(),
            tax: tax.toNumber(),
        };
    }
}

class PPH23Calculator {
    /**
     * Calculate PPh 23 (Service Withholding Tax)
     * Formula: Tax = Gross Income × Rate
     */
    calculate(grossIncomeInput: number, rateInput: number): PPH23Result {
        const grossIncome = new Decimal(grossIncomeInput);
        const rate = new Decimal(rateInput);
        const tax = grossIncome.times(rate.dividedBy(100));

        return {
            grossIncome: grossIncome.toNumber(),
            rate: rate.toNumber(),
            tax: tax.toNumber(),
        };
    }
}

class PPH42Calculator {
    /**
     * Calculate PPh Final Pasal 4(2) (Final Income Tax)
     * Formula: Tax = Gross Income × Rate
     */
    calculate(grossIncomeInput: number, rateInput: number): PPH42Result {
        const grossIncome = new Decimal(grossIncomeInput);
        const rate = new Decimal(rateInput);
        const tax = grossIncome.times(rate.dividedBy(100));

        return {
            grossIncome: grossIncome.toNumber(),
            rate: rate.toNumber(),
            tax: tax.toNumber(),
        };
    }
}

class PPNCalculator {
    /**
     * Calculate PPN (Value Added Tax)
     * Exclusive: PPN = DPP × Rate, Total = DPP + PPN
     * Inclusive: DPP = Total / (1 + Rate), PPN = Total - DPP
     */
    calculate(amountInput: number, rateInput: number, mode: PPNMode): PPNResult {
        const amount = new Decimal(amountInput);
        const rate = new Decimal(rateInput);
        let dpp: Decimal;
        let ppn: Decimal;
        let total: Decimal;

        if (mode === PPNMode.EXCLUSIVE) {
            // Amount is DPP (before tax)
            dpp = amount;
            ppn = dpp.times(rate.dividedBy(100));
            total = dpp.plus(ppn);
        } else {
            // Amount is Total (after tax, inclusive)
            total = amount;
            dpp = total.dividedBy(new Decimal(1).plus(rate.dividedBy(100)));
            ppn = total.minus(dpp);
        }

        return {
            dpp: dpp.toNumber(),
            rate: rate.toNumber(),
            mode,
            ppn: ppn.toNumber(),
            total: total.toNumber(),
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
    calculate(dppInput: number, ppnRateInput: number, ppnbmRateInput: number): PPNBMResult {
        const dpp = new Decimal(dppInput);
        const ppnRate = new Decimal(ppnRateInput);
        const ppnbmRate = new Decimal(ppnbmRateInput);

        const ppn = dpp.times(ppnRate.dividedBy(100));
        const ppnbm = dpp.times(ppnbmRate.dividedBy(100));
        const total = dpp.plus(ppn).plus(ppnbm);

        return {
            dpp: dpp.toNumber(),
            ppnRate: ppnRate.toNumber(),
            ppnbmRate: ppnbmRate.toNumber(),
            ppn: ppn.toNumber(),
            ppnbm: ppnbm.toNumber(),
            total: total.toNumber(),
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

// Bonus management
let bonusList: PPh21Bonus[] = [];

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
            updateSchemeFields();
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
 * Show/hide TER category field based on scheme selection
 */
function updateSchemeFields(): void {
    const schemeRadios = Array.from(document.getElementsByName('pph21Scheme') as NodeListOf<HTMLInputElement>);
    let selectedScheme = PPh21Scheme.TRADITIONAL;

    for (const radio of schemeRadios) {
        if (radio.checked) {
            selectedScheme = radio.value as PPh21Scheme;
            break;
        }
    }

    const terCategoryField = document.getElementById('ter-category-field') as HTMLDivElement;
    if (selectedScheme === PPh21Scheme.TER) {
        terCategoryField.style.display = 'block';
    } else {
        terCategoryField.style.display = 'none';
    }
}

/**
 * Add bonus to list
 */
function addBonus(): void {
    const bonusNameInput = document.getElementById('bonusName') as HTMLInputElement;
    const bonusAmountInput = document.getElementById('bonusAmount') as HTMLInputElement;
    const bonusMonthInput = document.getElementById('bonusMonth') as HTMLInputElement;

    const name = bonusNameInput.value.trim();
    const amount = parseFloat(bonusAmountInput.value);
    const month = parseInt(bonusMonthInput.value);

    if (!name || isNaN(amount) || amount <= 0 || isNaN(month) || month < 1 || month > 12) {
        showError('Please enter valid bonus details');
        return;
    }

    bonusList.push({ name, amount, month });
    updateBonusList();

    // Clear inputs
    bonusNameInput.value = '';
    bonusAmountInput.value = '';
    bonusMonthInput.value = '';
}

/**
 * Remove bonus from list
 */
function removeBonus(index: number): void {
    bonusList.splice(index, 1);
    updateBonusList();
}

/**
 * Update bonus list display
 */
function updateBonusList(): void {
    const bonusListDiv = document.getElementById('bonus-list') as HTMLDivElement;
    const bonusTotalDiv = document.getElementById('bonus-total') as HTMLSpanElement;

    if (bonusList.length === 0) {
        bonusListDiv.innerHTML = '<p style="color: #999; font-size: 14px;">No bonuses added yet</p>';
        bonusTotalDiv.textContent = formatCurrency(0);
        return;
    }

    const total = bonusList.reduce((sum, bonus) => sum + bonus.amount, 0);
    bonusTotalDiv.textContent = formatCurrency(total);

    bonusListDiv.innerHTML = bonusList.map((bonus, index) => `
        <div style="display: flex; justify-content: space-between; align-items: center; padding: 8px; background: white; border-radius: 4px; margin-bottom: 8px;">
            <div>
                <strong>${bonus.name}</strong><br>
                <small>Month ${bonus.month}: ${formatCurrency(bonus.amount)}</small>
            </div>
            <button type="button" onclick="removeBonus(${index})" style="padding: 4px 12px; background: #dc2626; color: white; border: none; border-radius: 4px; cursor: pointer; font-size: 12px;">Remove</button>
        </div>
    `).join('');
}

// Make removeBonus available globally
(window as any).removeBonus = removeBonus;


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
function displayPPH21Results(result: PPh21DetailedResult): void {
    // Hide all result containers
    [pph21Results, pph22Results, pph23Results, pph42Results, ppnResults, ppnbmResults].forEach(el => {
        el.style.display = 'none';
    });

    // Show PPh 21 results
    pph21Results.style.display = 'block';

    // Basic info
    document.getElementById('result-gross-monthly')!.textContent = formatCurrency(result.grossMonthly);
    document.getElementById('result-work-months')!.textContent = result.workMonths.toString();
    document.getElementById('result-gross-salary')!.textContent = formatCurrency(result.grossMonthly * result.workMonths);
    document.getElementById('result-bonus-total')!.textContent = formatCurrency(result.bonusTotal);
    document.getElementById('result-gross-annual')!.textContent = formatCurrency(result.grossAnnual);

    // Deductions
    document.getElementById('result-biaya-jabatan')!.textContent = formatCurrency(result.biayaJabatan);
    document.getElementById('result-pension')!.textContent = formatCurrency(result.pensionAnnual);
    document.getElementById('result-zakat')!.textContent = formatCurrency(result.zakatDonation);
    document.getElementById('result-netto')!.textContent = formatCurrency(result.nettoAnnual);

    // PKP and Tax
    document.getElementById('result-ptkp')!.textContent = formatCurrency(result.ptkp);
    document.getElementById('result-pkp')!.textContent = formatCurrency(result.pkp);
    document.getElementById('result-annual-tax')!.textContent = formatCurrency(result.annualTax);
    document.getElementById('result-monthly-tax')!.textContent = formatCurrency(result.monthlyTax);
    document.getElementById('result-tax-rate')!.textContent = formatPercent(result.effectiveTaxRate);

    // Take-home
    document.getElementById('result-take-home-annual')!.textContent = formatCurrency(result.takeHomeAnnual);
    document.getElementById('result-take-home-monthly')!.textContent = formatCurrency(result.takeHomeMonthly);

    // TER specific results
    const terBreakdownDiv = document.getElementById('ter-breakdown') as HTMLDivElement;
    if (result.scheme === PPh21Scheme.TER && result.monthlyBreakdown) {
        terBreakdownDiv.style.display = 'block';

        const terListDiv = document.getElementById('ter-month-list') as HTMLDivElement;
        terListDiv.innerHTML = result.monthlyBreakdown.map(m => `
            <div style="padding: 8px; background: white; border-radius: 4px; margin-bottom: 8px;">
                <strong>Month ${m.month}${m.hasBonus ? ' (' + m.bonusNames + ')' : ''}</strong><br>
                <small>
                    Income: ${formatCurrency(m.income)} | 
                    TER Rate: ${formatPercent(m.terRate * 100)} | 
                    Tax: ${formatCurrency(m.tax)}
                </small>
            </div>
        `).join('');

        document.getElementById('result-ter-paid')!.textContent = formatCurrency(result.terPaid || 0);
        document.getElementById('result-month12-adjustment')!.textContent = formatCurrency(result.month12Adjustment || 0);
    } else {
        terBreakdownDiv.style.display = 'none';
    }

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
                const grossMonthly = parseFloat((document.getElementById('pph21GrossMonthly') as HTMLInputElement).value);
                const ptkpStatus = (document.getElementById('pph21PtkpStatus') as HTMLSelectElement).value;
                const workMonths = parseInt((document.getElementById('pph21WorkMonths') as HTMLInputElement).value) || 12;
                const pensionMonthly = parseFloat((document.getElementById('pph21Pension') as HTMLInputElement).value) || 0;
                const zakatAnnual = parseFloat((document.getElementById('pph21Zakat') as HTMLInputElement).value) || 0;

                // Get scheme
                const schemeRadios = Array.from(document.getElementsByName('pph21Scheme') as NodeListOf<HTMLInputElement>);
                let scheme = PPh21Scheme.TRADITIONAL;
                for (const radio of schemeRadios) {
                    if (radio.checked) {
                        scheme = radio.value as PPh21Scheme;
                        break;
                    }
                }

                const terCategory = (document.getElementById('pph21TerCategory') as HTMLSelectElement).value as PPh21TERCategory;

                if (isNaN(grossMonthly) || grossMonthly <= 0) {
                    showError('Please enter a valid gross monthly income');
                    return;
                }

                const result = pph21Calculator.calculate(
                    grossMonthly,
                    ptkpStatus,
                    workMonths,
                    scheme,
                    terCategory,
                    pensionMonthly,
                    zakatAnnual,
                    bonusList
                );
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
    bonusList = [];
    updateBonusList();
});

// Handle tax type change
taxTypeSelect.addEventListener('change', updateFormFields);

// Handle scheme change
const schemeRadios = document.getElementsByName('pph21Scheme') as NodeListOf<HTMLInputElement>;
schemeRadios.forEach(radio => {
    radio.addEventListener('change', updateSchemeFields);
});

// Make functions available globally
(window as any).addBonus = addBonus;
(window as any).removeBonus = removeBonus;

// Initialize form fields on page load
updateFormFields();
updateBonusList();
