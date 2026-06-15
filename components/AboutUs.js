import React, { useState } from 'react';
import {
  View,
  Text,
  Image,
  ScrollView,
  TouchableOpacity,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { lecturerMembers, studentMembers } from '../data/teamMembers';
import { aboutUsStyles as styles, SNAP_INTERVAL } from '../styles/aboutUsStyles';

export default function AboutUs({ onBack }) {
  const [studentIndex, setStudentIndex] = useState(0);
  const [lecturerIndex, setLecturerIndex] = useState(0);

  const getScrollIndex = (event) => {
    const offset = event.nativeEvent.contentOffset.x;
    return Math.round(offset / SNAP_INTERVAL);
  };

  const renderMemberCarousel = (
    title,
    subtitle,
    members,
    currentIndex,
    onIndexChange,
    idLabel,
    imageResizeMode = 'cover'
  ) => (
    <View style={styles.carouselSection}>
      <View style={styles.sectionHeader}>
        <Text style={styles.sectionTitle}>{title}</Text>
        <Text style={styles.sectionSubtitle}>{subtitle}</Text>
      </View>

      <ScrollView
        horizontal
        pagingEnabled={false}
        decelerationRate="fast"
        snapToInterval={SNAP_INTERVAL}
        snapToAlignment="start"
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.carouselContent}
        onScroll={(event) => onIndexChange(getScrollIndex(event))}
        scrollEventThrottle={16}
      >
        {members.map((member) => (
          <View key={member.id} style={styles.slide}>
            <View style={styles.card}>

              <View style={styles.imageSection}>
                {member.image ? (
                  <Image
                    source={member.image}
                    style={[
                      styles.image,
                      imageResizeMode === 'contain' && styles.containImage,
                    ]}
                    resizeMode={imageResizeMode}
                  />
                ) : (
                  <View style={styles.placeholderImage}>
                    <Ionicons name="person-outline" size={46} color="#5AA3C8" />
                  </View>
                )}
                <LinearGradient
                  colors={['transparent', 'rgba(0,0,0,0.32)']}
                  style={styles.imageOverlay}
                />
                <Text style={styles.decoNumber}>0{member.id}</Text>
              </View>

              <View style={styles.cardContent}>
                <View style={styles.cardAccentBar} />
                <Text style={styles.memberName}>{member.name}</Text>
                <View style={styles.nimRow}>
                  <Ionicons name="card-outline" size={12} color="#8BAFC0" />
                  <Text style={styles.nimText}>{idLabel}: {member.nim || member.nip || '-'}</Text>
                </View>
              </View>

            </View>
          </View>
        ))}
      </ScrollView>

      <View style={styles.dotsContainer}>
        {members.map((_, index) => (
          <View
            key={index}
            style={[styles.dot, currentIndex === index && styles.activeDot]}
          />
        ))}
      </View>
    </View>
  );

  return (
    <View style={styles.container}>

      {/* Header */}
      <View style={styles.header}>
        <View style={styles.headerContent}>
          <TouchableOpacity onPress={onBack} style={styles.backButton}>
            <Ionicons name="chevron-back" size={20} color="#FFFFFF" />
            <Text style={styles.backText}>Kembali</Text>
          </TouchableOpacity>
          <View style={styles.iconContainer}>
            <Ionicons name="people-outline" size={16} color="#FFFFFF" />
          </View>
        </View>

        <View style={styles.headerTitle}>
          <View style={styles.tagContainer}>
            <Text style={styles.tagText}>TENTANG KAMI</Text>
          </View>
          <Text style={styles.title}>
            Tim Ahli{' '}
            <Text style={styles.titleAccent}>Monitoring</Text>
            {'\n'}Kualitas Air.
          </Text>
          <Text style={styles.description}>
            Menjaga Kualitas Air untuk Kesehatan Civitas Telkom University
          </Text>
        </View>
      </View>

      {/* Content */}
      <ScrollView
        style={styles.content}
        showsVerticalScrollIndicator={false}
        bounces={false}
      >
        {renderMemberCarousel(
          'Tim Dosen',
          'Pembimbing dan pengarah penelitian',
          lecturerMembers,
          lecturerIndex,
          setLecturerIndex,
          'NIP',
          'contain'
        )}

        {renderMemberCarousel(
          'Tim Mahasiswa',
          'Pengembang sistem monitoring kualitas air',
          studentMembers,
          studentIndex,
          setStudentIndex,
          'NIM'
        )}

        {/* Info card */}
        <View style={styles.infoCard}>
          <View style={styles.infoIconDot} />
          <Text style={styles.infoText}>
            Tim kami berkomitmen untuk menyediakan solusi monitoring kualitas air terbaik
          </Text>
          <View style={styles.infoBadge}>
            <Text style={styles.infoBadgeText}>PERMENKES RI No. 32 Tahun 2017</Text>
          </View>
        </View>

        <View style={{ height: 24 }} />
      </ScrollView>

    </View>
  );
}
