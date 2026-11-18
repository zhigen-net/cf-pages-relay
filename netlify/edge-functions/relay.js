import { relay } from '../../functions/[[path]].js'

export default (request) => relay(request, {
  TARGET_URL: Netlify.env.get('TARGET_URL'),
  HEALTH_PATH: Netlify.env.get('HEALTH_PATH'),
})
