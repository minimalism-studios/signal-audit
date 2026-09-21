(function () {
  const params = new URLSearchParams(window.location.search);

  if (params.get("embed") !== "1") {
    return;
  }

  document.documentElement.classList.add("signal-interpreter-embed");
  document.body.classList.add("signal-interpreter-embed");
})();

(function () {
  const params = new URLSearchParams(window.location.search);

  if (params.get("embed") !== "1") {
    return;
  }

  document.documentElement.classList.add("signal-interpreter-embed");
  document.body.classList.add("signal-interpreter-embed");

  const analyzeStepNumber =
    document.getElementById("analyze-step-number");

  if (analyzeStepNumber) {
    analyzeStepNumber.textContent = "2";
  }
})();
