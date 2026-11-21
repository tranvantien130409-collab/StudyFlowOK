import JSZip from 'jszip';
import { DOMParser } from '@xmldom/xmldom';

export interface ParsedAzotaQuestion {
  id: number;
  questionText: string;
  options: string[];
  correctOption: number; // 0..3 if detected in file, -1 if not present in file
  hasDetectedAnswer: boolean;
  explanation: string;
}

export interface ParsedAzotaResult {
  title: string;
  subject: string;
  durationMinutes: number;
  questions: ParsedAzotaQuestion[];
  stats: {
    totalMarkersDetected: number;
    parsedCount: number;
    detectedAnswerCount: number;
    missingAnswerCount: number;
  };
}

export interface DocxExtractedImage {
  name: string;
  mimeType: string;
  base64: string;
}

export interface DocxExtractionResult {
  text: string;
  markedLineIndices: Set<number>;
  images: DocxExtractedImage[];
  paragraphCount: number;
}

const SYMBOL_FONT_MAP: Record<number, string> = {
  0xf020: ' ',
  0xf02b: '+',
  0xf02d: '-',
  0xf03d: '=',
  0xf044: 'Δ',
  0xf046: 'Φ',
  0xf047: 'Γ',
  0xf04c: 'Λ',
  0xf050: 'Π',
  0xf051: 'Θ',
  0xf053: 'Σ',
  0xf057: 'Ω',
  0xf059: 'Ψ',
  0xf061: 'α',
  0xf062: 'β',
  0xf063: 'χ',
  0xf064: 'δ',
  0xf065: 'ε',
  0xf066: 'φ',
  0xf067: 'γ',
  0xf068: 'η',
  0xf069: 'ι',
  0xf06a: 'φ',
  0xf06b: 'κ',
  0xf06c: 'λ',
  0xf06d: 'μ',
  0xf06e: 'ν',
  0xf070: 'π',
  0xf071: 'θ',
  0xf072: 'ρ',
  0xf073: 'σ',
  0xf074: 'τ',
  0xf075: 'υ',
  0xf077: 'ω',
  0xf078: 'ξ',
  0xf079: 'ψ',
  0xf07a: 'ζ',
  0xf0a3: '≤',
  0xf0a5: '∞',
  0xf0ab: '↔',
  0xf0ac: '←',
  0xf0ae: '→',
  0xf0b0: '°',
  0xf0b1: '±',
  0xf0b3: '≥',
  0xf0b4: '×',
  0xf0b5: '∝',
  0xf0b6: '∂',
  0xf0b7: '·',
  0xf0b8: '÷',
  0xf0b9: '≠',
  0xf0ba: '≡',
  0xf0bb: '≈',
  0xf0bc: '...',
  0xf0d6: '√',
  0xf0d7: '·',
  0xf0de: '⇒',
  0xf0e5: '∑',
  0xf0f2: '∫',
};

const SUPERSCRIPT_CHAR_MAP: Record<string, string> = {
  '0': '⁰',
  '1': '¹',
  '2': '²',
  '3': '³',
  '4': '⁴',
  '5': '⁵',
  '6': '⁶',
  '7': '⁷',
  '8': '⁸',
  '9': '⁹',
  '+': '⁺',
  '-': '⁻',
  '−': '⁻',
  '=': '⁼',
  '(': '⁽',
  ')': '⁾',
  'n': 'ⁿ',
  'i': 'ⁱ',
};

const SUBSCRIPT_CHAR_MAP: Record<string, string> = {
  '0': '₀',
  '1': '₁',
  '2': '₂',
  '3': '₃',
  '4': '₄',
  '5': '₅',
  '6': '₆',
  '7': '₇',
  '8': '₈',
  '9': '₉',
  '+': '₊',
  '-': '₋',
  '−': '₋',
  '=': '₌',
  '(': '₍',
  ')': '₎',
};

function toUnicodeSuperscript(text: string): string | null {
  const chars = Array.from(text.trim());
  if (chars.length === 0) return null;
  let out = '';
  for (const ch of chars) {
    if (SUPERSCRIPT_CHAR_MAP[ch]) {
      out += SUPERSCRIPT_CHAR_MAP[ch];
    } else {
      return null;
    }
  }
  return out;
}

function toUnicodeSubscript(text: string): string | null {
  const chars = Array.from(text.trim());
  if (chars.length === 0) return null;
  let out = '';
  for (const ch of chars) {
    if (SUBSCRIPT_CHAR_MAP[ch]) {
      out += SUBSCRIPT_CHAR_MAP[ch];
    } else {
      return null;
    }
  }
  return out;
}

function localName(node: any): string {
  return node?.localName || (node?.nodeName ? String(node.nodeName).split(':').pop() : '') || '';
}

function getAttr(node: any, name: string): string | null {
  if (!node || !node.getAttribute) return null;
  return (
    node.getAttribute(name) ||
    node.getAttribute(`w:${name}`) ||
    node.getAttribute(`m:${name}`) ||
    node.getAttribute(`r:${name}`) ||
    null
  );
}

function childElements(node: any, name?: string): any[] {
  const out: any[] = [];
  if (!node || !node.childNodes) return out;
  for (let i = 0; i < node.childNodes.length; i++) {
    const child = node.childNodes[i];
    if (child.nodeType === 1) {
      if (!name || localName(child) === name) {
        out.push(child);
      }
    }
  }
  return out;
}

function firstChildElement(node: any, name: string): any | null {
  if (!node || !node.childNodes) return null;
  for (let i = 0; i < node.childNodes.length; i++) {
    const child = node.childNodes[i];
    if (child.nodeType === 1 && localName(child) === name) {
      return child;
    }
  }
  return null;
}

function convertNumberingFormat(num: number, fmt: string): string {
  switch (fmt) {
    case 'upperLetter': {
      let n = num;
      let s = '';
      while (n > 0) {
        n--;
        s = String.fromCharCode(65 + (n % 26)) + s;
        n = Math.floor(n / 26);
      }
      return s || 'A';
    }
    case 'lowerLetter':
      return convertNumberingFormat(num, 'upperLetter').toLowerCase();
    case 'upperRoman': {
      const romans: [number, string][] = [
        [1000, 'M'], [900, 'CM'], [500, 'D'], [400, 'CD'],
        [100, 'C'], [90, 'XC'], [50, 'L'], [40, 'XL'],
        [10, 'X'], [9, 'IX'], [5, 'V'], [4, 'IV'], [1, 'I']
      ];
      let n = num;
      let res = '';
      for (const [val, sym] of romans) {
        while (n >= val) {
          res += sym;
          n -= val;
        }
      }
      return res || String(num);
    }
    case 'lowerRoman':
      return convertNumberingFormat(num, 'upperRoman').toLowerCase();
    case 'bullet':
    case 'none':
      return '';
    case 'decimalZero':
      return num < 10 ? `0${num}` : String(num);
    default:
      return String(num);
  }
}

interface NumberingLevelDef {
  start: number;
  numFmt: string;
  lvlText: string;
}

interface NumberingRegistry {
  abstractLevels: Map<string, Map<number, NumberingLevelDef>>;
  numToAbstract: Map<string, string>;
  numOverrides: Map<string, Map<number, Partial<NumberingLevelDef>>>;
  styleNumPr: Map<string, { numId: string; ilvl: number }>;
  counters: Map<string, Map<number, number>>;
}

