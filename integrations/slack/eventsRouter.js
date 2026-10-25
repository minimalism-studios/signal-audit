"use strict";

const express = require("express");
const { verifySlackRequest } = require("./requestVerifier");

function createSlackEventsRouter({ signingSecret, eventsHandler }) {
  if (
    typeof signingSecret !== "string"
    || !signingSecret
    || typeof eventsHandler?.handleEvent !== "function"
  ) {
    throw new Error("Slack Events router configuration is required.");
  }

  const router = express.Router();

  router.post(
    "/",
    express.raw({ type: "application/json", limit: "1mb" }),
    (req, res) => {
      if (!verifySlackRequest({
        rawBody: req.body,
        timestamp: req.get("x-slack-request-timestamp"),
        signature: req.get("x-slack-signature"),
        signingSecret,
      })) {
        return res.sendStatus(401);
      }

      let payload;

      try {
        payload = JSON.parse(req.body.toString("utf8"));
      } catch {
        return res.sendStatus(400);
      }

      if (!payload || typeof payload !== "object" || Array.isArray(payload)) {
        return res.sendStatus(400);
      }

      if (payload.type === "url_verification") {
        if (typeof payload.challenge !== "string" || !payload.challenge) {
          return res.sendStatus(400);
        }

        return res.status(200).json({ challenge: payload.challenge });
      }

      try {
        const result = eventsHandler.handleEvent(payload);

        if (!result.accepted) {
          return res.sendStatus(403);
        }

        return res.sendStatus(200);
      } catch (error) {
        console.error("Slack event handling failed:", error.message);
        return res.sendStatus(503);
      }
    },
  );

  return router;
}

module.exports = { createSlackEventsRouter };
