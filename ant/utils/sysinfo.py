import subprocess
import cpuinfo
import psutil

def get_system_info(gpu_ids=[], full=False):
    try:
        if full:
            result = subprocess.run([
                'nvidia-smi', 
                '--query-gpu=uuid,name,utilization.gpu,memory.used,memory.total,power.draw,power.limit', 
                '--format=csv,noheader,nounits'
            ], capture_output=True, text=True, check=True)
            
            all_gpu_data = [i.split(', ') for i in result.stdout.strip().split('\n')]
                
            system_info = {
                'cpu_name' : cpuinfo.get_cpu_info()['brand_raw'],
                'cpu_count': psutil.cpu_count(),
                'cpu_usage': psutil.cpu_percent(),
                'ram_total': psutil.virtual_memory().total / (1024 * 1024 * 1024),
                'ram_usage': psutil.virtual_memory().used / (1024 * 1024 * 1024),
                'gpu_uuid': [all_gpu_data[i][0] for i in gpu_ids],
                'gpu_name': [all_gpu_data[i][1] for i in gpu_ids],
                'gpu_usage': [float(all_gpu_data[i][2]) for i in gpu_ids],
                'gpu_memory': [int(all_gpu_data[i][3]) / 1024 for i in gpu_ids],
                'gpu_total_memory': [int(all_gpu_data[i][4]) / 1024 for i in gpu_ids],
                'gpu_power_draw': [float(all_gpu_data[i][5]) for i in gpu_ids],
                'gpu_power_limit' : [float(all_gpu_data[i][6]) for i in gpu_ids]
            }
            return system_info
        else:
            result = subprocess.run([
                'nvidia-smi', 
                '--query-gpu=utilization.gpu,memory.used,power.draw,', 
                '--format=csv,noheader,nounits'
            ], capture_output=True, text=True, check=True)
            
            all_gpu_data = [i.split(', ') for i in result.stdout.strip().split('\n')]

            system_info = {
                'cpu_usage': psutil.cpu_percent(),
                'ram_usage': psutil.virtual_memory().used / (1024 * 1024 * 1024),
                'gpu_usage': [float(all_gpu_data[i][0]) for i in gpu_ids],
                'gpu_memory': [float(all_gpu_data[i][1]) / 1024 for i in gpu_ids],
                'gpu_power_draw': [float(all_gpu_data[i][2]) for i in gpu_ids]
            }
            return system_info
    except subprocess.CalledProcessError as e:
        print(f"Error running nvidia-smi: {e}")
        return {
                'cpu_usage': psutil.cpu_percent(),
                'ram_usage': psutil.virtual_memory().used / (1024 * 1024 * 1024),
                'gpu_usage': [0 for i in gpu_ids],
                'gpu_memory': [0 for i in gpu_ids],
                'gpu_power_draw': [0 for i in gpu_ids]
        }
    
    except Exception as e:
        print(f"SYSINFO encountered an error : {e}")
        return {
                'cpu_usage': 0,
                'ram_usage': 0,
                'gpu_usage': [0 for i in gpu_ids],
                'gpu_memory': [0 for i in gpu_ids],
                'gpu_power_draw': [0 for i in gpu_ids]
            }
