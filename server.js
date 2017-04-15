const express = require('express');

express()
  .use(express.static('./'))
  .listen(process.env.PORT || 3000);
