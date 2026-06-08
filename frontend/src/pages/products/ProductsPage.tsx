import { useState, useEffect } from 'react';
import { useDataStore } from '../../stores/dataStore';
import { PageHeader } from '../../components/layout';
import { Button, Input, Select, Textarea, Toggle, Table, Modal, toast } from '../../components/ui';
import { Plus, Pencil, Trash2, Search, ToggleLeft, ToggleRight, Settings, X } from 'lucide-react';
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
  const [showMobileFilters, setShowMobileFilters] = useState(false);

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

  useEffect(() => {
    if (showModal && settings?.defaultTaxRate && !editingProduct) {
      setFormData(prev => ({ ...prev, taxRate: String(settings.defaultTaxRate) }));
    }
  }, [showModal, settings, editingProduct]);

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

  const getCategoryName = (categoryId: string) => {
    const cat = categories.find(c => c.id === categoryId);
    return cat?.name || 'Uncategorized';
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
    <div className="relative">
      {/* Mobile Header */}
      <div className="lg:hidden p-4 border-b border-white/10">
        <h1 className="text-xl font-bold text-center">Products</h1>
        {/* Mobile Search */}
        <div className="flex gap-2 mt-3">
          <div className="flex-1 relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-text-muted" />
            <input
              type="text"
              placeholder="Search products..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-10 pr-3 py-2 bg-background-secondary border border-white/10 rounded-lg text-sm text-text-primary placeholder-text-muted"
            />
          </div>
          <button
            onClick={() => setShowMobileFilters(!showMobileFilters)}
            className={`p-2 rounded-lg ${showMobileFilters ? 'bg-accent text-white' : 'bg-background-secondary text-text-secondary'}`}
          >
            <Settings className="w-5 h-5" />
          </button>
        </div>

        {/* Mobile Filters */}
        {showMobileFilters && (
          <div className="mt-3 p-3 bg-background-secondary rounded-lg space-y-2">
            <select
              value={filterCategory}
              onChange={(e) => setFilterCategory(e.target.value)}
              className="w-full px-3 py-2 bg-background-primary border border-white/10 rounded-lg text-sm text-text-primary"
            >
              <option value="">All Categories</option>
              {categories.filter(c => c.isActive).map(c => (
                <option key={c.id} value={c.id}>{c.name}</option>
              ))}
            </select>
            <select
              value={filterSection}
              onChange={(e) => setFilterSection(e.target.value)}
              className="w-full px-3 py-2 bg-background-primary border border-white/10 rounded-lg text-sm text-text-primary"
            >
              <option value="all">All Sections</option>
              {sections.filter(s => s.isActive).map(s => (
                <option key={s.id} value={s.id}>{s.name}</option>
              ))}
            </select>
          </div>
        )}
      </div>

      {/* Desktop Header */}
      <div className="hidden lg:block">
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
      </div>

      {/* Desktop Filters */}
      <div className="hidden lg:block card p-4 mb-6">
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

      {/* Desktop Table */}
      <div className="hidden lg:block">
        <Table
          columns={columns}
          data={filteredProducts}
          emptyMessage="No products found. Add your first product to get started."
          loading={false}
          onRowClick={(product) => handleOpenModal(product)}
        />
      </div>

      {/* Mobile Product Grid */}
      <div className="lg:hidden p-4">
        {filteredProducts.length === 0 ? (
          <div className="text-center py-12 text-text-muted">
            <p>No products found</p>
          </div>
        ) : (
          <div className="grid grid-cols-2 gap-3">
            {filteredProducts.map((product) => (
              <div
                key={product.id}
                onClick={() => handleOpenModal(product)}
                className={`bg-background-secondary rounded-lg border overflow-hidden ${
                  product.isActive ? 'border-white/10' : 'border-error/30'
                }`}
              >
                <div className="p-3">
                  <div className="w-full aspect-square bg-gradient-to-br from-accent/20 to-primary/20 rounded-lg mb-2 flex items-center justify-center">
                    <span className="text-3xl">🍽️</span>
                  </div>
                  <h3 className="font-medium text-sm truncate">{product.name}</h3>
                  <p className="text-xs text-text-muted truncate">{getCategoryName(product.categoryId)}</p>
                  <p className="text-accent font-bold mt-1">₹{product.sellingPrice}</p>
                </div>
                <div className="flex border-t border-white/10">
                  <button
                    onClick={(e) => { e.stopPropagation(); handleOpenModal(product); }}
                    className="flex-1 py-2 text-center text-xs text-accent hover:bg-accent/10 transition-colors"
                  >
                    Edit
                  </button>
                  <button
                    onClick={(e) => { e.stopPropagation(); handleDelete(product); }}
                    className="flex-1 py-2 text-center text-xs text-error hover:bg-error/10 transition-colors border-l border-white/10"
                  >
                    Delete
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Floating Add Button - Mobile Only */}
      <button
        onClick={() => handleOpenModal()}
        className="lg:hidden fixed bottom-6 right-6 w-14 h-14 bg-accent hover:bg-accent/80 text-white rounded-full shadow-lg flex items-center justify-center z-40 transition-all active:scale-95"
      >
        <Plus className="w-6 h-6" />
      </button>

      {/* Desktop Add Button */}
      <div className="hidden lg:block fixed bottom-6 right-6">
        <Button onClick={() => handleOpenModal()}>
          <Plus className="w-4 h-4" />
          Add Product
        </Button>
      </div>

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