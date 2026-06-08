import { useState, useEffect } from 'react';
import { useDataStore } from '../../stores/dataStore';
import { PageHeader } from '../../components/layout';
import { Button, Input, Textarea, Table, Modal, toast } from '../../components/ui';
import { Plus, Pencil, Trash2 } from 'lucide-react';
import type { Category } from '../../types';
import { clsx } from 'clsx';

export function CategoriesPage() {
  const { categories, products, fetchCategories, fetchProducts, createCategory, updateCategory, deleteCategory } = useDataStore();
  const [showModal, setShowModal] = useState(false);
  const [editingCategory, setEditingCategory] = useState<Category | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [refreshKey, setRefreshKey] = useState(0);

  const [formData, setFormData] = useState({
    name: '',
    description: '',
    isActive: true,
  });

  useEffect(() => {
    fetchCategories();
    fetchProducts();
  }, [refreshKey]);

  const getProductCount = (categoryId: string) => {
    return products.filter(p => p.categoryId === categoryId).length;
  };

  const handleOpenModal = (category?: Category) => {
    if (category) {
      setEditingCategory(category);
      setFormData({
        name: category.name,
        description: category.description || '',
        isActive: category.isActive,
      });
    } else {
      setEditingCategory(null);
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
    if (editingCategory) {
      success = await updateCategory(editingCategory.id, formData);
    } else {
      success = await createCategory(formData);
    }

    setIsSubmitting(false);

    if (success) {
      toast('success', editingCategory ? 'Category updated successfully' : 'Category created successfully');
      setShowModal(false);
      setRefreshKey(k => k + 1);
    } else {
      toast('error', 'Failed to save category');
    }
  };

  const handleDelete = async (category: Category) => {
    const productCount = getProductCount(category.id);
    if (productCount > 0) {
      toast('error', `Cannot delete "${category.name}". It has ${productCount} associated product(s).`);
      return;
    }
    const confirmed = window.confirm(`Are you sure you want to delete Category "${category.name}"?`);
    if (confirmed) {
      const success = await deleteCategory(category.id);
      if (success) {
        toast('success', `Category "${category.name}" deleted successfully`);
        setRefreshKey(k => k + 1);
      } else {
        toast('error', 'Failed to delete category.');
      }
    }
  };

  const handleToggleStatus = async (category: Category) => {
    
    const newStatus = !category.isActive;
    const result = await updateCategory(category.id, {
      name: category.name,
      description: category.description,
      isActive: newStatus
    });
    if (result) {
      toast('success', `Category ${newStatus ? 'activated' : 'deactivated'}`);
      setRefreshKey(k => k + 1);
    } else {
      toast('error', 'Failed to update category status');
    }
  };

  const columns = [
    { key: 'name', label: 'Category Name' },
    { key: 'description', label: 'Description' },
    { key: 'productCount', label: 'Products', render: (c: Category) => (
      <span className="badge-accent badge">{getProductCount(c.id)}</span>
    )},
    { 
      key: 'isActive', 
      label: 'Status', 
      render: (c: Category) => (
        <button
          onClick={(e) => { 
            e.preventDefault();
            e.stopPropagation(); 
            handleToggleStatus(c); 
          }}
          className={clsx(
            'relative inline-flex h-6 w-11 items-center rounded-full transition-colors cursor-pointer',
            c.isActive ? 'bg-primary' : 'bg-gray-300'
          )}
          type="button"
        >
          <span 
            className={clsx(
              'inline-block h-4 w-4 transform rounded-full bg-white transition-transform shadow-sm',
              c.isActive ? 'translate-x-6' : 'translate-x-1'
            )} 
          />
        </button>
      )
    },
    { 
      key: 'actions', 
      label: 'Actions', 
      className: 'w-24',
      render: (c: Category) => (
        <div className="flex gap-2">
          <button 
            onClick={(e) => { e.stopPropagation(); handleOpenModal(c); }}
            className="p-1 hover:bg-accent/20 rounded transition-colors"
            title="Edit"
          >
            <Pencil className="w-4 h-4 text-accent" />
          </button>
          <button 
            onClick={(e) => { e.stopPropagation(); handleDelete(c); }}
            className={clsx(
              'p-1 rounded transition-colors',
              getProductCount(c.id) > 0 ? 'opacity-50 cursor-not-allowed' : 'hover:bg-error/20'
            )}
            title={getProductCount(c.id) > 0 ? 'Cannot delete - has products' : 'Delete'}
            disabled={getProductCount(c.id) > 0}
          >
            <Trash2 className={clsx(
              'w-4 h-4',
              getProductCount(c.id) > 0 ? 'text-text-muted' : 'text-error'
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
        <h1 className="text-xl font-bold text-center">Categories</h1>
      </div>

      {/* Desktop Header */}
      <div className="hidden lg:block">
        <PageHeader
          title="Categories"
          subtitle="Organize your products into categories"
          actions={
            <Button onClick={() => handleOpenModal()}>
              <Plus className="w-4 h-4" />
              Add Category
            </Button>
          }
        />
      </div>

      {/* Desktop Table */}
      <div className="hidden lg:block">
        <Table
          columns={columns}
          data={categories}
          emptyMessage="No categories found. Create your first category to organize products."
          loading={false}
        />
      </div>

      {/* Mobile Categories List */}
      <div className="lg:hidden p-4 space-y-3">
        {categories.length === 0 ? (
          <div className="text-center py-12 text-text-muted">
            <p>No categories found</p>
          </div>
        ) : (
          categories.map((category) => (
            <div key={category.id} className="bg-background-secondary rounded-lg border border-white/10 overflow-hidden">
              <div className="p-3">
                <div className="flex items-center justify-between mb-2">
                  <h3 className="font-medium text-text-primary">{category.name}</h3>
                  <span className="text-xs px-2 py-0.5 bg-accent/20 text-accent rounded-full">
                    {getProductCount(category.id)} items
                  </span>
                </div>
                {category.description && (
                  <p className="text-xs text-text-muted mb-3">{category.description}</p>
                )}
                <div className="flex items-center justify-between">
                  {/* Status Toggle */}
                  <button
                    onClick={() => handleToggleStatus(category)}
                    className={clsx(
                      'relative inline-flex h-6 w-11 items-center rounded-full transition-colors cursor-pointer',
                      category.isActive ? 'bg-primary' : 'bg-gray-300'
                    )}
                  >
                    <span 
                      className={clsx(
                        'inline-block h-4 w-4 transform rounded-full bg-white transition-transform shadow-sm',
                        category.isActive ? 'translate-x-6' : 'translate-x-1'
                      )} 
                    />
                  </button>
                  {/* Actions */}
                  <div className="flex gap-2">
                    <button 
                      onClick={() => handleOpenModal(category)}
                      className="p-2 hover:bg-accent/20 rounded-lg transition-colors"
                    >
                      <Pencil className="w-4 h-4 text-accent" />
                    </button>
                    <button 
                      onClick={() => handleDelete(category)}
                      className={clsx(
                        'p-2 rounded-lg transition-colors',
                        getProductCount(category.id) > 0 ? 'opacity-50 cursor-not-allowed' : 'hover:bg-error/20'
                      )}
                      disabled={getProductCount(category.id) > 0}
                    >
                      <Trash2 className={clsx(
                        'w-4 h-4',
                        getProductCount(category.id) > 0 ? 'text-text-muted' : 'text-error'
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

      {/* Modal */}
      <Modal
        isOpen={showModal}
        onClose={() => setShowModal(false)}
        title={editingCategory ? 'Edit Category' : 'Add Category'}
      >
        <form onSubmit={handleSubmit} className="space-y-4">
          <Input
            label="Category Name *"
            value={formData.name}
            onChange={(e) => setFormData({ ...formData, name: e.target.value })}
            placeholder="e.g., Starters, Main Course, Beverages"
            required
          />

          <Textarea
            label="Description"
            value={formData.description}
            onChange={(e) => setFormData({ ...formData, description: e.target.value })}
            placeholder="Brief description of this category..."
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
              Active (visible to users)
            </label>
          </div>

          <div className="flex gap-3 pt-4">
            <Button type="button" variant="ghost" className="flex-1" onClick={() => setShowModal(false)}>
              Cancel
            </Button>
            <Button type="submit" variant="primary" className="flex-1" loading={isSubmitting}>
              {editingCategory ? 'Update Category' : 'Add Category'}
            </Button>
          </div>
        </form>
      </Modal>
    </div>
  );
}
