import './style.css'

// --- SOUND MANAGER ---
class SoundManager {
    private audioCtx: AudioContext | null = null;

    constructor() {
        window.addEventListener('click', () => this.init(), { once: true });
        window.addEventListener('touchstart', () => this.init(), { once: true });
    }

    init() {
        if (!this.audioCtx) {
            this.audioCtx = new (window.AudioContext || (window as any).webkitAudioContext)();
        }
    }

    playClick(type: 'number' | 'operator') {
        if (!this.audioCtx) return;
        
        const oscillator = this.audioCtx.createOscillator();
        const gainNode = this.audioCtx.createGain();

        oscillator.connect(gainNode);
        gainNode.connect(this.audioCtx.destination);

        if (type === 'number') {
            oscillator.type = 'sine';
            oscillator.frequency.setValueAtTime(600, this.audioCtx.currentTime);
            oscillator.frequency.exponentialRampToValueAtTime(300, this.audioCtx.currentTime + 0.1);
            gainNode.gain.setValueAtTime(0.8, this.audioCtx.currentTime);
            gainNode.gain.exponentialRampToValueAtTime(0.01, this.audioCtx.currentTime + 0.1);
            oscillator.start();
            oscillator.stop(this.audioCtx.currentTime + 0.1);
        } else {
            oscillator.type = 'triangle';
            oscillator.frequency.setValueAtTime(400, this.audioCtx.currentTime);
            gainNode.gain.setValueAtTime(0.6, this.audioCtx.currentTime);
            gainNode.gain.exponentialRampToValueAtTime(0.01, this.audioCtx.currentTime + 0.1);
            oscillator.start();
            oscillator.stop(this.audioCtx.currentTime + 0.1);
        }
    }
}

// --- APP LOGIC ---
interface HistoryItem {
  id: number;
  expression: string;
  result: string;
  date: string;
}

class Calculator {
  private prevEl: HTMLElement;
  private currEl: HTMLElement;
  private prevElPreview: HTMLElement;
  private currentOperand: string = '';
  private previousOperand: string = '';
  private operation: string | undefined;
  private shouldResetScreen: boolean = false;
  private soundManager: SoundManager;

  constructor(prevEl: HTMLElement, currEl: HTMLElement, prevElPreview: HTMLElement, soundMgr: SoundManager) {
    this.prevEl = prevEl;
    this.currEl = currEl;
    this.prevElPreview = prevElPreview;
    this.soundManager = soundMgr;
    this.clear();
  }

  clear() {
    this.currentOperand = '0';
    this.previousOperand = '';
    this.operation = undefined;
    this.prevElPreview.innerText = '';
    this.shouldResetScreen = false;
  }

  delete() {
    if (this.shouldResetScreen) {
        this.shouldResetScreen = false;
        this.currentOperand = '0';
        return;
    }
    
    // FIX: If current operand is empty but we have an operation, 
    // allow deleting the operation to go back to previous number
    if (this.currentOperand === '' && this.operation !== undefined) {
        this.currentOperand = this.previousOperand;
        this.previousOperand = '';
        this.operation = undefined;
        this.updateDisplay();
        return;
    }

    if (this.currentOperand === '0') return;
    
    this.currentOperand = this.currentOperand.toString().slice(0, -1);
    if (this.currentOperand === '') this.currentOperand = '0';
  }

  appendNumber(number: string) {
    this.soundManager.playClick('number');
    
    if (this.shouldResetScreen) {
      this.currentOperand = '';
      this.shouldResetScreen = false;
    }
    
    if (number === '.' && this.currentOperand.includes('.')) return;
    
    // Prevent multiple leading zeros
    if (this.currentOperand === '0' && number !== '.') {
      this.currentOperand = number;
    } else {
      this.currentOperand = this.currentOperand.toString() + number;
    }
  }

  chooseOperation(operation: string) {
    this.soundManager.playClick('operator');
    
    // Instant operations
    if (operation === 'sqrt') {
        const current = parseFloat(this.currentOperand);
        if (current < 0) { alert("Invalid Input"); return; }
        const res = Math.sqrt(current);
        this.currentOperand = res.toString();
        this.shouldResetScreen = true;
        this.updateDisplay();
        return;
    }

    if (operation === 'pow') {
        const current = parseFloat(this.currentOperand);
        const res = Math.pow(current, 2);
        this.currentOperand = res.toString();
        this.shouldResetScreen = true;
        this.updateDisplay();
        return;
    }

    // FIX: Allow changing operator if user hasn't started typing second number yet
    if (this.currentOperand === '' && this.previousOperand !== '') {
        this.operation = operation;
        this.updateDisplay();
        return;
    }

    if (this.currentOperand === '') return;

    if (this.previousOperand !== '') {
        this.compute();
    }
    
    this.operation = operation;
    this.previousOperand = this.currentOperand;
    this.currentOperand = '';
    this.shouldResetScreen = false; 
  }

