import os
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