from __future__ import annotations

import hashlib
import math
from dataclasses import dataclass

REGION_WEST, REGION_SOUTH = 68.5, 38.4
REGION_EAST, REGION_NORTH = 80.7, 43.7
REGION = (REGION_WEST, REGION_SOUTH, REGION_EAST, REGION_NORTH)
GRID_DEG = 0.25

MAX_POLYGON_VERTICES = 500
MAX_POLYGON_CHARS = 20_000
MAX_BBOX_CHARS = 64

BBox = tuple[float, float, float, float]
Point = tuple[float, float]
Polygon = tuple[Point, ...]

KM_PER_DEGREE = 111.32
KM_PER_DEGREE_LAT = 110.574
EPS = 1e-9


class GeoError(ValueError):
    pass


@dataclass(frozen=True, slots=True)
class Cell:
    row: int
    col: int

    @property
    def west(self) -> float:
        return REGION_WEST + self.col * GRID_DEG

    @property
    def south(self) -> float:
        return REGION_SOUTH + self.row * GRID_DEG

    @property
    def east(self) -> float:
        return min(self.west + GRID_DEG, REGION_EAST)

    @property
    def north(self) -> float:
        return min(self.south + GRID_DEG, REGION_NORTH)

    @property
    def lon(self) -> float:
        return (self.west + self.east) / 2

    @property
    def lat(self) -> float:
        return (self.south + self.north) / 2


@dataclass(frozen=True, slots=True)
class Aoi:
    id: str
    kind: str
    bbox: BBox
    polygon: Polygon | None
    cells: tuple[Cell, ...]
    bbox_cells: int
    area_km2: float

    @property
    def cells_inside(self) -> int:
        return len(self.cells)

    @property
    def cells_partial(self) -> int:
        return self.bbox_cells - len(self.cells)

    @property
    def coverage_fraction(self) -> float:
        return len(self.cells) / self.bbox_cells if self.bbox_cells else 0.0

    @property
    def area_share(self) -> float:
        return len(self.cells) / len(REGION_CELLS)


ROWS = math.ceil((REGION_NORTH - REGION_SOUTH) / GRID_DEG)
COLS = math.ceil((REGION_EAST - REGION_WEST) / GRID_DEG)
REGION_CELLS = tuple(Cell(row, col) for row in range(ROWS) for col in range(COLS))


def parse_bbox(raw: str) -> BBox:
    if len(raw) > MAX_BBOX_CHARS:
        raise GeoError("bbox is too long")
    parts = raw.split(",")
    if len(parts) != 4:
        raise GeoError("bbox must be 'west,south,east,north'")
    try:
        values = tuple(float(part) for part in parts)
    except ValueError as exc:
        raise GeoError("bbox must contain four numbers") from exc
    return validate_bbox(values)


def validate_bbox(values: tuple[float, ...]) -> BBox:
    if len(values) != 4 or not all(math.isfinite(value) for value in values):
        raise GeoError("bbox must contain four finite numbers")
    west, south, east, north = values
    if not -180 <= west < east <= 180:
        raise GeoError("bbox longitude must satisfy -180 <= west < east <= 180")
    if not -90 <= south < north <= 90:
        raise GeoError("bbox latitude must satisfy -90 <= south < north <= 90")
    return west, south, east, north


def parse_polygon(raw: str) -> Polygon:
    if len(raw) > MAX_POLYGON_CHARS:
        raise GeoError("polygon is too long")
    points: list[Point] = []
    for chunk in raw.split(";"):
        chunk = chunk.strip()
        if not chunk:
            continue
        pair = chunk.split(",")
        if len(pair) != 2:
            raise GeoError("each polygon vertex must be 'lon,lat'")
        try:
            lon, lat = (float(value) for value in pair)
        except ValueError as exc:
            raise GeoError("polygon vertices must be numbers") from exc
        if not (math.isfinite(lon) and math.isfinite(lat)):
            raise GeoError("polygon vertices must be finite")
        if not -180 <= lon <= 180 or not -90 <= lat <= 90:
            raise GeoError("polygon vertex is outside valid lon/lat ranges")
        points.append((lon, lat))
    if len(points) < 3:
        raise GeoError("polygon needs at least 3 vertices")
    if len(points) > MAX_POLYGON_VERTICES:
        raise GeoError(f"polygon is limited to {MAX_POLYGON_VERTICES} vertices")
    return tuple(points)


