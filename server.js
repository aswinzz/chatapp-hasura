const express = require('express')
const next = require('next')
const bodyParser = require('body-parser')
const dev = process.env.NODE_ENV !== 'production'
const app = next({ dev })
const handle = app.getRequestHandler()
const helmet = require('helmet')


app.prepare()
.then(() => {
  const server = express()
  server.use(helmet())
  server.use(bodyParser.urlencoded({ extended: false }))

    // parse application/json
  server.use(bodyParser.json())
  
  server.listen(8080, (err) => {
    if (err) throw err
    console.log('> Ready on http://localhost:8080')
  })

  server.post('/webhook', async function (req, res) {
    // webhook payload
        res.json({error: false, data: {new:"testing"}});
  })  

  server.get('*', (req, res) => {
    // console.log("Next App");
    return handle(req, res)
  })
})
.catch((ex) => {
  console.error(ex.stack)
  process.exit(1)
})