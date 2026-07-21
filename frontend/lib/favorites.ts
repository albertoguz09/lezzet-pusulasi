import AsyncStorage from "@react-native-async-storage/async-storage";
import type { Restaurant } from "@/types/restaurant";

const FAVORITES_KEY = "lezzet-pusulasi:favorites:v1";

export async function getFavorites(): Promise<Restaurant[]> {
  try {
    const raw = await AsyncStorage.getItem(FAVORITES_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

export async function isFavorite(placeId: string): Promise<boolean> {
  const favorites = await getFavorites();
  return favorites.some((item) => item.place_id === placeId);
}

export async function toggleFavorite(restaurant: Restaurant): Promise<boolean> {
  const favorites = await getFavorites();
  const exists = favorites.some((item) => item.place_id === restaurant.place_id);
  const next = exists
    ? favorites.filter((item) => item.place_id !== restaurant.place_id)
    : [restaurant, ...favorites];
  await AsyncStorage.setItem(FAVORITES_KEY, JSON.stringify(next));
  return !exists;
}
