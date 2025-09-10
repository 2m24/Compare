import DiffMatchPatch from 'diff-match-patch';

// Enhanced comparison function that creates mutual comparison with precise highlighting
export const compareHtmlDocuments = async (leftHtml, rightHtml) => {
  console.log("Starting enhanced mutual comparison...");
  
  try {
    // Parse HTML content into structured segments
    const leftSegments = parseHtmlIntoSegments(leftHtml);
    const rightSegments = parseHtmlIntoSegments(rightHtml);
    
    console.log(`Left document: ${leftSegments.length} segments`);
    console.log(`Right document: ${rightSegments.length} segments`);
    
    // Create mutual diff that shows all changes in both documents
    const mutualDiff = createMutualDiff(leftSegments, rightSegments);
    
    // Generate highlighted versions for both documents
    const leftDiffs = generateMutualHighlighting(mutualDiff.leftResult, 'left');
    const rightDiffs = generateMutualHighlighting(mutualDiff.rightResult, 'right');
    
    // Calculate summary statistics
    const summary = calculateMutualSummary(mutualDiff);
    
    // Generate detailed report
    const detailed = generateDetailedReport(mutualDiff);
    
    return {
      leftDiffs,
      rightDiffs,
      summary,
      detailed
    };
  } catch (error) {
    console.error("Comparison failed:", error);
    throw new Error("Failed to compare documents: " + error.message);
  }
};

// Parse HTML into meaningful segments (paragraphs, headings, lists, tables, etc.)
function parseHtmlIntoSegments(html) {
  if (!html) return [];
  
  const parser = new DOMParser();
  const doc = parser.parseFromString(html, 'text/html');
  const segments = [];
  
  // Get all block-level elements that represent meaningful content units
  const blockElements = doc.body.querySelectorAll('p, h1, h2, h3, h4, h5, h6, li, td, th, div, blockquote, pre');
  
  blockElements.forEach((element, index) => {
    const text = element.textContent?.trim();
    if (text) {
      segments.push({
        id: index,
        type: getElementType(element),
        tagName: element.tagName.toLowerCase(),
        text: text,
        html: element.outerHTML,
        styles: element.getAttribute('style') || '',
        className: element.className || '',
        parent: element.parentElement?.tagName.toLowerCase() || null,
        isTableCell: ['td', 'th'].includes(element.tagName.toLowerCase()),
        isListItem: element.tagName.toLowerCase() === 'li',
        isHeading: /^h[1-6]$/.test(element.tagName.toLowerCase())
      });
    }
  });
  
  // Also capture images and other media elements
  const mediaElements = doc.body.querySelectorAll('img, table, hr');
  mediaElements.forEach((element, index) => {
    segments.push({
      id: `media_${index}`,
      type: 'media',
      tagName: element.tagName.toLowerCase(),
      text: element.alt || element.title || `[${element.tagName.toLowerCase()}]`,
      html: element.outerHTML,
      styles: element.getAttribute('style') || '',
      className: element.className || '',
      isMedia: true
    });
  });
  
  return segments.sort((a, b) => {
    // Sort by document order
    const aPos = a.html.indexOf(a.text);
    const bPos = b.html.indexOf(b.text);
    return aPos - bPos;
  });
}

// Determine element type for better categorization
function getElementType(element) {
  const tagName = element.tagName.toLowerCase();
  
  if (/^h[1-6]$/.test(tagName)) return 'heading';
  if (tagName === 'p') return 'paragraph';
  if (tagName === 'li') return 'listItem';
  if (['td', 'th'].includes(tagName)) return 'tableCell';
  if (tagName === 'blockquote') return 'quote';
  if (tagName === 'pre') return 'preformatted';
  if (tagName === 'div') return 'block';
  
  return 'text';
}

