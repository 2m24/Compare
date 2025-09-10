import DiffMatchPatch from 'diff-match-patch';

// Enhanced comparison function that highlights changes only in the modified document
export const compareHtmlDocuments = async (leftHtml, rightHtml) => {
  console.log("Starting comparison for modified document highlighting...");
  
  try {
    // Parse HTML content into structured segments
    const leftSegments = parseHtmlIntoSegments(leftHtml);
    const rightSegments = parseHtmlIntoSegments(rightHtml);
    
    console.log(`Left document: ${leftSegments.length} segments`);
    console.log(`Right document: ${rightSegments.length} segments`);
    
    // Create diff that shows changes only in the modified document
    const modifiedDocumentWithHighlights = createModifiedDocumentHighlights(leftSegments, rightSegments);
    
    // Calculate summary statistics
    const summary = calculateSummary(modifiedDocumentWithHighlights);
    
    return {
      modifiedDocumentHighlighted: modifiedDocumentWithHighlights,
      summary,
      originalDocument: leftHtml, // Keep original unchanged
      modifiedDocument: rightHtml // Keep modified unchanged for reference
    };
  } catch (error) {
    console.error("Comparison failed:", error);
    throw new Error("Failed to compare documents: " + error.message);
  }
};

// Parse HTML into meaningful segments
function parseHtmlIntoSegments(html) {
  if (!html) return [];
  
  const parser = new DOMParser();
  const doc = parser.parseFromString(html, 'text/html');
  const segments = [];
  
  // Get all meaningful content elements in document order
  const walker = document.createTreeWalker(
    doc.body,
    NodeFilter.SHOW_ELEMENT,
    {
      acceptNode: function(node) {
        const tagName = node.tagName.toLowerCase();
        // Accept block-level elements and meaningful inline elements
        if (['p', 'h1', 'h2', 'h3', 'h4', 'h5', 'h6', 'li', 'td', 'th', 'div', 'blockquote', 'pre', 'img', 'table', 'tr'].includes(tagName)) {
          return NodeFilter.FILTER_ACCEPT;
        }
        return NodeFilter.FILTER_SKIP;
      }
    }
  );
  
  let node;
  let index = 0;
  while (node = walker.nextNode()) {
    const text = node.textContent?.trim();
    const tagName = node.tagName.toLowerCase();
    
    // Skip empty elements except images and tables
    if (!text && !['img', 'table', 'tr'].includes(tagName)) continue;
    
    segments.push({
      id: index++,
      type: getElementType(node),
      tagName: tagName,
      text: text || '',
      html: node.outerHTML,
      element: node.cloneNode(true),
      styles: node.getAttribute('style') || '',
      className: node.className || ''
    });
  }
  
  return segments;
}

// Determine element type
function getElementType(element) {
  const tagName = element.tagName.toLowerCase();
  
  if (/^h[1-6]$/.test(tagName)) return 'heading';
  if (tagName === 'p') return 'paragraph';
  if (tagName === 'li') return 'listItem';
  if (['td', 'th'].includes(tagName)) return 'tableCell';
  if (tagName === 'img') return 'image';
  if (tagName === 'table') return 'table';
  if (tagName === 'tr') return 'tableRow';
  if (tagName === 'blockquote') return 'quote';
  if (tagName === 'pre') return 'preformatted';
  
  return 'block';
}

// Create highlighted version of modified document only
function createModifiedDocumentHighlights(leftSegments, rightSegments) {
  const dmp = new DiffMatchPatch();
  const highlightedSegments = [];
  
  let leftIndex = 0;
  let rightIndex = 0;
  
  while (rightIndex < rightSegments.length) {
    const rightSegment = rightSegments[rightIndex];
    const leftSegment = leftSegments[leftIndex];
    
    if (!leftSegment) {
      // Only right segments remaining - these are additions
      highlightedSegments.push(createHighlightedSegment(rightSegment, 'added'));
      rightIndex++;
    } else if (rightSegment.text === leftSegment.text && rightSegment.tagName === leftSegment.tagName) {
      // Identical content - no highlighting needed
      highlightedSegments.push(createHighlightedSegment(rightSegment, 'unchanged'));
      leftIndex++;
      rightIndex++;
    } else {
      // Check if this right segment exists later in left (it's an addition)
      const foundInLeft = findSegmentInArray(rightSegment, leftSegments, leftIndex + 1);
      
      if (foundInLeft === -1) {
        // Check if current left segment exists later in right (current right is modified/added)
        const leftInRight = findSegmentInArray(leftSegment, rightSegments, rightIndex + 1);
        
        if (leftInRight !== -1) {
          // Current right is an addition, left segment appears later
          highlightedSegments.push(createHighlightedSegment(rightSegment, 'added'));
          rightIndex++;
        } else {
          // Content is modified - do word-level diff
          const wordDiff = createWordLevelDiff(leftSegment.text, rightSegment.text, dmp);
          highlightedSegments.push(createHighlightedSegment(rightSegment, 'modified', wordDiff));
          leftIndex++;
          rightIndex++;
        }
      } else {
        // Right segment exists in left - it's unchanged
        highlightedSegments.push(createHighlightedSegment(rightSegment, 'unchanged'));
        leftIndex++;
        rightIndex++;
      }
    }
  }
  
  return highlightedSegments;
}

