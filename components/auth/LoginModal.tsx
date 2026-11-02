'use client'
import { useCallback, useEffect, useRef, useState } from 'react'
import {
  Alert,
  AlertIcon,
  Box,
  Button,
  Divider,
  FormControl,
  FormLabel,
  HStack,
  IconButton,
  Input,
  InputGroup,
  InputRightElement,
  Modal,
  ModalBody,
  ModalCloseButton,
  ModalContent,
  ModalHeader,
  ModalOverlay,
  Tab,
  TabList,
  TabPanel,
  TabPanels,
  Tabs,
  Text,
  VStack,
} from '@chakra-ui/react'
import { AiohaModal } from '@aioha/react-ui'
import { Providers } from '@aioha/aioha'
import { FiEye, FiEyeOff } from 'react-icons/fi'
import { authenticateWithEmail, loginWithGoogle, resendVerification } from '@/lib/snapie-auth/client'
import { SnapieAuthError } from '@/lib/snapie-auth/types'
import type { SnapieUser } from '@/lib/snapie-auth/types'
import GoogleLoginButton from './GoogleLoginButton'
import AccountSetupPanel from './AccountSetupPanel'
import './login-modal.css'

const AIOHA_MODAL_STYLESHEET_ID = 'aioha-modal-css'

function ensureAiohaModalStylesheet() {
  if (typeof document === 'undefined') return
  if (document.getElementById(AIOHA_MODAL_STYLESHEET_ID)) return
  const link = document.createElement('link')
  link.id = AIOHA_MODAL_STYLESHEET_ID
  link.rel = 'stylesheet'
  link.href = '/aioha-modal.css'
  document.head.appendChild(link)
}

type View = 'providers' | 'email-pending' | 'account-setup' | 'hive-wallet'
type EmailMode = 'login' | 'register'

const EMAIL_ERRORS: Record<string, string> = {
  unauthorized: 'Invalid email or password.',
  invalid_credentials: 'Invalid email or password.',
  email_not_verified: 'Please verify your email before signing in. Check your inbox.',
  insufficient_rc: 'Service temporarily busy — please try again in a moment.',
  password_too_short: 'Passwords must be at least 8 characters.',
  weak_password: 'Passwords must be at least 8 characters.',
}

// Shown when the server told us the chosen tab was wrong and we corrected it.
// Silence would make the app look like it did something arbitrary.
const EMAIL_NOTICES: Record<string, string> = {
  alreadyRegistered: 'That email is already registered — signing you in instead.',
  accountCreated: 'No account found for that email — creating one instead.',
}

interface Props {
  displayed: boolean
  initialView?: 'providers' | 'hive-wallet'
  onSnapieLoginSuccess: (user: SnapieUser) => void
  onAiohaLogin: (result: any) => void
  onClose: () => void
  loginOptions?: any
  forceShowProviders?: Providers[]
}

