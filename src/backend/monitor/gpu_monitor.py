import copy
from typing import Any, Dict

import pynvml

from utils.misc import Smoother

def initialize_pynvml() -> None:
    """
    Initialize NVML library for GPU monitoring.
    """
    try:
        pynvml.nvmlInit()
    except pynvml.NVMLError as e:
        raise RuntimeError(f"Failed to initialize NVML: {e}")


class GPUMonitor:
    """
    Utility class to fetch GPU statistics using pynvml, with history tracking.
    """
    def __init__(self, opt) -> None:
        initialize_pynvml()
        self.opt = opt
        self.gpu_ids = self.opt.get('gpu_ids', [0])
        self.history_size = self.opt.get('MONITORING_history_size', 300)
        self.smoother_alpha = self.opt.get('MONITORING_smoother_alpha', 0.1)

        self.tracker = {
            'gpu_usage': None,
            'gpu_memory': None,
            'gpu_power_draw': None,
        }

        # Static GPU info stored once
        self.base_dict = {
            'gpu_uuid': [],
            'gpu_name': [],
            'gpu_total_memory': [],
            'gpu_power_limit': [],
            'gpu_count' : pynvml.nvmlDeviceGetCount(),
        }

        for idx in self.gpu_ids:
            handle = pynvml.nvmlDeviceGetHandleByIndex(idx)
            self.base_dict['gpu_uuid'].append(pynvml.nvmlDeviceGetUUID(handle).decode())
            self.base_dict['gpu_name'].append(pynvml.nvmlDeviceGetName(handle).decode())
            mem_info = pynvml.nvmlDeviceGetMemoryInfo(handle)
            power_limit = pynvml.nvmlDeviceGetPowerManagementLimit(handle) / 1000

            self.base_dict['gpu_total_memory'].append(round(mem_info.total / 1024**3))
            self.base_dict['gpu_power_limit'].append(power_limit)

    def update_hist(self, stats: dict):
        """
        Update history buffer for selected keys.
        """
        for key in self.tracker:
            if self.tracker[key] is None:
                self.tracker[key] = [Smoother(alpha=self.smoother_alpha,init_value = stats[key][i],
                                              max_length=self.history_size,
                                              decimal_points=1) for i in range(len(self.gpu_ids))] 
            else:
                for i in range(len(self.gpu_ids)):
                    self.tracker[key][i].update(stats[key][i])
    
    def get_hist(self):
        return {k:[_t.get() for _t in self.tracker[k]] for k in self.tracker}

    def get_stats(self, only_current: bool = False) -> Dict[str, Any]:
        """
        Retrieve current or historical GPU metrics.
        """
        gpu_usage = []
        gpu_memory = []
        gpu_power_draw = []

        for idx in self.gpu_ids:
            handle = pynvml.nvmlDeviceGetHandleByIndex(idx)
            util = pynvml.nvmlDeviceGetUtilizationRates(handle).gpu
            mem_info = pynvml.nvmlDeviceGetMemoryInfo(handle)
            power_draw = pynvml.nvmlDeviceGetPowerUsage(handle) / 1000

            gpu_usage.append(util)
            gpu_memory.append(mem_info.used / 1024**3)
            gpu_power_draw.append(power_draw)

        current_stats = {
            'gpu_usage': gpu_usage,
            'gpu_memory': gpu_memory,
            'gpu_power_draw': gpu_power_draw,
        }

        self.update_hist(current_stats)

        result = copy.deepcopy(self.base_dict)
        if only_current:
            result.update(current_stats)
        else:
            result.update(self.get_hist())
        return result
