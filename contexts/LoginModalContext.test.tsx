// @vitest-environment jsdom
import { describe, it, expect, vi, afterEach } from 'vitest'
import { render, screen, fireEvent, cleanup } from '@testing-library/react'
import { LoginModalProvider, useLoginModal } from './LoginModalContext'

vi.mock('@aioha/react-ui', () => ({ useAioha: () => ({ user: null }) }))
vi.mock('@aioha/aioha', () => ({ KeyTypes: { Posting: 'Posting' } }))
vi.mock('@/lib/hive/hiveclient', () => ({ default: {} }))
vi.mock('@/lib/hive/aioha', () => ({ getLoginProviders: () => [], hasStoredAiohaSession: () => false }))
vi.mock('@/contexts/UserContext', () => ({ useHiveUser: () => ({ setHiveUser: vi.fn() }) }))
vi.mock('@/contexts/SnapieAuthContext', () => ({
  useSnapieAuth: () => ({ setSnapieUser: vi.fn(), isSnapieLoggedIn: false }),
}))

// Stand-in for LoginModal: the real Aioha tree emits these anchors even when
// its modal is not displayed. The provider must not mount that tree while closed.
vi.mock('@/components/auth/LoginModal', () => ({
  default: () => (
    <div>
      <a>Keychain</a>
      <a>Peak Vault</a>
      <a>HiveAuth</a>
      <a>Ledger</a>
    </div>
  ),
}))

function Harness() {
  const { openLoginModal, closeLoginModal } = useLoginModal()
  return (
    <div>
      <button type="button" onClick={openLoginModal}>Open login</button>
      <button type="button" onClick={closeLoginModal}>Close login</button>
    </div>
  )
}

afterEach(cleanup)

describe('LoginModalProvider', () => {
  it('mounts wallet links only while login is open, including after reopen', () => {
    render(
      <LoginModalProvider>
        <Harness />
      </LoginModalProvider>,
    )

    expect(screen.queryByText('Keychain')).toBeNull()

    fireEvent.click(screen.getByText('Open login'))
    expect(screen.getByText('Keychain')).toBeTruthy()
    expect(screen.getByText('Peak Vault')).toBeTruthy()
    expect(screen.getByText('HiveAuth')).toBeTruthy()
    expect(screen.getByText('Ledger')).toBeTruthy()

    fireEvent.click(screen.getByText('Close login'))
    expect(screen.queryByText('Keychain')).toBeNull()

    fireEvent.click(screen.getByText('Open login'))
    expect(screen.getByText('Keychain')).toBeTruthy()
    expect(screen.getByText('Ledger')).toBeTruthy()
  })
})
