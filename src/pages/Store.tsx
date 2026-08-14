import { motion, AnimatePresence } from 'motion/react';
import React, { useState, useEffect } from 'react';
import { 
  ShoppingBag, 
  ArrowRight, 
  Filter, 
  Search, 
  ChevronRight, 
  ShoppingCart, 
  CheckCircle2,
  X,
  Phone,
  MapPin,
  User,
  CreditCard
} from 'lucide-react';
import toast from 'react-hot-toast';
import { useAppStore, Product } from '../store';
import { useNavigate } from 'react-router-dom';
import { db, auth, handleFirestoreError, OperationType } from '../lib/firebase';
import { collection, addDoc, query, onSnapshot, orderBy } from 'firebase/firestore';
import { getOptimizedImage } from '../lib/cloudinary';

export default function Store() {
  const navigate = useNavigate();
  const { products, setProducts } = useAppStore();
  const [activeCategory, setActiveCategory] = useState<string>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedProduct, setSelectedProduct] = useState<Product | null>(null);
  const [showOrderForm, setShowOrderForm] = useState(false);
  const [orderSuccess, setOrderSuccess] = useState(false);
  
  // Order Form State
  const [formData, setFormData] = useState({
    name: '',
    phone: '',
    address: '',
    quantity: 1
  });

  useEffect(() => {
    const q = query(collection(db, 'products'));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      setProducts(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Product)));
    }, (error) => handleFirestoreError(error, OperationType.LIST, 'products'));
    return () => unsubscribe();
  }, []);

  const categories = [
    { id: 'all', label: 'الكل', icon: <ShoppingBag size={14} /> },
    { id: 'tshirt', label: 'تيشيرتات', icon: <User size={14} /> },
    { id: 'mug', label: 'مجات', icon: <Filter size={14} /> },
    { id: 'scarf', label: 'سكارفات', icon: <Filter size={14} /> },
    { id: 'bracelet', label: 'حظاظات', icon: <Filter size={14} /> },
  ];

  const filteredProducts = products.filter(p => {
    const matchesCategory = activeCategory === 'all' || p.category === activeCategory;
    const matchesSearch = p.name.toLowerCase().includes(searchQuery.toLowerCase());
    return matchesCategory && matchesSearch;
  });

  const handleOrderSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedProduct || !auth.currentUser) return;

    try {
      await addDoc(collection(db, 'orders'), {
        userId: auth.currentUser.uid,
        userEmail: auth.currentUser.email,
        userName: formData.name,
        userPhone: formData.phone,
        userAddress: formData.address,
        productId: selectedProduct.id,
        productName: selectedProduct.name,
        productImage: selectedProduct.imageUrl,
        quantity: formData.quantity,
        totalPrice: selectedProduct.price * formData.quantity,
        status: 'pending',
        createdAt: new Date().toISOString()
      });

      setOrderSuccess(true);
      toast.success('تم استلام طلبك بنجاح');
      setTimeout(() => {
        setOrderSuccess(false);
        setShowOrderForm(false);
        setSelectedProduct(null);
        setFormData({ name: '', phone: '', address: '', quantity: 1 });
      }, 3000);
    } catch (error) {
      console.error('Error placing order:', error);
      toast.error('حدث خطأ أثناء إرسال الطلب');
    }
  };

  return (
    <div className="flex-1 w-full max-w-md md:max-w-5xl lg:max-w-6xl mx-auto bg-background-light dark:bg-background-dark min-h-screen pb-32 md:pb-16 text-right">
      {/* Header */}
      <div style={{ height: 'calc(env(safe-area-inset-top) + 68px)' }} className="w-full relative z-0"></div>
      <header style={{ paddingTop: 'calc(env(safe-area-inset-top) + 16px)' }} className="fixed top-0 inset-x-0 w-full z-40 bg-background-light/80 dark:bg-background-dark/80 backdrop-blur-xl border-b border-border-light/40 dark:border-border-dark/40 px-4 md:px-8 pb-4">
        <div className="flex items-center justify-between max-w-6xl mx-auto">
          <div className="flex items-center gap-4">
            <button onClick={() => navigate(-1)} className="h-10 w-10 flex items-center justify-center rounded-2xl glass-card text-slate-600 dark:text-slate-300">
              <ChevronRight size={20} className="rotate-180" />
            </button>
            <div>
              <h1 className="text-lg font-black text-primary-dark dark:text-white uppercase leading-none">متجر الجماهير</h1>
              <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mt-1 inline-block">المتجر الرسمي للجماهير</span>
            </div>
          </div>
          <div className="w-10 h-10 rounded-2xl bg-primary/10 flex items-center justify-center text-primary relative">
            <ShoppingCart size={20} />
          </div>
        </div>
      </header>

      <main className="p-4 space-y-6">
        {/* Search Bar */}
        <div className="relative group">
          <Search className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-400 group-focus-within:text-primary transition-colors" size={18} />
          <input 
            type="text" 
            placeholder="ابحث عن منتج..." 
            className="w-full h-12 pr-12 pl-4 rounded-2xl border border-border-light dark:border-border-dark bg-white dark:bg-surface-dark font-bold text-sm focus:ring-2 focus:ring-primary/20 transition-all outline-none"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
          />
        </div>

        {/* Categories Scroller */}
        <div className="flex gap-2 overflow-x-auto no-scrollbar pb-2">
          {categories.map((cat) => (
            <button
              key={cat.id}
              onClick={() => setActiveCategory(cat.id)}
              className={`flex items-center gap-2 px-4 py-2.5 rounded-xl whitespace-nowrap font-black text-[11px] transition-all ${
                activeCategory === cat.id 
                ? 'bg-primary text-white shadow-lg shadow-primary/20' 
                : 'bg-white dark:bg-surface-dark text-slate-500 border border-border-light dark:border-border-dark pressable'
              }`}
            >
              {cat.icon}
              {cat.label}
            </button>
          ))}
        </div>

        {/* Products Grid */}
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
          {filteredProducts.map((product, idx) => (
            <motion.div
              layout
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: idx * 0.05 }}
              key={product.id}
              className="bg-white dark:bg-card-dark rounded-3xl border border-border-light dark:border-border-dark overflow-hidden shadow-sm flex flex-col group"
            >
              <div 
                className="h-44 relative bg-slate-100 overflow-hidden cursor-pointer"
                onClick={() => setSelectedProduct(product)}
              >
                <img src={getOptimizedImage(product.imageUrl, 400) || undefined} referrerPolicy="no-referrer" className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-700" alt={product.name} />
                <div className="absolute top-3 left-3 bg-white/90 backdrop-blur-md px-2 py-1 rounded-lg shadow-sm border border-border-light">
                   <span className="text-[10px] font-black text-primary tabular-nums">{product.price} ج.م</span>
                </div>
              </div>
              <div className="p-3 space-y-2">
                <h3 className="text-xs font-black text-slate-800 dark:text-white line-clamp-1">{product.name}</h3>
                <p className="text-[10px] text-slate-400 font-bold line-clamp-2 min-h-[30px]">{product.description}</p>
                <button 
                  onClick={() => {
                    setSelectedProduct(product);
                    setShowOrderForm(true);
                  }}
                  className="w-full py-2 bg-primary text-white rounded-xl text-[10px] font-black hover:bg-primary-dark transition-all pressable flex items-center justify-center gap-2"
                >
                  <ShoppingCart size={12} />
                  اطلب الآن
                </button>
              </div>
            </motion.div>
          ))}
          {filteredProducts.length === 0 && (
            <div className="col-span-2 py-20 text-center flex flex-col items-center gap-4">
               <div className="w-16 h-16 rounded-full bg-slate-100 dark:bg-surface-dark flex items-center justify-center text-slate-400">
                  <Search size={32} />
               </div>
               <p className="text-slate-400 font-bold text-sm">لا توجد منتجات مطابقة للبحث</p>
            </div>
          )}
        </div>
      </main>

      {/* Order Modal */}
      <AnimatePresence>
        {showOrderForm && selectedProduct && (
          <div className="fixed inset-0 z-[100] flex items-end sm:items-center justify-center p-4">
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="absolute inset-0 bg-black/60 backdrop-blur-sm"
              onClick={() => setShowOrderForm(false)}
            />
            <motion.div
              initial={{ y: '100%' }}
              animate={{ y: 0 }}
              exit={{ y: '100%' }}
              className="relative w-full max-w-md bg-white dark:bg-background-dark rounded-t-[40px] sm:rounded-[40px] p-8 shadow-2xl overflow-hidden"
            >
              {orderSuccess ? (
                <div className="py-12 flex flex-col items-center text-center gap-6">
                   <div className="w-20 h-20 bg-green-500 rounded-full flex items-center justify-center text-white shadow-lg shadow-green-500/20 animate-bounce">
                      <CheckCircle2 size={40} />
                   </div>
                   <div>
                      <h2 className="text-xl font-black text-slate-800 dark:text-white mb-2">تم استلام طلبك بنجاح!</h2>
                      <p className="text-sm text-slate-500 font-bold">سيتواصل معك فريق المبيعات قريباً لتأكيد التوصيل.</p>
                   </div>
                </div>
              ) : (
                <div className="space-y-6">
                  <div className="flex items-center justify-between">
                     <button onClick={() => setShowOrderForm(false)} className="h-10 w-10 bg-slate-100 dark:bg-surface-dark rounded-2xl flex items-center justify-center text-slate-500">
                        <X size={20} />
                     </button>
                     <h2 className="text-xl font-black text-slate-800 dark:text-white">إتمام الطلب</h2>
                  </div>

                  <div className="flex gap-4 p-4 rounded-3xl bg-slate-50 dark:bg-surface-dark border border-border-light dark:border-border-dark">
                    <img src={getOptimizedImage(selectedProduct.imageUrl, 200) || undefined} referrerPolicy="no-referrer" className="w-20 h-20 rounded-2xl object-cover shadow-sm" alt="" />
                    <div className="flex-1 flex flex-col justify-center">
                       <h3 className="font-black text-sm text-slate-800 dark:text-white">{selectedProduct.name}</h3>
                       <p className="text-primary font-black text-sm tabular-nums mt-1">{selectedProduct.price * formData.quantity} ج.م</p>
                    </div>
                  </div>

                  <form onSubmit={handleOrderSubmit} className="space-y-4">
                    <div className="space-y-1.5 px-1">
                      <label className="text-[10px] font-black text-slate-400 uppercase pr-2 flex items-center gap-1.5"><User size={10} /> الاسم بالكامل</label>
                      <input 
                        required
                        className="w-full h-12 px-4 rounded-2xl border border-border-light dark:border-border-dark bg-white dark:bg-surface-dark font-bold text-sm outline-none focus:ring-1 focus:ring-primary/40"
                        value={formData.name}
                        onChange={(e) => setFormData({...formData, name: e.target.value})}
                      />
                    </div>
                    <div className="space-y-1.5 px-1">
                      <label className="text-[10px] font-black text-slate-400 uppercase pr-2 flex items-center gap-1.5"><Phone size={10} /> رقم الهاتف</label>
                      <input 
                        required
                        type="tel"
                        className="w-full h-12 px-4 rounded-2xl border border-border-light dark:border-border-dark bg-white dark:bg-surface-dark font-bold text-sm outline-none focus:ring-1 focus:ring-primary/40"
                        value={formData.phone}
                        onChange={(e) => setFormData({...formData, phone: e.target.value})}
                      />
                    </div>
                    <div className="space-y-1.5 px-1">
                      <label className="text-[10px] font-black text-slate-400 uppercase pr-2 flex items-center gap-1.5"><MapPin size={10} /> عنوان التوصيل</label>
                      <textarea 
                        required
                        className="w-full p-4 rounded-2xl border border-border-light dark:border-border-dark bg-white dark:bg-surface-dark font-bold text-sm outline-none focus:ring-1 focus:ring-primary/40 min-h-[80px]"
                        value={formData.address}
                        onChange={(e) => setFormData({...formData, address: e.target.value})}
                      />
                    </div>
                    <div className="flex gap-4">
                       <div className="flex-1 space-y-1.5">
                          <label className="text-[10px] font-black text-slate-400 uppercase pr-2 flex items-center gap-1.5">الكمية</label>
                          <select 
                             className="w-full h-12 px-4 rounded-2xl border border-border-light dark:border-border-dark bg-white dark:bg-surface-dark font-bold text-sm outline-none"
                             value={formData.quantity}
                             onChange={(e) => setFormData({...formData, quantity: Number(e.target.value)})}
                          >
                             {[1,2,3,4,5].map(v => <option key={v} value={v}>{v}</option>)}
                          </select>
                       </div>
                    </div>
                    <button 
                      type="submit"
                      className="w-full h-14 bg-primary text-white rounded-3xl font-black text-sm flex items-center justify-center gap-3 shadow-xl shadow-primary/20 hover:scale-[1.02] active:scale-[0.98] transition-all mt-4"
                    >
                      <CreditCard size={18} />
                      تأكيد طلب الشراء
                    </button>
                  </form>
                </div>
              )}
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
