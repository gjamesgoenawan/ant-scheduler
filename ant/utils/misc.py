import os
import re
import uuid
import random
from typing import List

INF = 99999999999999

def list2str(x : List, newline : bool = False):
    output = ''
    for idx, i in enumerate(x):
        if idx == 0:
            output += str(i)
        else:
            output += f',{i}'
        if newline:
            output += '\n'
    return output

def parse_envar(x):
    """will always return ' blablabal'"""
    output = ' '
    for i in x.keys():
        output += f"{i}={x[i]} "
    if len(output) > 1:
        output = output[:-1]
    return output

def read_last_n_lines(filename, n=1):
    """Returns the last n lines of a file (n=1 gives the last line)."""
    with open(filename, 'rb') as f:
        # Move the cursor to the end of the file
        f.seek(0, os.SEEK_END)
        position = f.tell()
        buffer = bytearray()
        while n > 0 and position > 0:
            try:
                f.seek(position - 1)
                byte = f.read(1)
                position -= 1
                if byte == b'\n':
                    n -= 1
                    if n == 0:
                        break
                buffer.extend(byte)
            except OSError:
                f.seek(0)
                break

        # Add the first line if we reached the beginning of the file
        if position == 0:
            f.seek(0)
            buffer.extend(f.read(1))
        
        buffer.reverse()
        last_n_lines = buffer.decode(errors='ignore').splitlines()
    return last_n_lines

def wrap_text(content, max_width, max_height, text_wrap):
    if text_wrap.lower() == 'wrap':
        wrapped_lines = []
        for line in content:
            while len(line) > (max_width - 4):
                wrapped_lines.append(line[:max_width])
                line = line[max_width - 4:]
            wrapped_lines.append(line)

        wrapped_lines = wrapped_lines[-(max_height):]
    
    elif text_wrap.lower() == 'no-wrap':
        wrapped_lines = [i.strip() for i in content[-(max_height):]]
    else:
        wrapped_lines = ""
    return wrapped_lines

def format_timedelta(td):
    days = td.days
    hours, remainder = divmod(td.seconds, 3600)
    minutes, seconds = divmod(remainder, 60)

    parts = []
    if days > 0:
        parts.append(f"{days} days")
    if hours > 0:
        parts.append(f"{hours} hours")
    if minutes > 0:
        parts.append(f"{minutes} minutes")
    if seconds > 0:
        parts.append(f"{seconds} seconds")

    readable_format = ', '.join(parts)
    return readable_format

def join_command_list(command_list):
    '''
    Join a list of commands.
    Addresses the usage of '\' to seperate line within a single command.
    '''
    joint_command_list = []

    temp_command = ''
    for idx in range(len(command_list)):
        curr_command = command_list[idx].strip()
        if curr_command == '':
            continue
        if curr_command[-1:] == '\\':
            temp_command += curr_command[:-1].strip()
            temp_command += " "
        else:
            temp_command += curr_command
            joint_command_list.append(temp_command)
            temp_command = ''
    return joint_command_list

def parse_string(s):
    '''
    Command Argument Parser.

    Parsing 2 arguments for ANT-Runner:
        ant_n_gpus=int
        ant_task_id=str
    '''
    
    # random {rand int|float num1 num2}
    random_entry = re.findall('{rand (int|float) ([+-]?[0-9]*\.?[0-9]+) ([+-]?[0-9]*\.?[0-9]+)}', s)
    _s = re.sub('{rand (int|float) ([+-]?[0-9]*\.?[0-9]+) ([+-]?[0-9]*\.?[0-9]+)}', '{}', s)
    random_results = []
    for i in random_entry:
        if i[0].lower() == 'int':
            random_results.append(random.randrange(int(i[1]), int(i[2])))
            
        elif i[0].lower() == 'float':
            random_results.append(random.uniform(float(i[1]), float(i[2])))
        else:
            raise NotImplementedError(f"Not understood : {i}")
    s = _s.format(*random_results).strip()

    # ant arguments
    # gpu
    ant_n_gpus = re.findall('ant_n_gpus=([0-9]+)', s)
    if len(ant_n_gpus) < 1: 
        # self.logger.warn("Number of GPU isn't specified, setting to default value")
        n_gpus = 1
    else:
        n_gpus = int(ant_n_gpus[-1])
    _s = re.sub('ant_n_gpus=([0-9]+)', '', s)
    s = _s.strip()

    # task_id
    pattern = r'ant_task_id=([^\s"]+|"[^"]*")'
    ant_task_id = re.findall(pattern, s)

    if len(ant_task_id) < 1: 
        # self.logger.warn("Number of GPU isn't specified, setting to default value")
        task_id = str(uuid.uuid4())
    else:
        task_id = ant_task_id[-1]
        if task_id.startswith('"') and task_id.endswith('"'):
            task_id = task_id[1:-1]
    _s = re.sub(pattern, '', s)
    s = _s.strip()
    
    return {'command' : s,
            'ant_n_gpus' : n_gpus,
            'ant_task_id' : task_id,
            'envar' : {}}