  compute() {
    let computation: number;
    const prev = parseFloat(this.previousOperand);
    const current = parseFloat(this.currentOperand);

    if (isNaN(prev) || isNaN(current)) return;

    switch (this.operation) {
      case '+': computation = prev + current; break;
      case '-': computation = prev - current; break;
      case '*': computation = prev * current; break;
      case '÷': 
        if(current === 0) { alert("Error"); this.clear(); return; }
        computation = prev / current; 
        break;
      case '%': computation = (prev / 100) * current; break;
      default: return;
    }

    this.currentOperand = computation.toString();
    this.operation = undefined;
    this.previousOperand = '';
    this.shouldResetScreen = true;
    this.prevElPreview.innerText = '';
  }

  // FIX: Custom Formatter using Regex instead of toLocaleString
  // This solves the issue of numbers turning into 00000 after 16 digits
  formatNumber(number: string): string {
    if (!number) return '';
    const stringNumber = number.toString();
    
    const parts = stringNumber.split('.');
    const integerPart = parts[0];
    const decimalPart = parts.length > 1 ? '.' + parts[1] : '';
    
    // Add commas to integer part manually using Regex
    // \B looks for a position that is not a word boundary
    // (?=(\d{3})+(?!\d)) looks ahead for groups of 3 digits
    const formattedInteger = integerPart.replace(/\B(?=(\d{3})+(?!\d))/g, ",");
    
    return formattedInteger + decimalPart;
  }

  updateDisplay() {
    this.currEl.innerText = this.formatNumber(this.currentOperand);
    
    if (this.operation != null) {
      this.prevEl.innerText = `${this.formatNumber(this.previousOperand)} ${this.operation}`;
      
      if (this.currentOperand !== '' && !this.shouldResetScreen) {
         const prev = parseFloat(this.previousOperand);
         const current = parseFloat(this.currentOperand);
         if (!isNaN(prev) && !isNaN(current)) {
             let tempRes = 0;
             switch (this.operation) {
                 case '+': tempRes = prev + current; break;
                 case '-': tempRes = prev - current; break;
                 case '*': tempRes = prev * current; break;
                 case '÷': tempRes = current!==0 ? prev/current : 0; break;
                 case '%': tempRes = (prev/100)*current; break;
             }
             // For preview, we still use standard math (might show scientific notation for huge numbers)
             this.prevElPreview.innerText = "= " + this.formatNumber(tempRes.toString());
         }
      } else {
          this.prevElPreview.innerText = '';
      }
    } else {
      this.prevEl.innerText = '';
      this.prevElPreview.innerText = '';
    }
  }
}

// --- HISTORY & THEME ---
const HISTORY_KEY = 'viserCuter_history';
const THEME_KEY = 'viserCuter_theme';
const historyPanel = document.getElementById('history-panel')!;
const historyList = document.getElementById('history-list')!;

function saveHistory(expression: string, result: string) {
    const now = new Date();
    const dateStr = new Intl.DateTimeFormat('en-GB', { 
        day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' 
    }).format(now);

    const newItem: HistoryItem = { id: Date.now(), expression, result, date: dateStr };
    let history: HistoryItem[] = JSON.parse(localStorage.getItem(HISTORY_KEY) || '[]');
    history.unshift(newItem);
    if (history.length > 50) history.pop();
    localStorage.setItem(HISTORY_KEY, JSON.stringify(history));
    renderHistory();
}

function renderHistory() {
    const history: HistoryItem[] = JSON.parse(localStorage.getItem(HISTORY_KEY) || '[]');
    historyList.innerHTML = '';
    if (history.length === 0) {
        historyList.innerHTML = '<div class="empty-msg">No history yet</div>';
        return;
    }
    history.forEach(item => {
        const div = document.createElement('div');
        div.className = 'history-item';
        div.innerHTML = `
            <div class="history-top">
                <span class="history-date">${item.date}</span>
                <button class="delete-item-btn" onclick="window.deleteHistoryItem(${item.id})">
                    <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="3 6 5 6 21 6"></polyline><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path></svg>
                </button>
            </div>
            <div class="history-calc">${item.expression}</div>
            <div class="history-result">= ${parseFloat(item.result).toLocaleString('en')}</div>
        `;
        historyList.appendChild(div);
    });
}

(window as any).deleteHistoryItem = (id: number) => {
    let history: HistoryItem[] = JSON.parse(localStorage.getItem(HISTORY_KEY) || '[]');
    history = history.filter(item => item.id !== id);
    localStorage.setItem(HISTORY_KEY, JSON.stringify(history));
    renderHistory();
}

