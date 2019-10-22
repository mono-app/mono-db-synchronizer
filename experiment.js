require('module-alias/register');
require('dotenv').config();

const moment = require("moment");
const User = require("@app/models/user");

(async () => {
  const users = await User.changes(new moment().subtract(1, "year").unix());
  console.log({ users });
})();