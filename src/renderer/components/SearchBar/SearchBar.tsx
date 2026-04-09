import React, { useState, useMemo } from 'react';
import { Search, X, Filter, Star, Archive } from 'lucide-react';
import { useCategoryStore } from '../../stores/category';
import type { Paper, Tag } from '../../../shared/types/category';

interface SearchBarProps {
  onSearchResults?: (papers: Paper[]) => void;
  onClearSearch?: () => void;
}

const SearchBar: React.FC<SearchBarProps> = ({ onSearchResults, onClearSearch }) => {
  const { papers, tags } = useCategoryStore();
  const [query, setQuery] = useState('');
  const [showFilters, setShowFilters] = useState(false);
  const [filters, setFilters] = useState({
    year: '',
    journal: '',
    tag: '',
    favoritesOnly: false,
    excludeArchived: true,
  });

  // Get unique years and journals for filter options
  const years = useMemo(() => {
    const yearSet = new Set<number>();
    papers.forEach(p => {
      if (p.publishYear) yearSet.add(p.publishYear);
    });
    return Array.from(yearSet).sort((a, b) => b - a);
  }, [papers]);

  const journals = useMemo(() => {
    const journalSet = new Set<string>();
    papers.forEach(p => {
      if (p.journal) journalSet.add(p.journal);
    });
    return Array.from(journalSet).sort();
  }, [papers]);

  // Perform search
  const searchResults = useMemo(() => {
    let results = papers;

    // Text search
    if (query.trim()) {
      const lowerQuery = query.toLowerCase();
      results = results.filter(paper => {
        const titleMatch = paper.title?.toLowerCase().includes(lowerQuery);
        const authorMatch = paper.authors?.some(a => a.toLowerCase().includes(lowerQuery));
        const journalMatch = paper.journal?.toLowerCase().includes(lowerQuery);
        const tagMatch = paper.tags.some(tagId => {
          const tag = tags.find(t => t.id === tagId);
          return tag?.name.toLowerCase().includes(lowerQuery);
        });
        return titleMatch || authorMatch || journalMatch || tagMatch;
      });
    }

    // Apply filters
    if (filters.year) {
      results = results.filter(p => p.publishYear === parseInt(filters.year));
    }
    if (filters.journal) {
      results = results.filter(p => p.journal === filters.journal);
    }
    if (filters.tag) {
      results = results.filter(p => p.tags.includes(filters.tag));
    }
    if (filters.favoritesOnly) {
      results = results.filter(p => p.isFavorite);
    }
    if (filters.excludeArchived) {
      results = results.filter(p => !p.isArchived);
    }

    return results;
  }, [papers, tags, query, filters]);

  // Notify parent of results
  React.useEffect(() => {
    if (query || Object.values(filters).some(v => v)) {
      onSearchResults?.(searchResults);
    } else {
      onClearSearch?.();
    }
  }, [searchResults, query, filters, onSearchResults, onClearSearch]);

  const clearSearch = () => {
    setQuery('');
    setFilters({
      year: '',
      journal: '',
      tag: '',
      favoritesOnly: false,
      excludeArchived: true,
    });
    onClearSearch?.();
  };

  const hasActiveFilters = query || filters.year || filters.journal || filters.tag || filters.favoritesOnly;

  return (
    <div className="bg-white dark:bg-gray-900 border-b border-gray-200 dark:border-gray-700">
      {/* Search Input */}
      <div className="flex items-center gap-2 px-4 py-3">
        <div className="flex-1 relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
          <input
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="搜索论文标题、作者、期刊或标签..."
            className="w-full pl-10 pr-10 py-2 bg-gray-100 dark:bg-gray-800 border border-transparent focus:border-primary-500 focus:bg-white dark:focus:bg-gray-700 rounded-lg text-sm text-gray-900 dark:text-white placeholder-gray-500 transition-all"
          />
          {query && (
            <button
              onClick={() => setQuery('')}
              className="absolute right-3 top-1/2 -translate-y-1/2 p-0.5 hover:bg-gray-200 dark:hover:bg-gray-600 rounded"
            >
              <X className="w-4 h-4 text-gray-400" />
            </button>
          )}
        </div>

        <button
          onClick={() => setShowFilters(!showFilters)}
          className={`flex items-center gap-1.5 px-3 py-2 rounded-lg text-sm transition-colors ${
            showFilters || hasActiveFilters
              ? 'bg-primary-100 dark:bg-primary-900/30 text-primary-700 dark:text-primary-300'
              : 'bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-400 hover:bg-gray-200 dark:hover:bg-gray-700'
          }`}
        >
          <Filter className="w-4 h-4" />
          筛选
          {hasActiveFilters && (
            <span className="ml-1 w-2 h-2 bg-primary-500 rounded-full" />
          )}
        </button>

        {hasActiveFilters && (
          <button
            onClick={clearSearch}
            className="px-3 py-2 text-sm text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white transition-colors"
          >
            清除
          </button>
        )}
      </div>

      {/* Filters */}
      {showFilters && (
        <div className="px-4 pb-3 border-t border-gray-100 dark:border-gray-800">
          <div className="flex flex-wrap items-center gap-3 pt-3">
            {/* Year Filter */}
            <select
              value={filters.year}
              onChange={(e) => setFilters(prev => ({ ...prev, year: e.target.value }))}
              className="px-3 py-1.5 bg-gray-100 dark:bg-gray-800 border border-gray-300 dark:border-gray-600 rounded text-sm text-gray-700 dark:text-gray-300 focus:ring-2 focus:ring-primary-500 focus:border-transparent"
            >
              <option value="">所有年份</option>
              {years.map(year => (
                <option key={year} value={year}>{year}</option>
              ))}
            </select>

            {/* Journal Filter */}
            <select
              value={filters.journal}
              onChange={(e) => setFilters(prev => ({ ...prev, journal: e.target.value }))}
              className="px-3 py-1.5 bg-gray-100 dark:bg-gray-800 border border-gray-300 dark:border-gray-600 rounded text-sm text-gray-700 dark:text-gray-300 focus:ring-2 focus:ring-primary-500 focus:border-transparent max-w-[200px]"
            >
              <option value="">所有期刊</option>
              {journals.map(journal => (
                <option key={journal} value={journal}>{journal}</option>
              ))}
            </select>

            {/* Tag Filter */}
            <select
              value={filters.tag}
              onChange={(e) => setFilters(prev => ({ ...prev, tag: e.target.value }))}
              className="px-3 py-1.5 bg-gray-100 dark:bg-gray-800 border border-gray-300 dark:border-gray-600 rounded text-sm text-gray-700 dark:text-gray-300 focus:ring-2 focus:ring-primary-500 focus:border-transparent"
            >
              <option value="">所有标签</option>
              {tags.map(tag => (
                <option key={tag.id} value={tag.id}>{tag.name}</option>
              ))}
            </select>

            {/* Favorites Toggle */}
            <button
              onClick={() => setFilters(prev => ({ ...prev, favoritesOnly: !prev.favoritesOnly }))}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded text-sm transition-colors ${
                filters.favoritesOnly
                  ? 'bg-yellow-100 dark:bg-yellow-900/30 text-yellow-700 dark:text-yellow-300 border border-yellow-300'
                  : 'bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-400 border border-transparent hover:bg-gray-200 dark:hover:bg-gray-700'
              }`}
            >
              <Star className={`w-3.5 h-3.5 ${filters.favoritesOnly ? 'fill-current' : ''}`} />
              仅收藏
            </button>

            {/* Archive Toggle */}
            <button
              onClick={() => setFilters(prev => ({ ...prev, excludeArchived: !prev.excludeArchived }))}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded text-sm transition-colors ${
                filters.excludeArchived
                  ? 'bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-gray-300'
                  : 'bg-gray-100 dark:bg-gray-800 text-gray-500 dark:text-gray-400'
              }`}
            >
              <Archive className="w-3.5 h-3.5" />
              {filters.excludeArchived ? '隐藏归档' : '显示归档'}
            </button>
          </div>

          {/* Results Count */}
          {hasActiveFilters && (
            <div className="mt-2 text-xs text-gray-500 dark:text-gray-400">
              找到 {searchResults.length} 篇论文
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default SearchBar;
