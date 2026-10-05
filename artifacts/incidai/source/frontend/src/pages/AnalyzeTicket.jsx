/**
 * AI Analyze Page - Complete ticket analysis with RAG
 */
import { useState } from 'react';
import { Brain, Search, FileText } from 'lucide-react';
import apiService from '../services/api';

export default function AnalyzeTicket() {
  const [query, setQuery] = useState({ title: '', description: '' });
  const [analysis, setAnalysis] = useState(null);
  const [loading, setLoading] = useState(false);

  const handleAnalyze = async (e) => {
    e.preventDefault(); // ⭐ CRITICAL: Prevent default form submission
    
    // Validate
    if (!query.title.trim() || !query.description.trim()) {
      alert('Please fill in both title and description');
      return;
    }
    
    setLoading(true);
    setAnalysis(null);
    
    try {
      console.log('Sending analysis request:', query); // Debug log
      
      const response = await apiService.analyzeTicket({
        title: query.title,
        description: query.description
      });
      
      console.log('Analysis response:', response.data); // Debug log
      setAnalysis(response.data);
      
    } catch (err) {
      console.error('Analysis error:', err);
      
      // Detailed error handling
      if (err.response) {
        // Server responded with error
        const errorMsg = err.response.data.detail || 
                        err.response.data.error || 
                        'Failed to analyze ticket';
        alert(`Server Error (${err.response.status}): ${errorMsg}`);
      } else if (err.request) {
        // No response received
        alert('No response from server. Please check:\n' +
              '1. Backend is running on http://localhost:8000\n' +
              '2. CORS is configured correctly');
      } else {
        // Request setup error
        alert('Error: ' + err.message);
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="p-8 max-w-6xl mx-auto">
      <div className="mb-6">
        <h1 className="text-3xl font-bold text-gray-900 flex items-center gap-3">
          <Brain className="text-purple-600" />
          AI Ticket Analyzer
        </h1>
        <p className="text-gray-600 mt-1">
          Get instant classification, similar tickets, and resolution suggestions
        </p>
      </div>

      {/* Input Form - ⭐ IMPORTANT: onSubmit on form, not onClick on button */}
      <form onSubmit={handleAnalyze} className="bg-white rounded-lg shadow p-6 mb-6 space-y-4">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Ticket Title
          </label>
          <input
            type="text"
            required
            value={query.title}
            onChange={(e) => setQuery({ ...query, title: e.target.value })}
            className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary focus:border-transparent"
            placeholder="e.g., Cannot access shared folder"
          />
        </div>
        
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Description
          </label>
          <textarea
            required
            rows={4}
            value={query.description}
            onChange={(e) => setQuery({ ...query, description: e.target.value })}
            className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary focus:border-transparent"
            placeholder="Detailed description of the issue..."
          />
        </div>
        
        {/* Submit button - type="submit" is critical */}
        <button
          type="submit"
          disabled={loading}
          className="w-full flex items-center justify-center gap-2 px-6 py-3 bg-purple-600 text-white rounded-lg hover:bg-purple-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
        >
          <Brain size={20} />
          {loading ? 'Analyzing...' : 'Analyze with AI'}
        </button>
      </form>

      {/* Loading State */}
      {loading && (
        <div className="bg-white rounded-lg shadow p-8 text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-purple-600 mx-auto mb-4"></div>
          <p className="text-gray-600">AI is analyzing your ticket...</p>
        </div>
      )}

      {/* Results */}
      {!loading && analysis && (
        <div className="space-y-6">
          {/* Prediction */}
          <div className="bg-white rounded-lg shadow p-6">
            <h2 className="text-xl font-semibold mb-4 flex items-center gap-2">
              <Brain size={20} className="text-blue-600" />
              Classification Result
            </h2>
            <div className="grid grid-cols-3 gap-4">
              <div className="bg-blue-50 rounded-lg p-4">
                <p className="text-sm text-gray-600 mb-1">Category</p>
                <p className="text-lg font-semibold text-blue-900">
                  {analysis.prediction.category}
                </p>
              </div>
              <div className="bg-green-50 rounded-lg p-4">
                <p className="text-sm text-gray-600 mb-1">Confidence</p>
                <p className="text-lg font-semibold text-green-900">
                  {(analysis.prediction.confidence * 100).toFixed(1)}%
                </p>
              </div>
              <div className="bg-purple-50 rounded-lg p-4">
                <p className="text-sm text-gray-600 mb-1">Method</p>
                <p className="text-lg font-semibold text-purple-900">
                  {analysis.prediction.method}
                </p>
              </div>
            </div>
          </div>

          {/* Similar Tickets */}
          {analysis.similar_tickets && analysis.similar_tickets.length > 0 && (
            <div className="bg-white rounded-lg shadow p-6">
              <h2 className="text-xl font-semibold mb-4 flex items-center gap-2">
                <Search size={20} className="text-green-600" />
                Similar Tickets ({analysis.similar_tickets.length})
              </h2>
              <div className="space-y-3">
                {analysis.similar_tickets.map((ticket, idx) => (
                  <div 
                    key={idx} 
                    className="border border-gray-200 rounded-lg p-4 hover:bg-gray-50 transition-colors"
                  >
                    <div className="flex items-start justify-between mb-2">
                      <h3 className="font-medium text-gray-900 flex-1">
                        {ticket.title}
                      </h3>
                      <span className="text-sm font-semibold text-green-600 ml-4">
                        {(ticket.similarity * 100).toFixed(1)}% match
                      </span>
                    </div>
                    <p className="text-sm text-gray-600 mb-2">
                      {ticket.description}
                    </p>
                    <span className="inline-block px-2 py-1 text-xs bg-blue-100 text-blue-800 rounded">
                      {ticket.category}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Resolution */}
          {analysis.resolution && (
            <div className="bg-white rounded-lg shadow p-6">
              <h2 className="text-xl font-semibold mb-4 flex items-center gap-2">
                <FileText size={20} className="text-orange-600" />
                Suggested Resolution
              </h2>
              <div className="bg-gray-50 rounded-lg p-6">
                <div className="prose max-w-none">
                  <pre className="whitespace-pre-wrap font-sans text-gray-800 text-sm">
                    {analysis.resolution.text}
                  </pre>
                </div>
                <div className="mt-4 pt-4 border-t border-gray-200">
                  <span className="text-sm text-gray-600">
                    Generated using:{' '}
                    <span className="font-medium">{analysis.resolution.method}</span>
                  </span>
                </div>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}