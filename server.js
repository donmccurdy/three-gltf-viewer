const express = require('express');
const app = express()
  .use(express.static('./'))
  .listen(process.env.PORT);
