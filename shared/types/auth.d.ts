declare module '#auth-utils' {
  interface User {
    id: string
    email: string
    name: string
    systemRole?: 'USER' | 'SYSTEM_ADMIN'
    avatarUrl?: string | null
  }

  interface UserSession {
    loggedInAt?: Date
  }
}

export {}
