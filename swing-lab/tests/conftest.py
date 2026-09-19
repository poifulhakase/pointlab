"""pytest 共通フィクスチャ。"""

from __future__ import annotations

import pytest

from swinglab import config as config_mod


@pytest.fixture(scope="session")
def cfg():
    """本物の config.yaml を読む（設定とコードの食い違いをテストでも検出するため）。"""
    conf, _warnings = config_mod.load()
    return conf
