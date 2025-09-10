import React, { useState, useCallback } from "react";
import { Loader2 } from "lucide-react";
import Header from "./components/Header";
import FileUpload from "./components/FileUpload";
import DocumentPreview from "./components/DocumentPreview";
import ComparisonSummary from "./components/ComparisonSummary";
import DetailedReport from "./components/DetailedReport";
import { compareHtmlDocuments } from "./utils/textComparison";
import { renderHighlightedModifiedDocument } from "./utils/textComparison";
import {
  exportComparisonResults,
  exportAsHtml,
  exportAsPdf,
} from "./utils/exportUtils";
import UnifiedScrollBar from "./components/MiniMap";

function App() {
  const [leftDocument, setLeftDocument] = useState(null);
  const [rightDocument, setRightDocument] = useState(null);
  const [comparison, setComparison] = useState(null);
  const [viewMode, setViewMode] = useState("preview");
  const [isComparing, setIsComparing] = useState(false);
  const [showDetailed, setShowDetailed] = useState(false);

  const handleDocumentUpload = useCallback((document, position) => {
    if (position === "left") {
      setLeftDocument(document);
    } else {
      setRightDocument(document);
    }
    // Reset comparison when new document is uploaded
    setComparison(null);
    setViewMode("preview");
  }, []);

  const handleCompareDocuments = useCallback(() => {
    console.log("Compare button clicked!");
    console.log("Left document:", leftDocument?.name);
    console.log("Right document:", rightDocument?.name);

    if (leftDocument && rightDocument) {
      console.log("Both documents exist, starting comparison...");
      setIsComparing(true);

      // Use async comparison to prevent browser blocking
      compareHtmlDocuments(
        leftDocument.originalHtmlContent,
        rightDocument.originalHtmlContent
      )
        .then((result) => {
          console.log("Comparison result summary:", result);
          setComparison(result);
          setViewMode("comparison");
          console.log("Comparison completed, view mode set to comparison");
        })
        .catch((error) => {
          console.error("Comparison failed:", error);
          alert(
            "Failed to compare documents. Please try again with smaller files or contact support."
          );
        })
        .finally(() => {
          setIsComparing(false);
        });
    } else {
      console.log("Cannot compare - missing documents");
    }
  }, [leftDocument, rightDocument]);

  const handleExportResults = useCallback(() => {
    if (!comparison || !leftDocument || !rightDocument) return;
    // Create export data with highlighted modified document
    const highlightedContent = renderHighlightedModifiedDocument(comparison.modifiedDocumentHighlighted);
    const exportData = {
      ...comparison,
      highlightedModifiedDocument: highlightedContent
    };
    exportComparisonResults(exportData, leftDocument, rightDocument);
  }, [comparison, leftDocument, rightDocument]);

  const handleExportHtml = useCallback(() => {
    if (!comparison || !leftDocument || !rightDocument) return;
    const highlightedContent = renderHighlightedModifiedDocument(comparison.modifiedDocumentHighlighted);
    const exportData = {
      ...comparison,
      highlightedModifiedDocument: highlightedContent
    };
    exportAsHtml(exportData, leftDocument, rightDocument);
  }, [comparison, leftDocument, rightDocument]);

  const handleExportPdf = useCallback(() => {
    if (!comparison || !leftDocument || !rightDocument) return;
    const highlightedContent = renderHighlightedModifiedDocument(comparison.modifiedDocumentHighlighted);
    const exportData = {
      ...comparison,
      highlightedModifiedDocument: highlightedContent
    };
    exportAsPdf(exportData, leftDocument, rightDocument);
  }, [comparison, leftDocument, rightDocument]);

  const clearDocuments = useCallback(() => {
    setLeftDocument(null);
    setRightDocument(null);
    setComparison(null);
  }, []);

  const canCompare = leftDocument && rightDocument;
  const showComparison = comparison && leftDocument && rightDocument;

  return (
    <div className="min-h-screen bg-gray-50">
      <Header />

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Upload Section */}
        <div className="mb-8 space-y-6">
          <div className="grid md:grid-cols-2 gap-6">
            <FileUpload
              label="Original Document"
              onFileUpload={(doc) => handleDocumentUpload(doc, "left")}
              uploadedFile={leftDocument || undefined}
            />
            <FileUpload
              label="Modified Document"
              onFileUpload={(doc) => handleDocumentUpload(doc, "right")}
              uploadedFile={rightDocument || undefined}
            />
          </div>

          {/* Action Buttons */}
          <div className="flex gap-3 justify-center flex-wrap">
            {canCompare && (
              <div className="flex gap-2 bg-gray-100 rounded-lg p-1">
                <button
                  onClick={() => setViewMode("preview")}
                  className={`px-4 py-2 rounded-md font-medium transition-all duration-200 ${
                    viewMode === "preview"
                      ? "bg-white text-blue-600 shadow-sm"
                      : "text-gray-600 hover:text-gray-800"
                  }`}
                >
                  Preview
                </button>
                <button
                  onClick={() => setViewMode("comparison")}
                  disabled={!comparison}
                  className={`px-4 py-2 rounded-md font-medium transition-all duration-200 ${
                    viewMode === "comparison" && comparison
                      ? "bg-white text-blue-600 shadow-sm"
                      : "text-gray-600 hover:text-gray-800 disabled:opacity-50 disabled:cursor-not-allowed"
                  }`}
                >
                  Comparison
                </button>
                {comparison && (
                  <button
                    onClick={() => setShowDetailed((v) => !v)}
                    className={`px-4 py-2 rounded-md font-medium transition-all duration-200 ${
                      showDetailed
                        ? "bg-white text-blue-600 shadow-sm"
                        : "text-gray-600 hover:text-gray-800"
                    }`}
                  >
                    {showDetailed ? "Hide details" : "Show details"}
                  </button>
                )}
              </div>
            )}
            <button
              onClick={handleCompareDocuments}
              disabled={!canCompare || isComparing}
              className="px-6 py-3 bg-blue-600 text-white rounded-lg font-medium hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-all duration-200 shadow-sm hover:shadow-md flex items-center gap-2"
            >
              {isComparing ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Comparing...
                </>
              ) : (
                "Compare Documents"
              )}
            </button>
            <button
              onClick={clearDocuments}
              className="px-6 py-3 bg-gray-500 text-white rounded-lg font-medium hover:bg-gray-600 transition-all duration-200 shadow-sm hover:shadow-md"
            >
              Clear All
            </button>
          </div>
        </div>

        {/* Comparison Results */}
        {showComparison && viewMode === "comparison" && (
          <div className="space-y-6">
            <ComparisonSummary
              comparison={comparison}
              onExportJson={handleExportResults}
              onExportHtml={handleExportHtml}
              onExportPdf={handleExportPdf}
            />

            {/* Single Modified Document with Highlights */}
            <div className="max-w-6xl mx-auto">
              <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-4 mb-4">
                <h3 className="text-lg font-semibold text-gray-800 mb-2">
                  Modified Document with Changes Highlighted
                </h3>
                <p className="text-sm text-gray-600">
                  Only the differences are highlighted in the modified document. 
                  Yellow background shows added/modified content, red strike-through shows removed content.
                </p>
              </div>
              
              <DocumentPreview


                document={rightDocument}
                highlightedContent={renderHighlightedModifiedDocument(comparison.modifiedDocumentHighlighted)}
                title="Modified Document with Highlights"
                containerId="highlighted-document-container"
                isModifiedWithHighlights={true}
              />
            </div>

            {showDetailed && comparison.detailed && <DetailedReport report={comparison.detailed} />}

            {/* Legend */}
            <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-4">
              <h4 className="text-sm font-semibold text-gray-700 mb-3">
                Highlighting Legend
              </h4>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-sm">
                <div className="flex items-center gap-2">
                  <span className="bg-yellow-200 text-yellow-800 px-3 py-2 rounded border-l-4 border-yellow-500">
                    Added/Modified Content
                  </span>
                  <span className="text-gray-600">
                    New or changed content
                  </span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="bg-red-200 text-red-800 px-3 py-2 rounded border-l-4 border-red-500 line-through">
                    Removed Content
                  </span>
                  <span className="text-gray-600">
                    Content that was deleted
                  </span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="bg-gray-100 text-gray-700 px-3 py-2 rounded border border-gray-300">
                    Unchanged Content
                  </span>
                  <span className="text-gray-600">
                    No highlighting applied
                  </span>
                </div>
              </div>
              <div className="mt-4 p-3 bg-green-50 rounded-lg border border-green-200">
                <div className="flex items-center gap-2 text-indigo-700 text-sm">
                  <span className="font-medium">✅ Modified Document Only:</span>
                </div>
                <div className="mt-1 text-sm text-green-600">
                  Only the modified document is shown with changes highlighted. The original 
                  formatting, layout, width, and height are preserved exactly as they appear 
                  in the modified document.
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Document Preview Mode - Always show original formatting */}
        {leftDocument && rightDocument && viewMode === "preview" && (
          <div className="space-y-6">
            <div className="text-center">
              <h3 className="text-lg font-semibold text-gray-800 mb-2">
                Document Preview
              </h3>
              <p className="text-gray-600">
                View your documents with original formatting preserved
              </p>
            </div>

            <div className="grid grid-cols-2 gap-6">
              <DocumentPreview
                document={leftDocument}
                title="Original Document"
              />
              <DocumentPreview
                document={rightDocument}
                title="Modified Document"
              />
            </div>
          </div>
        )}

        {/* Single Document Preview - Always show original formatting */}
        {((leftDocument && !rightDocument) ||
          (!leftDocument && rightDocument)) && (
          <div className="space-y-6">
            <div className="text-center">
              <h3 className="text-lg font-semibold text-gray-800 mb-2">
                Document Preview
              </h3>
              <p className="text-gray-600">
                Upload another document to enable comparison
              </p>
            </div>

            <div className="max-w-4xl mx-auto">
              <DocumentPreview
                document={leftDocument || rightDocument}
                title={leftDocument ? "Original Document" : "Modified Document"}
              />
            </div>
          </div>
        )}

        {/* Instructions */}
        {!leftDocument && !rightDocument && (
          <div className="text-center py-16">
            <div className="max-w-md mx-auto">
              <div className="mb-6">
                <div className="w-16 h-16 bg-blue-100 rounded-full flex items-center justify-center mx-auto mb-4">
                  <svg
                    className="w-8 h-8 text-blue-600"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
                    />
                  </svg>
                </div>
              </div>
              <h3 className="text-xl font-semibold text-gray-900 mb-3">
                Get Started
              </h3>
              <p className="text-gray-600 mb-6">
                Upload two Word documents to compare them side by side and see
                exactly what changed.
              </p>
              <div className="grid grid-cols-2 gap-4 text-sm text-gray-500">
                <div className="flex items-center gap-2">
                  <div className="w-2 h-2 bg-green-500 rounded-full"></div>
                  <span>Exact formatting preserved</span>
                </div>
                <div className="flex items-center gap-2">
                  <div className="w-2 h-2 bg-blue-500 rounded-full"></div>
                  <span>Side-by-side comparison</span>
                </div>
                <div className="flex items-center gap-2">
                  <div className="w-2 h-2 bg-purple-500 rounded-full"></div>
                  <span>Supports .docx and .doc</span>
                </div>
                <div className="flex items-center gap-2">
                  <div className="w-2 h-2 bg-orange-500 rounded-full"></div>
                  <span>Export results</span>
                </div>
              </div>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}

export default App;
