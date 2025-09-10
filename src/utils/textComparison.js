import DiffMatchPatch from 'diff-match-patch';

// Enhanced comparison function that highlights differences in the modified document only
export const compareHtmlDocuments = async (leftHtml, rightHtml) => {
  console.log("Starting enhanced comparison for modified document highlighting...");
  
  try {
    // Parse HTML content into structured elements
    const leftElements = parseHtmlIntoElements(leftHtml);
    const rightElements = parseHtmlIntoElements(rightHtml);
    
    console.log(`Left document: ${leftElements.length} elements`);
    console.log(`Right document: ${rightElements.length} elements`);
    
    // Create element-level diff
    const elementDiff = createElementDiff(leftElements, rightElements);
    
    // Generate highlighted modified document
    const highlightedModified = generateHighlightedModified(elementDiff);
    
    // Calculate summary statistics
    const summary = calculateSummary(elementDiff);
    
    return {
      leftDiffs: [], // Not used in this approach
      rightDiffs: [{ content: highlightedModified, type: 'modified' }],
      summary,
      detailed: {
        lines: [],
        tables: [],
        images: []
      }
    };
  } catch (error) {
    console.error("Comparison failed:", error);
    throw new Error("Failed to compare documents: " + error.message);
  }
};

// Parse HTML into structured elements with content and formatting
function parseHtmlIntoElements(html) {
  if (!html) return [];
  
  const parser = new DOMParser();
  const doc = parser.parseFromString(html, 'text/html');
  const elements = [];
  
  // Process all meaningful elements
  const walker = document.createTreeWalker(
    doc.body,
    NodeFilter.SHOW_ELEMENT | NodeFilter.SHOW_TEXT,
    {
      acceptNode: function(node) {
        // Skip empty text nodes
        if (node.nodeType === Node.TEXT_NODE && !node.textContent.trim()) {
          return NodeFilter.FILTER_SKIP;
        }
        return NodeFilter.FILTER_ACCEPT;
      }
    }
  );
  
  let node;
  let elementIndex = 0;
  
  while (node = walker.nextNode()) {
    if (node.nodeType === Node.ELEMENT_NODE) {
      elements.push({
        id: elementIndex++,
        type: 'element',
        tagName: node.tagName.toLowerCase(),
        content: node.textContent.trim(),
        html: node.outerHTML,
        attributes: getElementAttributes(node),
        children: Array.from(node.children).length
      });
    } else if (node.nodeType === Node.TEXT_NODE && node.textContent.trim()) {
      elements.push({
        id: elementIndex++,
        type: 'text',
        content: node.textContent,
        html: node.textContent,
        parent: node.parentElement ? node.parentElement.tagName.toLowerCase() : null
      });
    }
  }
  
  return elements;
}

// Get element attributes as object
function getElementAttributes(element) {
  const attrs = {};
  for (let i = 0; i < element.attributes.length; i++) {
    const attr = element.attributes[i];
    attrs[attr.name] = attr.value;
  }
  return attrs;
}

// Create element-level diff between documents
function createElementDiff(leftElements, rightElements) {
  const dmp = new DiffMatchPatch();
  const diff = [];
  
  // Convert elements to comparable strings for diff algorithm
  const leftText = leftElements.map(el => el.content).join('\n');
  const rightText = rightElements.map(el => el.content).join('\n');
  
  // Create character-level diff
  const charDiff = dmp.diff_main(leftText, rightText);
  dmp.diff_cleanupSemantic(charDiff);
  
  // Map diff back to elements with proper highlighting
  let leftIndex = 0;
  let rightIndex = 0;
  let leftCharIndex = 0;
  let rightCharIndex = 0;
  
  for (const [operation, text] of charDiff) {
    const textLength = text.length;
    
    if (operation === DiffMatchPatch.DIFF_EQUAL) {
      // Unchanged content - add as-is from right document
      while (rightCharIndex < rightCharIndex + textLength && rightIndex < rightElements.length) {
        const element = rightElements[rightIndex];
        if (element) {
          diff.push({
            ...element,
            operation: 'equal',
            highlighted: false
          });
        }
        rightCharIndex += element ? element.content.length + 1 : 0;
        rightIndex++;
      }
      leftCharIndex += textLength;
    } else if (operation === DiffMatchPatch.DIFF_INSERT) {
      // Added content - highlight in yellow
      while (rightCharIndex < rightCharIndex + textLength && rightIndex < rightElements.length) {
        const element = rightElements[rightIndex];
        if (element) {
          diff.push({
            ...element,
            operation: 'insert',
            highlighted: true,
            highlightType: 'added'
          });
        }
        rightCharIndex += element ? element.content.length + 1 : 0;
        rightIndex++;
      }
    } else if (operation === DiffMatchPatch.DIFF_DELETE) {
      // Removed content - add placeholder with strike-through
      while (leftCharIndex < leftCharIndex + textLength && leftIndex < leftElements.length) {
        const element = leftElements[leftIndex];
        if (element) {
          diff.push({
            ...element,
            operation: 'delete',
            highlighted: true,
            highlightType: 'removed'
          });
        }
        leftCharIndex += element ? element.content.length + 1 : 0;
        leftIndex++;
      }
    }
  }
  
  return diff;
}