def polygon_bbox(polygon: Polygon) -> BBox:
    lons = [point[0] for point in polygon]
    lats = [point[1] for point in polygon]
    return validate_bbox((min(lons), min(lats), max(lons), max(lats)))


def point_in_polygon(lon: float, lat: float, polygon: Polygon) -> bool:
    inside = False
    for index, (x1, y1) in enumerate(polygon):
        x2, y2 = polygon[(index + 1) % len(polygon)]
        if (y1 > lat) == (y2 > lat):
            continue
        crossing = x1 + (lat - y1) * (x2 - x1) / (y2 - y1)
        if lon < crossing:
            inside = not inside
    return inside


def bbox_area_km2(bbox: BBox) -> float:
    west, south, east, north = bbox
    mean_lat = math.radians((south + north) / 2)
    return (east - west) * math.cos(mean_lat) * KM_PER_DEGREE * (north - south) * KM_PER_DEGREE_LAT


def polygon_area_km2(polygon: Polygon) -> float:
    mean_lat = math.radians(sum(point[1] for point in polygon) / len(polygon))
    projected = [
        (lon * math.cos(mean_lat) * KM_PER_DEGREE, lat * KM_PER_DEGREE_LAT) for lon, lat in polygon
    ]
    area = 0.0
    for index, (x1, y1) in enumerate(projected):
        x2, y2 = projected[(index + 1) % len(projected)]
        area += x1 * y2 - x2 * y1
    return abs(area) / 2


def _cells_touching(bbox: BBox) -> tuple[Cell, ...]:
    west, south, east, north = bbox
    cells = [
        cell
        for cell in REGION_CELLS
        if cell.west < east - EPS
        and cell.east > west + EPS
        and cell.south < north - EPS
        and cell.north > south + EPS
    ]
    return tuple(cells)


def _cell_touches_polygon(cell: Cell, polygon: Polygon) -> bool:
    if point_in_polygon(cell.lon, cell.lat, polygon):
        return True
    corners = (
        (cell.west, cell.south),
        (cell.east, cell.south),
        (cell.east, cell.north),
        (cell.west, cell.north),
    )
    if any(point_in_polygon(lon, lat, polygon) for lon, lat in corners):
        return True
    return any(
        cell.west <= lon <= cell.east and cell.south <= lat <= cell.north for lon, lat in polygon
    )


def describe_aoi(bbox: BBox, polygon: Polygon | None = None) -> Aoi:
    bbox = validate_bbox(bbox)
    if polygon is not None and len(polygon) < 3:
        raise GeoError("polygon needs at least 3 vertices")

    bbox_cells = _cells_touching(bbox)
    if polygon is None:
        cells = bbox_cells
    else:
        cells = tuple(cell for cell in bbox_cells if _cell_touches_polygon(cell, polygon))

    if not cells:
        raise GeoError("AOI does not overlap any analysis cell")

    rounded = tuple(round(value, 5) for value in bbox)
    key = f"{rounded}|{polygon}"
    digest = hashlib.sha1(key.encode(), usedforsecurity=False).hexdigest()[:12]

    return Aoi(
        id=f"aoi_{digest}",
        kind="polygon" if polygon is not None else "bbox",
        bbox=bbox,
        polygon=polygon,
        cells=cells,
        bbox_cells=len(bbox_cells),
        area_km2=polygon_area_km2(polygon) if polygon is not None else bbox_area_km2(bbox),
    )


def outside_region(bbox: BBox) -> str | None:
    west, south, east, north = bbox
    if (
        west >= REGION_WEST
        and south >= REGION_SOUTH
        and east <= REGION_EAST
        and north <= REGION_NORTH
    ):
        return None
    return (
        f"AOI {list(bbox)} is outside the precomputed region {list(REGION)}. "
        "The pipeline covers that bbox only."
    )
