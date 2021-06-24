const cloneDeep = require('lodash/cloneDeep');

const YMLToken = {
  STRLIT: 0,
  START_BLOCK: 1,
  END_BLOCK: 2,
  NUMLIT: 3,
};

const BLOCKKIND_UNKNOWN = 0x0;
const BLOCKKIND_ARRAY = 0x1;
const BLOCKKIND_MAPPING = 0x2;

const UNREACHABLE = (msg = '') => {
  console.assert(false, `Unreachable code: ${msg}`);
};

const errMessageFriendlyTokType = (tokType) => {
  switch (tokType) {
    case ' ':
      return '<space>';
    case '\n':
      return '<newline>';
    default:
      return tokType;
  }
};

const VT = {
  STRLIT_ONE_OF: 0,
  BLOCK: 1,
  STRLIT: 2,
  NUMLIT: 3,
  NUMLIT_ONE_OF: 4,
};

// Validate given YML text using the provided configuration object
// Configuration object has the following format:
// Node: {
//   ...keys here...
//   children: Record<Key, Node>
// }
const validateYaml = (userConfig, text) => {
  if (!text) return [];
  let annotations = [];
  let currPos = 0;
  const textLen = text.length;
  const lastPos = textLen - 1;
  let tokens = [];
  let line = 0;
  let col = 0;

  const addAnnotation = (ann) => {
    annotations.push(ann);
  };

  let shouldExit = false;
  const exitLoop = () => {
    shouldExit = true;
  };

  const emitEofError = (l, c) => {
    addAnnotation({
      type: 'error',
      text: 'Unexpected end of file (EOF)',
      row: l,
      column: c,
    });
  };

  const emitNoMatchingQuoteFoundError = (l, c) => {
    addAnnotation({
      type: 'error',
      text: 'Mo matching quote found',
      row: l,
      column: c,
    });
  };

  while (!shouldExit && currPos < textLen) {
    const ch = text[currPos];
    ++col;
    switch (ch) {
      case ':': {
        tokens.push({ type: ':', line, col });
        ++currPos;
        break;
      }
      case '\r': {
        ++currPos;
        break;
      }
      case '\n': {
        tokens.push({ type: '\n', line, col });
        ++line;
        col = 0;
        ++currPos;
        break;
      }
      case '#': {
        while (text[currPos] !== '\n' && currPos < textLen) {
          ++currPos;
        }
        // eat newline after the comment to reduce the amount of newlines
        // in the output
        if (text[currPos] === '\n') {
          ++line;
          col = 0;
          ++currPos;
        }
        break;
      }
      case ' ': {
        let spaces = 0;
        while (currPos < text.length && text[currPos] === ' ') {
          ++spaces;
          ++currPos;
        }
        tokens.push({ type: ' ', count: spaces, line, col });
        break;
      }
      case '-': {
        tokens.push({ type: '-', line, col });
        ++currPos;
        break;
      }
      case '0':
      case '1':
      case '2':
      case '3':
      case '4':
      case '5':
      case '6':
      case '7':
      case '8':
      case '9': {
        let numCh = text[currPos];
        let numS = '';
        // TODO: Proper number parsing
        while ((numCh >= '0' && numCh <= '9') || numCh === '.') {
          numS += numCh;
          ++currPos;
          numCh = text[currPos];
        }
        if (isNaN(numS)) {
          addAnnotation({
            column: col,
            row: line,
            type: 'error',
            text: `Invalid number literal "${numS}"`,
          });
          exitLoop();
          break;
        }
        const numValue = parseFloat(numS, 10);
        tokens.push({ type: YMLToken.NUMLIT, value: numValue, line, col });
        break;
      }
      default: {
        let wordCh = text[currPos];
        let attr = '';
        let strLitExplicit = wordCh === '"';
        // eat opening quote
        if (strLitExplicit) {
          ++currPos;
          wordCh = text[currPos];
        }
        while (
          (strLitExplicit && wordCh !== '\n' && wordCh !== '"') ||
          (wordCh >= 'A' && wordCh <= 'Z') ||
          (wordCh >= 'a' && wordCh <= 'z') ||
          (wordCh >= '0' && wordCh <= '9') ||
          wordCh === '_'
        ) {
          if (currPos === lastPos) {
            // EOF but still no closing quote
            if (strLitExplicit) {
              emitNoMatchingQuoteFoundError(line, col);
              exitLoop();
              break;
            }
            break;
          }
          if (wordCh === '\\') {
            // parse escape sequence
            attr += wordCh;
            ++currPos;
            if (currPos >= lastPos) {
              emitEofError(line, col);
              exitLoop();
              break;
            }
            attr += text[currPos];
            ++currPos;
            wordCh = text[currPos];
            continue;
          }
          attr += wordCh;
          ++currPos;
          wordCh = text[currPos];
        }
        if (!strLitExplicit && attr.length === 0) {
          console.warn(`Unknown token met: ${wordCh}`);
          return [];
        }
        if (strLitExplicit) {
          // found newline before closing quote
          if (text[currPos] !== '"') {
            emitNoMatchingQuoteFoundError(line, col);
            exitLoop();
            break;
          }
          // eat closing quote
          ++currPos;
        }
        tokens.push({ type: YMLToken.STRLIT, value: attr, line, col });
        break;
      }
    }
  }

  if (shouldExit) {
    return annotations;
  }

  const emitSyntaxError = (token, msg) => {
    addAnnotation({
      row: token.line,
      column: token.col,
      type: 'error',
      text: `Syntax Error: ${msg}`,
    });
  };

  const consumeToken = (tokType) => {
    if (tokensPos >= tokens.length) return false;
    const got = tokens[tokensPos];
    if (got.type !== tokType) {
      return false;
    }
    ++tokensPos;
    return got;
  };

  const lookupToken = (tokType) => {
    if (tokensPos >= tokens.length) return false;
    const got = tokens[tokensPos];
    if (got.type !== tokType) {
      return false;
    }
    return got;
  };

  const lookupNextToken = (tokType) => {
    if (tokensPos + 1 >= tokens.length) return false;
    const got = tokens[tokensPos + 1];
    if (got.type !== tokType) {
      return false;
    }
    return got;
  };

  const consumeExpectToken = (tokType) => {
    if (tokensPos >= tokens.length) return false;
    const got = tokens[tokensPos];
    if (got.type !== tokType) {
      const expected = errMessageFriendlyTokType(tokType);
      const found = errMessageFriendlyTokType(got.type);
      emitSyntaxError(got, `Expected "${expected}" but found "${found}"`);
      return false;
    }
    ++tokensPos;
    return got;
  };

  const emitInvalidIndentation = (tok, expected, found) => {
    addAnnotation({
      row: tok.line,
      column: tok.col,
      type: 'error',
      text: `Invalid indentation: Expected ${expected} spaces, found ${found}`,
    });
  };

  let tokensPos = 0;
  let shouldStopLex = false;
  const stopLex = () => {
    shouldStopLex = true;
  };

  const emitFormatError = (tok, msg) => {
    addAnnotation({
      type: 'error',
      text: `Format Error: ${msg}`,
      column: tok.col,
      row: tok.line,
    });
  };

  // TODO: Get rid of this additional clone & memory allocation
  let formatValidation = cloneDeep(userConfig);

  // TODO: Support array value props having different indentation
  // than the rest of values in the array

  // takes current validation scope as an argument
  const parseBlock = (curr_validation_scope, zeroLevel = false) => {
    // Determine current block indentation from the first token
    const block_indent = consumeToken(' ');
    const cbIndent = zeroLevel ? 0 : block_indent.count;

    // resulting value of the block
    let blockValue = {};

    // current block kind (array or mapping)
    let blockKind = BLOCKKIND_UNKNOWN;
    let currArrayKeyPairObj = null;

    const validateAttr = (attrName, attrValue, isBlockValue, line, col) => {
      const vscope = curr_validation_scope;
      if (vscope === null) return true;
      switch (blockKind) {
        case BLOCKKIND_MAPPING: {
          // check if this attribute is allowed in current scope
          const vinfo = vscope.children[attrName];
          if (!(vinfo ?? false)) {
            const allowedKeys =
              vscope.children && Object.keys(vscope.children).length !== 0
                ? Object.keys(vscope.children).join(', ')
                : 'none';
            emitFormatError(
              { line, col },
              `Property "${attrName}" not allowed here. Allowed options: "${allowedKeys}"`,
            );
            return false;
          }
          // check if seen this attribute before
          if (vinfo.seen) {
            emitFormatError({ line, col }, `Duplicate property ${attrName}`);
            return false;
          }
          vinfo.seen = true;
          // check value
          switch (vinfo.type) {
            case VT.STRLIT_ONE_OF: {
              if (attrValue.type !== YMLToken.STRLIT) {
                emitFormatError(
                  { line, col },
                  `Only string literals allowed`,
                );
              } else if (!vinfo.values.includes(attrValue.value)) {
                const allowedValues = vinfo.values.join(', ');
                emitFormatError(
                  { line, col },
                  `Only following values are allowed: ${allowedValues}`,
                );
              }
              break;
            }
            case VT.STRLIT: {
              if (attrValue.type !== YMLToken.STRLIT) {
                emitFormatError({ line, col }, `${attrName} should be a string literal`);
              }
              break;
            }
            case VT.NUMLIT: {
              if (attrValue.type !== YMLToken.NUMLIT) {
                emitFormatError({ line, col }, `${attrName} should be a number literal`);
              }
              break;
            }
            case VT.NUMLIT_ONE_OF: {
              if (attrValue.type !== YMLToken.NUMLIT) {
                emitFormatError({ line, col }, `${attrName} should be a number literal`);
              } else if (!vinfo.values.includes(attrValue.value)) {
                const allowedValues = vinfo.values.join(', ');
                emitFormatError(
                  { line, col },
                  `Only following values are allowed: ${allowedValues}`,
                );
              }
              break;
            }
            case VT.BLOCK: {
              if (attrValue instanceof String || attrValue instanceof Number) {
                emitFormatError({ line, col }, `${attrName} should be a block`);
              }
              break;
            }
            default: {
              if (vinfo.type === undefined) {
                UNREACHABLE(`Validation format type not specified for: ${attrName}`);
              } else {
                UNREACHABLE(`Unknown validation format type: ${vinfo.type}`);
              }
              return false;
            }
          }
          break;
        }
        case BLOCKKIND_ARRAY: {
          // TODO: Maybe provide a single error message for the current attribute
          // line&column instead of a different warning for each list entry
          if (!vscope.allowListValues) {
            emitFormatError({ line, col }, 'Array values are not allowed here');
          }
          // TODO: Check list entries
          break;
        }
        default:
          UNREACHABLE(`Invalid block kind "${blockKind}"`);
          return false;
      }
      return true;
    };

    while (!shouldStopLex && tokensPos < tokens.length) {
      const tok = tokens[tokensPos];
      switch (tok.type) {
        // Newline, just skip
        case '\n': {
          ++tokensPos;
          break;
        }

        // Array value
        case '-': {
          const canBeArray = blockKind === BLOCKKIND_UNKNOWN || blockKind === BLOCKKIND_ARRAY;
          if (!canBeArray) {
            addAnnotation({
              type: 'error',
              text: 'Can only have array values inside of an array',
              row: tok.line,
              column: tok.col,
            });
            stopLex();
            break;
          }
          consumeToken('-');
          // reset array keypair value if was set before
          currArrayKeyPairObj = null;
          // if block kind is still unknown, make it into an array
          if (blockKind === BLOCKKIND_UNKNOWN) {
            blockKind = BLOCKKIND_ARRAY;
            blockValue = [];
          }
          consumeToken(' ');
          // single value
          // TODO: Maybe handle these values inside of strlit handler?
          const strlitTok = lookupToken(YMLToken.STRLIT);
          if (!lookupNextToken(':') && strlitTok) {
            blockValue.push(strlitTok.value);
            consumeToken(YMLToken.STRLIT);
            break;
          }
          const numlitTok = lookupToken(YMLToken.NUMLIT);
          if (!lookupNextToken(':') && numlitTok) {
            blockValue.push(numlitTok.value);
            consumeToken(YMLToken.NUMLIT);
            break;
          }
          break;
        }

        // Always block indentation
        case ' ': {
          const tok = lookupToken(' ');

          // No indentation allowed on the zeroth block level
          if (zeroLevel) {
            addAnnotation({
              type: 'error',
              text: 'No indentation allowed outside of blocks',
              row: tok.line,
              column: tok.col,
            });
            stopLex();
            break;
          }

          // continuation of the current block, just skip
          if (tok.count === cbIndent) {
            consumeToken(' ');
            break;
          }

          // it's always invalid to have more indentation than current
          // block level because otherwise a new block would have been
          // created before matching indentation
          if (tok.count > cbIndent) {
            emitInvalidIndentation(tok, cbIndent, tok.count);
            stopLex();
            break;
          }

          // if we're exiting a block however, we can detect less spaces
          // than the current block level. Just forward this indentation
          // check to the outer block and exit current block.
          return blockValue;
        }

        // String literal. Always an attribute name.
        // Handles both block attributes & array value attributes
        case YMLToken.STRLIT: {
          // block kind not determined but already got attribute name
          // therefore consider this to be a mapping
          if (blockKind === BLOCKKIND_UNKNOWN) {
            blockKind = BLOCKKIND_MAPPING;
          }
          if (blockKind === BLOCKKIND_ARRAY) {
            // check if previous token was a dash
          }
          // get attribute name
          const attrName = consumeToken(YMLToken.STRLIT);
          if (!consumeExpectToken(':')) {
            stopLex();
            break;
          }
          // if there are spaces then consume them
          consumeToken(' ');
          // append key/pair value to the current context
          const appendPair = (key, value, isBlockValue=false, line, col) => {
            // if non-block value, token instance is passed
            const assignValue = isBlockValue ? value : value.value;
            if (blockKind === BLOCKKIND_MAPPING) {
              blockValue[key] = assignValue;
            } else if (blockKind === BLOCKKIND_ARRAY) {
              // this is a key value pair so append a new object or
              // update current key/value pair object in the array if
              // exists
              if (currArrayKeyPairObj === null) {
                blockValue.push({});
                currArrayKeyPairObj = blockValue[blockValue.length - 1];
              }
              currArrayKeyPairObj[key] = assignValue;
            } else {
              UNREACHABLE();
              return false;
            }
            if (!validateAttr(key, value, isBlockValue, attrName.line, attrName.col)) {
              return false;
            }
            return true;
          };
          // if got strlit value
          let strlitValue = consumeToken(YMLToken.STRLIT);
          if (strlitValue) {
            const p = appendPair(
              attrName.value,
              strlitValue,
              false,
              attrName.line,
              attrName.col,
            );
            if (!p) break;
            if (!consumeExpectToken('\n')) {
              stopLex();
            }
            break;
          }
          // if got number literal value
          let numlitValue = consumeToken(YMLToken.NUMLIT);
          if (numlitValue) {
            const p = appendPair(
              attrName.value,
              numlitValue,
              false,
              attrName.line,
              attrName.col,
            );
            if (!p) break;
            if (!consumeExpectToken('\n')) {
              stopLex();
            }
            break;
          }
          if (consumeToken('\n')) {
            // got a block
            const indentationTok = lookupToken(' ');
            if (!indentationTok) {
              // empty block warning
              addAnnotation({
                column: attrName.col,
                row: attrName.line,
                type: 'warning',
                text: 'Empty block',
              });
              break;
            }
            const nextValidationScope =
              formatValidation && formatValidation.children
                ? formatValidation.children[attrName.value] || null
                : null;
            const blockParseRes = parseBlock(nextValidationScope, false);
            const p = appendPair(
              attrName.value, blockParseRes,
              true,
              attrName.line, attrName.col);
            if (!p) break;
          }
          break;
        }
        case YMLToken.NUMLIT: {
          emitSyntaxError(tok, 'Number literals cannot start attribute names');
          stopLex();
          break;
        }
        default: {
          emitSyntaxError(tok, `Did not expect to find ${tok.type} here`);
          stopLex();
          break;
        }
      }
    }
    return blockValue;
  };

  const rootParseValue = parseBlock(formatValidation, true);
  return annotations;
};

const validateWith = (userConfig) => (text) => validateYaml(userConfig, text);

module.exports = { validateYaml, validateWith, VT };
