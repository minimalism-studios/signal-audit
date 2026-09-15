const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");

const {
  createSignalHistory,
} = require("../services/signalHistory");

function createTempHistory(records) {
  const directory =
    fs.mkdtempSync(
      path.join(
        os.tmpdir(),
        "signal-history-retention-",
      ),
    );

  const filePath =
    path.join(
      directory,
      "signal-history.json",
    );

  fs.writeFileSync(
    filePath,
    `${JSON.stringify(records, null, 2)}\n`,
    "utf8",
  );

  return {
    directory,
    filePath,
    history:
      createSignalHistory({
        filePath,
        retentionDays: 30,
      }),
  };
}

function daysAgo(days) {
  return new Date(
    Date.now()
      - days * 24 * 60 * 60 * 1000,
  ).toISOString();
}

test(
  "retains active signals older than retention window",
  () => {
    const fixture =
      createTempHistory([
        {
          id: "sig_active_old",
          receivedAt: daysAgo(90),
          operationalState: "active",
        },
      ]);

    try {
      const records =
        fixture.history.listAllSignals();

      assert.equal(records.length, 1);
      assert.equal(
        records[0].id,
        "sig_active_old",
      );
    } finally {
      fs.rmSync(
        fixture.directory,
        {
          recursive: true,
          force: true,
        },
      );
    }
  },
);

test(
  "treats legacy signals without operationalState as active",
  () => {
    const fixture =
      createTempHistory([
        {
          id: "sig_legacy_old",
          receivedAt: daysAgo(90),
        },
      ]);

    try {
      const records =
        fixture.history.listAllSignals();

      assert.equal(records.length, 1);
      assert.equal(
        records[0].id,
        "sig_legacy_old",
      );
    } finally {
      fs.rmSync(
        fixture.directory,
        {
          recursive: true,
          force: true,
        },
      );
    }
  },
);

test(
  "retains recently resolved signals using resolvedAt",
  () => {
    const fixture =
      createTempHistory([
        {
          id: "sig_resolved_recent",
          receivedAt: daysAgo(90),
          operationalState: "resolved",
          resolvedAt: daysAgo(10),
        },
      ]);

    try {
      const records =
        fixture.history.listAllSignals();

      assert.equal(records.length, 1);
      assert.equal(
        records[0].id,
        "sig_resolved_recent",
      );
    } finally {
      fs.rmSync(
        fixture.directory,
        {
          recursive: true,
          force: true,
        },
      );
    }
  },
);

test(
  "expires resolved signals after retention window",
  () => {
    const fixture =
      createTempHistory([
        {
          id: "sig_resolved_old",
          receivedAt: daysAgo(90),
          operationalState: "resolved",
          resolvedAt: daysAgo(31),
        },
      ]);

    try {
      const records =
        fixture.history.listAllSignals();

      assert.equal(records.length, 0);

      const persisted =
        JSON.parse(
          fs.readFileSync(
            fixture.filePath,
            "utf8",
          ),
        );

      assert.equal(
        persisted.length,
        0,
      );
    } finally {
      fs.rmSync(
        fixture.directory,
        {
          recursive: true,
          force: true,
        },
      );
    }
  },
);
