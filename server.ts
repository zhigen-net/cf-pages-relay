// Vercel auto-detects a Node server at the repository root.
import { createServer } from 'node:http'
import { createHandler } from './node-handler.js'

createServer(createHandler()).listen(Number(process.env.PORT || 9000), '0.0.0.0')