// Create mutual diff that shows all changes in both documents
function createMutualDiff(leftSegments, rightSegments) {
  const leftResult = [];
  const rightResult = [];
  const dmp = new DiffMatchPatch();
  
  let leftIndex = 0;
  let rightIndex = 0;
  
  while (leftIndex < leftSegments.length || rightIndex < rightSegments.length) {
    const leftSegment = leftSegments[leftIndex];
    const rightSegment = rightSegments[rightIndex];
    
    if (!leftSegment) {
      // Only right segments remaining - additions
      rightResult.push({
        ...rightSegment,
        operation: 'added',
        changeType: 'structural_add',
        highlighted: true
      });
      leftResult.push(createPlaceholder('added', rightSegment));
      rightIndex++;
    } else if (!rightSegment) {
      // Only left segments remaining - deletions
      leftResult.push({
        ...leftSegment,
        operation: 'removed',
        changeType: 'structural_remove',
        highlighted: true
      });
      rightResult.push(createPlaceholder('removed', leftSegment));
      leftIndex++;
    } else if (leftSegment.text === rightSegment.text && leftSegment.tagName === rightSegment.tagName) {
      // Identical content and structure
      leftResult.push({
        ...leftSegment,
        operation: 'unchanged',
        highlighted: false
      });
      rightResult.push({
        ...rightSegment,
        operation: 'unchanged',
        highlighted: false
      });
      leftIndex++;
      rightIndex++;
    } else if (leftSegment.tagName === rightSegment.tagName) {
      // Same element type but different content - word-level diff
      const wordDiff = createWordLevelDiff(leftSegment.text, rightSegment.text, dmp);
      
      leftResult.push({
        ...leftSegment,
        operation: 'modified',
        changeType: 'content_change',
        highlighted: true,
        wordDiff: wordDiff.left,
        originalText: leftSegment.text
      });
      rightResult.push({
        ...rightSegment,
        operation: 'modified',
        changeType: 'content_change',
        highlighted: true,
        wordDiff: wordDiff.right,
        originalText: rightSegment.text
      });
      leftIndex++;
      rightIndex++;
    } else {
      // Different element types - check if content exists elsewhere
      const rightMatch = findMatchingSegment(leftSegment, rightSegments, rightIndex + 1);
      const leftMatch = findMatchingSegment(rightSegment, leftSegments, leftIndex + 1);
      
      if (rightMatch !== -1 && (leftMatch === -1 || rightMatch < leftMatch)) {
        // Left segment appears later in right - current right is addition
        rightResult.push({
          ...rightSegment,
          operation: 'added',
          changeType: 'structural_add',
          highlighted: true
        });
        leftResult.push(createPlaceholder('added', rightSegment));
        rightIndex++;
      } else if (leftMatch !== -1) {
        // Right segment appears later in left - current left is deletion
        leftResult.push({
          ...leftSegment,
          operation: 'removed',
          changeType: 'structural_remove',
          highlighted: true
        });
        rightResult.push(createPlaceholder('removed', leftSegment));
        leftIndex++;
      } else {
        // Both are unique - treat as replacement
        leftResult.push({
          ...leftSegment,
          operation: 'removed',
          changeType: 'replacement',
          highlighted: true
        });
        rightResult.push({
          ...rightSegment,
          operation: 'added',
          changeType: 'replacement',
          highlighted: true
        });
        leftIndex++;
        rightIndex++;
      }
    }
  }
  
  return { leftResult, rightResult };
}

// Find matching segment in array
function findMatchingSegment(segment, segments, startIndex) {
  for (let i = startIndex; i < segments.length; i++) {
    if (segments[i].text === segment.text && segments[i].tagName === segment.tagName) {
      return i - startIndex;
    }
  }
  return -1;
}

// Create placeholder for alignment
function createPlaceholder(type, originalSegment) {
  return {
    id: `placeholder_${originalSegment.id}`,
    type: 'placeholder',
    tagName: originalSegment.tagName,
    text: '',
    html: `<div class="git-line-placeholder placeholder-${type}"></div>`,
    operation: 'placeholder',
    changeType: `placeholder_${type}`,
    highlighted: true,
    placeholderFor: type,
    originalSegment
  };
}

// Create word-level diff for content changes
function createWordLevelDiff(leftText, rightText, dmp) {
  const diff = dmp.diff_main(leftText, rightText);
  dmp.diff_cleanupSemantic(diff);
  
  let leftHtml = '';
  let rightHtml = '';
  
  diff.forEach(([operation, text]) => {
    const escapedText = escapeHtml(text);
    
    switch (operation) {
      case DiffMatchPatch.DIFF_EQUAL:
        leftHtml += escapedText;
        rightHtml += escapedText;
        break;
      case DiffMatchPatch.DIFF_DELETE:
        leftHtml += `<span class="git-inline-removed">${escapedText}</span>`;
        rightHtml += `<span class="git-inline-placeholder">[removed: ${escapedText.substring(0, 20)}${escapedText.length > 20 ? '...' : ''}]</span>`;
        break;
      case DiffMatchPatch.DIFF_INSERT:
        leftHtml += `<span class="git-inline-placeholder">[added: ${escapedText.substring(0, 20)}${escapedText.length > 20 ? '...' : ''}]</span>`;
        rightHtml += `<span class="git-inline-added">${escapedText}</span>`;
        break;
    }
  });
  
  return { left: leftHtml, right: rightHtml };
}

// Escape HTML characters
function escapeHtml(text) {
  const div = document.createElement('div');
  div.textContent = text;
  return div.innerHTML;
}

