import { createServer } from 'node:http'
import { createHandler } from './node-handler.js'

const port = Number(process.env.PORT || 9000)
createServer(createHandler()).listen(port, '0.0.0.0', () => {
  console.log(`Relay listening on port ${port}`)
})
