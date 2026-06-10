import { useState, useEffect } from 'react';
import { useDataStore } from '../../stores/dataStore';
import { PageHeader } from '../../components/layout';
import { Button, Input, Select, Toggle, Table, Modal, toast } from '../../components/ui';
import { ConfirmModal } from '../../components/ui/ConfirmModal';
import { Plus, Pencil, Trash2, Users, Search } from 'lucide-react';
import type { Table as TableType } from '../../types';

export function TablesPage() {
  const { tables, sections, fetchTables, fetchSections, createTable, updateTable, deleteTable } = useDataStore();
  const [showModal, setShowModal] = useState(false);
  const [editingTable, setEditingTable] = useState<TableType | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [filterSection, setFilterSection] = useState('');
  const [searchTerm, setSearchTerm] = useState('');
  const [deleteConfirm, setDeleteConfirm] = useState<{ table: TableType | null; loading: boolean }>({ table: null, loading: false });

  const [formData, setFormData] = useState({
    number: '',
    sectionId: '',
    capacity: '4',
    isActive: true,
  });

  useEffect(() => {
    fetchTables(filterSection || undefined);
    fetchSections();
  }, [filterSection, sections]);

  const filteredTables = tables.filter(t => {
    if (searchTerm) {
      const search = searchTerm.toLowerCase();
      return t.number.toLowerCase().includes(search) ||
        t.sectionName?.toLowerCase().includes(search);
    }
    return true;
  });

  const handleOpenModal = (table?: TableType) => {
    if (table) {
      setEditingTable(table);
      setFormData({
        number: table.number,
        sectionId: table.sectionId,
        capacity: String(table.capacity),
        isActive: true,
      });
    } else {
      setEditingTable(null);
      setFormData({
        number: '',
        sectionId: filterSection || '',
        capacity: '4',
        isActive: true,
      });
    }
    setShowModal(true);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);

    // Validate sectionId
    if (!formData.sectionId) {
      toast('error', 'Please select a section');
      setIsSubmitting(false);
      return;
    }

    const tableData = {
      number: formData.number,
      sectionId: formData.sectionId,
      capacity: parseInt(formData.capacity) || 4,
    };

    let success = false;
    if (editingTable) {
      success = await updateTable(editingTable.id, tableData);
    } else {
      success = await createTable(tableData);
    }

    setIsSubmitting(false);

    if (success) {
      toast('success', editingTable ? 'Table updated successfully' : 'Table created successfully');
      setShowModal(false);
      fetchTables(filterSection || undefined);
    } else {
      toast('error', 'Failed to save table');
    }
  };

  const handleDelete = async () => {
    if (!deleteConfirm.table) return;
    const table = deleteConfirm.table;
    setDeleteConfirm(prev => ({ ...prev, loading: true }));
    
    try {
      const success = await deleteTable(table.id);
      if (success) {
        toast('success', `Deleted all orders for Table ${table.number}`);
        fetchTables(filterSection || undefined);
      } else {
        toast('error', 'Failed to delete table orders');
      }
    } catch (e) {
      toast('error', 'Failed to delete table orders');
    } finally {
      setDeleteConfirm({ table: null, loading: false });
    }
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'available':
        return <span className="badge-success badge">Available</span>;
      case 'active_kot':
        return <span className="badge-warning badge">Active KOT</span>;
      case 'pending_billing':
        return <span className="badge-error badge">Pending Billing</span>;
      case 'pending_cleaning':
        return <span className="badge-secondary badge">Pending Cleaning</span>;
      default:
        return <span className="badge-default badge">{status}</span>;
    }
  };

  const columns = [
    { key: 'number', label: 'Table No.' },
    { key: 'sectionName', label: 'Section' },
    { key: 'capacity', label: 'Capacity', render: (t: TableType) => (
      <div className="flex items-center gap-1">
        <Users className="w-4 h-4 text-text-muted" />
        <span>{t.capacity}</span>
      </div>
    )},
    { key: 'status', label: 'Status', render: (t: TableType) => getStatusBadge(t.status) },
    { key: 'actions', label: 'Actions', className: 'w-32',
      render: (t: TableType) => (
        <div className="flex gap-2">
          <button 
            onClick={(e) => { e.stopPropagation(); handleOpenModal(t); }}
            className="p-1.5 hover:bg-accent/20 rounded-lg transition-colors bg-accent/10"
            title="Edit"
          >
            <Pencil className="w-4 h-4 text-accent" />
          </button>
          <button 
            onClick={(e) => { e.stopPropagation(); setDeleteConfirm({ table: t, loading: false }); }}
            className="p-1.5 hover:bg-error/20 rounded-lg transition-colors bg-error/10"
            title="Delete Orders"
          >
            <Trash2 className="w-4 h-4 text-error" />
          </button>
        </div>
      )
    },
  ];

  return (
    <div className="relative">
      {/* Mobile Header */}
      <div className="lg:hidden p-4 border-b border-white/10">
        <h1 className="text-xl font-bold text-center mb-3">Tables</h1>
        <div className="flex gap-2">
          <div className="flex-1 relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-text-muted" />
            <input
              type="text"
              placeholder="Search tables..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-10 pr-3 py-2 bg-background-secondary border border-white/10 rounded-lg text-sm text-text-primary placeholder-text-muted"
            />
          </div>
        </div>
        <select
          value={filterSection}
          onChange={(e) => setFilterSection(e.target.value)}
          className="w-full mt-2 px-3 py-2 bg-background-secondary border border-white/10 rounded-lg text-sm text-text-primary"
        >
          <option value="">All Sections</option>
          {sections.filter(s => s.isActive).map(s => (
            <option key={s.id} value={s.id}>{s.name}</option>
          ))}
        </select>
      </div>

      {/* Desktop Header */}
      <div className="hidden lg:block">
        <PageHeader
          title="Tables"
          subtitle="Manage restaurant tables and seating"
          actions={
            <Button onClick={() => handleOpenModal()}>
              <Plus className="w-4 h-4" />
              Add Table
            </Button>
          }
        />
      </div>

      {/* Desktop Filter */}
      <div className="hidden lg:block card p-4 mb-6">
        <div className="flex flex-col sm:flex-row gap-4 items-end">
          <div className="flex-1">
            <Select
              label="Filter by Section"
              options={[
                { value: '', label: 'All Sections' },
                ...sections.filter(s => s.isActive).map(s => ({ value: s.id, label: s.name }))
              ]}
              value={filterSection}
              onChange={(e) => setFilterSection(e.target.value)}
            />
          </div>
        </div>
      </div>

      {/* Desktop Visual Grid View */}
      <div className="hidden lg:block card p-6 mb-6">
        <h3 className="text-sm font-medium text-text-secondary mb-4">Visual Layout</h3>
        <div className="grid grid-cols-8 sm:grid-cols-10 md:grid-cols-12 lg:grid-cols-16 gap-1">
          {filteredTables.map((table) => {
            const isAvailable = table.status === 'available';
            const isActiveKot = table.status === 'active_kot';
            const isPendingBilling = table.status === 'pending_billing';
            const isPendingCleaning = table.status === 'pending_cleaning';
            
            let statusColor = 'bg-success';
            let statusBgClass = 'border-success/30 bg-success/5 hover:border-success';
            
            if (isPendingCleaning) {
              statusColor = 'bg-gray-500';
              statusBgClass = 'border-gray-500/50 bg-gray-500/10 hover:border-gray-500 cursor-pointer';
            } else if (isPendingBilling) {
              statusColor = 'bg-red-500';
              statusBgClass = 'border-red-500/50 bg-red-500/10 hover:border-red-500';
            } else if (isActiveKot) {
              statusColor = 'bg-orange-500';
              statusBgClass = 'border-orange-500/50 bg-orange-500/10 hover:border-orange-500';
            }
            
            return (
              <button
                key={table.id}
                onClick={() => handleOpenModal(table)}
                className={`h-16 rounded-lg border-2 flex flex-col items-center justify-center transition-all hover:scale-105 relative px-1 ${statusBgClass}`}
              >
                <span className="text-lg font-bold leading-tight">{table.number}</span>
                <span className="text-[7px] text-text-muted">{table.capacity}</span>
                <span className={`absolute bottom-0.5 w-2 h-2 rounded-full ${statusColor}`} />
              </button>
            );
          })}
        </div>
        <div className="flex flex-wrap gap-4 mt-3 text-xs text-text-muted">
          <div className="flex items-center gap-1">
            <span className="w-2 h-2 rounded-full bg-success"></span>
            <span>Available</span>
          </div>
          <div className="flex items-center gap-1">
            <span className="w-2 h-2 rounded-full bg-orange-500"></span>
            <span>Active KOT</span>
          </div>
          <div className="flex items-center gap-1">
            <span className="w-2 h-2 rounded-full bg-red-500"></span>
            <span>Pending Billing</span>
          </div>
          <div className="flex items-center gap-1">
            <span className="w-2 h-2 rounded-full bg-gray-500"></span>
            <span>Pending Cleaning</span>
          </div>
        </div>
      </div>

      {/* Desktop Table View */}
      <div className="hidden lg:block">
        <Table
          columns={columns}
          data={filteredTables}
          emptyMessage="No tables found. Add tables to start taking orders."
          loading={false}
          onRowClick={(table) => handleOpenModal(table)}
        />
      </div>

      {/* Mobile Tables List */}
      <div className="lg:hidden p-4 space-y-3">
        {(!filteredTables || filteredTables.length === 0) ? (
          <div className="text-center py-12 text-text-muted">
            <p>No tables found</p>
          </div>
        ) : (
          filteredTables.map((table) => {
            const getStatusBadge = (status: string) => {
              switch (status) {
                case 'available':
                  return <span className="px-2 py-0.5 rounded-full text-xs bg-success/20 text-success">Available</span>;
                case 'active_kot':
                  return <span className="px-2 py-0.5 rounded-full text-xs bg-orange-500/20 text-orange-400">Active KOT</span>;
                case 'pending_billing':
                  return <span className="px-2 py-0.5 rounded-full text-xs bg-red-500/20 text-red-400">Pending Billing</span>;
                case 'pending_cleaning':
                  return <span className="px-2 py-0.5 rounded-full text-xs bg-gray-500/20 text-gray-400">Pending Cleaning</span>;
                default:
                  return <span className="px-2 py-0.5 rounded-full text-xs bg-gray-500/20 text-gray-400">{status}</span>;
              }
            };
            
            return (
              <div key={table.id} className="bg-background-secondary rounded-lg border border-white/10 overflow-hidden">
                <div className="p-3">
                  <div className="flex items-start justify-between mb-2">
                    <div>
                      <h3 className="font-bold text-lg text-text-primary">T-{table.number}</h3>
                      <p className="text-xs text-text-muted">{table.sectionName || 'No Section'}</p>
                    </div>
                    {getStatusBadge(table.status)}
                  </div>
                  <div className="flex items-center justify-between mt-2">
                    <div className="flex items-center gap-1 text-sm text-text-secondary">
                      <Users className="w-4 h-4" />
                      <span>{table.capacity} seats</span>
                    </div>
                    <div className="flex gap-2">
                      <button 
                        onClick={() => handleOpenModal(table)}
                        className="p-2 hover:bg-accent/20 rounded-lg transition-colors"
                      >
                        <Pencil className="w-4 h-4 text-accent" />
                      </button>
                      <button 
                        onClick={() => setDeleteConfirm({ table, loading: false })}
                        className="p-2 hover:bg-error/20 rounded-lg transition-colors"
                      >
                        <Trash2 className="w-4 h-4 text-error" />
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            );
          })
        )}
      </div>

      {/* Floating Add Button - Mobile Only */}
      <button
        onClick={() => handleOpenModal()}
        className="lg:hidden fixed bottom-6 right-6 w-14 h-14 bg-accent hover:bg-accent/80 text-white rounded-full shadow-lg flex items-center justify-center z-40 transition-all active:scale-95"
      >
        <Plus className="w-6 h-6" />
      </button>

      {/* Desktop Modal */}
      <div className="hidden lg:block">
        <Modal
          isOpen={showModal}
          onClose={() => setShowModal(false)}
          title={editingTable ? `Edit Table ${editingTable.number}` : 'Add Table'}
        >
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <Input
                label="Table Number *"
                value={formData.number}
                onChange={(e) => setFormData({ ...formData, number: e.target.value })}
                placeholder="e.g., 1, 2A, VIP-3"
                required
              />
              <Input
                label="Capacity *"
                type="number"
                min="1"
                max="50"
                value={formData.capacity}
                onChange={(e) => setFormData({ ...formData, capacity: e.target.value })}
                required
              />
            </div>

            <Select
              label="Section *"
              options={sections.filter(s => s.isActive).map(s => ({ value: s.id, label: s.name }))}
              value={formData.sectionId}
              onChange={(e) => setFormData({ ...formData, sectionId: e.target.value })}
              placeholder="Select section"
              required
            />

            <Toggle
              checked={formData.isActive}
              onChange={(checked) => setFormData({ ...formData, isActive: checked })}
              label="Active"
            />

            <div className="flex gap-3 pt-4">
              {editingTable && (
                <Button
                  type="button"
                  variant="danger"
                  onClick={() => {
                    setShowModal(false);
                    setDeleteConfirm({ table: editingTable, loading: false });
                  }}
                >
                  <Trash2 className="w-4 h-4" />
                </Button>
              )}
              <Button type="button" variant="ghost" className="flex-1" onClick={() => setShowModal(false)}>
                Cancel
              </Button>
              <Button type="submit" variant="primary" className="flex-1" loading={isSubmitting}>
                {editingTable ? 'Update Table' : 'Add Table'}
              </Button>
            </div>
          </form>
        </Modal>
      </div>

      {/* Mobile Table Modal - Bottom Sheet */}
      {showModal && (
        <div className="lg:hidden fixed inset-0 z-50 bg-black/60">
          <div className="absolute inset-0" onClick={() => setShowModal(false)} />
          <div className="absolute bottom-0 w-full bg-background-primary rounded-t-3xl max-h-[90vh] overflow-y-auto">
            {/* Header */}
            <div className="sticky top-0 bg-background-primary border-b border-white/10 p-4 flex items-center justify-between z-10">
              <h2 className="text-lg font-semibold">{editingTable ? `Edit Table ${editingTable.number}` : 'Add Table'}</h2>
              <button onClick={() => setShowModal(false)} className="p-2 hover:bg-white/10 rounded-full">
                <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
            
            {/* Form Content */}
            <form onSubmit={handleSubmit} className="p-4 space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-text-secondary mb-1.5">Table Number *</label>
                  <input
                    type="text"
                    value={formData.number}
                    onChange={(e) => setFormData({ ...formData, number: e.target.value })}
                    placeholder="e.g., 1, 2A, VIP-3"
                    className="w-full px-3 py-2.5 bg-background-secondary border border-white/10 rounded-lg text-text-primary placeholder-text-muted focus:outline-none focus:border-accent"
                    required
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-text-secondary mb-1.5">Capacity *</label>
                  <input
                    type="number"
                    min="1"
                    max="50"
                    value={formData.capacity}
                    onChange={(e) => setFormData({ ...formData, capacity: e.target.value })}
                    className="w-full px-3 py-2.5 bg-background-secondary border border-white/10 rounded-lg text-text-primary placeholder-text-muted focus:outline-none focus:border-accent"
                    required
                  />
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-text-secondary mb-1.5">Section *</label>
                <select
                  value={formData.sectionId}
                  onChange={(e) => setFormData({ ...formData, sectionId: e.target.value })}
                  className="w-full px-3 py-2.5 bg-background-secondary border border-white/10 rounded-lg text-text-primary focus:outline-none focus:border-accent"
                  required
                >
                  <option value="">Select section</option>
                  {sections.filter(s => s.isActive).map(s => (
                    <option key={s.id} value={s.id}>{s.name}</option>
                  ))}
                </select>
              </div>
              <div className="flex items-center gap-2">
                <input
                  type="checkbox"
                  id="isActiveToggleMobile"
                  checked={formData.isActive}
                  onChange={(e) => setFormData({ ...formData, isActive: e.target.checked })}
                  className="w-5 h-5 rounded border-white/20 bg-background-secondary text-accent focus:ring-accent"
                />
                <label htmlFor="isActiveToggleMobile" className="text-sm text-text-secondary cursor-pointer">
                  Active
                </label>
              </div>

              {/* Action Buttons */}
              <div className="flex gap-3 pt-2 pb-4">
                {editingTable && (
                  <button
                    type="button"
                    onClick={() => {
                      setShowModal(false);
                      setDeleteConfirm({ table: editingTable, loading: false });
                    }}
                    className="px-4 py-3 bg-error/20 hover:bg-error/30 text-error font-medium rounded-lg transition-colors"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                )}
                <button
                  type="button"
                  onClick={() => setShowModal(false)}
                  className="px-6 py-3 bg-background-secondary hover:bg-white/10 text-text-primary font-medium rounded-lg transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="flex-1 py-3 bg-accent hover:bg-accent/80 text-white font-medium rounded-lg transition-colors disabled:opacity-50"
                >
                  {isSubmitting ? 'Saving...' : (editingTable ? 'Update Table' : 'Add Table')}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Delete Confirmation Modal */}
      <ConfirmModal
        isOpen={deleteConfirm.table !== null}
        onClose={() => setDeleteConfirm({ table: null, loading: false })}
        onConfirm={handleDelete}
        title="⚠️ Delete Table Orders?"
        message={`This will delete all KOTs and bills for Table ${deleteConfirm.table?.number}. The table will be set to available status. This action cannot be undone.`}
        confirmText="Delete Orders"
        variant="danger"
        loading={deleteConfirm.loading}
      />
    </div>
  );
}