// Generate highlighted modified document
function generateHighlightedModified(elementDiff) {
  const parser = new DOMParser();
  const doc = parser.parseFromString('<div></div>', 'text/html');
  const container = doc.querySelector('div');
  
  elementDiff.forEach(element => {
    if (element.operation === 'equal') {
      // Unchanged content - add as-is
      if (element.type === 'element') {
        const tempDiv = document.createElement('div');
        tempDiv.innerHTML = element.html;
        const elementNode = tempDiv.firstChild;
        if (elementNode) {
          container.appendChild(elementNode.cloneNode(true));
        }
      } else if (element.type === 'text') {
        const textNode = document.createTextNode(element.content);
        container.appendChild(textNode);
      }
    } else if (element.operation === 'insert') {
      // Added content - highlight with yellow background
      if (element.type === 'element') {
        const tempDiv = document.createElement('div');
        tempDiv.innerHTML = element.html;
        const elementNode = tempDiv.firstChild;
        if (elementNode) {
          elementNode.style.backgroundColor = '#fef3c7';
          elementNode.style.borderLeft = '4px solid #f59e0b';
          elementNode.style.padding = '4px 8px';
          elementNode.style.margin = '2px 0';
          elementNode.style.borderRadius = '4px';
          container.appendChild(elementNode.cloneNode(true));
        }
      } else if (element.type === 'text') {
        const span = document.createElement('span');
        span.textContent = element.content;
        span.style.backgroundColor = '#fef3c7';
        span.style.color = '#92400e';
        span.style.padding = '2px 4px';
        span.style.borderRadius = '3px';
        span.style.fontWeight = '600';
        container.appendChild(span);
      }
    } else if (element.operation === 'delete') {
      // Removed content - show with red strike-through
      if (element.type === 'element') {
        const tempDiv = document.createElement('div');
        tempDiv.innerHTML = element.html;
        const elementNode = tempDiv.firstChild;
        if (elementNode) {
          elementNode.style.backgroundColor = '#fecaca';
          elementNode.style.borderLeft = '4px solid #ef4444';
          elementNode.style.padding = '4px 8px';
          elementNode.style.margin = '2px 0';
          elementNode.style.borderRadius = '4px';
          elementNode.style.textDecoration = 'line-through';
          elementNode.style.opacity = '0.7';
          container.appendChild(elementNode.cloneNode(true));
        }
      } else if (element.type === 'text') {
        const span = document.createElement('span');
        span.textContent = element.content;
        span.style.backgroundColor = '#fecaca';
        span.style.color = '#991b1b';
        span.style.padding = '2px 4px';
        span.style.borderRadius = '3px';
        span.style.textDecoration = 'line-through';
        span.style.fontWeight = '600';
        span.style.opacity = '0.7';
        container.appendChild(span);
      }
    }
  });
  
  return container.innerHTML;
}

// Calculate summary statistics
function calculateSummary(elementDiff) {
  const stats = {
    additions: 0,
    deletions: 0,
    changes: 0
  };
  
  elementDiff.forEach(element => {
    if (element.operation === 'insert') {
      stats.additions++;
    } else if (element.operation === 'delete') {
      stats.deletions++;
    }
  });
  
  stats.changes = stats.additions + stats.deletions;
  
  return stats;
}

// Render HTML differences (simplified for this approach)
export const renderHtmlDifferences = (diffs) => {
  if (!diffs || diffs.length === 0) return '';
  
  return diffs.map(diff => diff.content || '').join('');
};

// Export for compatibility
export { compareHtmlDocuments as default };