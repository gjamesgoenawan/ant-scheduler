import os
import re
import uuid
import random
import datetime
import functools
import subprocess
from typing import List

INF = float('inf')

TASK_ID_TEMPLATE_ADJECTIVES = [
    "amber", "brisk", "calm", "cedar", "clear", "cobalt", "crisp", "dawn",
    "ember", "frost", "gold", "granite", "harbor", "ivory", "jade", "lunar",
    "maple", "mellow", "nova", "oak", "olive", "onyx", "quiet", "rapid",
    "river", "silver", "solar", "spruce", "steady", "summit", "swift", "wild",
]
TASK_ID_TEMPLATE_NOUNS = [
    "anchor", "aurora", "badger", "beacon", "brook", "canvas", "comet", "falcon",
    "field", "forest", "glacier", "harvest", "hawk", "meadow", "orbit", "otter",
    "pine", "ridge", "rocket", "sparrow", "stone", "stream", "thunder", "trail",
    "voyager", "wave", "willow", "wind", "wolf", "zephyr",
]
TASK_ID_TEMPLATE_PATTERN = re.compile(r"\[(.+?)\]|\{(.+?)\}")

def list2str(x : List, newline : bool = False):
    if isinstance(x, str):
        return x
    
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
        prev_byte = None

        # offset
        n += 1
        
        while n > 0 and position > 0:
            try:
                f.seek(position - 1)
                byte = f.read(1)
                position -= 1
                if byte == b'\n' or (byte == b'\r' and prev_byte != b'\n'):
                    n -= 1
                    if n == 0:
                        break
                buffer.extend(byte)
                prev_byte = byte
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

def format_timedelta(td):
    if isinstance(td, int) or isinstance(td, float):
        td = datetime.timedelta(seconds=round(td))
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
    # if seconds > 0:
    parts.append(f"{seconds} seconds")

    readable_format = ', '.join(parts)
    return readable_format

def format_timestamp(t):
    dt = datetime.datetime.fromtimestamp(t)
    return dt.strftime('%H:%M:%S %d-%m-%Y')

def split_commands(command: str):
    """
    Splits a multiline shell command string into separate executable commands.
    Handles line continuations, comments, and operators like &&, ||, ;.
    """
    # Step 1: remove comments and handle line continuations
    lines = command.splitlines()
    current = ""
    cleaned_lines = []

    for line in lines:
        # remove comment
        if line.find('#') != -1:
            line = line[:line.find('#')]
        line = line.strip()

        if line.strip() == '':
            continue
        
        # Remove trailing backslash
        if line.endswith("\\"):
            line = line[:-1].strip()
            current += line + " "
        else:
            current += line
            cleaned_lines.append(current)
            current = ""
    return cleaned_lines

def parse_and_truncate_file(filename : str, max_lines : int, line_break : str = '\n'):
    """
    Read logs and truncate middle part.
    """
    with open(filename) as f:
        data = f.readlines()
    
    all_lines = []
    for x in data:
        all_lines += x.rstrip('\r\n').split('\n')

    if len(all_lines) > max_lines:
        all_lines = all_lines[:int(max_lines/2)] + ["", "", "============================", f"{len(all_lines)-max_lines} hidden lines ...", "============================", "", ""] + all_lines[-int(max_lines/2):]

    rendered_lines = ''
    for x in all_lines:
        rendered_lines += (x + line_break)
    return rendered_lines

def handle_singular_or_plural(func):
    """
    func wrapper to support singular values for plural functions.
    """
    @functools.wraps(func)
    def wrapper(self, *args, **kwargs):
        is_singular = False
        new_args = []
        for i in args:
            if not isinstance(i, list):
                new_args.append([i])
                is_singular = True
            else:
                new_args.append(i)
        for k in kwargs:
            if not isinstance(kwargs[k], list):
                kwargs[k] = [kwargs[k]]
                is_singular = True
        result = func(self, *new_args, **kwargs)
        
        if result is None:
            return result
        
        if is_singular:
            return result[0]
        
        return result
    return wrapper

def sanitize_task_id(task_id): 
    replacements = {' ': '-',
                    '+': '-plus-',
                    '&': '-and-',
                    '/': '-slash-',
                    '\\': '-backslash-'}
    for k,v in replacements.items():
        task_id = task_id.replace(k,v)
    print(task_id)
    return task_id

