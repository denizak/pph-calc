// PPH Calculator Types
// Tax Type Enum
var TaxType;
(function (TaxType) {
    TaxType["PPH21"] = "pph21";
    TaxType["PPH22"] = "pph22";
    TaxType["PPH23"] = "pph23";
    TaxType["PPH4_2"] = "pph4_2";
    TaxType["PPN"] = "ppn";
    TaxType["PPNBM"] = "ppnbm";
})(TaxType || (TaxType = {}));
// PPN Types (Value Added Tax)
var PPNMode;
(function (PPNMode) {
    PPNMode["EXCLUSIVE"] = "exclusive";
    PPNMode["INCLUSIVE"] = "inclusive";
})(PPNMode || (PPNMode = {}));
// PTKP (Penghasilan Tidak Kena Pajak) rates for 2025
const PTKP_RATES = {
    'TK': 54000000, // Single
    'K1': 58500000, // Married
    'K2': 63000000, // Married + 1 Child
    'K3': 67500000, // Married + 2 Children
};
const TAX_BRACKETS = [
    { limit: 50000000, rate: 0.05 }, // 5%
    { limit: 250000000, rate: 0.15 }, // 15%
    { limit: 500000000, rate: 0.25 }, // 25%
    { limit: 5000000000, rate: 0.30 }, // 30%
    { limit: Infinity, rate: 0.35 }, // 35%
];
class PPH21Calculator {
    /**
     * Get PTKP (Non-taxable income) amount based on status
     */
    getPTKP(status) {
        return PTKP_RATES[status] || PTKP_RATES['TK'];
    }
    /**
     * Calculate progressive tax using Pasal 17 rates
     */
    calculateProgressiveTax(pkp) {
        if (pkp <= 0)
            return 0;
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
    calculate(grossIncome, ptkpStatus, deductions = 0, workMonths = 12) {
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
    calculate(dpp, rate) {
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
    calculate(grossIncome, rate) {
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
    calculate(grossIncome, rate) {
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
    calculate(amount, rate, mode) {
        let dpp;
        let ppn;
        let total;
        if (mode === PPNMode.EXCLUSIVE) {
            // Amount is DPP (before tax)
            dpp = amount;
            ppn = dpp * (rate / 100);
            total = dpp + ppn;
        }
        else {
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
    calculate(dpp, ppnRate, ppnbmRate) {
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
function formatCurrency(value) {
    return new Intl.NumberFormat('id-ID', {
        style: 'currency',
        currency: 'IDR',
        minimumFractionDigits: 0,
        maximumFractionDigits: 0,
    }).format(value);
}
// Format percentage
function formatPercent(value) {
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
const taxTypeSelect = document.getElementById('taxType');
const form = document.getElementById('taxForm');
const resultsDiv = document.getElementById('results');
const errorDiv = document.getElementById('error');
// Form field containers
const pph21Fields = document.getElementById('pph21-fields');
const pph22Fields = document.getElementById('pph22-fields');
const pph23Fields = document.getElementById('pph23-fields');
const pph42Fields = document.getElementById('pph42-fields');
const ppnFields = document.getElementById('ppn-fields');
const ppnbmFields = document.getElementById('ppnbm-fields');
// Results containers
const pph21Results = document.getElementById('pph21-results');
const pph22Results = document.getElementById('pph22-results');
const pph23Results = document.getElementById('pph23-results');
const pph42Results = document.getElementById('pph42-results');
const ppnResults = document.getElementById('ppn-results');
const ppnbmResults = document.getElementById('ppnbm-results');
/**
 * Show/hide form fields based on selected tax type
 */
function updateFormFields() {
    const selectedType = taxTypeSelect.value;
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
function showError(message) {
    errorDiv.textContent = message;
    errorDiv.classList.add('show');
}
/**
 * Clear error message
 */
function clearError() {
    errorDiv.classList.remove('show');
    errorDiv.textContent = '';
}
/**
 * Display PPh 21 results
 */
function displayPPH21Results(result) {
    // Hide all result containers
    [pph21Results, pph22Results, pph23Results, pph42Results, ppnResults, ppnbmResults].forEach(el => {
        el.style.display = 'none';
    });
    // Show PPh 21 results
    pph21Results.style.display = 'block';
    document.getElementById('result-gross').textContent = formatCurrency(result.grossIncome);
    document.getElementById('result-deductions').textContent = formatCurrency(result.deductions);
    document.getElementById('result-ptkp').textContent = formatCurrency(result.ptkp);
    document.getElementById('result-pkp').textContent = formatCurrency(result.taxableIncome);
    document.getElementById('result-annual-tax').textContent = formatCurrency(result.annualTax);
    document.getElementById('result-monthly-tax').textContent = formatCurrency(result.monthlyTax);
    document.getElementById('result-tax-rate').textContent = formatPercent(result.effectiveTaxRate);
    document.getElementById('result-take-home-annual').textContent = formatCurrency(result.takeHomeAnnual);
    document.getElementById('result-take-home-monthly').textContent = formatCurrency(result.takeHomeMonthly);
    resultsDiv.classList.add('show');
}
/**
 * Display PPh 22 results
 */
function displayPPH22Results(result) {
    [pph21Results, pph22Results, pph23Results, pph42Results, ppnResults, ppnbmResults].forEach(el => {
        el.style.display = 'none';
    });
    pph22Results.style.display = 'block';
    document.getElementById('result-pph22-dpp').textContent = formatCurrency(result.dpp);
    document.getElementById('result-pph22-rate').textContent = formatPercent(result.rate);
    document.getElementById('result-pph22-tax').textContent = formatCurrency(result.tax);
    resultsDiv.classList.add('show');
}
/**
 * Display PPh 23 results
 */
function displayPPH23Results(result) {
    [pph21Results, pph22Results, pph23Results, pph42Results, ppnResults, ppnbmResults].forEach(el => {
        el.style.display = 'none';
    });
    pph23Results.style.display = 'block';
    document.getElementById('result-pph23-gross').textContent = formatCurrency(result.grossIncome);
    document.getElementById('result-pph23-rate').textContent = formatPercent(result.rate);
    document.getElementById('result-pph23-tax').textContent = formatCurrency(result.tax);
    resultsDiv.classList.add('show');
}
/**
 * Display PPh 4(2) results
 */
function displayPPH42Results(result) {
    [pph21Results, pph22Results, pph23Results, pph42Results, ppnResults, ppnbmResults].forEach(el => {
        el.style.display = 'none';
    });
    pph42Results.style.display = 'block';
    document.getElementById('result-pph42-gross').textContent = formatCurrency(result.grossIncome);
    document.getElementById('result-pph42-rate').textContent = formatPercent(result.rate);
    document.getElementById('result-pph42-tax').textContent = formatCurrency(result.tax);
    resultsDiv.classList.add('show');
}
/**
 * Display PPN results
 */
function displayPPNResults(result) {
    [pph21Results, pph22Results, pph23Results, pph42Results, ppnResults, ppnbmResults].forEach(el => {
        el.style.display = 'none';
    });
    ppnResults.style.display = 'block';
    document.getElementById('result-ppn-dpp').textContent = formatCurrency(result.dpp);
    document.getElementById('result-ppn-rate').textContent = formatPercent(result.rate);
    document.getElementById('result-ppn-mode').textContent = result.mode === PPNMode.EXCLUSIVE ? 'Exclusive' : 'Inclusive';
    document.getElementById('result-ppn-ppn').textContent = formatCurrency(result.ppn);
    document.getElementById('result-ppn-total').textContent = formatCurrency(result.total);
    resultsDiv.classList.add('show');
}
/**
 * Display PPNBM results
 */
function displayPPNBMResults(result) {
    [pph21Results, pph22Results, pph23Results, pph42Results, ppnResults, ppnbmResults].forEach(el => {
        el.style.display = 'none';
    });
    ppnbmResults.style.display = 'block';
    document.getElementById('result-ppnbm-dpp').textContent = formatCurrency(result.dpp);
    document.getElementById('result-ppnbm-ppn-rate').textContent = formatPercent(result.ppnRate);
    document.getElementById('result-ppnbm-ppnbm-rate').textContent = formatPercent(result.ppnbmRate);
    document.getElementById('result-ppnbm-ppn').textContent = formatCurrency(result.ppn);
    document.getElementById('result-ppnbm-ppnbm').textContent = formatCurrency(result.ppnbm);
    document.getElementById('result-ppnbm-total').textContent = formatCurrency(result.total);
    resultsDiv.classList.add('show');
}
/**
 * Handle form submission
 */
form.addEventListener('submit', (e) => {
    e.preventDefault();
    clearError();
    const selectedType = taxTypeSelect.value;
    try {
        switch (selectedType) {
            case TaxType.PPH21: {
                const grossIncome = parseFloat(document.getElementById('grossIncome').value);
                const ptkpStatus = document.getElementById('ptkpStatus').value;
                const deductions = parseFloat(document.getElementById('deductions').value) || 0;
                const workMonths = parseInt(document.getElementById('workMonth').value) || 12;
                if (isNaN(grossIncome) || grossIncome <= 0) {
                    showError('Please enter a valid gross income');
                    return;
                }
                const result = pph21Calculator.calculate(grossIncome, ptkpStatus, deductions, workMonths);
                displayPPH21Results(result);
                break;
            }
            case TaxType.PPH22: {
                const dpp = parseFloat(document.getElementById('pph22Dpp').value);
                const rate = parseFloat(document.getElementById('pph22Rate').value);
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
                const grossIncome = parseFloat(document.getElementById('pph23Gross').value);
                const rate = parseFloat(document.getElementById('pph23Rate').value);
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
                const grossIncome = parseFloat(document.getElementById('pph42Gross').value);
                const rate = parseFloat(document.getElementById('pph42Rate').value);
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
                const amount = parseFloat(document.getElementById('ppnAmount').value);
                const rate = parseFloat(document.getElementById('ppnRate').value);
                const mode = document.getElementById('ppnMode').value;
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
                const dpp = parseFloat(document.getElementById('ppnbmDpp').value);
                const ppnRate = parseFloat(document.getElementById('ppnbmPpnRate').value);
                const ppnbmRate = parseFloat(document.getElementById('ppnbmPpnbmRate').value);
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
    }
    catch (error) {
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
