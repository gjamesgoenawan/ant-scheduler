import copy
import os
from typing import Any, Dict

import cpuinfo
import psutil

from utils.misc import Smoother

class CPUMonitor:
    def __init__(self, 
                 opt) -> None:
        self.opt = opt
        self.history_size = self.opt.get('MONITORING_history_size', 300)
        self.smoother_alpha = self.opt.get('MONITORING_smoother_alpha', 0.1)

        self.base_dict = {'cpu_name': cpuinfo.get_cpu_info()['brand_raw'],
                          'cpu_count': psutil.cpu_count(),
                          'ram_total': round(psutil.virtual_memory().total / 1024**3, 1)}
        self.tracker = {'cpu_usage' : None,
                        'ram_usage' : None,}

    def update_hist(self, 
                    stats: dict):
        """
        Update history buffer for selected keys.
        """
        for i in self.tracker:
            if self.tracker[i] is None:
                self.tracker[i] = Smoother(alpha=self.smoother_alpha,
                                        init_value = stats[i],
                                        max_length=self.history_size,
                                        decimal_points=1)
            else:
                self.tracker[i].update(stats[i])
    
    def get_hist(self):
        return {k:self.tracker[k].get() for k in self.tracker}

    def get_stats(self, 
                  only_current: bool = False) -> Dict[str, Any]:
        """
        Retrieve current or historical CPU metrics.
        """
        current_stats = {
            'cpu_usage': psutil.cpu_percent(interval=None),
            'ram_usage': psutil.virtual_memory().used / 1024**3,
        }
        self.update_hist(current_stats)

        base_dict = copy.copy(self.base_dict)
        if only_current:
            base_dict.update(current_stats)
        else:
            base_dict.update(self.get_hist())
        return base_dict