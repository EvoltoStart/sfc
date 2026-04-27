interface StoredAdminAuthState {
  token: string
  username: string
}

const STORAGE_KEY = 'sfc-admin-auth-state'

const defaultState: StoredAdminAuthState = {
  token: '',
  username: '',
}

let cachedState: StoredAdminAuthState = defaultState

function canUseStorage() {
  return typeof window !== 'undefined' && typeof window.localStorage !== 'undefined'
}

export function loadStoredAdminAuthState(): StoredAdminAuthState {
  if (!canUseStorage()) {
    return cachedState
  }

  try {
    const raw = window.localStorage.getItem(STORAGE_KEY)
    if (!raw) {
      cachedState = defaultState
      return cachedState
    }
    const parsed = JSON.parse(raw) as Partial<StoredAdminAuthState>
    cachedState = {
      token: typeof parsed.token === 'string' ? parsed.token : '',
      username: typeof parsed.username === 'string' ? parsed.username : '',
    }
    return cachedState
  } catch {
    cachedState = defaultState
    return cachedState
  }
}

export function saveStoredAdminAuthState(state: Partial<StoredAdminAuthState>) {
  const nextState = {
    ...loadStoredAdminAuthState(),
    ...state,
  }
  cachedState = nextState

  if (!canUseStorage()) {
    return
  }

  window.localStorage.setItem(STORAGE_KEY, JSON.stringify(nextState))
}

export function clearStoredAdminAuthState() {
  cachedState = defaultState
  if (!canUseStorage()) {
    return
  }
  window.localStorage.removeItem(STORAGE_KEY)
}

export function getStoredAdminToken() {
  return cachedState.token || loadStoredAdminAuthState().token
}
