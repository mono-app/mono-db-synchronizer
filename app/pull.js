const moment = require("moment");
const Changes = require("@app/lib/changes");

function PullListener(){}

PullListener.listen = async (req, res) => {
  const { connectionPool } = req;
  const { lastPulledAt } = req.query;
  const normalizedLastPulledAt = (!lastPulledAt)? new moment().subtract(1, "year").unix(): lastPulledAt;
  
  const pullTables = process.env.SYNC_PULL_TABLES.split(",") || [];
  const promises = pullTables.map((table) => {
    return Changes.pull(connectionPool, table, normalizedLastPulledAt)
  });

  const changes = {};
  const allChanges = await Promise.all(promises);
  allChanges.forEach((change, index) => changes[pullTables[index]] = change)

  res.json({ changes, timestamp: new moment().unix() }).end();
}

module.exports = PullListener;