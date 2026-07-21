from __future__ import annotations

import os
from typing import Any

import requests
from dotenv import load_dotenv
from fastapi import FastAPI, HTTPException, Query
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import RedirectResponse

load_dotenv()

app = FastAPI(title="Lezzet Pusulası API")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

API_KEY = os.getenv("GOOGLE_PLACES_API_KEY")
GOOGLE_TIMEOUT_SECONDS = 15


def require_api_key() -> str:
    if not API_KEY:
        raise HTTPException(
            status_code=500,
            detail="GOOGLE_PLACES_API_KEY backend/.env dosyasında bulunamadı.",
        )
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
        message = data.get("error_message") or status or "Bilinmeyen Google Places hatası"
        raise HTTPException(status_code=502, detail=message)
    return data


@app.get("/")
def home() -> dict[str, str]:
    return {"status": "Lezzet Pusulası API Çalışıyor 🚀"}


@app.get("/test")
def test() -> dict[str, bool]:
    return {"google_api_loaded": API_KEY is not None}


@app.get("/search")
def search(query: str, lat: float, lng: float, radius: int = 5000) -> dict[str, Any]:
    api_key = require_api_key()
    radius = max(500, min(radius, 50_000))

    data = google_get(
        "https://maps.googleapis.com/maps/api/place/nearbysearch/json",
        {
            "keyword": query.strip(),
            "location": f"{lat},{lng}",
            "radius": radius,
            "language": "tr",
            "key": api_key,
        },
    )

    results = []
    for item in data.get("results", []):
        photos = item.get("photos") or []
        opening_hours = item.get("opening_hours") or {}
        location = (item.get("geometry") or {}).get("location") or {}
        results.append(
            {
                "place_id": item.get("place_id"),
                "name": item.get("name"),
                "rating": item.get("rating"),
                "user_ratings_total": item.get("user_ratings_total"),
                "vicinity": item.get("vicinity"),
                "business_status": item.get("business_status"),
                "open_now": opening_hours.get("open_now"),
                "price_level": item.get("price_level"),
                "photo_reference": photos[0].get("photo_reference") if photos else None,
                "latitude": location.get("lat"),
                "longitude": location.get("lng"),
            }
        )

    return {"results": results}


@app.get("/place/{place_id}")
def place_details(place_id: str) -> dict[str, Any]:
    api_key = require_api_key()
    data = google_get(
        "https://maps.googleapis.com/maps/api/place/details/json",
        {
            "place_id": place_id,
            "fields": ",".join(
                [
                    "place_id",
                    "name",
                    "formatted_address",
                    "formatted_phone_number",
                    "international_phone_number",
                    "rating",
                    "user_ratings_total",
                    "opening_hours",
                    "business_status",
                    "website",
                    "url",
                    "photos",
                    "geometry",
                    "price_level",
                ]
            ),
            "language": "tr",
            "key": api_key,
        },
    )

    item = data.get("result") or {}
    photos = item.get("photos") or []
    opening_hours = item.get("opening_hours") or {}
    location = (item.get("geometry") or {}).get("location") or {}

    return {
        "place_id": item.get("place_id"),
        "name": item.get("name"),
        "address": item.get("formatted_address"),
        "phone": item.get("formatted_phone_number") or item.get("international_phone_number"),
        "rating": item.get("rating"),
        "user_ratings_total": item.get("user_ratings_total"),
        "business_status": item.get("business_status"),
        "open_now": opening_hours.get("open_now"),
        "weekday_text": opening_hours.get("weekday_text") or [],
        "website": item.get("website"),
        "google_maps_url": item.get("url"),
        "price_level": item.get("price_level"),
        "photo_reference": photos[0].get("photo_reference") if photos else None,
        "latitude": location.get("lat"),
        "longitude": location.get("lng"),
    }


@app.get("/photo")
def place_photo(
    reference: str = Query(min_length=1),
    maxwidth: int = Query(default=1200, ge=100, le=1600),
) -> RedirectResponse:
    api_key = require_api_key()
    photo_url = "https://maps.googleapis.com/maps/api/place/photo"
    response = requests.get(
        photo_url,
        params={"photo_reference": reference, "maxwidth": maxwidth, "key": api_key},
        allow_redirects=False,
        timeout=GOOGLE_TIMEOUT_SECONDS,
    )
    redirect_url = response.headers.get("location")
    if not redirect_url:
        raise HTTPException(status_code=502, detail="Mekan fotoğrafı alınamadı.")
    return RedirectResponse(url=redirect_url)
