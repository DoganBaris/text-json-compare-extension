/**
 * Text&JSON Compare - Popup Controller
 * JSON and Text comparison
 */

document.addEventListener('DOMContentLoaded', () => {
  // Elements
  const leftInput = document.getElementById('leftJson');
  const rightInput = document.getElementById('rightJson');
  const leftError = document.getElementById('leftError');
  const rightError = document.getElementById('rightError');
  const compareBtn = document.getElementById('compareBtn');
  const clearBtn = document.getElementById('clearBtn');
  const swapBtn = document.getElementById('swapBtn');
  const formatLeft = document.getElementById('formatLeft');
  const formatRight = document.getElementById('formatRight');
  const stats = document.getElementById('stats');
  const resultSection = document.getElementById('resultSection');
  const diffOutput = document.getElementById('diffOutput');
  const leftCodeView = document.getElementById('leftCodeView');
  const rightCodeView = document.getElementById('rightCodeView');
  const summaryToggle = document.getElementById('summaryToggle');
  const summarySection = document.querySelector('.summary-section');
  const modeTabs = document.querySelectorAll('.mode-tab');
  const panelLabels = document.querySelectorAll('.panel-label');
  const ignoreWhitespace = document.getElementById('ignoreWhitespace');
  const ignoreAllWhitespace = document.getElementById('ignoreAllWhitespace');

  // Active mode
  let currentMode = 'text';

  /**
   * Change mode
   */
  function setMode(mode) {
    currentMode = mode;

    // Update tabs
    modeTabs.forEach(tab => {
      tab.classList.toggle('active', tab.dataset.mode === mode);
    });

    // Update panel labels
    const labels = {
      json: ['Left JSON', 'Right JSON'],
      text: ['Left Text', 'Right Text']
    };
    panelLabels[0].textContent = labels[mode][0];
    panelLabels[1].textContent = labels[mode][1];

    // Update placeholder
    const placeholders = {
      json: '{"key": "value"}',
      text: 'Enter text content...'
    };
    leftInput.placeholder = placeholders[mode];
    rightInput.placeholder = placeholders[mode];

    // Show JSON-only buttons only in JSON mode
    document.querySelectorAll('.json-only').forEach(el => {
      el.style.display = mode === 'json' ? 'inline-flex' : 'none';
    });

    // Clear results
    stats.classList.remove('visible');
    resultSection.classList.remove('visible');
    leftError.textContent = '';
    rightError.textContent = '';
    leftInput.classList.remove('error');
    rightInput.classList.remove('error');
  }

  /**
   * Parse JSON and check for errors
   */
  function parseJson(text, errorEl) {
    errorEl.textContent = '';

    if (!text.trim()) {
      return { valid: false, data: null };
    }

    try {
      const data = JSON.parse(text);
      return { valid: true, data };
    } catch (e) {
      const match = e.message.match(/position (\d+)/);
      if (match) {
        const pos = parseInt(match[1]);
        const lines = text.substring(0, pos).split('\n');
        const line = lines.length;
        const col = lines[lines.length - 1].length + 1;
        errorEl.textContent = `Line ${line}, Column ${col}: ${e.message}`;
      } else {
        errorEl.textContent = e.message;
      }
      return { valid: false, data: null };
    }
  }

  /**
   * Format JSON
   */
  function formatJson(textarea, errorEl) {
    const result = parseJson(textarea.value, errorEl);
    if (result.valid) {
      textarea.value = JSON.stringify(result.data, null, 2);
      textarea.classList.remove('error');
    } else {
      textarea.classList.add('error');
    }
  }

  /**
   * Show statistics
   */
  function showStats(diffStats) {
    stats.innerHTML = `
      <div class="stat-item">
        <span class="stat-value total">${diffStats.total}</span>
        <span class="stat-label">Total</span>
      </div>
      <div class="stat-item">
        <span class="stat-value added">${diffStats.added}</span>
        <span class="stat-label">Added</span>
      </div>
      <div class="stat-item">
        <span class="stat-value removed">${diffStats.removed}</span>
        <span class="stat-label">Removed</span>
      </div>
      <div class="stat-item">
        <span class="stat-value modified">${diffStats.modified}</span>
        <span class="stat-label">Modified</span>
      </div>
    `;
    stats.classList.add('visible');
  }

  /**
   * Render JSON side by side
   */
  function renderJsonSideBySide(leftData, rightData, differences) {
    const aligned = LineDiff.compareSideBySide(leftData, rightData, differences);

    leftCodeView.innerHTML = aligned.left.map(line => {
      const lineNum = line.lineNumber || '';
      const content = LineDiff.highlightLine(line.content);
      return `
        <div class="code-line ${line.status}">
          <span class="line-number">${lineNum}</span>
          <span class="line-content">${content || '&nbsp;'}</span>
        </div>
      `;
    }).join('');

    rightCodeView.innerHTML = aligned.right.map(line => {
      const lineNum = line.lineNumber || '';
      const content = LineDiff.highlightLine(line.content);
      return `
        <div class="code-line ${line.status}">
          <span class="line-number">${lineNum}</span>
          <span class="line-content">${content || '&nbsp;'}</span>
        </div>
      `;
    }).join('');
  }

  /**
   * Render Text side by side
   */
  function renderTextSideBySide(diffResult) {
    leftCodeView.innerHTML = diffResult.left.map(line => {
      const lineNum = line.lineNumber || '';
      const content = escapeHtml(line.content);
      return `
        <div class="code-line ${line.status}">
          <span class="line-number">${lineNum}</span>
          <span class="line-content">${content || '&nbsp;'}</span>
        </div>
      `;
    }).join('');

    rightCodeView.innerHTML = diffResult.right.map(line => {
      const lineNum = line.lineNumber || '';
      const content = escapeHtml(line.content);
      return `
        <div class="code-line ${line.status}">
          <span class="line-number">${lineNum}</span>
          <span class="line-content">${content || '&nbsp;'}</span>
        </div>
      `;
    }).join('');
  }

  // Scroll sync flag - prevent infinite loop
  let isSyncing = false;

  /**
   * Setup scroll synchronization
   */
  function setupScrollSync() {
    leftCodeView.addEventListener('scroll', () => {
      if (isSyncing) return;
      isSyncing = true;
      rightCodeView.scrollTop = leftCodeView.scrollTop;
      rightCodeView.scrollLeft = leftCodeView.scrollLeft;
      isSyncing = false;
    });

    rightCodeView.addEventListener('scroll', () => {
      if (isSyncing) return;
      isSyncing = true;
      leftCodeView.scrollTop = rightCodeView.scrollTop;
      leftCodeView.scrollLeft = rightCodeView.scrollLeft;
      isSyncing = false;
    });
  }

  /**
   * Render JSON diff summary table
   */
  function renderJsonDiffSummary(differences) {
    if (differences.length === 0) {
      diffOutput.innerHTML = `
        <div class="no-diff">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <path d="M22 11.08V12a10 10 0 11-5.93-9.14"/>
            <polyline points="22 4 12 14.01 9 11.01"/>
          </svg>
          <p>Both contents are identical!</p>
        </div>
      `;
      return;
    }

    const rows = differences.map(diff => {
      const path = diff.path || '(root)';
      const leftVal = JsonDiff.formatValue(diff.leftValue);
      const rightVal = JsonDiff.formatValue(diff.rightValue);

      let leftClass = 'unchanged';
      let rightClass = 'unchanged';

      if (diff.type === 'added') {
        rightClass = 'added';
      } else if (diff.type === 'removed') {
        leftClass = 'removed';
      } else if (diff.type === 'modified') {
        leftClass = 'modified';
        rightClass = 'modified';
      }

      return `
        <div class="diff-row">
          <div class="diff-cell ${leftClass}">
            <span class="diff-path">${escapeHtml(path)}</span>
            <span class="diff-value">${leftVal}</span>
          </div>
          <div class="diff-cell ${rightClass}">
            <span class="diff-path">${escapeHtml(path)}</span>
            <span class="diff-value">${rightVal}</span>
          </div>
        </div>
      `;
    }).join('');

    diffOutput.innerHTML = rows;
  }

  /**
   * Render Text diff summary
   */
  function renderTextDiffSummary(diffResult) {
    const changes = [];

    for (let i = 0; i < diffResult.left.length; i++) {
      const left = diffResult.left[i];
      const right = diffResult.right[i];

      if (left.status !== 'unchanged' || right.status !== 'unchanged') {
        changes.push({ left, right });
      }
    }

    if (changes.length === 0) {
      diffOutput.innerHTML = `
        <div class="no-diff">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <path d="M22 11.08V12a10 10 0 11-5.93-9.14"/>
            <polyline points="22 4 12 14.01 9 11.01"/>
          </svg>
          <p>Both contents are identical!</p>
        </div>
      `;
      return;
    }

    const rows = changes.map(({ left, right }) => {
      const leftLine = left.lineNumber ? `Line ${left.lineNumber}` : '';
      const rightLine = right.lineNumber ? `Line ${right.lineNumber}` : '';

      return `
        <div class="diff-row">
          <div class="diff-cell ${left.status}">
            <span class="diff-path">${leftLine}</span>
            <span class="diff-value">${escapeHtml(left.content) || '—'}</span>
          </div>
          <div class="diff-cell ${right.status}">
            <span class="diff-path">${rightLine}</span>
            <span class="diff-value">${escapeHtml(right.content) || '—'}</span>
          </div>
        </div>
      `;
    }).join('');

    diffOutput.innerHTML = rows;
  }

  /**
   * HTML escape helper
   */
  function escapeHtml(text) {
    if (!text) return '';
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
  }

  /**
   * Run comparison
   */
  function runCompare() {
    leftInput.classList.remove('error');
    rightInput.classList.remove('error');
    leftError.textContent = '';
    rightError.textContent = '';

    const leftText = leftInput.value;
    const rightText = rightInput.value;

    if (!leftText.trim() && !rightText.trim()) {
      stats.classList.remove('visible');
      resultSection.classList.remove('visible');
      return;
    }

    if (currentMode === 'json') {
      // JSON mode
      const leftResult = parseJson(leftText, leftError);
      const rightResult = parseJson(rightText, rightError);

      if (!leftResult.valid) leftInput.classList.add('error');
      if (!rightResult.valid) rightInput.classList.add('error');

      if (!leftResult.valid || !rightResult.valid) {
        stats.classList.remove('visible');
        resultSection.classList.remove('visible');
        return;
      }

      const differences = JsonDiff.compare(leftResult.data, rightResult.data);
      const diffStats = JsonDiff.getStats(differences);

      showStats(diffStats);
      renderJsonSideBySide(leftResult.data, rightResult.data, differences);
      renderJsonDiffSummary(differences);

    } else {
      // Text mode with whitespace options
      const trimWs = ignoreWhitespace.checked;
      const normalizeWs = ignoreAllWhitespace.checked;
      const diffResult = TextDiff.compare(leftText, rightText, trimWs, normalizeWs);
      const diffStats = TextDiff.getStats(diffResult);

      showStats(diffStats);
      renderTextSideBySide(diffResult);
      renderTextDiffSummary(diffResult);
    }

    resultSection.classList.add('visible');
  }

  /**
   * Clear all
   */
  function clear() {
    leftInput.value = '';
    rightInput.value = '';
    leftInput.classList.remove('error');
    rightInput.classList.remove('error');
    leftError.textContent = '';
    rightError.textContent = '';
    stats.classList.remove('visible');
    resultSection.classList.remove('visible');
    diffOutput.innerHTML = '';
    leftCodeView.innerHTML = '';
    rightCodeView.innerHTML = '';
  }

  /**
   * Swap values
   */
  function swap() {
    const temp = leftInput.value;
    leftInput.value = rightInput.value;
    rightInput.value = temp;

    const tempError = leftError.textContent;
    leftError.textContent = rightError.textContent;
    rightError.textContent = tempError;

    if (resultSection.classList.contains('visible')) {
      runCompare();
    }
  }

  // Event listeners
  compareBtn.addEventListener('click', runCompare);
  clearBtn.addEventListener('click', clear);
  swapBtn.addEventListener('click', swap);
  formatLeft.addEventListener('click', () => formatJson(leftInput, leftError));
  formatRight.addEventListener('click', () => formatJson(rightInput, rightError));

  // Mode tabs
  modeTabs.forEach(tab => {
    tab.addEventListener('click', () => setMode(tab.dataset.mode));
  });

  // Ctrl/Cmd + Enter to compare
  document.addEventListener('keydown', (e) => {
    if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') {
      runCompare();
    }
  });

  // Remove error style on input + auto-detect JSON mode
  leftInput.addEventListener('input', () => {
    leftInput.classList.remove('error');
    leftError.textContent = '';

    const val = leftInput.value.trim();
    if (val) {
      try {
        JSON.parse(val);
        if (currentMode !== 'json') setMode('json');
      } catch (e) {
        if (currentMode !== 'text') setMode('text');
      }
    }
  });

  rightInput.addEventListener('input', () => {
    rightInput.classList.remove('error');
    rightError.textContent = '';
  });

  // Summary section toggle
  if (summaryToggle && summarySection) {
    summaryToggle.addEventListener('click', () => {
      summarySection.classList.toggle('collapsed');
    });
  }

  // ── Remove Extra Spaces ───────────────────────────────────────────────────

function removeExtraSpaces(input, inputEl, errorEl) {
    const val = input.value.trim();
    if (!val) return;
    try {
      const parsed = JSON.parse(val);
      input.value = JSON.stringify(parsed);
      errorEl.textContent = '';
      inputEl.classList.remove('error');
    } catch (e) {
      errorEl.textContent = 'Invalid JSON: ' + e.message;
      inputEl.classList.add('error');
    }
  }

  document.getElementById('removeSpacesLeft').addEventListener('click', () => {
    removeExtraSpaces(leftInput, leftInput, leftError);
  });

  document.getElementById('removeSpacesRight').addEventListener('click', () => {
    removeExtraSpaces(rightInput, rightInput, rightError);
  });

  // ── Base64 ↔ JSON helpers (UTF-8 safe) ───────────────────────────────────

  function decodeBase64ToJson(input, inputEl, errorEl) {
    const val = input.value.trim();
    if (!val) {
      errorEl.textContent = 'Panel is empty.';
      return;
    }
    try {
      const decoded = decodeURIComponent(
        atob(val)
          .split('')
          .map(c => '%' + ('00' + c.charCodeAt(0).toString(16)).slice(-2))
          .join('')
      );
      const parsed = JSON.parse(decoded);
      input.value = JSON.stringify(parsed, null, 2);
      errorEl.textContent = '';
      inputEl.classList.remove('error');
      if (currentMode !== 'json') setMode('json');
    } catch (e) {
      errorEl.textContent = 'Failed to decode: ' + e.message;
      inputEl.classList.add('error');
    }
  }

  function encodeJsonToBase64(input, inputEl, errorEl) {
    const val = input.value.trim();
    if (!val) {
      errorEl.textContent = 'Panel is empty.';
      return;
    }
    try {
      JSON.parse(val); // validate JSON first
      const encoded = btoa(
        encodeURIComponent(val).replace(/%([0-9A-F]{2})/g, (_, p1) =>
          String.fromCharCode(parseInt(p1, 16))
        )
      );
      input.value = encoded;
      errorEl.textContent = '';
      inputEl.classList.remove('error');
    } catch (e) {
      errorEl.textContent = 'Invalid JSON: ' + e.message;
      inputEl.classList.add('error');
    }
  }

  // ── Left panel ────────────────────────────────────────────────────────────

  document.getElementById('base64ToJsonBtn').addEventListener('click', () => {
    decodeBase64ToJson(leftInput, leftInput, leftError);
  });

  document.getElementById('jsonToBase64Btn').addEventListener('click', () => {
    encodeJsonToBase64(leftInput, leftInput, leftError);
  });

  // ── Right panel ───────────────────────────────────────────────────────────

  document.getElementById('base64ToJsonRightBtn').addEventListener('click', () => {
    decodeBase64ToJson(rightInput, rightInput, rightError);
  });

  document.getElementById('jsonToBase64RightBtn').addEventListener('click', () => {
    encodeJsonToBase64(rightInput, rightInput, rightError);
  });

  // ─────────────────────────────────────────────────────────────────────────

  // Setup scroll sync
  setupScrollSync();

  // Initialize: hide JSON-only buttons for text mode (default)
  document.querySelectorAll('.json-only').forEach(el => {
    el.style.display = 'none';
  });
});
