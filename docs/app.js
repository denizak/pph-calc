// PTKP (Penghasilan Tidak Kena Pajak) rates for 2025
var PTKP_RATES = {
    'TK': 54000000, // Single
    'K1': 58500000, // Married
    'K2': 63000000, // Married + 1 Child
    'K3': 67500000, // Married + 2 Children
};
var TAX_BRACKETS = [
    { limit: 50000000, rate: 0.05 }, // 5%
    { limit: 250000000, rate: 0.15 }, // 15%
    { limit: 500000000, rate: 0.25 }, // 25%
    { limit: 5000000000, rate: 0.30 }, // 30%
    { limit: Infinity, rate: 0.35 }, // 35%
];
var PPHCalculator = /** @class */ (function () {
    function PPHCalculator() {
    }
    /**
     * Get PTKP (Non-taxable income) amount based on status
     */
    PPHCalculator.prototype.getPTKP = function (status) {
        return PTKP_RATES[status] || PTKP_RATES['TK'];
    };
    /**
     * Calculate progressive tax using Pasal 17 rates
     */
    PPHCalculator.prototype.calculateProgressiveTax = function (pkp) {
        if (pkp <= 0)
            return 0;
        var tax = 0;
        var previousLimit = 0;
        for (var _i = 0, TAX_BRACKETS_1 = TAX_BRACKETS; _i < TAX_BRACKETS_1.length; _i++) {
            var bracket = TAX_BRACKETS_1[_i];
            var taxableInBracket = Math.min(pkp, bracket.limit) - previousLimit;
            if (taxableInBracket > 0) {
                tax += taxableInBracket * bracket.rate;
            }
            if (pkp <= bracket.limit) {
                break;
            }
            previousLimit = bracket.limit;
        }
        return tax;
    };
    /**
     * Calculate annual PPH
     */
    PPHCalculator.prototype.calculate = function (grossIncome, ptkpStatus, deductions, workMonths) {
        if (deductions === void 0) { deductions = 0; }
        if (workMonths === void 0) { workMonths = 12; }
        // Calculate PTKP for the working period
        var ptkp = (this.getPTKP(ptkpStatus) / 12) * workMonths;
        // Calculate PKP (Penghasilan Kena Pajak)
        var taxableIncome = Math.max(0, grossIncome - deductions - ptkp);
        // Calculate annual tax
        var annualTax = this.calculateProgressiveTax(taxableIncome);
        // Calculate monthly values
        var monthlyTax = annualTax / 12;
        var effectiveTaxRate = grossIncome > 0 ? (annualTax / grossIncome) * 100 : 0;
        // Calculate take-home pay
        var takeHomeAnnual = grossIncome - annualTax;
        var takeHomeMonthly = takeHomeAnnual / 12;
        return {
            grossIncome: grossIncome,
            deductions: deductions,
            ptkp: ptkp,
            taxableIncome: taxableIncome,
            annualTax: annualTax,
            monthlyTax: monthlyTax,
            effectiveTaxRate: effectiveTaxRate,
            takeHomeAnnual: takeHomeAnnual,
            takeHomeMonthly: takeHomeMonthly,
        };
    };
    return PPHCalculator;
}());
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
// Initialize calculator
var calculator = new PPHCalculator();
// Get DOM elements
var form = document.getElementById('taxForm');
var resultsDiv = document.getElementById('results');
var errorDiv = document.getElementById('error');
// Form inputs
var grossIncomeInput = document.getElementById('grossIncome');
var ptkpStatusInput = document.getElementById('ptkpStatus');
var deductionsInput = document.getElementById('deductions');
var workMonthInput = document.getElementById('workMonth');
// Result display elements
var resultElements = {
    'gross': document.getElementById('result-gross'),
    'deductions': document.getElementById('result-deductions'),
    'ptkp': document.getElementById('result-ptkp'),
    'pkp': document.getElementById('result-pkp'),
    'annual-tax': document.getElementById('result-annual-tax'),
    'monthly-tax': document.getElementById('result-monthly-tax'),
    'tax-rate': document.getElementById('result-tax-rate'),
    'take-home-annual': document.getElementById('result-take-home-annual'),
    'take-home-monthly': document.getElementById('result-take-home-monthly'),
};
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
 * Display results
 */
function displayResults(result) {
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
function validateInputs() {
    var grossIncome = parseFloat(grossIncomeInput.value);
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
form.addEventListener('submit', function (e) {
    e.preventDefault();
    clearError();
    if (!validateInputs()) {
        resultsDiv.classList.remove('show');
        return;
    }
    var grossIncome = parseFloat(grossIncomeInput.value);
    var ptkpStatus = ptkpStatusInput.value;
    var deductions = parseFloat(deductionsInput.value) || 0;
    var workMonths = parseInt(workMonthInput.value) || 12;
    try {
        var result = calculator.calculate(grossIncome, ptkpStatus, deductions, workMonths);
        displayResults(result);
    }
    catch (error) {
        showError('An error occurred during calculation. Please try again.');
        console.error('Calculation error:', error);
    }
});
// Handle reset
form.addEventListener('reset', function () {
    clearError();
    resultsDiv.classList.remove('show');
});
// Clear error on input
[grossIncomeInput, deductionsInput, workMonthInput, ptkpStatusInput].forEach(function (input) {
    input.addEventListener('input', clearError);
});