export default function LoginModal({
  displayed,
  initialView = 'providers',
  onSnapieLoginSuccess,
  onAiohaLogin,
  onClose,
  loginOptions,
  forceShowProviders,
}: Props) {
  const [view, setView] = useState<View>(initialView)
  const [emailMode, setEmailMode] = useState<EmailMode>('register')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')
  const [pendingEmail, setPendingEmail] = useState('')
  const [resending, setResending] = useState(false)
  const [resent, setResent] = useState(false)

  // Reset to requested view whenever the modal reopens.
  useEffect(() => {
    if (displayed) {
      ensureAiohaModalStylesheet()
      setView(initialView)
      setError('')
      setNotice('')
      setEmail('')
      setPassword('')
      setEmailMode('register')
    }
  }, [displayed, initialView])

  const clearError = useCallback(() => {
    setError('')
    setNotice('')
  }, [])

  const handleGoogleCredential = useCallback(
    async (credential: string) => {
      setLoading(true)
      setError('')
      try {
        const user = await loginWithGoogle(credential)
        onSnapieLoginSuccess(user)
        if (!user.hiveUsername) setView('account-setup')
      } catch (e: any) {
        setError(EMAIL_ERRORS[e?.code] ?? 'Google sign-in failed. Please try again.')
      } finally {
        setLoading(false)
      }
    },
    [onSnapieLoginSuccess],
  )

  const handleEmailSubmit = useCallback(async () => {
    if (!email || !password || loading) return
    setLoading(true)
    setError('')
    setNotice('')
    try {
      // emailMode is only a hint — authenticateWithEmail detects whether this
      // is a registration or a sign-in from the server's response.
      const result = await authenticateWithEmail(email, password, emailMode)
      if (result.notice) {
        setNotice(EMAIL_NOTICES[result.notice])
        // Keep the tab in sync with what actually happened.
        setEmailMode(result.outcome === 'signedIn' ? 'login' : 'register')
      }
      if (result.outcome === 'registered') {
        setPendingEmail(email)
        setView('email-pending')
      } else {
        const user = result.user
        onSnapieLoginSuccess(user)
        if (!user.hiveUsername) setView('account-setup')
      }
    } catch (e: any) {
      const code = e?.code ?? ''
      setError(EMAIL_ERRORS[code] ?? 'Something went wrong. Please try again.')
      // A register attempt that turned out to hit an existing account means the
      // user is signing in, not registering — move the tab so a retry is correct.
      if (e?.accountExists) setEmailMode('login')
    } finally {
      setLoading(false)
    }
  }, [email, password, emailMode, onSnapieLoginSuccess, loading])

  const handleResend = useCallback(async () => {
    setResending(true)
    try {
      await resendVerification()
      setResent(true)
    } catch {
      // Silently ignore — user can try again
    } finally {
      setResending(false)
    }
  }, [])

  const handleAccountComplete = useCallback(
    (user: SnapieUser) => {
      onSnapieLoginSuccess(user)
    },
    [onSnapieLoginSuccess],
  )

  const modalTitles: Record<View, string> = {
    providers: 'Welcome to Snapie',
    'email-pending': 'Check your email',
    'account-setup': 'Create your Hive account',
    'hive-wallet': '',
  }

  return (
    <>
      {/* Custom Snapie Auth modal */}
      <Modal
        isOpen={displayed && view !== 'hive-wallet'}
        onClose={onClose}
        isCentered
        motionPreset="slideInBottom"
        size="sm"
      >
        <ModalOverlay backdropFilter="blur(4px)" />
        <ModalContent mx={4}>
          <ModalHeader pb={2}>{modalTitles[view]}</ModalHeader>
          <ModalCloseButton />
          <ModalBody pb={6}>
            {/* ── PROVIDERS VIEW ─────────────────────────────── */}
            {view === 'providers' && (
              <VStack spacing={4} align="stretch">
                <Box display="flex" justifyContent="center">
                  <GoogleLoginButton onCredential={handleGoogleCredential} width={320} />
                </Box>

                <HStack>
                  <Divider />
                  <Text fontSize="xs" color="gray.500" whiteSpace="nowrap" px={2}>
                    or use email
                  </Text>
                  <Divider />
                </HStack>

                <Tabs
                  index={emailMode === 'register' ? 0 : 1}
                  onChange={(i) => { setEmailMode(i === 0 ? 'register' : 'login'); clearError() }}
                  variant="soft-rounded"
                  colorScheme="blue"
                  size="sm"
                >
                  <TabList mb={3}>
                    <Tab flex={1}>Create Account</Tab>
                    <Tab flex={1}>Sign In</Tab>
                  </TabList>

                  <TabPanels>
                    {/* Both panels share the same form fields — rendered once below */}
                    <TabPanel p={0} />
                    <TabPanel p={0} />
                  </TabPanels>
                </Tabs>

                <Text fontSize="xs" color="gray.500" textAlign="center" mt={-1}>
                    Either tab works — we&rsquo;ll sign you in or create your account
                    automatically.
                  </Text>

                <VStack spacing={3} align="stretch">
                  {error && (
                    <Alert status="error" borderRadius="md" py={2}>
                      <AlertIcon />
                      <Text fontSize="sm">{error}</Text>
                    </Alert>
                  )}

                  {notice && (
                    <Alert status="info" borderRadius="md" py={2}>
                      <AlertIcon />
                      <Text fontSize="sm">{notice}</Text>
                    </Alert>
                  )}

                  <FormControl>
                    <FormLabel fontSize="sm">Email</FormLabel>
                    <Input
                      type="email"
                      placeholder="you@example.com"
                      value={email}
                      onChange={(e) => { setEmail(e.target.value); clearError() }}
                      onKeyDown={(e) => { if (e.key === 'Enter') handleEmailSubmit() }}
                      isDisabled={loading}
                      size="md"
                    />
                  </FormControl>

                  <FormControl>
                    <FormLabel fontSize="sm">Password</FormLabel>
                    <InputGroup>
                      <Input
                        type={showPassword ? 'text' : 'password'}
                        placeholder="••••••••"
                        value={password}
                        onChange={(e) => { setPassword(e.target.value); clearError() }}
                        onKeyDown={(e) => { if (e.key === 'Enter') handleEmailSubmit() }}
                        isDisabled={loading}
                        size="md"
                      />
                      <InputRightElement>
                        <IconButton
                          aria-label={showPassword ? 'Hide password' : 'Show password'}
                          icon={showPassword ? <FiEyeOff /> : <FiEye />}
                          size="sm"
                          variant="ghost"
                          onClick={() => setShowPassword((p) => !p)}
                        />
                      </InputRightElement>
                    </InputGroup>
                  </FormControl>

                  <Button
                    colorScheme="blue"
                    onClick={handleEmailSubmit}
                    isLoading={loading}
                    isDisabled={!email || !password || loading}
                    size="md"
                    width="full"
                  >
                    {emailMode === 'register' ? 'Create Account' : 'Sign In'}
                  </Button>
                </VStack>

                <HStack>
                  <Divider />
                  <Text fontSize="xs" color="gray.500" whiteSpace="nowrap" px={2}>
                    already on Hive?
                  </Text>
                  <Divider />
                </HStack>

                <Button
                  variant="outline"
                  size="sm"
                  width="full"
                  onClick={() => setView('hive-wallet')}
                >
                  Sign in with Hive Wallet
                </Button>
              </VStack>
            )}

            {/* ── EMAIL PENDING VIEW ─────────────────────────── */}
            {view === 'email-pending' && (
              <VStack spacing={4} align="stretch">
                {/* Rendered here too: a notice set right before switching to this
                    view (e.g. "creating one instead") would otherwise vanish. */}
                {notice && (
                  <Alert status="info" borderRadius="md" py={2}>
                    <AlertIcon />
                    <Text fontSize="sm">{notice}</Text>
                  </Alert>
                )}

                <Alert status="info" borderRadius="md">
                  <AlertIcon />
                  <Box>
                    <Text fontWeight="semibold" fontSize="sm">
                      Verify your email
                    </Text>
                    <Text fontSize="sm" mt={1}>
                      We sent a verification link to{' '}
                      <Text as="span" fontWeight="semibold">
                        {pendingEmail}
                      </Text>
                      . Click the link to activate your account, then come back and sign in.
                    </Text>
                  </Box>
                </Alert>

                {resent ? (
                  <Text fontSize="sm" color="green.500" textAlign="center">
                    Email resent! Check your inbox.
                  </Text>
                ) : (
                  <Button
                    variant="link"
                    size="sm"
                    colorScheme="blue"
                    onClick={handleResend}
                    isLoading={resending}
                  >
                    Resend verification email
                  </Button>
                )}

                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => { setView('providers'); setEmailMode('login'); setNotice('') }}
                >
                  Back to sign in
                </Button>
              </VStack>
            )}

            {/* ── ACCOUNT SETUP VIEW ─────────────────────────── */}
            {view === 'account-setup' && (
              <AccountSetupPanel onComplete={handleAccountComplete} />
            )}
          </ModalBody>
        </ModalContent>
      </Modal>

      {/* Aioha modal — rendered separately, shown when user chooses Hive wallet */}
      <AiohaModal
        displayed={displayed && view === 'hive-wallet'}
        onLogin={(result: any) => {
          onAiohaLogin(result)
        }}
        onClose={() => setView('providers')}
        loginTitle="Sign in with Hive Wallet"
        loginOptions={loginOptions}
        forceShowProviders={forceShowProviders}
      />
    </>
  )
}
