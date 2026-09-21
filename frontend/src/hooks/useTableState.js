import { useState, useMemo, useEffect } from 'react';

/**
 * Custom hook to handle client-side Search, Multi-Filter, Sorting, and Pagination seamlessly.
 *
 * @param {Array} items - Raw dataset from API
 * @param {Object} config - Configuration options:
 *   - searchFields: Array of string keys to search against (e.g. ['full_name', 'patient_code', 'phone'])
 *   - defaultSort: string key for initial sorting (e.g. 'newest', 'name_asc')
 *   - sortFunctions: Map of sortKey -> comparison function `(a, b) => number`
 *   - filterFunctions: Map of filterKey -> `(item, filterValue) => boolean`
 *   - initialPageSize: number (default: 10)
 */
export function useTableState(items = [], config = {}) {
  const {
    searchFields = [],
    defaultSort = 'default',
    sortFunctions = {},
    filterFunctions = {},
    initialPageSize = 10
  } = config;

  const [search, setSearch] = useState('');
  const [filters, setFilters] = useState({});
  const [sortKey, setSortKey] = useState(defaultSort);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(initialPageSize);

  // Filter & Search
  const filteredItems = useMemo(() => {
    if (!Array.isArray(items)) return [];

    return items.filter((item) => {
      // 1. Search Query Filter
      if (search && search.trim()) {
        const query = search.toLowerCase().trim();
        const matchesSearch = searchFields.some((field) => {
          // Nested property support (e.g. 'doctor.full_name')
          const val = field.split('.').reduce((acc, part) => acc && acc[part], item);
          if (val === null || val === undefined) return false;
          return String(val).toLowerCase().includes(query);
        });
        if (!matchesSearch) return false;
      }

      // 2. Custom Filters
      for (const [filterKey, filterValue] of Object.entries(filters)) {
        if (
          filterValue !== undefined &&
          filterValue !== null &&
          filterValue !== '' &&
          filterValue !== 'ALL' &&
          filterValue !== 'All Departments' &&
          filterValue !== 'All Doctors' &&
          filterValue !== 'All Statuses'
        ) {
          const fn = filterFunctions[filterKey];
          if (fn) {
            if (!fn(item, filterValue)) return false;
          } else {
            // Default exact/case-insensitive equality match
            const itemVal = item[filterKey];
            if (itemVal === undefined || itemVal === null) return false;
            if (String(itemVal).toLowerCase() !== String(filterValue).toLowerCase()) {
              return false;
            }
          }
        }
      }

      return true;
    });
  }, [items, search, filters, searchFields, filterFunctions]);

  // Sort Filtered Items
  const sortedItems = useMemo(() => {
    const list = [...filteredItems];
    const sortFn = sortFunctions[sortKey];
    if (sortFn) {
      list.sort(sortFn);
    }
    return list;
  }, [filteredItems, sortKey, sortFunctions]);

  // Reset page to 1 whenever search, filters, or sorted items change in length
  useEffect(() => {
    setPage(1);
  }, [search, filters, sortKey, pageSize]);

  // Total pages
  const totalItems = sortedItems.length;
  const totalPages = Math.max(1, Math.ceil(totalItems / pageSize));

  // Current page boundary safety
  const safePage = Math.min(Math.max(1, page), totalPages);

  // Paginated slice
  const paginatedItems = useMemo(() => {
    const start = (safePage - 1) * pageSize;
    return sortedItems.slice(start, start + pageSize);
  }, [sortedItems, safePage, pageSize]);

  const activeFilterCount = useMemo(() => {
    return Object.values(filters).filter(
      (v) =>
        v !== undefined &&
        v !== null &&
        v !== '' &&
        v !== 'ALL' &&
        v !== 'All Departments' &&
        v !== 'All Doctors' &&
        v !== 'All Statuses'
    ).length;
  }, [filters]);

  const clearFilters = () => {
    setFilters({});
    setSearch('');
  };

  return {
    search,
    setSearch,
    filters,
    setFilters,
    setFilter: (key, val) => setFilters((prev) => ({ ...prev, [key]: val })),
    clearFilters,
    activeFilterCount,
    sortKey,
    setSortKey,
    page: safePage,
    setPage,
    pageSize,
    setPageSize,
    totalItems,
    totalPages,
    paginatedItems,
    allSortedItems: sortedItems
  };
}
