"""Prépare la carte d'altitude réelle de la région de Gokyo (Népal) pour la page d'accueil.

Zone : carré de 90 km de côté centré entre Gokyo et l'Everest
(Gokyo, Ngozumpa, Cho Oyu, Everest, Lhotse, Makalu).
Source : Copernicus DEM GLO-30 (ESA, données ouvertes, ~30 m), via AWS Open Data.
Secours : tuiles d'altitude « Terrarium » d'AWS (Mapzen / Tilezen).

Sortie : assets/relief.png — image RVB de N×N pixels ; altitude en quarts de mètre
sur 16 bits : valeur = R*256 + G ; altitude (m) = valeur / 4. Ligne 0 = nord.
         assets/relief.json — métadonnées (zone, altitudes min/max, source).
"""
import io, json, math, sys, urllib.request
import numpy as np
from PIL import Image

LAT0, LON0 = 27.975, 86.830   # centre de la zone
COTE_KM = 90.0
N = 1152                      # pixels de côté (≈ 78 m par pixel)
SUR = 3                       # suréchantillonnage puis moyenne (anti-crénelage)

def grille():
    n = N * SUR
    km = (np.arange(n) + .5) / n * COTE_KM - COTE_KM / 2
    x, y = np.meshgrid(km, -km)          # y vers le nord, ligne 0 = nord
    lat = LAT0 + y / 110.95
    lon = LON0 + x / (111.32 * math.cos(math.radians(LAT0)))
    return lat, lon

def copernicus(lat, lon):
    import rasterio
    out = np.full(lat.shape, np.nan, dtype=np.float64)
    for la in range(int(math.floor(lat.min())), int(math.floor(lat.max())) + 1):
        for lo in range(int(math.floor(lon.min())), int(math.floor(lon.max())) + 1):
            nom = f"Copernicus_DSM_COG_10_N{la:02d}_00_E{lo:03d}_00_DEM"
            url = f"https://copernicus-dem-30m.s3.amazonaws.com/{nom}/{nom}.tif"
            print("lecture", nom, flush=True)
            with rasterio.open(url) as src:
                z = src.read(1).astype(np.float64)
                inv = ~src.transform
                m = (lat >= la) & (lat < la + 1) & (lon >= lo) & (lon < lo + 1)
                c, r = inv * (lon[m], lat[m])
                c = np.clip(c - .5, 0, z.shape[1] - 1.001); r = np.clip(r - .5, 0, z.shape[0] - 1.001)
                c0, r0 = np.floor(c).astype(int), np.floor(r).astype(int); fc, fr = c - c0, r - r0
                out[m] = (z[r0, c0] * (1 - fc) * (1 - fr) + z[r0, c0 + 1] * fc * (1 - fr)
                          + z[r0 + 1, c0] * (1 - fc) * fr + z[r0 + 1, c0 + 1] * fc * fr)
    if np.isnan(out).any():
        raise RuntimeError("zone incomplète")
    return out, "Copernicus DEM GLO-30 (ESA)"

def terrarium(lat, lon, z=12):
    def tuile_xy(la, lo):
        n = 2 ** z
        x = (lo + 180) / 360 * n
        y = (1 - math.asinh(math.tan(math.radians(la))) / math.pi) / 2 * n
        return x, y
    n = 2 ** z
    X = (lon + 180) / 360 * n * 256
    Y = (1 - np.arcsinh(np.tan(np.radians(lat))) / np.pi) / 2 * n * 256
    tx0, ty0 = int(X.min() // 256), int(Y.min() // 256)
    tx1, ty1 = int(X.max() // 256), int(Y.max() // 256)
    mos = np.zeros(((ty1 - ty0 + 1) * 256, (tx1 - tx0 + 1) * 256))
    for ty in range(ty0, ty1 + 1):
        for tx in range(tx0, tx1 + 1):
            url = f"https://s3.amazonaws.com/elevation-tiles-prod/terrarium/{z}/{tx}/{ty}.png"
            im = np.asarray(Image.open(io.BytesIO(urllib.request.urlopen(url, timeout=60).read())).convert("RGB")).astype(np.float64)
            mos[(ty - ty0) * 256:(ty - ty0 + 1) * 256, (tx - tx0) * 256:(tx - tx0 + 1) * 256] = im[..., 0] * 256 + im[..., 1] + im[..., 2] / 256 - 32768
    c = np.clip(X - tx0 * 256 - .5, 0, mos.shape[1] - 1.001); r = np.clip(Y - ty0 * 256 - .5, 0, mos.shape[0] - 1.001)
    c0, r0 = np.floor(c).astype(int), np.floor(r).astype(int); fc, fr = c - c0, r - r0
    out = (mos[r0, c0] * (1 - fc) * (1 - fr) + mos[r0, c0 + 1] * fc * (1 - fr)
           + mos[r0 + 1, c0] * (1 - fc) * fr + mos[r0 + 1, c0 + 1] * fc * fr)
    return out, "Terrarium (AWS Open Data)"

def main():
    lat, lon = grille()
    try:
        z, source = copernicus(lat, lon)
    except Exception as e:
        print("Copernicus indisponible :", e, "→ secours Terrarium", flush=True)
        z, source = terrarium(lat, lon)
    z = z.reshape(N, SUR, N, SUR).mean(axis=(1, 3))
    z = np.clip(z, 0, 16000)
    v = np.round(z * 4).astype(np.uint32)
    rgb = np.zeros((N, N, 3), dtype=np.uint8)
    rgb[..., 0] = v >> 8; rgb[..., 1] = v & 255
    Image.fromarray(rgb, "RGB").save("assets/relief.png", optimize=True)
    meta = {"centre": [LAT0, LON0], "cote_km": COTE_KM, "pixels": N, "min_m": round(float(z.min()), 1),
            "max_m": round(float(z.max()), 1), "source": source, "codage": "altitude_m = (R*256+G)/4 ; ligne 0 = nord"}
    json.dump(meta, open("assets/relief.json", "w"), ensure_ascii=False, indent=1)
    print(meta)

if __name__ == "__main__":
    main()
