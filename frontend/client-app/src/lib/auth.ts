export type RolePreference = 'PASSENGER' | 'DRIVER'

interface StoredAuthState {
  token: string
  loginCode: string
  rolePreference: RolePreference
}

const STORAGE_KEY = 'sfc-client-auth-state'

const defaultState: StoredAuthState = {
  token: '',
  loginCode: '',
  rolePreference: 'PASSENGER',
}

let cachedState: StoredAuthState = defaultState

function canUseStorage() {
  return typeof window !== 'undefined' && typeof window.localStorage !== 'undefined'
}

export function loadStoredAuthState(): StoredAuthState {
  if (!canUseStorage()) {
    return cachedState
  }

  try {
    const raw = window.localStorage.getItem(STORAGE_KEY)
    if (!raw) {
      cachedState = defaultState
      return cachedState
    }
    const parsed = JSON.parse(raw) as Partial<StoredAuthState>
    cachedState = {
      token: typeof parsed.token === 'string' ? parsed.token : '',
      loginCode: typeof parsed.loginCode === 'string' ? parsed.loginCode : '',
      rolePreference: parsed.rolePreference === 'DRIVER' ? 'DRIVER' : 'PASSENGER',
    }
    return cachedState
  } catch {
    cachedState = defaultState
    return cachedState
  }
}

export function saveStoredAuthState(state: Partial<StoredAuthState>) {
  const nextState = {
    ...loadStoredAuthState(),
    ...state,
  }
  cachedState = nextState

  if (!canUseStorage()) {
    return
  }

  window.localStorage.setItem(STORAGE_KEY, JSON.stringify(nextState))
}

export function clearStoredAuthState() {
  cachedState = defaultState
  if (!canUseStorage()) {
    return
  }
  window.localStorage.removeItem(STORAGE_KEY)
}

export function getStoredToken() {
  return cachedState.token || loadStoredAuthState().token
}
