import { useState, useEffect } from 'react';
import { api } from '../../api';
import { toast } from '../../components/ui/Toast';

interface PendingTable {
  id: string;
  number: string;
  sectionId: string;
  sectionName: string;
  capacity: number;
  status: string;
  lastBillTime?: string;
  clearedBy?: string;
}

export default function BusserPage() {
  const [tables, setTables] = useState<PendingTable[]>([]);
  const [loading, setLoading] = useState(true);
  const [processingId, setProcessingId] = useState<string | null>(null);

  const fetchPendingTables = async () => {
    try {
      setLoading(true);
      const response = await api.get('/tables/pending-cleaning');
      const apiData = response.data?.data || response.data;
      setTables(Array.isArray(apiData) ? apiData : []);
    } catch (error) {
      console.error('Failed to fetch pending tables:', error);
      toast('error', 'Failed to fetch pending tables');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchPendingTables();
    const interval = setInterval(fetchPendingTables, 30000);
    return () => clearInterval(interval);
  }, []);

  const handleMarkCleaned = async (tableId: string) => {
    try {
      setProcessingId(tableId);
      const response = await api.put(`/tables/${tableId}/mark-cleaned`);
      if (response.success) {
        setTables(tables.filter(t => t.id !== tableId));
        toast('success', 'Table marked as cleaned!');
      }
    } catch (error: any) {
      console.error('Failed to mark table as cleaned:', error);
      toast('error', error?.response?.data?.error || 'Failed to mark table as cleaned');
    } finally {
      setProcessingId(null);
    }
  };

  const getTimeSince = (dateStr?: string) => {
    if (!dateStr) return 'Unknown';
    const mins = Math.floor((Date.now() - new Date(dateStr).getTime()) / 60000);
    if (mins < 1) return 'Just now';
    if (mins < 60) return `${mins}m ago`;
    return `${Math.floor(mins / 60)}h ${mins % 60}m ago`;
  };

  return (
    <div className="h-full flex flex-col">
      {/* Header */}
      <div className="p-4 border-b border-white/10">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-xl font-bold">Busser Tasks</h1>
            <p className="text-sm text-text-muted">Tables need cleaning</p>
          </div>
          <div className="flex items-center gap-3">
            <span className="text-sm text-text-muted">
              {new Date().toLocaleDateString('en-US', { weekday: 'long', month: 'short', day: 'numeric' })}
            </span>
          </div>
        </div>

        {/* Stats Bar */}
        <div className="flex gap-4 mt-4 overflow-x-auto pb-2">
          <div className="px-4 py-2 bg-orange-500/10 border border-orange-500/20 rounded-lg flex items-center gap-3">
            <p className="text-2xl font-bold text-orange-400">{(tables || []).length}</p>
            <p className="text-sm text-text-muted">Pending</p>
          </div>
          <div className="px-4 py-2 bg-background-secondary rounded-lg flex items-center gap-3">
            <p className="text-2xl font-bold text-text-primary">
              {(tables || []).reduce((sum, t) => sum + t.capacity, 0)}
            </p>
            <p className="text-sm text-text-muted">Total Seats</p>
          </div>
        </div>
      </div>

      {/* Tables Grid */}
      <div className="flex-1 overflow-y-auto p-4">
        {loading ? (
          <div className="flex items-center justify-center h-64">
            <div className="animate-spin w-8 h-8 border-4 border-accent border-t-transparent rounded-full" />
          </div>
        ) : (!tables || tables.length === 0) ? (
          <div className="flex flex-col items-center justify-center h-64">
            <div className="w-20 h-20 bg-green-500/20 rounded-full flex items-center justify-center mb-4">
              <svg className="w-10 h-10 text-green-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
              </svg>
            </div>
            <p className="text-lg font-medium text-text-primary">All Clean!</p>
            <p className="text-sm text-text-muted">No tables pending cleaning</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3">
            {tables.map((table) => (
              <div
                key={table.id}
                className="bg-background-secondary rounded-lg border border-orange-500/30 overflow-hidden"
              >
                {/* Table Header */}
                <div className="p-3 bg-gradient-to-r from-orange-500/10 to-transparent">
                  <div className="flex items-center justify-between gap-2">
                    <div className="flex items-center gap-2 min-w-0 flex-1">
                      <div className="w-10 h-10 bg-orange-500/20 rounded-lg flex items-center justify-center shrink-0">
                        <span className="text-sm font-bold text-orange-400" style={{ fontSize: '0.9375rem' }}>{table.number}</span>
                      </div>
                      <div className="flex items-center gap-1.5 min-w-0 flex-1">
                        <span className="text-sm font-medium text-text-primary truncate">{table.sectionName || 'Main Hall'}</span>
                        <span className="text-text-muted text-xs shrink-0">•</span>
                        <span className="text-xs text-text-muted shrink-0 flex items-center gap-0.5">
                          <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z" />
                          </svg>
                          {table.capacity}
                        </span>
                      </div>
                    </div>
                    <div className="px-2 py-1 bg-orange-500/20 rounded-full shrink-0">
                      <span className="text-xs font-medium text-orange-400">Cleaning</span>
                    </div>
                  </div>
                </div>

                {/* Table Info */}
                <div className="p-3 space-y-3">
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-text-muted">Waiting: {getTimeSince(table.lastBillTime)}</span>
                    <span className="px-2 py-0.5 bg-orange-500/20 text-orange-400 rounded text-xs">Pending</span>
                  </div>

                  <button
                    onClick={() => handleMarkCleaned(table.id)}
                    disabled={processingId === table.id}
                    className="w-full py-2.5 bg-green-600 hover:bg-green-700 disabled:bg-green-800 disabled:opacity-50 text-white text-sm font-medium rounded-lg flex items-center justify-center gap-2 transition-colors"
                  >
                    {processingId === table.id ? (
                      <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                    ) : (
                      <>
                        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                        </svg>
                        Mark Cleaned
                      </>
                    )}
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Refresh FAB */}
      <div className="p-4 border-t border-white/10">
        <button
          onClick={fetchPendingTables}
          className="w-full py-3 bg-background-secondary hover:bg-background-tertiary text-text-primary text-sm font-medium rounded-lg flex items-center justify-center gap-2 transition-colors"
        >
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
          </svg>
          Refresh
        </button>
      </div>
    </div>
  );
}