import { StyleSheet, Dimensions } from 'react-native';

const { width } = Dimensions.get('window');

// padding kiri = 20, hint card berikutnya = 36, gap antar card = 14
export const CARD_WIDTH = width - 20 - 36;
export const SNAP_INTERVAL = CARD_WIDTH + 14;

export const aboutUsStyles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F0F7FB',
  },

  /* ── Header ── */
  header: {
    backgroundColor: '#7CB9D8',
    paddingTop: 52,
    paddingBottom: 28,
    paddingHorizontal: 20,
  },
  headerContent: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 22,
  },
  backButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  backText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '500',
  },
  iconContainer: {
    width: 34,
    height: 34,
    backgroundColor: 'rgba(255, 255, 255, 0.22)',
    borderRadius: 17,
    justifyContent: 'center',
    alignItems: 'center',
  },
  headerTitle: {
    gap: 10,
  },
  tagContainer: {
    alignSelf: 'flex-start',
    backgroundColor: 'rgba(255,255,255,0.18)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.35)',
    borderRadius: 20,
    paddingHorizontal: 12,
    paddingVertical: 3,
    marginBottom: 10,
  },
  tagText: {
    color: '#FFFFFF',
    fontSize: 9,
    fontWeight: '700',
    letterSpacing: 1.4,
  },
  title: {
    fontSize: 24,
    fontWeight: '700',
    color: '#FFFFFF',
    lineHeight: 30,
    marginBottom: 6,
  },
  titleAccent: {
    fontStyle: 'italic',
    color: 'rgba(255,255,255,0.88)',
  },
  description: {
    fontSize: 12,
    color: 'rgba(255,255,255,0.75)',
  },

  /* ── Content scroll ── */
  content: {
    flex: 1,
  },

  /* ── Carousel ── */
  carouselSection: {
    paddingTop: 20,
  },
  sectionHeader: {
    paddingHorizontal: 20,
    marginBottom: 12,
  },
  sectionTitle: {
    fontSize: 15,
    fontWeight: '800',
    color: '#1A3040',
  },
  sectionSubtitle: {
    fontSize: 11,
    color: '#6B8FA3',
    marginTop: 3,
  },
  carouselContent: {
    paddingLeft: 20,
    paddingRight: 36,
  },
  slide: {
    width: CARD_WIDTH,
    marginRight: 14,
  },

  /* ── Card ── */
  card: {
    backgroundColor: '#FFFFFF',
    borderRadius: 20,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: '#D4E8F2',
    shadowColor: '#7CB9D8',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.15,
    shadowRadius: 12,
    elevation: 4,
  },
  imageSection: {
    height: 210,
    backgroundColor: '#D4EAF5',
    position: 'relative',
  },
  image: {
    width: '100%',
    height: '100%',
    resizeMode: 'cover',
  },
  containImage: {
    backgroundColor: '#FFFFFF',
  },
  placeholderImage: {
    width: '100%',
    height: '100%',
    backgroundColor: '#EAF4FB',
    justifyContent: 'center',
    alignItems: 'center',
  },
  imageOverlay: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    height: 80,
  },
  decoNumber: {
    position: 'absolute',
    top: 10,
    right: 14,
    fontSize: 52,
    fontWeight: '800',
    color: 'rgba(255,255,255,0.22)',
    lineHeight: 56,
  },
  cardContent: {
    backgroundColor: '#FFFFFF',
    paddingHorizontal: 18,
    paddingVertical: 16,
  },
  cardAccentBar: {
    width: 32,
    height: 3,
    backgroundColor: '#7CB9D8',
    borderRadius: 2,
    marginBottom: 10,
  },
  memberName: {
    fontSize: 15,
    fontWeight: '700',
    color: '#1A3040',
    marginBottom: 5,
  },
  nimRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  nimText: {
    fontSize: 11,
    color: '#8BAFC0',
    letterSpacing: 0.3,
  },

  /* ── Dots ── */
  dotsContainer: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    gap: 5,
    paddingVertical: 14,
  },
  dot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: '#C5DDE8',
  },
  activeDot: {
    width: 22,
    backgroundColor: '#7CB9D8',
    borderRadius: 3,
  },

  /* ── Info Card ── */
  infoCard: {
    marginHorizontal: 16,
    marginBottom: 20,
    backgroundColor: '#EAF4FB',
    borderWidth: 1,
    borderColor: '#C5DDE8',
    borderRadius: 14,
    padding: 14,
    alignItems: 'center',
    gap: 7,
  },
  infoIconDot: {
    width: 7,
    height: 7,
    borderRadius: 3.5,
    backgroundColor: '#7CB9D8',
  },
  infoText: {
    fontSize: 12,
    color: '#1E4A6B',
    textAlign: 'center',
    lineHeight: 18,
  },
  infoBadge: {
    backgroundColor: 'rgba(124,185,216,0.13)',
    borderWidth: 1,
    borderColor: '#A8D0E6',
    borderRadius: 20,
    paddingHorizontal: 12,
    paddingVertical: 3,
  },
  infoBadgeText: {
    fontSize: 9,
    color: '#4A8BAA',
    fontWeight: '700',
    letterSpacing: 0.5,
  },
});
