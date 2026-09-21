document.addEventListener("DOMContentLoaded", function () {
  const form = document.getElementById("saRoiForm");

  if (!form) {
    return;
  }

  const fields = {
    engineerCount: document.getElementById("saEngineerCount"),
    engineerCost: document.getElementById("saEngineerCost"),
    deploymentCost: document.getElementById("saDeploymentCost"),
    annualPlatformCost: document.getElementById("saAnnualPlatformCost"),
    incidentsPerMonth: document.getElementById("saIncidentsPerMonth"),
    engineersPerIncident: document.getElementById("saEngineersPerIncident"),
    hoursPerIncident: document.getElementById("saHoursPerIncident"),
    timeReduction: document.getElementById("saTimeReduction")
  };

  const outputs = {
    engineeringOpex: document.getElementById("saEngineeringOpex"),
    yearOneCost: document.getElementById("saYearOneCost"),
    opexPercentage: document.getElementById("saOpexPercentage"),
    incidentCost: document.getElementById("saIncidentCost"),
    recoveredCost: document.getElementById("saRecoveredCost"),
    estimatedRoi: document.getElementById("saEstimatedRoi"),
    breakEvenHours: document.getElementById("saBreakEvenHours"),
    roiSummary: document.getElementById("saRoiSummary")
  };

  const WORKING_HOURS_PER_YEAR = 2080;

  function getNumber(input) {
    const value = Number.parseFloat(input.value);

    if (!Number.isFinite(value) || value < 0) {
      return 0;
    }

    return value;
  }

  function formatCurrency(value) {
    return new Intl.NumberFormat("en-US", {
      style: "currency",
      currency: "USD",
      maximumFractionDigits: 0
    }).format(value);
  }

  function formatPercentage(value, decimals) {
    if (!Number.isFinite(value)) {
      return "0%";
    }

    return value.toLocaleString("en-US", {
      minimumFractionDigits: decimals,
      maximumFractionDigits: decimals
    }) + "%";
  }

  function formatHours(value) {
    const roundedValue = Math.ceil(value);
    const unit = roundedValue === 1 ? "engineering hour" : "engineering hours";

    return roundedValue.toLocaleString("en-US") + " " + unit;
  }

  function updateCalculator() {
    const engineerCount = getNumber(fields.engineerCount);
    const engineerCost = getNumber(fields.engineerCost);
    const deploymentCost = getNumber(fields.deploymentCost);
    const annualPlatformCost = getNumber(fields.annualPlatformCost);
    const incidentsPerMonth = getNumber(fields.incidentsPerMonth);
    const engineersPerIncident = getNumber(fields.engineersPerIncident);
    const hoursPerIncident = getNumber(fields.hoursPerIncident);

    const timeReduction = Math.min(
      getNumber(fields.timeReduction),
      100
    );

    const engineeringOpex = engineerCount * engineerCost;
    const yearOneCost = deploymentCost + annualPlatformCost;

    const opexPercentage =
      engineeringOpex > 0
        ? (yearOneCost / engineeringOpex) * 100
        : 0;

    const engineerHourlyCost =
      engineerCost > 0
        ? engineerCost / WORKING_HOURS_PER_YEAR
        : 0;

    const annualIncidentHours =
      incidentsPerMonth *
      12 *
      engineersPerIncident *
      hoursPerIncident;

    const annualIncidentCost =
      annualIncidentHours * engineerHourlyCost;

    const recoveredCost =
      annualIncidentCost * (timeReduction / 100);

    const estimatedRoi =
      yearOneCost > 0
        ? ((recoveredCost - yearOneCost) / yearOneCost) * 100
        : 0;

    const breakEvenHours =
      engineerHourlyCost > 0
        ? yearOneCost / engineerHourlyCost
        : 0;

    outputs.engineeringOpex.textContent =
      formatCurrency(engineeringOpex);

    outputs.yearOneCost.textContent =
      formatCurrency(yearOneCost);

    outputs.opexPercentage.textContent =
      formatPercentage(opexPercentage, 3);

    outputs.incidentCost.textContent =
      formatCurrency(annualIncidentCost);

    outputs.recoveredCost.textContent =
      formatCurrency(recoveredCost);

    outputs.estimatedRoi.textContent =
      formatPercentage(estimatedRoi, 0);

    outputs.breakEvenHours.textContent =
      formatHours(breakEvenHours);

    if (recoveredCost > yearOneCost) {
      outputs.roiSummary.textContent =
        "Recovering approximately " +
        formatPercentage(timeReduction, 0) +
        " of current incident-response time would exceed the first-year Signal Audit investment.";
    } else if (recoveredCost === yearOneCost && yearOneCost > 0) {
      outputs.roiSummary.textContent =
        "The estimated recovered engineering cost equals the first-year Signal Audit investment.";
    } else {
      const remainingValue = Math.max(yearOneCost - recoveredCost, 0);

      outputs.roiSummary.textContent =
        "At these assumptions, an additional " +
        formatCurrency(remainingValue) +
        " in recovered engineering capacity would be needed to reach first-year break-even.";
    }
  }

  Object.values(fields).forEach(function (field) {
    field.addEventListener("input", updateCalculator);
    field.addEventListener("change", updateCalculator);
  });

  form.addEventListener("submit", function (event) {
    event.preventDefault();
  });

  updateCalculator();
});
