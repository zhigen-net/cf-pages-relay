import { relay } from '../functions/[[path]].js'

export function onRequest({ request, env }) {
  return relay(request, env)
}

export default onRequest