// Generate mutual highlighting for both documents
function generateMutualHighlighting(segments, side) {
  return segments.map(segment => {
    let content = '';
    
    if (segment.operation === 'placeholder') {
      // Create placeholder with appropriate styling
      content = `<div class="git-line-placeholder ${segment.placeholderFor === 'added' ? 'placeholder-added' : 'placeholder-removed'}">
        <span style="color: #6b7280; font-style: italic; font-size: 0.9em;">
          ${segment.placeholderFor === 'added' ? '+ Content added in modified document' : '- Content removed from original document'}
        </span>
      </div>`;
    } else if (segment.operation === 'unchanged') {
      // Unchanged content - preserve original formatting
      content = segment.html;
    } else if (segment.operation === 'added') {
      // Added content - highlight with green
      content = addHighlightingToHtml(segment.html, 'git-line-added');
    } else if (segment.operation === 'removed') {
      // Removed content - highlight with red and strike-through
      content = addHighlightingToHtml(segment.html, 'git-line-removed');
    } else if (segment.operation === 'modified') {
      // Modified content - use word-level diff
      const modifiedHtml = segment.html.replace(
        segment.originalText,
        segment.wordDiff
      );
      content = addHighlightingToHtml(modifiedHtml, 'git-line-modified');
    }
    
    return {
      content,
      type: segment.operation || 'unchanged',
      changeType: segment.changeType || 'none',
      elementType: segment.type,
      tagName: segment.tagName
    };
  });
}

// Add highlighting classes to HTML
function addHighlightingToHtml(html, className) {
  const parser = new DOMParser();
  const doc = parser.parseFromString(`<div>${html}</div>`, 'text/html');
  const container = doc.querySelector('div');
  
  if (container && container.firstElementChild) {
    container.firstElementChild.classList.add(className);
    return container.innerHTML;
  }
  
  return `<div class="${className}">${html}</div>`;
}

// Calculate summary statistics
function calculateMutualSummary(mutualDiff) {
  const stats = {
    additions: 0,
    deletions: 0,
    modifications: 0,
    changes: 0
  };
  
  mutualDiff.rightResult.forEach(segment => {
    if (segment.operation === 'added') {
      stats.additions++;
    } else if (segment.operation === 'modified') {
      stats.modifications++;
    }
  });
  
  mutualDiff.leftResult.forEach(segment => {
    if (segment.operation === 'removed') {
      stats.deletions++;
    }
  });
  
  stats.changes = stats.additions + stats.deletions + stats.modifications;
  
  return stats;
}

// Generate detailed report
function generateDetailedReport(mutualDiff) {
  const lines = [];
  const tables = [];
  const images = [];
  
  // Process line-by-line changes
  mutualDiff.leftResult.forEach((leftSeg, index) => {
    const rightSeg = mutualDiff.rightResult[index];
    
    if (!leftSeg || !rightSeg) return;
    
    let status = 'UNCHANGED';
    let diffHtml = '';
    let formatChanges = [];
    
    if (leftSeg.operation === 'removed' && rightSeg.operation === 'placeholder') {
      status = 'REMOVED';
      diffHtml = `<span class="git-inline-removed">${escapeHtml(leftSeg.text)}</span>`;
    } else if (leftSeg.operation === 'placeholder' && rightSeg.operation === 'added') {
      status = 'ADDED';
      diffHtml = `<span class="git-inline-added">${escapeHtml(rightSeg.text)}</span>`;
    } else if (leftSeg.operation === 'modified' && rightSeg.operation === 'modified') {
      status = 'MODIFIED';
      diffHtml = rightSeg.wordDiff || escapeHtml(rightSeg.text);
      
      // Check for formatting changes
      if (leftSeg.styles !== rightSeg.styles) {
        formatChanges.push('Style changes detected');
      }
      if (leftSeg.className !== rightSeg.className) {
        formatChanges.push('Class changes detected');
      }
    } else if (leftSeg.operation === 'unchanged') {
      status = 'UNCHANGED';
      diffHtml = escapeHtml(leftSeg.text);
    }
    
    lines.push({
      v1: index + 1,
      v2: index + 1,
      status,
      diffHtml,
      formatChanges
    });
    
    // Track table changes
    if (leftSeg.isTableCell || rightSeg.isTableCell) {
      tables.push({
        status,
        table: 1,
        row: Math.floor(index / 3) + 1,
        col: (index % 3) + 1,
        diffHtml
      });
    }
    
    // Track image changes
    if (leftSeg.isMedia || rightSeg.isMedia) {
      images.push({
        status,
        index: index + 1
      });
    }
  });
  
  return { lines, tables, images };
}

// Render HTML differences
export const renderHtmlDifferences = (diffs) => {
  if (!diffs || diffs.length === 0) return '';
  
  return diffs.map(diff => diff.content || '').join('\n');
};

// Export for compatibility
export { compareHtmlDocuments as default };