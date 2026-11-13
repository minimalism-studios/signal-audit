"use strict";

function createSlackEventScheduler({
  eventConsumer,
  logger = console,
  intervalMs = 5000,
}) {
  if (
    typeof eventConsumer?.processPending !== "function"
    || !Number.isSafeInteger(intervalMs)
    || intervalMs < 1000
  ) {
    throw new Error("Invalid Slack event scheduler configuration.");
  }

  let timer = null;
  let running = false;

  async function tick() {
    if (running) return;

    running = true;

    try {
      const result = await eventConsumer.processPending({ limit: 10 });

      if (result.examined > 0) {
        logger.info("slack_agent_events_processed", {
          examined: result.examined,
          statuses: result.results.map((item) => item.status),
        });
      }
    } catch (error) {
      logger.error("slack_agent_consumer_failed", {
        message: error.message,
      });
    } finally {
      running = false;
    }
  }

  function start() {
    if (timer !== null) return;

    timer = setInterval(() => {
      void tick();
    }, intervalMs);
  }

  function stop() {
    if (timer !== null) {
      clearInterval(timer);
      timer = null;
    }
  }

  return Object.freeze({ start, stop });
}

module.exports = { createSlackEventScheduler };
