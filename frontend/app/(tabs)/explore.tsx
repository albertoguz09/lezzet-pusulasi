import { API_URL } from "@/constants/api";
import { getFavorites, toggleFavorite } from "@/lib/favorites";
import type { Restaurant } from "@/types/restaurant";
import { Ionicons } from "@expo/vector-icons";
import { router, useFocusEffect } from "expo-router";
import { useCallback, useState } from "react";
import { FlatList, Image, Pressable, StyleSheet, Text, View } from "react-native";

export default function FavoritesScreen() {
  const [favorites, setFavorites] = useState<Restaurant[]>([]);
  const load = useCallback(async () => setFavorites(await getFavorites()), []);
  useFocusEffect(useCallback(() => { void load(); }, [load]));

  async function remove(item: Restaurant) { await toggleFavorite(item); await load(); }

  return (
    <View style={styles.container}>
      <Text style={styles.eyebrow}>LEZZET PUSULASI</Text>
      <Text style={styles.title}>Favorilerim</Text>
      <Text style={styles.subtitle}>{favorites.length ? `${favorites.length} kayıtlı mekan` : "Beğendiğin mekanlar burada görünecek."}</Text>
      <FlatList
        data={favorites}
        keyExtractor={(item) => item.place_id}
        contentContainerStyle={styles.list}
        showsVerticalScrollIndicator={false}
        renderItem={({ item }) => {
          const photo = item.photo_reference ? `${API_URL}/photo?reference=${encodeURIComponent(item.photo_reference)}&maxwidth=700` : null;
          return (
            <Pressable style={styles.card} onPress={() => router.push(`/restaurant/${item.place_id}` as never)}>
              {photo ? <Image source={{ uri: photo }} style={styles.image} /> : <View style={[styles.image, styles.fallback]}><Ionicons name="restaurant" size={28} color="#D92D20" /></View>}
              <View style={styles.content}><Text numberOfLines={1} style={styles.name}>{item.name}</Text><Text numberOfLines={2} style={styles.address}>{item.vicinity || item.address || "Adres bilgisi yok"}</Text><View style={styles.meta}><Ionicons name="star" size={15} color="#F4B400" /><Text style={styles.rating}>{item.rating ?? "–"}</Text>{item.distance_km != null && <Text style={styles.distance}>{item.distance_km.toFixed(1)} km</Text>}</View></View>
              <Pressable hitSlop={10} style={styles.remove} onPress={(event) => { event.stopPropagation(); void remove(item); }}><Ionicons name="heart" size={23} color="#D92D20" /></Pressable>
            </Pressable>
          );
        }}
        ListEmptyComponent={<View style={styles.empty}><View style={styles.emptyIcon}><Ionicons name="heart-outline" size={36} color="#D92D20" /></View><Text style={styles.emptyTitle}>Henüz favorin yok</Text><Text style={styles.emptyText}>Ana sayfada bir mekanın kalbine basarak buraya ekleyebilirsin.</Text></View>}
      />
    </View>
  );
}

const styles = StyleSheet.create({container:{flex:1,backgroundColor:"#fff",paddingHorizontal:20,paddingTop:64},eyebrow:{color:"#D92D20",fontSize:12,fontWeight:"800",letterSpacing:1.4},title:{marginTop:5,color:"#171717",fontSize:31,fontWeight:"800"},subtitle:{marginTop:7,color:"#777",fontSize:14},list:{paddingTop:24,paddingBottom:110},card:{marginBottom:13,flexDirection:"row",alignItems:"center",borderWidth:1,borderColor:"#ECECEC",borderRadius:20,backgroundColor:"#fff",padding:10},image:{width:88,height:88,borderRadius:15,backgroundColor:"#FCECEB"},fallback:{alignItems:"center",justifyContent:"center"},content:{flex:1,paddingHorizontal:13},name:{color:"#171717",fontSize:17,fontWeight:"800"},address:{marginTop:5,color:"#777",fontSize:13,lineHeight:18},meta:{marginTop:8,flexDirection:"row",alignItems:"center",gap:4},rating:{fontSize:13,fontWeight:"800"},distance:{marginLeft:8,color:"#777",fontSize:12},remove:{width:42,height:42,alignItems:"center",justifyContent:"center"},empty:{marginTop:55,alignItems:"center",paddingHorizontal:26},emptyIcon:{width:72,height:72,alignItems:"center",justifyContent:"center",borderRadius:24,backgroundColor:"#FFF1F0"},emptyTitle:{marginTop:18,color:"#222",fontSize:19,fontWeight:"800"},emptyText:{marginTop:8,color:"#777",fontSize:14,lineHeight:21,textAlign:"center"}});
