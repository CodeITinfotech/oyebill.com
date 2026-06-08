import { useState, useEffect } from 'react';
import { useDataStore } from '../../stores/dataStore';
import { PageHeader } from '../../components/layout';
import { Button, Input, Textarea, Table, Modal, toast } from '../../components/ui';
import { Plus, Pencil, Trash2 } from 'lucide-react';
import type { Section } from '../../types';
import { clsx } from 'clsx';

export function SectionsPage() {
  const { sections, tables, fetchSections, fetchTables, createSection, updateSection, deleteSection } = useDataStore();
  const [showModal, setShowModal] = useState(false);
  const [editingSection, setEditingSection] = useState<Section | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [refreshKey, setRefreshKey] = useState(0);

  const [formData, setFormData] = useState({
    name: '',
    description: '',
    isActive: true,
  });

  useEffect(() => {
    fetchSections();
    fetchTables();
  }, [refreshKey]);

  const getTableCount = (sectionId: string) => {
    return tables.filter(t => t.sectionId === sectionId).length;
  };

  const handleOpenModal = (section?: Section) => {
    if (section) {
      setEditingSection(section);
      setFormData({
        name: section.name,
        description: section.description || '',
        isActive: section.isActive,
      });
    } else {
      setEditingSection(null);
      setFormData({
        name: '',
        description: '',
        isActive: true,
      });
    }
    setShowModal(true);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);

    let success = false;
    if (editingSection) {
      success = await updateSection(editingSection.id, formData);
    } else {
      success = await createSection(formData);
    }

    setIsSubmitting(false);

    if (success) {
      toast('success', editingSection ? 'Section updated successfully' : 'Section created successfully');
      setShowModal(false);
      setRefreshKey(k => k + 1);
    } else {
      toast('error', 'Failed to save section');
    }
  };

  const handleDelete = async (section: Section) => {
    const tableCount = getTableCount(section.id);
    if (tableCount > 0) {
      toast('error', `Cannot delete "${section.name}". It has ${tableCount} associated table(s).`);
      return;
    }
    const confirmed = window.confirm(`Are you sure you want to delete Section "${section.name}"?`);
    if (confirmed) {
      const success = await deleteSection(section.id);
      if (success) {
        toast('success', `Section "${section.name}" deleted successfully`);
        setRefreshKey(k => k + 1);
      } else {
        toast('error', 'Failed to delete section.');
      }
    }
  };

  const handleToggleStatus = async (section: Section) => {
    const newStatus = !section.isActive;
    const success = await updateSection(section.id, {
      name: section.name,
      description: section.description,
      isActive: newStatus
    });
    if (success) {
      toast('success', `Section ${newStatus ? 'activated' : 'deactivated'}`);
      setRefreshKey(k => k + 1);
    } else {
      toast('error', 'Failed to update section status');
    }
  };

  const columns = [
    { key: 'name', label: 'Section Name' },
    { key: 'description', label: 'Description' },
    { key: 'tableCount', label: 'Tables', render: (s: Section) => (
      <span className="badge-info badge">{getTableCount(s.id)}</span>
    )},
    { 
      key: 'isActive', 
      label: 'Status', 
      render: (s: Section) => (
        <button
          onClick={(e) => { e.preventDefault(); e.stopPropagation(); handleToggleStatus(s); }}
          className={clsx(
            'relative inline-flex h-6 w-11 items-center rounded-full transition-colors cursor-pointer',
            s.isActive ? 'bg-primary' : 'bg-gray-300'
          )}
          type="button"
        >
          <span 
            className={clsx(
              'inline-block h-4 w-4 transform rounded-full bg-white transition-transform shadow-sm',
              s.isActive ? 'translate-x-6' : 'translate-x-1'
            )} 
          />
        </button>
      )
    },
    { 
      key: 'actions', 
      label: 'Actions', 
      className: 'w-24',
      render: (s: Section) => (
        <div className="flex gap-2">
          <button 
            onClick={(e) => { e.stopPropagation(); handleOpenModal(s); }}
            className="p-1 hover:bg-accent/20 rounded transition-colors"
            title="Edit"
          >
            <Pencil className="w-4 h-4 text-accent" />
          </button>
          <button 
            onClick={(e) => { e.stopPropagation(); handleDelete(s); }}
            className={clsx(
              'p-1 rounded transition-colors',
              getTableCount(s.id) > 0 ? 'opacity-50 cursor-not-allowed' : 'hover:bg-error/20'
            )}
            title={getTableCount(s.id) > 0 ? 'Cannot delete - has tables' : 'Delete'}
            disabled={getTableCount(s.id) > 0}
          >
            <Trash2 className={clsx(
              'w-4 h-4',
              getTableCount(s.id) > 0 ? 'text-text-muted' : 'text-error'
            )} />
          </button>
        </div>
      )
    },
  ];

  return (
    <div key={refreshKey} className="relative">
      {/* Mobile Header */}
      <div className="lg:hidden p-4 border-b border-white/10">
        <h1 className="text-xl font-bold text-center">Sections</h1>
      </div>

      {/* Desktop Header */}
      <div className="hidden lg:block">
        <PageHeader
          title="Sections"
          subtitle="Organize tables into sections (e.g., AC Hall, Outdoor, Bar)"
          actions={
            <Button onClick={() => handleOpenModal()}>
              <Plus className="w-4 h-4" />
              Add Section
            </Button>
          }
        />
      </div>

      {/* Desktop Table */}
      <div className="hidden lg:block">
        <Table
          columns={columns}
          data={sections}
          emptyMessage="No sections found. Create sections to organize your tables."
          loading={false}
        />
      </div>

      {/* Mobile Sections List */}
      <div className="lg:hidden p-4 space-y-3">
        {sections.length === 0 ? (
          <div className="text-center py-12 text-text-muted">
            <p>No sections found</p>
          </div>
        ) : (
          sections.map((section) => (
            <div key={section.id} className="bg-background-secondary rounded-lg border border-white/10 overflow-hidden">
              <div className="p-3">
                <div className="flex items-center justify-between mb-2">
                  <h3 className="font-medium text-text-primary">{section.name}</h3>
                  <span className="text-xs px-2 py-0.5 bg-info/20 text-info rounded-full">
                    {getTableCount(section.id)} tables
                  </span>
                </div>
                {section.description && (
                  <p className="text-xs text-text-muted mb-3">{section.description}</p>
                )}
                <div className="flex items-center justify-between">
                  {/* Status Toggle */}
                  <button
                    onClick={() => handleToggleStatus(section)}
                    className={clsx(
                      'relative inline-flex h-6 w-11 items-center rounded-full transition-colors cursor-pointer',
                      section.isActive ? 'bg-primary' : 'bg-gray-300'
                    )}
                  >
                    <span 
                      className={clsx(
                        'inline-block h-4 w-4 transform rounded-full bg-white transition-transform shadow-sm',
                        section.isActive ? 'translate-x-6' : 'translate-x-1'
                      )} 
                    />
                  </button>
                  {/* Actions */}
                  <div className="flex gap-2">
                    <button 
                      onClick={() => handleOpenModal(section)}
                      className="p-2 hover:bg-accent/20 rounded-lg transition-colors"
                    >
                      <Pencil className="w-4 h-4 text-accent" />
                    </button>
                    <button 
                      onClick={() => handleDelete(section)}
                      className={clsx(
                        'p-2 rounded-lg transition-colors',
                        getTableCount(section.id) > 0 ? 'opacity-50 cursor-not-allowed' : 'hover:bg-error/20'
                      )}
                      disabled={getTableCount(section.id) > 0}
                    >
                      <Trash2 className={clsx(
                        'w-4 h-4',
                        getTableCount(section.id) > 0 ? 'text-text-muted' : 'text-error'
                      )} />
                    </button>
                  </div>
                </div>
              </div>
            </div>
          ))
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
          title={editingSection ? 'Edit Section' : 'Add Section'}
        >
          <form onSubmit={handleSubmit} className="space-y-4">
            <Input
              label="Section Name *"
              value={formData.name}
              onChange={(e) => setFormData({ ...formData, name: e.target.value })}
              placeholder="e.g., AC Hall, Outdoor, Bar, VIP"
              required
            />

            <Textarea
              label="Description"
              value={formData.description}
              onChange={(e) => setFormData({ ...formData, description: e.target.value })}
              placeholder="Brief description of this section..."
            />

            <div className="flex items-center gap-2">
              <input
                type="checkbox"
                id="isActiveToggle"
                checked={formData.isActive}
                onChange={(e) => setFormData({ ...formData, isActive: e.target.checked })}
                className="w-5 h-5"
              />
              <label htmlFor="isActiveToggle" className="text-sm text-text-secondary cursor-pointer">
                Active
              </label>
            </div>

            <div className="flex gap-3 pt-4">
              <Button type="button" variant="ghost" className="flex-1" onClick={() => setShowModal(false)}>
                Cancel
              </Button>
              <Button type="submit" variant="primary" className="flex-1" loading={isSubmitting}>
                {editingSection ? 'Update Section' : 'Add Section'}
              </Button>
            </div>
          </form>
        </Modal>
      </div>

      {/* Mobile Section Modal - Bottom Sheet */}
      {showModal && (
        <div className="lg:hidden fixed inset-0 z-50 bg-black/60">
          <div className="absolute inset-0" onClick={() => setShowModal(false)} />
          <div className="absolute bottom-0 w-full bg-background-primary rounded-t-3xl max-h-[90vh] overflow-y-auto">
            {/* Header */}
            <div className="sticky top-0 bg-background-primary border-b border-white/10 p-4 flex items-center justify-between z-10">
              <h2 className="text-lg font-semibold">{editingSection ? 'Edit Section' : 'Add Section'}</h2>
              <button onClick={() => setShowModal(false)} className="p-2 hover:bg-white/10 rounded-full">
                <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
            
            {/* Form Content */}
            <form onSubmit={handleSubmit} className="p-4 space-y-4">
              <div>
                <label className="block text-sm font-medium text-text-secondary mb-1.5">Section Name *</label>
                <input
                  type="text"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  placeholder="e.g., AC Hall, Outdoor, Bar, VIP"
                  className="w-full px-3 py-2.5 bg-background-secondary border border-white/10 rounded-lg text-text-primary placeholder-text-muted focus:outline-none focus:border-accent"
                  required
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-text-secondary mb-1.5">Description</label>
                <textarea
                  value={formData.description}
                  onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                  placeholder="Brief description of this section..."
                  rows={3}
                  className="w-full px-3 py-2.5 bg-background-secondary border border-white/10 rounded-lg text-text-primary placeholder-text-muted focus:outline-none focus:border-accent resize-none"
                />
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
                  {isSubmitting ? 'Saving...' : (editingSection ? 'Update Section' : 'Add Section')}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
