import { FirebaseError } from 'firebase/app'

/**
 * Maps Firebase Auth error codes to consumer-friendly messages.
 * `action` only changes the generic fallback copy's verb (OA-88 added
 * `resetPassword`, whose errors shouldn't read as sign-in errors) --
 * the specific-code messages below already read fine for either action.
 */
export function describeAuthError(err: unknown, action: 'signing in' | 'sending that email' = 'signing in'): string {
  if (err instanceof FirebaseError) {
    switch (err.code) {
      case 'auth/invalid-credential':
      case 'auth/user-not-found':
      case 'auth/wrong-password':
        return 'That email or password is incorrect.'
      case 'auth/invalid-email':
        return 'Enter a valid email address.'
      case 'auth/missing-password':
        return 'Enter your password.'
      case 'auth/user-disabled':
        return 'This account has been disabled.'
      case 'auth/too-many-requests':
        return 'Too many attempts. Please wait a moment and try again.'
      case 'auth/network-request-failed':
        return "We couldn't reach the sign-in service. Check your connection and try again."
      case 'auth/invalid-api-key':
      case 'auth/configuration-not-found':
      case 'auth/operation-not-allowed':
        return 'Sign-in is not available right now. Please try again later.'
      default:
        return `Something went wrong ${action}. Please try again.`
    }
  }
  return `Something went wrong ${action}. Please try again.`
}
