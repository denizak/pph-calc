import Decimal from './decimal.js';
var TaxType;
(function (TaxType) {
    TaxType["PPH21"] = "pph21";
    TaxType["PPH22"] = "pph22";
    TaxType["PPH23"] = "pph23";
    TaxType["PPH4_2"] = "pph4_2";
    TaxType["PPN"] = "ppn";
    TaxType["PPNBM"] = "ppnbm";
})(TaxType || (TaxType = {}));
var PPh21Scheme;
(function (PPh21Scheme) {
    PPh21Scheme["TRADITIONAL"] = "traditional";
    PPh21Scheme["TER"] = "ter";
})(PPh21Scheme || (PPh21Scheme = {}));
var PPh21TERCategory;
(function (PPh21TERCategory) {
    PPh21TERCategory["A"] = "A";
    PPh21TERCategory["B"] = "B";
    PPh21TERCategory["C"] = "C";
})(PPh21TERCategory || (PPh21TERCategory = {}));
var PPNMode;
(function (PPNMode) {
    PPNMode["EXCLUSIVE"] = "exclusive";
    PPNMode["INCLUSIVE"] = "inclusive";
})(PPNMode || (PPNMode = {}));
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
const TER_MONTHLY_RATES = [
    { minIncome: 0, maxIncome: 5000000, rateA: 0.0000, rateB: 0.0000, rateC: 0.0000 },
    { minIncome: 5000001, maxIncome: 6000000, rateA: 0.0025, rateB: 0.0050, rateC: 0.0075 },
    { minIncome: 6000001, maxIncome: 7000000, rateA: 0.0050, rateB: 0.0075, rateC: 0.0100 },
    { minIncome: 7000001, maxIncome: 8000000, rateA: 0.0075, rateB: 0.0100, rateC: 0.0125 },
    { minIncome: 8000001, maxIncome: 10000000, rateA: 0.0100, rateB: 0.0150, rateC: 0.0200 },
    { minIncome: 10000001, maxIncome: 15000000, rateA: 0.0200, rateB: 0.0300, rateC: 0.0400 },
    { minIncome: 15000001, maxIncome: 25000000, rateA: 0.0400, rateB: 0.0600, rateC: 0.0800 },
    { minIncome: 25000001, maxIncome: 50000000, rateA: 0.0800, rateB: 0.1200, rateC: 0.1600 },
    { minIncome: 50000001, maxIncome: Infinity, rateA: 0.1500, rateB: 0.2000, rateC: 0.2500 },
];
class PPH21Calculator {
    getPTKP(status) {
        return new Decimal(PTKP_RATES[status] || PTKP_RATES['TK']);
    }
    calculateProgressiveTax(pkp) {
        if (pkp.lte(0))
            return new Decimal(0);
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
    getTERRate(monthlyIncome, category) {
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
        return new Decimal(category === PPh21TERCategory.A ? 0.15 : category === PPh21TERCategory.B ? 0.20 : 0.25);
    }
    calculateBiayaJabatan(grossAnnual) {
        const biaya = grossAnnual.times(0.05);
        return Decimal.min(biaya, 6000000);
    }
    roundDownThousand(value) {
        return value.dividedBy(1000).floor().times(1000);
    }
    calculate(grossMonthlyInput, ptkpStatus, workMonthsInput = 12, scheme = PPh21Scheme.TRADITIONAL, terCategory = PPh21TERCategory.B, pensionMonthlyInput = 0, zakatAnnualInput = 0, bonuses = []) {
        const grossMonthly = new Decimal(grossMonthlyInput);
        const workMonths = Math.max(1, Math.min(12, workMonthsInput));
        const pensionMonthly = new Decimal(pensionMonthlyInput);
        const zakatAnnual = new Decimal(zakatAnnualInput);
        const grossFromSalary = grossMonthly.times(workMonths);
        const bonusTotal = bonuses.reduce((sum, bonus) => sum.plus(bonus.amount), new Decimal(0));
        const grossAnnual = grossFromSalary.plus(bonusTotal);
        const pensionAnnual = pensionMonthly.times(workMonths);
        const biayaJabatan = this.calculateBiayaJabatan(grossAnnual);
        const totalDeductions = biayaJabatan.plus(pensionAnnual).plus(zakatAnnual);
        const nettoAnnual = grossAnnual.minus(totalDeductions);
        const ptkp = this.getPTKP(ptkpStatus);
        const pkp = this.roundDownThousand(Decimal.max(0, nettoAnnual.minus(ptkp)));
        let annualTax;
        let terPaid;
        let month12Adjustment;
        let monthlyBreakdown;
        if (scheme === PPh21Scheme.TER) {
            monthlyBreakdown = [];
            terPaid = new Decimal(0);
            const monthlyIncome = new Array(12).fill(new Decimal(0));
            for (let i = 0; i < workMonths; i++) {
                monthlyIncome[i] = grossMonthly;
            }
            for (const bonus of bonuses) {
                const monthIndex = bonus.month - 1;
                if (monthIndex >= 0 && monthIndex < 12 && monthIndex < workMonths) {
                    monthlyIncome[monthIndex] = monthlyIncome[monthIndex].plus(bonus.amount);
                }
            }
            for (let i = 0; i < 11 && i < workMonths; i++) {
                const income = monthlyIncome[i];
                const terRate = this.getTERRate(income, terCategory);
                const monthTax = income.times(terRate);
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
            annualTax = this.calculateProgressiveTax(pkp);
            month12Adjustment = annualTax.minus(terPaid);
        }
        else {
            annualTax = this.calculateProgressiveTax(pkp);
        }
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
    calculate(dppInput, rateInput) {
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
    calculate(grossIncomeInput, rateInput) {
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
    calculate(grossIncomeInput, rateInput) {
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
    calculate(amountInput, rateInput, mode) {
        const amount = new Decimal(amountInput);
        const rate = new Decimal(rateInput);
        let dpp;
        let ppn;
        let total;
        if (mode === PPNMode.EXCLUSIVE) {
            dpp = amount;
            ppn = dpp.times(rate.dividedBy(100));
            total = dpp.plus(ppn);
        }
        else {
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
    calculate(dppInput, ppnRateInput, ppnbmRateInput) {
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
const pph21Calculator = new PPH21Calculator();
const pph22Calculator = new PPH22Calculator();
const pph23Calculator = new PPH23Calculator();
const pph42Calculator = new PPH42Calculator();
const ppnCalculator = new PPNCalculator();
const ppnbmCalculator = new PPNBMCalculator();
const taxTypeSelect = document.getElementById('taxType');
const form = document.getElementById('taxForm');
const resultsDiv = document.getElementById('results');
const errorDiv = document.getElementById('error');
const pph21Fields = document.getElementById('pph21-fields');
const pph22Fields = document.getElementById('pph22-fields');
const pph23Fields = document.getElementById('pph23-fields');
const pph42Fields = document.getElementById('pph42-fields');
const ppnFields = document.getElementById('ppn-fields');
const ppnbmFields = document.getElementById('ppnbm-fields');
const pph21Results = document.getElementById('pph21-results');
const pph22Results = document.getElementById('pph22-results');
const pph23Results = document.getElementById('pph23-results');
const pph42Results = document.getElementById('pph42-results');
const ppnResults = document.getElementById('ppn-results');
const ppnbmResults = document.getElementById('ppnbm-results');
let bonusList = [];
function updateFormFields() {
    const selectedType = taxTypeSelect.value;
    [pph21Fields, pph22Fields, pph23Fields, pph42Fields, ppnFields, ppnbmFields].forEach(el => {
        el.style.display = 'none';
    });
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
    resultsDiv.classList.remove('show');
    clearError();
}
function updateSchemeFields() {
    const schemeRadios = Array.from(document.getElementsByName('pph21Scheme'));
    let selectedScheme = PPh21Scheme.TRADITIONAL;
    for (const radio of schemeRadios) {
        if (radio.checked) {
            selectedScheme = radio.value;
            break;
        }
    }
    const terCategoryField = document.getElementById('ter-category-field');
    if (selectedScheme === PPh21Scheme.TER) {
        terCategoryField.style.display = 'block';
    }
    else {
        terCategoryField.style.display = 'none';
    }
}
function addBonus() {
    const bonusNameInput = document.getElementById('bonusName');
    const bonusAmountInput = document.getElementById('bonusAmount');
    const bonusMonthInput = document.getElementById('bonusMonth');
    const name = bonusNameInput.value.trim();
    const amount = parseFloat(bonusAmountInput.value);
    const month = parseInt(bonusMonthInput.value);
    if (!name || isNaN(amount) || amount <= 0 || isNaN(month) || month < 1 || month > 12) {
        showError('Please enter valid bonus details');
        return;
    }
    bonusList.push({ name, amount, month });
    updateBonusList();
    bonusNameInput.value = '';
    bonusAmountInput.value = '';
    bonusMonthInput.value = '';
}
function removeBonus(index) {
    bonusList.splice(index, 1);
    updateBonusList();
}
function updateBonusList() {
    const bonusListDiv = document.getElementById('bonus-list');
    const bonusTotalDiv = document.getElementById('bonus-total');
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
window.removeBonus = removeBonus;
function showError(message) {
    errorDiv.textContent = message;
    errorDiv.classList.add('show');
}
function clearError() {
    errorDiv.classList.remove('show');
    errorDiv.textContent = '';
}
function displayPPH21Results(result) {
    [pph21Results, pph22Results, pph23Results, pph42Results, ppnResults, ppnbmResults].forEach(el => {
        el.style.display = 'none';
    });
    pph21Results.style.display = 'block';
    document.getElementById('result-gross-monthly').textContent = formatCurrency(result.grossMonthly);
    document.getElementById('result-work-months').textContent = result.workMonths.toString();
    document.getElementById('result-gross-salary').textContent = formatCurrency(result.grossMonthly * result.workMonths);
    document.getElementById('result-bonus-total').textContent = formatCurrency(result.bonusTotal);
    document.getElementById('result-gross-annual').textContent = formatCurrency(result.grossAnnual);
    document.getElementById('result-biaya-jabatan').textContent = formatCurrency(result.biayaJabatan);
    document.getElementById('result-pension').textContent = formatCurrency(result.pensionAnnual);
    document.getElementById('result-zakat').textContent = formatCurrency(result.zakatDonation);
    document.getElementById('result-netto').textContent = formatCurrency(result.nettoAnnual);
    document.getElementById('result-ptkp').textContent = formatCurrency(result.ptkp);
    document.getElementById('result-pkp').textContent = formatCurrency(result.pkp);
    document.getElementById('result-annual-tax').textContent = formatCurrency(result.annualTax);
    document.getElementById('result-monthly-tax').textContent = formatCurrency(result.monthlyTax);
    document.getElementById('result-tax-rate').textContent = formatPercent(result.effectiveTaxRate);
    document.getElementById('result-take-home-annual').textContent = formatCurrency(result.takeHomeAnnual);
    document.getElementById('result-take-home-monthly').textContent = formatCurrency(result.takeHomeMonthly);
    const terBreakdownDiv = document.getElementById('ter-breakdown');
    if (result.scheme === PPh21Scheme.TER && result.monthlyBreakdown) {
        terBreakdownDiv.style.display = 'block';
        const terListDiv = document.getElementById('ter-month-list');
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
        document.getElementById('result-ter-paid').textContent = formatCurrency(result.terPaid || 0);
        document.getElementById('result-month12-adjustment').textContent = formatCurrency(result.month12Adjustment || 0);
    }
    else {
        terBreakdownDiv.style.display = 'none';
    }
    resultsDiv.classList.add('show');
}
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
form.addEventListener('submit', (e) => {
    e.preventDefault();
    clearError();
    const selectedType = taxTypeSelect.value;
    try {
        switch (selectedType) {
            case TaxType.PPH21: {
                const grossMonthly = parseFloat(document.getElementById('pph21GrossMonthly').value);
                const ptkpStatus = document.getElementById('pph21PtkpStatus').value;
                const workMonths = parseInt(document.getElementById('pph21WorkMonths').value) || 12;
                const pensionMonthly = parseFloat(document.getElementById('pph21Pension').value) || 0;
                const zakatAnnual = parseFloat(document.getElementById('pph21Zakat').value) || 0;
                const schemeRadios = Array.from(document.getElementsByName('pph21Scheme'));
                let scheme = PPh21Scheme.TRADITIONAL;
                for (const radio of schemeRadios) {
                    if (radio.checked) {
                        scheme = radio.value;
                        break;
                    }
                }
                const terCategory = document.getElementById('pph21TerCategory').value;
                if (isNaN(grossMonthly) || grossMonthly <= 0) {
                    showError('Please enter a valid gross monthly income');
                    return;
                }
                const result = pph21Calculator.calculate(grossMonthly, ptkpStatus, workMonths, scheme, terCategory, pensionMonthly, zakatAnnual, bonusList);
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
form.addEventListener('reset', () => {
    clearError();
    resultsDiv.classList.remove('show');
    bonusList = [];
    updateBonusList();
});
taxTypeSelect.addEventListener('change', updateFormFields);
const schemeRadios = document.getElementsByName('pph21Scheme');
schemeRadios.forEach(radio => {
    radio.addEventListener('change', updateSchemeFields);
});
window.addBonus = addBonus;
window.removeBonus = removeBonus;
updateFormFields();
updateBonusList();
