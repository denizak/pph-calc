"use strict";
const PTKP_RATES = {
    'TK': 54000000,
    'K1': 58500000,
    'K2': 63000000,
    'K3': 67500000,
};
const TAX_BRACKETS = [
    { limit: 50000000, rate: 0.05 },
    { limit: 250000000, rate: 0.15 },
    { limit: 500000000, rate: 0.25 },
    { limit: 5000000000, rate: 0.30 },
    { limit: Infinity, rate: 0.35 },
];
class PPHCalculator {
    getPTKP(status) {
        return PTKP_RATES[status] || PTKP_RATES['TK'];
    }
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
    calculate(grossIncome, ptkpStatus, deductions = 0, workMonths = 12) {
        const ptkp = (this.getPTKP(ptkpStatus) / 12) * workMonths;
        const taxableIncome = Math.max(0, grossIncome - deductions - ptkp);
        const annualTax = this.calculateProgressiveTax(taxableIncome);
        const monthlyTax = annualTax / 12;
        const effectiveTaxRate = grossIncome > 0 ? (annualTax / grossIncome) * 100 : 0;
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
    calculatePPH21(brutoMonthly, monthsPaid, pensionContribution, zakatDonation, ptkpStatus) {
        const brutoAnnual = brutoMonthly * monthsPaid;
        const ptkp = this.getPTKP(ptkpStatus);
        const biayaJabatan = Math.min(brutoAnnual * 0.05, 6000000);
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
    calculatePPH22(dpp, rate) {
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
    calculatePPH23(bruto, rate) {
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
    calculatePPH42(bruto, rate) {
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
    calculatePPN(dpp, rate, mode) {
        let tax;
        if (mode === 1) {
            tax = dpp - (dpp / (1 + rate / 100));
        }
        else {
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
    calculatePPnBM(dpp, ppnRate, ppnbmRate) {
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
function formatCurrency(value) {
    return new Intl.NumberFormat('id-ID', {
        style: 'currency',
        currency: 'IDR',
        minimumFractionDigits: 0,
        maximumFractionDigits: 0,
    }).format(value);
}
function formatPercent(value) {
    return new Intl.NumberFormat('id-ID', {
        style: 'percent',
        minimumFractionDigits: 2,
        maximumFractionDigits: 2,
    }).format(value / 100);
}
const calculator = new PPHCalculator();
const form = document.getElementById('taxForm');
const resultsDiv = document.getElementById('results');
const errorDiv = document.getElementById('error');
const taxTypeInput = document.getElementById('taxType');
const ptkpStatusInput = document.getElementById('ptkpStatus');
const deductionsInput = document.getElementById('deductions');
const workMonthInput = document.getElementById('workMonth');
const brutoMonthlyInput = document.getElementById('brutoMonthly');
const monthsPaidInput = document.getElementById('monthsPaid');
const pensionContributionInput = document.getElementById('pensionContribution');
const zakatDonationInput = document.getElementById('zakatDonation');
const dpp22Input = document.getElementById('dpp22');
const rate22Input = document.getElementById('rate22');
const bruto23Input = document.getElementById('bruto23');
const rate23Input = document.getElementById('rate23');
const bruto42Input = document.getElementById('bruto42');
const rate42Input = document.getElementById('rate42');
const dppPpnInput = document.getElementById('dppPpn');
const ratePpnInput = document.getElementById('ratePpn');
const ppnModeInput = document.getElementById('ppnMode');
const dppPpnbmInput = document.getElementById('dppPpnbm');
const ratePpnPpnbmInput = document.getElementById('ratePpnPpnbm');
const ratePpnbmInput = document.getElementById('ratePpnbm');
const pph21Fields = document.getElementById('pph21-fields');
const pph22Fields = document.getElementById('pph22-fields');
const pph23Fields = document.getElementById('pph23-fields');
const pph42Fields = document.getElementById('pph42-fields');
const ppnFields = document.getElementById('ppn-fields');
const ppnbmFields = document.getElementById('ppnbm-fields');
const resultElements = {
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
function toggleDynamicFields() {
    const taxType = taxTypeInput.value;
    pph21Fields.classList.remove('show');
    pph22Fields.classList.remove('show');
    pph23Fields.classList.remove('show');
    pph42Fields.classList.remove('show');
    ppnFields.classList.remove('show');
    ppnbmFields.classList.remove('show');
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
function showError(message) {
    errorDiv.textContent = message;
    errorDiv.classList.add('show');
}
function clearError() {
    errorDiv.classList.remove('show');
    errorDiv.textContent = '';
}
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
function validateInputs() {
    const taxType = taxTypeInput.value;
    let isValid = true;
    clearError();
    if (taxType === 'pph21') {
        const brutoMonthly = parseFloat(brutoMonthlyInput.value);
        if (isNaN(brutoMonthly) || brutoMonthly <= 0) {
            showError('Please enter a valid bruto monthly income');
            return false;
        }
    }
    else if (taxType === 'pph22') {
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
    }
    else if (taxType === 'pph23') {
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
    }
    else if (taxType === 'pph42') {
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
    }
    else if (taxType === 'ppn') {
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
    }
    else if (taxType === 'ppnbm') {
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
form.addEventListener('submit', (e) => {
    e.preventDefault();
    clearError();
    if (!validateInputs()) {
        resultsDiv.classList.remove('show');
        return;
    }
    const taxType = taxTypeInput.value;
    const ptkpStatus = ptkpStatusInput.value;
    let result;
    try {
        switch (taxType) {
            case 'pph21':
                const brutoMonthly = parseFloat(brutoMonthlyInput.value);
                const monthsPaid = parseInt(monthsPaidInput.value) || 12;
                const pensionContribution = parseFloat(pensionContributionInput.value) || 0;
                const zakatDonation = parseFloat(zakatDonationInput.value) || 0;
                result = calculator.calculatePPH21(brutoMonthly, monthsPaid, pensionContribution, zakatDonation, ptkpStatus);
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
    }
    catch (error) {
        showError('An error occurred during calculation. Please try again.');
        console.error('Calculation error:', error);
    }
});
form.addEventListener('reset', () => {
    clearError();
    resultsDiv.classList.remove('show');
    setTimeout(() => {
        toggleDynamicFields();
    }, 0);
});
[deductionsInput, workMonthInput, ptkpStatusInput].forEach(input => {
    input.addEventListener('input', clearError);
});
taxTypeInput.addEventListener('change', toggleDynamicFields);
toggleDynamicFields();
