export type AppView =
  | 'home'
  | 'matches'
  | 'trip-detail'
  | 'orders'
  | 'order-detail'
  | 'payment'
  | 'publish'
  | 'safety'
  | 'profile'
  | 'vehicles'
  | 'license'
  | 'wallet'
  | 'coupons'
  | 'help'

export interface AppRoute {
  view: AppView
  params: Record<string, string>
}

const validViews = new Set<AppView>([
  'home',
  'matches',
  'trip-detail',
  'orders',
  'order-detail',
  'payment',
  'publish',
  'safety',
  'profile',
  'vehicles',
  'license',
  'wallet',
  'coupons',
  'help',
])

export const defaultRoute: AppRoute = {
  view: 'home',
  params: {},
}

export function parseHashRoute(hash: string): AppRoute {
  const normalized = hash.replace(/^#\/?/, '')
  if (!normalized) {
    return defaultRoute
  }

  const [rawView, rawQuery = ''] = normalized.split('?')
  const view = validViews.has(rawView as AppView) ? (rawView as AppView) : defaultRoute.view
  const params = Object.fromEntries(new URLSearchParams(rawQuery).entries())
  return {
    view,
    params,
  }
}

export function buildHashRoute(route: AppRoute) {
  const query = new URLSearchParams(
    Object.entries(route.params).filter(([, value]) => value !== ''),
  ).toString()
  return `#/${route.view}${query ? `?${query}` : ''}`
}
