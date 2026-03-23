/**
 * JSON Diff Engine
 * İki JSON objesini karşılaştırır ve farklılıkları bulur
 */

const JsonDiff = {
  /**
   * İki değeri karşılaştır
   */
  compare(left, right) {
    const differences = [];
    this._compare(left, right, '', differences);
    return differences;
  },

  /**
   * Recursive karşılaştırma
   */
  _compare(left, right, path, differences) {
    const leftType = this._getType(left);
    const rightType = this._getType(right);

    // Her iki taraf da undefined ise fark yok
    if (leftType === 'undefined' && rightType === 'undefined') {
      return;
    }

    // Sol tarafta var, sağda yok - silinen
    if (leftType !== 'undefined' && rightType === 'undefined') {
      differences.push({
        type: 'removed',
        path: path,
        leftValue: left,
        rightValue: undefined
      });
      return;
    }

    // Sağ tarafta var, solda yok - eklenen
    if (leftType === 'undefined' && rightType !== 'undefined') {
      differences.push({
        type: 'added',
        path: path,
        leftValue: undefined,
        rightValue: right
      });
      return;
    }

    // Tipler farklı ise değişmiş
    if (leftType !== rightType) {
      differences.push({
        type: 'modified',
        path: path,
        leftValue: left,
        rightValue: right
      });
      return;
    }

    // Object karşılaştırma
    if (leftType === 'object') {
      const allKeys = new Set([
        ...Object.keys(left || {}),
        ...Object.keys(right || {})
      ]);

      for (const key of allKeys) {
        const newPath = path ? `${path}.${key}` : key;
        this._compare(left[key], right[key], newPath, differences);
      }
      return;
    }

    // Array karşılaştırma
    if (leftType === 'array') {
      const maxLength = Math.max(left.length, right.length);

      for (let i = 0; i < maxLength; i++) {
        const newPath = `${path}[${i}]`;
        this._compare(left[i], right[i], newPath, differences);
      }
      return;
    }

    // Primitive değer karşılaştırma
    if (left !== right) {
      differences.push({
        type: 'modified',
        path: path,
        leftValue: left,
        rightValue: right
      });
    }
  },

  /**
   * Değerin tipini belirle
   */
  _getType(value) {
    if (value === undefined) return 'undefined';
    if (value === null) return 'null';
    if (Array.isArray(value)) return 'array';
    return typeof value;
  },

  /**
   * Değeri formatla (görüntüleme için)
   */
  formatValue(value) {
    if (value === undefined) return '—';
    if (value === null) return '<span class="null-highlight">null</span>';
    
    const type = typeof value;
    
    if (type === 'string') {
      const escaped = this._escapeHtml(value);
      return `<span class="string-highlight">"${escaped}"</span>`;
    }
    
    if (type === 'number') {
      return `<span class="number-highlight">${value}</span>`;
    }
    
    if (type === 'boolean') {
      return `<span class="boolean-highlight">${value}</span>`;
    }
    
    if (Array.isArray(value)) {
      if (value.length === 0) return '[]';
      if (value.length <= 3 && value.every(v => typeof v !== 'object')) {
        const items = value.map(v => this.formatValue(v)).join(', ');
        return `[${items}]`;
      }
      return `Array(${value.length})`;
    }
    
    if (type === 'object') {
      const keys = Object.keys(value);
      if (keys.length === 0) return '{}';
      if (keys.length <= 2) {
        const preview = keys.slice(0, 2).map(k => {
          const v = value[k];
          const formattedKey = `<span class="key-highlight">${this._escapeHtml(k)}</span>`;
          const formattedVal = typeof v === 'object' ? (Array.isArray(v) ? '[...]' : '{...}') : this.formatValue(v);
          return `${formattedKey}: ${formattedVal}`;
        }).join(', ');
        return `{${preview}${keys.length > 2 ? ', ...' : ''}}`;
      }
      return `Object(${keys.length} keys)`;
    }
    
    return String(value);
  },

  /**
   * HTML escape
   */
  _escapeHtml(str) {
    const div = document.createElement('div');
    div.textContent = str;
    return div.innerHTML;
  },

  /**
   * İstatistikleri hesapla
   */
  getStats(differences) {
    return {
      total: differences.length,
      added: differences.filter(d => d.type === 'added').length,
      removed: differences.filter(d => d.type === 'removed').length,
      modified: differences.filter(d => d.type === 'modified').length
    };
  }
};

