'use client';
import React, { useState, useEffect } from 'react';
import {
  Box,
  Container,
  Heading,
  Text,
  Spinner,
  Alert,
  AlertIcon,
  Image,
  Flex,
  Icon,
  Grid,
  Button,
  HStack,
  VStack,
  Badge,
  useDisclosure,
} from '@chakra-ui/react';
import { FaGlobe, FaExchangeAlt, FaPiggyBank, FaShoppingCart, FaArrowDown, FaShareAlt, FaDollarSign, FaArrowUp, FaPaperPlane, FaCoins, FaChartLine, FaGift, FaEdit, FaShieldAlt, FaExternalLinkAlt, FaQrcode, FaCamera, FaAward, FaTrophy, FaHistory } from 'react-icons/fa';
import { usePointsSummary } from '@/hooks/usePointsSummary';
import { ITEM_MARKET_FEATURE_FLAG } from '@/lib/points/config';
import { getMyInventory } from '@/lib/points/marketClient';
import type { InventoryEntry } from '@/lib/points/marketService';
import useHiveAccount from '@/hooks/useHiveAccount';
import ProfileCover from '@/components/shared/ProfileCover';
import {
  getProfile,
  convertVestToHive,
  getCryptoPrices,
  transferWithKeychain,
  powerUpWithKeychain,
  powerDownWithKeychain,
  delegateWithKeychain,
  broadcastWithKeychain,
  getHiveHbdTicker,
  getHiveHbdMarketQuote,
  swapHiveHbdWithSlippage,
  claimRewardsWithKeychain,
  claimHbdSavingsInterest,
  type SwapDirection,
} from '@/lib/hive/client-functions';
import EditProfileModal from '@/components/wallet/EditProfileModal';
import { useHbdSavingsInterest } from '@/hooks/useHbdSavingsInterest';
import { refreshAfterClaim, syncUnclaimedRewardsFromAccount } from '@/hooks/useUnclaimedRewards';
import { extractNumber } from '@/lib/utils/extractNumber';
import WalletModal from '@/components/wallet/WalletModal';
import PointsHistoryModal from '@/components/wallet/PointsHistoryModal';
import WalletTermInfo from '@/components/wallet/WalletTermInfo';
import TransactionHistory from '@/components/wallet/TransactionHistory';
import { useRouter, useSearchParams } from 'next/navigation';
import { useCurrentUser } from '@/hooks/useCurrentUser';
import { Avatar } from '@/components/shared/Avatar';
import { MoodBadgeIcon } from '@/components/shared/MoodBadgeIcon';
import { useMoodBadges } from '@/hooks/useMoodBadges';
import { useSnapieAuth } from '@/contexts/SnapieAuthContext';
import { useLoginModal } from '@/contexts/LoginModalContext';
import dynamic from 'next/dynamic';
import { currencyFromAmount, valueFromAmount, type HiveTransferQRData } from '@/lib/hive/qr-utils';

const QRRequestSheet = dynamic(() => import('@/components/wallet/QRRequestSheet'), { ssr: false });
const QRScanSheet = dynamic(() => import('@/components/wallet/QRScanSheet'), { ssr: false });
const PaymentRequestBanner = dynamic(() => import('@/components/wallet/PaymentRequestBanner'), { ssr: false });

interface WalletPageProps {
  username: string;
}

interface WalletModalContent {
  title: string;
  description?: string;
  showMemoField?: boolean;
  showUsernameField?: boolean;
  swapDirection?: SwapDirection;
  initialTo?: string;
  initialAmount?: number;
  initialMemo?: string;
  maxAmount?: number;
  maxLabel?: string;
}