// --- INIT & EVENTS ---
const body = document.body;
const themeToggleBtn = document.getElementById('theme-toggle')!;
const themeIcon = document.getElementById('theme-icon')!;

function initTheme() {
    const savedTheme = localStorage.getItem(THEME_KEY);
    if (savedTheme === 'dark') {
        body.classList.add('dark-theme');
        updateThemeIcon(true);
    }
}

function toggleTheme() {
    body.classList.toggle('dark-theme');
    const isDark = body.classList.contains('dark-theme');
    localStorage.setItem(THEME_KEY, isDark ? 'dark' : 'light');
    updateThemeIcon(isDark);
}

function updateThemeIcon(isDark: boolean) {
    if (isDark) {
        themeIcon.innerHTML = '<path stroke-linecap="round" stroke-linejoin="round" d="M21.752 15.002A9.718 9.718 0 0118 15.75c-5.385 0-9.75-4.365-9.75-9.75 0-1.33.266-2.597.748-3.752A9.753 9.753 0 003 11.25C3 16.635 7.365 21 12.75 21a9.753 9.753 0 009.002-5.998z" />';
    } else {
        themeIcon.innerHTML = '<path stroke-linecap="round" stroke-linejoin="round" d="M12 3v2.25m6.364.386l-1.591 1.591M21 12h-2.25m-.386 6.364l-1.591-1.591M12 18.75V21m-4.773-4.227l-1.591 1.591M5.25 12H3m4.227-4.773L5.636 5.636M15.75 12a3.75 3.75 0 11-7.5 0 3.75 3.75 0 017.5 0z" />';
    }
}

const soundMgr = new SoundManager();
const prevOpEl = document.getElementById('previous-operand') as HTMLElement;
const currOpEl = document.getElementById('current-operand') as HTMLElement;
const prevPreviewEl = document.getElementById('preview-operand') as HTMLElement;

const calculator = new Calculator(prevOpEl, currOpEl, prevPreviewEl, soundMgr);

initTheme();

// Event Listeners
document.querySelectorAll('[data-number]').forEach((btn: any) => {
    btn.addEventListener('click', () => {
        calculator.appendNumber(btn.dataset.number);
        calculator.updateDisplay();
    });
});

document.querySelectorAll('[data-operator]').forEach((btn: any) => {
    btn.addEventListener('click', () => {
        calculator.chooseOperation(btn.dataset.operator);
        calculator.updateDisplay();
    });
});

document.querySelector('[data-action="calculate"]')?.addEventListener('click', () => {
    const prevVal = calculator['previousOperand'];
    const op = calculator['operation'];
    const currVal = calculator['currentOperand'];
    
    if(op && prevVal) {
        const historyText = `${calculator.formatNumber(prevVal)} ${op} ${calculator.formatNumber(currVal)}`;
        calculator.compute(); 
        calculator.updateDisplay();
        saveHistory(historyText, calculator['currentOperand']);
    } else {
        calculator.compute();
        calculator.updateDisplay();
    }
});

document.querySelector('[data-action="clear"]')?.addEventListener('click', () => {
    soundMgr.playClick('operator');
    calculator.clear();
    calculator.updateDisplay();
});

document.querySelector('[data-action="delete"]')?.addEventListener('click', () => {
    soundMgr.playClick('operator');
    calculator.delete();
    calculator.updateDisplay(); // Fixed: Ensure display updates after delete
});

document.getElementById('history-btn')?.addEventListener('click', () => {
    renderHistory();
    historyPanel.classList.add('active');
});

document.getElementById('close-history')?.addEventListener('click', () => {
    historyPanel.classList.remove('active');
});

document.getElementById('clear-history')?.addEventListener('click', () => {
    localStorage.removeItem(HISTORY_KEY);
    renderHistory();
});

themeToggleBtn.addEventListener('click', toggleTheme);

document.addEventListener('keydown', (e) => {
    if ((e.key >= '0' && e.key <= '9') || e.key === '.') calculator.appendNumber(e.key);
    else if (['+', '-', '%'].includes(e.key)) calculator.chooseOperation(e.key);
    else if (e.key === '*' || e.key === 'x') calculator.chooseOperation('*');
    else if (e.key === '/' || e.key === '÷') calculator.chooseOperation('÷');
    else if (e.key === 'Enter' || e.key === '=') { 
        e.preventDefault(); 
        (document.querySelector('[data-action="calculate"]') as HTMLElement).click();
    }
    else if (e.key === 'Backspace') calculator.delete();
    else if (e.key === 'Escape') calculator.clear();
    calculator.updateDisplay();
});