// Export for use in popup.js
window.JsonDiff = JsonDiff;

/**
 * Line-by-Line JSON Diff
 * Beyond Compare tarzı satır bazlı karşılaştırma
 */
const LineDiff = {
  /**
   * JSON'ı satırlara ayır ve her satırın path'ini belirle
   */
  parseJsonLines(obj, indent = 2) {
    const json = JSON.stringify(obj, null, indent);
    const lines = json.split('\n');
    const result = [];
    
    // Her satır için path hesapla
    const pathStack = [];
    let currentPath = '';
    
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      const trimmed = line.trim();
      
      // Path'i belirle
      const keyMatch = trimmed.match(/^"([^"]+)":/);
      if (keyMatch) {
        const key = keyMatch[1];
        currentPath = pathStack.length > 0 ? `${pathStack[pathStack.length - 1]}.${key}` : key;
      }
      
      // Stack yönetimi
      if (trimmed.endsWith('{') || trimmed.endsWith('[')) {
        if (keyMatch) {
          pathStack.push(currentPath);
        } else if (trimmed === '{' || trimmed === '[') {
          // Root level
          if (pathStack.length === 0) {
            pathStack.push('');
          }
        }
      }
      
      if (trimmed.startsWith('}') || trimmed.startsWith(']')) {
        pathStack.pop();
      }
      
      result.push({
        lineNumber: i + 1,
        content: line,
        path: currentPath,
        trimmed: trimmed
      });
    }
    
    return result;
  },

  /**
   * İki JSON'ı satır satır karşılaştır
   */
  compareSideBySide(leftObj, rightObj, differences) {
    const leftLines = this.parseJsonLines(leftObj);
    const rightLines = this.parseJsonLines(rightObj);
    
    // Farklılık path'lerini set olarak tut
    const diffPaths = new Map();
    for (const diff of differences) {
      diffPaths.set(diff.path, diff.type);
    }
    
    // LCS (Longest Common Subsequence) bazlı hizalama
    const aligned = this.alignLines(leftLines, rightLines, diffPaths);
    
    return aligned;
  },

  /**
   * Satırları hizala
   */
  alignLines(leftLines, rightLines, diffPaths) {
    const result = {
      left: [],
      right: []
    };
    
    let leftIdx = 0;
    let rightIdx = 0;
    
    while (leftIdx < leftLines.length || rightIdx < rightLines.length) {
      const leftLine = leftLines[leftIdx];
      const rightLine = rightLines[rightIdx];
      
      if (!leftLine && rightLine) {
        // Sadece sağda var - eklenen
        result.left.push({ lineNumber: '', content: '', status: 'empty' });
        result.right.push({ ...rightLine, status: 'added' });
        rightIdx++;
        continue;
      }
      
      if (leftLine && !rightLine) {
        // Sadece solda var - silinen
        result.left.push({ ...leftLine, status: 'removed' });
        result.right.push({ lineNumber: '', content: '', status: 'empty' });
        leftIdx++;
        continue;
      }
      
      // Her ikisi de var
      const leftTrimmed = leftLine.trimmed;
      const rightTrimmed = rightLine.trimmed;
      
      // Aynı satır mı kontrol et
      if (leftTrimmed === rightTrimmed) {
        // Aynı
        result.left.push({ ...leftLine, status: 'unchanged' });
        result.right.push({ ...rightLine, status: 'unchanged' });
        leftIdx++;
        rightIdx++;
      } else {
        // Farklı - hangi tip olduğunu bul
        const leftPath = this.extractPathFromLine(leftLine);
        const rightPath = this.extractPathFromLine(rightLine);
        
        // Aynı key mi?
        const leftKey = this.extractKey(leftTrimmed);
        const rightKey = this.extractKey(rightTrimmed);
        
        if (leftKey && rightKey && leftKey === rightKey) {
          // Aynı key, değer farklı - modified
          result.left.push({ ...leftLine, status: 'modified' });
          result.right.push({ ...rightLine, status: 'modified' });
          leftIdx++;
          rightIdx++;
        } else if (leftKey && !this.hasKeyInRemaining(rightLines, rightIdx, leftKey)) {
          // Sol taraftaki key sağda yok - removed
          result.left.push({ ...leftLine, status: 'removed' });
          result.right.push({ lineNumber: '', content: '', status: 'empty' });
          leftIdx++;
        } else if (rightKey && !this.hasKeyInRemaining(leftLines, leftIdx, rightKey)) {
          // Sağ taraftaki key solda yok - added
          result.left.push({ lineNumber: '', content: '', status: 'empty' });
          result.right.push({ ...rightLine, status: 'added' });
          rightIdx++;
        } else {
          // Structural difference
          if (this.isStructuralChar(leftTrimmed) || this.isStructuralChar(rightTrimmed)) {
            result.left.push({ ...leftLine, status: 'unchanged' });
            result.right.push({ ...rightLine, status: 'unchanged' });
            leftIdx++;
            rightIdx++;
          } else {
            // Default: modified
            result.left.push({ ...leftLine, status: 'modified' });
            result.right.push({ ...rightLine, status: 'modified' });
            leftIdx++;
            rightIdx++;
          }
        }
      }
    }
    
    return result;
  },

  /**
   * Satırdan key çıkar
   */
  extractKey(trimmed) {
    const match = trimmed.match(/^"([^"]+)":/);
    return match ? match[1] : null;
  },

  /**
   * Kalan satırlarda key var mı?
   */
  hasKeyInRemaining(lines, startIdx, key) {
    for (let i = startIdx; i < lines.length; i++) {
      const k = this.extractKey(lines[i].trimmed);
      if (k === key) return true;
    }
    return false;
  },

  /**
   * Structural karakter mi?
   */
  isStructuralChar(trimmed) {
    return ['{', '}', '[', ']', '{},', '[],'].includes(trimmed) ||
           trimmed === '' ||
           trimmed === '},' ||
           trimmed === '],';
  },

  /**
   * Satırdan path çıkar
   */
  extractPathFromLine(line) {
    return line ? line.path : '';
  },

  /**
   * JSON satırını syntax highlight ile render et
   */
  highlightLine(content) {
    if (!content) return '';
    
    // HTML escape
    let escaped = content
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;');
    
    // Key highlight
    escaped = escaped.replace(
      /("([^"]+)")(\s*:\s*)/g,
      '<span class="json-key">$1</span>$3'
    );
    
    // String value highlight (key olmayan stringler)
    escaped = escaped.replace(
      /:\s*("([^"]*)")/g,
      ': <span class="json-string">$1</span>'
    );
    
    // Number highlight
    escaped = escaped.replace(
      /:\s*(-?\d+\.?\d*)/g,
      ': <span class="json-number">$1</span>'
    );
    
    // Boolean highlight
    escaped = escaped.replace(
      /:\s*(true|false)/g,
      ': <span class="json-boolean">$1</span>'
    );
    
    // Null highlight
    escaped = escaped.replace(
      /:\s*(null)/g,
      ': <span class="json-null">$1</span>'
    );
    
    // Brackets
    escaped = escaped.replace(
      /([{}\[\]])/g,
      '<span class="json-bracket">$1</span>'
    );
    
    return escaped;
  }
};

