import { relay } from '../functions/[[path]].js'

export default {
  fetch(request, _context, env) {
    return relay(request, {
      TARGET_URL: env?.TARGET_URL,
      HEALTH_PATH: env?.HEALTH_PATH,
    })
  },
}