def random_task_phrase() -> str:
    return f"{random.choice(TASK_ID_TEMPLATE_ADJECTIVES)}-{random.choice(TASK_ID_TEMPLATE_NOUNS)}"

def _render_task_id_token(token: str) -> str:
    normalized = token.strip().lower()
    now = datetime.datetime.now()

    if normalized in {"uuid", "uuid4"}:
        return str(uuid.uuid4())
    if normalized == "uuid8":
        return uuid.uuid4().hex[:8]
    if normalized == "date":
        return now.strftime('%Y%m%d')
    if normalized == "time":
        return now.strftime('%H%M%S')
    if normalized == "datetime":
        return now.strftime('%Y%m%d-%H%M%S')
    if normalized in {"random_phrase", "phrase"}:
        return random_task_phrase()
    if normalized.startswith('randint:'):
        _, start, end = normalized.split(':', maxsplit=2)
        start_i = int(start)
        end_i = int(end)
        if start_i > end_i:
            raise ValueError(f"Invalid task id template range: {token}")
        return str(random.randint(start_i, end_i))

    raise ValueError(f"Unsupported task id template token: {token}")

def render_task_id_template(task_id: str | None) -> str | None:
    if task_id is None:
        return None

    task_id = str(task_id).strip()
    if task_id == '':
        return task_id

    task_id = re.sub(r'uuid\.uuid4\(\)', lambda _: str(uuid.uuid4()), task_id)

    if '[' not in task_id and '{' not in task_id:
        return task_id

    return TASK_ID_TEMPLATE_PATTERN.sub(
        lambda match: _render_task_id_token(match.group(1) or match.group(2)),
        task_id,
    )

def ensure_string_literal(v: str):
    if isinstance(v, str):
        
        if len(v)>=2 and v[0] == "\"" and v[-1] == "\"":
            pass
        elif len(v)>=2 and v[0] == "\'" and v[-1] == "\'":
            v = f"\"{v[1:-1]}\""
        else:
            v = f"\"{v}\""
    return v

def increment_task_id(v: str):
    match = re.match(r"(.*-restart-)(\d+)$", v)
    
    if match:
        prefix, num = match.groups()
        return f"{prefix}{int(num) + 1}"
    else:
        return f"{v}-restart-1"

class Smoother:
    def __init__(self, alpha: float, 
                 init_value: float = 0.0,
                 max_length: int = 300,
                 decimal_points: int = 1):
        """
        Exponential Moving Average (EMA) smoother.
        
        Parameters:
            alpha (float): smoothing factor (0 < alpha <= 1). 
                           Higher = more reactive to new values.
            init_value (float): initial smoothed value.
        """
        if not (0 < alpha <= 1):
            raise ValueError("alpha must be in (0, 1].")
        self.decimal_points = decimal_points
        self.alpha = alpha
        self.data = [round(init_value, self.decimal_points)] * max_length
        self.value = init_value

    def update(self, new_value: float) -> float:
        """
        Update with a new value and return the smoothed result.
        """
        self.value = round(self.alpha * new_value + (1 - self.alpha) * self.value, self.decimal_points)
        self.data = self.data[1:] + [self.value]

    def get(self) -> float:
        """
        Get the current smoothed value.
        """
        return self.data

def get_git_hash_subprocess(length: int = 40) -> str:
    """
    Retrieves the git commit hash of the current repository using the subprocess module.

    Args:
        length: The desired length of the hash (default is 40 for full hash;
                use 7 for a short hash).

    Returns:
        The git commit hash as a string, or 'unknown' if an error occurs.
    """
    try:
        # Command to get the full hash: "git rev-parse HEAD"
        # Command to get a short hash: "git rev-parse --short HEAD"
        command = ["git", "rev-parse", "--short", "HEAD"] if length < 40 else ["git", "rev-parse", "HEAD"]
        
        process = subprocess.Popen(command, stdout=subprocess.PIPE, stderr=subprocess.PIPE, text=True)
        stdout, stderr = process.communicate()
        
        if process.returncode == 0:
            return stdout.strip()
        else:
            # Handle cases where the command fails (e.g., not a git repo, git not installed)
            print(f"Git command failed: {stderr.strip()}")
            return "unknown"
    except FileNotFoundError:
        print("The 'git' executable was not found. Please ensure Git is installed and in your system's PATH.")
        return "unknown"
    except Exception as e:
        print(f"An unexpected error occurred: {e}")
        return "unknown"

ANT_GIT_HASH = get_git_hash_subprocess()