export default function WalletPage({ username }: WalletPageProps) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { username: user, isLoggedIn } = useCurrentUser();
  const { openLoginModal } = useLoginModal();
  const { snapieUser } = useSnapieAuth();

  // Payment request from shared link (?pay=1&amount=X&memo=Y)
  const [payRequest, setPayRequest] = useState<{ amount: string; memo: string } | null>(null);
  const [pendingLoginThenPay, setPendingLoginThenPay] = useState(false);
  const { hiveAccount, isLoading, error, refetch } = useHiveAccount(username);
  const { isOpen, onOpen, onClose } = useDisclosure();
  const { isOpen: isEditOpen, onOpen: onEditOpen, onClose: onEditClose } = useDisclosure();
  const { isOpen: isQRRequestOpen, onOpen: onQRRequestOpen, onClose: onQRRequestClose } = useDisclosure();
  const { isOpen: isQRScanOpen, onOpen: onQRScanOpen, onClose: onQRScanClose } = useDisclosure();
  const { isOpen: isPointsHistoryOpen, onOpen: onPointsHistoryOpen, onClose: onPointsHistoryClose } = useDisclosure();

  const [prices, setPrices] = useState<{ hive: number; hbd: number } | null>(null);
  const [profileMetadata, setProfileMetadata] = useState<{ profileImage: string; coverImage: string; website: string; name: string; about: string; location: string }>({
    profileImage: '',
    coverImage: '',
    website: '',
    name: '',
    about: '',
    location: '',
  });
  const [profileInfo, setProfileInfo] = useState<any>(null);
  const [modalContent, setModalContent] = useState<WalletModalContent | null>(null);
  const [hivePower, setHivePower] = useState<string | undefined>(undefined);
  const [swapPrice, setSwapPrice] = useState<number | null>(null);
  const [swapQuote, setSwapQuote] = useState<{ highestBid: number; lowestAsk: number; latest: number } | null>(null);
  const [isClaiming, setIsClaiming] = useState(false);
  const [isClaimingInterest, setIsClaimingInterest] = useState(false);
  const { pendingInterest, annualRatePct, isLoading: isInterestLoading } = useHbdSavingsInterest(hiveAccount);
  // Ground-truth sync for the pending-rewards banner: this page fetches reward
  // balances independently of the shared useUnclaimedRewards cache the banner
  // reads from, so a claim made elsewhere (another device/app) never reaches
  // that cache on its own — it only updates on a 5-minute poll. Feed this
  // page's fetch back into the shared cache whenever we're looking at our own
  // wallet (never someone else's profile) so the banner clears immediately.
  useEffect(() => {
    if (!hiveAccount || !isLoggedIn || !user || username !== user) return;
    syncUnclaimedRewardsFromAccount(user, hiveAccount);
  }, [hiveAccount, isLoggedIn, user, username]);
  // Called unconditionally here, before any early returns below (loading/error
  // states) — a Hooks-order bug bit this exact page once already: putting this
  // call after those early returns meant it fired on some renders and not
  // others, which React's Rules of Hooks correctly treats as a crash.
  const pointsSummary = usePointsSummary(username);
  const { getEquippedBadge } = useMoodBadges();

  // Own-wallet-only, same reasoning as pointsSummary above re: hook order —
  // called unconditionally, gated inside the effect body instead.
  const [inventory, setInventory] = useState<InventoryEntry[]>([]);
  useEffect(() => {
    if (!ITEM_MARKET_FEATURE_FLAG || user !== username) { setInventory([]); return; }
    getMyInventory(username).then(setInventory);
  }, [user, username]);

  const textMuted = 'overlay.500';
  const successColor = 'success';
  const accentColor = 'accent';

  useEffect(() => {
    const empty = { profileImage: '', coverImage: '', website: '', name: '', about: '', location: '' };
    const raw = hiveAccount?.posting_json_metadata;
    if (!raw) { setProfileMetadata(empty); return; }
    try {
      const parsedMetadata = JSON.parse(raw);
      const profile = parsedMetadata?.profile || {};
      setProfileMetadata({
        profileImage: profile.profile_image || '',
        coverImage: profile.cover_image || '',
        website: profile.website || '',
        name: profile.name || '',
        about: profile.about || '',
        location: profile.location || '',
      });
    } catch (err) {
      console.error('Failed to parse profile metadata', err);
      setProfileMetadata(empty);
    }
  }, [hiveAccount?.posting_json_metadata]);

  useEffect(() => {
    const fetchProfileInfo = async () => {
      try {
        const profileData = await getProfile(username);
        setProfileInfo(profileData);
      } catch (err) {
        console.error('Failed to fetch profile info', err);
      }
    };
    if (username) fetchProfileInfo();
  }, [username]);

  useEffect(() => {
    const fetchHivePower = async () => {
      if (hiveAccount?.vesting_shares) {
        try {
          const power = (await convertVestToHive(Number(extractNumber(String(hiveAccount.vesting_shares))))).toFixed(3);
          setHivePower(power.toString());
        } catch (err) {
          console.error('Failed to convert vesting shares to Hive power', err);
        }
      }
    };
    fetchHivePower();
  }, [hiveAccount?.vesting_shares]);

  useEffect(() => {
    const fetchPrices = async () => {
      try {
        const priceData = await getCryptoPrices();
        setPrices(priceData);
      } catch (err) {
        console.error('Failed to fetch crypto prices', err);
      }
    };
    fetchPrices();
    const interval = setInterval(fetchPrices, 5 * 60 * 1000);
    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    const fetchSwapPrice = async () => {
      try {
        const [ticker, marketQuote] = await Promise.all([
          getHiveHbdTicker(),
          getHiveHbdMarketQuote(),
        ]);
        setSwapPrice(ticker);
        setSwapQuote(marketQuote);
      } catch (err) {
        console.error('Failed to fetch HIVE/HBD ticker', err);
      }
    };
    fetchSwapPrice();
    const interval = setInterval(fetchSwapPrice, 60 * 1000);
    return () => clearInterval(interval);
  }, []);

  const handleModalOpen = (content: WalletModalContent) => {
    setModalContent(content);
    onOpen();
  };

  function handleQRScan(data: HiveTransferQRData) {
    const currency = currencyFromAmount(data.amount);
    handleModalOpen({
      title: `Send ${currency}`,
      description: `Scanned from QR — review and confirm before sending.`,
      showMemoField: true,
      showUsernameField: true,
      initialTo: data.to,
      initialAmount: valueFromAmount(data.amount),
      initialMemo: data.memo,
      maxAmount: parseFloat(currency === 'HIVE' ? balance : hbdBalance),
      maxLabel: currency,
    });
  }

  function openPayModal(amount: string, memo: string) {
    const currency = currencyFromAmount(amount);
    handleModalOpen({
      title: `Send ${currency}`,
      description: 'Payment request — review and confirm before sending.',
      showMemoField: true,
      showUsernameField: true,
      initialTo: username,
      initialAmount: valueFromAmount(amount),
      initialMemo: memo,
      maxAmount: parseFloat(currency === 'HIVE' ? balance : hbdBalance),
      maxLabel: currency,
    });
  }

  // On mount: detect ?pay=1 link, store request, clean URL, fire modal or queue login
  useEffect(() => {
    if (searchParams.get('pay') !== '1') return;
    const amount = searchParams.get('amount') ?? '';
    const memo = searchParams.get('memo') ?? '';
    if (!amount) return;

    setPayRequest({ amount, memo });
    router.replace(`/@${username}/wallet`);

    if (isLoggedIn) {
      setTimeout(() => openPayModal(amount, memo), 400);
    } else {
      setPendingLoginThenPay(true);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // After login: fire the queued payment modal
  useEffect(() => {
    if (!isLoggedIn || !pendingLoginThenPay || !payRequest) return;
    setPendingLoginThenPay(false);
    openPayModal(payRequest.amount, payRequest.memo);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isLoggedIn]);

  const executableSwapPrice = modalContent?.swapDirection
    ? (modalContent.swapDirection === 'HIVE_TO_HBD'
      ? (swapQuote?.highestBid || swapQuote?.latest || swapPrice || 0)
      : (swapQuote?.lowestAsk || swapQuote?.latest || swapPrice || 0))
    : swapPrice || 0;

  async function handleConfirm(amount: number, username?: string, memo?: string, swapDirection?: SwapDirection, slippagePercent?: number) {
    if (!modalContent || !user) return;
    try {
      switch (modalContent.title) {
        case 'Send HIVE':
          if (username) await transferWithKeychain(user, username, amount.toFixed(3), memo || '', 'HIVE');
          break;
        case 'Power Up':
          await powerUpWithKeychain(user, amount);
          break;
        case 'Convert HBD → HIVE':
          await broadcastWithKeychain(user, [["convert", { "owner": user, "requestid": Math.floor(1000000000 + Math.random() * 9000000000), "amount": { "amount": amount.toFixed(3), "precision": 3, "nai": "@@000000013" } }]], 'active');
          break;
        case 'Swap HIVE':
        case 'Swap HBD': {
          if (!swapDirection) throw new Error('Swap direction is required.');
          if (!swapPrice) throw new Error('Market price unavailable.');
          await swapHiveHbdWithSlippage({
            username: user,
            direction: swapDirection,
            amount,
            slippagePercent: slippagePercent ?? 0.5,
          });
          break;
        }
        case 'HIVE Savings':
          await broadcastWithKeychain(user, [["transfer_to_savings", { "from": user, "to": user, "amount": amount.toFixed(3) + " HIVE", "memo": memo || "" }]], 'active');
          break;
        case 'Power Down':
          await powerDownWithKeychain(user, amount);
          break;
        case 'Delegate':
          if (username) await delegateWithKeychain(user, username, amount);
          break;
        case 'Send HBD':
          if (username) await transferWithKeychain(user, username, amount.toFixed(3), memo || '', 'HBD');
          break;
        case 'HBD Savings':
          await broadcastWithKeychain(user, [["transfer_to_savings", { "from": user, "to": user, "amount": amount.toFixed(3) + " HBD", "memo": memo || "" }]], 'active');
          break;
        case 'Withdraw HBD Savings':
          await broadcastWithKeychain(user, [["transfer_from_savings", { "from": user, "to": user, "request_id": Math.floor(1000000000 + Math.random() * 9000000000), "amount": amount.toFixed(3) + " HBD", "memo": memo || "" }]], 'active');
          break;
        case 'Withdraw HIVE Savings':
          await broadcastWithKeychain(user, [["transfer_from_savings", { "from": user, "to": user, "request_id": Math.floor(1000000000 + Math.random() * 9000000000), "amount": amount.toFixed(3) + " HIVE", "memo": memo || "" }]], 'active');
          break;
        default:
          console.log('Default action - Amount:', amount, 'Memo:', memo);
      }
    } catch (error) {
      console.error('Transaction failed:', error);
    }
    onClose();
    setTimeout(refetch, 3500);
  }

  const followers = profileInfo?.stats?.followers || 0;
  const following = profileInfo?.stats?.following || 0;
  const location = profileInfo?.metadata?.profile?.location || '';

  if (isLoading || !hiveAccount) {
    return (
      <Box display="flex" justifyContent="center" alignItems="center" height="100vh">
        <Spinner size="xl" color="primary" />
      </Box>
    );
  }

  if (error) {
    return (
      <Box display="flex" justifyContent="center" alignItems="center" height="100vh">
        <Alert status="error" borderRadius="md" variant="solid">
          <AlertIcon />
          {error}
        </Alert>
      </Box>
    );
  }

  const rewardHive = String(hiveAccount?.reward_hive_balance ?? '0.000 HIVE');
  const rewardHbd = String(hiveAccount?.reward_hbd_balance ?? '0.000 HBD');
  const rewardVests = String(hiveAccount?.reward_vesting_balance ?? '0.000000 VESTS');
  const rewardHiveNum = extractNumber(rewardHive);
  const rewardHbdNum = extractNumber(rewardHbd);
  const rewardVestsNum = extractNumber(rewardVests);
  const rewardVestingHiveNum = extractNumber(String(hiveAccount?.reward_vesting_hive ?? '0.000 HIVE'));
  const hasPendingRewards = rewardHiveNum > 0 || rewardHbdNum > 0 || rewardVestsNum > 0;

  async function handleClaimRewards() {
    if (!user || !hasPendingRewards) return;
    setIsClaiming(true);
    try {
      const result = await claimRewardsWithKeychain(user, rewardHive, rewardHbd, rewardVests);
      if (!result.success) {
        console.error('Claim rewards failed:', result.error);
        return;
      }
      // Broadcast success just means the node accepted it — wait for the
      // claim to actually land in a block before trusting a refetch.
      await refreshAfterClaim(user);
      refetch();
    } catch (err) {
      console.error('Claim rewards failed:', err);
    } finally {
      setIsClaiming(false);
    }
  }

  const balance = hiveAccount?.balance ? String(extractNumber(String(hiveAccount.balance))) : '0.000';
  const hbdBalance = hiveAccount?.hbd_balance ? String(extractNumber(String(hiveAccount.hbd_balance))) : '0.000';
  const savingsBalance = hiveAccount?.savings_balance ? String(extractNumber(String(hiveAccount.savings_balance))) : '0.000';
  const hbdSavingsBalance = hiveAccount?.savings_hbd_balance ? String(extractNumber(String(hiveAccount.savings_hbd_balance))) : '0.000';
  const isOwnWallet = user === username;

  // Hive Power arrives after the account and prices, so a total before then
  // would be missing it. Show a placeholder until every part is in.
  const totalUSD = prices && hivePower !== undefined
    ? (parseFloat(balance) * prices.hive) +
      (parseFloat(hbdBalance) * prices.hbd) +
      (parseFloat(hivePower || '0') * prices.hive) +
      (parseFloat(savingsBalance) * prices.hive) +
      (parseFloat(hbdSavingsBalance) * prices.hbd)
    : null;

  return (
    <Box color="text" maxW="container.lg" mx="auto" w="100%" overflowX="hidden">
      {/* Payment request banner — shown when page is opened via a payment link */}
      {payRequest && (
        <PaymentRequestBanner
          to={username}
          amount={payRequest.amount}
          memo={payRequest.memo}
          isLoggedIn={isLoggedIn}
          onPay={() => openPayModal(payRequest.amount, payRequest.memo)}
          onLoginToPay={() => {
            setPendingLoginThenPay(true);
            openLoginModal();
          }}
          onDismiss={() => setPayRequest(null)}
        />
      )}

      {/* Profile Header */}
      <Box position="relative" height="200px" borderTopRadius="xl" overflow="hidden">
        <ProfileCover
          url={profileMetadata.coverImage}
          alt={`${hiveAccount?.name} cover`}
          fallback={<Box width="100%" height="100%" />}
        />
      </Box>

      <Flex
        position="relative"
        mt={-16}
        p={4}
        boxShadow="lg"
        borderBottomRadius="xl"
        direction={{ base: 'column', md: 'row' }}
        alignItems={{ base: 'flex-start', md: 'center' }}
        justifyContent={{ base: 'flex-start', md: 'space-between' }}
        gap={3}
      >
        <Box
          position="absolute"
          top={0} left={0} right={0} bottom={0}
          bg="muted"
          opacity={0.92}
          zIndex={1}
          backdropFilter="blur(12px)"
          borderBottomRadius="xl"
        />

        {/* Avatar + info */}
        <Flex alignItems="center" zIndex={2} position="relative" overflow="hidden">
          <Avatar
            username={username}
            size={{ base: '72px', md: '100px' }}
            flexShrink={0}
            sx={{
              marginRight: '16px',
              border: '2px solid',
              borderColor: 'primary',
              boxShadow: '0 0 18px rgba(28, 161, 241, 0.25)',
            }}
            overlay={
              getEquippedBadge(username)
                ? <MoodBadgeIcon sku={getEquippedBadge(username)!} username={username} size="40px" />
                : undefined
            }
          />
          <Box overflow="hidden">
            <Flex alignItems="center" gap={2} flexWrap="wrap">
              <Heading as="h2" size={{ base: 'md', md: 'lg' }} color="primary" noOfLines={1}>
                {profileInfo?.metadata?.profile?.name || username}
              </Heading>
              <Badge colorScheme="purple" fontSize="xs" borderRadius="full" px={2} flexShrink={0}>
                {profileInfo?.reputation ? Math.round(profileInfo.reputation) : 0}
              </Badge>
            </Flex>
            <Text fontSize="xs" color="text" mt={1} opacity={0.7} noOfLines={1}>
              {following} following · {followers} followers {location && `· ${location}`}
            </Text>
            {profileMetadata.website.trim().replace(/^https?:\/\//i, '').trim() && (
              <Flex alignItems="center" mt={1} gap={1}>
                <Icon as={FaGlobe} w={3} h={3} color="primary" onClick={() => window.open(profileMetadata.website, '_blank')} style={{ cursor: 'pointer' }} />
                <Text fontSize="xs" color="primary" noOfLines={1}>{profileMetadata.website}</Text>
              </Flex>
            )}
          </Box>
        </Flex>

        {/* Actions */}
        <HStack zIndex={2} position="relative" spacing={2} flexShrink={0} flexWrap="wrap">
          {isOwnWallet && (
            <Button
              size="sm"
              variant="ghost"
              leftIcon={<Icon as={FaEdit} boxSize={3} />}
              onClick={onEditOpen}
              color="overlay.500"
              _hover={{ color: 'primary', bg: 'rgba(24,168,255,0.08)' }}
              borderRadius="full"
              px={3}
            >
              Edit Profile
            </Button>
          )}
          {/* Mobile-only QR actions */}
          {isOwnWallet && (
            <HStack display={{ base: 'flex', md: 'none' }} spacing={2}>
              <Button
                size="sm"
                leftIcon={<Icon as={FaQrcode} boxSize={3} />}
                onClick={onQRRequestOpen}
                bgGradient="linear(135deg, #18a8ff, #66e4ff)"
                color="white"
                borderRadius="full"
                px={3}
                boxShadow="0 2px 12px rgba(24,168,255,0.35)"
                _hover={{ opacity: 0.88 }}
                _active={{ transform: 'scale(0.96)' }}
              >
                Request
              </Button>
              <Button
                size="sm"
                leftIcon={<Icon as={FaCamera} boxSize={3} />}
                onClick={onQRScanOpen}
                variant="outline"
                borderColor="cyan.400"
                color="cyan.300"
                borderRadius="full"
                px={3}
                _hover={{ bg: 'rgba(102,228,255,0.08)' }}
                _active={{ transform: 'scale(0.96)' }}
              >
                Scan &amp; Pay
              </Button>
            </HStack>
          )}
          <Flex
            alignItems="center" gap={2}
            bg="rgba(28, 161, 241, 0.1)"
            border="1px solid" borderColor="rgba(28, 161, 241, 0.3)"
            borderRadius="full" px={4} py={2}
          >
            <Icon as={FaCoins} color="primary" boxSize={4} />
            <Text fontSize="sm" fontWeight="bold" color="primary">Wallet</Text>
          </Flex>
        </HStack>
      </Flex>

      {/* Wallet Content */}
      <Container maxW="container.lg" mt={8}>

        {/* Pending Rewards — the section people open the wallet to act on,
            ahead of even the account value hero. */}
        {(hasPendingRewards || isOwnWallet) && (
          <Box
            mb={6}
            bg="muted" borderRadius="10px" boxShadow="md" overflow="hidden"
            sx={{ border: '1px solid rgba(255, 200, 80, 0.25)', borderLeft: '3px solid #f6c90e' }}
          >
            <Flex justifyContent="space-between" alignItems="center" p={5} pb={isOwnWallet ? 3 : 5}>
              <Flex alignItems="center" gap={3}>
                <Flex w={10} h={10} borderRadius="full" bg="rgba(246, 201, 14, 0.12)" border="1px solid" borderColor="rgba(246, 201, 14, 0.3)" alignItems="center" justifyContent="center">
                  <Icon as={FaGift} color="yellow.400" boxSize={4} />
                </Flex>
                <Box>
                  <Heading size="md">Pending Rewards</Heading>
                  <Text fontSize="xs" color={textMuted}>Unclaimed author &amp; curation rewards</Text>
                </Box>
              </Flex>
              {!hasPendingRewards && (
                <Text fontSize="sm" color={textMuted}>No pending rewards</Text>
              )}
            </Flex>

            {hasPendingRewards && (
              <Grid templateColumns={{ base: '1fr', md: 'repeat(3, 1fr)' }} gap={3} px={5} pb={isOwnWallet ? 3 : 5}>
                {rewardHiveNum > 0 && (
                  <Box p={3} bg="rgba(246, 201, 14, 0.05)" borderRadius="10px" border="1px solid rgba(246, 201, 14, 0.15)">
                    <Text fontSize="xs" color={textMuted} textTransform="uppercase" letterSpacing="wide" mb={1}>HIVE</Text>
                    <Text fontSize="lg" fontWeight="bold">{rewardHiveNum.toFixed(3)}</Text>
                    {prices && <Text fontSize="xs" color={textMuted}>≈ ${(rewardHiveNum * prices.hive).toFixed(2)}</Text>}
                  </Box>
                )}
                {rewardHbdNum > 0 && (
                  <Box p={3} bg="rgba(246, 201, 14, 0.05)" borderRadius="10px" border="1px solid rgba(246, 201, 14, 0.15)">
                    <Text fontSize="xs" color={textMuted} textTransform="uppercase" letterSpacing="wide" mb={1}>HBD</Text>
                    <Text fontSize="lg" fontWeight="bold">{rewardHbdNum.toFixed(3)}</Text>
                    {prices && <Text fontSize="xs" color={textMuted}>≈ ${(rewardHbdNum * prices.hbd).toFixed(2)}</Text>}
                  </Box>
                )}
                {rewardVestsNum > 0 && (
                  <Box p={3} bg="rgba(246, 201, 14, 0.05)" borderRadius="10px" border="1px solid rgba(246, 201, 14, 0.15)">
                    <Text fontSize="xs" color={textMuted} textTransform="uppercase" letterSpacing="wide" mb={1}>HP</Text>
                    <Text fontSize="lg" fontWeight="bold">{rewardVestingHiveNum.toFixed(3)}</Text>
                    {prices && <Text fontSize="xs" color={textMuted}>≈ ${(rewardVestingHiveNum * prices.hive).toFixed(2)}</Text>}
                  </Box>
                )}
              </Grid>
            )}

            {isOwnWallet && hasPendingRewards && (
              <Flex px={5} pb={4}>
                <Button
                  size="sm"
                  leftIcon={<FaGift />}
                  colorScheme="yellow"
                  variant="outline"
                  isLoading={isClaiming}
                  loadingText="Claiming..."
                  onClick={handleClaimRewards}
                >
                  Claim Rewards
                </Button>
              </Flex>
            )}
          </Box>
        )}

        {/* Estimated Account Value Hero */}
        {prices && (
          <Box
            bg="muted"
            p={7}
            borderRadius="10px"
            border="tb1"
            boxShadow="lg"
            mb={6}
            position="relative"
            overflow="hidden"
          >
            <Box
              position="absolute" top="-50px" right="-50px"
              w="180px" h="180px" borderRadius="full"
              bg="rgba(28, 161, 241, 0.07)" filter="blur(50px)"
              pointerEvents="none"
            />
            <Box
              position="absolute" bottom="-30px" left="30%"
              w="140px" h="140px" borderRadius="full"
              bg="rgba(66, 231, 162, 0.05)" filter="blur(40px)"
              pointerEvents="none"
            />

            <Flex justifyContent="space-between" alignItems="center" position="relative" flexWrap="wrap" gap={4}>
              <Box>
                <Text fontSize="xs" color={textMuted} textTransform="uppercase" letterSpacing="widest" mb={2}>
                  Estimated Account Value
                </Text>
                <Heading
                  fontSize={{ base: '3xl', md: '5xl' }}
                  color={successColor}
                  letterSpacing="-0.02em"
                  lineHeight={1}
                  mb={2}
                >
                  {totalUSD === null ? '—' : `$${totalUSD.toFixed(2)}`}
                </Heading>
                <Text fontSize="xs" color={textMuted}>USD equivalent across all holdings</Text>
              </Box>

              <VStack align="flex-end" spacing={3}>
                <HStack spacing={2}>
                  <Box w="8px" h="8px" borderRadius="full" bg="primary" boxShadow="0 0 8px rgba(28, 161, 241, 0.7)" />
                  <VStack spacing={0} align="flex-end">
                    <Text fontSize="xs" color={textMuted}>HIVE</Text>
                    <Text fontSize="sm" fontWeight="bold">${prices.hive.toFixed(3)}</Text>
                  </VStack>
                </HStack>
                <HStack spacing={2}>
                  <Box w="8px" h="8px" borderRadius="full" bg={successColor} boxShadow="0 0 8px rgba(66, 231, 162, 0.7)" />
                  <VStack spacing={0} align="flex-end">
                    <Text fontSize="xs" color={textMuted}>HBD</Text>
                    <Text fontSize="sm" fontWeight="bold">${prices.hbd.toFixed(3)}</Text>
                  </VStack>
                </HStack>
              </VStack>
            </Flex>
          </Box>
        )}

        {/* Summary Stats */}
        <Grid templateColumns={{ base: '1fr', md: 'repeat(3, 1fr)' }} gap={4} mb={8}>
          <Box bg="muted" borderRadius="10px" border="tb1" boxShadow="md" overflow="hidden">
            <Box h="3px" bgGradient="linear(90deg, primary, accent)" />
            <Box p={5}>
              <Flex alignItems="center" gap={3} mb={3}>
                <Flex w={9} h={9} borderRadius="full" bg="rgba(28, 161, 241, 0.12)" border="1px solid" borderColor="rgba(28, 161, 241, 0.25)" alignItems="center" justifyContent="center">
                  <Icon as={FaCoins} color="primary" boxSize={4} />
                </Flex>
                <Flex alignItems="center" gap={1}>
                  <Text fontSize="sm" color={textMuted} fontWeight="semibold">Total HIVE</Text>
                  <WalletTermInfo term="liquidHive" />
                </Flex>
              </Flex>
              <Text fontSize="2xl" fontWeight="bold" color="primary" mb={0.5}>{balance}</Text>
              <Text fontSize="xs" color={textMuted}>
                {prices ? `≈ $${(parseFloat(balance) * prices.hive).toFixed(2)} USD` : 'Liquid Balance'}
              </Text>
            </Box>
          </Box>

          <Box bg="muted" borderRadius="10px" border="tb1" boxShadow="md" overflow="hidden">
            <Box h="3px" bgGradient="linear(90deg, accent, primary)" />
            <Box p={5}>
              <Flex alignItems="center" gap={3} mb={3}>
                <Flex w={9} h={9} borderRadius="full" bg="rgba(28, 161, 241, 0.12)" border="1px solid" borderColor="rgba(28, 161, 241, 0.25)" alignItems="center" justifyContent="center">
                  <Icon as={FaChartLine} color={accentColor} boxSize={4} />
                </Flex>
                <Flex alignItems="center" gap={1}>
                  <Text fontSize="sm" color={textMuted} fontWeight="semibold">Hive Power</Text>
                  <WalletTermInfo term="hivePower" />
                </Flex>
              </Flex>
              <Text fontSize="2xl" fontWeight="bold" color={accentColor} mb={0.5}>{hivePower || '...'}</Text>
              <Text fontSize="xs" color={textMuted}>
                {prices && hivePower ? `≈ $${(parseFloat(hivePower) * prices.hive).toFixed(2)} USD` : 'Staked Power'}
              </Text>
            </Box>
          </Box>

          <Box bg="muted" borderRadius="10px" border="tb1" boxShadow="md" overflow="hidden">
            <Box h="3px" bgGradient="linear(90deg, success, primary)" />
            <Box p={5}>
              <Flex alignItems="center" gap={3} mb={3}>
                <Flex w={9} h={9} borderRadius="full" bg="rgba(66, 231, 162, 0.12)" border="1px solid" borderColor="rgba(66, 231, 162, 0.25)" alignItems="center" justifyContent="center">
                  <Icon as={FaDollarSign} color={successColor} boxSize={4} />
                </Flex>
                <Flex alignItems="center" gap={1}>
                  <Text fontSize="sm" color={textMuted} fontWeight="semibold">HBD Balance</Text>
                  <WalletTermInfo term="hbd" />
                </Flex>
              </Flex>
              <Text fontSize="2xl" fontWeight="bold" color={successColor} mb={0.5}>{hbdBalance}</Text>
              <Text fontSize="xs" color={textMuted}>
                {prices ? `≈ $${(parseFloat(hbdBalance) * prices.hbd).toFixed(2)} USD` : 'Stable Coin'}
              </Text>
            </Box>
          </Box>
        </Grid>

        {/* Detailed Wallet Sections */}
        <VStack spacing={4} align="stretch">

          {/* Custodial Account Notice */}
          {isOwnWallet && snapieUser?.custodyMode === 'custodial' && (
            <Box
              bg="muted" borderRadius="10px" boxShadow="md" overflow="hidden"
              sx={{ border: '1px solid rgba(167, 139, 250, 0.25)', borderLeft: '3px solid #a78bfa' }}
            >
              <Box p={5}>
                <Flex alignItems="flex-start" gap={4}>
                  <Flex
                    w={10} h={10} borderRadius="full" flexShrink={0}
                    bg="rgba(167, 139, 250, 0.12)" border="1px solid" borderColor="rgba(167, 139, 250, 0.25)"
                    alignItems="center" justifyContent="center"
                  >
                    <Icon as={FaShieldAlt} color="purple.300" boxSize={4} />
                  </Flex>
                  <Box flex={1}>
                    <Flex alignItems="center" gap={2} mb={2}>
                      <Heading size="sm" color="purple.300">Custodial Account</Heading>
                      <Badge colorScheme="purple" fontSize="xs" borderRadius="full" px={2} variant="subtle">
                        Snapie Managed
                      </Badge>
                    </Flex>
                    <Text fontSize="sm" color={textMuted} mb={2}>
                      Snapie securely holds your account keys on your behalf, so you can use Hive without managing a wallet yourself. Your HIVE is always yours — Snapie simply signs transactions when you take action.
                    </Text>
                    <Text fontSize="sm" color={textMuted} mb={4}>
                      You can take full ownership of your keys at any time by <Text as="span" color="purple.300" fontWeight="semibold">emancipating</Text> your account. Once emancipated, you manage your own wallet and Snapie no longer has access to your keys.
                    </Text>
                    <Button
                      as="a"
                      href="https://auth.snapie.io"
                      target="_blank"
                      rel="noopener noreferrer"
                      size="sm"
                      variant="outline"
                      colorScheme="purple"
                      rightIcon={<Icon as={FaExternalLinkAlt} boxSize={3} />}
                    >
                      Emancipate at auth.snapie.io
                    </Button>
                  </Box>
                </Flex>
              </Box>
            </Box>
          )}

          {/* HIVE */}
          <Box
            bg="muted" borderRadius="10px" boxShadow="md" overflow="hidden"
            sx={{ border: '1px solid rgba(28, 161, 241, 0.18)', borderLeft: '3px solid var(--chakra-colors-primary)' }}
          >
            <Flex justifyContent="space-between" alignItems="center" p={5} pb={isOwnWallet ? 3 : 5}>
              <Flex alignItems="center" gap={3}>
                <Flex w={10} h={10} borderRadius="full" bg="rgba(28, 161, 241, 0.12)" border="1px solid" borderColor="rgba(28, 161, 241, 0.25)" alignItems="center" justifyContent="center">
                  <Icon as={FaCoins} color="primary" boxSize={4} />
                </Flex>
                <Box>
                  <Heading size="md">HIVE</Heading>
                  <Text fontSize="xs" color={textMuted}>Liquid balance</Text>
                </Box>
              </Flex>
              <Box textAlign="right" flexShrink={0}>
                <Text fontSize={{ base: 'lg', md: '2xl' }} fontWeight="bold">{balance}</Text>
                {prices && <Text fontSize="xs" color={textMuted}>≈ ${(parseFloat(balance) * prices.hive).toFixed(2)}</Text>}
              </Box>
            </Flex>
            {isOwnWallet && (
              <Flex gap={2} flexWrap="wrap" px={5} pb={4}>
                <Button size="sm" leftIcon={<FaPaperPlane />} onClick={() => handleModalOpen({ title: 'Send HIVE', description: 'Send Hive to another account', showMemoField: true, showUsernameField: true, maxAmount: parseFloat(balance), maxLabel: 'HIVE' })} variant="outline" colorScheme="blue">Send</Button>
                <Button size="sm" leftIcon={<FaArrowUp />} onClick={() => handleModalOpen({ title: 'Power Up', description: 'Power Up your HIVE to HP', maxAmount: parseFloat(balance), maxLabel: 'HIVE' })} variant="outline" colorScheme="purple">Power Up</Button>
                <Flex align="center" gap="1px">
                  <Button size="sm" leftIcon={<FaExchangeAlt />} onClick={() => handleModalOpen({ title: 'Convert HBD → HIVE', description: 'Burn HBD to receive HIVE at a 3.5-day average price', maxAmount: parseFloat(hbdBalance), maxLabel: 'HBD' })} variant="outline" colorScheme="orange">Convert</Button>
                  <WalletTermInfo term="convert" />
                </Flex>
                <Flex align="center" gap="1px">
                  <Button size="sm" leftIcon={<FaExchangeAlt />} onClick={() => handleModalOpen({ title: 'Swap HIVE', description: 'Fast market swap HIVE -> HBD (immediate-or-cancel)', swapDirection: 'HIVE_TO_HBD', maxAmount: parseFloat(balance), maxLabel: 'HIVE' })} variant="outline" colorScheme="yellow">Swap</Button>
                  <WalletTermInfo term="swap" />
                </Flex>
                <Button size="sm" leftIcon={<FaPiggyBank />} onClick={() => handleModalOpen({ title: 'HIVE Savings', description: 'Transfer to HIVE savings', maxAmount: parseFloat(balance), maxLabel: 'HIVE' })} variant="outline" colorScheme="teal">To Savings</Button>
                <Button
                  size="sm"
                  leftIcon={<FaShoppingCart />}
                  variant="outline"
                  colorScheme="green"
                  isDisabled
                  title="Coming soon"
                >
                  Buy HIVE (Coming soon)
                </Button>
              </Flex>
            )}
          </Box>

          {/* Hive Power */}
          <Box
            bg="muted" borderRadius="10px" boxShadow="md" overflow="hidden"
            sx={{ border: '1px solid rgba(28, 161, 241, 0.18)', borderLeft: '3px solid var(--chakra-colors-accent)' }}
          >
            <Flex justifyContent="space-between" alignItems="center" p={5} pb={isOwnWallet ? 3 : 5}>
              <Flex alignItems="center" gap={3}>
                <Flex w={10} h={10} borderRadius="full" bg="rgba(28, 161, 241, 0.12)" border="1px solid" borderColor="rgba(28, 161, 241, 0.25)" alignItems="center" justifyContent="center">
                  <Icon as={FaChartLine} color={accentColor} boxSize={4} />
                </Flex>
                <Box>
                  <Heading size="md">Hive Power</Heading>
                  <Text fontSize="xs" color={textMuted}>Staked HIVE for voting power</Text>
                </Box>
              </Flex>
              <Box textAlign="right" flexShrink={0}>
                <Text fontSize={{ base: 'lg', md: '2xl' }} fontWeight="bold">{hivePower || 'Loading...'}</Text>
                {prices && hivePower && <Text fontSize="xs" color={textMuted}>≈ ${(parseFloat(hivePower) * prices.hive).toFixed(2)}</Text>}
              </Box>
            </Flex>
            {isOwnWallet && (
              <Flex gap={2} flexWrap="wrap" px={5} pb={4}>
                <Button size="sm" leftIcon={<FaArrowDown />} onClick={() => handleModalOpen({ title: 'Power Down', description: 'Unstake Hive Power', maxAmount: parseFloat(hivePower || '0'), maxLabel: 'HIVE' })} variant="outline" colorScheme="red">Power Down</Button>
                <Flex align="center" gap="1px">
                  <Button size="sm" leftIcon={<FaShareAlt />} onClick={() => handleModalOpen({ title: 'Delegate', description: 'Delegate HP to another user', showMemoField: false, showUsernameField: true, maxAmount: parseFloat(hivePower || '0'), maxLabel: 'HIVE' })} variant="outline" colorScheme="cyan">Delegate</Button>
                  <WalletTermInfo term="delegate" />
                </Flex>
              </Flex>
            )}
          </Box>

          {/* HBD */}
          <Box
            bg="muted" borderRadius="10px" boxShadow="md" overflow="hidden"
            sx={{ border: '1px solid rgba(28, 161, 241, 0.18)', borderLeft: '3px solid var(--chakra-colors-success)' }}
          >
            <Flex justifyContent="space-between" alignItems="center" p={5} pb={isOwnWallet ? 3 : 5}>
              <Flex alignItems="center" gap={3}>
                <Flex w={10} h={10} borderRadius="full" bg="rgba(66, 231, 162, 0.12)" border="1px solid" borderColor="rgba(66, 231, 162, 0.25)" alignItems="center" justifyContent="center">
                  <Icon as={FaDollarSign} color={successColor} boxSize={4} />
                </Flex>
                <Box>
                  <Heading size="md">HBD</Heading>
                  <Text fontSize="xs" color={textMuted}>Stable coin pegged to USD</Text>
                </Box>
              </Flex>
              <Box textAlign="right" flexShrink={0}>
                <Text fontSize={{ base: 'lg', md: '2xl' }} fontWeight="bold">{hbdBalance}</Text>
                {prices && <Text fontSize="xs" color={textMuted}>≈ ${(parseFloat(hbdBalance) * prices.hbd).toFixed(2)}</Text>}
              </Box>
            </Flex>
            {isOwnWallet && (
              <Flex gap={2} flexWrap="wrap" px={5} pb={4}>
                <Button size="sm" leftIcon={<FaPaperPlane />} onClick={() => handleModalOpen({ title: 'Send HBD', description: 'Send HBD to another account', showMemoField: true, showUsernameField: true, maxAmount: parseFloat(hbdBalance), maxLabel: 'HBD' })} variant="outline" colorScheme="blue">Send</Button>
                <Flex align="center" gap="1px">
                  <Button size="sm" leftIcon={<FaExchangeAlt />} onClick={() => handleModalOpen({ title: 'Swap HBD', description: 'Fast market swap HBD -> HIVE (immediate-or-cancel)', swapDirection: 'HBD_TO_HIVE', maxAmount: parseFloat(hbdBalance), maxLabel: 'HBD' })} variant="outline" colorScheme="yellow">Swap</Button>
                  <WalletTermInfo term="swap" />
                </Flex>
                <Button size="sm" leftIcon={<FaPiggyBank />} onClick={() => handleModalOpen({ title: 'HBD Savings', description: 'Send HBD to Savings', maxAmount: parseFloat(hbdBalance), maxLabel: 'HBD' })} variant="outline" colorScheme="teal">To Savings</Button>
              </Flex>
            )}
          </Box>

          {/* Snapie Points */}
          <Box
            bg="muted" borderRadius="10px" boxShadow="md" overflow="hidden"
            sx={{ border: '1px solid rgba(167, 139, 250, 0.25)', borderLeft: '3px solid #a78bfa' }}
          >
            <Flex justifyContent="space-between" alignItems="center" p={5} pb={isOwnWallet ? 3 : 5}>
              <Flex alignItems="center" gap={3}>
                <Flex w={10} h={10} borderRadius="full" bg="rgba(167, 139, 250, 0.12)" border="1px solid" borderColor="rgba(167, 139, 250, 0.3)" alignItems="center" justifyContent="center">
                  <Icon as={FaAward} color="#a78bfa" boxSize={4} />
                </Flex>
                <Box>
                  <Heading size="md">Snapie Points</Heading>
                  <Text fontSize="xs" color={textMuted}>Earn, buy, and (soon) spend inside Snapie</Text>
                </Box>
              </Flex>
              <Box textAlign="right" flexShrink={0}>
                <Text fontSize={{ base: 'lg', md: '2xl' }} fontWeight="bold">
                  {pointsSummary ? pointsSummary.balance.toLocaleString() : '—'}
                </Text>
                <Text fontSize="xs" color={textMuted}>spendable</Text>
              </Box>
            </Flex>
            <Flex justifyContent="space-between" alignItems="center" px={5} pb={4}>
              <HStack spacing={1.5} color={textMuted} fontSize="xs">
                <Icon as={FaTrophy} boxSize={3} />
                <Text>
                  {pointsSummary ? pointsSummary.lifetimeEarned.toLocaleString() : '—'} lifetime
                  {pointsSummary?.rank ? ` · #${pointsSummary.rank} on the leaderboard` : ''}
                  {' — spending or buying never lowers this'}
                </Text>
              </HStack>
            </Flex>
            {isOwnWallet && (
              <Flex gap={2} flexWrap="wrap" px={5} pb={4}>
                <Button
                  size="sm"
                  leftIcon={<FaShoppingCart />}
                  onClick={() => router.push('/settings/points/buy')}
                  variant="outline"
                  colorScheme="purple"
                >
                  Buy Points
                </Button>
                <Button
                  size="sm"
                  leftIcon={<FaHistory />}
                  onClick={onPointsHistoryOpen}
                  variant="outline"
                  colorScheme="purple"
                >
                  History
                </Button>
              </Flex>
            )}
          </Box>

          {/* The Pile — inventory */}
          {ITEM_MARKET_FEATURE_FLAG && isOwnWallet && inventory.length > 0 && (
            <Box
              bg="muted" borderRadius="10px" boxShadow="md" overflow="hidden"
              sx={{ border: '1px solid rgba(167, 139, 250, 0.25)', borderLeft: '3px solid #a78bfa' }}
            >
              <Flex justifyContent="space-between" alignItems="center" p={5} pb={3}>
                <Flex alignItems="center" gap={3}>
                  <Flex w={10} h={10} borderRadius="full" bg="rgba(167, 139, 250, 0.12)" border="1px solid" borderColor="rgba(167, 139, 250, 0.3)" alignItems="center" justifyContent="center">
                    <Icon as={FaGift} color="#a78bfa" boxSize={4} />
                  </Flex>
                  <Box>
                    <Heading size="md">The Pile — Inventory</Heading>
                    <Text fontSize="xs" color={textMuted}>Owned items, ready to throw at a post or Snap</Text>
                  </Box>
                </Flex>
              </Flex>
              <Grid templateColumns={{ base: 'repeat(3, 1fr)', md: 'repeat(5, 1fr)' }} gap={3} px={5} pb={5}>
                {inventory.map(entry => (
                  <VStack key={entry.item.id} spacing={1} bg="background" borderRadius="8px" p={2}>
                    <Image src={entry.item.imageUrl} alt={entry.item.name} boxSize="36px" objectFit="contain" />
                    <Text fontSize="2xs" color={textMuted} noOfLines={1}>{entry.item.name}</Text>
                    <Text fontSize="xs" fontWeight="bold">×{entry.unitIds.length}</Text>
                  </VStack>
                ))}
              </Grid>
              <Flex px={5} pb={4}>
                <Button size="sm" leftIcon={<FaShoppingCart />} onClick={() => router.push('/settings/points/market')} variant="outline" colorScheme="purple">
                  Buy More
                </Button>
              </Flex>
            </Box>
          )}

          {/* Savings */}
          <Box
            bg="muted" borderRadius="10px" boxShadow="md" overflow="hidden"
            sx={{ border: '1px solid rgba(28, 161, 241, 0.18)', borderLeft: '3px solid var(--chakra-colors-accent)' }}
          >
            <Box p={5}>
              <Flex alignItems="center" gap={3} mb={5}>
                <Flex w={10} h={10} borderRadius="full" bg="rgba(28, 161, 241, 0.12)" border="1px solid" borderColor="rgba(28, 161, 241, 0.25)" alignItems="center" justifyContent="center">
                  <Icon as={FaPiggyBank} color="accent" boxSize={4} />
                </Flex>
                <Box>
                  <Heading size="md">Savings</Heading>
                  <Text fontSize="xs" color={textMuted}>Locked funds earning interest</Text>
                </Box>
              </Flex>

              <Grid templateColumns={{ base: '1fr', md: '1fr 1fr' }} gap={4}>
                <Box p={4} bg="rgba(28, 161, 241, 0.04)" borderRadius="10px" border="tb1">
                  <Text fontSize="xs" color={textMuted} textTransform="uppercase" letterSpacing="wide" mb={1}>HIVE Savings</Text>
                  <Text fontSize="xl" fontWeight="bold" mb={2}>{savingsBalance}</Text>
                  {isOwnWallet && (
                    <Button size="xs" leftIcon={<FaDollarSign />} onClick={() => handleModalOpen({ title: 'Withdraw HIVE Savings', description: 'Withdraw HIVE from Savings', maxAmount: parseFloat(savingsBalance), maxLabel: 'HIVE' })} variant="ghost" colorScheme="teal">
                      Withdraw
                    </Button>
                  )}
                </Box>
                <Box p={4} bg="rgba(66, 231, 162, 0.04)" borderRadius="10px" border="tb1">
                  <Text fontSize="xs" color={textMuted} textTransform="uppercase" letterSpacing="wide" mb={1}>HBD Savings</Text>
                  <Text fontSize="xl" fontWeight="bold" mb={1}>{hbdSavingsBalance}</Text>
                  {annualRatePct > 0 && (
                    <Text fontSize="xs" color="green.400" mb={2}>{annualRatePct.toFixed(0)}% APR</Text>
                  )}
                  {isOwnWallet && pendingInterest >= 0.001 && (
                    <Box mb={2} p={2} bg="rgba(66, 231, 162, 0.08)" borderRadius="8px" border="1px solid" borderColor="rgba(66, 231, 162, 0.2)">
                      <Text fontSize="xs" color={textMuted} mb={1}>Pending interest</Text>
                      <Text fontSize="sm" fontWeight="bold" color="green.300" mb={2}>
                        {isInterestLoading ? '…' : `~${pendingInterest.toFixed(3)} HBD`}
                      </Text>
                      <Button
                        size="xs"
                        colorScheme="green"
                        variant="solid"
                        isLoading={isClaimingInterest}
                        loadingText="Claiming…"
                        isDisabled={parseFloat(String(hiveAccount?.hbd_balance ?? '0')) < 0.001}
                        title={parseFloat(String(hiveAccount?.hbd_balance ?? '0')) < 0.001 ? 'You need at least 0.001 liquid HBD to trigger interest' : ''}
                        onClick={async () => {
                          if (!user) return;
                          setIsClaimingInterest(true);
                          try {
                            await claimHbdSavingsInterest(user);
                            setTimeout(refetch, 3500);
                          } catch (e) {
                            console.error('Failed to claim HBD interest:', e);
                          } finally {
                            setIsClaimingInterest(false);
                          }
                        }}
                      >
                        Claim Interest
                      </Button>
                    </Box>
                  )}
                  {isOwnWallet && (
                    <Button size="xs" leftIcon={<FaDollarSign />} onClick={() => handleModalOpen({ title: 'Withdraw HBD Savings', description: 'Withdraw HBD from Savings', maxAmount: parseFloat(hbdSavingsBalance), maxLabel: 'HBD' })} variant="ghost" colorScheme="teal">
                      Withdraw
                    </Button>
                  )}
                </Box>
              </Grid>
            </Box>
          </Box>
        </VStack>

        {/* Transaction History */}
        <Box mt={8} mb={8}>
          <Flex alignItems="center" gap={3} mb={4}>
            <Flex w={8} h={8} borderRadius="full" bg="rgba(28, 161, 241, 0.12)" border="1px solid" borderColor="rgba(28, 161, 241, 0.25)" alignItems="center" justifyContent="center">
              <Icon as={FaExchangeAlt} color="primary" boxSize={3.5} />
            </Flex>
            <Heading size="lg">Transaction History</Heading>
          </Flex>
          <TransactionHistory username={username} />
        </Box>
      </Container>

      <PointsHistoryModal isOpen={isPointsHistoryOpen} onClose={onPointsHistoryClose} username={username} />

      <WalletModal
        isOpen={isOpen}
        onClose={onClose}
        title={modalContent?.title || ''}
        description={modalContent?.description}
        showMemoField={modalContent?.showMemoField}
        showUsernameField={modalContent?.showUsernameField}
        swapConfig={{
          enabled: Boolean(modalContent?.swapDirection),
          direction: modalContent?.swapDirection || 'HIVE_TO_HBD',
          price: executableSwapPrice || undefined,
          slippagePercent: 0.5,
        }}
        initialTo={modalContent?.initialTo}
        initialAmount={modalContent?.initialAmount}
        initialMemo={modalContent?.initialMemo}
        maxAmount={modalContent?.maxAmount}
        maxLabel={modalContent?.maxLabel}
        onConfirm={handleConfirm}
      />

      {user && (
        <>
          <QRRequestSheet
            isOpen={isQRRequestOpen}
            onClose={onQRRequestClose}
            username={user}
          />
          <QRScanSheet
            isOpen={isQRScanOpen}
            onClose={onQRScanClose}
            onScan={handleQRScan}
          />
        </>
      )}

      <EditProfileModal
        isOpen={isEditOpen}
        onClose={onEditClose}
        username={username}
        initialData={profileMetadata}
        onSaved={refetch}
      />
    </Box>
  );
}
