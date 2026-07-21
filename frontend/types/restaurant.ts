export type Restaurant = {
  place_id: string;
  name: string;
  rating?: number;
  user_ratings_total?: number;
  vicinity?: string;
  address?: string;
  business_status?: string;
  open_now?: boolean;
  price_level?: number;
  photo_reference?: string;
  latitude?: number;
  longitude?: number;
  distance_km?: number;
};
