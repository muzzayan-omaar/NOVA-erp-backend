// Uganda PAYE bands and NSSF rates.
// VERIFY against the official current URA PAYE guide (ura.go.ug) before
// relying on this for real payroll — search results conflicted, with one
// source claiming a July 2026 amendment changed both the threshold and
// the band structure entirely. This file is the single place to correct
// it if that turns out to be accurate.

export const calculatePAYE = (grossSalary) => {
  const salary = Number(grossSalary) || 0;
  let paye = 0;

  if (salary <= 235000) {
    paye = 0;
  } else if (salary <= 335000) {
    paye = (salary - 235000) * 0.10;
  } else if (salary <= 410000) {
    paye = 10000 + (salary - 335000) * 0.20;
  } else {
    paye = 25000 + (salary - 410000) * 0.30;
    const HIGH_EARNER_THRESHOLD = 10000000;
    if (salary > HIGH_EARNER_THRESHOLD) {
      paye += (salary - HIGH_EARNER_THRESHOLD) * 0.10;
    }
  }

  return Math.round(paye);
};

export const NSSF_EMPLOYEE_RATE = 0.05;
export const NSSF_EMPLOYER_RATE = 0.10;

// NSSF is calculated on gross pay, and — importantly — the employee's 5%
// is NOT tax-deductible in Uganda: PAYE is computed on the full gross,
// NSSF is deducted separately afterward.
export const calculateNssf = (grossSalary) => {
  const salary = Number(grossSalary) || 0;
  return {
    employee: Math.round(salary * NSSF_EMPLOYEE_RATE),
    employer: Math.round(salary * NSSF_EMPLOYER_RATE),
  };
};