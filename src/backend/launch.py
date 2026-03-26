import argparse
import logging
import json

from apis.flask import run_api
from test_scripts.test_opt import opt
from utils.builder import build_runner

log = logging.getLogger('werkzeug')
log.setLevel(logging.ERROR)

if __name__ == '__main__':
    def split_ints(x):
        return [int(i) for i in x.split(',')]

    parser = argparse.ArgumentParser(description='ANT_Scheduler')
    parser.add_argument('gpu_ids', type=split_ints, help='GPU IDs to be utilized by ANT, separated by commas')
    parser.add_argument('--config', type=str, default='config/default.json', help='JSON config for ant.')
    parser.add_argument('--debug', action='store_true')
    args = parser.parse_args()

    try:
        with open(args.config, 'r', encoding='utf-8') as f:
            opt = json.load(f)
    except Exception as e:
        print('Failed to load json config.')
        raise(e)
    
    opt['gpu_ids'] = args.gpu_ids
    r = build_runner(opt)

    try:
        run_api(r, debug=args.debug)
    except Exception as e:
        raise(e)