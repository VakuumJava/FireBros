from __future__ import annotations

import pytest
from app.errors import NoData
from app.geo import describe_aoi
from app.service import anomaly


class EmptyStore:
    source = "mock"

    def records(self, aoi, start, end):
        return []

    def hotspots(self, aoi, start, end, limit):
        return []


def test_anomaly_without_observations_is_not_silently_zero():
    aoi = describe_aoi((68.5, 38.4, 69.0, 38.65))

    with pytest.raises(NoData):
        anomaly(aoi, (2026, 11), EmptyStore())
