# Under development
import copy
import math
import time
import curses

from typing import Optional, List

from ant.logger import base_logger
from ant.visualizer import base_visualizer

WINDOWS_PER_PAGE = 4

# Function to initialize the screen and create the main window
def initialize_screen():
    stdscr = curses.initscr()
    curses.noecho()
    curses.cbreak()
    stdscr.keypad(True)
    curses.curs_set(0)  # Hide cursor
    return stdscr

# Function to terminate the curses application
def terminate_screen(stdscr):
    curses.nocbreak()
    stdscr.keypad(False)
    curses.echo()
    curses.endwin()
    

# Function to draw the tabs and static text
def draw_tabs(stdscr, active_tab):
    stdscr.clear()
    height, width = stdscr.getmaxyx()

    # Define tab labels
    tabs = ["|   Task [S]tatus    |", "| Terminal [M]onitor |", "|       [L]og        |"]          

    # Draw static text "ant-runner" at the top
    title = [
"================",
"   ANT-RUNNER   ",
"    @ Gejems    ",
"================",
    ]
    
    start_x_title = (width // 2) - (len(title[0]) // 2)
    for idx, i in enumerate(title):
        stdscr.addstr(idx, start_x_title, i, curses.A_BOLD)

    # Draw tab headers
    len_tabs = sum([len(i) for i in tabs]) + (10 * (len(tabs) - 1))

    start_x_tabs = (width // 2) - (len_tabs // 2)

    cnt = 0
    for idx, tab in enumerate(tabs):
        if idx == active_tab:
            stdscr.addstr(5, start_x_tabs + cnt, tab, curses.A_REVERSE)
        else:
            stdscr.addstr(5, start_x_tabs + cnt, tab)
        
        cnt += len(tab) + 10

    # Draw a line below the tabs
    stdscr.hline(4, 0, curses.ACS_HLINE, width)
    stdscr.hline(6, 0, curses.ACS_HLINE, width)

def draw_windows(stdscr, start_index, max_y, max_x, window_data, current_page, page_number):
    win_height = ((max_y-1) // 2)-1
    win_width = max_x // 2

    page_str = f"Page {current_page + 1} of {page_number}"
    stdscr.addstr(7 + max_y-2, (max_x // 2) - (len(page_str) // 2), page_str)

    for i in range(WINDOWS_PER_PAGE):       
        win_index = start_index + i

        row = i // 2
        col = i % 2

        y = 7 + row * (win_height + 1)  # Adjust y to draw below the tabs
        x = 1 + col * win_width

        if (current_page * WINDOWS_PER_PAGE + win_index) >= len(window_data):
            stdscr.addstr(y, x, f' ' * win_width)
            win = curses.newwin(win_height, win_width, y + 1, x)
            win.erase()  # Clear the window
            win.refresh()
        
        else:
            win = curses.newwin(win_height, win_width, y + 1, x)
            win.box()
            formatted_current_window_data = copy.copy(window_data[current_page * WINDOWS_PER_PAGE + win_index][1])
            stdscr.addstr(y, x, f'TASK ID : {window_data[current_page * WINDOWS_PER_PAGE + win_index][0]}')
            
            for line in range(len(formatted_current_window_data)):
                try:
                    win.addstr(line + 1, 1, formatted_current_window_data[line])
                except curses.error:
                    win.addstr(1, 1, '[CRITICAL : ADDSTR ERROR]')

            win.refresh()

    return current_page

# Function to draw the content for the Task Status tab
def draw_task_status(stdscr, vis_data : List = []):
    height, width = stdscr.getmaxyx()
    #stdscr.addstr(7, 0, f"Task Status {time.time()}", curses.A_BOLD)
    for idx, line in enumerate(vis_data):
        stdscr.addstr(7 + idx, 0, line)


# Function to draw the content for the Terminal Monitor tab
def draw_terminal_monitor(stdscr, window_data, current_page, page_number):
    max_y, max_x = stdscr.getmaxyx()
    draw_windows(stdscr, 0, max_y-7, max_x-2, window_data, current_page, page_number)

def draw_log(stdscr, vis_data):

    
    max_y, max_x = stdscr.getmaxyx()

    win_height = max_y - 8
    win_width = max_x - 2
    win = curses.newwin(win_height, win_width, 8, 1)
    win.box()
    for idx, line in enumerate(vis_data[1]):
        win.addstr(idx + 1, 1, line)

    win.refresh()
    

class ncurse_visualizer(base_visualizer):
    def __init__(self, 
                 delay : float = 1.0,
                 logger : Optional[base_logger] = None):
        self.delay = delay
        self.active_tab : int = 0
        self.current_page : int = 0
        self.page_number : int = 0

        self.stdscr = None

        self.vis_data : dict = {'terminal_visualizer' : [],
                                'runner_visualizer' : [],
                                'log_visualizer' : []}
        self.logger = self.setup_logger(logger)
        self.is_initialized = False
        
    def initialize(self):
        self.logger.info("Screen initialized!")
        self.stdscr = initialize_screen()
        self.stdscr.timeout(int(self.delay * 1000))
        draw_tabs(self.stdscr, self.active_tab)
        draw_task_status(self.stdscr, self.vis_data['terminal_visualizer'])
        self.stdscr.refresh()
        self.is_initialized = True
    
    def get_vis_prop(self):
        if self.is_initialized is False:
            self.logger.error("Screen must be initialized first before calling .get_vis_prop(). Initiate screen using visualizer.initialize()")
            return {}
        max_y, max_x = self.stdscr.getmaxyx()
        win_height = ((max_y-1) // 2)-1
        win_width = max_x // 2
        return {'max_height' : max_y,
                'max_width' : max_x, 
                'terminal_win_height' : win_height,
                'terminal_win_width' : win_width,
                'text_wrap' : 'wrap'}
    
    def step(self, vis_data : Optional[dict] = None) -> bool:
        if self.is_initialized is False:
            self.logger.error("Screen must be initialized first before calling .step(). Initiate screen using visualizer.initialize()")
            return False

        if vis_data is not None:
            self.vis_data = vis_data
        
        self.page_number = math.ceil(len(self.vis_data['terminal_visualizer']) / WINDOWS_PER_PAGE)

        if self.active_tab == 0:
            draw_task_status(self.stdscr, self.vis_data['runner_visualizer'])
        elif self.active_tab == 1:
            draw_terminal_monitor(self.stdscr, self.vis_data['terminal_visualizer'], self.current_page, self.page_number)
        else:
            draw_log(self.stdscr, self.vis_data['log_visualizer'])

        key = self.stdscr.getch()

        if self.active_tab == 1:
            if key == curses.KEY_RIGHT:
                self.current_page += 1
                if self.current_page >= self.page_number:
                    self.current_page = self.page_number - 1
            elif key == curses.KEY_LEFT:
                self.current_page -= 1
                if self.current_page < 0:
                    self.current_page = 0
            
        
        if key == curses.KEY_BTAB or key == 9:  # 9 is the ASCII value for the Tab key
            self.active_tab = (self.active_tab + 1) % 3
            draw_tabs(self.stdscr, self.active_tab)
        
        if key == ord('s'):
            self.active_tab = 0
            draw_tabs(self.stdscr, self.active_tab)

        if key == ord('m'):
            self.active_tab = 1
            draw_tabs(self.stdscr, self.active_tab)
        
        if key == ord('l'):
            self.active_tab = 2
            draw_tabs(self.stdscr, self.active_tab)

        elif key == 27:  # ESC key
            return False
            
        self.stdscr.refresh()
        return True
    
    def terminate(self):
        if self.is_initialized:
            terminate_screen(self.stdscr)