window.LineDiff = LineDiff;

/**
 * Text Diff Engine
 * Line-by-line text comparison (LCS algorithm)
 */
const TextDiff = {
  /**
   * Compare two texts line by line
   * @param {string} leftText
   * @param {string} rightText
   * @param {boolean} trimWhitespace - trim leading/trailing whitespace
   * @param {boolean} normalizeWhitespace - normalize all whitespace
   */
  compare(leftText, rightText, trimWhitespace = false, normalizeWhitespace = false) {
    const leftLines = leftText.split('\n');
    const rightLines = rightText.split('\n');
    
    // Create normalized versions for comparison
    let leftNormalized = leftLines;
    let rightNormalized = rightLines;
    
    if (normalizeWhitespace) {
      leftNormalized = leftLines.map(line => line.replace(/\s+/g, ' ').trim());
      rightNormalized = rightLines.map(line => line.replace(/\s+/g, ' ').trim());
    } else if (trimWhitespace) {
      leftNormalized = leftLines.map(line => line.trim());
      rightNormalized = rightLines.map(line => line.trim());
    }
    
    // Compute LCS using normalized lines
    const lcs = this._computeLCS(leftNormalized, rightNormalized);
    
    // Build diff using original lines (for display) but normalized for matching
    return this._buildDiff(leftLines, rightLines, leftNormalized, rightNormalized, lcs);
  },

  /**
   * Compute LCS table
   */
  _computeLCS(left, right) {
    const m = left.length;
    const n = right.length;
    const dp = Array(m + 1).fill(null).map(() => Array(n + 1).fill(0));
    
    for (let i = 1; i <= m; i++) {
      for (let j = 1; j <= n; j++) {
        if (left[i - 1] === right[j - 1]) {
          dp[i][j] = dp[i - 1][j - 1] + 1;
        } else {
          dp[i][j] = Math.max(dp[i - 1][j], dp[i][j - 1]);
        }
      }
    }
    
    return dp;
  },

  /**
   * Build diff from LCS
   * @param {string[]} left - original left lines (for display)
   * @param {string[]} right - original right lines (for display)
   * @param {string[]} leftNorm - normalized left lines (for comparison)
   * @param {string[]} rightNorm - normalized right lines (for comparison)
   * @param {number[][]} dp - LCS table
   */
  _buildDiff(left, right, leftNorm, rightNorm, dp) {
    const result = { left: [], right: [] };
    let i = left.length;
    let j = right.length;
    
    const leftResult = [];
    const rightResult = [];
    
    while (i > 0 || j > 0) {
      if (i > 0 && j > 0 && leftNorm[i - 1] === rightNorm[j - 1]) {
        // Same line (using normalized comparison)
        leftResult.unshift({ lineNumber: i, content: left[i - 1], status: 'unchanged' });
        rightResult.unshift({ lineNumber: j, content: right[j - 1], status: 'unchanged' });
        i--;
        j--;
      } else if (j > 0 && (i === 0 || dp[i][j - 1] >= dp[i - 1][j])) {
        // Added on right
        leftResult.unshift({ lineNumber: '', content: '', status: 'empty' });
        rightResult.unshift({ lineNumber: j, content: right[j - 1], status: 'added' });
        j--;
      } else if (i > 0 && (j === 0 || dp[i][j - 1] < dp[i - 1][j])) {
        // Removed from left
        leftResult.unshift({ lineNumber: i, content: left[i - 1], status: 'removed' });
        rightResult.unshift({ lineNumber: '', content: '', status: 'empty' });
        i--;
      }
    }
    
    result.left = leftResult;
    result.right = rightResult;
    
    return result;
  },

  /**
   * Get change statistics
   */
  getStats(diffResult) {
    let added = 0, removed = 0;
    
    for (const line of diffResult.right) {
      if (line.status === 'added') added++;
    }
    for (const line of diffResult.left) {
      if (line.status === 'removed') removed++;
    }
    
    return {
      total: added + removed,
      added,
      removed,
      modified: 0
    };
  }
};

window.TextDiff = TextDiff;

/**
 * Whitespace normalization utilities
 */
const WhitespaceUtil = {
  /**
   * Trim leading and trailing whitespace
   */
  trimLine(line) {
    return line.trim();
  },

  /**
   * Normalize all whitespace (collapse multiple spaces, trim)
   */
  normalizeAll(line) {
    return line.replace(/\s+/g, ' ').trim();
  }
};

window.WhitespaceUtil = WhitespaceUtil;
