from datetime import date

import pandas as pd
from firebros.build import build
from firebros.config import MONTHLY_COLUMNS, file_sha256


def test_modis_build_is_reproducible_and_contract_shaped(tmp_path):
    raw = tmp_path / "raw"
    raw.mkdir()
    pd.DataFrame(
        {
            "latitude": [40.5, 40.5],
            "longitude": [74.5, 74.5],
            "acq_date": ["2010-10-01", "2010-10-31"],
            "acq_time": ["0100", "0100"],
            "satellite": ["Terra", "Terra"],
            "instrument": ["MODIS", "MODIS"],
            "confidence": [80, 80],
            "frp": [10, 10],
            "daynight": ["N", "N"],
        }
    ).to_csv(raw / "fires.csv", index=False)
    first, second = tmp_path / "first", tmp_path / "second"
    for output in (first, second):
        build(raw, output, date(2010, 10, 1), date(2010, 10, 31), assume_complete=True)
    assert file_sha256(first / "cells_monthly.parquet") == file_sha256(
        second / "cells_monthly.parquet"
    )
    assert file_sha256(first / "cells_cumulative.parquet") == file_sha256(
        second / "cells_cumulative.parquet"
    )
    monthly = pd.read_parquet(first / "cells_monthly.parquet")
    assert tuple(monthly.columns) == MONTHLY_COLUMNS
    assert monthly.hotspot_days.sum() == 2
    assert monthly.days_observed.min() == 31
    cumulative = pd.read_parquet(first / "cells_cumulative.parquet")
    assert cumulative.loc[cumulative.through_day.eq(15), "hotspot_days"].sum() == 1


def test_lock_refuses_overlapping_publication(tmp_path):
    import pytest

    raw = tmp_path / "raw"
    raw.mkdir()
    pd.DataFrame(
        {
            "latitude": [40.5],
            "longitude": [74.5],
            "acq_date": ["2010-10-01"],
            "acq_time": ["0100"],
            "satellite": ["Terra"],
            "instrument": ["MODIS"],
            "confidence": [80],
            "frp": [10],
            "daynight": ["N"],
        }
    ).to_csv(raw / "fires.csv", index=False)
    output = tmp_path / "processed"
    output.mkdir()
    (output / ".build.lock").touch()
    with pytest.raises(ValueError, match="build lock"):
        build(raw, output, date(2010, 10, 1), date(2010, 10, 31), assume_complete=True)
    assert not (output / "manifest.json").exists()
