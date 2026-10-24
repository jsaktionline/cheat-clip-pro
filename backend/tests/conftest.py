"""Shared pytest configuration for the Cheat Clip PRO v2 test-suite."""

import sys
from pathlib import Path

# Make the repository root importable (``backend`` package) when pytest is
# executed from any working directory.
REPO_ROOT = Path(__file__).resolve().parents[2]
if str(REPO_ROOT) not in sys.path:
    sys.path.insert(0, str(REPO_ROOT))
