const reframeText = `This is a surface-level read.

If this is happening in production, it’s usually not isolated.`;

const valueText = `Most teams have the data.

Very few know what it’s actually saying.

Signal Audit gives you a clear read on where your system is breaking down — and what to do next.`;

const offerText = `Signal Audit

A focused analysis of your system to identify what’s driving performance, risk, and instability.

- Trace critical paths across services
- Identify hidden degradation patterns
- Eliminate noise from your observability layer`;

let lastRawResult = "";
let scrollCueWasVisible = false;

function showEl(id, display = "block") {
  const el = document.getElementById(id);
  if (el) el.style.display = display;
}

function hideEl(id) {
  const el = document.getElementById(id);
  if (el) el.style.display = "none";
}

function setText(id, text) {
  const el = document.getElementById(id);
  if (el) el.textContent = text;
}

function showScrollCue() {
  document.getElementById("scroll-cue")?.classList.add("visible");
}

function hideScrollCue() {
  document.getElementById("scroll-cue")?.classList.remove("visible");
}

function scrollCueDown() {
  window.scrollTo({
    top: document.body.scrollHeight,
    behavior: "smooth"
  });
}

function pulseScrollCue(cue) {
  cue.classList.remove("pulse");
  void cue.offsetWidth;
  cue.classList.add("pulse");

  setTimeout(() => {
    cue.classList.remove("pulse");
  }, 1100);
}

function updateScrollCue() {
  const cue = document.getElementById("scroll-cue");
  const analysisState = document.getElementById("analysis-state");

  if (!cue || !analysisState) return;

  if (analysisState.style.display !== "block") {
    cue.classList.remove("visible");
    return;
  }

  const distanceFromBottom =
    document.body.scrollHeight - (window.scrollY + window.innerHeight);

  if (distanceFromBottom > 80 && document.body.scrollHeight > window.innerHeight) {
    cue.classList.add("visible");

    if (!scrollCueWasVisible) pulseScrollCue(cue);

    scrollCueWasVisible = true;
  } else {
    cue.classList.remove("visible");
    cue.classList.remove("pulse");
    scrollCueWasVisible = false;
  }
}

function fillExample(text) {
  document.getElementById("input").value = text;
}

function resetSignalInterpreter() {
  document.getElementById("input").value = "";

  const contextInput = document.getElementById("context-input");
  if (contextInput) contextInput.value = "";

  lastRawResult = "";

  hideEl("loading-state");
  hideEl("analysis-state");
  showEl("empty-state", "flex");

  hideScrollCue();

  setText("primary-finding-title", "Upstream dependency is timing out");
  setText(
    "primary-finding-summary",
    "Retries are increasing latency and may lead to cascading failures."
  );
  setText(
    "what-matters-text",
    "Repeated timeouts and retries are creating increased latency."
  );
  setText(
    "where-to-look-text",
    "Upstream service health, network latency, and connection saturation."
  );
  setText(
    "ignore-text",
    "Successful requests and isolated events are likely symptoms."
  );
  setText(
    "next-action-text",
    "Check upstream service health and recent changes."
  );

  const output = document.getElementById("output");
  if (output) output.innerHTML = "";

  hideEl("post-analysis");
  hideEl("signal-cta");

  const founderCta = document.querySelector(".founder-sales-cta");
  if (founderCta) founderCta.style.display = "none";
}

function detectSeverity(text) {
  const lower = text.toLowerCase();

  if (
    lower.includes("cascading") ||
    lower.includes("critical") ||
    lower.includes("customer impact") ||
    lower.includes("outage") ||
    lower.includes("rollback")
  ) return { label: "High signal", level: "high" };

  if (
    lower.includes("degradation") ||
    lower.includes("latency") ||
    lower.includes("error rate") ||
    lower.includes("regression")
  ) return { label: "Medium signal", level: "medium" };

  return { label: "Low signal", level: "low" };
}

function extractSection(text, possibleTitles, fallback) {
  const sections = text.split("\n\n");

  for (const section of sections) {
    const lines = section.split("\n").filter(Boolean);
    const title = (lines[0] || "").toLowerCase();

    if (possibleTitles.some(t => title.includes(t))) {
      return lines.slice(1).join(" ").replace(/^[-•]\s*/, "").trim() || fallback;
    }
  }

  return fallback;
}

