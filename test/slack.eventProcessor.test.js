"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const { createSlackEventProcessor } = require("../integrations/slack/eventProcessor");

test("answers a Slack question in its originating thread", async () => {
  const calls = [];
  let completed = null;

  const processor = createSlackEventProcessor({
    eventInbox: {
      claim: () => ({
        claimed: true,
        record: {
          workspaceId: "T123",
          tenantId: "minimalism",
          eventId: "Ev123",
          event: {
            type: "message",
            channel: "C123",
            user: "U123",
            text: "What caused this alert?",
            ts: "1720000002.000002",
            threadTs: "1720000001.000001",
          },
        },
      }),
      close: () => {
        throw new Error("Successful delivery must not close the event.");
      },
      complete: (data) => {
        completed = data;
        return {
          status: "COMPLETED",
          responseTs: data.responseTs,
        };
      },
    },
    investigativeIntelligence: {
      answerQuestion: async (request) => {
        calls.push({ type: "investigation", request });
        return {
          status: "answered",
          response: {
            answer: "The available evidence does not establish a root cause.",
          },
        };
      },
    },
    slackDelivery: {
      postMessage: async (request) => {
        calls.push({ type: "delivery", request });
        return {
          channelId: "C123",
          timestamp: "1720000003.000003",
        };
      },
    },
  });

  const result = await processor.processEvent({
    workspaceId: "T123",
    eventId: "Ev123",
  });

  assert.equal(result.status, "completed");
  assert.equal(calls.length, 2);

  assert.deepEqual(calls[0].request, {
    workspaceId: "T123",
    channelId: "C123",
    parentMessageTs: "1720000001.000001",
    question: "What caused this alert?",
  });

  assert.deepEqual(calls[1].request, {
    workspaceId: "T123",
    tenantId: "minimalism",
    channelId: "C123",
    threadTs: "1720000001.000001",
    text: "The available evidence does not establish a root cause.",
  });

  assert.deepEqual(completed, {
    workspaceId: "T123",
    eventId: "Ev123",
    responseChannelId: "C123",
    responseTs: "1720000003.000003",
  });
});


test("includes a contextual referral alongside the substantive answer", async () => {
  let deliveredText;
  const processor = createSlackEventProcessor({
    eventInbox: {
      claim: () => ({claimed:true, record:{workspaceId:"T1", tenantId:"minimalism", eventId:"E1", event:{type:"message", channel:"C1", text:"Show full evidence", ts:"1720000002.000002", threadTs:"1720000001.000001"}}}),
      close: () => { throw new Error("Unexpected close"); },
      complete: () => ({responseTs:"1720000003.000003"}),
    },
    investigativeIntelligence: {answerQuestion: async () => ({status:"answered", response:{answer:"Root cause unknown.", referral:"See the authorized signal in the Standalone App."}})},
    slackDelivery: {postMessage: async ({text}) => {deliveredText=text; return {channelId:"C1", timestamp:"1720000003.000003"};}},
  });
  assert.equal((await processor.processEvent({workspaceId:"T1", eventId:"E1"})).status, "completed");
  assert.equal(deliveredText, "Root cause unknown.\n\nSee the authorized signal in the Standalone App.");
});
