const Changes = require("@app/lib/changes");

function PushListener(){}

PushListener.listen = async (req, res) => {
  const { connectionPool } = req;  
  const { lastPulledAt } = req.query;
  const { changes } = req.body;

  const changedTables = Object.keys(changes);
  const client = await connectionPool.connect();
  try{
    const promises = changedTables.map(async (table) => {
      const { created, updated, deleted } = changes[table];
      await Promise.all(created.map(async (data) => {
        const queryResponse = await client.query(`SELECT * FROM ${table} WHERE id=$1`, [data.id]);
        if(queryResponse.rowCount > 0) return Changes.update(client, table, data);
        else return Changes.create(client, table, data);
      }));

      await Promise.all(updated.map(async (data) => {
        const queryResponse = await client.query(`SELECT * FROM ${table} WHERE id=$1 LIMIT 1`, [data.id]);
        if(queryResponse.rowCount === 0) return Changes.create(client, table, data);
        else {
          if(queryResponse.rows[0].last_modified > lastPulledAt) throw "Conflict";
          return Changes.update(client, table, data);
        }
      }));

      await Promise.all(deleted.map(async (data) => {
        const normalizedData = { id: data };
        const queryResponse = await client.query(`SELECT * FROM ${table} WHERE id=$1`, [normalizedData.id]);
        if(queryResponse.rowCount === 0) return Promise.resolve();
        else return Changes.delete(client, table, normalizedData);
      }));
    })
    await Promise.all(promises);
    res.status(200).end();
  }catch(err){
    await client.query("ROLLBACK");
    throw err;
  }finally{
    client.release();
  }
}

module.exports = PushListener;