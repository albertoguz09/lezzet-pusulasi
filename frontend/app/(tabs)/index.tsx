import { API_URL } from "@/constants/api";
import { getFavorites, toggleFavorite } from "@/lib/favorites";
import type { Restaurant } from "@/types/restaurant";
import { Ionicons } from "@expo/vector-icons";
import * as Location from "expo-location";
import { router, useFocusEffect } from "expo-router";
import { useCallback, useEffect, useMemo, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  FlatList,
  Image,
  Keyboard,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";

type Coordinates = { latitude: number; longitude: number };
type SortMode = "near" | "rating" | "price";

const priceLabel = (level?: number) => (level == null ? "–" : "₺".repeat(Math.max(1, level)));

export default function HomeScreen() {
  const [locationText, setLocationText] = useState("Konum alınıyor...");
  const [query, setQuery] = useState("");
  const [coords, setCoords] = useState<Coordinates | null>(null);
  const [restaurants, setRestaurants] = useState<Restaurant[]>([]);
  const [favoriteIds, setFavoriteIds] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(false);
  const [locationLoading, setLocationLoading] = useState(true);
  const [sortMode, setSortMode] = useState<SortMode>("near");
  const [openOnly, setOpenOnly] = useState(false);
  const [minRating, setMinRating] = useState<0 | 4 | 4.5>(0);
  const [priceFilter, setPriceFilter] = useState<number | null>(null);

  useEffect(() => { void getLocation(); }, []);
  useFocusEffect(useCallback(() => { void refreshFavorites(); }, []));

  async function refreshFavorites() {
    const items = await getFavorites();
    setFavoriteIds(new Set(items.map((item) => item.place_id)));
  }

  async function getLocation() {
    setLocationLoading(true);
    try {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== "granted") { setLocationText("Konum izni verilmedi"); return; }
      const current = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.High });
      const nextCoords = { latitude: current.coords.latitude, longitude: current.coords.longitude };
      setCoords(nextCoords);
      try {
        const [address] = await Location.reverseGeocodeAsync(nextCoords);
        const readable = [address?.district, address?.subregion, address?.city]
          .filter(Boolean)
          .filter((value, index, values) => values.indexOf(value) === index)
          .slice(0, 2)
          .join(", ");
        setLocationText(readable || "Konum hazır");
      } catch { setLocationText("Konum hazır"); }
    } catch { setLocationText("Konum alınamadı"); }
    finally { setLocationLoading(false); }
  }

  async function searchRestaurants() {
    const cleanQuery = query.trim();
    if (!cleanQuery) { Alert.alert("Arama gerekli", "Ne yemek istediğini yaz."); return; }
    if (!coords) { Alert.alert("Konum bekleniyor", "Konum alındıktan sonra tekrar dene."); return; }
    Keyboard.dismiss(); setLoading(true);
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 20000);
    try {
      const params = new URLSearchParams({ query: cleanQuery, lat: String(coords.latitude), lng: String(coords.longitude) });
      const response = await fetch(`${API_URL}/search?${params.toString()}`, { signal: controller.signal });
      const data = await response.json();
      if (!response.ok) throw new Error(data?.detail || `Sunucu hatası: ${response.status}`);
      const results = Array.isArray(data?.results) ? data.results : [];
      setRestaurants(results);
      if (!results.length) Alert.alert("Sonuç bulunamadı", "Yakınında bu yemekle ilgili uygun bir mekan bulunamadı.");
    } catch (error) {
      const message = error instanceof Error
        ? error.name === "AbortError" ? "İstek zaman aşımına uğradı." : error.message
        : "Bilinmeyen hata";
      Alert.alert("Arama başarısız", message);
    } finally { clearTimeout(timeoutId); setLoading(false); }
  }

  async function onToggleFavorite(item: Restaurant) {
    const added = await toggleFavorite(item);
    await refreshFavorites();
    Alert.alert(added ? "Favorilere eklendi" : "Favorilerden çıkarıldı", item.name);
  }

  const visibleRestaurants = useMemo(() => {
    let list = restaurants.filter((item) => {
      if (openOnly && item.open_now !== true) return false;
      if (minRating && (item.rating ?? 0) < minRating) return false;
      if (priceFilter != null && item.price_level !== priceFilter) return false;
      return true;
    });
    list = [...list].sort((a, b) => {
      if (sortMode === "rating") return (b.rating ?? 0) - (a.rating ?? 0);
      if (sortMode === "price") return (a.price_level ?? 99) - (b.price_level ?? 99);
      return (a.distance_km ?? 999) - (b.distance_km ?? 999);
    });
    return list;
  }, [restaurants, openOnly, minRating, priceFilter, sortMode]);

  function FilterChip({ active, label, onPress, icon }: { active: boolean; label: string; onPress: () => void; icon?: keyof typeof Ionicons.glyphMap }) {
    return (
      <Pressable onPress={onPress} style={[styles.filterChip, active && styles.filterChipActive]}>
        {icon ? <Ionicons name={icon} size={15} color={active ? "#fff" : "#5F5F5F"} /> : null}
        <Text style={[styles.filterText, active && styles.filterTextActive]}>{label}</Text>
      </Pressable>
    );
  }

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <View><Text style={styles.eyebrow}>LEZZET PUSULASI</Text><Text style={styles.title}>Bugün ne yiyelim?</Text></View>
        <Pressable style={styles.locationPill} onPress={() => void getLocation()}>
          <Ionicons name="location" size={16} color="#D92D20" />
          <Text numberOfLines={1} style={styles.locationText}>{locationLoading ? "Alınıyor..." : locationText}</Text>
        </Pressable>
      </View>

      <View style={styles.searchRow}>
        <View style={styles.searchBox}><Ionicons name="search" size={20} color="#777" /><TextInput style={styles.searchInput} placeholder="Döner, keşkek, pizza..." placeholderTextColor="#999" value={query} onChangeText={setQuery} onSubmitEditing={() => void searchRestaurants()} returnKeyType="search" autoCorrect={false} /></View>
        <Pressable onPress={() => void searchRestaurants()} disabled={loading} style={({ pressed }) => [styles.searchButton, pressed && styles.pressed]}>{loading ? <ActivityIndicator color="#fff" /> : <Ionicons name="arrow-forward" size={22} color="#fff" />}</Pressable>
      </View>

      {restaurants.length > 0 && (
        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.filtersScroll} contentContainerStyle={styles.filters}>
          <FilterChip active={sortMode === "near"} label="En yakın" icon="navigate-outline" onPress={() => setSortMode("near")} />
          <FilterChip active={sortMode === "rating"} label="En yüksek puan" icon="star-outline" onPress={() => setSortMode("rating")} />
          <FilterChip active={sortMode === "price"} label="En uygun" icon="cash-outline" onPress={() => setSortMode("price")} />
          <FilterChip active={openOnly} label="Şu an açık" icon="time-outline" onPress={() => setOpenOnly((v) => !v)} />
          <FilterChip active={minRating === 4} label="4.0+" onPress={() => setMinRating(minRating === 4 ? 0 : 4)} />
          <FilterChip active={minRating === 4.5} label="4.5+" onPress={() => setMinRating(minRating === 4.5 ? 0 : 4.5)} />
          {[1,2,3,4].map((level) => <FilterChip key={level} active={priceFilter === level} label={"₺".repeat(level)} onPress={() => setPriceFilter(priceFilter === level ? null : level)} />)}
        </ScrollView>
      )}

      <View style={styles.sectionHeader}><Text style={styles.sectionTitle}>Yakındaki mekanlar</Text>{restaurants.length > 0 && <Text style={styles.resultCount}>{visibleRestaurants.length} sonuç</Text>}</View>

      <FlatList
        data={visibleRestaurants}
        keyExtractor={(item) => item.place_id}
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.listContent}
        renderItem={({ item }) => {
          const photoUrl = item.photo_reference ? `${API_URL}/photo?reference=${encodeURIComponent(item.photo_reference)}&maxwidth=800` : null;
          const favored = favoriteIds.has(item.place_id);
          return (
            <Pressable onPress={() => router.push(`/restaurant/${item.place_id}` as never)} style={({ pressed }) => [styles.card, pressed && styles.cardPressed]}>
              {photoUrl ? <Image source={{ uri: photoUrl }} style={styles.cardImage} /> : <View style={[styles.cardImage, styles.imageFallback]}><Ionicons name="restaurant" size={34} color="#D92D20" /></View>}
              <Pressable hitSlop={10} onPress={(event) => { event.stopPropagation(); void onToggleFavorite(item); }} style={styles.heartButton}>
                <Ionicons name={favored ? "heart" : "heart-outline"} size={23} color="#D92D20" />
              </Pressable>
              <View style={styles.cardBody}>
                <Text numberOfLines={1} style={styles.cardTitle}>{item.name}</Text>
                <Text numberOfLines={2} style={styles.cardAddress}>{item.vicinity || "Adres bilgisi yok"}</Text>
                <View style={styles.cardMetaRow}>
                  <View style={styles.ratingBadge}><Ionicons name="star" size={15} color="#F4B400" /><Text style={styles.ratingText}>{item.rating ?? "–"}</Text>{item.user_ratings_total ? <Text style={styles.reviewText}>({item.user_ratings_total})</Text> : null}</View>
                  <Text style={styles.distanceText}>{item.distance_km != null ? `${item.distance_km.toFixed(1)} km` : ""}</Text>
                  <Text style={styles.priceText}>{priceLabel(item.price_level)}</Text>
                </View>
                <View style={[styles.statusBadge, item.open_now ? styles.openBadge : styles.closedBadge]}><View style={[styles.statusDot, item.open_now ? styles.openDot : styles.closedDot]} /><Text style={[styles.statusText, item.open_now ? styles.openText : styles.closedText]}>{item.open_now === true ? "Şu an açık" : item.open_now === false ? "Şu an kapalı" : "Durum bilinmiyor"}</Text></View>
              </View>
            </Pressable>
          );
        }}
        ListEmptyComponent={<View style={styles.emptyBox}><View style={styles.emptyIcon}><Ionicons name="restaurant-outline" size={34} color="#D92D20" /></View><Text style={styles.emptyTitle}>{restaurants.length ? "Filtreye uygun sonuç yok" : "Bir lezzet ara"}</Text><Text style={styles.emptyText}>{restaurants.length ? "Filtrelerden bazılarını kaldırmayı dene." : "Yakınındaki mekanları görmek için yemek veya içecek adı yaz."}</Text></View>}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container:{flex:1,backgroundColor:"#fff",paddingHorizontal:20,paddingTop:64}, header:{gap:16}, eyebrow:{color:"#D92D20",fontSize:12,fontWeight:"800",letterSpacing:1.4}, title:{marginTop:5,color:"#171717",fontSize:31,fontWeight:"800",letterSpacing:-.8},
  locationPill:{alignSelf:"flex-start",maxWidth:"100%",flexDirection:"row",alignItems:"center",gap:6,borderRadius:999,backgroundColor:"#FFF1F0",paddingHorizontal:12,paddingVertical:8}, locationText:{maxWidth:250,color:"#8A1C13",fontSize:13,fontWeight:"700"},
  searchRow:{marginTop:22,flexDirection:"row",gap:10}, searchBox:{flex:1,height:56,flexDirection:"row",alignItems:"center",gap:10,borderWidth:1,borderColor:"#E8E8E8",borderRadius:18,backgroundColor:"#F8F8F8",paddingHorizontal:16}, searchInput:{flex:1,color:"#171717",fontSize:16}, searchButton:{width:56,height:56,alignItems:"center",justifyContent:"center",borderRadius:18,backgroundColor:"#D92D20"}, pressed:{opacity:.78},
  filtersScroll:{flexGrow:0,height:58,marginTop:8}, filters:{alignItems:"center",gap:8,paddingVertical:10,paddingRight:20}, filterChip:{height:38,flexDirection:"row",alignItems:"center",justifyContent:"center",gap:5,borderWidth:1,borderColor:"#E5E5E5",borderRadius:999,backgroundColor:"#FAFAFA",paddingHorizontal:13}, filterChipActive:{borderColor:"#D92D20",backgroundColor:"#D92D20"}, filterText:{color:"#5F5F5F",fontSize:13,fontWeight:"700"}, filterTextActive:{color:"#fff"},
  sectionHeader:{marginTop:12,marginBottom:14,flexDirection:"row",alignItems:"center",justifyContent:"space-between"}, sectionTitle:{color:"#171717",fontSize:21,fontWeight:"800"}, resultCount:{color:"#777",fontSize:13,fontWeight:"600"}, listContent:{paddingBottom:110},
  card:{marginBottom:16,borderWidth:1,borderColor:"#ECECEC",borderRadius:22,backgroundColor:"#fff",overflow:"hidden",shadowColor:"#000",shadowOffset:{width:0,height:5},shadowOpacity:.06,shadowRadius:14,elevation:2}, cardPressed:{opacity:.82,transform:[{scale:.995}]}, cardImage:{width:"100%",height:158,backgroundColor:"#FCECEB"}, imageFallback:{alignItems:"center",justifyContent:"center"}, heartButton:{position:"absolute",right:12,top:12,width:42,height:42,alignItems:"center",justifyContent:"center",borderRadius:21,backgroundColor:"rgba(255,255,255,.94)"}, cardBody:{padding:16}, cardTitle:{color:"#171717",fontSize:18,fontWeight:"800"}, cardAddress:{marginTop:5,color:"#707070",fontSize:14,lineHeight:20}, cardMetaRow:{marginTop:13,flexDirection:"row",alignItems:"center",gap:10}, ratingBadge:{flexDirection:"row",alignItems:"center",gap:4}, ratingText:{color:"#292929",fontSize:14,fontWeight:"800"}, reviewText:{color:"#8A8A8A",fontSize:12}, distanceText:{color:"#555",fontSize:13,fontWeight:"700"}, priceText:{marginLeft:"auto",color:"#8A1C13",fontSize:14,fontWeight:"800"}, statusBadge:{marginTop:12,alignSelf:"flex-start",flexDirection:"row",alignItems:"center",gap:6,borderRadius:999,paddingHorizontal:10,paddingVertical:6}, openBadge:{backgroundColor:"#ECFDF3"},closedBadge:{backgroundColor:"#F5F5F5"},statusDot:{width:7,height:7,borderRadius:999},openDot:{backgroundColor:"#12B76A"},closedDot:{backgroundColor:"#98A2B3"},statusText:{fontSize:12,fontWeight:"800"},openText:{color:"#067647"},closedText:{color:"#667085"},
  emptyBox:{marginTop:24,alignItems:"center",borderWidth:1,borderColor:"#EFEFEF",borderRadius:24,backgroundColor:"#FAFAFA",paddingHorizontal:28,paddingVertical:34},emptyIcon:{width:66,height:66,alignItems:"center",justifyContent:"center",borderRadius:22,backgroundColor:"#FFF1F0"},emptyTitle:{marginTop:16,color:"#222",fontSize:18,fontWeight:"800"},emptyText:{marginTop:8,color:"#777",fontSize:14,lineHeight:21,textAlign:"center"}
});
