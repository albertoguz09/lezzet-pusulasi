from __future__ import annotations

import math
import os
import re
from typing import Any

import requests
from dotenv import load_dotenv
from fastapi import FastAPI, HTTPException, Query
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import RedirectResponse

load_dotenv()
app = FastAPI(title="Lezzet Pusulası API")
app.add_middleware(CORSMiddleware, allow_origins=["*"], allow_credentials=True, allow_methods=["*"], allow_headers=["*"])

API_KEY = os.getenv("GOOGLE_PLACES_API_KEY")
GOOGLE_TIMEOUT_SECONDS = 15
FOOD_TYPES = {"restaurant", "food", "cafe", "bakery", "meal_takeaway", "meal_delivery", "bar"}
EXCLUDED_TYPES = {"car_repair", "car_wash", "plumber", "electrician", "hardware_store", "home_goods_store", "laundry", "storage", "moving_company", "real_estate_agency", "insurance_agency", "travel_agency", "beauty_salon", "hair_care", "dentist", "doctor", "hospital", "pharmacy", "school", "university", "gym"}

def require_api_key() -> str:
    if not API_KEY:
        raise HTTPException(status_code=500, detail="GOOGLE_PLACES_API_KEY backend/.env dosyasında bulunamadı.")
    return API_KEY

def google_get(url: str, params: dict[str, Any]) -> dict[str, Any]:
    try:
        response = requests.get(url, params=params, timeout=GOOGLE_TIMEOUT_SECONDS)
        response.raise_for_status()
    except requests.RequestException as exc:
        raise HTTPException(status_code=502, detail=f"Google servisine ulaşılamadı: {exc}") from exc
    data = response.json()
    status = data.get("status")
    if status not in {"OK", "ZERO_RESULTS"}:
        raise HTTPException(status_code=502, detail=data.get("error_message") or status or "Google Places hatası")
    return data

def distance_km(lat1: float, lng1: float, lat2: float | None, lng2: float | None) -> float | None:
    if lat2 is None or lng2 is None:
        return None
    radius = 6371.0
    p1, p2 = math.radians(lat1), math.radians(lat2)
    dp, dl = math.radians(lat2-lat1), math.radians(lng2-lng1)
    a = math.sin(dp/2)**2 + math.cos(p1)*math.cos(p2)*math.sin(dl/2)**2
    return radius * 2 * math.atan2(math.sqrt(a), math.sqrt(1-a))

def normalize(text: str) -> str:
    text = text.casefold().replace("ı", "i")
    return re.sub(r"[^a-z0-9çğıöşü ]+", " ", text)

def is_food_place(item: dict[str, Any]) -> bool:
    types = set(item.get("types") or [])
    if types & EXCLUDED_TYPES:
        return False
    return bool(types & FOOD_TYPES)

@app.get("/")
def home() -> dict[str, str]:
    return {"status": "Lezzet Pusulası API Çalışıyor 🚀"}

@app.get("/test")
def test() -> dict[str, bool]:
    return {"google_api_loaded": API_KEY is not None}

@app.get("/search")
def search(query: str, lat: float, lng: float, radius: int = 10000) -> dict[str, Any]:
    api_key = require_api_key()
    clean_query = " ".join(query.strip().split())
    if not clean_query:
        raise HTTPException(status_code=400, detail="Arama kelimesi boş olamaz.")
    radius = max(1000, min(radius, 50_000))

    # Text Search yemek adlarında Nearby Search'e göre daha isabetlidir.
    data = google_get("https://maps.googleapis.com/maps/api/place/textsearch/json", {
        "query": f"{clean_query} restoran yemek",
        "location": f"{lat},{lng}",
        "radius": radius,
        "language": "tr",
        "region": "tr",
        "key": api_key,
    })

    query_words = set(normalize(clean_query).split())
    results: list[dict[str, Any]] = []
    for item in data.get("results", []):
        if not is_food_place(item):
            continue
        photos = item.get("photos") or []
        opening = item.get("opening_hours") or {}
        location = (item.get("geometry") or {}).get("location") or {}
        name_words = set(normalize(item.get("name") or "").split())
        distance = distance_km(lat, lng, location.get("lat"), location.get("lng"))
        relevance = len(query_words & name_words)
        results.append({
            "place_id": item.get("place_id"), "name": item.get("name"), "rating": item.get("rating"),
            "user_ratings_total": item.get("user_ratings_total"), "vicinity": item.get("formatted_address") or item.get("vicinity"),
            "business_status": item.get("business_status"), "open_now": opening.get("open_now"), "price_level": item.get("price_level"),
            "photo_reference": photos[0].get("photo_reference") if photos else None,
            "latitude": location.get("lat"), "longitude": location.get("lng"), "distance_km": round(distance, 2) if distance is not None else None,
            "_relevance": relevance,
        })

    # Kelime adıyla eşleşenleri öne al, sonra mesafeye göre sırala.
    results.sort(key=lambda x: (-x.pop("_relevance"), x.get("distance_km") if x.get("distance_km") is not None else 999))
    return {"results": results[:20]}

@app.get("/place/{place_id}")
def place_details(place_id: str) -> dict[str, Any]:
    data = google_get("https://maps.googleapis.com/maps/api/place/details/json", {
        "place_id": place_id,
        "fields": "place_id,name,formatted_address,formatted_phone_number,international_phone_number,rating,user_ratings_total,opening_hours,business_status,website,url,photos,geometry,price_level",
        "language": "tr", "key": require_api_key(),
    })
    item = data.get("result") or {}; photos = item.get("photos") or []; opening = item.get("opening_hours") or {}; location = (item.get("geometry") or {}).get("location") or {}
    return {"place_id": item.get("place_id"), "name": item.get("name"), "address": item.get("formatted_address"), "phone": item.get("formatted_phone_number") or item.get("international_phone_number"), "rating": item.get("rating"), "user_ratings_total": item.get("user_ratings_total"), "business_status": item.get("business_status"), "open_now": opening.get("open_now"), "weekday_text": opening.get("weekday_text") or [], "website": item.get("website"), "google_maps_url": item.get("url"), "price_level": item.get("price_level"), "photo_reference": photos[0].get("photo_reference") if photos else None, "latitude": location.get("lat"), "longitude": location.get("lng")}

@app.get("/photo")
def place_photo(reference: str = Query(min_length=1), maxwidth: int = Query(default=1200, ge=100, le=1600)) -> RedirectResponse:
    response = requests.get("https://maps.googleapis.com/maps/api/place/photo", params={"photo_reference": reference, "maxwidth": maxwidth, "key": require_api_key()}, allow_redirects=False, timeout=GOOGLE_TIMEOUT_SECONDS)
    redirect_url = response.headers.get("location")
    if not redirect_url:
        raise HTTPException(status_code=502, detail="Mekan fotoğrafı alınamadı.")
    return RedirectResponse(url=redirect_url)
