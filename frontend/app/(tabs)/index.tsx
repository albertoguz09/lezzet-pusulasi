import { Ionicons } from "@expo/vector-icons";
import * as Location from "expo-location";
import { router } from "expo-router";
import { useEffect, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  FlatList,
  Keyboard,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";

const API_URL = "http://192.168.1.21:8001";

type Coordinates = {
  latitude: number;
  longitude: number;
};

type Restaurant = {
  place_id: string;
  name: string;
  rating?: number;
  user_ratings_total?: number;
  vicinity?: string;
  business_status?: string;
  open_now?: boolean;
  price_level?: number;
  photo_reference?: string;
};

function getStatusText(item: Restaurant) {
  if (item.open_now === true) return "Şu an açık";
  if (item.open_now === false) return "Şu an kapalı";
  if (item.business_status === "OPERATIONAL") return "Hizmet veriyor";
  return "Durum bilinmiyor";
}

export default function HomeScreen() {
  const [locationText, setLocationText] = useState("Konum alınıyor...");
  const [query, setQuery] = useState("");
  const [coords, setCoords] = useState<Coordinates | null>(null);
  const [restaurants, setRestaurants] = useState<Restaurant[]>([]);
  const [loading, setLoading] = useState(false);
  const [locationLoading, setLocationLoading] = useState(true);

  useEffect(() => {
    void getLocation();
  }, []);

  async function getLocation() {
    setLocationLoading(true);

    try {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== "granted") {
        setLocationText("Konum izni verilmedi");
        return;
      }

      const current = await Location.getCurrentPositionAsync({
        accuracy: Location.Accuracy.Balanced,
      });

      setCoords({
        latitude: current.coords.latitude,
        longitude: current.coords.longitude,
      });

      try {
        const addresses = await Location.reverseGeocodeAsync({
          latitude: current.coords.latitude,
          longitude: current.coords.longitude,
        });
        const address = addresses[0];
        const readableLocation = [address?.district, address?.city]
          .filter(Boolean)
          .filter((value, index, values) => values.indexOf(value) === index)
          .join(", ");
        setLocationText(readableLocation || "Konum hazır");
      } catch {
        setLocationText("Konum hazır");
      }
    } catch {
      setLocationText("Konum alınamadı");
    } finally {
      setLocationLoading(false);
    }
  }

  async function searchRestaurants() {
    const cleanQuery = query.trim();
    if (!cleanQuery) {
      Alert.alert("Arama gerekli", "Ne yemek istediğini yaz.");
      return;
    }

    if (!coords) {
      Alert.alert("Konum bekleniyor", "Konum alındıktan sonra tekrar dene.");
      return;
    }

    Keyboard.dismiss();
    setLoading(true);

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 20000);

    try {
      const searchParams = new URLSearchParams({
        query: cleanQuery,
        lat: String(coords.latitude),
        lng: String(coords.longitude),
      });

      const response = await fetch(
        `${API_URL}/search?${searchParams.toString()}`,
        {
          method: "GET",
          headers: {
            Accept: "application/json",
          },
          signal: controller.signal,
        },
      );

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data?.detail || `Sunucu hatası: ${response.status}`);
      }

      const results = Array.isArray(data?.results) ? data.results : [];
      setRestaurants(results);

      if (results.length === 0) {
        Alert.alert(
          "Sonuç bulunamadı",
          "Bu arama için yakında mekan bulunamadı.",
        );
      }
    } catch (error) {
      const message =
        error instanceof Error
          ? error.name === "AbortError"
            ? "İstek zaman aşımına uğradı. Backend terminalinin açık olduğundan emin ol."
            : error.message
          : "Bilinmeyen bir hata oluştu.";

      Alert.alert(
        "Arama başarısız",
        `${message}

Backend adresi: ${API_URL}`,
      );
    } finally {
      clearTimeout(timeoutId);
      setLoading(false);
    }
  }

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <View>
          <Text style={styles.eyebrow}>LEZZET PUSULASI</Text>
          <Text style={styles.title}>Bugün ne yiyelim?</Text>
        </View>

        <View style={styles.locationPill}>
          <Ionicons name="location" size={16} color="#D92D20" />
          <Text numberOfLines={1} style={styles.locationText}>
            {locationLoading ? "Alınıyor..." : locationText}
          </Text>
        </View>
      </View>

      <View style={styles.searchRow}>
        <View style={styles.searchBox}>
          <Ionicons name="search" size={20} color="#777" />
          <TextInput
            style={styles.searchInput}
            placeholder="Döner, pizza, kahve..."
            placeholderTextColor="#999"
            value={query}
            onChangeText={setQuery}
            onSubmitEditing={() => void searchRestaurants()}
            returnKeyType="search"
            autoCorrect={false}
          />
        </View>

        <Pressable
          onPress={() => void searchRestaurants()}
          disabled={loading}
          style={({ pressed }) => [
            styles.searchButton,
            pressed && styles.buttonPressed,
          ]}
        >
          {loading ? (
            <ActivityIndicator color="#fff" />
          ) : (
            <Ionicons name="arrow-forward" size={22} color="#fff" />
          )}
        </Pressable>
      </View>

      <View style={styles.sectionHeader}>
        <Text style={styles.sectionTitle}>Yakındaki mekanlar</Text>
        {restaurants.length > 0 && (
          <Text style={styles.resultCount}>{restaurants.length} sonuç</Text>
        )}
      </View>

      <FlatList
        data={restaurants}
        keyExtractor={(item) => item.place_id}
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.listContent}
        renderItem={({ item }) => {
          const isOpen = item.open_now === true;
          const statusText = getStatusText(item);

          return (
            <Pressable
              onPress={() =>
                router.push(`/restaurant/${item.place_id}` as never)
              }
              style={({ pressed }) => [
                styles.card,
                pressed && styles.cardPressed,
              ]}
            >
              <View style={styles.cardTopRow}>
                <View style={styles.cardTextArea}>
                  <Text numberOfLines={1} style={styles.cardTitle}>
                    {item.name}
                  </Text>
                  <Text numberOfLines={2} style={styles.cardAddress}>
                    {item.vicinity || "Adres bilgisi yok"}
                  </Text>
                </View>
                <Ionicons name="chevron-forward" size={22} color="#AAA" />
              </View>

              <View style={styles.cardMetaRow}>
                <View style={styles.ratingBadge}>
                  <Ionicons name="star" size={15} color="#F4B400" />
                  <Text style={styles.ratingText}>{item.rating ?? "–"}</Text>
                  {item.user_ratings_total ? (
                    <Text style={styles.reviewText}>
                      ({item.user_ratings_total})
                    </Text>
                  ) : null}
                </View>

                <View
                  style={[
                    styles.statusBadge,
                    isOpen ? styles.openBadge : styles.closedBadge,
                  ]}
                >
                  <View
                    style={[
                      styles.statusDot,
                      isOpen ? styles.openDot : styles.closedDot,
                    ]}
                  />
                  <Text
                    style={[
                      styles.statusText,
                      isOpen ? styles.openText : styles.closedText,
                    ]}
                  >
                    {statusText}
                  </Text>
                </View>
              </View>
            </Pressable>
          );
        }}
        ListEmptyComponent={
          <View style={styles.emptyBox}>
            <View style={styles.emptyIcon}>
              <Ionicons name="restaurant-outline" size={34} color="#D92D20" />
            </View>
            <Text style={styles.emptyTitle}>Bir lezzet ara</Text>
            <Text style={styles.emptyText}>
              Yakınındaki mekanları görmek için yukarıya yemek veya içecek adı
              yaz.
            </Text>
          </View>
        }
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#FFFFFF",
    paddingHorizontal: 20,
    paddingTop: 64,
  },
  header: {
    gap: 16,
  },
  eyebrow: {
    color: "#D92D20",
    fontSize: 12,
    fontWeight: "800",
    letterSpacing: 1.4,
  },
  title: {
    marginTop: 5,
    color: "#171717",
    fontSize: 31,
    fontWeight: "800",
    letterSpacing: -0.8,
  },
  locationPill: {
    alignSelf: "flex-start",
    maxWidth: "100%",
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    borderRadius: 999,
    backgroundColor: "#FFF1F0",
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  locationText: {
    maxWidth: 240,
    color: "#8A1C13",
    fontSize: 13,
    fontWeight: "700",
  },
  searchRow: {
    marginTop: 22,
    flexDirection: "row",
    gap: 10,
  },
  searchBox: {
    flex: 1,
    height: 56,
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    borderWidth: 1,
    borderColor: "#E8E8E8",
    borderRadius: 18,
    backgroundColor: "#F8F8F8",
    paddingHorizontal: 16,
  },
  searchInput: {
    flex: 1,
    color: "#171717",
    fontSize: 16,
  },
  searchButton: {
    width: 56,
    height: 56,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 18,
    backgroundColor: "#D92D20",
  },
  buttonPressed: {
    opacity: 0.78,
    transform: [{ scale: 0.98 }],
  },
  sectionHeader: {
    marginTop: 30,
    marginBottom: 14,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  sectionTitle: {
    color: "#171717",
    fontSize: 21,
    fontWeight: "800",
  },
  resultCount: {
    color: "#777",
    fontSize: 13,
    fontWeight: "600",
  },
  listContent: {
    paddingBottom: 110,
  },
  card: {
    marginBottom: 12,
    borderWidth: 1,
    borderColor: "#ECECEC",
    borderRadius: 20,
    backgroundColor: "#FFFFFF",
    padding: 17,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 5 },
    shadowOpacity: 0.05,
    shadowRadius: 14,
    elevation: 2,
  },
  cardPressed: {
    opacity: 0.74,
    transform: [{ scale: 0.99 }],
  },
  cardTopRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },
  cardTextArea: {
    flex: 1,
  },
  cardTitle: {
    color: "#171717",
    fontSize: 18,
    fontWeight: "800",
  },
  cardAddress: {
    marginTop: 5,
    color: "#707070",
    fontSize: 14,
    lineHeight: 20,
  },
  cardMetaRow: {
    marginTop: 14,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  ratingBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
  },
  ratingText: {
    color: "#292929",
    fontSize: 14,
    fontWeight: "800",
  },
  reviewText: {
    color: "#8A8A8A",
    fontSize: 12,
  },
  statusBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 6,
  },
  openBadge: {
    backgroundColor: "#ECFDF3",
  },
  closedBadge: {
    backgroundColor: "#F5F5F5",
  },
  statusDot: {
    width: 7,
    height: 7,
    borderRadius: 999,
  },
  openDot: {
    backgroundColor: "#12B76A",
  },
  closedDot: {
    backgroundColor: "#98A2B3",
  },
  statusText: {
    fontSize: 12,
    fontWeight: "800",
  },
  openText: {
    color: "#067647",
  },
  closedText: {
    color: "#667085",
  },
  emptyBox: {
    marginTop: 24,
    alignItems: "center",
    borderWidth: 1,
    borderColor: "#EFEFEF",
    borderRadius: 24,
    backgroundColor: "#FAFAFA",
    paddingHorizontal: 28,
    paddingVertical: 34,
  },
  emptyIcon: {
    width: 66,
    height: 66,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 22,
    backgroundColor: "#FFF1F0",
  },
  emptyTitle: {
    marginTop: 16,
    color: "#222",
    fontSize: 18,
    fontWeight: "800",
  },
  emptyText: {
    marginTop: 8,
    color: "#777",
    fontSize: 14,
    lineHeight: 21,
    textAlign: "center",
  },
});