function parseNumberingRegistry(numberingXml: string | null, stylesXml: string | null): NumberingRegistry {
  const reg: NumberingRegistry = {
    abstractLevels: new Map(),
    numToAbstract: new Map(),
    numOverrides: new Map(),
    styleNumPr: new Map(),
    counters: new Map(),
  };

  const parser = new DOMParser();

  if (numberingXml) {
    try {
      const doc = parser.parseFromString(numberingXml, 'text/xml');
      const root = doc.documentElement;
      for (const absNode of childElements(root, 'abstractNum')) {
        const absId = getAttr(absNode, 'abstractNumId');
        if (!absId) continue;
        const lvls = new Map<number, NumberingLevelDef>();
        for (const lvlNode of childElements(absNode, 'lvl')) {
          const ilvl = parseInt(getAttr(lvlNode, 'ilvl') || '0', 10);
          const startNode = firstChildElement(lvlNode, 'start');
          const fmtNode = firstChildElement(lvlNode, 'numFmt');
          const txtNode = firstChildElement(lvlNode, 'lvlText');
          lvls.set(ilvl, {
            start: parseInt(getAttr(startNode, 'val') || '1', 10) || 1,
            numFmt: getAttr(fmtNode, 'val') || 'decimal',
            lvlText: getAttr(txtNode, 'val') || '%1.',
          });
        }
        reg.abstractLevels.set(absId, lvls);
      }

      for (const numNode of childElements(root, 'num')) {
        const numId = getAttr(numNode, 'numId');
        if (!numId) continue;
        const absRef = firstChildElement(numNode, 'abstractNumId');
        const absId = getAttr(absRef, 'val');
        if (absId) reg.numToAbstract.set(numId, absId);

        const ovMap = new Map<number, Partial<NumberingLevelDef>>();
        for (const ovNode of childElements(numNode, 'lvlOverride')) {
          const ilvl = parseInt(getAttr(ovNode, 'ilvl') || '0', 10);
          const startOv = firstChildElement(ovNode, 'startOverride');
          const lvlOv = firstChildElement(ovNode, 'lvl');
          const partial: Partial<NumberingLevelDef> = {};
          if (startOv) {
            const v = parseInt(getAttr(startOv, 'val') || '', 10);
            if (!Number.isNaN(v)) partial.start = v;
          }
          if (lvlOv) {
            const startNode = firstChildElement(lvlOv, 'start');
            const fmtNode = firstChildElement(lvlOv, 'numFmt');
            const txtNode = firstChildElement(lvlOv, 'lvlText');
            if (startNode) partial.start = parseInt(getAttr(startNode, 'val') || '1', 10);
            if (fmtNode) partial.numFmt = getAttr(fmtNode, 'val') || 'decimal';
            if (txtNode) partial.lvlText = getAttr(txtNode, 'val') || '%1.';
          }
          ovMap.set(ilvl, partial);
        }
        if (ovMap.size > 0) reg.numOverrides.set(numId, ovMap);
      }
    } catch {
      // ignore malformed numbering.xml
    }
  }

  if (stylesXml) {
    try {
      const doc = parser.parseFromString(stylesXml, 'text/xml');
      const root = doc.documentElement;
      for (const styleNode of childElements(root, 'style')) {
        const styleId = getAttr(styleNode, 'styleId');
        const pPr = firstChildElement(styleNode, 'pPr');
        const numPr = firstChildElement(pPr, 'numPr');
        if (styleId && numPr) {
          const numIdNode = firstChildElement(numPr, 'numId');
          const ilvlNode = firstChildElement(numPr, 'ilvl');
          const numId = getAttr(numIdNode, 'val');
          const ilvl = parseInt(getAttr(ilvlNode, 'val') || '0', 10) || 0;
          if (numId && numId !== '0') {
            reg.styleNumPr.set(styleId, { numId, ilvl });
          }
        }
      }
    } catch {
      // ignore malformed styles.xml
    }
  }

  return reg;
}

function nextNumberingLabel(reg: NumberingRegistry, numId: string, ilvl: number): string {
  if (!numId || numId === '0') return '';
  const absId = reg.numToAbstract.get(numId);
  if (!absId) return '';
  const absLvls = reg.abstractLevels.get(absId);
  if (!absLvls) return '';

  const baseDef = absLvls.get(ilvl);
  const ovDef = reg.numOverrides.get(numId)?.get(ilvl);
  const def: NumberingLevelDef = {
    start: ovDef?.start ?? baseDef?.start ?? 1,
    numFmt: ovDef?.numFmt ?? baseDef?.numFmt ?? 'decimal',
    lvlText: ovDef?.lvlText ?? baseDef?.lvlText ?? '%1.',
  };

  if (def.numFmt === 'bullet' || def.numFmt === 'none') return '';

  let numCounters = reg.counters.get(numId);
  if (!numCounters) {
    numCounters = new Map();
    reg.counters.set(numId, numCounters);
  }

  // Reset deeper levels
  for (const existingLvl of Array.from(numCounters.keys())) {
    if (existingLvl > ilvl) {
      numCounters.delete(existingLvl);
    }
  }

  const prev = numCounters.get(ilvl);
  const current = prev === undefined ? def.start : prev + 1;
  numCounters.set(ilvl, current);

  let label = def.lvlText || '%1.';
  for (let l = 0; l <= ilvl; l++) {
    const lBase = absLvls.get(l);
    const lOv = reg.numOverrides.get(numId)?.get(l);
    const lFmt = lOv?.numFmt ?? lBase?.numFmt ?? 'decimal';
    const val = numCounters.get(l) ?? (lOv?.start ?? lBase?.start ?? 1);
    const formatted = convertNumberingFormat(val, lFmt);
    label = label.replace(new RegExp(`%${l + 1}`, 'g'), formatted);
  }

  // Clean invisible placeholders
  label = label.replace(/%\d+/g, '').trim();
  if (!label) return '';
  return `${label} `;
}

function normalizeLatexSymbolText(raw: string): string {
  return raw
    .replace(/×/g, '\\times ')
    .replace(/÷/g, '\\div ')
    .replace(/±/g, '\\pm ')
    .replace(/≤/g, '\\le ')
    .replace(/≥/g, '\\ge ')
    .replace(/≠/g, '\\ne ')
    .replace(/≈/g, '\\approx ')
    .replace(/→/g, '\\to ')
    .replace(/⇒/g, '\\Rightarrow ')
    .replace(/∞/g, '\\infty ')
    .replace(/π/g, '\\pi ')
    .replace(/ω/g, '\\omega ')
    .replace(/Ω/g, '\\Omega ')
    .replace(/Δ/g, '\\Delta ')
    .replace(/φ/g, '\\varphi ')
    .replace(/Φ/g, '\\Phi ')
    .replace(/λ/g, '\\lambda ')
    .replace(/μ/g, '\\mu ')
    .replace(/α/g, '\\alpha ')
    .replace(/β/g, '\\beta ')
    .replace(/γ/g, '\\gamma ')
    .replace(/θ/g, '\\theta ');
}

