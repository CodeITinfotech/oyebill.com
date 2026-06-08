import { useState, useEffect } from 'react';
import { useDataStore } from '../../stores/dataStore';
import { PageHeader } from '../../components/layout';
import { Button, Input, Select, Toggle, Table, Modal, toast } from '../../components/ui';
import { Plus, Pencil, Trash2, Users } from 'lucide-react';
import type { Table as TableType } from '../../types';

export function TablesPage() {
  const { tables, sections, fetchTables, fetchSections, createTable, updateTable, deleteTable } = useDataStore();
  const [showModal, setShowModal] = useState(false);
  const [editingTable, setEditingTable] = useState<TableType | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [filterSection, setFilterSection] = useState('');

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

  const filteredTables = tables;

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
      isActive: formData.isActive,
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

  const handleDelete = async (table: TableType) => {
    const confirmed = window.confirm(`Are you sure you want to delete Table ${table.number}?`);
    if (confirmed) {
      const success = await deleteTable(table.id);
      if (success) {
        toast('success', `Table ${table.number} deleted successfully`);
        fetchTables(filterSection || undefined);
      } else {
        toast('error', 'Failed to delete table');
      }
    }
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'available':
        return <span className="badge-success badge">Available</span>;
      case 'occupied':
        return <span className="badge-warning badge">Occupied</span>;
      case 'reserved':
        return <span className="badge-info badge">Reserved</span>;
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
            onClick={(e) => { e.stopPropagation(); handleDelete(t); }}
            className="p-1.5 hover:bg-error/20 rounded-lg transition-colors bg-error/10"
            title="Delete"
          >
            <Trash2 className="w-4 h-4 text-error" />
          </button>
        </div>
      )
    },
  ];

  return (
    <div>
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

      {/* Filter */}
      <div className="card p-4 mb-6">
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

      {/* Visual Grid View */}
      <div className="card p-6 mb-6">
        <h3 className="text-sm font-medium text-text-secondary mb-4">Visual Layout</h3>
        <div className="grid grid-cols-8 sm:grid-cols-10 md:grid-cols-12 lg:grid-cols-16 gap-1">
          {filteredTables.map((table) => {
            const isAvailable = table.status === 'available';
            const isPendingCleaning = table.status === 'pending_cleaning';
            const isOccupied = table.status === 'occupied' || (table.status !== 'available' && table.status !== 'pending_cleaning' && table.hasCurrentOrder);
            const isPendingPrint = table.status === 'pending_printing' || table.status === 'billing';
            
            // Status colors - same as BillingPage
            let statusColor = 'bg-success'; // Green - Available
            let statusBgClass = 'border-success/30 bg-success/5 hover:border-success';
            
            if (isPendingCleaning) {
              statusColor = 'bg-red-900'; // Maroon - Pending Cleaning
              statusBgClass = 'border-red-900/50 bg-red-900/10 hover:border-red-900 cursor-pointer';
            } else if (isPendingPrint) {
              statusColor = 'bg-red-500'; // Red - Pending Printing
              statusBgClass = 'border-red-500/50 bg-red-500/10 hover:border-red-500';
            } else if (isOccupied) {
              statusColor = 'bg-orange-500'; // Orange - Occupied (Before KOT)
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
                {/* Status indicator dot below table */}
                <span className={`absolute bottom-0.5 w-2 h-2 rounded-full ${statusColor}`} title={
                  isAvailable ? 'Available' : 
                  isPendingCleaning ? 'Pending Cleaning' :
                  isPendingPrint ? 'Pending Printing' :
                  'Occupied (Before KOT)'
                } />
              </button>
            );
          })}
        </div>
        {/* Legend - same as BillingPage */}
        <div className="flex flex-wrap gap-4 mt-3 text-xs text-text-muted">
          <div className="flex items-center gap-1">
            <span className="w-2 h-2 rounded-full bg-success"></span>
            <span>Available</span>
          </div>
          <div className="flex items-center gap-1">
            <span className="w-2 h-2 rounded-full bg-orange-500"></span>
            <span>Occupied (Before KOT)</span>
          </div>
          <div className="flex items-center gap-1">
            <span className="w-2 h-2 rounded-full bg-red-500"></span>
            <span>Pending Printing</span>
          </div>
          <div className="flex items-center gap-1">
            <span className="w-2 h-2 rounded-full bg-red-900"></span>
            <span>Pending Cleaning</span>
          </div>
        </div>
      </div>

      {/* Table View */}
      <Table
        columns={columns}
        data={filteredTables}
        emptyMessage="No tables found. Add tables to start taking orders."
        loading={false}
        onRowClick={(table) => handleOpenModal(table)}
      />

      {/* Modal */}
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
                  handleDelete(editingTable);
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
  );
}