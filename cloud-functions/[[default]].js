import { relayWithNode } from '../node-handler.js'

export function onRequest({ request, env }) {
  return relayWithNode(request, env)
}

export default onRequest
