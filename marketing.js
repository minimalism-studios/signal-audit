"use strict";

const express = require("express");
const helmet = require("helmet");
const path = require("path");

const app = express();
const PORT = process.env.PORT || 8080;

const websiteRoot = path.join(__dirname, "website");

const pages = new Map([
  ["/", "index.html"],
  ["/why-signal-audits-work", "pages/how-it-works.html"],
  ["/signal-interpreter", "pages/signal-interpreter.html"],
  ["/audit-submitted", "pages/audit-submitted.html"],
  ["/inside-a-signal-audit", "pages/inside-a-signal-audit.html"],
  ["/pricing", "pages/pricing.html"],
  ["/case-studies/splunk-mltk-birch-signal-audit", "pages/case-studies/splunk-mltk-birch-algorithm.html"],
  ["/faq", "pages/faq.html"],
  ["/signal-audit-slack", "pages/signal-audit-slack.html"],
  ["/enterprise-operational-review", "pages/enterprise-operational-review.html"],
  ["/product-walkthrough/grafana-alert-to-slack", "pages/product-walkthrough/grafana-alert-to-slack.html"],
  ["/integrations", "pages/integrations/index.html"],
  ["/integrations/grafana", "pages/integrations/grafana.html"],
  ["/integrations/datadog", "pages/integrations/datadog.html"],
  ["/product-walkthrough/datadog-monitor-to-slack", "pages/product-walkthrough/datadog-monitor-to-slack.html"],
  ["/security", "pages/security.html"],
]);

const redirects = new Map([
  ["/signal-audit", "/"],
  ["/integrations/index", "/integrations"],
  ["/how-it-works", "/why-signal-audits-work"],
  ["/signal-over-noise-understand-whats-happening-in-your-system-1", "/"],
]);

app.disable("x-powered-by");
app.use(
  helmet({
    referrerPolicy: {
      policy: "strict-origin-when-cross-origin",
    },
    contentSecurityPolicy: {
      directives: {
        "frame-src": [
          "'self'",
          "https://www.youtube.com",
          "https://www.youtube-nocookie.com",
        ],
        "script-src": [
          "'self'",
          "https://www.youtube.com",
          "https://www.youtube-nocookie.com",
        ],
        "connect-src": [
          "'self'",
          "https://www.youtube.com",
          "https://www.youtube-nocookie.com",
        ],
        "img-src": [
          "'self'",
          "data:",
          "https://i.ytimg.com",
          "https://*.googleusercontent.com",
        ],
      },
    },
  })
);

app.use(
  "/assets",
  express.static(path.join(websiteRoot, "assets"))
);

app.use((req, res) => {
  if (req.method !== "GET" && req.method !== "HEAD") {
    return res.sendStatus(405);
  }

  let pathname = req.path;

  if (pathname.length > 1 && pathname.endsWith("/")) {
    pathname = pathname.slice(0, -1);
  }

  const redirectTarget = redirects.get(pathname);

  if (redirectTarget) {
    return res.redirect(301, redirectTarget);
  }

  const page = pages.get(pathname);

  if (page) {
    return res.sendFile(path.join(websiteRoot, page));
  }

  return res
    .status(404)
    .sendFile(path.join(websiteRoot, "404.html"));
});

app.listen(PORT, () => {
  console.log(
    JSON.stringify({
      timestamp: new Date().toISOString(),
      level: "info",
      event: "marketing_service_started",
      port: PORT,
    })
  );
});
