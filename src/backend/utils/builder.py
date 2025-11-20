import handler
import loader
import logger
import runner


def build_runner(opt):
    l = logger.__getattribute__(opt['logger'])(opt)

    runner_args = dict(
        opt=opt, 
        handler = handler.__getattribute__(opt['handler'])(opt, logger=l),
        loader = loader.__getattribute__(opt['loader'])(opt, logger=l),
        logger = l,
    )
    r = runner.__getattribute__(opt['runner'])(**runner_args)
    return r
    