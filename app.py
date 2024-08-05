import ant
import argparse

if __name__ == "__main__":

    def split_ints(x):
        return [int(i) for i in x.split(',')]

    parser = argparse.ArgumentParser(description='ANT_Scheduler')
    parser.add_argument('gpu_ids', type=split_ints, help='GPU IDs to be utilized by ANT, separated by commas')
    args = parser.parse_args()

    try:
        cfg = ant.utils.builder.parse_config("config/base.py")
        cfg['runner']['gpu_ids'] = args.gpu_ids
        runner = ant.utils.builder.build_runner(cfg)
        runner.run()

    except Exception as e:
        raise(e)
