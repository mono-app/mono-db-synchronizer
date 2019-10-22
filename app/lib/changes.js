const moment = require("moment");

function Changes(){}

Changes.generate = (rows, lastPulledAt) => {
  const created = [];
  const updated = [];
  const deleted = [];
  rows.forEach((change) => {
    if(change.deleted_at !== null) deleted.push(change.id)
    else{
      const serverCreatedAt = new moment(change.server_created_at).unix();
      if(serverCreatedAt > lastPulledAt) created.push(change)
      else updated.push(change);
    }
  })
  return { created, updated, deleted };
}

Changes.pull = async (pool, table, lastPulledAt) => {
  const client = await pool.connect();
  try{
    const newChanges = await client.query(
      `SELECT * FROM ${table} WHERE extract(epoch from last_modified_at at time zone 'utc') > $1`, 
      [ lastPulledAt ]
    );
    return Changes.generate(newChanges.rows, lastPulledAt);
  }catch(err){
    await client.query("ROLLBACK");
    throw err;
  }finally{
    client.release();
  }
}

Changes.create = (client, table, data) => {
  const fields = Object.keys(data).join(",");
  const stringParams = Object.keys(data).map((_, index) => `$${index + 1}`).join(",");
  const stringQuery = `INSERT INTO ${table}(${fields}, server_created_at, last_modified_at) VALUES (${stringParams}, NOW(), NOW())`;
  const parameters = Object.keys(data).map((field) => data[field]);
  return client.query(stringQuery, parameters);
}

Changes.update = (client, table, data) => {
  const setQueries = Object.keys(data).map((field, index) => `${field}=$${index + 1}`).join(",");
  const stringParams = Object.keys(data).map((field) => data[field]);
  const stringQuery = `UPDATE ${table} SET ${setQueries}, last_modified_at=NOW() WHERE id=$${stringParams.length + 1}`;
  stringParams.push(data.id);
  return client.query(stringQuery, stringParams);
}

Changes.delete = (client, table, data) => {
  const stringQuery = `UPDATE ${table} SET deleted_at=NOW() WHERE id=$1`;
  return client.query(stringQuery, [ data.id ]);
}

module.exports = Changes;