function populateDashboardCards(text) {
  const primary =
    extractSection(text, ["pattern", "primary", "signal"], "Production signal detected.");

  const whatMatters =
    extractSection(text, ["what matters", "matters"], "The signal suggests a meaningful operational pattern.");

  const whereToLook =
    extractSection(text, ["where to look", "look"], "Review the affected service, upstream dependencies, and recent changes.");

  const ignore =
    extractSection(text, ["ignore"], "Avoid over-focusing on isolated symptoms until the pattern is confirmed.");

  const nextAction =
    extractSection(text, ["next action", "recommended", "action"], "Investigate the highest-signal service path first.");

  setText("primary-finding-title", primary.split(".")[0] || "Signal detected");
  setText("primary-finding-summary", whatMatters);
  setText("what-matters-text", whatMatters);
  setText("where-to-look-text", whereToLook);
  setText("ignore-text", ignore);
  setText("next-action-text", nextAction);
}

async function runInterpretation() {
  const inputEl = document.getElementById("input");
  const contextEl = document.getElementById("context-input");
  const output = document.getElementById("output");
  const button = document.getElementById("interpret-btn");
  const severity = document.getElementById("severity-badge");
  const status = document.getElementById("signal-status");
  const errorStatus = document.getElementById("signal-error");

  if (status) status.textContent = "";
  if (errorStatus) errorStatus.textContent = "";

  const input = inputEl.value.trim();
  const context = contextEl ? contextEl.value.trim() : "";
  const fullInput = context ? `${input}\n\nContext:\n${context}` : input;

  const post = document.getElementById("post-analysis");
  const reframeEl = document.getElementById("reframe-text");
  const valueEl = document.getElementById("value-text");
  const offerEl = document.getElementById("offer-text");
  const meta = document.getElementById("result-meta");
  const cta = document.getElementById("signal-cta");

  if (post) post.style.display = "none";
  if (reframeEl) reframeEl.textContent = "";
  if (valueEl) valueEl.textContent = "";
  if (offerEl) offerEl.textContent = "";
  if (meta) meta.style.display = "none";
  if (cta) cta.style.display = "none";

  const founderCta = document.querySelector(".founder-sales-cta");
  if (founderCta) founderCta.style.display = "none";

  if (!input) {
    hideEl("loading-state");
    hideEl("analysis-state");
    showEl("empty-state", "flex");

    inputEl.setAttribute(
      "aria-invalid",
      "true"
    );

    if (errorStatus) {
      errorStatus.textContent =
        "Paste a production signal before interpreting.";
    }

    inputEl.focus();
    return;
  }

  inputEl.removeAttribute(
    "aria-invalid"
  );

  hideEl("empty-state");
  hideEl("analysis-state");
  showEl("loading-state", "flex");

  button.innerText = "Interpreting...";
  button.disabled = true;

  try {
    const res = await fetch("https://minimalism-studios-signal-interpreter-arak36xeq.vercel.app/api/interpret", {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify({ input: fullInput })
    });

    const data = await res.json();

    hideEl("loading-state");
    showEl("analysis-state", "block");

    if (!res.ok) {
      const message =
        data.error ||
        "Endpoint returned an error.";

      output.textContent = message;

      if (errorStatus) {
        errorStatus.textContent =
          "Signal interpretation failed. " +
          message;
      }

      return;
    }

    lastRawResult = data.result || "No result returned.";

    const sev = detectSeverity(lastRawResult);
    severity.innerText = sev.label;
    severity.className = "";
    severity.classList.add(sev.level);

    populateDashboardCards(lastRawResult);

    output.innerHTML = "";

    typeOutput(lastRawResult, output, () => {
      post.style.display = "block";

      typeBlock(reframeText, reframeEl, 14, () => {
        setTimeout(() => {
          typeBlock(valueText, valueEl, 14, () => {
            setTimeout(() => {
              typeBlock(offerText, offerEl, 14, () => {
                meta.style.display = "flex";

                if (founderCta) founderCta.style.display = "block";
                cta.style.display = "block";

                if (status) {
                  status.textContent =
                    "Signal interpretation complete. Analysis results are available.";
                }

                hideScrollCue();
              });
            }, 200);
          });
        }, 200);
      });
    });

    setTimeout(updateScrollCue, 200);

  } catch (error) {
    hideEl("loading-state");
    showEl("analysis-state", "block");

    const message =
      "Frontend error: " +
      error.message;

    output.textContent = message;

    if (errorStatus) {
      errorStatus.textContent =
        "Signal interpretation failed. " +
        message;
    }
  } finally {
    button.innerText = "✦ Interpret Signal";
    button.disabled = false;
  }
}

