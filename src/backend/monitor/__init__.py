import threading
import time
from typing import Dict, Any

from .cpu_monitor import CPUMonitor
from .gpu_monitor import GPUMonitor

class ThreadedMonitor:
    """
    Background auto-refreshing system monitor.
    Access `current_stats` for latest snapshot.
    """
    def __init__(self, 
                 opt : dict):
        self.monitors = []
        for func in [CPUMonitor, GPUMonitor]:
            self.monitors.append(func(opt))

        self.opt = opt
        self.refresh_interval = self.opt.get('MONITORING_refresh_interval', 1)
        self._stats_lock = threading.Lock()
        self._current_stats: Dict[str, Any] = {}
        self._stop_event = threading.Event()
        self._thread = threading.Thread(target=self._update_loop, daemon=True)
        self._thread.start()
        time.sleep(1)

    def _update_loop(self):
        new_stats = {}
        while not self._stop_event.is_set():
            for monitor in self.monitors:
                new_stats.update(
                    monitor.get_stats(only_current=False)
                )
            with self._stats_lock:
                self._current_stats = new_stats
            time.sleep(self.refresh_interval)

    @property
    def current_stats(self) -> Dict[str, Any]:
        with self._stats_lock:
            return self._current_stats.copy()
        
    def stop(self):
        self._stop_event.set()
        self._thread.join()