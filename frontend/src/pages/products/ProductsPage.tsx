import { useState, useEffect } from 'react';
import { useDataStore } from '../../stores/dataStore';
import { PageHeader } from '../../components/layout';
import { Button, Input, Select, Textarea, Toggle, Table, Modal, toast } from '../../components/ui';
import { Plus, Pencil, Trash2, Search, ToggleLeft, ToggleRight, Settings, X } from 'lucide-react';
import type { Product } from '../../types';
import { PRODUCT_ICONS } from '../../types';

const TAX_RATES = [
  { value: '0', label: '0%' },
  { value: '5', label: '5%' },
  { value: '12', label: '12%' },
  { value: '18', label: '18%' },
  { value: '28', label: '28%' },
];

export function ProductsPage() {
  const { products, categories, sections, settings, fetchProducts, fetchCategories, fetchSections, fetchSettings, createProduct, updateProduct, deleteProduct, createCategory } = useDataStore();
  const [searchTerm, setSearchTerm] = useState('');
  const [filterCategory, setFilterCategory] = useState('');
  const [filterSection, setFilterSection] = useState('');
  const [showModal, setShowModal] = useState(false);
  const [editingProduct, setEditingProduct] = useState<Product | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [showMobileFilters, setShowMobileFilters] = useState(false);
  
  // Quick add category state
  const [showQuickAddCategory, setShowQuickAddCategory] = useState(false);
  const [newCategoryName, setNewCategoryName] = useState('');
  const [isAddingCategory, setIsAddingCategory] = useState(false);

  const [formData, setFormData] = useState({
    name: '',
    categoryId: '',
    description: '',
    sellingPrice: '',
    mrp: '',
    taxRate: '18',
    isActive: true,
    enableOnline: false,
    icon: '🍽️',
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
        icon: product.icon || '🍽️',
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
      icon: formData.icon,
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
                    <span className="text-3xl">{product.icon || '🍽️'}</span>
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

      {/* Desktop Modal */}
      <div className="hidden lg:block">
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

            {/* Icon Picker */}
            <div>
              <label className="block text-sm font-medium text-text-secondary mb-2">Icon</label>
              <div className="flex flex-wrap gap-1.5 p-2 bg-background-secondary rounded-lg border border-white/10 max-h-32 overflow-y-auto">
                {PRODUCT_ICONS.map((icon) => (
                  <button
                    key={icon}
                    type="button"
                    onClick={() => setFormData({ ...formData, icon })}
                    className={`w-8 h-8 text-lg rounded flex items-center justify-center transition-all ${
                      formData.icon === icon
                        ? 'bg-accent ring-2 ring-accent'
                        : 'bg-background-tertiary hover:bg-white/10'
                    }`}
                  >
                    {icon}
                  </button>
                ))}
              </div>
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
                {editingProduct ? 'Update' : 'Add Product'}
              </Button>
            </div>
          </form>
        </Modal>
      </div>

      {/* Mobile Product Modal - Bottom Sheet */}
      {showModal && (
        <div className="lg:hidden fixed inset-0 z-50 bg-black/60">
          <div className="absolute inset-0" onClick={() => setShowModal(false)} />
          <div className="absolute bottom-0 w-full bg-background-primary rounded-t-3xl max-h-[90vh] overflow-y-auto">
            {/* Header */}
            <div className="sticky top-0 bg-background-primary border-b border-white/10 p-4 flex items-center justify-between z-10">
              <h2 className="text-lg font-semibold">{editingProduct ? 'Edit Product' : 'Add Product'}</h2>
              <button onClick={() => setShowModal(false)} className="p-2 hover:bg-white/10 rounded-full">
                <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
            
            {/* Form Content */}
            <form onSubmit={handleSubmit} className="p-4 space-y-4">
              <div>
                <label className="block text-sm font-medium text-text-secondary mb-1.5">Product Name *</label>
                <input
                  type="text"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  placeholder="Enter product name"
                  className="w-full px-3 py-2.5 bg-background-secondary border border-white/10 rounded-lg text-text-primary placeholder-text-muted focus:outline-none focus:border-accent"
                  required
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-text-secondary mb-1.5">Category *</label>
                <div className="relative">
                  <select
                    value={formData.categoryId}
                    onChange={(e) => {
                      if (e.target.value === '__add_new__') {
                        setShowQuickAddCategory(true);
                      } else {
                        setFormData({ ...formData, categoryId: e.target.value });
                      }
                    }}
                    className="w-full px-3 py-2.5 bg-background-secondary border border-white/10 rounded-lg text-text-primary focus:outline-none focus:border-accent pr-10"
                    required
                  >
                    <option value="">Select category</option>
                    {categories.filter(c => c.isActive).map(c => (
                      <option key={c.id} value={c.id}>{c.name}</option>
                    ))}
                    <option value="__add_new__" className="text-accent font-medium">+ Add New Category</option>
                  </select>
                  <Plus className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-accent pointer-events-none" />
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-text-secondary mb-1.5">Description</label>
                <textarea
                  value={formData.description}
                  onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                  placeholder="Product description..."
                  rows={2}
                  className="w-full px-3 py-2.5 bg-background-secondary border border-white/10 rounded-lg text-text-primary placeholder-text-muted focus:outline-none focus:border-accent resize-none"
                />
              </div>

              {/* Icon Picker - Mobile */}
              <div>
                <label className="block text-sm font-medium text-text-secondary mb-1.5">Icon</label>
                <div className="flex flex-wrap gap-1.5 p-2 bg-background-secondary rounded-lg border border-white/10 max-h-28 overflow-y-auto">
                  {PRODUCT_ICONS.map((icon) => (
                    <button
                      key={icon}
                      type="button"
                      onClick={() => setFormData({ ...formData, icon })}
                      className={`w-8 h-8 text-lg rounded flex items-center justify-center transition-all ${
                        formData.icon === icon
                          ? 'bg-accent ring-2 ring-accent'
                          : 'bg-background-tertiary hover:bg-white/10'
                      }`}
                    >
                      {icon}
                    </button>
                  ))}
                </div>
              </div>

              <div className="grid grid-cols-3 gap-3">
                <div>
                  <label className="block text-sm font-medium text-text-secondary mb-1.5">Selling Price *</label>
                  <input
                    type="number"
                    step="0.01"
                    value={formData.sellingPrice}
                    onChange={(e) => setFormData({ ...formData, sellingPrice: e.target.value })}
                    placeholder="0.00"
                    className="w-full px-3 py-2.5 bg-background-secondary border border-white/10 rounded-lg text-text-primary placeholder-text-muted focus:outline-none focus:border-accent"
                    required
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-text-secondary mb-1.5">MRP</label>
                  <input
                    type="number"
                    step="0.01"
                    value={formData.mrp}
                    onChange={(e) => setFormData({ ...formData, mrp: e.target.value })}
                    placeholder="0.00"
                    className="w-full px-3 py-2.5 bg-background-secondary border border-white/10 rounded-lg text-text-primary placeholder-text-muted focus:outline-none focus:border-accent"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-text-secondary mb-1.5">Tax Rate</label>
                  <select
                    value={formData.taxRate}
                    onChange={(e) => setFormData({ ...formData, taxRate: e.target.value })}
                    className="w-full px-3 py-2.5 bg-background-secondary border border-white/10 rounded-lg text-text-primary focus:outline-none focus:border-accent"
                  >
                    {TAX_RATES.map(rate => (
                      <option key={rate.value} value={rate.value}>{rate.label}</option>
                    ))}
                  </select>
                </div>
              </div>

              {sections.length > 0 && sections.some(s => s.isActive) && (
                <div className="border-t border-white/10 pt-4">
                  <h4 className="font-medium mb-3">Section-wise Pricing</h4>
                  <div className="space-y-2">
                    {sections.filter(s => s.isActive).map((section) => {
                      const sectionPrice = formData.sectionPrices.find(sp => sp.sectionId === section.id);
                      return (
                        <div key={section.id} className="flex items-center gap-3 p-3 rounded-lg bg-white/5">
                          <label className="text-sm font-medium w-24 truncate">{section.name}</label>
                          <div className="flex-1 relative">
                            <span className="absolute left-3 top-1/2 -translate-y-1/2 text-text-muted">₹</span>
                            <input
                              type="number"
                              step="0.01"
                              value={sectionPrice?.price || ''}
                              onChange={(e) => handleSectionPriceChange(section.id, e.target.value)}
                              placeholder={formData.sellingPrice || '0.00'}
                              className="w-full pl-7 pr-3 py-2 bg-background-secondary border border-white/10 rounded-lg text-text-primary placeholder-text-muted focus:outline-none focus:border-accent"
                            />
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}

              <div className="flex gap-4">
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={formData.isActive}
                    onChange={(e) => setFormData({ ...formData, isActive: e.target.checked })}
                    className="w-5 h-5 rounded border-white/20 bg-background-secondary text-accent focus:ring-accent"
                  />
                  <span className="text-sm">Active</span>
                </label>
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={formData.enableOnline}
                    onChange={(e) => setFormData({ ...formData, enableOnline: e.target.checked })}
                    className="w-5 h-5 rounded border-white/20 bg-background-secondary text-accent focus:ring-accent"
                  />
                  <span className="text-sm">Enable Online</span>
                </label>
              </div>

              {/* Action Buttons */}
              <div className="flex gap-3 pt-2 pb-4">
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="flex-1 py-3 bg-accent hover:bg-accent/80 text-white font-medium rounded-lg transition-colors disabled:opacity-50"
                >
                  {isSubmitting ? 'Saving...' : (editingProduct ? 'Update' : 'Add Product')}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Quick Add Category Modal */}
      {showQuickAddCategory && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4">
          <div className="bg-background-primary rounded-xl w-full max-w-md border border-white/10">
            <div className="flex items-center justify-between p-4 border-b border-white/10">
              <h3 className="text-lg font-semibold">Add New Category</h3>
              <button
                onClick={() => {
                  setShowQuickAddCategory(false);
                  setNewCategoryName('');
                }}
                className="p-1 hover:bg-white/10 rounded-lg transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="p-4 space-y-4">
              <div>
                <label className="block text-sm font-medium text-text-secondary mb-1.5">Category Name *</label>
                <input
                  type="text"
                  value={newCategoryName}
                  onChange={(e) => setNewCategoryName(e.target.value)}
                  placeholder="Enter category name"
                  className="w-full px-3 py-2.5 bg-background-secondary border border-white/10 rounded-lg text-text-primary placeholder-text-muted focus:outline-none focus:border-accent"
                  autoFocus
                />
              </div>
              <div className="flex gap-3">
                <button
                  type="button"
                  onClick={() => {
                    setShowQuickAddCategory(false);
                    setNewCategoryName('');
                  }}
                  className="flex-1 px-4 py-2.5 bg-background-secondary hover:bg-white/10 text-text-primary font-medium rounded-lg transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={async () => {
                    if (!newCategoryName.trim()) return;
                    setIsAddingCategory(true);
                    const newCategory = await createCategory({ name: newCategoryName.trim() });
                    setIsAddingCategory(false);
                    if (newCategory && newCategory !== false) {
                      toast('success', 'Category created successfully');
                      // Set the newly created category as selected
                      const categoryId = typeof newCategory === 'object' ? newCategory.id : newCategory;
                      setFormData({ ...formData, categoryId });
                      setShowQuickAddCategory(false);
                      setNewCategoryName('');
                    } else {
                      toast('error', 'Failed to create category');
                    }
                  }}
                  disabled={!newCategoryName.trim() || isAddingCategory}
                  className="flex-1 px-4 py-2.5 bg-accent hover:bg-accent/80 text-white font-medium rounded-lg transition-colors disabled:opacity-50"
                >
                  {isAddingCategory ? 'Adding...' : 'Add Category'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}