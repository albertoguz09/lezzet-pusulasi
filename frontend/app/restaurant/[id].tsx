import { API_URL } from "@/constants/api";
import { isFavorite, toggleFavorite } from "@/lib/favorites";
import type { Restaurant } from "@/types/restaurant";
import { Ionicons } from "@expo/vector-icons";
import axios from "axios";
import { Stack, useLocalSearchParams, useRouter } from "expo-router";
import { useEffect, useMemo, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Image,
  Linking,
  Pressable,
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";

type PlaceDetails = {
  place_id: string;
  name?: string;
  address?: string;
  phone?: string;
  rating?: number;
  user_ratings_total?: number;
  business_status?: string;
  open_now?: boolean;
  weekday_text?: string[];
  website?: string;
  google_maps_url?: string;
  price_level?: number;
  photo_reference?: string;
  latitude?: number;
  longitude?: number;
};

export default function RestaurantDetailScreen() {
  const router = useRouter();

  const params = useLocalSearchParams<{
    id?: string | string[];
  }>();

  const placeId = Array.isArray(params.id)
    ? params.id[0]
    : params.id;

  const [place, setPlace] = useState<PlaceDetails | null>(null);
  const [loading, setLoading] = useState(true);
  const [favorite, setFavorite] = useState(false);

  useEffect(() => {
    if (!placeId) {
      setLoading(false);
      return;
    }

    void loadDetails(placeId);
  }, [placeId]);

  async function loadDetails(id: string) {
    try {
      const response = await axios.get<PlaceDetails>(
        `${API_URL}/place/${id}`,
        {
          timeout: 20000,
        },
      );

      setPlace(response.data);
      setFavorite(await isFavorite(id));
    } catch (error) {
      const message = axios.isAxiosError(error)
        ? error.response?.data?.detail || error.message
        : "Mekan bilgileri alınamadı.";

      Alert.alert("Detaylar yüklenemedi", String(message));
    } finally {
      setLoading(false);
    }
  }

  const photoUrl = useMemo(() => {
    if (!place?.photo_reference) {
      return null;
    }

    return `${API_URL}/photo?reference=${encodeURIComponent(
      place.photo_reference,
    )}&maxwidth=1400`;
  }, [place?.photo_reference]);

  async function changeFavorite() {
    if (!place?.place_id) {
      return;
    }

    const item: Restaurant = {
      place_id: place.place_id,
      name: place.name || "Mekan",
      rating: place.rating,
      user_ratings_total: place.user_ratings_total,
      vicinity: place.address,
      address: place.address,
      business_status: place.business_status,
      open_now: place.open_now,
      price_level: place.price_level,
      photo_reference: place.photo_reference,
      latitude: place.latitude,
      longitude: place.longitude,
    };

    const added = await toggleFavorite(item);

    setFavorite(added);

    Alert.alert(
      added ? "Favorilere eklendi" : "Favorilerden çıkarıldı",
      item.name,
    );
  }

  async function openMaps() {
    const fallback =
      place?.latitude !== undefined &&
      place?.longitude !== undefined
        ? `https://www.google.com/maps/search/?api=1&query=${place.latitude},${place.longitude}`
        : null;

    const url = place?.google_maps_url || fallback;

    if (!url) {
      Alert.alert("Konum bulunamadı", "Bu mekanın konum bilgisi yok.");
      return;
    }

    await Linking.openURL(url);
  }

  async function callPlace() {
    if (!place?.phone) {
      return;
    }

    await Linking.openURL(
      `tel:${place.phone.replace(/\s/g, "")}`,
    );
  }

  async function openWebsite() {
    if (!place?.website) {
      return;
    }

    await Linking.openURL(place.website);
  }

  if (loading) {
    return (
      <SafeAreaView style={styles.loadingScreen}>
        <Stack.Screen options={{ headerShown: false }} />

        <ActivityIndicator size="large" color="#D92D20" />

        <Text style={styles.loadingText}>
          Mekan detayları yükleniyor...
        </Text>
      </SafeAreaView>
    );
  }

  if (!place) {
    return (
      <SafeAreaView style={styles.loadingScreen}>
        <Stack.Screen options={{ headerShown: false }} />

        <Text style={styles.errorTitle}>
          Mekan bulunamadı
        </Text>

        <Pressable
          style={styles.primaryButton}
          onPress={() => router.back()}
        >
          <Text style={styles.primaryButtonText}>
            Geri dön
          </Text>
        </Pressable>
      </SafeAreaView>
    );
  }

  const isOpen = place.open_now === true;

  const statusText =
    place.open_now === true
      ? "Şu an açık"
      : place.open_now === false
        ? "Şu an kapalı"
        : "Çalışma durumu bilinmiyor";

  return (
    <View style={styles.screen}>
      <Stack.Screen options={{ headerShown: false }} />

      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.scrollContent}
      >
        <View style={styles.hero}>
          {photoUrl ? (
            <Image
              source={{ uri: photoUrl }}
              style={styles.heroImage}
              resizeMode="cover"
            />
          ) : (
            <View style={styles.photoFallback}>
              <Ionicons
                name="restaurant"
                size={54}
                color="#D92D20"
              />
            </View>
          )}

          <View style={styles.heroOverlay} />

          <SafeAreaView style={styles.heroControls}>
            <Pressable
              style={styles.roundButton}
              onPress={() => router.back()}
            >
              <Ionicons
                name="chevron-back"
                size={24}
                color="#171717"
              />
            </Pressable>

            <Pressable
              style={styles.roundButton}
              onPress={() => void changeFavorite()}
            >
              <Ionicons
                name={favorite ? "heart" : "heart-outline"}
                size={22}
                color="#D92D20"
              />
            </Pressable>
          </SafeAreaView>
        </View>

        <View style={styles.contentCard}>
          <View style={styles.titleRow}>
            <View style={styles.titleArea}>
              <Text style={styles.name}>
                {place.name || "Mekan"}
              </Text>

              <View style={styles.ratingRow}>
                <Ionicons
                  name="star"
                  size={18}
                  color="#F4B400"
                />

                <Text style={styles.rating}>
                  {place.rating ?? "–"}
                </Text>

                {place.user_ratings_total ? (
                  <Text style={styles.reviewCount}>
                    ({place.user_ratings_total} yorum)
                  </Text>
                ) : null}
              </View>
            </View>

            <View
              style={[
                styles.openBadge,
                isOpen
                  ? styles.openBadgeActive
                  : styles.openBadgePassive,
              ]}
            >
              <View
                style={[
                  styles.openDot,
                  isOpen
                    ? styles.openDotActive
                    : styles.openDotPassive,
                ]}
              />

              <Text
                style={[
                  styles.openText,
                  isOpen
                    ? styles.openTextActive
                    : styles.openTextPassive,
                ]}
              >
                {statusText}
              </Text>
            </View>
          </View>

          <View style={styles.infoBlock}>
            <Ionicons
              name="location-outline"
              size={22}
              color="#D92D20"
            />

            <Text style={styles.infoText}>
              {place.address || "Adres bilgisi yok"}
            </Text>
          </View>

          <View style={styles.actionGrid}>
            <Pressable
              style={styles.primaryAction}
              onPress={() => void openMaps()}
            >
              <Ionicons
                name="navigate"
                size={21}
                color="#FFFFFF"
              />

              <Text style={styles.primaryActionText}>
                Yol tarifi
              </Text>
            </Pressable>

            <Pressable
              style={[
                styles.secondaryAction,
                !place.phone && styles.disabledAction,
              ]}
              disabled={!place.phone}
              onPress={() => void callPlace()}
            >
              <Ionicons
                name="call-outline"
                size={21}
                color="#D92D20"
              />

              <Text style={styles.secondaryActionText}>
                Ara
              </Text>
            </Pressable>

            <Pressable
              style={[
                styles.secondaryAction,
                !place.website && styles.disabledAction,
              ]}
              disabled={!place.website}
              onPress={() => void openWebsite()}
            >
              <Ionicons
                name="globe-outline"
                size={21}
                color="#D92D20"
              />

              <Text style={styles.secondaryActionText}>
                Web sitesi
              </Text>
            </Pressable>
          </View>

          {place.weekday_text &&
            place.weekday_text.length > 0 && (
              <View style={styles.hoursCard}>
                <Text style={styles.hoursTitle}>
                  Çalışma saatleri
                </Text>

                {place.weekday_text.map((line) => (
                  <Text
                    key={line}
                    style={styles.hoursText}
                  >
                    {line}
                  </Text>
                ))}
              </View>
            )}
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: "#F6F6F6",
  },

  scrollContent: {
    paddingBottom: 36,
  },

  hero: {
    height: 335,
    backgroundColor: "#FCECEB",
  },

  heroImage: {
    width: "100%",
    height: "100%",
  },

  photoFallback: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
  },

  heroOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: "rgba(0,0,0,0.12)",
  },

  heroControls: {
    ...StyleSheet.absoluteFillObject,
    paddingHorizontal: 26,
    paddingTop: 10,
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
  },

  roundButton: {
    width: 44,
    height: 44,
    marginTop: 8,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 22,
    backgroundColor: "rgba(255,255,255,0.96)",

    shadowColor: "#000000",
    shadowOpacity: 0.16,
    shadowRadius: 8,
    shadowOffset: {
      width: 0,
      height: 3,
    },

    elevation: 4,
  },

  contentCard: {
    marginTop: -24,
    marginHorizontal: 14,
    borderRadius: 28,
    backgroundColor: "#FFFFFF",
    padding: 22,

    shadowColor: "#000000",
    shadowOpacity: 0.08,
    shadowRadius: 18,
    shadowOffset: {
      width: 0,
      height: 8,
    },

    elevation: 4,
  },

  titleRow: {
    gap: 14,
  },

  titleArea: {
    flex: 1,
  },

  name: {
    color: "#171717",
    fontSize: 25,
    fontWeight: "900",
    letterSpacing: -0.4,
  },

  ratingRow: {
    marginTop: 10,
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
  },

  rating: {
    color: "#242424",
    fontSize: 16,
    fontWeight: "800",
  },

  reviewCount: {
    color: "#777777",
    fontSize: 14,
  },

  openBadge: {
    alignSelf: "flex-start",
    flexDirection: "row",
    alignItems: "center",
    gap: 7,
    borderRadius: 999,
    paddingHorizontal: 11,
    paddingVertical: 7,
  },

  openBadgeActive: {
    backgroundColor: "#ECFDF3",
  },

  openBadgePassive: {
    backgroundColor: "#F2F4F7",
  },

  openDot: {
    width: 8,
    height: 8,
    borderRadius: 99,
  },

  openDotActive: {
    backgroundColor: "#12B76A",
  },

  openDotPassive: {
    backgroundColor: "#98A2B3",
  },

  openText: {
    fontSize: 13,
    fontWeight: "800",
  },

  openTextActive: {
    color: "#067647",
  },

  openTextPassive: {
    color: "#667085",
  },

  infoBlock: {
    marginTop: 24,
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 10,
    borderTopWidth: 1,
    borderTopColor: "#F0F0F0",
    paddingTop: 20,
  },

  infoText: {
    flex: 1,
    color: "#5D5D5D",
    fontSize: 15,
    lineHeight: 22,
  },

  actionGrid: {
    marginTop: 24,
    gap: 10,
  },

  primaryAction: {
    height: 56,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 9,
    borderRadius: 18,
    backgroundColor: "#D92D20",
  },

  primaryActionText: {
    color: "#FFFFFF",
    fontSize: 16,
    fontWeight: "800",
  },

  secondaryAction: {
    height: 52,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 9,
    borderWidth: 1,
    borderColor: "#F0C4C0",
    borderRadius: 17,
    backgroundColor: "#FFF8F7",
  },

  secondaryActionText: {
    color: "#A52218",
    fontSize: 15,
    fontWeight: "800",
  },

  disabledAction: {
    opacity: 0.38,
  },

  hoursCard: {
    marginTop: 24,
    borderRadius: 20,
    backgroundColor: "#F8F8F8",
    padding: 18,
  },

  hoursTitle: {
    marginBottom: 10,
    color: "#222222",
    fontSize: 17,
    fontWeight: "800",
  },

  hoursText: {
    marginTop: 5,
    color: "#666666",
    fontSize: 13,
    lineHeight: 19,
  },

  loadingScreen: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    gap: 14,
    backgroundColor: "#FFFFFF",
    padding: 24,
  },

  loadingText: {
    color: "#666666",
    fontSize: 15,
  },

  errorTitle: {
    color: "#222222",
    fontSize: 22,
    fontWeight: "800",
  },

  primaryButton: {
    marginTop: 18,
    borderRadius: 16,
    backgroundColor: "#D92D20",
    paddingHorizontal: 20,
    paddingVertical: 14,
  },

  primaryButtonText: {
    color: "#FFFFFF",
    fontWeight: "800",
  },
});