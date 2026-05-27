import { useState, useEffect } from 'react';
import { useDataStore } from '../../stores/dataStore';
import { PageHeader } from '../../components/layout';
import { Button, Input, Select, Textarea, Toggle, Table, Modal, toast } from '../../components/ui';
import { Plus, Pencil, Trash2, Search, ToggleLeft, ToggleRight } from 'lucide-react';
import type { Product } from '../../types';

const TAX_RATES = [
  { value: '0', label: '0%' },
  { value: '5', label: '5%' },
  { value: '12', label: '12%' },
  { value: '18', label: '18%' },
  { value: '28', label: '28%' },
];

export function ProductsPage() {
  const { products, categories, sections, settings, fetchProducts, fetchCategories, fetchSections, fetchSettings, createProduct, updateProduct, deleteProduct } = useDataStore();
  const [searchTerm, setSearchTerm] = useState('');
  const [filterCategory, setFilterCategory] = useState('');
  const [filterSection, setFilterSection] = useState('');
  const [showModal, setShowModal] = useState(false);
  const [editingProduct, setEditingProduct] = useState<Product | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const [formData, setFormData] = useState({
    name: '',
    categoryId: '',
    description: '',
    sellingPrice: '',
    mrp: '',
    taxRate: '18',
    isActive: true,
    enableOnline: false,
    sectionPrices: [] as { sectionId: string; price: string }[],
  });

  useEffect(() => {
    fetchProducts();
    fetchCategories();
    fetchSections();
    fetchSettings();
  }, []);

  // Set default tax rate from settings when modal opens
  useEffect(() => {
    if (showModal && settings?.defaultTaxRate && !editingProduct) {
      setFormData(prev => ({ ...prev, taxRate: String(settings.defaultTaxRate) }));
    }
  }, [showModal, settings, editingProduct]);

  // Re-initialize section prices when sections load
  useEffect(() => {
    if (sections.length > 0 && formData.sectionPrices.length === 0 && showModal) {
      const sectionPrices = sections.map(s => ({ sectionId: s.id, price: '' }));
      setFormData(prev => ({ ...prev, sectionPrices }));
    }
  }, [sections, showModal]);

  const filteredProducts = products.filter((p) => {
    const matchesSearch = p.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      p.description?.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesCategory = !filterCategory || p.categoryId === filterCategory;
    const matchesSection = !filterSection || filterSection === 'all' || 
      (p.sectionPrices && p.sectionPrices.some(sp => sp.sectionId === filterSection));
    return matchesSearch && matchesCategory && matchesSection;
  });

  const handleOpenModal = (product?: Product) => {
    if (product) {
      setEditingProduct(product);
      const sectionPrices = sections.map(s => {
        const existing = product.sectionPrices?.find(sp => sp.sectionId === s.id);
        return { sectionId: s.id, price: existing ? String(existing.price) : '' };
      });
      setFormData({
        name: product.name,
        categoryId: product.categoryId,
        description: product.description || '',
        sellingPrice: String(product.sellingPrice),
        mrp: String(product.mrp),
        taxRate: String(product.taxRate),
        isActive: product.isActive,
        enableOnline: product.enableOnline,
        sectionPrices,
      });
    } else {
      setEditingProduct(null);
      const sectionPrices = sections.map(s => ({ sectionId: s.id, price: '' }));
      setFormData({
        name: '',
        categoryId: '',
        description: '',
        sellingPrice: '',
        mrp: '',
        taxRate: '18',
        isActive: true,
        enableOnline: false,
        sectionPrices,
      });
    }
    setShowModal(true);
  };

  const handleSectionPriceChange = (sectionId: string, price: string) => {
    setFormData({
      ...formData,
      sectionPrices: formData.sectionPrices.map(sp => 
        sp.sectionId === sectionId ? { ...sp, price } : sp
      ),
    });
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);

    const sectionPrices = formData.sectionPrices
      .filter(sp => sp.price && parseFloat(sp.price) > 0)
      .map(sp => ({ sectionId: sp.sectionId, price: parseFloat(sp.price) }));

    const productData = {
      name: formData.name,
      categoryId: formData.categoryId,
      description: formData.description,
      sellingPrice: parseFloat(formData.sellingPrice),
      mrp: parseFloat(formData.mrp) || 0,
      taxRate: parseFloat(formData.taxRate),
      isActive: formData.isActive,
      enableOnline: formData.enableOnline,
      sectionPrices,
    };

    let success = false;
    if (editingProduct) {
      success = await updateProduct(editingProduct.id, productData);
    } else {
      success = await createProduct(productData);
    }

    setIsSubmitting(false);

    if (success) {
      toast('success', editingProduct ? 'Product updated successfully' : 'Product created successfully');
      setShowModal(false);
    } else {
      toast('error', 'Failed to save product');
    }
  };

  const handleDelete = async (product: Product) => {
    if (window.confirm(`Are you sure you want to delete Product "${product.name}"?`)) {
      await deleteProduct(product.id);
    }
  };

  const getDisplayPrice = (product: Product, sectionId?: string) => {
    if (sectionId && sectionId !== 'all' && product.sectionPrices) {
      const sectionPrice = product.sectionPrices.find(sp => sp.sectionId === sectionId);
      if (sectionPrice) return sectionPrice.price;
    }
    return product.sellingPrice;
  };

  const columns = [
    { key: 'name' as const, label: 'Product Name' },
    { key: 'categoryName' as const, label: 'Category' },
    { key: 'sellingPrice' as const, label: filterSection && filterSection !== 'all' ? 'Section Price' : 'Selling Price', 
      render: (p: Product) => <span className="price">₹{(p.sellingPrice || 0).toFixed(2)}</span> },
    { key: 'mrp' as const, label: 'MRP', render: (p: Product) => <span className="font-mono">₹{(p.mrp || 0).toFixed(2)}</span> },
    { key: 'taxRate' as const, label: 'Tax', render: (p: Product) => <span className="badge-info badge">{p.taxRate || 0}%</span> },
    { key: 'isActive' as const, label: 'Status', render: (p: Product) => (
      <span className={p.isActive ? 'badge-success badge' : 'badge-error badge'}>
        {p.isActive ? 'Active' : 'Inactive'}
      </span>
    )},
    { key: 'actions' as const, label: 'Actions', className: 'w-24',
      render: (p: Product) => (
        <div className="flex gap-2">
          <button 
            onClick={(e) => { e.stopPropagation(); handleOpenModal(p); }}
            className="p-1 hover:bg-accent/20 rounded transition-colors"
            title="Edit"
          >
            <Pencil className="w-4 h-4 text-accent" />
          </button>
          <button 
            onClick={(e) => { e.preventDefault(); e.stopPropagation(); handleDelete(p); }}
            className="p-1 hover:bg-error/20 rounded transition-colors"
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
        title="Products"
        subtitle="Manage your restaurant menu items"
        actions={
          <Button onClick={() => handleOpenModal()}>
            <Plus className="w-4 h-4" />
            Add Product
          </Button>
        }
      />

      {/* Filters */}
      <div className="card p-4 mb-6">
        <div className="flex flex-col sm:flex-row gap-4">
          <div className="flex-1 relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-text-muted" />
            <input
              type="text"
              placeholder="Search products..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="input pl-10"
            />
          </div>
          <div className="w-full sm:w-48">
            <Select
              options={[
                { value: '', label: 'All Categories' },
                ...categories.filter(c => c.isActive).map(c => ({ value: c.id, label: c.name }))
              ]}
              value={filterCategory}
              onChange={(e) => setFilterCategory(e.target.value)}
            />
          </div>
          <div className="w-full sm:w-48">
            <Select
              options={[
                { value: 'all', label: 'All Sections' },
                ...sections.filter(s => s.isActive).map(s => ({ value: s.id, label: s.name }))
              ]}
              value={filterSection}
              onChange={(e) => setFilterSection(e.target.value)}
            />
          </div>
        </div>
      </div>

      {/* Table */}
      <Table
        columns={columns}
        data={filteredProducts}
        emptyMessage="No products found. Add your first product to get started."
        loading={false}
        onRowClick={(product) => handleOpenModal(product)}
      />

      {/* Modal */}
      <Modal
        isOpen={showModal}
        onClose={() => setShowModal(false)}
        title={editingProduct ? 'Edit Product' : 'Add Product'}
        size="lg"
      >
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <Input
              label="Product Name *"
              value={formData.name}
              onChange={(e) => setFormData({ ...formData, name: e.target.value })}
              required
            />
            <Select
              label="Category *"
              options={categories.filter(c => c.isActive).map(c => ({ value: c.id, label: c.name }))}
              value={formData.categoryId}
              onChange={(e) => setFormData({ ...formData, categoryId: e.target.value })}
              placeholder="Select category"
              required
            />
          </div>

          <Textarea
            label="Description"
            value={formData.description}
            onChange={(e) => setFormData({ ...formData, description: e.target.value })}
            placeholder="Product description..."
          />

          <div className="grid grid-cols-3 gap-4">
            <Input
              label="Selling Price *"
              type="number"
              step="0.01"
              value={formData.sellingPrice}
              onChange={(e) => setFormData({ ...formData, sellingPrice: e.target.value })}
              required
            />
            <Input
              label="MRP"
              type="number"
              step="0.01"
              value={formData.mrp}
              onChange={(e) => setFormData({ ...formData, mrp: e.target.value })}
            />
            <Select
              label="GST/Tax Rate *"
              options={TAX_RATES}
              value={formData.taxRate}
              onChange={(e) => setFormData({ ...formData, taxRate: e.target.value })}
            />
          </div>

          {/* Section-wise Pricing */}
          {sections.length > 0 && sections.some(s => s.isActive) && (
            <div className="border-t border-white/10 pt-4 mt-4">
              <h4 className="font-medium mb-3">Section-wise Pricing</h4>
              <p className="text-sm text-text-muted mb-3">Set different prices for each section (optional)</p>
              <div className="grid grid-cols-2 gap-3">
                {sections.filter(s => s.isActive).map((section) => {
                  const sectionPrice = formData.sectionPrices.find(sp => sp.sectionId === section.id);
                  return (
                    <div key={section.id} className="flex items-center gap-3 p-3 rounded-lg bg-white/5">
                      <label className="text-sm font-medium w-28 truncate">{section.name}</label>
                      <div className="flex-1 relative">
                        <span className="absolute left-3 top-1/2 -translate-y-1/2 text-text-muted">₹</span>
                        <input
                          type="number"
                          step="0.01"
                          value={sectionPrice?.price || ''}
                          onChange={(e) => handleSectionPriceChange(section.id, e.target.value)}
                          placeholder={formData.sellingPrice || '0.00'}
                          className="input pl-7 w-full"
                        />
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          <div className="flex gap-6">
            <Toggle
              checked={formData.isActive}
              onChange={(checked) => setFormData({ ...formData, isActive: checked })}
              label="Active"
            />
            <Toggle
              checked={formData.enableOnline}
              onChange={(checked) => setFormData({ ...formData, enableOnline: checked })}
              label="Enable Online Ordering"
            />
          </div>

          <div className="flex gap-3 pt-4">
            <Button type="button" variant="ghost" className="flex-1" onClick={() => setShowModal(false)}>
              Cancel
            </Button>
            <Button type="submit" variant="primary" className="flex-1" loading={isSubmitting}>
              {editingProduct ? 'Update Product' : 'Add Product'}
            </Button>
          </div>
        </form>
      </Modal>
    </div>
  );
}