// Find segment in array
function findSegmentInArray(segment, segments, startIndex) {
  for (let i = startIndex; i < segments.length; i++) {
    if (segments[i].text === segment.text && segments[i].tagName === segment.tagName) {
      return i;
    }
  }
  return -1;
}

// Create highlighted segment
function createHighlightedSegment(segment, changeType, wordDiff = null) {
  let highlightedHtml = segment.html;
  
  if (changeType === 'added') {
    // Highlight entire element as added
    highlightedHtml = addHighlightToElement(segment.html, 'highlight-added');
  } else if (changeType === 'modified' && wordDiff) {
    // Replace text content with word-level diff
    highlightedHtml = segment.html.replace(segment.text, wordDiff);
    highlightedHtml = addHighlightToElement(highlightedHtml, 'highlight-modified');
  } else if (changeType === 'removed') {
    // Show removed content with strike-through
    highlightedHtml = addHighlightToElement(segment.html, 'highlight-removed');
  }
  // For 'unchanged', keep original HTML
  
  return {
    ...segment,
    changeType,
    highlightedHtml,
    originalHtml: segment.html
  };
}

// Add highlight class to HTML element
function addHighlightToElement(html, className) {
  const parser = new DOMParser();
  const doc = parser.parseFromString(`<div>${html}</div>`, 'text/html');
  const container = doc.querySelector('div');
  
  if (container && container.firstElementChild) {
    const element = container.firstElementChild;
    element.classList.add(className);
    return element.outerHTML;
  }
  
  return `<div class="${className}">${html}</div>`;
}

// Create word-level diff for modified content
function createWordLevelDiff(leftText, rightText, dmp) {
  const diff = dmp.diff_main(leftText, rightText);
  dmp.diff_cleanupSemantic(diff);
  
  let result = '';
  
  diff.forEach(([operation, text]) => {
    const escapedText = escapeHtml(text);
    
    switch (operation) {
      case DiffMatchPatch.DIFF_EQUAL:
        result += escapedText;
        break;
      case DiffMatchPatch.DIFF_DELETE:
        // Show removed text with strike-through in modified document
        result += `<span class="inline-removed">${escapedText}</span>`;
        break;
      case DiffMatchPatch.DIFF_INSERT:
        // Show added text with highlight in modified document
        result += `<span class="inline-added">${escapedText}</span>`;
        break;
    }
  });
  
  return result;
}

// Escape HTML characters
function escapeHtml(text) {
  const div = document.createElement('div');
  div.textContent = text;
  return div.innerHTML;
}

// Calculate summary statistics
function calculateSummary(highlightedSegments) {
  const stats = {
    additions: 0,
    deletions: 0,
    modifications: 0,
    changes: 0
  };
  
  highlightedSegments.forEach(segment => {
    switch (segment.changeType) {
      case 'added':
        stats.additions++;
        break;
      case 'removed':
        stats.deletions++;
        break;
      case 'modified':
        stats.modifications++;
        break;
    }
  });
  
  stats.changes = stats.additions + stats.deletions + stats.modifications;
  
  return stats;
}

// Render the highlighted modified document
export const renderHighlightedModifiedDocument = (highlightedSegments) => {
  if (!highlightedSegments || highlightedSegments.length === 0) return '';
  
  return highlightedSegments.map(segment => segment.highlightedHtml || segment.html).join('\n');
};

// Export for compatibility
export { compareHtmlDocuments as default };