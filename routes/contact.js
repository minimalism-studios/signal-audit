const express = require("express");

const {
  rateLimit,
} = require("express-rate-limit");

const {
  Resend,
} = require("resend");

const ALLOWED_INTERESTS =
  new Set([
    "",
    "grafana",
    "datadog",
    "alert-noise",
    "enterprise-review",
    "signal-audit",
    "other",
  ]);

function normalizeString(
  value,
  maxLength,
) {
  if (typeof value !== "string") {
    return "";
  }

  return value
    .trim()
    .slice(0, maxLength);
}

function isValidEmail(value) {
  if (
    typeof value !== "string"
    || value.length > 254
  ) {
    return false;
  }

  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/
    .test(value);
}

function createContactRouter({
  isMarketingHost,
  resendApiKey,
  contactEmailTo,
}) {
  if (
    typeof isMarketingHost
    !== "function"
  ) {
    throw new Error(
      "isMarketingHost is required.",
    );
  }

  if (
    typeof resendApiKey !== "string"
    || !resendApiKey.trim()
  ) {
    throw new Error(
      "resendApiKey is required.",
    );
  }

  if (
    typeof contactEmailTo !== "string"
    || !contactEmailTo.trim()
  ) {
    throw new Error(
      "contactEmailTo is required.",
    );
  }

  const resend =
    new Resend(
      resendApiKey.trim(),
    );

  const router =
    express.Router();

  const contactRateLimiter =
    rateLimit({
      windowMs:
        15 * 60 * 1000,

      limit: 5,

      standardHeaders:
        "draft-8",

      legacyHeaders:
        false,

      message: {
        error: {
          status: 429,
          message:
            "Too many contact requests. Please try again later.",
        },
      },
    });

  router.post(
    "/",

    (req, res, next) => {
      if (!isMarketingHost(req)) {
        return res
          .status(404)
          .json({
            error: {
              status: 404,
              message: "Not found.",
            },
          });
      }

      return next();
    },

    contactRateLimiter,

    async (req, res, next) => {
      try {
        const {
        name: rawName,
        email: rawEmail,
        company: rawCompany,
        interest: rawInterest,
        message: rawMessage,
        source: rawSource,
        website: rawWebsite,
      } =
        req.body ?? {};

      /*
       * Honeypot.
       *
       * Humans never populate this field.
       * Return the same success response so
       * automated submitters receive no useful
       * indication that they were detected.
       */
      if (
        typeof rawWebsite === "string"
        && rawWebsite.trim()
      ) {
        return res
          .status(200)
          .json({
            ok: true,
          });
      }

      const name =
        normalizeString(
          rawName,
          120,
        );

      const email =
        normalizeString(
          rawEmail,
          254,
        ).toLowerCase();

      const company =
        normalizeString(
          rawCompany,
          160,
        );

      const interest =
        normalizeString(
          rawInterest,
          80,
        );

      const message =
        normalizeString(
          rawMessage,
          4000,
        );

      const source =
        normalizeString(
          rawSource,
          500,
        );

      const errors = {};

      if (!name) {
        errors.name =
          "Name is required.";
      }

      if (!isValidEmail(email)) {
        errors.email =
          "A valid email address is required.";
      }

      if (
        !ALLOWED_INTERESTS.has(
          interest,
        )
      ) {
        errors.interest =
          "Select a valid area of interest.";
      }

      if (!message) {
        errors.message =
          "Tell us what you're working through.";
      }

      if (
        Object.keys(errors)
          .length > 0
      ) {
        return res
          .status(400)
          .json({
            error: {
              status: 400,
              message:
                "Please review the form and try again.",
              fields: errors,
            },
          });
      }

      const submission = {
        name,
        email,
        company:
          company || null,
        interest:
          interest || null,
        message,
        source:
          source || "/contact",
      };

      const subjectContext =
        submission.company
        || submission.name;

      const subject =
        `Signal Audit inquiry — ${subjectContext}`;

      const emailText = [
        "New Signal Audit contact inquiry",
        "",
        `Name: ${submission.name}`,
        `Email: ${submission.email}`,
        `Company: ${submission.company || "Not provided"}`,
        `Interest: ${submission.interest || "Not provided"}`,
        `Source: ${submission.source}`,
        "",
        "Message:",
        submission.message,
      ].join("\n");

      const {
        data,
        error,
      } =
        await resend.emails.send({
          from:
            "Signal Audit <contact@signal-audit.com>",

          to: [
            contactEmailTo.trim(),
          ],

          replyTo:
            submission.email,

          subject,

          text:
            emailText,
        });

      if (error) {
        console.error(
          "Contact email delivery failed.",
          {
            error,
          },
        );

        return res
          .status(502)
          .json({
            error: {
              status: 502,
              message:
                "We couldn't send your message right now. Please try again.",
            },
          });
      }

      console.info(
        "Contact email delivered.",
        {
          emailId:
            data?.id || null,
          interest:
            submission.interest,
          source:
            submission.source,
        },
      );

      return res
        .status(200)
        .json({
          ok: true,
        });
      } catch (error) {
        return next(error);
      }
    },
  );

  return router;
}

module.exports = {
  createContactRouter,
};