function typeOutput(text, container, done) {
  container.innerHTML = "";

  const outputWrap = document.getElementById("output-wrap");
  const yOffset = -80;

  if (outputWrap) {
    const y = outputWrap.getBoundingClientRect().top + window.pageYOffset + yOffset;

    window.scrollTo({
      top: y,
      behavior: "smooth"
    });
  }

  showScrollCue();

  const sections = text.split("\n\n");
  let sectionIndex = 0;

  function typeText(element, text, speed = 12, callback) {
    let i = 0;
    element.textContent = "";

    function typeChar() {
      if (i < text.length) {
        element.textContent += text[i];
        i++;
        setTimeout(typeChar, speed);
      } else if (callback) {
        callback();
      }

      updateScrollCue();
    }

    typeChar();
  }

  function renderNextSection() {
    if (sectionIndex >= sections.length) {
      if (done) done();
      return;
    }

    const section = sections[sectionIndex];
    const lines = section.split("\n").filter(Boolean);
    const title = lines[0];
    const content = lines.slice(1);

    const sectionEl = document.createElement("div");
    sectionEl.className = "signal-section";

    const titleEl = document.createElement("div");
    titleEl.className = "signal-title";

    const contentEl = document.createElement("div");
    contentEl.className = "signal-content";

    sectionEl.appendChild(titleEl);
    sectionEl.appendChild(contentEl);
    container.appendChild(sectionEl);

    typeText(titleEl, title, 24, () => {
      let lineIndex = 0;

      function renderNextLine() {
        if (lineIndex >= content.length) {
          sectionIndex++;
          setTimeout(renderNextSection, 180);
          return;
        }

        const rawLine = content[lineIndex];
        const lineEl = document.createElement("div");

        if (rawLine.trim().startsWith("-")) {
          lineEl.className = "signal-line bullet";
          contentEl.appendChild(lineEl);

          typeText(lineEl, rawLine.replace("-", "").trim(), 8, () => {
            lineIndex++;
            setTimeout(renderNextLine, 80);
          });
        } else {
          lineEl.className = "signal-line";
          contentEl.appendChild(lineEl);

          typeText(lineEl, rawLine, 20, () => {
            lineIndex++;
            setTimeout(renderNextLine, 80);
          });
        }
      }

      renderNextLine();
    });
  }

  renderNextSection();
}

function typeBlock(text, container, speed = 14, callback) {
  const formatted = text.replace(/Signal Audit/g, "<strong>Signal Audit</strong>");

  container.innerHTML = "";
  let i = 0;

  function typeChar() {
    if (i < formatted.length) {
      container.innerHTML = formatted.slice(0, i + 1);
      i++;
      setTimeout(typeChar, speed);
    } else if (typeof callback === "function") {
      setTimeout(callback, 100);
    }

    updateScrollCue();
  }

  typeChar();
}

function copyResult() {
  if (!lastRawResult) return;

  const status =
    document.getElementById(
      "signal-status"
    );

  const errorStatus =
    document.getElementById(
      "signal-error"
    );

  navigator.clipboard
    .writeText(lastRawResult)
    .then(() => {
      const btn =
        document.getElementById(
          "copy-btn"
        );

      btn.innerText = "Copied";

      if (status) {
        status.textContent =
          "Result copied to clipboard.";
      }

      setTimeout(() => {
        btn.innerText = "Copy result";
      }, 1400);
    })
    .catch(() => {
      if (errorStatus) {
        errorStatus.textContent =
          "Unable to copy the result to the clipboard.";
      }
    });
}

window.addEventListener("scroll", updateScrollCue);
