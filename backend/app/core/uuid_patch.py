"""Monkey-patch uuid_utils._uuid7_int to accept optional positional args.

langchain_core 0.3.x calls uuid_utils.uuid7(timestamp=..., nanos=...) which
passes those args to _uuid7_int(). The pure-python fallback in uuid-utils 0.17.0
defines _uuid7_int() with 0 args, causing a TypeError. This patch wraps the
original function to accept optional positional args and ignore them.
"""
import uuid_utils
import functools

def _patch_uuid7_int():
    original = uuid_utils._uuid7_int
    
    @functools.wraps(original)
    def _patched(*args, **kwargs):
        # The original pure-python fallback ignores timestamp/nanos anyway
        # so we just call it with no args
        return original()
    
    uuid_utils._uuid7_int = _patched
    
    # Also patch the compat module
    import uuid_utils.compat as compat
    compat._uuid7_int = _patched
    
    # Patch langchain_core's reference too
    try:
        from langchain_core.utils import uuid as lc_uuid
        if hasattr(lc_uuid, '_uuid_utils_uuid7'):
            # Re-import to pick up the patched version
            pass
    except ImportError:
        pass

_patch_uuid7_int()
