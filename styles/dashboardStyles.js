import { StyleSheet, Dimensions } from 'react-native';

const { width } = Dimensions.get('window');

const GRID_PADDING = 16;
const GRID_GAP     = 10;
export const CARD_W = Math.floor((width - GRID_PADDING * 2 - GRID_GAP) / 2);

export const dashboardStyles = StyleSheet.create({

  /* ── Root ── */
  container: {
    flex: 1,
    backgroundColor: '#F0F7FB',
  },

  /* ── Header ── */
  header: {
    backgroundColor: '#7CB9D8',
    paddingHorizontal: 20,
    paddingTop: 52,
    paddingBottom: 44,
  },
  headerContent: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  logoContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  // ── pure logo, no box container ──
  logo: {
    width: 44,
    height: 44,
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: '#FFFFFF',
    letterSpacing: 0.2,
  },
  headerSubtitle: {
    fontSize: 11,
    color: 'rgba(255,255,255,0.75)',
    marginTop: 1,
  },
  headerIcons: {
    flexDirection: 'row',
    gap: 8,
  },
  statusIndicator: {
    width: 36,
    height: 36,
    backgroundColor: 'rgba(255,255,255,0.18)',
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
  },

  /* ── WQI / Status card (floating) ── */
  statusSection: {
    paddingHorizontal: 16,
    marginTop: -28,
    marginBottom: 16,
  },

  /* ── Stats strip ── */
  statsStrip: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    paddingHorizontal: 16,
    marginBottom: 16,
  },
  statItem: {
    flexGrow: 1,
    flexBasis: '18%',
    minWidth: 62,
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    paddingVertical: 10,
    paddingHorizontal: 8,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#D4E8F2',
  },
  statValue: {
    fontSize: 14,
    fontWeight: '700',
    color: '#1A3040',
  },
  statLabel: {
    fontSize: 9,
    color: '#8BAFC0',
    marginTop: 2,
  },

  /* ── Section header ── */
  metricsSection: {
    paddingHorizontal: 16,
    marginBottom: 4,
  },
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 10,
  },
  sectionTitle: {
    fontSize: 15,
    fontWeight: '700',
    color: '#1A3040',
  },
  updateTime: {
    fontSize: 10,
    color: '#8BAFC0',
  },

  /* ── Grid wrapper ── */
  cardsGrid: {
    paddingHorizontal: 16,
    marginBottom: 16,
  },

  /* ── Satu baris berisi 2 card ── */
  cardRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 10,
  },

  /* ── Individual parameter card ── */
  paramCard: {
    borderRadius: 16,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.4)',
  },
  paramCardTop: {
    padding: 14,
    paddingBottom: 10,
    position: 'relative',
  },
  paramCardIconWrap: {
    width: 30,
    height: 30,
    borderRadius: 9,
    backgroundColor: 'rgba(255,255,255,0.22)',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 8,
  },
  paramCardLabel: {
    fontSize: 10,
    color: 'rgba(255,255,255,0.82)',
    fontWeight: '500',
    marginBottom: 3,
  },
  paramCardValueRow: {
    flexDirection: 'row',
    alignItems: 'baseline',
    gap: 3,
  },
  paramCardValue: {
    fontSize: 26,
    fontWeight: '800',
    color: '#FFFFFF',
    lineHeight: 30,
  },
  paramCardUnit: {
    fontSize: 11,
    color: 'rgba(255,255,255,0.78)',
    fontWeight: '500',
  },
  paramCardStatusDot: {
    position: 'absolute',
    top: 12,
    right: 12,
    width: 9,
    height: 9,
    borderRadius: 4.5,
  },
  paramCardBottom: {
    paddingHorizontal: 14,
    paddingVertical: 7,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  paramCardRange: {
    fontSize: 9,
    color: 'rgba(255,255,255,0.72)',
  },
  paramCardAccuracy: {
    fontSize: 9,
    color: 'rgba(255,255,255,0.5)',
  },

  /* ── Info card ── */
  infoSection: {
    paddingHorizontal: 16,
    paddingBottom: 24,
  },
  infoCard: {
    backgroundColor: '#EAF4FB',
    borderWidth: 1,
    borderColor: '#C5DDE8',
    borderRadius: 14,
    padding: 13,
    gap: 5,
  },
  infoRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 7,
  },
  infoDot: {
    width: 7,
    height: 7,
    backgroundColor: '#7CB9D8',
    borderRadius: 3.5,
  },
  infoText: {
    fontSize: 12,
    color: '#1E4A6B',
    lineHeight: 17,
  },
  infoSubtext: {
    fontSize: 10,
    color: '#4A8BAA',
    fontWeight: '600',
  },

  /* ── Error banner ── */
  errorBanner: {
    backgroundColor: '#FEE2E2',
    margin: 16,
    padding: 12,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#FECACA',
  },
  errorText: { fontSize: 13, color: '#DC2626' },
  errorRetry: { fontSize: 12, color: '#DC2626', fontWeight: '600', marginTop: 4 },

  /* ── Loading ── */
  loadingWrap: { padding: 40, alignItems: 'center' },
  loadingText: { marginTop: 10, color: '#8BAFC0', fontSize: 13 },
});
