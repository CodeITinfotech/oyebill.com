import { useState, useEffect } from 'react';
import { Layout } from '../../components/layout';
import { Card, CardHeader, CardTitle, CardBody } from '../../components/ui/Card';
import { Button } from '../../components/ui/Button';
import { api } from '../../api';
import { CheckCircle, AlertCircle, Loader2 } from 'lucide-react';

interface PendingTable {
  id: string;
  number: string;
  sectionId: string;
  sectionName: string;
  capacity: number;
  status: string;
}

export default function BusserPage() {
  const [tables, setTables] = useState<PendingTable[]>([]);
  const [loading, setLoading] = useState(true);
  const [processingId, setProcessingId] = useState<string | null>(null);
  const [notification, setNotification] = useState<{ type: 'success' | 'error'; message: string } | null>(null);

  const fetchPendingTables = async () => {
    try {
      setLoading(true);
      const response = await api.get('/tables/pending-cleaning');
      setTables(response.data || []);
    } catch (error) {
      console.error('Failed to fetch pending tables:', error);
      setNotification({ type: 'error', message: 'Failed to fetch pending tables' });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchPendingTables();
    // Poll for updates every 30 seconds
    const interval = setInterval(fetchPendingTables, 30000);
    return () => clearInterval(interval);
  }, []);

  const handleMarkCleaned = async (tableId: string) => {
    try {
      setProcessingId(tableId);
      await api.put(`/tables/${tableId}/mark-cleaned`);
      setNotification({ type: 'success', message: 'Table marked as cleaned successfully!' });
      // Remove from local list
      setTables(tables.filter(t => t.id !== tableId));
    } catch (error: any) {
      console.error('Failed to mark table as cleaned:', error);
      setNotification({ 
        type: 'error', 
        message: error?.response?.data?.error || 'Failed to mark table as cleaned' 
      });
    } finally {
      setProcessingId(null);
    }
  };

  // Clear notification after 3 seconds
  useEffect(() => {
    if (notification) {
      const timer = setTimeout(() => setNotification(null), 3000);
      return () => clearTimeout(timer);
    }
  }, [notification]);

  return (
    <Layout>
      <div className="p-6">
        {/* Header */}
        <div className="mb-6">
          <h1 className="text-2xl font-display font-bold gradient-text">Busser Tasks</h1>
          <p className="text-text-secondary mt-1">Tables pending cleaning after billing</p>
        </div>

        {/* Notification */}
        {notification && (
          <div className={`mb-4 p-4 rounded-lg flex items-center gap-3 ${
            notification.type === 'success' 
              ? 'bg-success/20 text-success border border-success/30' 
              : 'bg-error/20 text-error border border-error/30'
          }`}>
            {notification.type === 'success' ? (
              <CheckCircle className="w-5 h-5 flex-shrink-0" />
            ) : (
              <AlertCircle className="w-5 h-5 flex-shrink-0" />
            )}
            <span>{notification.message}</span>
          </div>
        )}

        {/* Stats */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
          <Card variant="accent">
            <CardBody className="text-center">
              <div className="text-4xl font-bold">{tables.length}</div>
              <div className="text-sm text-text-secondary mt-1">Tables Pending</div>
            </CardBody>
          </Card>
        </div>

        {/* Tables Grid */}
        {loading ? (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="w-8 h-8 text-accent animate-spin" />
          </div>
        ) : tables.length === 0 ? (
          <Card>
            <CardBody className="text-center py-12">
              <CheckCircle className="w-16 h-16 text-success mx-auto mb-4" />
              <h3 className="text-lg font-semibold mb-2">All Clean!</h3>
              <p className="text-text-secondary">
                No tables pending cleaning. Great job!
              </p>
            </CardBody>
          </Card>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {tables.map((table) => (
              <Card key={table.id} className="relative overflow-hidden">
                <div className="absolute top-0 right-0 w-24 h-24 bg-gradient-to-bl from-warning/20 to-transparent rounded-bl-full" />
                <CardBody>
                  <div className="flex items-start justify-between mb-4">
                    <div>
                      <h3 className="text-2xl font-bold">{table.number}</h3>
                      <p className="text-sm text-text-secondary">{table.sectionName}</p>
                    </div>
                    <div className="px-3 py-1 bg-warning/20 text-warning rounded-full text-xs font-medium">
                      Pending Clean
                    </div>
                  </div>

                  <div className="flex items-center gap-2 text-sm text-text-secondary mb-4">
                    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
                    </svg>
                    <span>Capacity: {table.capacity}</span>
                  </div>

                  <Button
                    onClick={() => handleMarkCleaned(table.id)}
                    disabled={processingId === table.id}
                    loading={processingId === table.id}
                    variant="success"
                    className="w-full"
                  >
                    <CheckCircle className="w-4 h-4 mr-2" />
                    {processingId === table.id ? 'Marking...' : 'Mark as Cleaned'}
                  </Button>
                </CardBody>
              </Card>
            ))}
          </div>
        )}

        {/* Refresh Button */}
        <div className="mt-6 text-center">
          <Button onClick={fetchPendingTables} variant="secondary">
            Refresh List
          </Button>
        </div>
      </div>
    </Layout>
  );
}