function convertOmmlNodeToLatex(node: any): string {
  if (!node) return '';
  if (node.nodeType === 3) return node.nodeValue || '';
  if (node.nodeType !== 1) return '';

  const tag = localName(node);
  const childrenLatex = (parent: any): string => {
    if (!parent || !parent.childNodes) return '';
    let acc = '';
    for (let i = 0; i < parent.childNodes.length; i++) {
      acc += convertOmmlNodeToLatex(parent.childNodes[i]);
    }
    return acc;
  };

  switch (tag) {
    case 'oMathPara': {
      const parts = childElements(node, 'oMath').map((m) => convertOmmlNodeToLatex(m)).filter(Boolean);
      return parts.join(' ');
    }
    case 'oMath':
    case 'e':
    case 'num':
    case 'den':
    case 'sup':
    case 'sub':
    case 'deg':
    case 'fName':
    case 'lim':
    case 'r':
      return childrenLatex(node);
    case 't': {
      const raw = node.textContent || '';
      return normalizeLatexSymbolText(raw);
    }
    case 'f': {
      const fPr = firstChildElement(node, 'fPr');
      const fType = getAttr(firstChildElement(fPr, 'type'), 'val');
      const num = convertOmmlNodeToLatex(firstChildElement(node, 'num')).trim();
      const den = convertOmmlNodeToLatex(firstChildElement(node, 'den')).trim();
      if (fType === 'lin' || fType === 'noBar') {
        return `${num}/${den}`;
      }
      return `\\frac{${num}}{${den}}`;
    }
    case 'sSup': {
      const e = convertOmmlNodeToLatex(firstChildElement(node, 'e')).trim();
      const sup = convertOmmlNodeToLatex(firstChildElement(node, 'sup')).trim();
      const base = e.length > 1 && !/^\\[a-zA-Z]+$/.test(e) && !/^[({[]/.test(e) ? `{${e}}` : e;
      return `${base}^{${sup}}`;
    }
    case 'sSub': {
      const e = convertOmmlNodeToLatex(firstChildElement(node, 'e')).trim();
      const sub = convertOmmlNodeToLatex(firstChildElement(node, 'sub')).trim();
      const base = e.length > 1 && !/^\\[a-zA-Z]+$/.test(e) && !/^[({[]/.test(e) ? `{${e}}` : e;
      return `${base}_{${sub}}`;
    }
    case 'sSubSup': {
      const e = convertOmmlNodeToLatex(firstChildElement(node, 'e')).trim();
      const sub = convertOmmlNodeToLatex(firstChildElement(node, 'sub')).trim();
      const sup = convertOmmlNodeToLatex(firstChildElement(node, 'sup')).trim();
      const base = e.length > 1 && !/^\\[a-zA-Z]+$/.test(e) ? `{${e}}` : e;
      return `${base}_{${sub}}^{${sup}}`;
    }
    case 'rad': {
      const deg = convertOmmlNodeToLatex(firstChildElement(node, 'deg')).trim();
      const e = convertOmmlNodeToLatex(firstChildElement(node, 'e')).trim();
      return deg ? `\\sqrt[${deg}]{${e}}` : `\\sqrt{${e}}`;
    }
    case 'd': {
      const dPr = firstChildElement(node, 'dPr');
      const beg = getAttr(firstChildElement(dPr, 'begChr'), 'val') ?? '(';
      const end = getAttr(firstChildElement(dPr, 'endChr'), 'val') ?? ')';
      const sep = getAttr(firstChildElement(dPr, 'sepChr'), 'val') ?? ',';
      const elems = childElements(node, 'e').map((el) => convertOmmlNodeToLatex(el).trim());
      const openTok = beg === '{' ? '\\{' : beg === '' ? '' : beg;
      const closeTok = end === '}' ? '\\}' : end === '' ? '' : end;
      return `${openTok}${elems.join(sep)}${closeTok}`;
    }
    case 'nary': {
      const naryPr = firstChildElement(node, 'naryPr');
      const chr = getAttr(firstChildElement(naryPr, 'chr'), 'val') || '∑';
      let op = '\\sum';
      if (chr === '∫') op = '\\int';
      else if (chr === '∏') op = '\\prod';
      const sub = convertOmmlNodeToLatex(firstChildElement(node, 'sub')).trim();
      const sup = convertOmmlNodeToLatex(firstChildElement(node, 'sup')).trim();
      const e = convertOmmlNodeToLatex(firstChildElement(node, 'e')).trim();
      return `${op}${sub ? `_{${sub}}` : ''}${sup ? `^{${sup}}` : ''} ${e}`.trim();
    }
    case 'acc': {
      const accPr = firstChildElement(node, 'accPr');
      const chr = getAttr(firstChildElement(accPr, 'chr'), 'val') || '';
      const e = convertOmmlNodeToLatex(firstChildElement(node, 'e')).trim();
      if (chr === '→' || chr === '\u20d7') return `\\vec{${e}}`;
      if (chr === '^') return `\\hat{${e}}`;
      return `\\bar{${e}}`;
    }
    case 'bar': {
      const e = convertOmmlNodeToLatex(firstChildElement(node, 'e')).trim();
      return `\\overline{${e}}`;
    }
    case 'func': {
      const fName = convertOmmlNodeToLatex(firstChildElement(node, 'fName')).trim();
      const e = convertOmmlNodeToLatex(firstChildElement(node, 'e')).trim();
      return `${fName}(${e})`;
    }
    case 'eqArr': {
      const rows = childElements(node, 'e').map((el) => convertOmmlNodeToLatex(el).trim()).filter(Boolean);
      return rows.join(' ; ');
    }
    case 'm': {
      const rows = childElements(node, 'mr').map((mr) =>
        childElements(mr, 'e').map((el) => convertOmmlNodeToLatex(el).trim()).join(' & ')
      );
      return `\\begin{matrix} ${rows.join(' \\\\ ')} \\end{matrix}`;
    }
    case 'limLow': {
      const e = convertOmmlNodeToLatex(firstChildElement(node, 'e')).trim();
      const lim = convertOmmlNodeToLatex(firstChildElement(node, 'lim')).trim();
      return `${e}_{${lim}}`;
    }
    case 'limUpp': {
      const e = convertOmmlNodeToLatex(firstChildElement(node, 'e')).trim();
      const lim = convertOmmlNodeToLatex(firstChildElement(node, 'lim')).trim();
      return `${e}^{${lim}}`;
    }
    case 'groupChr':
    case 'box':
    case 'borderBox':
      return convertOmmlNodeToLatex(firstChildElement(node, 'e'));
    case 'rPr':
    case 'ctrlPr':
    case 'fPr':
    case 'dPr':
    case 'radPr':
    case 'naryPr':
    case 'accPr':
    case 'barPr':
    case 'funcPr':
    case 'sSubPr':
    case 'sSupPr':
    case 'sSubSupPr':
    case 'mPr':
      return '';
    default:
      return childrenLatex(node);
  }
}

function formatOmmlWrapped(ommlNode: any): string {
  const latex = convertOmmlNodeToLatex(ommlNode).replace(/\s+/g, ' ').trim();
  if (!latex) return '';
  // Simple single number or single plain ASCII letter doesn't need $...$
  if (/^[a-zA-Z0-9.,]+$/.test(latex) && latex.length <= 4) {
    return latex;
  }
  return `$${latex}$`;
}

function isColoredHighlightStyle(colorVal: string | null): boolean {
  if (!colorVal) return false;
  const upper = colorVal.toUpperCase();
  if (
    upper === 'AUTO' ||
    upper === '000000' ||
    upper === 'FFFFFF' ||
    upper === '111111' ||
    upper === '222222' ||
    upper === '333333' ||
    upper === '444444'
  ) {
    return false;
  }
  // Check if clearly reddish, bright blue, or emerald (common teacher key markers)
  if (/^[0-9A-F]{6}$/.test(upper)) {
    const r = parseInt(upper.slice(0, 2), 16);
    const g = parseInt(upper.slice(2, 4), 16);
    const b = parseInt(upper.slice(4, 6), 16);
    // Avoid near-black / near-gray
    if (Math.max(r, g, b) < 70) return false;
    if (Math.abs(r - g) < 18 && Math.abs(g - b) < 18) return false;
    return true;
  }
  return true;
}

interface ParagraphExtractOutput {
  text: string;
  hasKeyStyle: boolean;
  nestedLines: { text: string; hasKeyStyle: boolean }[];
}

function extractParagraphContent(
  pNode: any,
  reg: NumberingRegistry
): ParagraphExtractOutput {
  let prefix = '';
  const pPr = firstChildElement(pNode, 'pPr');
  let numPr = firstChildElement(pPr, 'numPr');

  if (numPr) {
    const numIdNode = firstChildElement(numPr, 'numId');
    const ilvlNode = firstChildElement(numPr, 'ilvl');
    const numId = getAttr(numIdNode, 'val') || '';
    const ilvl = parseInt(getAttr(ilvlNode, 'val') || '0', 10) || 0;
    prefix = nextNumberingLabel(reg, numId, ilvl);
  } else {
    const pStyleNode = firstChildElement(pPr, 'pStyle');
    const styleId = getAttr(pStyleNode, 'val');
    if (styleId && reg.styleNumPr.has(styleId)) {
      const ref = reg.styleNumPr.get(styleId)!;
      prefix = nextNumberingLabel(reg, ref.numId, ref.ilvl);
    }
  }

  let text = '';
  let markedChars = 0;
  let totalVisibleChars = 0;
  const nestedLines: { text: string; hasKeyStyle: boolean }[] = [];

  const walkNode = (node: any) => {
    if (!node || node.nodeType !== 1) return;
    const tag = localName(node);

    if (tag === 'del' || tag === 'moveFrom' || tag === 'pPr' || tag === 'sectPr' || tag === 'bookmarkStart' || tag === 'bookmarkEnd') {
      return;
    }

    if (tag === 'AlternateContent') {
      const choice = firstChildElement(node, 'Choice');
      if (choice) {
        walkNode(choice);
      } else {
        const fallback = firstChildElement(node, 'Fallback');
        if (fallback) walkNode(fallback);
      }
      return;
    }

    if (tag === 'txbxContent') {
      for (const innerP of childElements(node, 'p')) {
        const innerOut = extractParagraphContent(innerP, reg);
        if (innerOut.text.trim()) {
          nestedLines.push({ text: innerOut.text.trim(), hasKeyStyle: innerOut.hasKeyStyle });
        }
        for (const nl of innerOut.nestedLines) {
          nestedLines.push(nl);
        }
      }
      return;
    }

    if (tag === 'oMathPara' || tag === 'oMath') {
      const wrapped = formatOmmlWrapped(node);
      if (wrapped) {
        text += (text && !text.endsWith(' ') && !text.endsWith('\n') && !text.endsWith('\t') ? ' ' : '') + wrapped + ' ';
      }
      return;
    }

    if (tag === 'r') {
      const rPr = firstChildElement(node, 'rPr');
      const vertNode = firstChildElement(rPr, 'vertAlign');
      const vertAlign = getAttr(vertNode, 'val');
      const uNode = firstChildElement(rPr, 'u');
      const uVal = getAttr(uNode, 'val');
      const isUnderlined = Boolean(uNode && uVal !== 'none');
      const hlNode = firstChildElement(rPr, 'highlight');
      const hlVal = getAttr(hlNode, 'val');
      const isHighlighted = Boolean(hlNode && hlVal && hlVal !== 'none');
      const colorNode = firstChildElement(rPr, 'color');
      const isColored = isColoredHighlightStyle(getAttr(colorNode, 'val'));
      const runMarked = isUnderlined || isHighlighted || isColored;

      let runText = '';
      for (let i = 0; i < node.childNodes.length; i++) {
        const ch = node.childNodes[i];
        if (ch.nodeType !== 1) continue;
        const cTag = localName(ch);
        if (cTag === 't') {
          runText += ch.textContent || '';
        } else if (cTag === 'tab') {
          runText += '\t';
        } else if (cTag === 'br' || cTag === 'cr') {
          runText += '\n';
        } else if (cTag === 'noBreakHyphen') {
          runText += '-';
        } else if (cTag === 'sym') {
          const charCodeHex = getAttr(ch, 'char');
          if (charCodeHex) {
            const code = parseInt(charCodeHex, 16);
            runText += SYMBOL_FONT_MAP[code] || (code < 0xf000 ? String.fromCharCode(code) : '');
          }
        } else if (cTag === 'drawing' || cTag === 'pict' || cTag === 'AlternateContent' || cTag === 'object') {
          walkNode(ch);
        }
      }

      if (runText) {
        let formatted = runText;
        if (vertAlign === 'superscript') {
          const uni = toUnicodeSuperscript(runText);
          formatted = uni ?? `^{${runText.trim()}}`;
        } else if (vertAlign === 'subscript') {
          const uni = toUnicodeSubscript(runText);
          formatted = uni ?? `_{${runText.trim()}}`;
        }

        const visibleLen = formatted.replace(/\s+/g, '').length;
        totalVisibleChars += visibleLen;
        if (runMarked) markedChars += visibleLen;
        text += formatted;
      }
      return;
    }

    for (let i = 0; i < node.childNodes.length; i++) {
      if (node.childNodes[i].nodeType === 1) {
        walkNode(node.childNodes[i]);
      }
    }
  };

  walkNode(pNode);

  // Merge prefix carefully (avoid duplicating if Word author typed "Câu 1:" AND also had numbering)
  let combined = text;
  if (prefix) {
    const trimmed = text.trimStart();
    const prefixTrimmed = prefix.trim();
    const startsWithPrefixAlready =
      trimmed.startsWith(prefixTrimmed) ||
      (/^(?:Câu|Bài)\s*\d+/i.test(prefixTrimmed) && /^(?:Câu|Bài)\s*\d+/i.test(trimmed)) ||
      (/^[A-Da-d][.)]$/i.test(prefixTrimmed) && /^[A-Da-d][.)]\s/.test(trimmed));
    if (!startsWithPrefixAlready) {
      combined = `${prefix}${text}`;
    }
  }

  // Clean soft spaces
  combined = combined
    .replace(/\u00a0/g, ' ')
    .replace(/[ ]{2,}/g, ' ')
    .trim();

  // Merge adjacent inline math blocks `$a$ $b$` -> `$a b$` only if trivially adjacent? Better leave separate so KaTeX parses cleanly
  const hasKeyStyle = totalVisibleChars > 0 && markedChars >= Math.min(2, totalVisibleChars) && markedChars / totalVisibleChars >= 0.25;

  return {
    text: combined,
    hasKeyStyle,
    nestedLines,
  };
}

function extractTableLines(
  tblNode: any,
  reg: NumberingRegistry
): { text: string; hasKeyStyle: boolean }[] {
  const rows: { cells: string[]; hasKeyStyles: boolean[] }[] = [];

  for (const tr of childElements(tblNode, 'tr')) {
    const cells: string[] = [];
    const hasKeyStyles: boolean[] = [];

    for (const tc of childElements(tr, 'tc')) {
      const cellLines: string[] = [];
      let cellMarked = false;

      for (let i = 0; i < tc.childNodes.length; i++) {
        const ch = tc.childNodes[i];
        if (ch.nodeType !== 1) continue;
        const tag = localName(ch);
        if (tag === 'p') {
          const out = extractParagraphContent(ch, reg);
          if (out.text) {
            cellLines.push(out.text);
            if (out.hasKeyStyle) cellMarked = true;
          }
          for (const nl of out.nestedLines) {
            cellLines.push(nl.text);
            if (nl.hasKeyStyle) cellMarked = true;
          }
        } else if (tag === 'tbl') {
          const nestedTbl = extractTableLines(ch, reg);
          for (const nl of nestedTbl) {
            cellLines.push(nl.text);
          }
        }
      }

      cells.push(cellLines.join('\n').trim());
      hasKeyStyles.push(cellMarked);
    }

    if (cells.some(Boolean)) {
      rows.push({ cells, hasKeyStyles });
    }
  }

  const out: { text: string; hasKeyStyle: boolean }[] = [];

  // Detect Azota horizontal Answer Key table:
  // e.g. Row 0: ["Câu", "1", "2", "3"...] or ["1", "2", "3"...]
  //      Row 1: ["Đáp án", "A", "C", "B"...] or ["A", "C", "B"...]
  const isPureAnswerRow = (cells: string[]) => {
    const nonEmpty = cells.filter(Boolean);
    if (nonEmpty.length < 2) return false;
    const answerCells = nonEmpty.filter((c) => /^[A-Da-d]$/.test(c.trim()));
    return answerCells.length >= Math.max(2, nonEmpty.length - 1);
  };
  const isPureNumberRow = (cells: string[]) => {
    const nonEmpty = cells.filter(Boolean);
    if (nonEmpty.length < 2) return false;
    const numCells = nonEmpty.filter((c) => /^(?:Câu\s*)?\d{1,3}[.:]?$/i.test(c.trim()));
    return numCells.length >= Math.max(2, nonEmpty.length - 1);
  };

  let usedAnswerGrid = false;
  const pairedAnswerPairs: string[] = [];
  for (let r = 0; r < rows.length - 1; r++) {
    if (isPureNumberRow(rows[r].cells) && isPureAnswerRow(rows[r + 1].cells)) {
      const len = Math.min(rows[r].cells.length, rows[r + 1].cells.length);
      for (let c = 0; c < len; c++) {
        const numMatch = rows[r].cells[c].trim().match(/(\d{1,3})/);
        const ansMatch = rows[r + 1].cells[c].trim().match(/^([A-Da-d])$/);
        if (numMatch && ansMatch) {
          pairedAnswerPairs.push(`${numMatch[1]}.${ansMatch[1].toUpperCase()}`);
        }
      }
      usedAnswerGrid = true;
      r++; // skip paired answer row
    }
  }

  if (usedAnswerGrid && pairedAnswerPairs.length >= 2) {
    out.push({ text: 'BẢNG ĐÁP ÁN', hasKeyStyle: false });
    out.push({ text: pairedAnswerPairs.join(' '), hasKeyStyle: false });
    return out;
  }

  // Also detect vertical answer key columns: ["1", "A", "2", "B"] or ["1.A", "2.B"]
  const allCells = rows.flatMap((r) => r.cells).filter(Boolean);
  const pairCells = allCells.filter((c) => /^\d{1,3}\s*[.:\-)]*\s*[A-Da-d]$/.test(c));
  if (allCells.length >= 4 && pairCells.length >= allCells.length * 0.6) {
    out.push({ text: 'BẢNG ĐÁP ÁN', hasKeyStyle: false });
    out.push({ text: pairCells.join(' '), hasKeyStyle: false });
    return out;
  }

  // Standard table content: emit rows cleanly
  for (const row of rows) {
    const nonEmptyCells = row.cells.filter(Boolean);
    if (nonEmptyCells.length === 0) continue;

    // If cells look like options ("A. ..." and "B. ..."), preserve exact cell marking
    const hasMultilineCell = nonEmptyCells.some((c) => c.includes('\n'));
    const markedCellCount = row.hasKeyStyles.filter(Boolean).length;
    if (hasMultilineCell) {
      row.cells.forEach((cell, idx) => {
        if (!cell) return;
        const cellLines = cell.split('\n').filter((l) => l.trim());
        cellLines.forEach((line, lIdx) => {
          const isStyledCell = markedCellCount === 1 && row.hasKeyStyles[idx] && lIdx === 0;
          out.push({ text: line.trim(), hasKeyStyle: isStyledCell });
        });
      });
    } else if (nonEmptyCells.length === 1) {
      out.push({ text: nonEmptyCells[0], hasKeyStyle: markedCellCount === 1 });
    } else {
      const optionCellCount = nonEmptyCells.filter((c) => /^\*?\s*\(?[A-Da-d][.):\/]\s*/.test(c)).length;
      if (optionCellCount >= 2) {
        row.cells.forEach((cell, idx) => {
          if (!cell) return;
          out.push({
            text: cell,
            hasKeyStyle: markedCellCount === 1 && row.hasKeyStyles[idx],
          });
        });
      } else {
        out.push({
          text: nonEmptyCells.join('\t'),
          hasKeyStyle: false,
        });
      }
    }
  }

  return out;
}

export async function extractDocxContent(buffer: Buffer): Promise<DocxExtractionResult> {
  const zip = await JSZip.loadAsync(buffer);
  const docEntry = zip.file('word/document.xml');
  if (!docEntry) {
    throw new Error('File .docx không hợp lệ (thiếu word/document.xml)');
  }

  const docXml = await docEntry.async('string');
  const numberingXml = (await zip.file('word/numbering.xml')?.async('string')) || null;
  const stylesXml = (await zip.file('word/styles.xml')?.async('string')) || null;

  const reg = parseNumberingRegistry(numberingXml, stylesXml);
  const parser = new DOMParser();
  const doc = parser.parseFromString(docXml, 'text/xml');
  const body = firstChildElement(doc.documentElement, 'body') || doc.documentElement;

  const lines: { text: string; hasKeyStyle: boolean }[] = [];
  let paragraphCount = 0;

  for (let i = 0; i < body.childNodes.length; i++) {
    const node = body.childNodes[i];
    if (node.nodeType !== 1) continue;
    const tag = localName(node);
    if (tag === 'p') {
      paragraphCount++;
      const out = extractParagraphContent(node, reg);
      if (out.text) {
        lines.push({ text: out.text, hasKeyStyle: out.hasKeyStyle });
      }
      for (const nl of out.nestedLines) {
        lines.push(nl);
      }
    } else if (tag === 'tbl') {
      const tblLines = extractTableLines(node, reg);
      for (const tl of tblLines) {
        lines.push(tl);
      }
    }
  }

  // Collect raster images in word/media/ (useful when .docx is scanned images pasted in Word)
  const images: DocxExtractedImage[] = [];
  const mediaFiles = Object.keys(zip.files)
    .filter((name) => /^word\/media\/.+\.(png|jpe?g|webp|gif)$/i.test(name))
    .sort();

  for (const mediaPath of mediaFiles.slice(0, 10)) {
    const fileObj = zip.file(mediaPath);
    if (!fileObj) continue;
    const base64 = await fileObj.async('base64');
    const lower = mediaPath.toLowerCase();
    const mimeType = lower.endsWith('.png')
      ? 'image/png'
      : lower.endsWith('.webp')
      ? 'image/webp'
      : lower.endsWith('.gif')
      ? 'image/gif'
      : 'image/jpeg';
    images.push({ name: mediaPath, mimeType, base64 });
  }

  const markedLineIndices = new Set<number>();
  lines.forEach((l, idx) => {
    if (l.hasKeyStyle) markedLineIndices.add(idx);
  });

  return {
    text: lines.map((l) => l.text).join('\n'),
    markedLineIndices,
    images,
    paragraphCount,
  };
}

export function detectSubjectFromText(text: string): string {
  const lower = text.toLowerCase();
  if (
    lower.includes('vật lý') ||
    lower.includes('vật lí') ||
    /\bbt\s*vl\b/.test(lower) ||
    /\bvl\s*1[012]\b/.test(lower) ||
    lower.includes('dao động') ||
    lower.includes('sóng cơ') ||
    lower.includes('cảm ứng điện từ') ||
    lower.includes('từ trường') ||
    lower.includes('dòng điện xoay chiều') ||
    lower.includes('quang học') ||
    lower.includes('hạt nhân') ||
    lower.includes('nhiệt học')
  ) {
    return 'Vật lí';
  }
  if (
    lower.includes('hóa học') ||
    lower.includes('hoá học') ||
    lower.includes('phương trình hóa học') ||
    lower.includes('este') ||
    lower.includes('lipit') ||
    lower.includes('cacbohidrat') ||
    lower.includes('polime') ||
    lower.includes('ancol') ||
    lower.includes('kim loại kiềm')
  ) {
    return 'Hóa học';
  }
  if (
    lower.includes('sinh học') ||
    lower.includes('di truyền') ||
    lower.includes('nhiễm sắc thể') ||
    lower.includes('phiên mã') ||
    lower.includes('dịch mã') ||
    lower.includes('tế bào')
  ) {
    return 'Sinh học';
  }
  if (
    lower.includes('ngữ văn') ||
    lower.includes('văn học') ||
    lower.includes('tác phẩm') ||
    lower.includes('bài thơ') ||
    lower.includes('nghị luận')
  ) {
    return 'Ngữ văn';
  }
  if (
    lower.includes('lịch sử') ||
    lower.includes('kháng chiến') ||
    lower.includes('chiến dịch') ||
    lower.includes('hiệp định') ||
    lower.includes('cách mạng tháng')
  ) {
    return 'Lịch sử';
  }
  if (
    lower.includes('địa lý') ||
    lower.includes('địa lí') ||
    lower.includes('khí hậu') ||
    lower.includes('đồng bằng') ||
    lower.includes('vùng kinh tế')
  ) {
    return 'Địa lý';
  }
  if (
    lower.includes('tiếng anh') ||
    lower.includes('english') ||
    lower.includes('pronunciation') ||
    lower.includes('mark the letter') ||
    lower.includes('closest in meaning') ||
    lower.includes('grammar')
  ) {
    return 'Tiếng Anh';
  }
  if (
    lower.includes('tin học') ||
    lower.includes('thuật toán') ||
    lower.includes('lập trình') ||
    lower.includes('cơ sở dữ liệu') ||
    lower.includes('python') ||
    lower.includes('html')
  ) {
    return 'Tin học';
  }
  if (
    lower.includes('gdcd') ||
    lower.includes('giáo dục công dân') ||
    lower.includes('kinh tế và pháp luật') ||
    lower.includes('pháp luật')
  ) {
    return 'GDCD';
  }
  if (
    lower.includes('toán') ||
    lower.includes('đại số') ||
    lower.includes('hình học') ||
    lower.includes('tích phân') ||
    lower.includes('nguyên hàm') ||
    lower.includes('đạo hàm') ||
    lower.includes('hàm số') ||
    lower.includes('logarit')
  ) {
    return 'Toán';
  }
  return 'Tổng hợp';
}

const STANDALONE_ANSWER_HEADER_REGEX =
  /^(?:#+\s*)?(?:\*{1,2})?(?:BẢNG\s+ĐÁP\s+ÁN|ĐÁP\s+ÁN\s*(?:TRẮC\s+NGHIỆM|CHI\s+TIẾT|THAM\s+KHẢO|CHÍNH\s+THỨC)?|HƯỚNG\s+DẪN\s+CHẤM|ANSWER\s+KEY)\s*(?:\*{1,2})?[:\-–.]?\s*$/i;

const INLINE_ANSWER_SECTION_START_REGEX =
  /^(?:#+\s*)?(?:\*{1,2})?(?:BẢNG\s+ĐÁP\s+ÁN|ĐÁP\s+ÁN\s*(?:TRẮC\s+NGHIỆM|CHI\s+TIẾT|THAM\s+KHẢO)?|ANSWER\s+KEY)\s*[:\-–]\s*(?:\d+\s*[.:\-)]*\s*[A-Da-d]|Câu\s*\d+)/i;

function parseAnswerKeyBlock(sectionText: string): {
  answers: Record<number, number>;
  explanations: Record<number, string>;
} {
  const answers: Record<number, number> = {};
  const explanations: Record<number, string> = {};

  // Format 1: Detailed solution blocks "Câu 1: Chọn A. Giải thích..."
  const detailedBlocks = sectionText.split(/(?=(?:^|\n)\s*(?:Câu|Question|Bài)\s*\d+\s*[:.)\-])/i);
  if (detailedBlocks.length > 2) {
    for (const blk of detailedBlocks) {
      const head = blk.match(/^\s*(?:Câu|Question|Bài)\s*(\d+)\s*[:.)\-]\s*([\s\S]*)$/i);
      if (!head) continue;
      const qNum = parseInt(head[1], 10);
      const rest = head[2].trim();
      const ansMatch =
        rest.match(/^(?:Chọn\s*)?(?:Đáp\s*án\s*[:\-]?\s*)?([A-Da-d])\b/i) ||
        rest.match(/(?:Chọn\s+|Đáp\s*án(?:\s+đúng)?\s*(?:là|:)\s*)([A-Da-d])\b/i);
      if (ansMatch) {
        answers[qNum] = ansMatch[1].toUpperCase().charCodeAt(0) - 65;
      }
      const cleanExp = rest
        .replace(/^(?:Chọn\s*)?(?:Đáp\s*án\s*[:\-]?\s*)?[A-Da-d][.:)]?\s*/i, '')
        .trim();
      if (cleanExp) {
        explanations[qNum] = cleanExp;
      }
    }
  }

  // Format 2: Compact pairs "1.A 2.C 3.B" or "1A 2C 3B" or "Câu 1: A"
  const pairRegex = /(?:Câu\s*)?(\d{1,3})\s*[.:\-)]*\s*([A-Da-d])(?![a-zA-ZÀ-ỹ0-9])/g;
  let m: RegExpExecArray | null;
  while ((m = pairRegex.exec(sectionText)) !== null) {
    const qNum = parseInt(m[1], 10);
    const optIdx = m[2].toUpperCase().charCodeAt(0) - 65;
    if (qNum >= 1 && qNum <= 500 && optIdx >= 0 && optIdx <= 3 && answers[qNum] === undefined) {
      answers[qNum] = optIdx;
    }
  }

  return { answers, explanations };
}

function extractOptionsFromBlock(blockText: string): {
  stem: string;
  options: string[];
  markedCorrect: number;
  trailingText: string;
} {
  // First normalize tab separators before A./B./C./D. to newlines for easier splitting
  // Find all candidate option starts: A., B., C., D. (or a), b), c), d))
  // Criteria for a valid option marker:
  // 1. Preceded by start-of-string, newline, tab, or 2+ spaces
  // 2. OR preceded by single space when letter follows sequential order (A -> B -> C -> D)
  const candidates: {
    index: number;
    markerEnd: number;
    letter: string;
    upperLetter: string;
    isUpper: boolean;
    hasStar: boolean;
    strongBoundary: boolean;
  }[] = [];

  const candidateRegex =
    /(^|\n|\t|[ ]{2,}|[ ])(\*?\s*\(?([A-Da-d])(?:\)|\.|:|\/|\s-\s)\s*)/gm;
  let m: RegExpExecArray | null;

  while ((m = candidateRegex.exec(blockText)) !== null) {
    const sep = m[1];
    const marker = m[2];
    const letter = m[3];
    const upperLetter = letter.toUpperCase();
    const isUpper = letter === upperLetter;
    const hasStar = marker.trim().startsWith('*');
    const strongBoundary = sep === '' || sep === '\n' || sep === '\t' || sep.length >= 2;
    const markerStart = m.index + sep.length;
    const markerEnd = m.index + m[0].length;

    // Avoid false positives like "điểm A. " or "hình B." inside a sentence with only 1 space
    if (!strongBoundary) {
      const prevSlice = blockText.slice(Math.max(0, markerStart - 18), markerStart);
      if (/(?:điểm|đoạn|tại|từ|đến|qua|hình|câu|mặt|cạnh|góc|véc\s*tơ|vectơ|bản|cực|nguồn|mạch|khóa|lớp|nhóm|chất)\s+$/i.test(prevSlice)) {
        continue;
      }
    }

    candidates.push({
      index: markerStart,
      markerEnd,
      letter,
      upperLetter,
      isUpper,
      hasStar,
      strongBoundary,
    });
  }

  // Find the best A -> B (-> C -> D) sequence in candidates
  let chosenSeq: typeof candidates = [];

  const findSequence = (preferUpper: boolean) => {
    const pool = candidates.filter((c) => (preferUpper ? c.isUpper : !c.isUpper));
    for (let i = 0; i < pool.length; i++) {
      if (pool[i].upperLetter !== 'A') continue;
      const seq = [pool[i]];
      const expectedOrder = ['B', 'C', 'D'];
      let cursor = i + 1;
      for (const nextExpected of expectedOrder) {
        let foundIdx = -1;
        for (let k = cursor; k < pool.length; k++) {
          if (pool[k].upperLetter === nextExpected) {
            // If single-space separated, allow if sequential right after previous option
            foundIdx = k;
            break;
          }
        }
        if (foundIdx !== -1) {
          seq.push(pool[foundIdx]);
          cursor = foundIdx + 1;
        }
      }
      if (seq.length >= 2) {
        // Prefer sequences that have 4 options, or appear cleanly
        if (seq.length > chosenSeq.length) {
          chosenSeq = seq;
        }
        if (seq.length === 4) {
          return seq;
        }
      }
    }
    return null;
  };

  findSequence(true);
  if (chosenSeq.length < 4) {
    // Also check lowercase a) b) c) d) (common in 2025 Đúng/Sai format or informal files)
    const upperBest = chosenSeq;
    chosenSeq = [];
    findSequence(false);
    if (upperBest.length >= chosenSeq.length) {
      chosenSeq = upperBest;
    }
  }

  if (chosenSeq.length < 2) {
    return {
      stem: blockText.trim(),
      options: [],
      markedCorrect: -1,
      trailingText: '',
    };
  }

  const stem = blockText.slice(0, chosenSeq[0].index).trim();
  const options: string[] = [];
  let markedCorrect = -1;
  let trailingText = '';

  for (let j = 0; j < chosenSeq.length; j++) {
    const start = chosenSeq[j].markerEnd;
    const end = j + 1 < chosenSeq.length ? chosenSeq[j + 1].index : blockText.length;
    let rawOpt = blockText.slice(start, end).trim();

    if (j === chosenSeq.length - 1) {
      // Detach trailing inline answer / explanation lines attached after the last option
      const trailMatch = rawOpt.match(
        /\n\s*(?:(?:Đáp\s*án|Đ\/A|Chọn|Lời\s*giải|Hướng\s*dẫn(?:\s+giải)?|Giải\s*thích)\s*[:\-]|PHẦN\s+[IVX]+)/i
      );
      if (trailMatch && trailMatch.index !== undefined) {
        trailingText = rawOpt.slice(trailMatch.index).trim();
        rawOpt = rawOpt.slice(0, trailMatch.index).trim();
      }
    }

    if (
      chosenSeq[j].hasStar ||
      /\[đúng\]|\(đúng\)|\[AZOTA_KEY\]/i.test(rawOpt)
    ) {
      markedCorrect = j;
    }

    rawOpt = rawOpt
      .replace(/\[AZOTA_KEY\]/g, '')
      .replace(/\[đúng\]|\(đúng\)/gi, '')
      .replace(/\s+/g, ' ')
      .trim();

    options.push(rawOpt);
  }

  return { stem, options, markedCorrect, trailingText };
}

export function parseAzotaText(
  text: string,
  fileName?: string,
  markedLineIndices?: Set<number>
): ParsedAzotaResult {
  const cleanRaw = text.replace(/\r\n/g, '\n').replace(/\r/g, '\n').replace(/\u00a0/g, ' ');
  const rawLines = cleanRaw.split('\n');

  // If DOCX XML extractor flagged a single-option line (underlined/highlighted/red),
  // tag it with [AZOTA_KEY] only when the line does NOT contain multiple inline options.
  const annotatedLines = rawLines.map((line, idx) => {
    const trimmed = line.trim();
    const hasMultipleInlineOptions =
      /(?:^|\t|\s{2,})\(?[A-Da-d][.):\/]\s+.*?(?:\t|\s{2,})\(?[B-Db-d][.):\/]\s+/.test(trimmed);
    if (
      markedLineIndices?.has(idx) &&
      !hasMultipleInlineOptions &&
      /^(?:\*?\s*\(?[A-Da-d][.):\/]\s*)/.test(trimmed)
    ) {
      return `${trimmed} [AZOTA_KEY]`;
    }
    return line;
  });

  const nonEmptyLines = annotatedLines.map((l) => l.trim()).filter(Boolean);

  // 1. Detect Title, Subject, Duration from top header
  let title = fileName ? fileName.replace(/\.[^/.]+$/, '').replace(/[-_]+/g, ' ').trim() : '';
  const headerSlice = nonEmptyLines.slice(0, 12).join(' ');
  const subject = detectSubjectFromText(`${headerSlice} ${title} ${cleanRaw.slice(0, 2500)}`);

  let durationMinutes = 45;
  const durMatch = headerSlice.match(/(?:thời\s*gian(?:\s*làm\s*bài)?|time)\s*[:\-]?\s*(\d{1,3})\s*(?:phút|p|min)/i);
  if (durMatch) {
    const parsedDur = parseInt(durMatch[1], 10);
    if (parsedDur >= 5 && parsedDur <= 240) durationMinutes = parsedDur;
  }

  for (const l of nonEmptyLines.slice(0, 8)) {
    if (
      /^(ĐỀ\s+(?:KIỂM\s+TRA|THI|KHẢO\s+SÁT|ÔN\s+TẬP)|BÀI\s+(?:KIỂM\s+TRA|TẬP)|KIỂM\s+TRA|CHƯƠNG\s+)/i.test(l) &&
      l.length >= 6 &&
      l.length <= 140
    ) {
      title = l.replace(/^[#*\s]+|[#*\s]+$/g, '');
      break;
    }
  }
  if (!title) {
    title = subject !== 'Tổng hợp' ? `Đề trắc nghiệm môn ${subject}` : 'Đề thi trắc nghiệm nhập từ file';
  }

  // 2. Safely locate a trailing Answer Key section (ONLY standalone section headers!)
  let answerSectionLineIdx = -1;
  for (let i = 0; i < annotatedLines.length; i++) {
    const trimmed = annotatedLines[i].trim();
    if (
      STANDALONE_ANSWER_HEADER_REGEX.test(trimmed) ||
      INLINE_ANSWER_SECTION_START_REGEX.test(trimmed)
    ) {
      // Verify the lines AFTER this header look like an answer key / solution section,
      // and NOT the start of questions containing A. B. C. D. options!
      const followingSlice = annotatedLines.slice(i + 1, i + 20).join('\n');
      const hasOptionListFollowing = /(?:^|\n)\s*A[.)]\s+\S[\s\S]*?(?:^|\n)\s*B[.)]\s+\S/.test(followingSlice);
      const hasAnswerPairsFollowing =
        /(?:Câu\s*)?\d{1,3}\s*[.:\-)]*\s*[A-Da-d]\b/.test(trimmed + '\n' + followingSlice);

      if (!hasOptionListFollowing && hasAnswerPairsFollowing) {
        answerSectionLineIdx = i;
        break;
      }
      // Or if it's after most of the document (e.g. > 55% through) and has ĐÁP ÁN CHI TIẾT
      if (i > annotatedLines.length * 0.5 && /đáp\s*án|hướng\s*dẫn\s*chấm|answer\s*key/i.test(trimmed)) {
        answerSectionLineIdx = i;
        break;
      }
    }
  }

  let questionBodyText = annotatedLines.join('\n');
  let answerSectionText = '';
  if (answerSectionLineIdx !== -1) {
    questionBodyText = annotatedLines.slice(0, answerSectionLineIdx).join('\n');
    answerSectionText = annotatedLines.slice(answerSectionLineIdx).join('\n');
  }

  const { answers: answerKeyMap, explanations: answerSectionExplanations } = answerSectionText
    ? parseAnswerKeyBlock(answerSectionText)
    : { answers: {}, explanations: {} };

  // 3. Find all question start boundaries in questionBodyText
  // Handles:
  //   Câu 1:, Câu 1., Câu 1), Câu 01, [NB] Câu 1:, **Câu 1:**, Câu 1 (Mã đề 101):
  //   Bài 1:, Question 1:, Q1.
  //   1. <text>, 1) <text> (at start of line)
  const keywordMatches: { index: number; endOfPrefix: number; qNum: number; kind: 'keyword' }[] = [];
  const keywordRegex =
    /(?:^|\n)[ \t]*(?:\*{1,2}|\[[^\]]{1,20}\][ \t]*|\([^\)]{1,15}\)[ \t]*)?(?:Câu(?:\s+hỏi)?|Question|Bài)\s*(\d{1,3})\s*(?:(?:\([^)\n]{1,35}\))?\s*[:.)\-]|(?=[ \t]+\S))/gi;

  let km: RegExpExecArray | null;
  while ((km = keywordRegex.exec(questionBodyText)) !== null) {
    const qNum = parseInt(km[1], 10);
    const leadingNewlineLen = km[0].startsWith('\n') ? 1 : 0;
    keywordMatches.push({
      index: km.index + leadingNewlineLen,
      endOfPrefix: km.index + km[0].length,
      qNum,
      kind: 'keyword',
    });
  }

  let activeMarkers: { index: number; endOfPrefix: number; qNum: number }[] = keywordMatches;

  // If no "Câu X" / "Bài X" / "Question X" markers found, try numbered "1. ..." / "1) ..."
  if (activeMarkers.length === 0) {
    const numMatches: { index: number; endOfPrefix: number; qNum: number }[] = [];
    const numRegex = /(?:^|\n)[ \t]*(?:\*{1,2})?(\d{1,3})\s*[.)][ \t]+(?=\S)/g;
    let nm: RegExpExecArray | null;
    while ((nm = numRegex.exec(questionBodyText)) !== null) {
      const qNum = parseInt(nm[1], 10);
      if (qNum < 1 || qNum > 200) continue;
      // Ignore year numbers or sequential mismatch if far off
      const leadingNewlineLen = nm[0].startsWith('\n') ? 1 : 0;
      numMatches.push({
        index: nm.index + leadingNewlineLen,
        endOfPrefix: nm.index + nm[0].length,
        qNum,
      });
    }
    // Keep monotonically increasing subsequence starting near 1
    if (numMatches.length > 0) {
      const filtered: typeof numMatches = [];
      let expectedMax = 0;
      for (const cand of numMatches) {
        if (cand.qNum > expectedMax && cand.qNum <= expectedMax + 5) {
          filtered.push(cand);
          expectedMax = cand.qNum;
        }
      }
      activeMarkers = filtered.length >= 1 ? filtered : numMatches;
    }
  }

  const questions: ParsedAzotaQuestion[] = [];
  const usedIds = new Set<number>();

  for (let i = 0; i < activeMarkers.length; i++) {
    const cur = activeMarkers[i];
    const nextIdx = i + 1 < activeMarkers.length ? activeMarkers[i + 1].index : questionBodyText.length;
    const rawBlock = questionBodyText.slice(cur.endOfPrefix, nextIdx).trim();

    if (!rawBlock) continue;

    // Strip any trailing section header like "PHẦN II. ..." attached to the last question of Phần I
    const cleanedBlock = rawBlock
      .replace(/\n\s*(?:PHẦN\s+(?:I|II|III|IV)\b[^\n]*(?:\n[^\n]*)?)$/i, '')
      .trim();

    const { stem, options, markedCorrect, trailingText } = extractOptionsFromBlock(cleanedBlock);

    if (options.length >= 2) {
      const fullBlockForMeta = `${cleanedBlock}\n${trailingText}`;

      // Check inline answer & explanation
      let correctOption = -1;
      let hasDetectedAnswer = false;

      if (markedCorrect >= 0 && markedCorrect < options.length) {
        correctOption = markedCorrect;
        hasDetectedAnswer = true;
      } else if (answerKeyMap[cur.qNum] !== undefined && answerKeyMap[cur.qNum] < options.length) {
        correctOption = answerKeyMap[cur.qNum];
        hasDetectedAnswer = true;
      } else {
        const inlineAns = fullBlockForMeta.match(
          /(?:^|\n)\s*(?:Đáp\s*án(?:\s+đúng)?|Đ\/A|Chọn(?:\s+đáp\s*án)?)\s*[:\-]?\s*([A-Da-d])\b/i
        );
        if (inlineAns) {
          const idx = inlineAns[1].toUpperCase().charCodeAt(0) - 65;
          if (idx >= 0 && idx < options.length) {
            correctOption = idx;
            hasDetectedAnswer = true;
          }
        }
      }

      let explanation = answerSectionExplanations[cur.qNum] || '';
      const expMatch = fullBlockForMeta.match(
        /(?:^|\n)\s*(?:Lời\s*giải|Hướng\s*dẫn(?:\s+giải)?|Giải\s*thích)\s*[:\-]\s*([\s\S]*)$/i
      );
      if (expMatch && expMatch[1].trim()) {
        explanation = expMatch[1].replace(/\[AZOTA_KEY\]/g, '').trim();
      }

      // Pad to 4 options if e.g. 2-3 options (such as Đúng/Sai or A/B/C) so editor grids render cleanly
      const finalOptions = options.slice(0, 4);
      while (finalOptions.length < 4) {
        finalOptions.push('');
      }

      let qId = cur.qNum || i + 1;
      if (usedIds.has(qId)) {
        qId = questions.length + 1;
        while (usedIds.has(qId)) qId++;
      }
      usedIds.add(qId);

      questions.push({
        id: qId,
        questionText: stem.replace(/\[AZOTA_KEY\]/g, '').replace(/\n{3,}/g, '\n\n').trim() || `Câu hỏi ${i + 1}`,
        options: finalOptions,
        correctOption,
        hasDetectedAnswer,
        explanation,
      });
    }
  }

  const detectedAnswerCount = questions.filter((q) => q.hasDetectedAnswer).length;

  return {
    title,
    subject,
    durationMinutes,
    questions,
    stats: {
      totalMarkersDetected: activeMarkers.length,
      parsedCount: questions.length,
      detectedAnswerCount,
      missingAnswerCount: questions.length - detectedAnswerCount,
    },
  };
}
